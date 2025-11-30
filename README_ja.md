[English](README.md) | 日本語

<h1 align="center">botnama</h1>
<br>
<p align="center">
   <img src="public/icons/boicon.svg" width="256" alt="botnama icon">
</p>

**botnama**は、YouTube・ニコニコ生放送などの配信コメントから動画URLを抽出し、自動ダウンロード・再生を行うOBS連携型メディアボットです。ライブ配信中のリクエスト動画を自動的にキューイングして、シームレスに再生することができます。

<p align="center">
   <img src="docs\img\sample.jpg"　alt="サンプル OBS スクリーンショット">
</p>

## 主な機能

- **動画URLの自動検出** — コメント内の URL やプレーンテキストの識別子（例: `sm12345`, `BV…`）を検出・正規化して再生可能にします（YouTube: `watch?v=VIDEOID` / `youtu.be/VIDEOID` / `shorts/ID`  ニコニコ: `sm`/`nm`/`so` ID  Bilibili: `BV` IDのクエリ）。
- **自動ダウンロード & キャッシュ** — `yt-dlp` と `ffmpeg` を使って動画を自動取得・変換
- **OBS 連携** — ブラウザドック（管理画面）とブラウザソース（再生 Overlay）で OBS に統合
- **再生管理** — 停止・スキップ・シークなどの操作が可能
- **通知** — リクエスト・再生などのイベントや動画情報を画面上、またはコメントで通知
- **認証連携** — YouTube / ニコニコ のブラウザ Cookie 抽出に対応
- **柔軟なルール設定** — 動画の長さ制限・重複制御・NG ユーザー・投票機能
- **多言語対応** — 日本語・英語の UI 切り替え（`locale` 設定）
- **MultiCommentViewer プラグイン** — MCVを経由することで様々な配信サイトのコメントを受信可能

## クイックスタート

### GitHub Release からダウンロードして使う

1. **最新リリースをダウンロード**

   [Releases ページ](https://github.com/zkamiyama/botnama/releases)から最新版の `botnama.exe` をダウンロードします。

2. **任意のフォルダに配置**

   `botnama.exe` を任意のフォルダに配置してください。初回起動時に同じフォルダ内に `config/`、`db/`、`cache/` `bin/` などのディレクトリが自動的に作成されます。自動的にyt-dlpとffmpegがダウンロードされますが、失敗する場合は手動で`bin/`ディレクトリに配置してください。


3. **実行**

   `botnama.exe` をダブルクリックで起動します。コマンドプロンプトが開き、サーバーが起動します。

4. **ブラウザで確認**

   ブラウザで `http://localhost:2101/dock/` を開いて管理画面にアクセスできます。

5. **OBS に登録**

   後述の「OBS での利用」セクションを参照して、OBS にブラウザドックとブラウザソースを登録してください。

## OBS での利用

### Dock（管理画面）を登録

1. OBS → **View** → **Docks** → **Custom Browser Docks**
2. 以下を設定:
   - **Dock Name**: `botnama Dock`
   - **URL**: `http://localhost:2101/dock/`

### Overlay（再生画面）を登録

1. OBS → **Sources** → **Browser**
2. 以下を設定:
   - **URL**: `http://localhost:2101/overlay/`
   - **Width** / **Height**: 配信解像度に合わせて設定（例: 1920x1080）
3. 音声を OBS ミキサーへ出すよう構成します

### YouTube / ニコニコ生放送と連携する

botnama はブラウザの Cookie を登録することで、YouTube と ニコニコ生放送 の配信と連携できます。

#### Cookie を登録することでできること

- **自動配信URL検知** — 自分の配信URLを自動的に検知し、内蔵のコメントビューワーでコメントを受信します
- **コメント自動送信** — 動画情報を自動的にコメントとして送信できます
- **年齢制限動画** — 年齢制限のある動画も再生可能になります
- **高画質再生** — 一部のサイトでは、ログイン状態でのみ高画質再生が可能な場合があります

**注意**: 内蔵のコメントビューワーが正常に動作しない場合や、より確実にコメントを受信したい場合は、後述の「MultiCommentViewer 連携」セクションを参照して MCV プラグインを使用してください。

#### Cookie 登録手順

1. **ブラウザで YouTube / ニコニコにログイン**

   ブラウザで YouTube や ニコニコ動画にログインしておきます。   
   **推奨ブラウザ**: Firefox を推奨します。Chrome はセキュリティ機能により Cookie の抽出が失敗する場合があります。

2. **botnama の設定を編集**

   `config/settings.toml` を開き、以下の設定を追加します：

   ```toml
   ytDlpCookiesFromBrowser = "firefox"  # または "chrome"
   ytDlpCookiesFromBrowserProfile = "default"  # プロファイル名（通常は "default"）
   ```

   **参考: Windowsでのブラウザ Cookie 保存場所**:
   - **Firefox**: `C:\Users\<ユーザー名>\AppData\Roaming\Mozilla\Firefox\Profiles\<プロファイル名>\cookies.sqlite`
   - **Chrome**: `C:\Users\<ユーザー名>\AppData\Local\Google\Chrome\User Data\<プロファイル名>\Network\Cookies`


3. **botnama を再起動**

   設定を保存したら、botnama を再起動します。これで、ブラウザの Cookie が自動的に読み込まれるようになります。

4. **動作確認**

   Dock の System タブで「Refresh Auth」ボタンをクリックして、Cookie が正しく読み込まれているか確認してください。

### Info Overlay（通知画面）を登録

1. OBS → **Sources** → **Browser**
2. 以下を設定:
   - **URL**: `http://localhost:2101/overlay-info/`
   - **Width** / **Height**: 通知帯のサイズに合わせて設定
3. リクエスト・再生・スキップなどのイベントが画面上に表示されます

## 設定のカスタマイズ

### `config/settings.toml`

- **`httpPort`** — サーバーのポート番号（デフォルト: `2101`）
- **`cacheDir`** — 動画キャッシュのディレクトリ（デフォルト: `cache/videos`）
- **`ffmpegPath`** — ffmpeg の実行ファイルパス（デフォルト: `bin/ffmpeg`）
- **`ytDlpPath`** — yt-dlp の実行ファイルパス（デフォルト: `bin/yt-dlp`）
- **`locale`** — UI 言語（`ja` / `en` / `auto`）

## MultiCommentViewer 連携

1. **プラグインを配置**

- `plugins/botnama` ディレクトリを MultiCommentViewer の `plugins/` ディレクトリにコピー

2. **設定（任意）**

- **botnama 側**: `config/settings.toml` の `mcvAccessToken` に任意の値を設定
- **MCV 側**: プラグイン設定画面の「共有トークン」に同じ値を入力

## ルール設定

Dock（管理画面）の **Rules** タブで、動画リクエストに関する詳細なルールを設定できます。

- **動画の長さ制限**: 再生時間の長い動画を制限
- **重複制御**: 同じ動画の連続リクエストを防止
- **同時リクエスト制限**: ユーザーごとのリクエスト間隔を設定
- **NG ユーザー**: 特定のユーザーからのリクエストを拒否
- **アンケート**: リクエスト動画の継続再生可否を視聴者投票で決定

### カスタムサイト設定

YouTube / ニコニコ動画 /ビリビリ動画 以外のサイトの URL を検知対象に追加できます。

## 開発

- **Deno 2.x** — [公式サイト](https://deno.land/)からインストール
- **.NET SDK**（任意） — MCV プラグインをビルドする場合に必要

### セットアップ

1. **リポジトリをクローン**

```bash
git clone https://github.com/zkamiyama/botnama
cd botnama
```

2. **初期セットアップを実行**

```bash
deno task setup
```

- サブモジュール（`external/MultiCommentViewer`）を初期化
- `mediabunny` の配置
- MCV プラグインのビルド（.NET SDK がインストールされている場合）


3. **開発サーバーを起動**

```bash
deno task dev
```

- ブラウザで以下の URL を開いて動作を確認:
  - **管理画面（Dock）**: `http://localhost:2101/dock/`
  - **再生画面（Overlay）**: `http://localhost:2101/overlay/`
  - **通知画面（Info Overlay）**: `http://localhost:2101/overlay-info/`

## よくあるタスク

### リリースビルドを作成

```bash
deno task release
```

- `release/botnama.exe`（Windows）が生成されます
- ポータブル実行ファイルとして配布可能です

## ドキュメント

- **API ドキュメント** — [docs/API.md](docs/API.md) を参照

## 謝辞

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**
- **[ffmpeg](https://ffmpeg.org/)**
- **[MultiCommentViewer](https://github.com/DaisukeDaisuke/MultiCommentViewer)**
- **[mediabunny](https://github.com/Vanilagy/mediabunny)**
- **[ボトル/bobineKS](https://x.com/bobine_ks)**

---

