"use strict";

import {GameLauncher, GameLauncherParameters, LaunchResult} from "./GameLauncher";
import {Configuration} from "../configs";
import {DynamicPlaylogWorkerValues} from "../modules";
import {AMFlow, Permission, StartPoint} from "@akashic/amflow";
import {Platform} from "../Platform";
import {GameDriver, Game, ExecutionMode, LoopMode, LoopRenderMode,
	DriverConfiguration, LoopConfiguration, ReplayAmflowProxy} from "@akashic/game-driver";
import {DynamicAMFlowImpl, DynamicAMFlowImplParams} from "../amflow/DynamicAMFlowImpl";
import {DynamicAMFlowImplExcludedEventFlag} from "../amflow/DynamicAMFlowImplExcludedEventFlag";
import {PlaylogStore, PlayData} from "../playlog/PlaylogStore";
import {PlaylogMongoStore} from "../playlog/PlaylogMongoStore";
import {PlaylogHbaseStore} from "../playlog/PlaylogHbaseStore";
import {TickList as TickListIndex} from "../playlog/PlaylogIndex";
import {AmqpChannelWrapper} from "../AmqpChannelWrapper";
import {ExternalEventSender} from "../ExternalEventSender";
import * as g from "@akashic/akashic-engine";

interface InitParameters {
	amflow: AMFlow;
	driverConfiguration: DriverConfiguration;
	loopConfiguration: LoopConfiguration;
}

export class DynamicPlaylogLauncher implements GameLauncher {
	_started: boolean;
	_config: Configuration;
	_param: GameLauncherParameters;
	_playId: string;
	_isActive: boolean;
	_platform: Platform;
	_amflow: DynamicAMFlowImpl;
	_driver: GameDriver;
	_playlogStore: PlaylogStore;
	_frameRateRatio: number;
	_firstTargetAge: number;
	game: Game;

	constructor(config: Configuration, param: GameLauncherParameters) {
		this._started = false;
		this._config = config;
		this._param = param;
		this._isActive = false;

		const workerParam = <DynamicPlaylogWorkerValues>param.workerParam;
		this._playId = workerParam.playId;
		if (config.amflow.store.type === "mongodb") {
			this._playlogStore = new PlaylogMongoStore(config.amflow.store.mongodb, this._playId);
		} else if (config.amflow.store.type === "hbase") {
			this._playlogStore = new PlaylogHbaseStore(config.amflow.store.hbase, this._playId);
		} else {
			throw new Error("invalid playlog store configuration.");
		}

		this._platform = null;
		this._frameRateRatio = 1;
		let dynamicAMFlowImplParams: DynamicAMFlowImplParams;
		if (workerParam.executionMode === "active" || workerParam.executionMode === "externalActive") {
			this._isActive = true;
			dynamicAMFlowImplParams = {
				config: config.amflow,
				permission: {
					writeTick: true,
					readTick: true,
					subscribeTick: true,
					sendEvent: false,
					subscribeEvent: true,
					maxEventPriority: 3 /* system */
				},
				playlogStore: this._playlogStore,
				eventFilters: this._param.eventFilters,
				tickExporter: workerParam.executionMode === "externalActive" ? this._param.externalEventSender : null
			};
			if (typeof workerParam.frameRateRatio === "number" && !isNaN(workerParam.frameRateRatio) && workerParam.frameRateRatio > 0) {
				this._frameRateRatio = workerParam.frameRateRatio;
			}
		} else {
			dynamicAMFlowImplParams = {
				config: config.amflow,
				permission: {
					writeTick: false,
					readTick: true,
					subscribeTick: true,
					sendEvent: true,
					subscribeEvent: false,
					maxEventPriority: 3 /* system */
				},
				playlogStore: this._playlogStore
			};
		}
		this._amflow = this._createDynamicAMFlow(runnerProcess.gameCode, dynamicAMFlowImplParams);
		this._firstTargetAge = null;
		this.game = null;
	}

	launchGame(): Promise<LaunchResult> {
		if (this._started) {
			throw new Error("already started.");
		}
		this._started = true;
		const startTime = Date.now();
		return new Promise((resolve, reject) => {
			if (this._isActive) {
				// active mode のきは playlog write lock を取得
				if (runnerProcess.lockActivePlay(this._playId)) {
					resolve();
				} else {
					reject(new Error("can't get playlog lock."));
				}
			} else {
				// passive mode のきは startPoint@frame0 が取得できるのを待つ
				resolve(this._waitFirstStartPoint());
			}
		})
		.then(() => {
			console.log(`lock active play. time: ${Date.now() - startTime} ms.`);
			if (this._isActive) {
				// playlog がすでに存在するかどうかのチェック
				return this._playlogStore.getAll();
			}
			return undefined;
		})
		.then((playData: PlayData) => {
			console.log(`get all play. time: ${Date.now() - startTime} ms.`);
			const initParams = this._setupInitParameters(playData);
			this._platform = new Platform(
				initParams.amflow,
				this._param.externalEventSender,
				this._param.engineParam.gameConfigurations
			);
			this._driver = new GameDriver({
				platform: this._platform,
				player: {id: undefined},
				errorHandler: this._onDriverError,
				errorHandlerOwner: this
			});
			this._driver.gameCreatedTrigger.add({
				owner: this,
				func: this._onGameCreated
			});
			return new Promise((resolve, reject) => {
				this._driver.initialize({
					configurationUrl: this._platform.getGameConfigurationUrl(),
					assetBase: this._platform.getAssetBase(),
					driverConfiguration: initParams.driverConfiguration,
					loopConfiguration: initParams.loopConfiguration,
					gameArgs: this._param.engineParam.args
				}, err => {
					// game-runner の Looper 処理は高負荷により遅延しうる。
					// 経過時間が極端に長いケースでも異常とせず GameDriver に正確な時間と認識させる
					this._driver._gameLoop._clock._deltaTimeBrokenThreshold = Infinity;

					if (err) {
						reject(err);
						return;
					}
					resolve();
				});
			});
		})
		.then(() => {
			if (!this.game) {
				throw new Error("driver initialization failed (game is empty)");
			}
			this._driver.startGame();
			return {
				platform: this._platform,
				driver: this._driver,
				game: this.game
			};
		});
	}

	// playlog-store-workerに実装が移ったら消せるメソッド
	private _createDynamicAMFlow(gameCode: string, dynamicAMFlowImplParams: DynamicAMFlowImplParams): DynamicAMFlowImpl {
		// test-ignorableは開発環境での動作確認用コンテンツ
		if (gameCode === "test-ignorable") {
			return new DynamicAMFlowImplExcludedEventFlag(
				dynamicAMFlowImplParams
			);
		} else {
			return new DynamicAMFlowImpl(
				dynamicAMFlowImplParams
			);
		}
	}

	private _waitFirstStartPoint(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let retry = 0;
			const checkFirstStartPoint = () => {
				this._playlogStore.getStartPoint({}, (err: Error, startPoint: StartPoint) => {
					if (err) {
						reject(err);
						return;
					}
					if (startPoint) {
						resolve();
					} else {
						++retry;
						if (retry >= this._config.realtimeGameLoop.firstStartPointWait.maxRetries) {
							reject(new Error("first startPoint (random seed) is not available."));
							return;
						}
						setTimeout(checkFirstStartPoint, this._config.realtimeGameLoop.firstStartPointWait.sleepMsecs);
					}
				});
			};
			checkFirstStartPoint();
		});
	}

	private _setupInitParameters(playData: PlayData): InitParameters {
		let amflow: AMFlow = this._amflow;
		let execMode = this._isActive ? ExecutionMode.Active : ExecutionMode.Passive;
		const loopConfig: LoopConfiguration = {
			loopMode: LoopMode.Realtime,
			loopRenderMode: LoopRenderMode.None,
			playbackRate: this._frameRateRatio
		};
		if (this._isActive && playData && playData.startPoints.length) {
			// 続きからプレー
			// 既存の playlog 終端までは passive で実行する
			if (!playData.tickList) {
				// 再生すべきログがない
				throw new Error("startPoints exists, but no ticks found on playId: " + this._playId);
			}
			this._firstTargetAge = playData.tickList[TickListIndex.End];
			amflow = new ReplayAmflowProxy({amflow: this._amflow, tickList: playData.tickList, startPoints: playData.startPoints});
			execMode = ExecutionMode.Passive;
			loopConfig.loopMode = LoopMode.Replay;
			loopConfig.targetAge = this._firstTargetAge;
			loopConfig.delayIgnoreThreshold = 1;
			loopConfig.skipTicksAtOnce = this._config.replayGameLoop.seekSkipTicksAtOnce;
		}
		return {
			amflow: amflow,
			driverConfiguration: {
				playId: this._playId,
				playToken: "",
				executionMode: execMode
			},
			loopConfiguration: loopConfig
		};
	}

	private _onDriverError(err: any): void {
		runnerProcess.setImmediate(() => { throw err; });
	}

	private _onGameCreated(game: Game): void {
		this.game = game;
		if (this._firstTargetAge > 0) {
			game.requestNotifyAgePassed(this._firstTargetAge);
			game.agePassedTrigger.add({
				owner: this,
				func: this._onNotifyAge
			});
		}
		if (this._param.externals) {
			Object.keys(this._param.externals).forEach(name => {
				this.game.external[name] = this._param.externals[name];
			});
		}
	}

	private _onNotifyAge(age: number): boolean {
		if (age !== this._firstTargetAge) return false;

		this._driver.stopGame();
		this._changeDriverState(err => {
			if (err) {
				runnerProcess.setImmediate(() => { throw err; });
				return;
			}
			this._driver.setNextAge(age + 1);
			this._driver.startGame();
		});
		return true;
	}

	// passive から active に切り換える
	private  _changeDriverState(callback: (err: any) => void): void {
		this._driver.changeState({
			driverConfiguration: {
				executionMode: ExecutionMode.Active
			},
			loopConfiguration: {
				playbackRate: this._frameRateRatio,
				loopMode: LoopMode.Realtime,
				delayIgnoreThreshold: 6,  // game-driver の初期値
				skipTicksAtOnce: 100      // game-driver の初期値
			}
		}, callback);
	}
}
