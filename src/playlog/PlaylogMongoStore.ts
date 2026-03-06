"use strict";
import {PlaylogStoreBase} from "./PlaylogStore";
import {TickList} from "@akashic/playlog";
import {StartPoint} from "@akashic/amflow";
import * as AMFlowError from "../amflow/AMFlowError";
import {MongodbConfiguration} from "../configs";
import * as pidx from "./PlaylogIndex";
import * as msgpack from "msgpack-lite";

export class PlaylogMongoStore extends PlaylogStoreBase {
	_playId: string;
	_tickNs: string;
	_startPointNs: string;
	_firstStartPoint: StartPoint;

	constructor(config: MongodbConfiguration, playId: string) {
		super();
		this._playId = playId;
		this._tickNs = config.tickCollection;
		this._startPointNs = config.startPointCollection;
		this._firstStartPoint = null;
	}

	storeTick(frame: number, data: Uint8Array): void {
		this._storeData(this._tickNs, {playId: this._playId, frame: frame}, "data", data, err => {
			if (err) throw AMFlowError.createRuntimeError("store tick failed.");
		});
	}

	getTickList(begin: number, end: number, callback: (error: Error, tickList: TickList) => void): void {
		const query = {playId: this._playId, frame: {$gte: begin, $lt: end}};
		const sort = {frame: 1};
		runnerProcess.mongodbGetBinaryField(this._tickNs,
				JSON.stringify(query), JSON.stringify(sort), "data", 0, 0, (err, bins) => {
			if (err) {
				callback(AMFlowError.createRuntimeError("get ticks from store failed", err), null);
				return;
			}
			if (!bins.length) {
				callback(null, null);
				return;
			}
			let result: TickList;
			try {
				result = this.createTickList(begin, bins);
			} catch (err) {
				callback(err, null);
				return;
			}
			callback(null, result);
		});
	}

	putStartPoint(startPoint: StartPoint, callback: (error: Error) => void): void {
		if (startPoint.frame === 0) {
			// 後で参照される(driver からの seed の取得)のでとっておく
			this._firstStartPoint = startPoint;
		}
		this._storeData(this._startPointNs, {playId: this._playId, frame: startPoint.frame},
				"startPoint", msgpack.encode(startPoint), err => {
			if (err) {
				callback(AMFlowError.createRuntimeError("put startPoint failed.", err));
				return;
			}
			callback(null);
		});
	}

	getStartPoint(opts: {frame?: number}, callback: (error: Error, startPoint: StartPoint) => void): void {
		// frame0 はキャッシュにあったらそちらを返す
		if (!opts.frame && this._firstStartPoint) {
			runnerProcess.setImmediate(() => { callback(null, this._firstStartPoint); });
			return;
		}
		const frame = opts.frame || 0;
		const query = {playId: this._playId, frame: {$lte: frame}};
		const sort = {frame: -1};
		runnerProcess.mongodbGetBinaryField(this._startPointNs,
				JSON.stringify(query), JSON.stringify(sort), "startPoint", 1, 0, (err, result) => {
			if (err) {
				callback(AMFlowError.createRuntimeError("get startPoint failed.", err), null);
				return;
			}
			if (result.length < 1) {
				callback(null, null);
				return;
			}
			callback(null, msgpack.decode(new Uint8Array(result[0])));
		});
	}

	private _storeData(ns: string, data: any, binFieldName: string, binData: Uint8Array, callback: (err: Error) => void): void {
		runnerProcess.mongodbStore(ns, JSON.stringify(data), binFieldName, binData.buffer, binData.byteOffset, binData.byteLength, callback);
	}
}
