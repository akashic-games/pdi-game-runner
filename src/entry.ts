"use strict";

// global スコープ参照用
// global/window とはあえて違う名前で定義
var GLOBAL = this;

var console = {
	log: runnerProcess.print,
	warn: runnerProcess.print,
	info: runnerProcess.print,
	error: runnerProcess.print
};

function setTimeout(callback: (...args: any[]) => void, delay: number, ...args: any[]): bindings.Looper {
	let first = true;
	const looper = runnerProcess.createLooper((delta: number) => {
		if (!first || delay === 0) {
			callback.call(looper, args);
			looper.stop();
			return 0;
		} else {
			first = false;
			return delay;
		}
	});
	looper.start();
	return looper;
}

function clearTimeout(looper: bindings.Looper): void {
	looper.stop();
}

function setInterval(callback: (...args: any[]) => void, delay: number, ...args: any[]): bindings.Looper {
	const looper = runnerProcess.createLooper((delta: number) => {
		if (delta === 0) {
			return delay
		}

		callback.call(looper, args);
		return delay;
	});
	looper.start();
	return looper;
}

function clearInterval(looper: bindings.Looper): void {
	looper.stop();
}

runnerProcess.load("akashic-engine.js");
runnerProcess.load("game-driver.js");
runnerProcess.load("bootstrap.js");
