"use strict";
import * as g from "@akashic/akashic-engine";

export class ScriptAsset extends g.ScriptAsset {
	static PRE_SCRIPT: string = "(function(exports, require, module, __filename, __dirname) {";
	static POST_SCRIPT: string = "\n})(g.module.exports, g.module.require, g.module, g.filename, g.dirname);";

	constructor(id: string, assetPath: string) {
		super(id, assetPath);
	}

	_load(loader: g.AssetLoadHandler): void {
		try {
			runnerProcess.readText(this.path, (err: any, text: string) => {
				if (err) {
					loader._onAssetError(this, g.ExceptionFactory.createAssetLoadError("loading error"));
				} else {
					this.script = text;
					loader._onAssetLoad(this);
				}
			});
		} catch (e) {
			runnerProcess.setImmediate(() => loader._onAssetError(
				this, g.ExceptionFactory.createAssetLoadError("asset path is not valid")));
		}
	}

	execute(execEnv: g.ScriptAssetExecuteEnvironment): any {
		if (!this.script) {
			throw g.ExceptionFactory.createAssertionError("ScriptAsset#execute: not yet loaded.");
		}
		let func = new Function("g", ScriptAsset.PRE_SCRIPT + this.script + ScriptAsset.POST_SCRIPT);
		func(execEnv);
		return execEnv.exports;
	}
}
