"use strict";
import * as g from "@akashic/akashic-engine";
import {Surface, NullSurface} from "./Surface";

export class GlyphFactory extends g.GlyphFactory {
	_font: string;

	constructor(
		fontFamily: g.FontFamily, fontSize: number, baselineHeight?: number,
		fontColor?: string, strokeWidth?: number, strokeColor?: string, strokeOnly?: boolean, weight?: g.FontWeight) {
		super(fontFamily, fontSize, baselineHeight, fontColor, strokeWidth, strokeColor, strokeOnly, weight);
		switch (fontFamily) {
		case g.FontFamily.Monospace:
			this._font = "MigMix 2M";
			break;
		default:
			this._font = "MigMix 2P";
			break;
		}
	}

	create(code: number): g.Glyph {
		const nativeGlyph = runnerProcess.createGlyph(code, this._font, this.fontSize,
			this.fontColor, this.strokeWidth, this.strokeColor, this.strokeOnly,
			this.fontWeight === g.FontWeight.Bold);
		// 　文字の場合、surface は null
		const nativeSurface = nativeGlyph.surface;
		let surface: g.Surface = null;
		if (nativeSurface) {
			if (runnerProcess.videoEnabled) {
				surface = new Surface(nativeSurface.width, nativeSurface.height, nativeSurface);
			} else {
				surface = new NullSurface(nativeSurface.width, nativeSurface.height);
			}
		}
		const result = new g.Glyph(
			code,
			0, /* 文字描画領域への surface 内 X offset */
			0, /* 文字描画領域への surface 内 Y offset */
			surface ? surface.width : 0,  /* 文字描画領域の幅 (= surface の幅) */
			surface ? surface.height : 0, /* 文字描画領域の高さ (= surface の高さ) */
			nativeGlyph.offsetX, /* 描画時の X offset */
			this.baselineHeight - nativeGlyph.baseline, /* 描画時の Y offset */
			nativeGlyph.advance, /* レイアウト上の文字幅 */
			surface, /* 文字の書かれた surface */
			true
		);
		return result;
	}
}
