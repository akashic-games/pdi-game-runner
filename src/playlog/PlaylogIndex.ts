"use strict";

export const enum Tick {
	Frame = 0,
	Events = 1,
	Storage = 2
}
export const enum TickList {
	Begin = 0,
	End = 1,
	Ticks = 2
}
export const enum Event {
	Code = 0,
	Priority = 1,
	Player = 2
}
export const enum EventFlagsType {
	priority = 0,
	transient = 1,
	ignorable = 2
}
