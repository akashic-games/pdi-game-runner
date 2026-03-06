import {
	GameExternalStorageReadRequest,
	GameExternalStorageReadResponse,
	GameExternalStorageTransactionLockRequest,
	GameExternalStorageTransactionProcessLike,
	GameExternalStorageTransactionRequest,
	GameExternalStorageWriteRequest,
	GameExternalStorageWriteResponse,
	GameExternalStorageLocator,
	StorageTransactionError,
	StoragePlayScope
} from "@akashic/content-storage-types";
import PQueue from "p-queue-es5";

import { GameExternalStorageTransactionAccessBase } from "@akashic/akashic-storage-core";

export class GameExternalStorageTransactionAccessImpl extends GameExternalStorageTransactionAccessBase {
	private runnerProcessGameCode: string;

	constructor(txKey: string = "", isTransaction: boolean = false) {
		super(txKey, isTransaction);
	}

	protected static readonly QUEUE: PQueue = (() => {
		const pQueue = new PQueue({
			concurrency: 1,
			autoStart: false,
			intervalCap: 1,
			interval: runnerProcess.contentStorageRedisAccessInterval
		});
		pQueue.start();
		return pQueue;
	})();

	read(
		req: GameExternalStorageReadRequest,
		callback: (error: Error, response: GameExternalStorageReadResponse) => void
	): void {
		GameExternalStorageTransactionAccessImpl.QUEUE.add(async () => {
			await this.doRead(req, callback);
		});
	}

	write(
		req: GameExternalStorageWriteRequest,
		callback: (error: Error, response: GameExternalStorageWriteResponse) => void
	): void {
		GameExternalStorageTransactionAccessImpl.QUEUE.add(async () => {
			await this.doWrite(req, callback);
		});
	}

	beginTransaction(
		req: GameExternalStorageTransactionRequest,
		callback: (err: Error | null, tx: GameExternalStorageTransactionProcessLike) => void
	): void {
		GameExternalStorageTransactionAccessImpl.QUEUE.add(async () => {
			await this.doBeginTransaction(req, callback);
		});
	}

	lock(req: GameExternalStorageTransactionLockRequest, callback: (error: Error) => void): void {
		GameExternalStorageTransactionAccessImpl.QUEUE.add(async () => {
			await this.doLock(req, callback);
		});
	}

	commit(callback: (error: StorageTransactionError | null) => void): void {
		GameExternalStorageTransactionAccessImpl.QUEUE.add(async () => {
			await this.doCommit(callback);
		});
	}
	rollback(callback: (error: Error | null) => void): void {
		GameExternalStorageTransactionAccessImpl.QUEUE.add(async () => {
			await this.doRollback(callback);
		});
	}

	protected getGameCode(req: GameExternalStorageLocator | GameExternalStorageTransactionRequest): string {
		if (req.gameCode) {
			return req.gameCode;
		} else {
			if (!this.runnerProcessGameCode) {
				this.runnerProcessGameCode = runnerProcess.gameCode;
			}
			return this.runnerProcessGameCode;
		}
	}

	protected convertPlayScopeToKey(playScope: StoragePlayScope): string | null {
		if (playScope === "global") {
			return "global";
		} else {
			try {
				if (playScope === "rootPlay") {
					const parentPlayIds: string[] = runnerProcess.parentPlayIds;
					if (parentPlayIds && parentPlayIds.length > 0) {
						return parentPlayIds[0];
					} else {
						return runnerProcess.playId;
					}
				} else if (playScope === "play") {
					return runnerProcess.playId;
				} else {
					return null;
				}
			} catch (error) {
				return null;
			}
		}
	}

	protected async storageMget(keys: string[]): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			runnerProcess.redisMget(
				runnerProcess.contentStorageRedisServerType,
				keys,
				this.isTransaction,
				(err: Error, result: string[]) => {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				}
			);
		});
	}

	protected async storageMset(keys: string[], values: string[]): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			runnerProcess.redisMset(
				runnerProcess.contentStorageRedisServerType,
				keys,
				values,
				this.isTransaction,
				(err: Error) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				}
			);
		});
	}

	protected async storageZadd(key: string, members: string[], scores: number[]): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			runnerProcess.redisZadd(
				runnerProcess.contentStorageRedisServerType,
				key,
				members,
				scores,
				this.isTransaction,
				(err: Error) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				}
			);
		});
	}

	protected async storageZrange(key: string, start: number, end: number): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			runnerProcess.redisZrange(
				runnerProcess.contentStorageRedisServerType,
				key,
				start,
				end,
				this.isTransaction,
				(err: Error, result: string[]) => {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				}
			);
		});
	}

	protected async storageZrank(key: string, member: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			runnerProcess.redisZrank(
				runnerProcess.contentStorageRedisServerType,
				key,
				member,
				this.isTransaction,
				(err: Error, result: string) => {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				}
			);
		});
	}

	protected async storageWatch(watchKeys: string[]): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			runnerProcess.redisWatch(
				runnerProcess.contentStorageRedisServerType,
				this.txKey,
				watchKeys,
				(err: Error) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				}
			);
		});
	}

	protected async storageExec(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			runnerProcess.redisExec(runnerProcess.contentStorageRedisServerType, this.txKey, (err: Error) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}

	protected async storageDiscard(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			runnerProcess.redisDiscard(runnerProcess.contentStorageRedisServerType, this.txKey, (err: Error) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}

	protected async storageTransaction(key: string): Promise<GameExternalStorageTransactionProcessLike> {
		return new Promise<GameExternalStorageTransactionProcessLike>((resolve, reject) => {
			runnerProcess.redisTransaction(runnerProcess.contentStorageRedisServerType, key, (err: Error) => {
				if (err) {
					reject(err);
				} else {
					resolve(new GameExternalStorageTransactionAccessImpl(key, true));
				}
			});
		});
	}
}
