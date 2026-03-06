"use strict";
import {PlaylogStoreBase} from "./PlaylogStore";
import {TickList} from "@akashic/playlog";
import {StartPoint} from "@akashic/amflow";
import * as AMFlowError from "../amflow/AMFlowError";
import * as pidx from "./PlaylogIndex";

export class PlaylogMemoryStore extends PlaylogStoreBase {
	_tickList: TickList;
	_startPoints: StartPoint[];

	/**
	 * TickList と StartPoint の配列から on memory playlog store を構築する
	 * 引数に渡された TickList と StartPoint 配列のコピーは行っておらず、内容が変更される可能性がある
	 */
	constructor(tickList: TickList, startPoints: StartPoint[]) {
		super();
		this._tickList = tickList;
		this._startPoints = startPoints;

		this._tickList[pidx.TickList.Ticks].sort((a, b) => (a[pidx.Tick.Frame] - b[pidx.Tick.Frame]));
		this._startPoints.sort((a, b) => (a.frame - b.frame));
		if (this._startPoints[0].frame !== 0) {
			// frame0 の StartPoint (random seed) は必ず存在しなけらばならない
			throw AMFlowError.createRuntimeError("invalid start points.");
		}
	}

	storeTick(frame: number, data: Uint8Array): void {
		throw AMFlowError.createNotImplementedError("storing ticks is not supported.");
	}

	getTickList(begin: number, end: number, callback: (error: Error, tickList: TickList) => void): void {
		if ((end <= this._tickList[pidx.TickList.Begin]) || (this._tickList[pidx.TickList.End] < begin)) {
			runnerProcess.setImmediate(() => { callback(null, null); });
			return;
		}
		const rbegin = Math.max(this._tickList[pidx.TickList.Begin], begin);
		const rend = Math.min(this._tickList[pidx.TickList.End], end - 1);
		let result: TickList = [
			rbegin, rend,
			this._tickList[pidx.TickList.Ticks]
				.filter(t => ((rbegin <= t[pidx.Tick.Frame]) && (t[pidx.Tick.Frame] <= rend)))
		];
		runnerProcess.setImmediate(() => { callback(null, result); });
	}

	putStartPoint(startpoint: StartPoint, callback: (error: Error) => void): void {
		runnerProcess.setImmediate(() => {
			callback(AMFlowError.createNotImplementedError("putting start points is not supported."));
		});
	}

	getStartPoint(opts: {frame?: number}, callback: (error: Error, startPoint: StartPoint) => void): void {
		if (!opts.frame) {
			runnerProcess.setImmediate(() => { callback(null, this._startPoints[0]); });
			return;
		}
		const filtered = this._startPoints.filter(s => (s.frame <= opts.frame));
		runnerProcess.setImmediate(() => {
			callback(null, filtered[filtered.length - 1]);
		});
	}
}
