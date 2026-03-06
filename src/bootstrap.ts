/// <reference path="../typings/tsd.d.ts" />

"use strict";
import * as g from "@akashic/akashic-engine";
import * as playlog from "@akashic/playlog";
import {getConfiguration} from "./configs";
import * as mods from "./modules";
import {GameLauncher, GameLauncherParameters, LaunchResult} from "./launcher/GameLauncher";
import {DynamicPlaylogLauncher} from "./launcher/DynamicPlaylogLauncher";
import {StaticPlaylogLauncher} from "./launcher/StaticPlaylogLauncher";
import {ExternalEventSender} from "./ExternalEventSender";
import {GameDriver} from "@akashic/game-driver";
import {DynamicAMFlowImpl} from "./amflow/DynamicAMFlowImpl";

let dynamicPlaylogMod: mods.DynamicPlaylogWorkerValues = null;
let staticPlaylogMod: mods.StaticPlaylogWorkerValues = null;
let eventHandlersMod: mods.EventHandlersValues = null;
let akashicEngineParametersMod: mods.AkashicEngineParametersValues = null;
runnerProcess.modules.forEach(module => {
	if (module.code === mods.DYNAMIC_PLAYLOG_CODE && !dynamicPlaylogMod) {
		dynamicPlaylogMod = module.values;
	} else if (module.code === mods.STATIC_PLAYLOG_CODE && !staticPlaylogMod) {
		staticPlaylogMod = module.values;
	} else if (module.code === mods.EVENT_HANDLERS_CODE && !eventHandlersMod) {
		eventHandlersMod = module.values;
	} else if (module.code === mods.AKASHIC_ENGINE_PARAMETERS_CODE && !akashicEngineParametersMod) {
		akashicEngineParametersMod = module.values;
	}
});

if (!staticPlaylogMod && !dynamicPlaylogMod) {
	throw new Error("no worker modules found.");
}
// static/dynamic 両方指定されていたら static 優先
if (staticPlaylogMod) {
	dynamicPlaylogMod = null;
}

const config = getConfiguration();
if (runnerProcess.hbaseEnabled) {
	// game-runner が HBase 有効で起動しているときは HBase を使う
	// そうでない場合は mongodb
	config.amflow.store.type = "hbase";
}

// parse enginge parameters
if (!akashicEngineParametersMod) {
	throw new Error("no akashicEngineParameters module.");
}
if (!akashicEngineParametersMod.gameConfigurations) {
	throw new Error("no gameConfigurations in akashicEngineParameters module.");
}
const gameConfigs = akashicEngineParametersMod.gameConfigurations;
if (!Array.isArray(gameConfigs)) {
	throw new Error("invalid gameConfigurations (not array).");
}
runnerProcess.setupResourcePathList(gameConfigs.map(path => g.PathUtil.resolveDirname(path)));

// parse event handlers parameters
let canSendExternalEvent = false;
if (eventHandlersMod) {
	for (let i = 0; i < eventHandlersMod.handlers.length; ++i) {
		if (eventHandlersMod.handlers[i].type === "gameEvent") {
			canSendExternalEvent = true;
			break;
		}
	}
}
// externalActive のときは external.send を強制的に有効にする
if (!staticPlaylogMod && dynamicPlaylogMod && dynamicPlaylogMod.executionMode === "externalActive") {
	canSendExternalEvent = true;
}

let useAmqp = false;
if (canSendExternalEvent || dynamicPlaylogMod) {
	useAmqp = true;
}

const externalEventSender = canSendExternalEvent ? new ExternalEventSender(config.externalEvent.eventExchange) : null;
const externals: {[name: string]: any} = {};
const eventFilters: ((event: playlog.Event) => boolean)[] = [];

function launch(): Promise<LaunchResult> {
	let launcher: GameLauncher = null;
	const launcherParam: GameLauncherParameters = {
		workerParam: null,
		engineParam: akashicEngineParametersMod,
		externalEventSender: externalEventSender,
		externals: externals,
		eventFilters: eventFilters
	};
	if (staticPlaylogMod) {
		launcherParam.workerParam = staticPlaylogMod;
		launcher = new StaticPlaylogLauncher(config, launcherParam);
	} else if (dynamicPlaylogMod) {
		launcherParam.workerParam = dynamicPlaylogMod;
		launcher = new DynamicPlaylogLauncher(config, launcherParam);
	}

	return launcher.launchGame()
		.then(result => {
			const platform = result.platform;
			const driver = result.driver;
			const game = result.game;
			if (game.shouldSaveSnapshot()) {
				let lastSnapshotReqFrame = 0;
				const snapshotReqLoop = runnerProcess.createLooper(delta => {
					if (game.age > lastSnapshotReqFrame) {
						game.snapshotRequest.fire();
						lastSnapshotReqFrame = game.age;
					}
					return config.snapshotRequestIntervalSecs * 1000;
				});
				snapshotReqLoop.start();
			}
			return result;
		});
}

if (useAmqp) {
	let gameDriver: GameDriver;
	let amflowImpl: DynamicAMFlowImpl;
	let launched = false;
	let launchTimeout = Date.now() + 10000;  // 10 秒
	const launchTimeoutLoop = runnerProcess.createLooper(delta => {
		if (Date.now() > launchTimeout) {
			throw new Error("waiting amqp connection timeout");
		}
		return 1000;
	});
	launchTimeoutLoop.start();
	runnerProcess.openAmqpConnection((event, msg) => {
		if (event === "connected") {
			if (!launched) {
				launch()
					.then(result => {
						launchTimeoutLoop.stop();
						gameDriver = result.driver;
						if (dynamicPlaylogMod) {
							amflowImpl = <DynamicAMFlowImpl>result.platform.amflow;
						}
					})
					.catch(err => { runnerProcess.setImmediate(() => { throw err; }); });
				launched = true;
			} else {
				if (amflowImpl && gameDriver) {
					launchTimeoutLoop.stop();
					// 止めていたゲーム実行を再開
					amflowImpl.onAmqpConnected()
						.then(() => gameDriver.startGame());
				}
			}
		} else if (event === "disconnected") {
			if (amflowImpl && gameDriver) {
				// ゲーム実行をいったん止める
				amflowImpl.onAmqpDisconnected();
				gameDriver.stopGame();
				launchTimeout = Date.now() + 10000;  // 10 秒
				launchTimeoutLoop.start();
			}
		}
	});
} else {
	launch()
		.catch(err => { runnerProcess.setImmediate(() => { throw err; }); });
}
