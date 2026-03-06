"use strict";
import * as g from "@akashic/akashic-engine";
import * as pdiCommonImpl from "@akashic/pdi-common-impl";

export class NullAudioAsset extends pdiCommonImpl.AudioAsset {
	_player: bindings.AudioPlayer;
	
	constructor(id: string, assetPath: string, duration: number, system: g.AudioSystem, loop: boolean, hint: g.AudioAssetHint, offset: number | undefined) {
		super(id, assetPath, duration, system, loop, hint, offset);
		this._player = null;
	}

	_load(loader: g.AssetLoadHandler): void {
		runnerProcess.setImmediate(() => loader._onAssetLoad(this));
	}
}

export class AudioAsset extends NullAudioAsset {
	constructor(id: string, assetPath: string, duration: number, system: g.AudioSystem, loop: boolean, hint: g.AudioAssetHint, offset: number | undefined) {
		super(id, assetPath, duration, system, loop, hint, offset);
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
				// クエリストリングの有無を考慮して拡張子を追加
				// AudioAssetのURLであるため、フラグメント識別子（#）は非対応
				const indexOfQuery: number = this.path.indexOf("?");
				const audioAssetUrl: string = indexOfQuery < 0
					? this.path + "." + ext
					: this.path.slice(0, indexOfQuery) + "." + ext + this.path.slice(indexOfQuery);
				runnerProcess.loadAudio(audioAssetUrl, (err, result) => {
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
