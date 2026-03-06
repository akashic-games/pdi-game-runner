"use strict";
import * as g from "@akashic/akashic-engine";
import * as pdiCommonImpl from "@akashic/pdi-common-impl";

/**
 * _drawable に bindings.VideoSurface をとる pdiCommonImpl.Surface
 * bindings.VideoSurface の生成/破棄は VideoAsset で行う。
 */
export class VideoSurface extends pdiCommonImpl.Surface {
	_nativeSurface: bindings.VideoSurface;

	constructor(width: number, height: number, nativeSurface: bindings.VideoSurface) {
		super(width, height, nativeSurface);
		this._nativeSurface = nativeSurface;
	}

	isPlaying(): boolean {
		if (!this._nativeSurface) return false;
		return this._nativeSurface.running;
	}

	renderer(): pdiCommonImpl.Renderer {
		throw g.ExceptionFactory.createAssertionError("VideoSurface#asSurface: cannot be rendered.");
	}
}
