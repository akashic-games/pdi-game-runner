"use strict";
import * as g from "@akashic/akashic-engine";
import {VideoAsset} from "./VideoAsset";

export class VideoPlayer extends g.VideoPlayer {
	private _is_stop_called: boolean;

	constructor(loop?: boolean) {
		super(loop);
		this._is_stop_called = false;
	}

	play(videoAsset: g.VideoAsset): void {
		if (this.currentVideo !== videoAsset) {
			this.stop();
		}
		const nativeSurface = (<VideoAsset>videoAsset)._nativeSurface;
		if (nativeSurface) {
			this._is_stop_called = false;
			nativeSurface.setGain(this.volume);
			nativeSurface.start((err: Error) => {
				if (this._loop && !this._is_stop_called) {
					nativeSurface.stop();
					this.play(videoAsset);
				} else {
					this.stopped.fire({player: this, video: videoAsset});
				}
				// TODO : 例外を投げるとゲームが止まってしまうので、対処方法を後で検討する
			});
		}
		super.play(videoAsset);
	}

	stop(): void {
		if (!this.currentVideo) return;
		this._is_stop_called = true;
		const nativeSurface = (<VideoAsset>this.currentVideo)._nativeSurface;
		if (nativeSurface) nativeSurface.stop();
		super.stop();
	}

	changeVolume(volume: number): void {
		super.changeVolume(volume);
		if (!this.currentVideo) return;
		const nativeSurface = (<VideoAsset>this.currentVideo)._nativeSurface;
		if (nativeSurface) nativeSurface.setGain(this.volume);
	}
}
