"use strict";
import * as g from "@akashic/akashic-engine";
import {Surface, NullSurface} from "./Surface";

export class NullImageSurface extends NullSurface {
	constructor(width: number, height: number) {
		super(width, height);
	}

	renderer(): g.Renderer {
		throw g.ExceptionFactory.createAssertionError("ImageSurface#asSurface: cannot be rendered.");
	}
}

export class ImageSurface extends Surface {
	constructor(width: number, height: number, image: bindings.Surface) {
		super(width, height, image);
	}

	renderer(): g.Renderer {
		throw g.ExceptionFactory.createAssertionError("ImageSurface#asSurface: cannot be rendered.");
	}
}
