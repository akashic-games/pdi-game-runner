export class TestHelper {
	/**
	 * runnerProcess のように振る舞うオブジェクトをこれで作って node の世界に突っ込む。テストが始まる前に(beforeAll 等から)呼んでください。
	 * @virtual
	 */
	static installRunnerProces(): void {
		(<any>global).runnerProcess = {};
	}

	/**
	 * runnerProcess への参照を消す。他のテストに影響を与えないようにテストが終わったときに(afterAll 等から)呼んでください。
	 */
	static uninstallRunnerProcess(): void {
		delete (<any>global).runnerProcess;
	}
}
