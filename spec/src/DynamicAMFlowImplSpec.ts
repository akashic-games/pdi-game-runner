/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../../typings/bindings/bindings.d.ts" />

"use strict";

import { DynamicAMFlowImpl } from "../../lib/amflow/DynamicAMFlowImpl";
import * as AMFlowError from "../../lib/amflow/AMFlowError";
import * as wrapper from "../../lib/AmqpChannelWrapper";
import { TestHelper as HelperBase } from "./TestHelper";

describe("DynamicAMFlowImpl#open()", () => {
	const fakeSetTimeout = (cb: (...args: any[]) => void, ms: number, ...args: any[]): void => { cb(); };
	const dummyChannelObj: bindings.AmqpChannel = {
		open(..._args: any[]): void { return; },
		close(): void { return; },
		declareExchange(..._args: any[]): void { return; },
		declareQueue(..._args: any[]): void { return; },
		declarePriorityQueue(..._args: any[]): void { return; },
		bindQueue(..._args: any[]): void { return; },
		publish(..._args: any[]): void { return; },
		consume(..._args: any[]): void { return; },
		setQos(..._args: any[]): void { return; },
		ackAll(..._args: any[]): void { return; }
	};

	class RunnerProcessHelper extends HelperBase {
		/** @override */
		static installRunnerProcess(): void {
			(<any>(global)).runnerProcess = {
				setImmediate: setImmediate,
				createAmqpChannel(): bindings.AmqpChannel { return dummyChannelObj; }
			};
		}
	}

	/** DynamicAMFlowImpl が内部で使っている AmqpChannelWrapper をモックするクラス */
	class AmqpChannelWrapperMockBase extends wrapper.AmqpChannelWrapper {
		constructor() { super(dummyChannelObj); }
		open(): Promise<void> { return Promise.resolve(); }
		declareExchange(..._args: any[]): Promise<void> { return Promise.resolve(); }
	}

	/** 正常 */
	class AmqpChannelWrapperMock1 extends AmqpChannelWrapperMockBase {}

	/** open が異常 */
	class AmqpChannelWrapperMock2 extends AmqpChannelWrapperMockBase {
		open(): Promise<void> { throw new Error(); }
	}

	let amflow: DynamicAMFlowImpl;
	const amflowConfig: any = {
		amqp: {
			tickExchangePrefix: "",
			eventExchangePrefix: "",
			eventQueuePrefix: "",
			eventPrefetch: 0,
			eventAckInterval: 0
		}
	};
	const amflowPermission: any = {};
	const amflowPlaylogStore: any = {};
	const playID = "1234";

	beforeAll(() => {
		spyOn(console, "log").and.callThrough();
		RunnerProcessHelper.installRunnerProcess();
	});

	afterAll(() => {
		RunnerProcessHelper.uninstallRunnerProcess();
	});

	afterEach(() => {
		amflow = null;
	});

	it("open できる", async () => {
		spyOn(wrapper, "AmqpChannelWrapper").and.callFake(AmqpChannelWrapperMock1);
		amflow = new DynamicAMFlowImpl(amflowConfig, amflowPermission, amflowPlaylogStore);

		expect(amflow._publishCh).toBeNull();
		expect(amflow._sessionActive).toBe(false);

		// setImmediate を spy
		const setImmediateF = jasmine.createSpy("setImmediate");
		runnerProcess.setImmediate = setImmediateF;
		const callback = (_?: Error): void => { return; };

		// open()
		await amflow.open(playID, callback);

		expect(amflow._sessionActive).toBe(true);

		// runnerProcess.setImmediate(callback); が実行された
		expect(setImmediateF.calls.mostRecent().args[0]).toEqual(callback);

		// 1度だけ実行された
		expect(setImmediateF.calls.count()).toBe(1);

		expect(amflow._publishCh).toEqual(dummyChannelObj);
	});

	it("catch 節の中の処理が正しく行われている", async () => {
		spyOn(wrapper, "AmqpChannelWrapper").and.callFake(AmqpChannelWrapperMock2);
		amflow = new DynamicAMFlowImpl(amflowConfig, amflowPermission, amflowPlaylogStore);

		const closeF = jasmine.createSpy("close");
		dummyChannelObj.close = closeF;

		await amflow.open(playID, (error) => {
			expect(error instanceof Error).toBe(true);
		});

		expect(closeF).toHaveBeenCalled();

		expect(amflow._sessionActive).toBe(false);
	});

	it("AmqpChannelWrapper#open のエラー時にコールバックに Error が渡る", async () => {
		spyOn(wrapper, "AmqpChannelWrapper").and.callFake(AmqpChannelWrapperMock2);
		amflow = new DynamicAMFlowImpl(amflowConfig, amflowPermission, amflowPlaylogStore);

		await amflow.open(playID, (error) => {
			expect(error.name).toBe("RuntimeError");
			expect(error.message).toMatch(/^open failed/);
		});
	});

	it("_declareTickExchange でのエラー時に適切なメッセージが渡る", async () => {
		// 正常な amqpwrapper を渡す
		spyOn(wrapper, "AmqpChannelWrapper").and.callFake(AmqpChannelWrapperMock1);
		amflow = new DynamicAMFlowImpl(amflowConfig, amflowPermission, amflowPlaylogStore);

		// Promise の中で setTimeout を呼ばれると jasmine.clock() が効かなかったため
		spyOn(global, "setTimeout").and.callFake(fakeSetTimeout);

		// エラーを起こす
		spyOn(amflow, "_declareTickExchange").and.throwError("fake");

		// FIXME: ES2022 では Error.cause ができたのでわざわざ AMFlowError 型を明示しなくても cause が使えるといい
		await amflow.open(playID, (error: ReturnType<typeof AMFlowError.createRuntimeError>) => {
			expect(error.name).toBe("RuntimeError");
			expect(error.message).toMatch(/^open failed, at DynamicAMFlowImpl#_declareTickExchange$/);
			expect(error.cause.cause.message).toMatch(/^failed 3 times$/);
		});
	});

	it("_declareEventExchange でのエラー時に適切なメッセージが渡る", async () => {
		spyOn(wrapper, "AmqpChannelWrapper").and.callFake(AmqpChannelWrapperMock1);
		amflow = new DynamicAMFlowImpl(amflowConfig, amflowPermission, amflowPlaylogStore);

		spyOn(global, "setTimeout").and.callFake(fakeSetTimeout);

		spyOn(amflow, "_declareEventExchange").and.throwError("fake");

		await amflow.open(playID, (error: ReturnType<typeof AMFlowError.createRuntimeError>) => {
			expect(error.name).toBe("RuntimeError");
			expect(error.message).toMatch(/^open failed, at DynamicAMFlowImpl#_declareEventExchange$/);
			expect(error.cause.cause.message).toMatch(/^failed 3 times$/);
		});
	});

	it("_startConsumeTicks でのエラー時に適切なメッセージが渡る", async () => {
		spyOn(wrapper, "AmqpChannelWrapper").and.callFake(AmqpChannelWrapperMock1);
		amflow = new DynamicAMFlowImpl(amflowConfig, amflowPermission, amflowPlaylogStore);
		// _startConsumeTicks のブロックに制御が移るためには _tickHandlers が空でないことが必要なので
		amflow._tickHandlers = [(): void => { return; }];
		expect(amflow._tickHandlers.length).toBeGreaterThan(0);

		spyOn(global, "setTimeout").and.callFake(fakeSetTimeout);

		spyOn(amflow, "_startConsumeTicks").and.throwError("fake");

		await amflow.open(playID, (error: ReturnType<typeof AMFlowError.createRuntimeError>) => {
			expect(error.name).toBe("RuntimeError");
			expect(error.message).toMatch(/^open failed, at DynamicAMFlowImpl#_startConsumeTicks$/);
			expect(error.cause.cause.message).toMatch(/^failed 3 times$/);
		});
	});

	it("DynamicAMFlowImpl#_startConsumeEvents でのエラー時に適切なメッセージが渡る", async () => {
		spyOn(wrapper, "AmqpChannelWrapper").and.callFake(AmqpChannelWrapperMock1);
		amflow = new DynamicAMFlowImpl(amflowConfig, amflowPermission, amflowPlaylogStore);
		// _startConsumeEvents のブロックに制御が移るためには _eventHandlers が空でないことが必要なので
		amflow._eventHandlers = [(): void => { return; }];
		expect(amflow._eventHandlers.length).toBeGreaterThan(0);

		spyOn(global, "setTimeout").and.callFake(fakeSetTimeout);

		spyOn(amflow, "_startConsumeEvents").and.throwError("fake");

		await amflow.open(playID, (error: ReturnType<typeof AMFlowError.createRuntimeError>) => {
			expect(error.name).toBe("RuntimeError");
			expect(error.message).toMatch(/^open failed, at DynamicAMFlowImpl#_startConsumeEvents$/);
			expect(error.cause.cause.message).toMatch(/^failed 3 times$/);
		});
	});
});