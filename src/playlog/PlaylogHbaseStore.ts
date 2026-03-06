"use strict";
import {PlaylogStoreBase} from "./PlaylogStore";
import {TickList} from "@akashic/playlog";
import {StartPoint} from "@akashic/amflow";
import * as AMFlowError from "../amflow/AMFlowError";
import {HbaseConfiguration} from "../configs";
import * as pidx from "./PlaylogIndex";
import * as msgpack from "msgpack-lite";

export class PlaylogHbaseStore extends PlaylogStoreBase {
	static columnPlayId: string = "d:playId";
	static columnMessage: string = "d:message";
	_playId: string;
	_tickTable: string;
	_startPointTable: string;
	_firstStartPoint: StartPoint;
	_keyPrefix: string;

	constructor(config: HbaseConfiguration, playId: string) {
		super();
		this._playId = playId;
		this._tickTable = config.tickTable;
		this._startPointTable = config.startPointTable;
		this._firstStartPoint = null;
		this._keyPrefix = playId.split("").reverse().join("") + "-";
	}

	storeTick(frame: number, data: Uint8Array, ignorable?: boolean): void {
		this._put(this._tickTable, frame, data, err => {
			if (err) throw AMFlowError.createRuntimeError("store tick failed.");
		});
	}

	getTickList(begin: number, end: number, callback: (error: Error, tickList: TickList) => void, ignorable?: boolean): void {
		runnerProcess.hbaseScan(this._tickTable, this._key(begin), this._key(end), PlaylogHbaseStore.columnMessage,
			`PrefixFilter('${this._keyPrefix}')`, end - begin, false, (err, bins) => {
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
		this._put(this._startPointTable, startPoint.frame, msgpack.encode(startPoint), err => {
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
		// reverse scan のときは startRow/stopRow も revserse する (startRow > stopRow)
		// https://issues.apache.org/jira/browse/HBASE-4811
		runnerProcess.hbaseScan(this._startPointTable, this._key(opts.frame || 0), "", PlaylogHbaseStore.columnMessage,
			`PrefixFilter('${this._keyPrefix}')`, 1, true, (err, result) => {
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

	private _key(frame: number): string {
		// "playId (逆読み)"-"frame 番号 10 桁"
		// playId "123" の場合 
		//  321-0000000001
		//  321-0000000002
		//  ...
		return this._keyPrefix + (`000000000${frame}`).slice(-10);
	}

	private _put(table: string, frame: number, data: Uint8Array, callback: (err: Error) => void): void {
		runnerProcess.hbasePut(table, this._key(frame),
			[
				[PlaylogHbaseStore.columnPlayId, this._playId],
				[PlaylogHbaseStore.columnMessage, data.buffer, data.byteOffset, data.byteLength]
			],
			callback);
	}
}
