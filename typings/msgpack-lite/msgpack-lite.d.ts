declare module "msgpack-lite" {
	function encode(obj: any): Uint8Array;
	function decode(buf: Uint8Array): any;
}
