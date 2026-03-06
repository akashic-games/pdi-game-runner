"use strict";
import * as g from "@akashic/akashic-engine";
import * as pdi from "@akashic/pdi-types";
import * as pdiCommonImpl from "@akashic/pdi-common-impl";
import {Surface, NullSurface} from "./Surface";

export class GlyphFactory extends pdiCommonImpl.GlyphFactory {
	_font: string;

	constructor(
		fontFamily: string | string[], fontSize: number, baselineHeight?: number,
		fontColor?: string, strokeWidth?: number, strokeColor?: string, strokeOnly?: boolean, weight?: g.FontWeightString) {
		super(fontFamily, fontSize, baselineHeight, fontColor, strokeWidth, strokeColor, strokeOnly, weight);
		// Game Runner は MigMix のみ。monospace が優先指定された場合はそちらを適用:
		if ((typeof fontFamily === "string" && fontFamily === "monospace") || 
			(Array.isArray(fontFamily) && fontFamily[0] === "monospace")) {
			this._font = "MigMix 2M";
		} else {
			this._font = "MigMix 2P";
		}
	}

	create(code: number): pdi.Glyph {
		const nativeGlyph = runnerProcess.createGlyph(code, this._font, this.fontSize,
			this.fontColor, this.strokeWidth, this.strokeColor, this.strokeOnly,
			this.fontWeight === "bold");
		// 　文字の場合、surface は null
		const nativeSurface = nativeGlyph.surface;
		let surface: pdiCommonImpl.Surface = null;
		if (nativeSurface) {
			if (runnerProcess.videoEnabled) {
				surface = new Surface(nativeSurface.width, nativeSurface.height, nativeSurface);
			} else {
				surface = new NullSurface(nativeSurface.width, nativeSurface.height);
			}
		}
		return {
			code: code,
			x: 0, /* 文字描画領域への surface 内 X offset */
			y: 0, /* 文字描画領域への surface 内 Y offset */
			width: surface ? surface.width : 0,  /* 文字描画領域の幅 (= surface の幅) */
			height: surface ? surface.height : 0, /* 文字描画領域の高さ (= surface の高さ) */
			offsetX: nativeGlyph.offsetX, /* 描画時の X offset */
			offsetY: this.baselineHeight - nativeGlyph.baseline, /* 描画時の Y offset */
			advanceWidth: nativeGlyph.advance, /* レイアウト上の文字幅 */
			surface: surface, /* 文字の書かれた surface */
			isSurfaceValid: true,
			_atlas: null
		};
	}
}
