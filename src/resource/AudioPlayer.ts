"use strict";
import * as g from "@akashic/akashic-engine";
import {AudioAsset} from "./AudioAsset";

export class AudioPlayer extends g.AudioPlayer {
	_player: bindings.AudioPlayer;

	constructor(system: g.AudioSystem) {
		super(system);
		this._player = null;
	}

	play(audio: g.AudioAsset): void {
		if (this.currentAudio) {
			this.stop();
		}
		// 本来はここで player の native 実装を作成するべきだが、
		// 現在は 1 つの実体を使い回している(多重再生出来ない)。
		// これは、現 game-runner で再生終了のタイミングがとれず、
		// native player の解放タイミングがとれないため、
		// 効果音をたくさん鳴らした際のリソースリークが解消できない
		// 問題の暫定回避のためである。
		// 再生終了タイミングがとれるようになったところで改める。
		this._player = (<AudioAsset>audio)._player;
		// ビデオ無効時は this._player は null になる
		if (this._player) {
			if (this._muted) {
				this._player.setGain(0.0);
			} else {
				this._player.setGain(this.volume);
			}
			this._player.start(audio.loop);
		}
		super.play(audio);
	}

	stop(): void {
		if (!this.currentAudio) {
			return;
		}
		if (this._player) {
			this._player.stop();
			this._player = null;
		}
		super.stop();
	}

	changeVolume(volume: number): void {
		super.changeVolume(volume);
		if (!this._muted && this._player) {
			this._player.setGain(this.volume);
		}
	}

	_changeMuted(muted: boolean): void {
		super._changeMuted(muted);
		if (!this._player) {
			return;
		}
		if (this._muted) {
			this._player.setGain(0.0);
		} else {
			this._player.setGain(this.volume);
		}
	}
}
