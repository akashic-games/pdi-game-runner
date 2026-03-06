"use strict";
import * as g from "@akashic/akashic-engine";
import * as pdiCommonImpl from "@akashic/pdi-common-impl";
import {ImageSurface, NullImageSurface} from "./ImageSurface";

export class NullImageAsset extends pdiCommonImpl.ImageAsset {
	constructor(id: string, assetPath: string, width: number, height: number) {
		super(id, assetPath, width, height);
	}

	_load(loader: g.AssetLoadHandler): void {
		runnerProcess.setImmediate(() => loader._onAssetLoad(this));
	}

	asSurface(): pdiCommonImpl.Surface {
		return new NullImageSurface(this.width, this.height);
	}
}

export class ImageAsset extends pdiCommonImpl.ImageAsset {
	_image: bindings.Surface;
	_surface: pdiCommonImpl.Surface;

	constructor(id: string, assetPath: string, width: number, height: number) {
		super(id, assetPath, width, height);
		this._image = null;
		this._surface = null;
	}

	_load(loader: g.AssetLoadHandler): void {
		try {
			runnerProcess.loadImage(this.path, (err, image) => {
				if (err) {
					loader._onAssetError(this, g.ExceptionFactory.createAssetLoadError("loading error"));
				} else {
					this._image = image;
					loader._onAssetLoad(this);
				}
			});
		} catch (e) {
			runnerProcess.setImmediate(() => loader._onAssetError(
				this, g.ExceptionFactory.createAssetLoadError("asset path is not valid")));
		}
	}

	asSurface(): pdiCommonImpl.Surface {
		if (this._surface) return this._surface;
		if (!this._image) {
			throw g.ExceptionFactory.createAssertionError("ImageAsset#asSurface: not yet loaded.");
		}
		this._surface = new ImageSurface(this.width, this.height, this._image);
		return this._surface;
	}
}
