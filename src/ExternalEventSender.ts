"use strict";

import { AmqpChannelWrapper } from "./AmqpChannelWrapper";

interface EventPayload {
	instanceId: string;
	playId?: string;
	type: string;
	data: any;
}

export class ExternalEventSender {
	static EVENT_CATEGORY: string = "info";
	static EVENT_HANDLER_TYPE: string = "gameEvent";

	_exchange: string;

	constructor(exchange: string) {
		this._exchange = exchange;
	}

	send(playId: string, data: any): void {
		if (!data) return;
		const type = ExternalEventSender.EVENT_HANDLER_TYPE;
		const payload: EventPayload = {
			instanceId: runnerProcess.instanceId,
			type: String(data.type),
			data: data
		};
		if (playId && playId.length > 0) {
			payload.playId = playId;
		}
		const event = {
			id: runnerProcess.generateUuidV4(),
			category: ExternalEventSender.EVENT_CATEGORY,
			type: type,
			payload: payload
		};

		const ch = runnerProcess.createAmqpChannel();
		const wrapper = new AmqpChannelWrapper(ch);
		wrapper.open()
			.then(() => wrapper.declareExchange(this._exchange, "topic", { passive: true, durable: true, autodelete: false }))
			.then(() => {
				ch.publish(this._exchange, type, JSON.stringify(event), 0, 0, err => {
					ch.close();
					if (err) {
						runnerProcess.setImmediate(() => { throw err; });
					}
				});
			});
	}
}
