"use strict";
import * as playlog from "@akashic/playlog";
import * as pidx from "../playlog/PlaylogIndex";
import * as AMFlowError from "./AMFlowError";
import * as msgpack from "msgpack-lite";
import { DynamicAMFlowImpl, DynamicAMFlowImplParams } from "./DynamicAMFlowImpl";

export type EventFilterCallback = (event: playlog.Event) => boolean;

export class DynamicAMFlowImplExcludedEventFlag extends DynamicAMFlowImpl {

	static isTransientEvent(event: playlog.Event): boolean {
		return !!(event[playlog.EventIndex.EventFlags] & playlog.EventFlagsMask.Transient);
	}

	static isIgnorableEvent(event: playlog.Event): boolean {
		return !!(event[playlog.EventIndex.EventFlags] & playlog.EventFlagsMask.Ignorable);
	}

	constructor(dynamicAMFlowImplParams: DynamicAMFlowImplParams) {
		super(dynamicAMFlowImplParams);
	}

	sendTick(tick: playlog.Tick): void {
		if (!this._sessionActive || !this._playId || !this._publishCh) {
			throw AMFlowError.createInvalidStatusError("session is not active.");
		}
		if (!this._permission.writeTick) {
			throw AMFlowError.createInvalidPermissionError("sending ticks is not permitted.");
		}

		// tick を export する mode だったら、gameEvent にして投げるのみ
		if (this._tickExporter) {
			this._tickExporter.send(this._playId, {
				type: "ExportTick",
				tick: tick
			});
			return;
		}

		let sendData: Uint8Array | null = null;
		let storeData: Uint8Array | null = null;
		let ignorableStoreData: Uint8Array | null = null;
		if (tick[pidx.Tick.Events] && tick[pidx.Tick.Events].length) {
			sendData = msgpack.encode(tick);
			// transientを除外したtickと、更にignorableに対応したtickを作成する
			const transientTick = this.removeTargetEvent(tick, pidx.EventFlagsType.transient);
			const ignorableTick = this.removeTargetEvent(transientTick, pidx.EventFlagsType.ignorable);
			storeData = this.encodeStoreTick(transientTick);
			ignorableStoreData = this.encodeStoreTick(ignorableTick);
		} else if (tick[pidx.Tick.Storage] && tick[pidx.Tick.Storage].length) {
			sendData = storeData = ignorableStoreData = msgpack.encode(tick);
		} else {
			sendData = storeData = ignorableStoreData = msgpack.encode(tick[pidx.Tick.Frame]);
		}

		this._publishAmqp(this._tickExchange, sendData, (err) => {
			if (err) throw AMFlowError.createRuntimeError("send tick failed.", err);
		});
		this._playlogStore.storeTick(tick[pidx.Tick.Frame], storeData);
		this._playlogStore.storeTick(tick[pidx.Tick.Frame], ignorableStoreData, true);
	}

	encodeStoreTick(tick: playlog.Tick): Uint8Array {
		// tickの中にeventが存在する場合のみ、全体をencodeする
		if (tick[pidx.Tick.Events].length) {
			return msgpack.encode(tick);
		}
		return msgpack.encode(tick[pidx.Tick.Frame]);
	}

	removeTargetEvent(tick: playlog.Tick, eventFlagsType: pidx.EventFlagsType): playlog.Tick {
		let filterCallback: EventFilterCallback;
		if (eventFlagsType === pidx.EventFlagsType.transient) {
			filterCallback = DynamicAMFlowImplExcludedEventFlag.isTransientEvent;
		} else if (eventFlagsType === pidx.EventFlagsType.ignorable) {
			filterCallback = DynamicAMFlowImplExcludedEventFlag.isIgnorableEvent;
		} else {
			// 該当しない場合はそのまま返す
			return tick;
		}
		// 指定したeventをフィルタリングしたtickを作成して返す
		const replacedEvents = tick[pidx.Tick.Events].filter(event => {
			return !filterCallback(event);
		});
		const replacedTick: playlog.Tick = [tick[pidx.Tick.Frame], replacedEvents];
		// StorageDataが含まれていればそれもコピーする
		replacedTick[pidx.Tick.Storage] =
			(tick[pidx.Tick.Storage] && tick[pidx.Tick.Storage].length) ?
			tick[pidx.Tick.Storage] : undefined;
		return replacedTick;
	}
}
