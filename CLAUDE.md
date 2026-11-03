# Flightcheck（羽田 到着便の遅れチェッカー）— Claude Code 向け指示書

このファイルは Claude Code が読むための作業指示書です。利用者は KOZO（プログラミングは Claude Code 任せ）。
**返答・コメント・コミットメッセージは自然な日本語で書くこと。**

## 目的

羽田空港に着く便のうち、利用者が指定した時間帯に遅れている便を、スマホで見やすく一覧表示する個人用ツール。

- 利用者がボタンを押したときだけデータを取りに行く（定期実行・通知はしない）
- **完全無料で運用する**（有料APIや有料プランは使わない）
- 便ごとに「推定人数」（座席数 × 搭乗率の目安）を出す
- GitHub Pages で公開する静的サイト。サーバーは持たない

## 現在の状態

コードは完成済みで、テストはすべて通っている（`npm test`）。デモデータでの表示確認も済み。
GitHub Pages に公開済み（2026-11-03）：https://kozo114.github.io/flightcheck/ （リポジトリ `KoZo114/flightcheck`、main ブランチのルートを配信）。
**まだ本物の ODPT データでは動かしていない。** 残りの作業は「やること」の 1・3・4。

## ファイル構成

```
index.html              画面（マークアップのみ）
css/style.css           見た目（空港の案内サイン＋到着ボードのデザイン。ライト/ダーク対応）
js/app.js               画面の動き（条件入力 → 取得 → 判定 → 描画、設定ダイアログ）
js/odpt.js              ODPT からの取得（直接 or 中継URL、1分キャッシュ、エラー文）
js/core.js              遅延判定・時間帯の絞り込み・コードシェア統合・人数推定（純粋関数）
js/data.js              空港名・航空会社名・機材ごとの座席数
js/demo.js              デモ用データ（index.html?demo で使用）
test/core.test.mjs      core.js のテスト
test/app.test.mjs       demo.js / odpt.js のテスト
relay-worker/           ブラウザから ODPT に直接つながらない場合だけ使う中継（Cloudflare Workers 無料枠）
.nojekyll               GitHub Pages で Jekyll 処理をさせないため
```

ビルド工程はない。ES Modules をそのまま配信する。外部ライブラリは使わない（Google Fonts のみ）。

## 動かし方

```bash
npm test                 # テスト（Node 18 以上）
npm run serve            # http://localhost:8080/?demo でデモ表示
```

`file://` で直接開くと ES Modules が読み込めないので、必ずローカルサーバー経由で確認する。

## データ：ODPT（公共交通オープンデータセンター）

- エンドポイント：`https://api.odpt.org/api/v4/odpt:FlightInformationArrival`
- パラメータ：`odpt:operator=odpt.Operator:HND-JAT,odpt.Operator:HND-TIAT` と `acl:consumerKey=<トークン>`
  - `HND-JAT` … 日本空港ビルデング（第1・第2ターミナル＝国内線）
  - `HND-TIAT` … 東京国際空港ターミナル（第3ターミナル＝国際線）
- 登録は無料（https://developer.odpt.org/）。利用者が申請中。
- 出典表示「公共交通オープンデータセンター」は画面下部に入れてある。消さないこと。

### 項目名の揺れに注意

実データは公式仕様と項目名が違うことがある。`js/core.js` の `normalize()` で両方を吸収している。

| 意味 | 仕様の名前 | 実データで見られた名前 |
|---|---|---|
| 便名 | `odpt:flightNumber`（配列） | `odpt:flightNumbers` |
| 予定時刻 | `odpt:scheduledArrivalTime` | `odpt:scheduledTime` |
| 見込み時刻 | `odpt:estimatedArrivalTime` | `odpt:estimatedTime` |
| 実績時刻 | `odpt:actualArrivalTime` | `odpt:actualTime` |
| ターミナル | `odpt:arrivalAirportTerminal` | `odpt:terminal` |
| ゲート | `odpt:arrivalGate` | `odpt:gate` |
| 出発地 | `odpt:departureAirport` | 同じ |
| 機材 | なし | `odpt:aircraftModel`（null のことが多い） |
| 状況 | `odpt:flightStatus`（`odpt.FlightStatus:Delayed` など） | 同じ |

本物のデータで項目が取れていない場合は、実際のレスポンスを見て `normalize()` に名前を足す。
`odpt:airline` は `odpt.Airline:JAL` 形式と `JAL` 形式の両方がある。

### 判定のルール（core.js）

- 遅れ＝（実績 or 見込み）−予定。12時間以上ずれる場合は日付またぎとして補正
- 指定分数以上の遅れ、または時刻が出ていないが状況が「遅れ」系の便を表示
- 欠航系（Cancelled / PostponedTomorrow / Diverted / DestinationChanged）は別扱いで先頭に表示
- 同じ予定時刻・出発地・ターミナルの便はコードシェアとしてひとつにまとめる
- 時間帯は「予定時刻」基準（既定）か「見込み時刻」基準を選べる。0時またぎも可

### 推定人数（core.js `estimatePax`）

実際の搭乗者数は公開されていないので目安。画面にもそう明記している。

1. 機材名がわかる → `data.js` の `SEATS`（国内線仕様 / 国際線仕様）× 搭乗率 … 「機材から推定」
2. わからない → 国際線 250席、国内幹線（`TRUNK`）の JAL/ANA 340席、その他 166席 × 搭乗率 … 「路線から推定」
3. 搭乗率の既定値は国内 72%、国際 80%。画面の設定で変更できる

AeroAPI などの有料・ブラウザから呼べないAPIは使わない方針。

## 秘密情報の扱い（重要）

- **ODPT のトークンをコードやリポジトリに絶対に書かない。** GitHub Pages は公開リポジトリになる。
- トークンは画面の「設定」から入力し、その端末の `localStorage`（キー `hnd:odptKey`）にだけ保存する。
- 中継を使う場合、トークンは Cloudflare の secret（`ODPT_KEY`）に置く。

## やること（上から順に）

### 1. 本物のデータで確認する（ODPT のトークンが届いてから）

```bash
curl -s "https://api.odpt.org/api/v4/odpt:FlightInformationArrival?odpt:operator=odpt.Operator:HND-JAT&acl:consumerKey=トークン" | head -c 3000
```

- 届いた項目名を上の表と照らし、足りないものがあれば `normalize()` に追加し、テストにもその形を足す
- 時刻が `"18:05"` 形式か ISO 形式かを確認（どちらにも対応済み）
- 確認に使ったトークンをファイルやコミットに残さないこと

### 2. GitHub に公開する

```bash
git init && git add . && git commit -m "羽田 到着便の遅れチェッカーを追加"
gh repo create flightcheck --public --source=. --push
gh api -X POST repos/{owner}/flightcheck/pages -f "source[branch]=main" -f "source[path]=/"
```

- `gh` が未ログインなら `gh auth login` を案内する
- 公開URLは `https://<ユーザー名>.github.io/flightcheck/`。数分で反映される
- 無料の GitHub アカウントでは、Pages を使うためにリポジトリを公開にする必要がある
- `index.html` に `noindex` を入れてあるので検索には出にくいが、URLを知っていれば誰でも開ける（トークンがなければデータは見えない）

### 3. ブラウザから ODPT に直接つながるか確認する

公開したページをスマホで開き、設定にトークンを入れて検索する。

- 一覧が出れば完了
- 「ブラウザからODPTに直接つながりませんでした」と出る場合は、ODPT がブラウザからの直接アクセス（CORS）を許可していない。次の 4 を行う
- 事前に確かめるなら：`curl -sI -H "Origin: https://<ユーザー名>.github.io" "<上のURL>" | grep -i access-control-allow-origin` に値が出れば直接つながる

### 4.（必要なときだけ）中継を立てる

Cloudflare Workers の無料プランで動く。1日10万リクエストまで無料なので、この使い方なら費用はかからない。

```bash
cd relay-worker
# wrangler.toml の ALLOWED_ORIGIN を https://<ユーザー名>.github.io に書き換える
npx wrangler login
npx wrangler secret put ODPT_KEY
npx wrangler deploy
```

表示された `https://flightcheck-relay.<サブドメイン>.workers.dev` を、画面の「設定 → 詳細設定 → 中継URL」に入れる。

## 変更するときの約束

- 変更後は必ず `npm test` を通す。ロジックを変えたらテストも足す
- 見た目を変えたら `npm run serve` → `?demo` で、スマホ幅（390px）とダークモードを確認する
- 画面の文言は利用者目線のやさしい日本語で。エラー文は「何が起きたか」と「どうすればいいか」を書く
- デザインの方向性（黄色の案内サイン、紺の到着ボード、Barlow Condensed の数字、Zen Kaku Gothic New の本文）は維持する
- 有料サービス、APIキーのコード埋め込み、定期実行は追加しない（利用者の方針）
