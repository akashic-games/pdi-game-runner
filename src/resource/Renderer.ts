"use strict";
import * as g from "@akashic/akashic-engine";
import {ShaderProgram} from "./ShaderProgram";

export class NullRenderer extends g.Renderer {
	constructor() {
		super();
	}
	clear(): void { /* do nothing */ }
	drawImage(surface: g.Surface, offsetX: number, offsetY: number, width: number, height: number,
	          destOffsetX: number, destOffsetY: number): void { /* do nothing */}
	drawSprites(surface: g.Surface, offsetX: number[], offsetY: number[], width: number[], height: number[],
	            canvasOffsetX: number[], canvasOffsetY: number[], count: number): void { /* do nothing */ }
	drawSystemText(text: string, x: number, y: number, maxWidth: number, fontSize: number,
	               textAlign: g.TextAlign, textBaseline: g.TextBaseline, textColor: string, fontFamily: g.FontFamily,
	               strokeWidth: number, strokeColor: string, strokeOnly: boolean): void { /* do nothing */}
	translate(x: number, y: number): void { /* do nothing */ }
	transform(matrix: number[]): void { /* do nothing */ }
	opacity(opacity: number): void { /* do nothing */ }
	save(): void { /* do nothing */ }
	restore(): void { /* do nothing */ }
	fillRect(x: number, y: number, width: number, height: number, cssColor: string): void { /* do nothing */ }
	setCompositeOperation(operation: g.CompositeOperation): void { /* do nothing */ }
	setTransform(matrix: number[]): void { /* do nothing */ }
	setOpacity(opacity: number): void { /* do nothing */ }
	_getImageData(sx: number, sy: number, sw: number, sh: number): g.ImageData { return null; }
	_putImageData(imageData: g.ImageData, dx: number, dy: number,
				  dirtyX?: number, dirtyY?: number,
				  dirtyWidth?: number, dirtyHeight?: number) : void { /* do nothing */ }
	isSupportedShaderProgram(): boolean { return false; }
	setShaderProgram(shaderProgram: g.ShaderProgram | null): void { /* do nothing */ }
}

export class Renderer extends g.Renderer {
	_renderer: bindings.Renderer;
	_surface: bindings.Surface;
	_shaderProgramStack: [g.ShaderProgram | null];
	_currentShaderProgram: g.ShaderProgram | null;

	constructor(surface: bindings.Surface, renderer: bindings.Renderer) {
		super();
		this._surface = surface;
		this._renderer = renderer;
		this._shaderProgramStack = [null];
		this._currentShaderProgram = null;
	}

	clear(): void {
		this._renderer.clear();
	}

	drawImage(surface: g.Surface, offsetX: number, offsetY: number, width: number, height: number,
	          destOffsetX: number, destOffsetY: number): void {
		// native surface との関連づけが無い場合は何も行わない
		if (!surface._drawable) return;
		this._renderer.drawImage(<bindings.Surface>surface._drawable, offsetX, offsetY, width, height, destOffsetX, destOffsetY);
	}

	drawSprites(surface: g.Surface, offsetX: number[], offsetY: number[], width: number[], height: number[],
	            canvasOffsetX: number[], canvasOffsetY: number[], count: number): void {
		// native surface との関連づけが無い場合は何も行わない
		if (!surface._drawable) return;
		for (var i = 0; i < count; ++i) {
			this.drawImage(surface, offsetX[i], offsetY[i], width[i], height[i], canvasOffsetX[i], canvasOffsetY[i]);
		}
	}

	drawSystemText(text: string, x: number, y: number, maxWidth: number, fontSize: number,
	               textAlign: g.TextAlign, textBaseline: g.TextBaseline, textColor: string, fontFamily: g.FontFamily,
	               strokeWidth: number, strokeColor: string, strokeOnly: boolean): void {
		this._renderer.drawSystemText(text, x, y, maxWidth, fontSize,
		                              this._convertTextAlign(textAlign), this._convertTextBaseline(textBaseline), textColor,
		                              this._convertFontFamily(fontFamily), strokeWidth, strokeColor, strokeOnly);
	}

	translate(x: number, y: number): void {
		this._renderer.translate(x, y);
	}

	transform(matrix: number[]): void {
		this._renderer.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
	}

	opacity(opacity: number): void {
		this._renderer.opacity(opacity);
	}

	save(): void {
		const top = this._shaderProgramStack[this._shaderProgramStack.length - 1];
		this._shaderProgramStack.push(top);
		this._renderer.save();
	}

	restore(): void {
		if (this._shaderProgramStack.length > 1)
			this._shaderProgramStack.pop();
		const top = this._shaderProgramStack[this._shaderProgramStack.length - 1];
		this.setShaderProgram(top);
		this._renderer.restore();
	}

	fillRect(x: number, y: number, width: number, height: number, cssColor: string): void {
		this._renderer.fillRect(x, y, width, height, cssColor);
	}

	setCompositeOperation(operation: g.CompositeOperation): void {
		this._renderer.setCompositeOperation(this._convertCompositeOperation(operation));
	}

	setTransform(matrix: number[]): void {
		this._renderer.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
	}

	setOpacity(opacity: number): void {
		this._renderer.setOpacity(opacity);
	}

	end(): void {
		this._renderer.flush();
	}

	_getImageData(sx: number, sy: number, sw: number, sh: number): g.ImageData {
		return this._surface.getData(sx, sy, sw, sh);
	}

	_putImageData(
		imageData: g.ImageData,
		dx: number, dy: number,
		dirtyX?: number, dirtyY?: number,
		dirtyWidth?: number, dirtyHeight?: number
	) : void {
		if (dirtyX != null && dirtyX != null
		    && dirtyWidth != null && dirtyHeight != null) {
			this._surface.setData(imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
		}
		else {
			this._surface.setData(imageData, dx, dy, 0, 0, imageData.width, imageData.height);
		}
	} 

	isSupportedShaderProgram(): boolean {
		return runnerProcess.videoEnabled && runnerProcess.glEnabled;
	}

	setShaderProgram(shaderProgram: g.ShaderProgram | null): void {
		// shader program policy
		if (shaderProgram != null) {
			if (!shaderProgram._program) {
				shaderProgram._program = new ShaderProgram(shaderProgram.fragmentShader);
			}
			shaderProgram._program.setUniforms(shaderProgram.uniforms);
		}

		// renderer policy
		if (this._currentShaderProgram != shaderProgram) {
			this._renderer.flush();
			if (shaderProgram != null) {
				this._renderer.setShaderProgram(shaderProgram._program.get());
			} else {
				this._renderer.setShaderProgram(null);
			}
			this._currentShaderProgram = shaderProgram;
		} else {
			if (shaderProgram != null)
				this._renderer.flush();
		}
	}

	private _convertTextAlign(align: g.TextAlign): bindings.TextAlign {
		var result: bindings.TextAlign;
		switch (align) {
			case g.TextAlign.Center:
				result = bindings.TextAlign.Center;
				break;
			case g.TextAlign.Left:
				result = bindings.TextAlign.Left;
				break;
			case g.TextAlign.Right:
				result = bindings.TextAlign.Right;
				break;
			default:
				result = bindings.TextAlign.Left;
				break;
		}
		return result;
	}

	private _convertTextBaseline(baseline: g.TextBaseline): bindings.TextBaseline {
		var result: bindings.TextBaseline;
		switch (baseline) {
			case g.TextBaseline.Top:
				result = bindings.TextBaseline.Top;
				break;
			case g.TextBaseline.Middle:
				result = bindings.TextBaseline.Middle;
				break;
			case g.TextBaseline.Alphabetic:
				result = bindings.TextBaseline.Alphabetic;
				break;
			case g.TextBaseline.Bottom:
				result = bindings.TextBaseline.Bottom;
				break;
			default:
				result = bindings.TextBaseline.Alphabetic;
				break;
		}
		return result;
	}

	private _convertFontFamily(family: g.FontFamily): bindings.FontFamily {
		var result: bindings.FontFamily;
		switch (family) {
			case g.FontFamily.SansSerif:
				result = bindings.FontFamily.SansSerif;
				break;
			case g.FontFamily.Serif:
				result = bindings.FontFamily.Serif;
				break;
			case g.FontFamily.Monospace:
				result = bindings.FontFamily.Monospace;
				break;
			default:
				result = bindings.FontFamily.Serif;
				break;
		}
		return result;
	}

	private _convertCompositeOperation(operation: g.CompositeOperation): bindings.CompositeOperation {
		var result: bindings.CompositeOperation;
		switch (operation) {
			case g.CompositeOperation.SourceAtop:
				result = bindings.CompositeOperation.SourceAtop;
				break;
			case g.CompositeOperation.SourceOver:
				result = bindings.CompositeOperation.SourceOver;
				break;
			case g.CompositeOperation.Lighter:
				result = bindings.CompositeOperation.Lighter;
				break;
			case g.CompositeOperation.Copy:
				result = bindings.CompositeOperation.Copy;
				break;
			case g.CompositeOperation.DestinationOut:
				result = bindings.CompositeOperation.DestinationOut;
				break;
			case g.CompositeOperation.DestinationOver:
				result = bindings.CompositeOperation.DestinationOver;
				break;
			case g.CompositeOperation.Xor:
				result = bindings.CompositeOperation.XOR;
				break;
			case g.CompositeOperation.ExperimentalDestinationAtop:
				result = bindings.CompositeOperation.DestinationAtop;
				break;
			case g.CompositeOperation.ExperimentalDestinationIn:
				result = bindings.CompositeOperation.DestinationIn;
				break;
			case g.CompositeOperation.ExperimentalSourceIn:
				result = bindings.CompositeOperation.SourceIn;
				break;
			case g.CompositeOperation.ExperimentalSourceOut:
				result = bindings.CompositeOperation.SourceOut;
				break;
			default:
				result = bindings.CompositeOperation.SourceOver;
				break;
		}
		return result;
	}
}
