"use strict";
import * as g from "@akashic/akashic-engine";
import * as pdiCommonImpl from "@akashic/pdi-common-impl";
import {ImageAsset, NullImageAsset} from "./ImageAsset";
import {AudioAsset, NullAudioAsset} from "./AudioAsset";
import {TextAsset} from "./TextAsset";
import {ScriptAsset} from "./ScriptAsset";
import {Surface, NullSurface} from "./Surface";
import {AudioPlayer} from "./AudioPlayer";
import {GlyphFactory} from "./GlyphFactory";
import {VideoAsset} from "./VideoAsset";
import {BinaryAsset} from "./BinaryAsset";

export class ResourceFactory extends pdiCommonImpl.ResourceFactory {
	createImageAsset(id: string, assetPath: string, width: number, height: number): pdiCommonImpl.ImageAsset {
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
		hint: g.AudioAssetHint,
		offset: number | undefined): pdiCommonImpl.AudioAsset {
		if (runnerProcess.videoEnabled) {
			return new AudioAsset(id, assetPath, duration, system, loop, hint, offset);
		} else {
			return new NullAudioAsset(id, assetPath, duration, system, loop, hint, offset);
		}
	}

	createTextAsset(id: string, assetPath: string): pdiCommonImpl.TextAsset {
		return new TextAsset(id, assetPath);
	}

	createAudioPlayer(system: g.AudioSystem): pdiCommonImpl.AudioPlayer {
		return new AudioPlayer(system);
	}

	createScriptAsset(id: string, assetPath: string): pdiCommonImpl.ScriptAsset {
		return new ScriptAsset(id, assetPath);
	}

	createSurface(width: number, height: number): pdiCommonImpl.Surface {
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
		fontFamily: string | string[], fontSize: number, baseline?: number,
		fontColor?: string, strokeWidth?: number, strokeColor?: string,
		strokeOnly?: boolean, weight?: g.FontWeightString): pdiCommonImpl.GlyphFactory {
		return new GlyphFactory(fontFamily, fontSize, baseline, fontColor, strokeWidth, strokeColor, strokeOnly, weight);
	}

	createVideoAsset(
		id: string, assetPath: string, width: number, height: number,
		system: g.VideoSystem, loop: boolean, userRealSize: boolean): pdiCommonImpl.VideoAsset {
		return new VideoAsset(id, assetPath, width, height, system, loop, userRealSize);
	}

	createBinaryAsset(id: string, assetPath: string): pdiCommonImpl.BinaryAsset {
		return new BinaryAsset(id, assetPath);
	}
}
