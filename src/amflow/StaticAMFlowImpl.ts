"use strict";
import * as g from "@akashic/akashic-engine";
import * as AMFlow from "@akashic/amflow";
import * as playlog from "@akashic/playlog";
import * as config from "../configs";
import {PlaylogStore} from "../playlog/PlaylogStore";
import * as pidx from "../playlog/PlaylogIndex";
import * as AMFlowError from "./AMFlowError";
import * as msgpack from "msgpack-lite";

export type GetTickListCallback = (error: Error | null, tickList?: playlog.TickList) => void;

export class StaticAMFlowImpl implements AMFlow.AMFlow {
	_sessionActive: boolean;
	_permission: AMFlow.Permission;
	_playlogStore: PlaylogStore;
	_playId: string;

	constructor(config: config.AMFlowConfiguration, permission: AMFlow.Permission, playlogStore: PlaylogStore) {
		this._sessionActive = false;
		this._permission = permission;
		this._playlogStore = playlogStore;
		this._playId = null;
	}

	open(playId: string, callback?: (error?: Error) => void): void {
		if (this._sessionActive) {
			runnerProcess.setImmediate(() => { throw AMFlowError.createInvalidStatusError("session is active now."); });
		}
		this._playId = playId;
		this._sessionActive = true;
		if (callback) {
			runnerProcess.setImmediate(callback);
		}
	}

	close(callback?: (error?: Error) => void): void {
		this._playId = null;
		this._sessionActive = false;
		if (callback) {
			runnerProcess.setImmediate(callback);
		}
	}

	authenticate(token: string, callback: (error: Error, permission: AMFlow.Permission) => void): void {
		if (!this._sessionActive) {
			runnerProcess.setImmediate(() => {
				callback(AMFlowError.createInvalidStatusError("session is not active"), null);
			});
			return;
		}
		runnerProcess.setImmediate(() => { callback(null, this._permission); });
	}

	sendTick(tick: playlog.Tick): void {
		throw AMFlowError.createNotImplementedError("sending ticks is not supported.");
	}

	onTick(handler: (tick: playlog.Tick) => void): void {
		// 現状のドライバは tick の subscribe を行うので、例外は投げず、なにもしない
	}

	offTick(handler: (tick: playlog.Tick) => void): void {
		throw AMFlowError.createNotImplementedError("subscribing ticks is not supported.");
	}

	sendEvent(event: playlog.Event): void {
		throw AMFlowError.createNotImplementedError("sending events is not supported.");
	}

	onEvent(handler: (event: playlog.Event) => void): void {
		throw AMFlowError.createNotImplementedError("subscribing events is not supported.");
	}

	offEvent(handler: (event: playlog.Event) => void): void {
		throw AMFlowError.createNotImplementedError("subscribing events is not supported.");
	}

	getTickList(
		beginOrOptions: number | AMFlow.GetTickListOptions,
		endOrCallback: number | GetTickListCallback,
		callback?: GetTickListCallback
	): void {
		if (typeof beginOrOptions === "number" && typeof endOrCallback === "number" && callback) {
			this.getTickListImpl(
				{ begin: beginOrOptions as number, end: endOrCallback as number },
				callback
			);
		} else {
			this.getTickListImpl(
				beginOrOptions as AMFlow.GetTickListOptions,
				endOrCallback as GetTickListCallback
			);
		}
	}

	getTickListImpl(opts: AMFlow.GetTickListOptions, callback: GetTickListCallback): void {
		const begin = opts.begin;
		const end = opts.end;
		let ignorable: boolean = false;
		if (opts.excludeEventFlags) {
			ignorable = opts.excludeEventFlags.ignorable || false;
		}

		let err: Error = null;
		if (!this._sessionActive) {
			err = AMFlowError.createInvalidStatusError("session is not active.");
		} else if (!this._permission.readTick) {
			err = AMFlowError.createInvalidStatusError("reading ticks is not permitted.");
		}
		if (err) {
			runnerProcess.setImmediate(() => { callback(err, null); });
			return;
		}
		this._playlogStore.getTickList(begin, end, callback, ignorable);
	}

	putStartPoint(startPoint: AMFlow.StartPoint, callback: (error: Error) => void): void {
		throw AMFlowError.createNotImplementedError("putting start points is not supported.");
	}

	getStartPoint(opts: {frame?: number}, callback: (error: Error, startPoint: AMFlow.StartPoint) => void): void {
		let err: Error = null;
		if (!this._sessionActive) {
			err = AMFlowError.createInvalidStatusError("session is not active.");
		} else if (!this._permission.readTick) {
			err = AMFlowError.createInvalidPermissionError("getting start point is not permitted.");
		}
		if (err) {
			runnerProcess.setImmediate(() => { callback(err, null); });
			return;
		}
		this._playlogStore.getStartPoint(opts, callback);
	}

	putStorageData(key: playlog.StorageKey, value: playlog.StorageValue, options: any, callback: (err: Error) => void): void {
		throw AMFlowError.createNotImplementedError("putting storage data is not supported.");
	}

	getStorageData(keys: playlog.StorageReadKey[], callback: (error: Error, values: playlog.StorageData[]) => void): void {
		throw AMFlowError.createNotImplementedError("getting storage data is not supported.");
	}
}
