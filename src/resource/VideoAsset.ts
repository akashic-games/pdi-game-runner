"use strict";
import * as g from "@akashic/akashic-engine";
import {VideoPlayer} from "./VideoPlayer";
import {VideoSurface} from "./VideoSurface";

export class VideoAsset extends g.VideoAsset {
	_player: VideoPlayer;
	_surface: VideoSurface;
	_nativeSurface: bindings.VideoSurface;  // VideoPlayer から参照される
	_isLoaded: Boolean;

	constructor(id: string, assetPath: string, width: number, height: number, system: g.VideoSystem, loop: boolean, useRealSize: boolean) {
		super(id, assetPath, width, height, system, loop, useRealSize);
		this.realWidth = 0;
		this.realHeight = 0;
		this._player = null;
		this._surface = null;
		this._nativeSurface = null;
		this._isLoaded = false;
	}

	_load(loader: g.AssetLoadHandler): void {
		runnerProcess.getStreamParameter(this.path, (err: any, streamParameter: string) => {
			if (err) {
				loader._onAssetError(this, g.ExceptionFactory.createAssetLoadError("loading error"));
				return;
			}
			try {
				const res = JSON.parse(streamParameter);
				const streams = res.streams;
				let vstream = false;
				let astream = false;
				for (const stream of streams) {
					if (stream.codec_type === "video") {
						vstream = true;
						this.realWidth = Number(stream.width);
						this.realHeight = Number(stream.height);
						break;
					} else if (stream.codec_type === "audio") {
						astream = true;
					}
				}
				if (!vstream && !astream) {
					throw new Error("stream has no audio and video stream.");
				}
				if (runnerProcess.videoEnabled) {
					this._nativeSurface = runnerProcess.createVideoSurface(
						(this._useRealSize && this.realWidth > 0) ? this.realWidth : this.width,
						(this._useRealSize && this.realHeight > 0) ? this.realHeight : this.height,
						this.path, streamParameter
					);
				}
				this._isLoaded = true;
				loader._onAssetLoad(this);
			} catch (e) {
				loader._onAssetError(this, g.ExceptionFactory.createAssetLoadError("can't create VideoSurface. " + e.message));
			}
		});
	}

	destroy(): void {
		super.destroy();
		this._player = null;
		this.realWidth = 0;
		this.realHeight = 0;
		if (this._surface) {
			this._surface.destroy();
			this._surface = null;
		}
		if (this._nativeSurface) {
			this._nativeSurface.destroy();
			this._nativeSurface = null;
		}
		this._isLoaded = false;
	}

	asSurface(): g.Surface {
		if (!this._isLoaded) {
			throw g.ExceptionFactory.createAssertionError("VideoAsset#asSurface: not yet loaded.");
		}
		if (!this._surface) {
			this._surface = new VideoSurface(
				this._nativeSurface ? this._nativeSurface.width : this.width,
				this._nativeSurface ? this._nativeSurface.height : this.height,
				this._nativeSurface
			);
		}
		return this._surface;
	}

	getPlayer(): g.VideoPlayer {
		if (!this._isLoaded) {
			throw g.ExceptionFactory.createAssertionError("VideoAsset#getPlayer: not yet loaded.");
		}
		if (!this._player) {
			this._player = new VideoPlayer(this._loop);
		}
		return this._player;
	}
}
