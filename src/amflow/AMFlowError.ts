"use strict";
import * as AMFlow from "@akashic/amflow";

export function createAMFlowError(name: string, msg: string, cause?: any): AMFlow.AMFlowError {
	let err = <AMFlow.AMFlowError>new Error(msg);
	err.name = name;
	if (cause) err.cause = cause;
	return err;
}

export function createInvalidStatusError(msg: string, cause?: any): AMFlow.AMFlowError {
	return createAMFlowError("InvalidStatus", msg, cause);
}

export function createInvalidPermissionError(msg: string, cause?: any): AMFlow.AMFlowError {
	return createAMFlowError("PermissionError", msg, cause);
}

export function createNotImplementedError(msg: string, cause?: any): AMFlow.AMFlowError {
	return createAMFlowError("NotImplemented", msg, cause);
}

export function createTimeoutError(msg: string, cause?: any): AMFlow.AMFlowError {
	return createAMFlowError("Timeout", msg, cause);
}

export function createBadRequestError(msg: string, cause?: any): AMFlow.AMFlowError {
	return createAMFlowError("BadRequest", msg, cause);
}

export function createRuntimeError(msg: string, cause?: any): AMFlow.AMFlowError {
	return createAMFlowError("RuntimeError", msg, cause);
}
