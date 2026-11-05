# 通知（Web Push）が届かないときの切り分け

通知は次の順に流れる。前から順に、どこで止まっているかを確かめる。SQL は利用者に Supabase の **SQL Editor** で実行してもらい、結果を貼ってもらう（どれも秘密の値を含まない）。

```
端末の登録（push_subscriptions）
  → pg_cron（cron.job / cron.job_run_details）
  → pg_net の呼び出し結果（net._http_response）
  → 取り出し（push_deliveries）
  → web-push で送信（API の応答の sent / failed / removed）
  → 端末で表示（OS の通知設定・Service Worker）
```

## 先に伝えること

- **テストのたびに新しい作業を開始してもらう。** 1つの作業・予定時刻の組は、一度取り出されると（送信に失敗しても、宛先が0件でも）二度と送られない
- 予定時間に達した時点で端末が未登録だと、その作業の通知は宛先0件のまま消費される
- テストは「予定 1分で開始 → 右上が『同期済み』になるのを待つ → アプリを完全に閉じる → 2〜3分待つ」。開始してすぐ閉じると、作業がサーバーに保存されないことがある

## 確かめる SQL

```sql
-- 1. 端末が登録されているか（endpoint は途中まで）
select left(endpoint, 40) as endpoint, time_zone, created_at, updated_at from public.push_subscriptions;

-- 2. 作業がサーバーにあるか
select title, started_at, planned_min, ended_at from public.activities order by started_at desc limit 3;

-- 3. 定期実行が登録され、動いているか
select jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;

-- 4. API の応答（何もしなかった回を除く）
select status_code, content::text, error_msg, created from net._http_response
  where content::text not like '%"sent":0,"failed":0,"removed":0%'
  order by created desc limit 10;

-- 5. 通知の対象として取り出されたか
select activity_id, due_at, sent_at from public.push_deliveries order by sent_at desc limit 5;
```

## 症状と原因

| 症状 | 原因と対処 |
|---|---|
| `relation "cron.job" does not exist` | pg_cron が有効でない（実際に起きた）。**Database → Extensions** で `pg_cron` と `pg_net` を有効にし、`supabase/setup/push-cron.sql` を実行し直す。`vault.create_secret` が済んでいたらその行は消す（`select name from vault.secrets where name = 'wdyd_cron_secret';` で確認） |
| 1 が0行 | 端末が未登録。環境変数を足したあと Redeploy したか、アプリを完全に終了して開き直したか、iPhone はホーム画面のアイコンから開いたか、OS の通知許可。PC の Chrome の Console に「通知の宛先の登録に失敗しました」が出ていないか |
| 2 に作業がない | 開始してすぐ閉じた。「同期済み」を待ってから閉じる |
| 応答が `401` で `{"error":"unauthorized"}` | Vercel の `CRON_SECRET` と Vault の値が違う（前後の空白にも注意） |
| 応答が `401` / `403` で HTML | デプロイごとの URL を呼んでいる。Vercel の **Domains** の本番 URL にする |
| 応答が `404` | URL の間違い、またはコードが未デプロイ |
| 応答が `503` で `missing` | 一覧の環境変数が足りない。追加して Redeploy |
| 応答が `500` / `"failed"` | Vercel の **Logs** で `/api/push/dispatch` を見る。`claim_due_push_notifications` がない → web_push のマイグレーション未適用。認証エラー → `SUPABASE_SECRET_KEY` の誤り。VAPID のエラー → 鍵の組か `VAPID_SUBJECT` の形式 |
| 応答が `"removed":1` | 宛先が無効（404/410）で消された。アプリを開き直すと登録し直す |
| `"sent":1` なのに届かない | 端末側。通知許可・集中モード・省電力。アプリを完全に終了して2回ほど開き直す（古い Service Worker の入れ替え） |

URL や合言葉を直すときは `select cron.unschedule('wdyd-push-dispatch');` で消してから `push-cron.sql` を実行し直す。

PC から API を直接呼んで応答を見る方法（利用者の PowerShell で。合言葉は会話に貼らせない）:

```bash
Invoke-RestMethod -Method Post -Uri "https://<本番URL>/api/push/dispatch" -Headers @{ Authorization = "Bearer <CRON_SECRET>" }
```
