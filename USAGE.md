## Botnama — Usage

このドキュメントは Botnama の運用・セットアップ手順を簡潔にまとめたものです。実装の詳細や API は各所のソースコードを参照してください（参照欄は本文末尾にリスト化しています）。

---

## 必須環境

- Deno 2.x（`deno --version` で確認）
- Node などは不要（`deno task` で運用可能）
- ffmpeg（`bin/ffmpeg(.exe)`）: 動画の再エンコード用。OSごとのバイナリを `bin/` に配置してください。
- `bin/yt-dlp(.exe)` は同梱されていますが、`deno task setup` または UI の System タブで更新可能です。
- .NET SDK（任意、MCV プラグインをビルドする場合に必要）

---

## セットアップ

1. 初期セットアップ（サブモジュール / mediabunny の取得）:

```pwsh
deno task setup
```

- これにより `external/MultiCommentViewer` がサブモジュール初期化され、`public/vendor/mediabunny/dist/` が配置されます（実装: `scripts/setup.ts`）。
- dotnet がインストールされている場合、MCV プラグインをビルドします（`scripts/setup.ts` の `ensureMcvPluginBuilt`）。

2. (推奨) コード整形 / lint:

```pwsh
deno task fmt
deno task lint
```

3. `config/settings.toml` は初回起動時に自動生成されます。必要に応じて `httpPort` / `cacheDir` / `ffmpegPath` / `ytDlpPath` 等を編集してください（実装: `src/settings.ts`）。

4. `.env` を利用して機密値やブラウザ Cookie の抽出情報を設定できます。環境変数は `config/settings.toml` より優先されます（実装: `src/settings.ts`）。

---

## 開発サーバ起動

```pwsh
deno task dev
```

- ブラウザで `http://localhost:2101/dock/` と `http://localhost:2101/overlay/` を開いて動作を確認してください（実装: `src/server.ts` の静的ルート）。

---

## ポータブル実行（バンドルした exe の動作）

- バンドルして配布した実行ファイル（`deno compile` で作成）を使う場合、`bin/`, `config/`, `db/`, `cache/` 等は実行時に決定される `PROJECT_ROOT` 下に作成されます。
- `PROJECT_ROOT` の決定方法（優先順）:
  1. 環境変数 `BOTNAMA_HOME` / `BOTNAMA_ROOT` が指定されている場合、それを `PROJECT_ROOT` とします
  2. 実行ファイルと同じディレクトリが書き込み可能であれば、そこで `PROJECT_ROOT`（ポータブル動作）にします
  3. 書き込みできない場合は OS の per-user データディレクトリにフォールバックします（Windows: `%LOCALAPPDATA%\botnama`, macOS: `~/Library/Application Support/botnama`, Linux: `$XDG_CONFIG_HOME/botnama` or `~/.config/botnama`）

- データベース（SQLite）は `PROJECT_ROOT/db/app.sqlite` に作成されます。

**メモ**: 実行時の `PROJECT_ROOT` とその下層パス（`bin` / `config` / `db` / `cache`）はサーバのログに出力されます。ポータブル動作させたい場合は実行ファイルを配置したディレクトリに書き込み権限があることを確認してください。


## 重要な URL / API

- Dock (管理画面): `GET /dock/` (静的) — `public/dock`（`src/server.ts`）
- Overlay (再生表示): `GET /overlay/` (静的) — `public/overlay`（`src/server.ts`）
- Overlay Info (SSE通知): `GET /api/overlay-info/stream`（`src/routes/api.ts`）
- Media ファイル配信: `GET /media/:file` — HTTP Range 対応（`src/server.ts`）
- System 情報: `GET /api/system/info`（`src/services/systemService.ts`）
- yt-dlp 更新: `POST /api/system/update/yt-dlp`（`src/services/systemService.ts`, `src/routes/api.ts`）
- MCV Hook: `POST /api/hooks/mcv/comments`（`src/routes/api.ts`）
- Rules 操作: `GET /api/rules`, `POST /api/rules`（`src/services/ruleService.ts`）

---

## dependencies の更新 (submodules / mediabunny)

新しい `deno task update-deps` タスクを使うと、サブモジュール（`external/*`）をリモートの tip に更新、スーパープロジェクトの submodule pointer を commit し、`deno task setup` を走らせて mediabunny の `dist/` を再配置、MCV プラグインを再ビルドできます。

例: 自動で最新にして superproject を commit する（対話で承認）:

```pwsh
deno task update-deps
```

オプション:
- `--remote`  : submodule のリモートを取得して最新に合わせる（デフォルトでも origin を使います）
- `--push`    : 更新後に `git push origin <current-branch>` を実行します（デフォルトは操作をローカルで止めます）
- `--skip-setup` : `deno task setup` と plugin ビルドをスキップします
- `--yes`     : 対話確認なしで commit を実行します

注意: 事前に submodule 内に未コミットの変更があるとスキップされます。安全のため CI でテストを行い、手動で確認してから `--push` を利用することを推奨します。

### npm の latest を使って mediabunny を更新する
`deno task update-deps --mediabunny-latest` を実行すると、`scripts/setup.ts` が npm registry の `mediabunny/latest` を参照して `public/vendor/mediabunny/dist/` を更新します（`BOTNAMA_USE_LATEST_MEDIABUNNY=1` と等価）。



---

## ルールとカスタムホワイトリスト

- Rules: `Rules` タブで動画の長さ、重複制御、冷却時間、NG ユーザー、ポール（投票）などを設定可能です（実装: `src/services/ruleService.ts` / `public/dock/dock.js`）。
- 補足: 出荷時のデフォルトでは「最大再生時間を有効にする」は OFF になっています（以前は ON がデフォルトでした）。
- Custom Sites（`customSites`）: 正規表現または生の URL を `pattern` として登録できます。`pattern` は `/.../flags` の形式でも、単純な文字列でも許容されます（実装: `ruleService.buildRegex`）。
 - デフォルトでホワイトリストに含まれるホスト: YouTube / Niconico / Bilibili（`src/services/urlParser.ts` の `isWhitelistedHost`）

Alias の動作（注意）:
- `alias` を使うと `sc/<id>` のような短縮形を認識できますが、復元時は `pattern` から抽出したホスト名を `https://${host}/${id}` の形で使います（`commentService.matchCustomSiteUrl` と `extractHostFromPattern` を参照）。
- そのため、`pattern` に `.../watch/` のような path が含まれる場合、alias 復元ではそのパスは含まれません。つまり `pattern: https://example.com/watch/(\w+)` に `alias: ex` を設定しても、`ex/abc` は `https://example.com/abc` に復元され、`/watch/abc` にはなりません。

実例:
- `pattern: https://soundcloud.com/` alias: `sc` → `sc/name/track-slot` は `https://soundcloud.com/name/track-slot`
- `pattern: https://example.com/watch/(\w+)` alias: `ex` → `ex/abc` は `https://example.com/abc`（`/watch/` 部分は自動補完されない）

API で `customSites` を更新する例 (curl):

```pwsh
curl -X POST 'http://localhost:2101/api/rules' \
  -H 'Content-Type: application/json' \
  -d '{"customSites":[{"pattern":"https://soundcloud.com/","alias":"sc"}]}'
```

yt-dlp を System API 経由で更新する例 (curl):

```pwsh
curl -X POST 'http://localhost:2101/api/system/update/yt-dlp'
```

---

## Cookie と認証

- YouTube / Niconico の OAuth / Cookie 連携は `src/routes/api.ts` にある `auth/*` エンドポイントで処理されます。YouTube は OAuth コールバック、Niconico は username/password でのログインや Cookie 取得をサポートします（実装: `youtubeService`, `niconicoService`）。
- `yt-dlp` の `--cookies-from-browser` のための設定（ブラウザとプロファイル名）を `config/settings.toml` または `.env` で指定できます（実装: `src/settings.ts`、`cookieExtractor.ts`）。

---

## ダウンロード・キャッシュの挙動

- ダウンロード/変換は `DownloadWorker` が管理します（実装: `src/services/downloadWorker.ts`）。
- `baseName` は `deriveBaseName` によって `hostSegment_uniqueSegment` の形式で生成され、`.media.json`（manifest）と `.mp4`（H.264/AAC）等のファイルを `cacheDir` へ保存します。
- 同一 URL を繰り返しリクエストした場合はキャッシュ判定が行われ、既存ファイルを再利用します（実装: `downloadWorker.#fileExists` 判定）。

---

## MultiCommentViewer (MCV) プラグイン

- `external/MultiCommentViewer` をサブモジュール化し、プラグインをビルドできます（`scripts/setup.ts`, `deno task plugin:mcv:build`）。
- plugin は `POST /api/hooks/mcv/comments` を呼び、`X-Botnama-MCV-Token` ヘッダで `mcvAccessToken` を検証できます（実装: `src/routes/api.ts`）。

---

## よくあるトラブルとチェックリスト

- Dock に何も表示されない: サーバ起動ログ, `GET /healthz` を確認（`src/server.ts`）。
- Overlay が接続できない: ブラウザ側で WebSocket をブロックしていないか確認（`/ws/overlay`）。
- ダウンロードが失敗する: `cacheDir` への書き込み権限, `bin/ffmpeg` の存在, ネットワーク接続をチェック（`downloadWorker.ts`）。
- yt-dlp のバイナリ更新: UI の System タブまたは `POST /api/system/update/yt-dlp` を呼び出して更新（`systemService.updateYtDlpBinary`）。

---

## リソース / 参考実装箇所

- `src/server.ts` — サーバ起動・静的ルート / WebSocket
- `src/routes/api.ts` — REST API 実装
- `src/settings.ts` — デフォルト設定値と TOML / env 読み込み
- `src/services/ruleService.ts` — Rules / Custom Sites 正規表現処理
- `src/services/commentService.ts` — comment ingest / alias 短縮復元
- `src/services/downloadWorker.ts` — ダウンロード / キャッシュ / FFmpeg 呼び出し
- `scripts/setup.ts` — サブモジュール / mediabunny / plugin の初期化

---

- 同じ動画 URL を複数回リクエストした場合でも、同一ファイルが再利用されるため容量を圧迫しません。
- `config/settings.toml` の `ffmpegPath` が未設定／存在しない場合は MKV など非対応形式を MP4
  に変換できず `FAILED` になります。必ず `bin/` に ffmpeg を配置してください。

## OBS での利用

- Dock: OBS → View → Docks → Custom Browser Docks から `http://localhost:2101/dock/`
  を登録（上部に「停止」「スキップ」「更新」「全削除」ボタンを配置しています）。「全削除」で再生リストを一括クリア可能です。
- Overlay: ブラウザソース URL を `http://localhost:2101/overlay/` に設定し、音声を OBS
  ミキサーへ出すよう構成します。

## Info Overlay（通知）

- ブラウザソース URL を `http://localhost:2101/overlay-info/` に設定すると、イベントごとに帯を複製して縦に積み上げる通知ビューが表示されます（帯同士の間隔は CSS 変数 `--stack-gap` で調整でき、デフォルトは 0px で密着）。
- 再生リクエストやスキップ結果、Intake/Auto の切り替え、ポール開始/結果、動画統計（投稿日・再生数・コメント数・再生時間）やキュー残数/残り時間など、Overlay 全体へ出したい情報を順次スタックします。表示時間は各イベントから渡され、複数同時でもそれぞれ独立して消えます。
- テキストが帯幅を超える場合は 2 セット以上を自動タイリングし、スクロールマルチループで 30 秒前後を滑らかに見せます。
- フォントサイズや高さ、色、タイリング間隔などは CSS 変数で上書きできます。例:
  ```css
  :root {
    --info-font-size: 36px;
    --status-font-size: 30px;
    --band-height: 64px;
    --marquee-tiling-gap: 256px;
  }
  ```
- 通信は SSE（`/api/overlay-info/stream`）で行われ、切断時も自動再接続して直近のイベントを取りこぼしません。

## MultiCommentViewer を経由した受信
https://github.com/DaisukeDaisuke/MultiCommentViewer
1. `external/MultiCommentViewer` サブモジュールを初期化します。
   ```bash
   git submodule update --init --recursive external/MultiCommentViewer
   ```
2. `.NET` SDK を導入した環境で `deno task plugin:mcv:build`
  を実行すると `release/plugins/botnama/` にビルド成果物（`MCV.Botnama.Plugin.dll` と依存 DLL）が生成されます。
3. MultiCommentViewer の `plugins/` ディレクトリ（無ければ作成）へ
  `release/plugins/botnama/` 配下に出力された `MCV.Botnama.Plugin.dll` と依存 DLL をコピーし、アプリを再起動すると **Botnama Bridge**
   プラグインが利用できるようになります。
4. Botnama 側で `config/settings.toml` の `mcvAccessToken`
   に任意の値を設定し、プラグイン設定画面の「共有トークン」に
   同じ値を入力すると、`X-Botnama-MCV-Token` ヘッダーでの照合が有効になります。

### プラグイン設定と挙動

- 既定エンドポイントは `http://localhost:2101/api/hooks/mcv/comments` です。
- NG ユーザー／初期コメントを送信対象に含めるか、コメント内 URL を
  自動的にリクエスト化するかをチェックボックスで切り替えできます。
- 設定は `%AppData%/Botnama/botnama-mcv.json`
  に保存され、送信失敗は同フォルダーの `botnama-mcv.log`
  に追記されます。
- プラグインは `OnMessageReceived` で受け取ったコメントを JSON 化し、
  非同期で API へ送信します（最大 3 回まで自動再試行）。
- API 側は `mcvAccessToken` が指定されていればトークンを検証し、
  メッセージ内に URL が含まれている場合はデバッグモードと同じルールで
  リクエストを自動登録します。

## 設定のカスタマイズ

- デフォルト値＆型は `src/settings.ts` に記載されています。実際の運用値は `config/settings.toml`
  を直接編集します。
- `httpPort` や `maxVideoDurationSec` を変更したらサーバを再起動してください。
- `cache/videos/` を別ディレクトリにしたい場合は `cacheDir` を書き換え、必要なら既存の `cache/`
  ディレクトリを移動します。
- `ffmpegPath`
  を環境に合わせて更新すると、再エンコード無しで正しい実行ファイルを呼び出せます（デフォルトは
  `bin/ffmpeg(.exe)`）。
- ニコニコなどでログイン必須の動画を扱う場合は `ytDlpCookiesFromBrowser` を `"chrome"` や `"firefox"`
  に設定すると、yt-dlp の `--cookies-from-browser` で該当ブラウザのログイン Cookie
  を自動で読み込みます。必要に応じて `ytDlpCookiesFromBrowserProfile`（例: `"Default"` や `"Profile 2"`）、
  `ytDlpCookiesFromBrowserKeyring`、`ytDlpCookiesFromBrowserContainer`
  も併せて指定してください。空文字のままにすると無効化されます。安定して Cookie が抽出できるため、特に理由がなければ Firefox プロファイルの利用を推奨します。
- 機密値は `.env`（リポジトリ直下、`.gitignore` 済み）に
  `BOTNAMA_YTDLP_COOKIES_BROWSER=chrome` や `BOTNAMA_YTDLP_COOKIES_PROFILE=Default`
  のように書くこともできます。必要に応じて `BOTNAMA_YTDLP_COOKIES_KEYRING`、
  `BOTNAMA_YTDLP_COOKIES_CONTAINER`
  も併せて指定してください。環境変数が定義されている場合は TOML より優先して読み込まれるため、
  リポジトリにコミットしたくないブラウザ名／プロファイルなどは `.env` にのみ記述してください。
- Dock / Overlay の UI 言語は `config/settings.toml` の `locale` か `.env` の
  `BOTNAMA_LOCALE` で `ja` / `en` / `auto` を指定できます。配信ごとに言語を切り替えたい場合は `.env` 側で上書きすると TOML を編集せずに切り替えられます。

## トラブルシューティング

| 症状                    | チェック項目                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Dock に一覧が出ない     | `deno task dev` のログと `http://localhost:2101/healthz` を確認。ポート競合がないかもチェック         |
| Overlay 接続ランプが赤  | Overlay ページが開いているか、WebSocket をブロックする拡張機能がないか確認                            |
| ダウンロードが `FAILED` | `cache/videos` の書き込み権限、ネットワーク到達性、該当 URL の長さ制限（`maxVideoDurationSec`）を確認 |
| 変換が `FAILED`         | `ffmpegPath` が正しく設定・配置されているか、コーデックが mp4/H.264/AAC に変換可能かを確認            |
| bin のバイナリが古い    | `bin/yt-dlp.exe --version` を最新に差し替え後、アプリ再起動    |

## ログ・データの掃除

- リクエスト履歴を削除したい場合: `sqlite3 db/app.sqlite "DELETE FROM requests;"`
- キャッシュ動画をリセット: `Remove-Item -Recurse -Force cache/videos/*`

