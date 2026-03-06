"use strict";
import * as g from "@akashic/akashic-engine";
import {ImageAsset, NullImageAsset} from "./ImageAsset";
import {AudioAsset, NullAudioAsset} from "./AudioAsset";
import {TextAsset} from "./TextAsset";
import {ScriptAsset} from "./ScriptAsset";
import {Surface, NullSurface} from "./Surface";
import {AudioPlayer} from "./AudioPlayer";
import {GlyphFactory} from "./GlyphFactory";
import {VideoAsset} from "./VideoAsset";

export class ResourceFactory extends g.ResourceFactory {
	createImageAsset(id: string, assetPath: string, width: number, height: number): g.ImageAsset {
		if (runnerProcess.videoEnabled) {
			return new ImageAsset(id, assetPath, width, height);
		} else {
			return new NullImageAsset(id, assetPath, width, height);
		}
	}

	createAudioAsset(
		id: string,
		assetPath: string,
		duration: number,
		system: g.AudioSystem,
		loop: boolean,
		hint: g.AudioAssetHint): g.AudioAsset {
		if (runnerProcess.videoEnabled) {
			return new AudioAsset(id, assetPath, duration, system, loop, hint);
		} else {
			return new NullAudioAsset(id, assetPath, duration, system, loop, hint);
		}
	}

	createTextAsset(id: string, assetPath: string): g.TextAsset {
		return new TextAsset(id, assetPath);
	}

	createAudioPlayer(system: g.AudioSystem): g.AudioPlayer {
		return new AudioPlayer(system);
	}

	createScriptAsset(id: string, assetPath: string): g.ScriptAsset {
		return new ScriptAsset(id, assetPath);
	}

	createSurface(width: number, height: number): g.Surface {
		if (runnerProcess.videoEnabled) {
			if (width > 0 && height > 0) {
				return new Surface(width, height, runnerProcess.createSurface(width, height));
			} else {
				// width/height が正でない場合も許容する
				// native surface との関連づけは行わず、描画処理は行わない
				return new Surface(width, height, null);
			}
		} else {
			return new NullSurface(width, height);
		}
	}

	createGlyphFactory(
		fontFamily: g.FontFamily, fontSize: number, baseline?: number,
		fontColor?: string, strokeWidth?: number, strokeColor?: string,
		strokeOnly?: boolean, weight?: g.FontWeight): g.GlyphFactory {
		return new GlyphFactory(fontFamily, fontSize, baseline, fontColor, strokeWidth, strokeColor, strokeOnly, weight);
	}

	createVideoAsset(
		id: string, assetPath: string, width: number, height: number,
		system: g.VideoSystem, loop: boolean, userRealSize: boolean): g.VideoAsset {
		return new VideoAsset(id, assetPath, width, height, system, loop, userRealSize);
	}
}
