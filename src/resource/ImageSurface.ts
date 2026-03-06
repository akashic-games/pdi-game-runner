"use strict";
import * as g from "@akashic/akashic-engine";
import * as pdiCommonImpl from "@akashic/pdi-common-impl";
import {Surface, NullSurface} from "./Surface";

export class NullImageSurface extends NullSurface {
	constructor(width: number, height: number) {
		super(width, height);
	}

	renderer(): pdiCommonImpl.Renderer {
		throw g.ExceptionFactory.createAssertionError("ImageSurface#asSurface: cannot be rendered.");
	}
}

export class ImageSurface extends Surface {
	constructor(width: number, height: number, image: bindings.Surface) {
		super(width, height, image);
	}

	renderer(): pdiCommonImpl.Renderer {
		throw g.ExceptionFactory.createAssertionError("ImageSurface#asSurface: cannot be rendered.");
	}
}
