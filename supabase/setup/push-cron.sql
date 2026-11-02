-- What did you do: 予定時間の通知を1分ごとに送る定期実行の設定
-- docs/setup.md の「7. アプリを閉じていても通知する」の手順で、Supabase の SQL Editor で実行する。
-- 実行前に、下の2か所（<CRON_SECRET> と <アプリのURL>）を自分の値に書き換えること。

-- 1. 必要な拡張機能（Database → Extensions で有効にしてもよい）
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Vercel に設定した CRON_SECRET を、暗号化して保存する
select vault.create_secret('<CRON_SECRET>', 'wdyd_cron_secret');

-- 3. 1分ごとにアプリの通知 API を呼ぶ
select cron.schedule(
  'wdyd-push-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<アプリのURL>/api/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'wdyd_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

-- ---- 確認・停止に使う SQL（必要なときだけ実行する） ----
-- 直近の実行結果:            select * from cron.job_run_details order by start_time desc limit 5;
-- API の応答（200 なら成功）: select status_code, content from net._http_response order by created desc limit 5;
-- 定期実行を止める:          select cron.unschedule('wdyd-push-dispatch');
-- CRON_SECRET を変える:      update vault.secrets set secret = '<新しい値>' where name = 'wdyd_cron_secret';
