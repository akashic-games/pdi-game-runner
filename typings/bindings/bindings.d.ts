// GameRunner で提供されている native bindings のインターフェース定義
// 本来は GameRunner 側で管理されるべきものだが、便宜上ここで管理している。

declare module bindings {
	export interface Module {
		code: string;
		values: any;
	}

	export interface ImageData {
		width: number;
		height: number;
		data: Uint8ClampedArray;
	}

	export interface Surface {
		width: number;
		height: number;
		context(): Renderer;
		destroy(): void;
		frameEnd(): void;
		getData(sx: number, sy: number, sw: number, sh: number): ImageData
		setData(imageData: ImageData, dx: number, dy: number,
		        dirtyX: number, dirtyY: number,
		        dirtyWidth: number, dirtyHeight: number): void;
	}

	export interface VideoSurface {
		width: number;
		height: number;
		uri: string;
		running: boolean;
		destroy(): void;
		setGain(gain: number): void;
		start(callback?: (err: Error) => void): void;
		stop(): void;
	}

	type ShaderUniformType = "float" | "int" | "vec2" | "vec3" | "vec4" | "ivec2" | "ivec3" | "ivec4" | "mat2" | "mat3" | "mat4";

	interface ShaderUniform {
		type: ShaderUniformType;
		value: number | Int32Array | Float32Array;
	}

	export interface ShaderProgram {
		fragmentShader: string;
		setUniforms(uniforms: {[name: string]: ShaderUniform}): void;
	}

	export interface Image {
		path: string;
		destroy(): void;
	}

	export interface Glyph {
		advance: number;
		offsetX: number;
		baseline: number;
		surface: Surface;
	}

	export const enum CompositeOperation {
		SourceAtop = 0,
		SourceIn = 1,
		SourceOut = 2,
		SourceOver = 3,
		DestinationAtop = 4,
		DestinationIn = 5,
		DestinationOut = 6,
		DestinationOver = 7,
		Lighter = 8,
		Copy = 9,
		XOR = 10
	}

	export const enum TextAlign {
		Left = 0,
		Center = 1,
		Right = 2
	}

	export const enum TextBaseline {
		Top = 0,
		Middle = 1,
		Alphabetic = 2,
		Bottom = 3
	}

	export const enum FontFamily {
		SansSerif = 0,
		Serif = 1,
		Monospace = 2
	}

	export interface Renderer {
		clear(): void;
		drawImage(surface: Surface, offsetX: number, offsetY: number, width: number, height: number,
			destOffsetX: number, destOffsetY: number): void;
		drawSystemText(text: string, x: number, y: number, maxWidth: number, fontSize: number,
			textAlign: TextAlign, textBaseline: TextBaseline, textColor: string, fontFamily: FontFamily,
			strokeWidth: number, strokeColor: string, strokeOnly: boolean): void;
		translate(x: number, y: number): void;
		transform(m11: number, m12: number, m21: number, m22: number, dx: number, dy: number): void;
		opacity(opacity: number): void;
		save(): void;
		restore(): void;
		fillRect(x: number, y: number, width: number, height: number, cssColor: string): void;
		setCompositeOperation(operation: CompositeOperation): void;
		setTransform(m11: number, m12: number, m21: number, m22: number, dx: number, dy: number): void;
		setOpacity(opacity: number): void;
		setShaderProgram(shader: ShaderProgram): void;
		flush(): void;
		frameEnd(): void;
	}

	// 非推奨、AudioResource/AudioPlayer を使うこと
	export interface AudioSource {
		path: string;
		destroy(): void;
		start(loop: boolean): void;
		stop(): void;
		setGain(gain: number): void;
	}

	export interface AudioResource {
		path: string;
		destroy(): void;
	}

	export interface AudioPlayer {
		start(loop: boolean): void;
		stop(): void;
		setGain(gain: number): void;
		destroy(): void;
	}

	export interface AmqpChannel {
		open(callback: (err: Error) => void): void;
		close(): void;
		declareExchange(exchange: string, exchangeType: string, passive: boolean, durable: boolean, autodelete: boolean,
			callback: (err: Error) => void): void;
		declareQueue(name: string, passive: boolean, durable: boolean, autodelete: boolean, exclusive: boolean,
			callback: (err: Error, queueName: string) => void): void;
		declarePriorityQueue(name: string, passive: boolean, durable: boolean, autodelete: boolean, exclusive: boolean, maxPriority: number,
			callback: (err: Error, queueName: string) => void): void;
		bindQueue(exchange: string, queue: string, routingKey: string, callback: (err: Error) => void): void;
		publish(exchange: string, routingKey: string, data: ArrayBuffer | string, offset: number, size: number, callback: (err: Error) => void): void;
		consume(queue: string, noack: boolean, callback: (err: Error, data: ArrayBuffer) => void): void;
		setQos(prefetchCount: number, callback: (err: Error) => void): void;
		ackAll(callback: (err: Error) => void): void;
	}

	export interface HbaseColumn extends Array<any> {
		[index: number]: any;
		0: string;  // column 名
		1: string | ArrayBuffer;  // data
		2?: number  // data offset (ArrayBuffer の場合)
		3?: number  // data size (ArrayBuffer) の場合
	}

	export interface Looper {
		start(): void;
		stop(): void;
	}
	
	export interface AssignmentConstraints {
		trait: string[];
	}

	export interface RunnerProcess {
		modules: Module[];
		instanceId: string;
		gameCode: string;
		playId: string;
		parentPlayIds: string[];
		videoEnabled: boolean;
		amqpEnabled: boolean;
		mongodbEnabled: boolean;
		hbaseEnabled: boolean;
		glEnabled: boolean;
		assignmentConstraints: AssignmentConstraints;
		contentStorageRedisEnabled: boolean;
		contentStorageRedisServerType: string;
		contentStorageRedisAccessInterval: number;

		print(...args: any[]): void;
		load(path: string): any;
		setImmediate(fun: () => void): void;
		createLooper(fun: (deltaTime: number) => number): Looper;
		readText(path: string, callback: (err: Error, text: string) => void): void;
		setupResourcePathList(path: string[]): void;
		setupAccessibleUriList(path: string[]): void;
		setupVideoSurface(width: number, height: number, videoPublishUri: string, fps: number): Surface;
		startPublish(videoPublishUri?: string): void;
		stopPublish(): void;
		createSurface(width: number, height: number): Surface;
		createVideoSurface(width: number, height: number, uri: string, streamParameter?: string): VideoSurface;
		createShader(fs: string): ShaderProgram;
		createImage(path: string): Image;  // 非推奨、代わりに loadImage を使うこと
		loadImage(path: string, callback: (err: Error, image: Surface) => void): void;
		createGlyph(code: number, fontFamily: string, fontSize: number,
			fontColor: string, strokeWidth: number, strokeColor: string, strokeOnly: boolean, bold?: boolean): Glyph;
		createAudioSource(path: string): AudioSource;   // 非推奨、代わりに loadAudio/createAudioPlayer を使うこと
		loadAudio(path: string, callback: (err: Error, audio: AudioResource) => void): void;
		createAudioPlayer(resource: AudioResource): AudioPlayer;
		setMasterGain(gain: number): void;
		openAmqpConnection(eventListner: (event: string, msg: string) => void): void;
		closeAmqpConnection(): void;
		createAmqpChannel(): AmqpChannel;
		mongodbQuery(namespace: string, query: string, sort: string, fields: string, limit: number, skip: number,
			callback: (err: Error, result: string[]) => void): void;
		mongodbGetBinaryField(namespace: string, query: string, sort: string, field: string, limit: number, skip: number,
			callback: (err: Error, result: ArrayBuffer[]) => void): void;
		mongodbStore(namespace: string, data: string, binFieldName: string, binData: ArrayBuffer, binOffset: number, binSize: number,
			callbackb: (err: Error) => void): void;
		hbaseGet(table: string, row: string, column: string, callback: (err: Error, result: ArrayBuffer) => void): void;
		hbaseScan(table: string, startRow: string, stopRow: string, column: string, filterString: string, limit: number, reversed: boolean,
			callback: (err: Error, result: ArrayBuffer[]) => void): void;
		hbasePut(table: string, row: string, columns: HbaseColumn[], callback: (err: Error) => void): void;
		redisTransaction(serverType: string, key: string, callback: (err: Error) => void): void;
		redisWatch(serverType: string, key: string, watchKeys: string[], callback: (err: Error) => void): void;
		redisExec(serverType: string, key: string, callback: (err: Error) => void): void;
		redisDiscard(serverType: string, key: string, callback: (err: Error) => void): void;
		redisGet(serverType: string, key: string, isTransaction: boolean, callback: (err: Error, result: string) => void): void;
		redisSet(serverType: string, key: string, value: string, isTransaction: boolean, callback: (err: Error) => void): void;
		redisMget(serverType: string, keys: string[], isTransaction: boolean, callback: (err: Error, result: string[]) => void): void;
		redisMset(serverType: string, keys: string[], values: string[], isTransaction: boolean, callback: (err: Error) => void): void;
		redisZadd(serverType: string, key: string, members: string[], scores: number[], isTransaction: boolean, callback: (err: Error) => void): void;
		redisZrange(serverType: string, key: string, begin: number, end: number, isTransaction: boolean, callback: (err: Error, result: string[]) => void): void;
		redisZrank(serverType: string, key: string, member: string, isTransaction: boolean, callback: (err: Error, result: string) => void): void;
		httpRequest(method: string, uri: string, reqHeader: string[][], sendData: string, callback: (err: Error, result: string[]) => void): void;
		getStreamParameter(uri: string, callback: (err: any, streamParameter: string) => void): void;
		generateUuidV4(): string;
		lockActivePlay(playId: string): boolean;
		unlockActivePlay(): void;
		exit(code: number): void;
		enableImageEffect(name: string): void;
		disableImageEffect(): void;
	}
}

declare var runnerProcess: bindings.RunnerProcess;
