"use strict";
import * as g from "@akashic/akashic-engine";

/**
 * _drawable に bindings.VideoSurface をとる g.Surface
 * bindings.VideoSurface の生成/破棄は VideoAsset で行う。
 */
export class VideoSurface extends g.Surface {
	_nativeSurface: bindings.VideoSurface;

	constructor(width: number, height: number, nativeSurface: bindings.VideoSurface) {
		super(width, height, nativeSurface, true);
		this._nativeSurface = nativeSurface;
	}

	isPlaying(): boolean {
		if (!this._nativeSurface) return false;
		return this._nativeSurface.running;
	}

	renderer(): g.Renderer {
		throw g.ExceptionFactory.createAssertionError("VideoSurface#asSurface: cannot be rendered.");
	}
}
