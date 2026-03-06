"use strict";
import * as g from "@akashic/akashic-engine";
import {Renderer, NullRenderer} from "./Renderer";

export class NullSurface extends g.Surface {
	constructor(width: number, height: number) {
		super(width, height);
	}

	isPlaying(): boolean {
		return false;
	}

	renderer(): g.Renderer {
		return new NullRenderer();
	}
}

export class Surface extends g.Surface {
	_surface: bindings.Surface;

	constructor(width: number, height: number, surface: bindings.Surface) {
		super(width, height, surface);
		this._surface = surface;
	}

	isPlaying(): boolean {
		return false;
	}

	renderer(): g.Renderer {
		if (this._surface) {
			return new Renderer(this._surface, this._surface.context());
		} else {
			// native surface への関連付けが無い場合は何もしない renderer を返す
			return new NullRenderer();
		}
	}

	destroy(): void {
		super.destroy();
		if (this._surface) {
			this._surface.destroy();
			this._surface = null;
		}
	}
}

