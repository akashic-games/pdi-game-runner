"use strict";
import * as g from "@akashic/akashic-engine";

export class NullAudioAsset extends g.AudioAsset {
	_player: bindings.AudioPlayer;
	
	constructor(id: string, assetPath: string, duration: number, system: g.AudioSystem, loop: boolean, hint: g.AudioAssetHint) {
		super(id, assetPath, duration, system, loop, hint);
		this._player = null;
	}

	_load(loader: g.AssetLoadHandler): void {
		runnerProcess.setImmediate(() => loader._onAssetLoad(this));
	}
}

export class AudioAsset extends NullAudioAsset {
	constructor(id: string, assetPath: string, duration: number, system: g.AudioSystem, loop: boolean, hint: g.AudioAssetHint) {
		super(id, assetPath, duration, system, loop, hint);
	}

	_load(loader: g.AssetLoadHandler): void {
		// .ogg, .wav の順に試す
		this._tryLoad("ogg")
			.then(result => this._onLoaded(loader, result))
			.catch(err => {
				return this._tryLoad("wav")
					.then(result => this._onLoaded(loader, result));
			})
			.catch(err => {
				runnerProcess.setImmediate(() => loader._onAssetError(this, g.ExceptionFactory.createAssetLoadError("loading error")));
			});
	}

	destroy(): void {
		if (this.data) {
			(<bindings.AudioResource>this.data).destroy();
		}
		super.destroy();
	}

	private _tryLoad(ext: string): Promise<bindings.AudioResource> {
		return new Promise<bindings.AudioResource>((resolve, reject) => {
			try {
				runnerProcess.loadAudio(this.path + "." + ext, (err, result) => {
					if (err) return reject(err);
					resolve(result);
				});
			} catch (e) {
				reject(e);
			}
		});
	}

	private _onLoaded(loader: g.AssetLoadHandler, resource: bindings.AudioResource): void {
		this.data = resource;
		// TODO: 複数プレイヤーを扱えるようにする
		this._player = runnerProcess.createAudioPlayer(resource);
		loader._onAssetLoad(this);
	}
}
