"use strict";
import * as g from "@akashic/akashic-engine";

export class ShaderProgram {
	_program: bindings.ShaderProgram;
	_shaderUniforms: {[name: string]: g.ShaderUniform};

	constructor(fs: string) {
		this._program = runnerProcess.createShader(fs);
	}

	setUniforms(uniforms: {[name: string]: g.ShaderUniform}): void {
		if (!uniforms) return;
		if (!this._shaderUniforms) {
			this._setShaderUniforms(uniforms);
		} else {
			this._updateShaderUniforms(uniforms);
		}
	}

	get() {
		return this._program;
	}

	private _setShaderUniforms(uniforms: {[name: string]: g.ShaderUniform}) {
		this._shaderUniforms = Object.assign({}, uniforms);
		for (let k in uniforms) {
			this._shaderUniforms[k] = Object.assign({}, uniforms[k]);
			if (this._shaderUniforms[k].value instanceof(Float32Array) || this._shaderUniforms[k].value instanceof(Int32Array)) {
				let uniform_value = uniforms[k].value as Float32Array | Int32Array;
				// NOTE: check arrayBuffer length is shorter than declared type
				uniform_value = this._arrayBufferLengthValidattion(uniforms[k].type, uniform_value);
				this._shaderUniforms[k].value = uniform_value.slice();
			}
		}
		this._program.setUniforms(uniforms);
	}

	private _updateShaderUniforms(uniforms: {[name: string]: g.ShaderUniform}) {
		for (let k in uniforms) {
			if (this._shaderUniforms[k].value instanceof(Float32Array) || this._shaderUniforms[k].value instanceof(Int32Array)) {
				const this_value = this._shaderUniforms[k].value as Float32Array | Int32Array;
				let uniform_value = uniforms[k].value as Float32Array | Int32Array;
				// NOTE: check arrayBuffer length is shorter than declared type
				uniform_value = this._arrayBufferLengthValidattion(uniforms[k].type, uniform_value);
				for (let i = 0; i < Math.min(this_value.length, 4); i++) {
					if (this_value[i] !== uniform_value[i]) {
						this._program.setUniforms({[k]: {"type": uniforms[k].type, "value": uniform_value}});
						this_value[i] = uniform_value[i];
					}
				}
			}
			else {
				if (this._shaderUniforms[k].value !== uniforms[k].value) {
					this._program.setUniforms({[k]: {"type": uniforms[k].type, "value": uniforms[k].value}});
					this._shaderUniforms[k].value = uniforms[k].value;
				}
			}
		}
	}

	private _arrayBufferLengthValidattion(uniformType: string, uniformValue: Float32Array | Int32Array) : Float32Array | Int32Array {
		if (uniformType.slice(0, 3) === "vec") {
			let count = Number(uniformType[3]);
			if (count >= 2 && count <= 4 && count > uniformValue.length) {
				let modifiedUniformValue = new Float32Array(count);
				modifiedUniformValue.set(uniformValue);
				return modifiedUniformValue;
			}
		}
		else if (uniformType.slice(0, 4) === "ivec") {
			let count = Number(uniformType[4]);
			if (count >= 2 && count <= 4 && count > uniformValue.length) {
				let modifiedUniformValue = new Int32Array(count);
				modifiedUniformValue.set(uniformValue);
				return modifiedUniformValue;
			}
		}
		else if (uniformType.slice(0, 3) === "mat") {
			let count = Number(uniformType[3]);
			count *= count;
			if (count >= 4 && count <= 16 && count > uniformValue.length) {
				let modifiedUniformValue = new Float32Array(count);
				modifiedUniformValue.set(uniformValue);
				return modifiedUniformValue;
			}
		}
		return uniformValue;
	}
}

