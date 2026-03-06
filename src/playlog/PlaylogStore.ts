"use strict";
import {Tick, TickList} from "@akashic/playlog";
import {StartPoint} from "@akashic/amflow";
import * as AMFlowError from "../amflow/AMFlowError";
import * as pidx from "./PlaylogIndex";
import * as msgpack from "msgpack-lite";

export interface PlayData {
	tickList: TickList;
	startPoints: StartPoint[];
}

export interface PlaylogStore {
	storeTick(frame: number, data: Uint8Array): void;
	getTickList(begin: number, end: number, callback: (error: Error, tickList: TickList) => void): void;
	putStartPoint(startPoint: StartPoint, callback: (error: Error) => void): void;
	getStartPoint(opts: {frame?: number}, callback: (error: Error, startPoint: StartPoint) => void): void;
	getAll(): Promise<PlayData>;
}

export abstract class PlaylogStoreBase implements PlaylogStore {
	abstract storeTick(frame: number, data: Uint8Array): void;
	abstract getTickList(begin: number, end: number, callback: (error: Error, tickList: TickList) => void): void;
	abstract putStartPoint(startPoint: StartPoint, callback: (error: Error) => void): void;
	abstract getStartPoint(opts: {frame?: number}, callback: (error: Error, startPoint: StartPoint) => void): void;

	createTickList(begin: number, bins: ArrayBuffer[]): TickList {
		const result: TickList = [begin, begin + bins.length - 1, []];
		bins.forEach((bin, index) => {
			const data = msgpack.decode(new Uint8Array(bin));
			let frame: number;
			if (Array.isArray(data)) {
				frame = data[pidx.Tick.Frame];
				if ((data[pidx.Tick.Events] && data[pidx.Tick.Events].length) || (data[pidx.Tick.Storage] && data[pidx.Tick.Storage].length)) {
					// has event data or/and storage data
					result[pidx.TickList.Ticks].push(<Tick>data);
				}
			} else {
				frame = data;
			}
			if (frame !== begin + index) {
				// 連続したフレームがとれていない
				throw AMFlowError.createRuntimeError("got invalid tick, expect frame: " + (begin + index) + ", actual: " + frame + ".");
			}
		});
		return result;
	}

	getAll(): Promise<PlayData> {
		const result: PlayData = {tickList: null, startPoints: null};
		return this._getAllPlaylog()
			.then(tickList => {
				result.tickList = tickList;
				return this._getStartPoints(tickList ? tickList[pidx.TickList.End] : 0);
			})
			.then(startPoints => {
				result.startPoints = startPoints;
				return result;
			});
	}

	private _getAllPlaylog(): Promise<TickList> {
		let lastTickList: TickList = null;
		const count = 5000;
		return new Promise((resolve, reject) => {
			// count 数分 TickList を繰り返して、最終 frame を取得する
			const getTickList = (begin: number, end: number) => {
				this.getTickList(begin, end, (err, tickList) => {
					if (err) {
						return reject(err);
					}
					if (!tickList) {
						// 最後まで読んだ
						return resolve(lastTickList);
					}
					// 前回までの結果とマージ
					if (!lastTickList) {
						lastTickList = [0, 0, []];
					}
					lastTickList[pidx.TickList.End] = tickList[pidx.TickList.End];
					lastTickList[pidx.TickList.Ticks] =
						lastTickList[pidx.TickList.Ticks].concat(tickList[pidx.TickList.Ticks]);
					// 次の count 分を取得
					getTickList(begin + count, end + count);
				});
			};
			getTickList(0, count);
		});
	}

	// frame 以下の StartPoint 全て取得
	private _getStartPoints(frame: number): Promise<StartPoint[]> {
		const result: StartPoint[] = [];
		return new Promise((resolve, reject) => {
			const getStartPoint = (f: number) => {
				this.getStartPoint({frame: f}, (err, startPoint) => {
					if (err) {
						return reject(err);
					}
					if (!startPoint) {
						return resolve(result);
					}
					result.unshift(startPoint);
					if (startPoint.frame === 0) {
						return resolve(result);
					}
					getStartPoint(startPoint.frame - 1);
				});
			};
			getStartPoint(frame);
		});
	}
}
