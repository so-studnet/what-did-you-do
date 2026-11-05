# セットアップ手順（Supabase と Vercel）

スマホとパソコンで記録を同期して使うための手順です。接続情報を設定しなければ、アプリはブラウザ内だけに保存して動きます。

> Supabase と Vercel の画面の名前や場所は変わることがあります。見つからないときは、各サービスのドキュメントで同じ項目を探してください。

## 1. Supabase のプロジェクトを作る

1. [Supabase](https://supabase.com) にサインアップし、新しいプロジェクトを作る
   - Region は日本から近い **Northeast Asia (Tokyo)** がおすすめ
   - データベースのパスワードは控えておく（アプリでは使わない）
2. 左メニューの **SQL Editor** を開き、`supabase/migrations/20261102000000_init.sql` の中身を貼り付けて実行する
   - テーブル・制約・RLS（本人のデータだけ読み書きできる設定）・Realtime の登録が作られる

## 2. 自分のアカウントを作り、新規登録を止める

1. **Authentication** → **Users** → **Add user** → **Create new user**
   - メールアドレスとパスワードを入れ、**Auto Confirm User** にチェックして作成する
2. **Authentication** の設定（Sign In / Providers）で **Allow new users to sign up** をオフにする
   - 自分以外がアカウントを作れないようにするため

## 3. 接続情報を控える

必要なのは次の2つです。

| 環境変数 | 値 | 確認する場所 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<プロジェクトID>.supabase.co` | ブラウザのアドレスバー `supabase.com/dashboard/project/<プロジェクトID>/...` の `<プロジェクトID>` の部分から作れる。画面上部の緑の **Connect** ボタンでも確認できる |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | **Project Settings**（左下の歯車）→ **API Keys** → **Publishable key** の行のコピーボタン。古いプロジェクトでは **Legacy anon, service_role API keys** タブの anon key でもよい |

この2つはブラウザに載る公開用の値です。データは RLS で守られているので、知られても他人は読み書きできません。

**同じ画面の下にある Secret keys（`sb_secret_...`）や service_role key は、RLS を無視して何でもできる鍵です。アプリに設定したり、人に見せたりしないでください。**

## 4. 手元で動かす

```bash
cp .env.example .env.local
```

`.env.local` に3の値を書いてから:

```bash
npm run dev
```

http://localhost:3000 を開くとログイン画面が出る。ブラウザ内に以前の記録があれば、ログイン後に取り込むか聞かれる。

## 5. Vercel で公開する

1. [Vercel](https://vercel.com) に GitHub アカウントでログインし、**Add New** → **Project** でこのリポジトリを選ぶ
2. **Environment Variables** に3の2つを登録する
3. **Deploy** を押す。以後は GitHub に push するたびに自動で公開される
   - `main` ブランチが本番、それ以外のブランチはプレビュー用の URL になる

## 6. スマホで使う

1. 公開された URL（`https://...vercel.app`）をスマホで開いてログインする
2. ホーム画面に追加する
   - iPhone: Safari の共有ボタン → **ホーム画面に追加**
   - Android: Chrome のメニュー → **アプリをインストール**（または **ホーム画面に追加**）
3. ホーム画面のアイコンから開き、「通知をオンにする」を押す（iPhone は iOS 16.4 以降）
4. アプリを閉じていても通知を受け取るには、7 の設定も行う

## 7. アプリを閉じていても通知する（Web Push）

予定時間に達したら、アプリを閉じていてもサーバーから通知を送る設定です。Supabase が1分ごとにアプリの API を呼び、API が通知を送ります（最大1分ほど遅れることがあります）。

### 7-1. DB に通知用のテーブルを追加する
Supabase の **SQL Editor** で `supabase/migrations/20261103000000_web_push.sql` の中身を貼り付けて実行する。

### 7-2. 鍵と合言葉を作る
手元のリポジトリのフォルダ（`package.json` があるフォルダ）で:

```bash
npx web-push generate-vapid-keys
```

`Public Key` と `Private Key` が表示されるので控える。続けて、合言葉（CRON_SECRET）を作る:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Private Key と合言葉は秘密の値です。** 人に見せたり、GitHub に上げたりしないでください。

### 7-3. Vercel に環境変数を追加して、再デプロイする
Vercel のプロジェクト → **Settings** → **Environment Variables** に追加する。

| Key | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 7-2 の Public Key |
| `VAPID_PRIVATE_KEY` | 7-2 の Private Key |
| `VAPID_SUBJECT` | `mailto:自分のメールアドレス` |
| `SUPABASE_SECRET_KEY` | Supabase の **API Keys** 画面の **Secret keys** の `sb_secret_...`（目のアイコンで表示してコピー） |
| `CRON_SECRET` | 7-2 の合言葉 |

`SUPABASE_SECRET_KEY` はサーバー側の通知処理だけが使います。**`NEXT_PUBLIC_` を付けないでください**（付けるとブラウザに載ってしまいます）。

追加したら **Deployments** → 最新のデプロイの **⋯** → **Redeploy** で再デプロイする。

### 7-4. 1分ごとの定期実行を登録する
`supabase/setup/push-cron.sql` を開き、`<CRON_SECRET>` を 7-2 の合言葉に、`<アプリのURL>` を公開 URL（例 `what-did-you-do-xxxx.vercel.app`、`https://` は不要）に書き換えてから、**SQL Editor** で実行する。

- `pg_cron` / `pg_net` が有効にできないと出たら、**Database** → **Extensions** で2つを有効にしてから、もう一度実行する
- URL は本番の URL を使う（プレビュー用の URL は Vercel のログインが必要なため呼べない）

### 7-5. 確かめる
1. スマホでホーム画面のアイコンからアプリを開く（通知が許可されていれば、この端末が宛先として自動で登録される）
2. Supabase の **Table Editor** で `push_subscriptions` に行が増えていることを確認する
3. 予定時間「1分」で作業を開始し、アプリを閉じて1〜2分待つ

### 7-6. 届かないとき
通知は「端末の登録 → 定期実行 → API → 送信 → 端末で表示」の順に流れる。前から順に SQL Editor で確かめる。

**テストのたびに新しい作業を開始すること。** 1つの作業の通知は、一度「送信済み」になると（送信に失敗しても）二度と送られない。

| 確かめること | SQL | 正常なら |
|---|---|---|
| 端末が登録されているか | `select left(endpoint, 40), time_zone, created_at from public.push_subscriptions;` | 1行以上 |
| 定期実行が登録されているか | `select jobname, schedule, active from cron.job;` | `wdyd-push-dispatch` が `active = true` |
| 定期実行が動いているか | `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;` | `succeeded` が毎分増える |
| API の応答 | `select status_code, content::text, error_msg, created from net._http_response order by created desc limit 5;` | `200` |
| 通知の対象として取り出されたか | `select activity_id, due_at, sent_at from public.push_deliveries order by sent_at desc limit 5;` | テストした作業の行がある |

よくある原因:

| 症状 | 原因と対処 |
|---|---|
| `relation "cron.job" does not exist` | pg_cron が有効になっていない。**Database** → **Extensions** で `pg_cron` と `pg_net` を有効にし、`push-cron.sql` を実行し直す（`vault.create_secret` が済んでいたらその行は消す） |
| 端末の登録が0行 | 環境変数を追加したあと再デプロイしていない、またはアプリを開き直していない。iPhone はホーム画面のアイコンから開く |
| API が `401` で `{"error":"unauthorized"}` | Vercel の `CRON_SECRET` と、Vault に保存した合言葉が違う |
| API が `401` / `403` で中身が HTML | Vercel のログイン保護がかかった URL（デプロイごとの URL）を呼んでいる。**Domains** に出ている本番の URL にする |
| API が `503` | `missing` に出ている環境変数が足りない。追加して再デプロイ |
| API が `500`、または応答に `"failed"` | Vercel の **Logs** で `/api/push/dispatch` のエラーを見る |
| 応答が `"sent":1` なのに届かない | 端末の通知設定・集中モード・省電力を確認。アプリを完全に終了して開き直す |

URL や合言葉を直すときは、`select cron.unschedule('wdyd-push-dispatch');` で消してから `push-cron.sql` を実行し直す。

## 8. 何も作業していない時間の通知

7（Web Push）の設定が済んでいることが前提です。追加の環境変数や定期実行の登録は要りません。

1. Supabase の **SQL Editor** で `supabase/migrations/20261105000000_idle_reminder.sql` の中身を貼り付けて実行する
2. アプリの右上の **⋯** → **設定** を開き、オン・オフ、間隔、通知する時間帯を確認して **保存** する（保存しなくても、初期値のオン・15分ごと・8:00〜23:00 で動きます）
3. 確かめるには、作業をすべて終了した状態で間隔の分だけ待つ

届かないときは 7-6 と同じ順で確かめる。空き時間の通知は `push_deliveries` に `activity_id` が `idle:` で始まる行として記録される。

## DB のテスト（開発者向け）

PostgreSQL 15 以上がインストールされていれば、マイグレーションと RLS をローカルで確認できる。

```bash
npm run test:db
```
