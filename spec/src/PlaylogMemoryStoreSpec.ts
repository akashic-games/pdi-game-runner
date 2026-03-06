/// <reference path="../typings/tsd.d.ts" />

"use strict";

import {TickList} from "@akashic/playlog";
import {StartPoint} from "@akashic/amflow";
import {PlaylogMemoryStore} from "../../lib/playlog/PlaylogMemoryStore";

(<any>(global)).runnerProcess = {
	setImmediate: setImmediate
};

describe("PlaylogMemoryStore", () => {
	const initialTickList: TickList = [0, 500,
		[
			[500, [], []],
			[700, [], []],
			[200, [], []],
			[0, [], []],
			[100, [], []],
			[1000, [], []],
			[600, [], []],
			[400, [], []],
			[800, [], []],
			[900, [], []]
		]
	];
	const initialStartPoints: StartPoint[] = [
		{frame: 250, data: {dummy: 250}, timestamp: 30},
		{frame: 50, data: {dummy: 50}, timestamp: 10},
		{frame: 0, data: {dummy: 0}, timestamp: 0},
		{frame: 150, data: {dummy: 150}, timestamp: 20}
	];

	const expectedAllTickList: TickList = [0, 500,
		[
			[0, [], []],
			[100, [], []],
			[200, [], []],
			[400, [], []],
			[500, [], []]
		]
	];
	const expectedAllStartPoints: StartPoint[] = [
		{frame: 0, data: {dummy: 0}, timestamp: 0},
		{frame: 50, data: {dummy: 50}, timestamp: 10},
		{frame: 150, data: {dummy: 150}, timestamp: 20},
		{frame: 250, data: {dummy: 250}, timestamp: 30}
	];

	const store = new PlaylogMemoryStore(initialTickList, initialStartPoints);

	it("can get tickList", (done: Function) => {
		store.getTickList(0, 200, (err, tickList) => {
			expect(err).toBeFalsy();
			expect(tickList[0]).toEqual(0);
			expect(tickList[1]).toEqual(199);
			expect(tickList[2].length).toEqual(2);
			expect(tickList[2][0][0]).toEqual(0);
			expect(tickList[2][1][0]).toEqual(100);
			done();
		});
	});

	it("should return null when out of range", (done: Function) => {
		store.getTickList(501, 1000, (err, tickList) => {
			expect(err).toBeFalsy();
			expect(tickList).toBeNull();
			done();
		});
	});

	it("can get first startPoint", (done: Function) => {
		store.getStartPoint({}, (err, startPoint) => {
			expect(err).toBeFalsy();
			expect(startPoint.frame).toBe(0);
			done();
		});
	});

	it("can get startPoint", (done: Function) => {
		store.getStartPoint({frame: 200}, (err, startPoint) => {
			expect(err).toBeFalsy();
			expect(startPoint.frame).toBe(150);
			done();
		});
	});

	it("can get all playlog and startPoint", (done: Function) => {
		store.getAll().then(playData => {
			expect(playData.tickList).toEqual(expectedAllTickList);
			expect(playData.startPoints).toEqual(expectedAllStartPoints);
			done();
		});
	});

	it("can't store ticks", () => {
		expect(() => {
			store.storeTick(1000, new Uint8Array(10));
		}).toThrow();
	})

	it("can't store start points", () => {
		expect(() => {
			store.putStartPoint({frame: 1000, data: {}, timestamp: 500}, (err) => {
				expect(err).toEqual(jasmine.any(Error));
			});
		});
	})

});
