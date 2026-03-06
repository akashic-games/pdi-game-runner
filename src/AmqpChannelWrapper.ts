"use strict";

/**
 * bindigs.AmqpChannel の Promise wrapper
 */
export class AmqpChannelWrapper {
	channel: bindings.AmqpChannel;

	constructor(ch: bindings.AmqpChannel) {
		this.channel = ch;
	}

	open(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.channel.open((err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	declareExchange(exchange: string, exchangeType: string, param: {passive: boolean, durable: boolean, autodelete: boolean}): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.channel.declareExchange(exchange, exchangeType, param.passive, param.durable, param.autodelete, (err: Error) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	declareQueue(name: string, param: {passive: boolean, durable: boolean, autodelete: boolean, exclusive: boolean, maxPriority?: number}): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (param.maxPriority) {
				this.channel.declarePriorityQueue(name, param.passive, param.durable, param.autodelete, param.exclusive, param.maxPriority, (err: Error, queueName: string) => {
					if (err) {
						reject(err);
						return;
					}
					resolve(queueName);
				});
			} else {
				this.channel.declareQueue(name, param.passive, param.durable, param.autodelete, param.exclusive, (err: Error, queueName: string) => {
					if (err) {
						reject(err);
						return;
					}
					resolve(queueName);
				});
			}
		});
	}

	bindQueue(exchange: string, queue: string, routingKey: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.channel.bindQueue(exchange, queue, routingKey, (err: Error) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	setQos(prefetchCount: number): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.channel.setQos(prefetchCount, (err: Error) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	ackAll(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.channel.ackAll((err: Error) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}
}
