"use strict";
import * as g from "@akashic/akashic-engine";
import * as pdi from "@akashic/pdi-types";
import {AMFlow} from "@akashic/amflow";
import {NullSurface} from "./resource/Surface";
import {ResourceFactory} from "./resource/ResourceFactory";
import {ExternalEventSender} from "./ExternalEventSender";

export class Platform implements pdi.Platform {
	static ROOT_GAME_CONFIGURATION: string = "/game.json";
	_eventHandler: pdi.PlatformEventHandler;
	_rendererRequirement: pdi.RendererRequirement;
	_videoSurface: bindings.Surface;
	_primarySurface: g.Surface;
	_resourceFactory: ResourceFactory;
	_externalEventSender: ExternalEventSender;
	_gameConfigs: string[];
	amflow: AMFlow;

	constructor(amflow: AMFlow, externalEventSender: ExternalEventSender, gameConfigs: string[]) {
		this._eventHandler = null;
		this._rendererRequirement = null;
		this._videoSurface = null;
		this._primarySurface = null;
		this._resourceFactory = new ResourceFactory();
		this._externalEventSender = externalEventSender;
		this._gameConfigs = gameConfigs;
		this.amflow = amflow;
	}

	setPlatformEventHandler(handler: pdi.PlatformEventHandler): void {
		this._eventHandler = handler;
	}

	loadGameConfiguration(url: string, callback: (err: any, configuration: any) => void): void {
		if (url === Platform.ROOT_GAME_CONFIGURATION) {
			runnerProcess.setImmediate(() => {
				callback(null, {definitions: this._gameConfigs.map(config => "./" + config)});
			});
			return;
		}
		runnerProcess.readText(url, (err: any, text: string) => {
			if (err) {
				callback(err, null);
				return;
			}
			try {
				const result = JSON.parse(text);
				callback(null, result);
			} catch (e) {
				callback(e, null);
			}
		});
	}

	setRendererRequirement(requirement?: pdi.RendererRequirement): void {
		this._rendererRequirement = requirement;
	}

	getPrimarySurface(): g.Surface {
		if (this._primarySurface) {
			return this._primarySurface;
		}
		if (!this._rendererRequirement) {
			throw new Error("no rendererRequirment");
		}
		const w = this._rendererRequirement.primarySurfaceWidth;
		const h = this._rendererRequirement.primarySurfaceHeight;
		this._primarySurface = new NullSurface(w, h);
		return this._primarySurface;
	}

	getResourceFactory(): g.ResourceFactory {
		return this._resourceFactory;
	}

	createLooper(fun: (deltaTime: number) => number): pdi.Looper {
		return runnerProcess.createLooper(fun);
	}

	sendToExternal(playId: string, data: any): void {
		if (!this._externalEventSender) {
			return;
		}
		this._externalEventSender.send(playId, data);
	}

	getVideoSurface(): bindings.Surface {
		return this._videoSurface;
	}

	getGameConfigurationUrl(): string {
		if (this._gameConfigs.length > 1) {
			// return cascading root
			return Platform.ROOT_GAME_CONFIGURATION;
		} else {
			// return game.json path
			return "./" + this._gameConfigs[0];
		}
	}

	getAssetBase(): string {
		if (this._gameConfigs.length > 1) {
			// return cascading root
			return "./";
		} else {
			// return game.json dir
			return g.PathUtil.resolveDirname(this._gameConfigs[0]);
		}
	}
}
