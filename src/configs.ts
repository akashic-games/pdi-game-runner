"use strict";

const defaultConfiguration: Configuration = {
	accessibleUriList: [""],
	amflow: {
		amqp: {
			tickExchangePrefix: "playlog_ticks.",
			eventExchangePrefix: "playlog_events.",
			eventQueuePrefix: "playlog_events_queue.",
			eventPrefetch: 25,
			eventAckInterval: 1000 / 60  // 1/60 秒
		},
		store: {
			type: "mongodb",
			mongodb: {
				tickCollection: "playlogs",
				startPointCollection: "startpoints"
			},
			hbase: {
				tickTable: "playlogs",
				startPointTable: "snapshots"
			}
		},
		storageServer: null
	},
	snapshotRequestIntervalSecs: 300,  // 5 分
	externalEvent: {
		eventExchange: "akashic_system_event"
	},
	realtimeGameLoop: {
		firstStartPointWait: {  // 10 回 * 1000msec = 10 秒
			sleepMsecs: 1000,
			maxRetries: 10
		}
	},
	replayGameLoop: {
		seekSkipTicksAtOnce: 1000
	}
};

export function getConfiguration(): Configuration {
	return defaultConfiguration;
}

export interface MongodbConfiguration {
	tickCollection: string;  // tick 保存コレクション名
	startPointCollection: string;  // startPoint 保存コレクション名
}

export interface HbaseConfiguration {
	tickTable: string;  // tick 保存テーブル名
	startPointTable: string;  // startPoint 保存テーブル名
}

export interface AMFlowAmqpConfiguration {
	tickExchangePrefix: string;
	eventExchangePrefix: string;
	eventQueuePrefix: string;
	eventPrefetch: number;  // event consume の prefetch 数
	eventAckInterval: number;  // event consume の ack 間隔
}

export interface AMFlowStoreConfiguration {
	type: string;  // "mongodb" or "hbase"
	mongodb?: MongodbConfiguration;
	hbase?: HbaseConfiguration;
}

export interface AMFlowConfiguration {
	amqp: AMFlowAmqpConfiguration;
	store: AMFlowStoreConfiguration;
	storageServer: string;
}

export interface ExternalEventConfiguration {
	eventExchange: string;
}

export interface RealtimeGameLoopConfiguration {
	firstStartPointWait: {  // passive 時に、frame0 の startPoint が取得できるまで待つ時間の設定
		sleepMsecs: number;  // 試行間隔 (msec 単位)
		maxRetries: number;  // 最大試行回数 (この回数内に取得できなかった場合にエラーとする)
	};
}

export interface ReplayGameLoopConfiguration {
	seekSkipTicksAtOnce: number;  // seek 中の 1 loop で skip する frame 数
}

export interface Configuration {
	accessibleUriList: string[];
	amflow: AMFlowConfiguration;
	snapshotRequestIntervalSecs: number;  // snapshot 要求間隔(秒)
	externalEvent: ExternalEventConfiguration;
	realtimeGameLoop: RealtimeGameLoopConfiguration;
	replayGameLoop: ReplayGameLoopConfiguration;
}
