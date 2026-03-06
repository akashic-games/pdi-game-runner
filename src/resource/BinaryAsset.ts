"use strict";
import * as g from "@akashic/akashic-engine";
import * as pdiCommonImpl from "@akashic/pdi-common-impl";

export class BinaryAsset extends pdiCommonImpl.BinaryAsset {
    constructor(id: string, assetPath: string) {
        super(id, assetPath);
    }

    _load(loader: g.AssetLoadHandler): void {
        try {
			runnerProcess.loadBinary(this.path, (err: any, binary: ArrayBuffer) => {
				if (err) {
					loader._onAssetError(this, g.ExceptionFactory.createAssetLoadError("loading error"));
				} else {
					this.data = binary;
					loader._onAssetLoad(this);
				}
			});
		} catch (e) {
			runnerProcess.setImmediate(() => loader._onAssetError(
				this, g.ExceptionFactory.createAssetLoadError("asset path is not valid")));
		}
    }
}
