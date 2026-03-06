"use strict";
import * as g from "@akashic/akashic-engine";
import * as pdiCommonImpl from "@akashic/pdi-common-impl";

export class TextAsset extends pdiCommonImpl.TextAsset {
	constructor(id: string, assetPath: string) {
		super(id, assetPath);
	}

	_load(loader: g.AssetLoadHandler): void {
		try {
			runnerProcess.readText(this.path, (err: any, text: string) => {
				if (err) {
					loader._onAssetError(this, g.ExceptionFactory.createAssetLoadError("loading error"));
				} else {
					this.data = text;
					loader._onAssetLoad(this);
				}
			});
		} catch (e) {
			runnerProcess.setImmediate(() => loader._onAssetError(
				this, g.ExceptionFactory.createAssetLoadError("asset path is not valid")));
		}
	}
}
