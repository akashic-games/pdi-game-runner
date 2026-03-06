"use strict";
import {StaticAMFlowImpl} from "./StaticAMFlowImpl";
import * as g from "@akashic/akashic-engine";
import * as AMFlow from "@akashic/amflow";
import * as playlog from "@akashic/playlog";
import * as config from "../configs";
import {AmqpChannelWrapper} from "../AmqpChannelWrapper";
import {PlaylogStore} from "../playlog/PlaylogStore";
import * as pidx from "../playlog/PlaylogIndex";
import * as AMFlowError from "./AMFlowError";
import * as msgpack from "msgpack-lite";
import {ExternalEventSender} from "../ExternalEventSender";

export class DynamicAMFlowImpl extends StaticAMFlowImpl {
	private static readonly RETRY_INTERVAL: number = 1000;

	_config: config.AMFlowConfiguration;
	_tickExchange: string;
	_eventExchange: string;
	_eventQueue: string;
	_tickHandlers: ((tick: playlog.Tick) => void)[];
	_eventHandlers: ((event: playlog.Event) => void)[];
	_eventFilters: ((event: playlog.Event) => boolean)[];
	_playId: string;
	_publishCh: bindings.AmqpChannel;
	_tickConsumeCh: bindings.AmqpChannel;
	_eventConsumeCh: bindings.AmqpChannel;
	_ackLooper: bindings.Looper;
	_needAck: boolean;
	_zerothStartPoint: AMFlow.StartPoint;
	_tickExporter: ExternalEventSender;

	private static async _retry(callback: () => any | Promise<any>, retryMax: number = 2): Promise<any> {
		const waitForMillis = (delayms: number) => new Promise<any>(resolve => setTimeout(resolve, delayms));
		let retryError = null;
		for (let retryCount = 0; retryCount < retryMax; retryCount++) {
			try {
				return await callback();
			} catch (err) {
				retryError = err;
				const delayms = 2 ** retryCount * DynamicAMFlowImpl.RETRY_INTERVAL;
				await waitForMillis(delayms);
			}
		}
		throw AMFlowError.createRuntimeError(`failed ${retryMax + 1} times`, retryError);
	}

	constructor(
		config: config.AMFlowConfiguration,
		permission: AMFlow.Permission,
		playlogStore: PlaylogStore,
		eventFilters?: ((event: playlog.Event) => boolean)[],
		tickExporter?: ExternalEventSender) {
		super(config, permission, playlogStore);
		this._config = config;
		this._tickExchange = null;
		this._eventExchange = null;
		this._eventQueue = null;
		this._tickHandlers = [];
		this._eventHandlers = [];
		this._eventFilters = eventFilters || [];
		this._publishCh = null;
		this._tickConsumeCh = null;
		this._eventConsumeCh = null;
		this._ackLooper = null;
		this._needAck = false;
		this._zerothStartPoint = null;
		this._tickExporter = tickExporter;
	}

	async open(playId: string, callback?: (error?: Error) => void): Promise<void> {
		if (this._sessionActive) {
			runnerProcess.setImmediate(() => { throw AMFlowError.createInvalidStatusError("session is active now."); });
		}

		this._playId = playId;
		this._tickExchange = this._config.amqp.tickExchangePrefix + playId;
		this._eventExchange = this._config.amqp.eventExchangePrefix + playId;
		this._eventQueue = this._config.amqp.eventQueuePrefix + playId;
		this._sessionActive = true;
		const ch = runnerProcess.createAmqpChannel();
		const chWrapper = new AmqpChannelWrapper(ch);
		try {
			await chWrapper.open();
			if (!this._tickExporter) {
				try {
					await DynamicAMFlowImpl._retry(() => this._declareTickExchange(chWrapper));
				} catch (err) {
					throw AMFlowError.createRuntimeError("DynamicAMFlowImpl#_declareTickExchange", err);
				}
			}
			if (!this._tickExporter) {
				try {
					await DynamicAMFlowImpl._retry(() => this._declareEventExchange(chWrapper));
				} catch (err) {
					throw AMFlowError.createRuntimeError("DynamicAMFlowImpl#_declareEventExchange", err);
				}
			}
			if (this._tickHandlers.length) {
				try {
					await DynamicAMFlowImpl._retry(() => this._startConsumeTicks());
				} catch (err) {
					throw AMFlowError.createRuntimeError("DynamicAMFlowImpl#_startConsumeTicks", err);
				}
			}
			if (this._eventHandlers.length) {
				try {
					await DynamicAMFlowImpl._retry(() => this._startConsumeEvents());
				} catch (err) {
					throw AMFlowError.createRuntimeError("DynamicAMFlowImpl#_startConsumeEvents", err);
				}
			}
			this._publishCh = ch;
			if (callback) {
				runnerProcess.setImmediate(callback);
			}
		} catch (err) {
			ch.close();
			this._sessionActive = false;
			if (callback) {
				runnerProcess.setImmediate(() => { callback(AMFlowError.createRuntimeError(`open failed, at ${err.message}`, err)); });
			}
		}
	}

	close(callback?: (error?: Error) => void): void {
		if (this._publishCh) {
			this._publishCh.close();
			this._publishCh = null;
		}
		if (this._tickConsumeCh) {
			this._tickConsumeCh.close();
			this._tickConsumeCh = null;
		}
		if (this._eventConsumeCh) {
			this._eventConsumeCh.close();
			this._eventConsumeCh = null;
		}
		if (this._ackLooper) {
			this._ackLooper.stop();
			this._ackLooper = null;
		}
		this._playId = null;
		this._sessionActive = false;
		this._needAck = false;
		this._zerothStartPoint = null;
		if (callback) {
			runnerProcess.setImmediate(callback);
		}
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

		let sendData:Uint8Array | null = null;
		let storeData:Uint8Array | null = null;
		if (tick[pidx.Tick.Events] && tick[pidx.Tick.Events].length) {
			sendData = msgpack.encode(tick);
			storeData = this.encodeStoreTick(tick);
		}
		else if(tick[pidx.Tick.Storage] && tick[pidx.Tick.Storage].length) {
			sendData = storeData = msgpack.encode(tick);
		} else {
			sendData = storeData = msgpack.encode(tick[pidx.Tick.Frame]);
		}

		this._publishAmqp(this._tickExchange, sendData, (err) => {
			if (err) throw AMFlowError.createRuntimeError("send tick failed.", err);
		});
		this._playlogStore.storeTick(tick[pidx.Tick.Frame], storeData);
	}

	onTick(handler: (tick: playlog.Tick) => void): void {
		if (!this._permission.subscribeTick) {
			throw AMFlowError.createInvalidPermissionError("subscribing ticks is not permitted.");
		}
		const len = this._tickHandlers.length;
		this._tickHandlers.push(handler);
		if (this._sessionActive && !len) {
			this._startConsumeTicks()
				.catch(err => { runnerProcess.setImmediate(() => { throw AMFlowError.createRuntimeError("consume tick failed.", err); }); });
		}
	}

	offTick(handler: (tick: playlog.Tick) => void): void {
		this._tickHandlers = this._removeHandler(this._tickHandlers, handler);
		this._stopConsumeTicks();
	}

	sendEvent(event: playlog.Event): void {
		if (!this._sessionActive || !this._playId || !this._publishCh) {
			throw AMFlowError.createInvalidStatusError("session is not active.");
		}
		if (!this._permission.subscribeEvent) {
			throw AMFlowError.createInvalidPermissionError("sending events is not permitted.");
		}
		// game-runner 上で動くインスタンスがイベント優先度に制限を受けるケースは現状存在しないので、
		// _permission の maxEventPriory チェックは省略している
		this._publishAmqp(this._eventExchange, msgpack.encode(event), (err) => {
			if (err) throw AMFlowError.createRuntimeError("send event failed.", err);
		});
	}

	onEvent(handler: (event: playlog.Event) => void): void {
		if (!this._permission.subscribeEvent) {
			throw AMFlowError.createInvalidPermissionError("subscribing events is not permitted.");
		}
		const len = this._eventHandlers.length;
		this._eventHandlers.push(handler);
		if (this._sessionActive && !len) {
			this._startConsumeEvents()
				.catch(err => { runnerProcess.setImmediate(() => { throw AMFlowError.createRuntimeError("consume event failed.", err); }); });
		}
	}

	offEvent(handler: (event: playlog.Event) => void): void {
		this._eventHandlers = this._removeHandler(this._eventHandlers, handler);
		if (!this._eventHandlers.length) {
			this._stopConsumeEvents();
		}
	}

	putStartPoint(startPoint: AMFlow.StartPoint, callback: (error: Error) => void): void {
		let err: Error = null;
		if (!this._sessionActive || !this._playId) {
			err = AMFlowError.createInvalidStatusError("session is not active.");
		} else if (!this._permission.writeTick) {
			err = AMFlowError.createInvalidPermissionError("putting start point is not permitted.");
		}
		if (err) {
			runnerProcess.setImmediate(() => { callback(err); });
			return;
		}
		if (startPoint.frame === 0) {
			// 第 0 start point はキャッシュする (activeAE は直後に読むので)
			this._zerothStartPoint = startPoint;
		}
		// tick を export する mode だったら、gameEvent にして投げるだけ
		if (this._tickExporter) {
			this._tickExporter.send(this._playId, {
				type: "ExportStartPoint",
				startPoint: startPoint
			});
			runnerProcess.setImmediate(() => { callback(null); });
			return;
		}
		this._playlogStore.putStartPoint(startPoint, callback);
	}

	getStartPoint(opts: {frame?: number}, callback: (error: Error, startPoint: AMFlow.StartPoint) => void): void {
		if ((!opts || !opts.frame) && this._zerothStartPoint) {
			runnerProcess.setImmediate(() => { callback(null, this._zerothStartPoint); });
			return;
		}
		super.getStartPoint(opts, callback);
	}

	putStorageData(key: playlog.StorageKey, value: playlog.StorageValue, options: any, callback: (err: Error) => void): void {
		// インターフェース上に存在するだけで実際には使われないメソッドなので AMFlowError を返す
		runnerProcess.setImmediate(() => { callback(AMFlowError.createNotImplementedError("storage is not supported.")); });
	}

	getStorageData(keys: playlog.StorageReadKey[], callback: (error: Error, values: playlog.StorageData[]) => void): void {
		// インターフェース上に存在するだけで実際には使われないメソッドなので AMFlowError を返す
		runnerProcess.setImmediate(() => { callback(AMFlowError.createNotImplementedError("storage is not supported."), null); });
	}

	// 再接続時に呼ばれる
	onAmqpConnected(): Promise<void> {
		if (!this._sessionActive) return;
		this._publishCh = runnerProcess.createAmqpChannel();
		const chWrapper = new AmqpChannelWrapper(this._publishCh);
		return chWrapper.open()
			.then(() => {
				if (this._tickHandlers.length) {
					return this._startConsumeTicks();
				}
			})
			.then(() => {
				if (this._eventHandlers.length) {
					return this._startConsumeEvents();
				}
			});
	}

	// 切断時に呼ばれる
	// RabbitMq クラスタの別のノードに接続したら、onAmqpConnected が呼ばれる
	onAmqpDisconnected(): void {
		if (this._publishCh) {
			this._publishCh.close();
			this._publishCh = null;
		}
		this._stopConsumeTicks();
		this._stopConsumeEvents();
	}

	encodeStoreTick(tick: playlog.Tick): Uint8Array {
		const removedTick = this.removeTransientEvent(tick);
		// transient eventを除外した後でもeventが存在する場合のみ、全体をencodeする
		if(removedTick[pidx.Tick.Events].length) {
			return msgpack.encode(removedTick);
		}
		return msgpack.encode(tick[pidx.Tick.Frame]);
	}

	removeTransientEvent(tick: playlog.Tick): playlog.Tick {
		const replacedEvents = tick[pidx.Tick.Events].filter(event => {
			return !this.isTransientEvent(event);
		});
		let replacedTick: playlog.Tick = [tick[pidx.Tick.Frame], replacedEvents];
		(tick[pidx.Tick.Storage] && tick[pidx.Tick.Storage].length) 
			? replacedTick[pidx.Tick.Storage] = tick[pidx.Tick.Storage]
			: replacedTick[pidx.Tick.Storage] = undefined;
		return replacedTick;
	}

	isTransientEvent(event: playlog.Event): boolean {
		return !!(event[playlog.EventIndex.EventFlags] & playlog.EventFlagsMask.Transient);
	}

	private _removeHandler<T>(handlers: T[], handler: T): T[] {
		return handlers.filter(elem => {
			return elem !== handler;
		});
	}

	private _onTick(err: Error, msg: ArrayBuffer): void {
		if (err) throw err;
		if (!this._tickHandlers.length) return;
		const tickRaw = msgpack.decode(new Uint8Array(msg));
		const tick = (typeof tickRaw === "number") ? [tickRaw] : tickRaw;
		this._tickHandlers.forEach(handler => handler(tick));
	}

	private _startConsumeTicks(): Promise<void> {
		if (this._tickConsumeCh) {
			this._tickConsumeCh.close();
		}
		this._tickConsumeCh = runnerProcess.createAmqpChannel();
		const chWrapper = new AmqpChannelWrapper(this._tickConsumeCh);
		let queue: string;
		return chWrapper.open()
			// open のときに exchange の assertion は行っているから必要ないかもしれないが念の為
			.then(() => this._declareTickExchange(chWrapper))
			.then(() => chWrapper.declareQueue("", {passive: false, durable: false, autodelete: true, exclusive: true}))
			.then(queueName => {
				queue = queueName;
				return chWrapper.bindQueue(this._tickExchange, queueName, this._playId + ".*");
			})
			.then(() => this._tickConsumeCh.consume(queue, true, this._onTick.bind(this)));
	}

	private _stopConsumeTicks(): void {
		if (!this._tickConsumeCh) return;

		this._tickConsumeCh.close();
		this._tickConsumeCh = null;
	}

	private _onEvent(err: Error, msg: ArrayBuffer): void {
		if (err) throw err;
		this._needAck = true;
		if (!this._eventHandlers.length) return;
		const event = msgpack.decode(new Uint8Array(msg));
		if (this._eventFilters.length) {
			let filtered = false;
			this._eventFilters.forEach(filter => {
				const result = filter(event);
				filtered = filtered || result;
			});
			if (filtered) return;  // filtered
		}
		this._eventHandlers.forEach(handler => handler(event));
	}

	private _startConsumeEvents(): Promise<void> {
		this._stopConsumeEvents();

		this._eventConsumeCh = runnerProcess.createAmqpChannel();
		let chWrapper = new AmqpChannelWrapper(this._eventConsumeCh);
		return chWrapper.open()
			.then(() => {
				if (!this._tickExporter) {
					// open のときに exchange の assertion は行っているから必要ないかもしれないが念の為
					return this._declareEventExchange(chWrapper);
				}
			})
			.then(() => {
				if (!this._tickExporter) {
					return chWrapper.declareQueue(this._eventQueue, {passive: true, durable: false, autodelete: false, exclusive: false});
				} else {
					// 自前で queue を準備する (rabbitmq 側で上流とリンクされることを前提として)
					return chWrapper.declareQueue(this._eventQueue, {passive: false, durable: false, autodelete: false, exclusive: false, maxPriority: 3});
				}
			})
			// Queue は存在しているはずだから bindQueue はやらない
			.then(() => chWrapper.setQos(this._config.amqp.eventPrefetch))
			.then(() => {
				this._ackLooper = runnerProcess.createLooper(delta => {
					if (this._needAck) {
						chWrapper.ackAll().catch((err) => { runnerProcess.setImmediate(() => { throw err; }); });
						this._needAck = false;
					}
					return this._config.amqp.eventAckInterval;
				});
				this._ackLooper.start();
				this._eventConsumeCh.consume(this._eventQueue, false, this._onEvent.bind(this));
			});
	}

	private _stopConsumeEvents(): void {
		if (this._eventConsumeCh) {
			this._eventConsumeCh.close();
			this._eventConsumeCh = null;
		}
		if (this._ackLooper) {
			this._ackLooper.stop();
			this._ackLooper = null;
		}
		this._needAck = false;
	}

	private _convertStorageKey(gameId: string, key: g.StorageKey): g.StorageKey {
		var result: g.StorageKey = Object.assign({}, key);
		if (result.gameId != null && result.gameId.indexOf("$gameId") !== -1) {
			result.gameId = result.gameId.replace(/\$gameId/g, gameId);
		}
		return result;
	}

	private _publishAmqp(exchange: string, data: Uint8Array, callback: (err: Error) => void): void {
		this._publishCh.publish(exchange, "", data.buffer, data.byteOffset, data.byteLength, callback);
	}

	private _declareTickExchange(channel: AmqpChannelWrapper): Promise<void> {
		return channel.declareExchange(this._tickExchange, "fanout", {passive: true, durable: false, autodelete: false});
	}

	private _declareEventExchange(channel: AmqpChannelWrapper): Promise<void> {
		return channel.declareExchange(this._eventExchange, "fanout", {passive: true, durable: false, autodelete: false});
	}
}
