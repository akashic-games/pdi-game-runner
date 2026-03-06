"use strict";

import {GameLauncher, GameLauncherParameters, LaunchResult} from "./GameLauncher";
import {Configuration} from "../configs";
import {StaticPlaylogWorkerValues} from "../modules";
import {Permission, StartPoint} from "@akashic/amflow";
import {Platform} from "../Platform";
import {GameDriver, Game, ExecutionMode, LoopMode, LoopRenderMode, LoopConfiguration} from "@akashic/game-driver";
import {StaticAMFlowImpl} from "../amflow/StaticAMFlowImpl";
import {PlaylogStore} from "../playlog/PlaylogStore";
import {PlaylogMongoStore} from "../playlog/PlaylogMongoStore";
import {PlaylogHbaseStore} from "../playlog/PlaylogHbaseStore";
import {PlaylogMemoryStore} from "../playlog/PlaylogMemoryStore";
import * as pidx from "../playlog/PlaylogIndex";
import * as msgpack from "msgpack-lite";

export class StaticPlaylogLauncher implements GameLauncher {
	_started: boolean;
	_config: Configuration;
	_param: GameLauncherParameters;
	_platform: Platform;
	_amflow: StaticAMFlowImpl;
	_driver: GameDriver;
	_playlogStore: PlaylogStore;
	_dataSource: PlaylogStore;
	_playId: string;
	_terminateAge: number;
	_frameRateRatio: number;
	_loopConfig: LoopConfiguration;
	game: Game;

	constructor(config: Configuration, param: GameLauncherParameters) {
		const workerParam = <StaticPlaylogWorkerValues>param.workerParam;
		if (!workerParam.playlog) {
			throw new Error("invalid parameter.");
		}
		this._started = false;
		this._config = config;
		this._param = param;
		this._platform = null;
		this._driver = null;
		this._playlogStore = null;
		this._dataSource = null;
		this._amflow = null;
		if (workerParam.playlog.playData) {
			const playData = msgpack.decode(new Buffer(workerParam.playlog.playData, "base64"));
			if (!Array.isArray(playData.tickList) || (!Array.isArray(playData.startPoints))) {
				throw new Error("invalid playlog data.");
			}
			this._playlogStore = new PlaylogMemoryStore(playData.tickList, playData.startPoints);
			this._playId = "";
			if (typeof workerParam.terminateAge === "number" && !isNaN(workerParam.terminateAge)) {
				this._terminateAge = Math.min(workerParam.terminateAge, playData.tickList[pidx.TickList.End]);
			} else {
				this._terminateAge = playData.tickList[pidx.TickList.End];
			}
		} else if (workerParam.playlog.playId) {
			if (config.amflow.store.type === "mongodb") {
				this._dataSource = new PlaylogMongoStore(config.amflow.store.mongodb, workerParam.playlog.playId);
			} else if (config.amflow.store.type === "hbase") {
				this._dataSource = new PlaylogHbaseStore(config.amflow.store.hbase, workerParam.playlog.playId);
			} else {
				throw new Error("invalid playlog store configuration.");
			}
			this._playId = workerParam.playlog.playId;
			if (typeof workerParam.terminateAge === "number" && !isNaN(workerParam.terminateAge)) {
				this._terminateAge = workerParam.terminateAge;
			} else {
				this._terminateAge = null;
			}
		} else {
			throw new Error("invalid playlog parameter.");
		}
		if (typeof workerParam.frameRateRatio === "number" && !isNaN(workerParam.frameRateRatio) && workerParam.frameRateRatio > 0) {
			this._frameRateRatio = workerParam.frameRateRatio;
		} else {
			this._frameRateRatio = 1;
		}
		this.game = null;
	}

	launchGame(): Promise<LaunchResult> {
		const workerParam = <StaticPlaylogWorkerValues>this._param.workerParam;
		if (this._started) {
			throw new Error("already started.");
		}
		this._started = true;

		return Promise.resolve()
			.then(() => {
				if (!this._playlogStore) {
					// Store から playlog/startPoint を取得して PlaylogMemoryStore を初期化
					return this._dataSource.getAll()
						.then(playData => {
							this._playlogStore = new PlaylogMemoryStore(playData.tickList, playData.startPoints);
							const endFrame = playData.tickList[pidx.TickList.End];
							if (this._terminateAge) {
								this._terminateAge = Math.min(endFrame, this._terminateAge);
							} else {
								this._terminateAge = endFrame;
							}
						});
				}
			})
			.then(() => {
				if (this._terminateAge <= 0) {
					return Promise.reject(new Error("invalid terminateAge: " + this._terminateAge));
				}
				this._amflow = new StaticAMFlowImpl(this._config.amflow, {
					writeTick: false,
					readTick: true,
					subscribeTick: false,
					sendEvent: false,
					subscribeEvent: false,
					maxEventPriority: 0
				}, this._playlogStore);
				this._platform = new Platform(
					this._amflow,
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
				this._loopConfig = {
					loopMode: LoopMode.Replay,
					loopRenderMode: LoopRenderMode.None,
					playbackRate: this._frameRateRatio
				};
				if (workerParam.seek) {
					this._loopConfig.targetAge = workerParam.seek;
					this._loopConfig.skipTicksAtOnce = this._config.replayGameLoop.seekSkipTicksAtOnce;
					this._loopConfig.delayIgnoreThreshold = 1;
				}
				if (!workerParam.enableSnapshot) {
					this._loopConfig.jumpTryThreshold = Number.MAX_SAFE_INTEGER;
				}
				return this._initializeDriver();
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

	private _initializeDriver(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this._driver.initialize({
				configurationUrl: this._platform.getGameConfigurationUrl(),
				assetBase: this._platform.getAssetBase(),
				driverConfiguration: {
					playId: this._playId,
					playToken: "",
					executionMode: ExecutionMode.Passive
				},
				loopConfiguration: this._loopConfig,
				gameArgs: this._param.engineParam.args
			}, err => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	private _onDriverError(err: any): void {
		runnerProcess.setImmediate(() => { throw err; });
	}

	private _onGameCreated(game: Game): void {
		this.game = game;
		if (this._terminateAge > 0) {
			game.requestNotifyAgePassed(this._terminateAge);
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
		if (age !== this._terminateAge) return false;

		const workerParam = <StaticPlaylogWorkerValues>this._param.workerParam;
		if (!workerParam.loop) {
			runnerProcess.exit(0);
		}
		// driver を再初期化してループさせる
		this._driver.stopGame();
		this._initializeDriver()
			.then(() => this._driver.startGame())
			.catch(err => { runnerProcess.setImmediate(() => { throw err; }); });
		return true;
	}
}
