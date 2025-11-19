# USAGE

## 必須環境

- Deno 2.x（`deno --version` で確認）
- Windows 10/11 または同等の POSIX 環境
- OBS (任意) : Overlay/Dock ページをブラウザソースに設定する場合
- ネットワーク接続（YouTube など外部サイトへアクセスできること）
- `ffmpeg`（H.264/AAC への変換用）
  - Windows: https://www.gyan.dev/ffmpeg/builds/ から `ffmpeg-git-essentials`
    を取得し、`bin/ffmpeg.exe` として配置
  - macOS / Linux: 静的ビルドを `bin/ffmpeg` として配置

`bin/` 配下に `yt-dlp.exe` と `yt-dlp-ejs/` を同梱済みなので、別途インストールは不要です（ffmpeg
は各自で配置してください）。

## 初期セットアップ

1. リポジトリ直下でセットアップスクリプトを実行:
  ```bash
  deno task setup
  ```
  - `git submodule update --init --recursive` を呼び出し、`external/*` を最新化します。
  - npm レジストリから `mediabunny-<version>.tgz` を取得し、`public/vendor/mediabunny/dist/`
    に展開します（Overlay からの `mediabunny.min.mjs` 404 を防止）。
  - `public/vendor/mediabunny/LICENSE` も自動的に最新化します。
   - .NET SDK (`dotnet`) が見つかれば `plugins/mcv-botnama/MCV.Botnama.Plugin.csproj`
     を Release ビルドし、MultiCommentViewer プラグインの `bin/` / `obj/` を生成します
     （未インストールの場合はスキップされます）。
2. 動作確認を兼ねてリントを実行:
  ```bash
  deno task lint
  ```
  すべて OK なら Deno が適切に動作しています。
3. アプリは初回起動時に `db/app.sqlite` と `cache/videos/` を自動作成します。手動作業は不要です。
4. `config/settings.toml` をテキストエディタで開き、ポートや最大再生時間、`ytDlpPath` / `ffmpegPath`
  / `cacheDir` などを必要に応じて編集できます（初期起動時に自動生成されます）。

## サーバ起動

```bash
deno task dev
```

- `--allow-run` で `bin/yt-dlp.exe` を呼び出します。
- 起動ログに `Listening on http://localhost:2101` が出たら成功です。

## 動作確認フロー

1. **Overlay ページを先に開く**: ブラウザで `http://localhost:2101/overlay/` を開き、`/ws/overlay`
   への接続が張られた状態にします。
2. **Dock ページでステータス確認**: `http://localhost:2101/dock/` を開き、上部の Overlay
   接続ランプが緑になることを確認します。
3. **デバッグコメント送信**: Dock 下部フォームに
   `テストお願いします https://www.youtube.com/watch?v=XXXX` のようなメッセージを入力し送信します。
   - 成功すると `requests` テーブルに `QUEUED` が追加され、一覧にも即時反映されます。
4. **ダウンロード進行の確認**: ワーカー（`src/services/downloadWorker.ts`）が自動で
   `VALIDATING → DOWNLOADING → READY` と更新します。Dock
   のステータス列アイコンとサマリー「ダウンロード中: n件」で進捗を確認できます。
5. **再生テスト**: READY 行の `▶` を押すと overlay 側の `<video>` が `/media/<file>`
   を再生します。最初の1本を再生させれば、以降はキューの順に READY → PLAYING → DONE
   を自動で繰り返します（途中で止めたい場合は Dock
   上部の「停止」ボタンを押してください）。グローバルな「停止」「スキップ」ボタンで現在の再生を制御できます。
6. **エラー確認**: ダウンロードや変換に失敗した場合はステータスが `FAILED`
   になり、行のツールチップにエラー理由（yt-dlp / ffmpeg の標準出力）が表示されます。

## 動画キャッシュとファイル名

- キャッシュファイルは常に MP4（H.264 + AAC）に変換され、`<ホスト名>_<動画ID>.mp4` で
  `cache/videos/` に保存されます。
- 同じ動画 URL を複数回リクエストした場合でも、同一ファイルが再利用されるため容量を圧迫しません。
- `config/settings.toml` の `ffmpegPath` が未設定／存在しない場合は MKV など非対応形式を MP4
  に変換できず `FAILED` になります。必ず `bin/` に ffmpeg を配置してください。

## OBS での利用

- Dock: OBS → View → Docks → Custom Browser Docks から `http://localhost:2101/dock/`
  を登録（上部に「停止」「スキップ」「更新」「全削除」ボタンを配置しています）。「全削除」で再生リストを一括クリア可能です。
- Overlay: ブラウザソース URL を `http://localhost:2101/overlay/` に設定し、音声を OBS
  ミキサーへ出すよう構成します。

## MultiCommentViewer を経由した受信

1. `external/MultiCommentViewer` サブモジュールを初期化します。
   ```bash
   git submodule update --init --recursive external/MultiCommentViewer
   ```
2. `.NET` SDK を導入した環境で `deno task plugin:mcv:build`
   を実行すると `plugins/mcv-botnama/bin/botnama/`
   に `MCV.Botnama.Plugin.dll` と依存 DLL が生成されます。
3. MultiCommentViewer の `plugins/` ディレクトリ（無ければ作成）へ
   生成物一式をコピーし、アプリを再起動すると **Botnama Bridge**
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
  も併せて指定してください。空文字のままにすると無効化されます。
- 機密値は `.env`（リポジトリ直下、`.gitignore` 済み）に
  `BOTNAMA_YTDLP_COOKIES_BROWSER=chrome` や `BOTNAMA_YTDLP_COOKIES_PROFILE=Default`
  のように書くこともできます。必要に応じて `BOTNAMA_YTDLP_COOKIES_KEYRING`、
  `BOTNAMA_YTDLP_COOKIES_CONTAINER`
  も併せて指定してください。環境変数が定義されている場合は TOML より優先して読み込まれるため、
  リポジトリにコミットしたくないブラウザ名／プロファイルなどは `.env` にのみ記述してください。

## トラブルシューティング

| 症状                    | チェック項目                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Dock に一覧が出ない     | `deno task dev` のログと `http://localhost:2101/healthz` を確認。ポート競合がないかもチェック         |
| Overlay 接続ランプが赤  | Overlay ページが開いているか、WebSocket をブロックする拡張機能がないか確認                            |
| ダウンロードが `FAILED` | `cache/videos` の書き込み権限、ネットワーク到達性、該当 URL の長さ制限（`maxVideoDurationSec`）を確認 |
| 変換が `FAILED`         | `ffmpegPath` が正しく設定・配置されているか、コーデックが mp4/H.264/AAC に変換可能かを確認            |
| bin のバイナリが古い    | `bin/yt-dlp.exe --version`、`bin/yt-dlp-ejs/yt/solver/lib.min.js` を最新に差し替え後、アプリ再起動    |

## ログ・データの掃除

- リクエスト履歴を削除したい場合: `sqlite3 db/app.sqlite "DELETE FROM requests;"`
- キャッシュ動画をリセット: `Remove-Item -Recurse -Force cache/videos/*`

以上の手順で、SPEC_v0.1 に記載されたデバッグフローをローカル環境で再現できます。
