interface ErrorConstructor {
  captureStackTrace(error: any, constructorOpt: Function): string;//V8向け
}

declare module "util" {
	export function inspect(object:any): string;
}

declare module "url" {
	export interface Url {
		href: string;
		protocol: string;
		auth: string;
		hostname: string;
		port: string;
		host: string;
		pathname: string;
		search: string;
		query: any; // string | Object
		slashes: boolean;
		hash?: string;
		path?: string;
	}
	export interface UrlOptions {
		protocol?: string;
		auth?: string;
		hostname?: string;
		port?: string;
		host?: string;
		pathname?: string;
		search?: string;
		query?: any;
		hash?: string;
		path?: string;
	}
	export function parse(urlStr: string, parseQueryString?: boolean): Url;
	export function format(url: UrlOptions): string;
}

// base64 decode 用 (browserify 頼み)
interface Buffer extends Uint8Array {}
declare var Buffer: {
	new (str: string, encoding?: string): Buffer;
}
