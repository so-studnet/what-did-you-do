---
name: wdyd-environment
description: what-did-you-do（作業記録アプリ）の開発・検証・デプロイ環境の手引き。Next.js 16 + Supabase（Auth/DB/Realtime/pg_cron）+ Vercel + Web Push の構成、コミット前のチェック、ブランチと PR とマージの流れ、DB マイグレーションの適用、環境変数、通知が届かないときの切り分け、ブラウザでの動作確認のコツ、過去にはまった落とし穴をまとめている。このリポジトリで機能を追加・修正する、テストやビルドを回す、DB のテーブルや RLS を変える、Vercel や Supabase の設定・デプロイ・環境変数について答える、通知や同期の不具合を調べる、PR を作ってマージする、といった作業のときは、明示的に頼まれていなくても最初に必ずこのスキルを読むこと。
---

# what-did-you-do の開発・デプロイ環境

個人用の作業記録 Web アプリ。利用者は1人（リポジトリの持ち主）。仕様は `docs/requirements.md`、設計は `docs/architecture.md`、進捗は `docs/roadmap.md`、利用者向けのセットアップ手順は `docs/setup.md` が正。このスキルは「Claude が作業するときに知っておくべきこと」をまとめたもので、上のドキュメントと重複する細部はそちらを読むこと。

## 全体像

```
ブラウザ / スマホ（PWA）
  ├─ Next.js 16 App Router の画面（ほぼ Client Components、静的配信）
  ├─ supabase-js で Supabase に直接読み書き（RLS で本人の行だけ）
  ├─ Realtime（postgres_changes）で他端末の変更を受け取る
  └─ Service Worker（public/sw.js）で通知を表示
Vercel
  ├─ main ブランチ = 本番。PR ごとにプレビューのデプロイ（GitHub のステータスに出る）
  └─ POST /api/push/dispatch（唯一のサーバー処理。Web Push を送る）
Supabase
  ├─ PostgreSQL（tags / activities / templates / push_subscriptions / push_deliveries）
  ├─ Auth（メール + パスワード。新規登録はオフ）
  └─ pg_cron（1分ごと）→ pg_net で /api/push/dispatch を呼ぶ
```

- GitHub: `so-studnet/what-did-you-do`。Vercel のチームは `so2-1bac`、プロジェクトは `what-did-you-do`
- Supabase のプロジェクト ID: `upcqtinscxpzwwvuynrr`（URL は `https://upcqtinscxpzwwvuynrr.supabase.co`）
- Supabase の接続情報が未設定なら、アプリはブラウザ内（localStorage）だけで動く。テストやローカル確認はこのモードで行える

## 利用者とのやりとり

- 利用者とは**日本語**で話す。インフラや Git の操作には慣れていないので、画面のどこを押すか・どのフォルダでコマンドを打つかまで具体的に書く
- 利用者の PC は **Windows（PowerShell）**。手元で打つコマンドは PowerShell で動く形にする（`cp` `cd` `notepad` は使える。`Invoke-RestMethod` で HTTP を呼べる）
- **秘密の値を会話に貼らせない**：`VAPID_PRIVATE_KEY`・`SUPABASE_SECRET_KEY`（`sb_secret_...`）・`CRON_SECRET`。鍵は利用者の PC で作らせる（この環境で作ると会話に残る）。公開してよいのは Supabase の URL、Publishable key（`sb_publishable_...`）、`NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- Supabase・Vercel のダッシュボードは Claude からは触れない。設定は手順を示して利用者にやってもらい、SQL Editor の結果やスクリーンショットを見せてもらって確認する

## コミット前のチェック

```bash
bash .claude/skills/wdyd-environment/scripts/check.sh
```

単体テスト（Vitest）・lint・型チェック・DB テスト・本番ビルドをまとめて実行し、最後に `.next` を消す。個別に回すなら `npm test` / `npm run lint` / `npm run typecheck` / `npm run test:db` / `npm run build`。

- `npm run typecheck` は `next typegen && tsc --noEmit`。`LayoutProps` などの型は typegen で生成されるので、素の `tsc` だけだと失敗する
- `npm run test:db` は一時的な PostgreSQL（この環境には 16 が入っている）を起動し、`supabase/tests/supabase-stub.sql`（auth スキーマ・ロールの最小限の再現）→ `supabase/migrations/*.sql` → `supabase/tests/*.test.sql` の順に流す。テーブルを増やしたら `scripts/test-db.sh` の `truncate` の対象にも足す
- 時間計算・集計・タグの木などのロジックは `src/lib/domain/` に純粋関数で置き、テストを書く（CLAUDE.md のルール）

## ブランチ・PR・デプロイの流れ

1. 作業ブランチ（セッションで指定されたもの）で実装し、チェックを通してコミット・push
2. PR は**利用者に頼まれたときだけ**作る。PR の本文は日本語で、変更内容・マージ後に利用者がやる作業・テスト・未確認のことを書く
3. マージは利用者が「マージまで進めて」と頼んだときだけ行う。その前に `mergeable_state` が `clean` で、Vercel のプレビューのステータスが `success` であることを確かめる
4. main に入ると Vercel が本番に自動デプロイする
5. **マージ済みの PR のブランチで続きの作業をするとき**：force push は拒否される設定なので、`git fetch origin main && git merge --ff-only origin/main` で作業ブランチを main に早送りしてから新しいコミットを積み、普通に push する

コミットメッセージや PR にモデル名を書かない。ドキュメントだけの小さな変更は、次の機能の PR に相乗りさせてよい（利用者もそれを好む）。

## DB を変えるとき

- 新しいマイグレーションは `supabase/migrations/<YYYYMMDDHHMMSS>_<内容>.sql` として**追加**する。既存のファイルは本番に適用済みなので書き換えない
- **本番への適用は自動ではない**。利用者に Supabase の SQL Editor でファイルの中身を実行してもらう必要があるので、PR の本文と最後の報告に必ず書く。デプロイ（Vercel）とマイグレーション（Supabase）の順番に注意し、新しいコードが新しいテーブルを前提にするなら先に SQL を実行してもらう
- テーブルは RLS を有効にし、`user_id = (select auth.uid())` のポリシーを付ける。サーバー専用の関数は `security definer` + `set search_path = ''` にし、`public, anon, authenticated` から `revoke` して `service_role` だけに `grant` する
- 新しいテーブルを他端末に同期するなら `supabase_realtime` の publication に足す

## 環境変数

| 変数 | 置き場所 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel / `.env.local` | Supabase の URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel / `.env.local` | 公開用のキー（旧 anon key でも可） |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel | Web Push の公開鍵 |
| `VAPID_PRIVATE_KEY` | Vercel のみ（秘密） | Web Push の秘密鍵 |
| `VAPID_SUBJECT` | Vercel | `mailto:利用者のメールアドレス`（iOS はこの形式でないと拒否する） |
| `SUPABASE_SECRET_KEY` | Vercel のみ（秘密） | `/api/push/dispatch` だけが使う。`NEXT_PUBLIC_` を付けてはいけない |
| `CRON_SECRET` | Vercel のみ（秘密）+ Supabase Vault（`wdyd_cron_secret`） | pg_cron からの呼び出しの合言葉 |

`NEXT_PUBLIC_*` はビルド時に埋め込まれるので、Vercel で変えたら **Redeploy** が必要。見本は `.env.example`。

## Web Push の仕組みと切り分け

pg_cron（`supabase/setup/push-cron.sql` で登録）が毎分 `/api/push/dispatch` を呼び、`claim_due_push_notifications()` が「予定時間に達した実行中の作業 × 端末」を `push_deliveries` に記録しつつ返し、web-push で送る。1つの作業・予定時刻の組は一度しか返らない（送信に失敗しても）。

- Vercel Cron は Hobby プランだと1日1回しか動かないので使っていない
- pg_cron が呼ぶ URL は本番のドメインにする。デプロイごとの URL は Vercel のログイン保護で HTML の 401/403 が返る
- アプリ内の通知（`DueNotifier`）とサーバーからの通知は同じ `tag`（`wdyd-due-<作業ID>`）で1つにまとまる

「通知が来ない」と言われたら `references/push-troubleshooting.md` の順で切り分ける（端末の登録 → cron → API の応答 → 取り出し → 端末側）。

## Next.js 16 の注意点

- AGENTS.md のとおり、API を使う前に `node_modules/next/dist/docs/` の該当ページを読む（学習データと違うことがある）
- `next.config.ts` には `cacheComponents: true`・`partialPrefetching: true`・Tailwind 用の `turbopack.rules` がある。**丸ごと書き換えて消さないこと**（一度やって戻した）。変えるときは差分で
- `cacheComponents` のもとでは route handler / ページに `runtime` を export できない
- 一度開いたページは React の Activity で**非表示のまま DOM に残る**。Playwright のセレクタが隠れたページの要素にも当たるので、`:visible` を付けるか `getByRole` を使う

## 動作確認（ブラウザ）

Chromium と Playwright が入っている（`require('playwright')`、`NODE_PATH=$(npm root -g)`）。`npm run build` → `npx next start -p 3123` で起動し、スマホ幅（`devices['iPhone 13']`）で操作してスクリーンショットを撮って見る。詳しい手順と、Supabase の通信を模倣する方法・通知のテストのしかたは `references/browser-verification.md`。

要点だけ:
- ブラウザを `timezoneId: 'Asia/Tokyo'` にするなら、スクリプトも `TZ=Asia/Tokyo node ...` で動かす（そうしないと時刻が9時間ずれて見える）
- ヘッドレスの Chromium は通知の許可が `denied` 固定。`Notification.permission` と `showNotification` を `addInitScript` で差し替えて確かめる。実際の配信は実機でしか確かめられないので、そう報告する
- サーバーを止めるときに `pkill -f "next start"` を使うと、そのコマンド自身にも一致してシェルごと落ちる。`kill $(ps aux | grep "[n]ext-ser" | awk '{print $2}')` を使う
- `git rm` で最後のファイルを消すとディレクトリも消える。同じ場所に新しいファイルを書く前に `mkdir -p` する

## 残っている課題・改善案

`docs/roadmap.md` を見る。M0〜M10 は完了。改善案として出したもの（作業名の候補、切り替えボタン、止め忘れ警告、メモ、推移グラフ、目標時間、超過の再通知、CSV 出力、オフライン記録、通知の送り直し、CI）は利用者の選択待ち。
