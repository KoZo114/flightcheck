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
本物の ODPT データでの確認も済み（2026-11-09）。取得方法と判定を実データに合わせて直した。
2026-11-09 に利用者がスマホでパスワード経由の検索を試し、一覧が出ることを確認した（「やること」はすべて完了）。
ODPT は `Access-Control-Allow-Origin: *` を返すので、トークンを持つ本人は中継なしで直接つながる。
パスワードで人に使ってもらうための中継を公開済み（2026-11-09）：https://flightcheck-relay.ko3-h.workers.dev （Cloudflare アカウントは利用者のもの。secret の `ODPT_KEY` と `ACCESS_PASSWORD` は利用者が自分で登録した）。

確認用のトークンは利用者の Mac の `~/.config/flightcheck/odpt_key`（リポジトリの外、権限 600）にある。
使うときは `$(cat ~/.config/flightcheck/odpt_key)` で読み、中身を表示・記録しないこと。

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
relay-worker/           パスワードで人に使ってもらうための中継（Cloudflare Workers 無料枠）
test/relay.test.mjs     中継（パスワード・許可元・1分キャッシュ）のテスト
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
- パラメータ：`odpt:arrivalAirport=odpt.Airport:HND` と `acl:consumerKey=<トークン>`（1日分の約540便、0.4MB 程度）
  - `odpt:operator=odpt.Operator:HND-JAT` / `HND-TIAT`（空港ターミナル会社）で絞ると **0件** になる。このトークンで取れるのは JAL・ANA が出しているデータだけ
  - そのため対象は JAL・ANA の便名が付いた便（JTA、エア・ドゥ／ソラシドエア／スターフライヤーの共同運航便を含む）。スカイマークや海外の航空会社の便は出ない。画面下部にもそう書いてある
  - 国内線・国際線の絞り込みは取得後に `buildResult` で出発地から判定する
- 登録は無料（https://developer.odpt.org/）。登録済み。
- 出典表示「公共交通オープンデータセンター」は画面下部に入れてある。消さないこと。

### 項目名の揺れに注意

実データは公式仕様と項目名が違うことがある。`js/core.js` の `normalize()` で両方を吸収している。

| 意味 | 仕様の名前 | 2026-11-09 に実際に届いた形 | 以前の資料にあった別名 |
|---|---|---|---|
| 便名 | `odpt:flightNumber`（配列） | 同じ。1便1件で、共同運航の便名はまとめて来ない | `odpt:flightNumbers` |
| 予定時刻 | `odpt:scheduledArrivalTime` | 同じ（`"17:20"` 形式、日付なし） | `odpt:scheduledTime` |
| 見込み時刻 | `odpt:estimatedArrivalTime` | 同じ（約4割の便だけ） | `odpt:estimatedTime` |
| 実績時刻 | `odpt:actualArrivalTime` | 同じ | `odpt:actualTime` |
| ターミナル | `odpt:arrivalAirportTerminal` | `HND.Terminal1.NorthWing` / `Terminal1.SouthWing` / `Terminal1` / `Terminal2` / `Terminal3` | `odpt:terminal` |
| ゲート | `odpt:arrivalGate` | ANA だけ `"1,2,3"` のような値（画面では使っていない） | `odpt:gate` |
| 出発地 | `odpt:departureAirport` | `odpt:originAirport` | — |
| 機材 | なし | `odpt:aircraftType`（`"73H"` `"789"` `"78K"` `"76P"` `"32S"` など IATA 系の型式コード。1割弱は無し） | `odpt:aircraftModel` |
| 航空会社 | `odpt:airline` | `odpt.Operator:JAL` / `odpt.Operator:ANA` | `odpt.Airline:JAL`、`JAL` |
| 状況 | `odpt:flightStatus` | `EstimatedArrival` `Arrived` `Landed` `Cancelled` など。**空の便も多い** | — |
| お知らせ | なし | `odpt:flightInformationSummary`（`{ja:"出発遅延", en:"Delayed"}` など） | — |

項目が取れていない場合は、実際のレスポンスを見て `normalize()` に名前を足す。
機材コードは `data.js` の `normalizeAircraft()` で座席数の表に寄せる（`73x`→737-800、`78x`→787-9 など系列で近似）。

### 判定のルール（core.js）

- 遅れ＝（実績 or 見込み）−予定。12時間以上ずれる場合は日付またぎとして補正
- 実績が予定より12時間以上前に見える便は「前日の便が0時過ぎに着いた」もの（`prevDay`）。同じ便名の当日便と並んで届く（`owl:sameAs` の末尾が `.1` / `.2`）。予定時刻基準では除外する
- 指定分数以上の遅れ、または時刻が出ていないが状況が「遅れ」系かお知らせが「Delayed」の便を表示
- 欠航系（Cancelled / PostponedTomorrow / Diverted / DestinationChanged）は別扱いで先頭に表示
- 同じ予定時刻・出発地・ターミナルの便はコードシェアとしてひとつにまとめる。ただし同じ便名どうし・機材が違うもの（例：ANA の 777 とエア・ドゥの 767 が同時刻に新千歳から着く）はまとめない
- 時間帯は「予定時刻」基準（既定）か「見込み時刻」基準を選べる。0時またぎも可
  - 画面の言葉は「時間帯をどの時刻で見るか：時刻表の時刻／実際に着く時刻」（利用者にわかりやすい言い方に合わせた）

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
- ODPT の規約（利用規約 第5条）でトークンを第三者に開示できない。人に使ってもらうときは中継＋パスワードにする。
  - パスワードは Cloudflare の secret（`ACCESS_PASSWORD`）にだけ置く。**コードやリポジトリ、会話のメモに書かない**
  - 画面ではパスワードを `localStorage`（キー `hnd:sharedPass`）に保存し、中継へは `x-flightcheck-pass` ヘッダーで送る（URLに載せない）
  - 設定画面に最初から見えるのはパスワード欄だけ（利用者の希望。欄が2つだとややこしい）。トークン欄は「詳細設定」の中に置き、中継が止まったときの予備にする
  - 共有の中継URLは `js/odpt.js` の `SHARED_RELAY`。URL自体は秘密ではない（パスワードがないと 401）
  - 中継は ODPT への問い合わせをメモリに1分ためる（workers.dev では Cache API が効かないことがあるため）
- ODPT の開発者ガイドラインに従い、画面にデータ作成時刻（`dc:date` の最新）と問い合わせ先（GitHub Issues）を出している。消さないこと。

## やること（上から順に）

### 1. 本物のデータで確認する（2026-11-09 済み）

```bash
curl -s "https://api.odpt.org/api/v4/odpt:FlightInformationArrival?odpt:arrivalAirport=odpt.Airport:HND&acl:consumerKey=$(cat ~/.config/flightcheck/odpt_key)" | head -c 3000
```

- 届いた項目名を上の表と照らし、足りないものがあれば `normalize()` に追加し、テストにもその形を足す（`test/core.test.mjs` の 6 に実データの形がある）
- 確認に使ったトークンをファイルやコミットに残さないこと

### 2. GitHub に公開する（2026-11-03 済み）

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

### 4. 中継を立てる（パスワードで人に使ってもらうとき）

Cloudflare Workers の無料プランで動く。1日10万リクエストまで無料なので、この使い方なら費用はかからない。

```bash
cd relay-worker
# wrangler.toml の ALLOWED_ORIGIN を https://<ユーザー名>.github.io に書き換える
npx wrangler login
npx wrangler deploy
npx wrangler secret put ODPT_KEY          # 利用者が自分で入力する
npx wrangler secret put ACCESS_PASSWORD   # 利用者が自分で入力する
```

表示された `https://flightcheck-relay.<サブドメイン>.workers.dev` を `js/odpt.js` の `SHARED_RELAY` に書き、公開する。
使ってもらう人は、設定の「パスワード」欄にパスワードを入れるだけで使える。

## 変更するときの約束

- 変更後は必ず `npm test` を通す。ロジックを変えたらテストも足す
- 見た目を変えたら `npm run serve` → `?demo` で、スマホ幅（390px）とダークモードを確認する
- 画面の文言は利用者目線のやさしい日本語で。エラー文は「何が起きたか」と「どうすればいいか」を書く
- デザインの方向性（黄色の案内サイン、紺の到着ボード、Barlow Condensed の数字、Zen Kaku Gothic New の本文）は維持する
- 有料サービス、APIキーのコード埋め込み、定期実行は追加しない（利用者の方針）
