"use strict";
import {GameDriver, Game} from "@akashic/game-driver";
import * as playlog from "@akashic/playlog";
import {Platform} from "../Platform";
import * as mods from "../modules";
import {ExternalEventSender} from "../ExternalEventSender";

export interface GameLauncherParameters {
	workerParam: mods.StaticPlaylogWorkerValues | mods.DynamicPlaylogWorkerValues;
	engineParam: mods.AkashicEngineParametersValues;
	externalEventSender: ExternalEventSender;
	externals?: {[name: string]: any};
	eventFilters?: ((event: playlog.Event) => boolean)[];
}

export interface LaunchResult {
	platform: Platform;
	driver: GameDriver;
	game: Game;
}

export interface GameLauncher {
	game: Game;
	launchGame(): Promise<LaunchResult>;
}
