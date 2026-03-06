"use strict";

export const DYNAMIC_PLAYLOG_CODE = "dynamicPlaylogWorker";
export const STATIC_PLAYLOG_CODE = "staticPlaylogWorker";
export const EVENT_HANDLERS_CODE = "eventHandlers";
export const AKASHIC_ENGINE_PARAMETERS_CODE = "akashicEngineParameters";

export interface DynamicPlaylogWorkerValues {
	playId: string;
	executionMode: string;
	frameRateRatio?: number;
}

export interface StaticPlaylogWorkerValues {
	playlog: {
		playId?: string;
		playData?: string;
	};
	frameRateRatio?: number;
	seek?: number;
	terminateAge?: number;
	enableSnapshot?: boolean;
	loop?: boolean;
}

export interface EventHandler {
	type: string;
	endpoint: {
		protocol: string;
		uri: string;
	};
}

export interface EventHandlersValues {
	handlers: EventHandler[];
}

export interface AkashicEngineExternalPlugin {
	code: string;
	args?: any;
}

export interface AkashicEngineParametersValues {
	gameConfigurations: string[];
	args?: any;
	externals?: AkashicEngineExternalPlugin[];
}
