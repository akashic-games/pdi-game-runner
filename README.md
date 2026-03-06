<p align="center">
<img src="https://github.com/akashic-games/pdi-game-runner/blob/main/img/akashic.png"/>
</p>

# pdi-game-runner

pdi-game-runner は game-runner 上で [game-driver](https://github.com/akashic-games/game-driver) を実行するためのプラットフォーム依存層 (PDI) の実装です。
本リポジトリのソースコードをビルドすることで、akashic-engine と game-driver を統合したゲーム起動用スクリプトを生成することができます。

## ブランチとバージョン

Akashic Engine のバージョンに合わせてブランチを分けています。

V2, V1 系も保守継続しており、サーバ起因の障害が発生した時のバックポート先として使用します。

- V3系: [main](https://github.com/akashic-games/pdi-game-runner/tree/main)
- V2系: [v2](https://github.com/akashic-games/pdi-game-runner/tree/v2)
- V1系: [v1](https://github.com/akashic-games/pdi-game-runner/tree/v1)

## ビルド方法

```sh
npm install
npm run build
```

## 実行方法

build ディレクトリ以下を game-runner の script_dir で設定しているディレクトリにコピーして、game-runner から実行します。

## デプロイ

v2 ブランチへの push を契機に自動で `npm publish` が実行されます。publish が失敗しないよう、v2 に push する前に必ず `package.json` の version を更新してください。

publish 用ワークフローは次のファイルで管理しています: [.github/workflows/release.yml](.github/workflows/release.yml)

## CI

Pull Request の作成・更新を契機に CI が起動します。Approve を得る前に CI が通るかどうかを確認してください。

CI のワークフローは次のファイルで管理しています:
[.github/workflows/ci.yml](.github/workflows/ci.yml)

## pdi-game-runner のデバッグ方法

「デバッグ用のエンジン」「デバッグ用のエントリポイント」「デバッグ用のゲーム」を Akashic System の所定ディレクトリに配置してデバッグします。

> [!NOTE]
> 既存のゲームを壊さないように、既存のエンジンやエントリポイントは上書きせず新たに用意することをおすすめします。

### エンジンとエントリポイントとは

- エンジン: クライアント側で Akashic のゲームが動くためのファイル群。akashic-engine, game-driver といった共通の物に加えてブラウザ依存層のコードが含まれます
- エントリポイント: サーバ側 (game-runner) で Akashic のゲームが動くためのファイル群。共通の物に加えて pdi-game-runner を始めとした V8 依存層のコードが含まれます

### エントリポイントの作り方

基本的には `npm run build` で生成される build ディレクトリ下を配置しますが、ここで不足するファイルと不要なファイルが存在します。

#### 不足ファイル: `bundle_info.txt`
bundle_info.txt は以下の内容でテキストファイルを作成します。

```
engine-files: v2.1.46
pdi-game-runner: 2.14.0
```

- engine-files は akashic-runtime の dependencies から、`@akashic/engine-files` のバージョンを指定します
- pdi-game-runner のバージョンは自身が手元のコードで指定している package.json のバージョンを指定します

#### 不要ファイル: `*.map`
デバッグ成果物の js をデバッグするときの支援用ファイルです。なくても問題ないため、生成されていた場合は消します。

以上で調整した build 下を Akashic System の所定ディレクトリ下に配置します。


## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

ただし、画像ファイルは
[CC BY 2.1 JP](https://creativecommons.org/licenses/by/2.1/jp/) の元で公開されています。

サードパーティ製のライセンスについては [THIRD-PARTY-NOTICES](./THIRD-PARTY-NOTICES) をご覧ください。
