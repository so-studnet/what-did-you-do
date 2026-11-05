# 技術構成・設計

## 技術スタック

| 層 | 採用技術 | 理由 |
|---|---|---|
| 言語 | TypeScript | 型による安全性。AI支援開発との相性が良い |
| フレームワーク | Next.js (App Router) | 画面とサーバ処理を一つのプロジェクトで書ける |
| UI | Tailwind CSS | 見た目を素早く整えられ、スマホ対応もしやすい |
| DB・認証 | Supabase (PostgreSQL + Auth + Realtime) | 無料枠あり。端末間でデータを同期できる |
| DB アクセス | supabase-js（ブラウザから直接） | 集計はアプリ側で行うので、サーバー側の処理が不要。安全性は RLS で担保する |
| テスト | Vitest（単体）/ PostgreSQL（RLS）/ Playwright（画面の確認） | |
| ホスティング | Vercel | GitHubにpushすると自動でデプロイされる |
| PWA | Web App Manifest + Service Worker | ホーム画面への追加と通知 |

当初は ORM に Drizzle を予定していたが、DB へのアクセスがブラウザからの単純な読み書きだけになったため使っていない。

## データモデル

定義は `supabase/migrations/` の SQL が正。

```
tags                     階層タグ
  id           text PK       アプリで生成する UUID
  user_id      uuid          持ち主（auth.uid() が自動で入る）
  name         text          1〜30文字
  parent_id    text          null = ルート
  color        text          #RRGGBB

activities               作業記録
  id           text PK
  user_id      uuid
  title        text          1〜100文字
  started_at   timestamptz
  ended_at     timestamptz   null = 実行中。started_at 以上
  planned_min  int           null = 無制限。1〜1440
  tag_ids      text[]        付いているタグ

templates                テンプレート
  id           text PK
  user_id      uuid
  title        text
  planned_min  int
  tag_ids      text[]
  sort_order   int           並び順
```

- すべてのテーブルに `created_at` / `updated_at`（トリガーで自動更新）がある
- **RLS**：ログインしている本人の行だけを読み書きできる。利用者が一人でも、公開キーがブラウザに載るので必須
- **タグは配列（`tag_ids`）で持つ**：中間テーブルにしない。集計・タグの木の処理はアプリ側（`src/lib/domain`）で行うため、DB で結合する必要がない。存在しないタグ ID はアプリ側で無視する
- **ID はアプリで生成**する：画面をすぐ更新し（楽観的更新）、後からサーバーに送るため

### 設計のポイント
- **並行作業**は「`ended_at IS NULL` の行が複数ある状態」で表す。特別な仕組みはいらない
- **経過時間** = `now() - started_at`。画面は1秒ごとに再描画するが、値は毎回この式で計算する
- **超過**は保存せず、`ended_at - started_at > planned_min` から求める
- **タグの親への合算**はアプリ側でタグの木を組み立てて計算する
- **時刻の整合性**：`ended_at >= started_at` を DB の制約で保証する

## 保存と同期

画面は `src/lib/store/app-store.ts` の `appStore` だけを使う。保存先は2つあり、ログイン状態で切り替わる。

| 保存先 | 使う場面 | 実装 |
|---|---|---|
| ブラウザ内（localStorage `wdyd:data:v2`） | Supabase の接続情報が未設定のとき（開発・お試し） | `createLocalStorageAppStore` |
| Supabase | 接続情報が設定され、ログインしているとき | `SupabaseAppStore`（`supabase-store.ts`） |

`SupabaseAppStore` の動き：
1. 起動時は前回のキャッシュ（localStorage `wdyd:cache:<ユーザーID>`）をすぐ表示し、サーバーから読み直す
2. 変更は画面にすぐ反映し、前後の差分（`src/lib/sync/rows.ts` の `diffAppData`）だけを順番にサーバーへ送る。追加・更新を先に、削除を後に送る
3. 送信中はサーバーからの読み直しを後回しにする（画面が一瞬古い状態に戻るのを防ぐ）
4. 保存に失敗したら「同期エラー」を表示し、サーバーから読み直して正しい状態に戻す
5. 別の端末の変更は Realtime（`postgres_changes`）で受け取り、読み直す。画面に戻ったとき・通信が回復したときも読み直す
6. ログアウトすると、その端末のキャッシュを消す

ログイン後、ブラウザ内に以前の記録が残っていれば、アカウントへ取り込むか尋ねる（同じ ID はサーバー側を優先）。

オフラインでの記録はできない（送信に失敗した変更は捨てられる）。

## ディレクトリ構成

```
src/
  app/                 Next.js のルート（画面）
    page.tsx             ホーム：開始・実行中一覧・テンプレート・終了した作業
    timeline/            タイムライン
    summary/             集計
    templates/           テンプレート管理
    tags/                タグ管理
    manifest.ts          PWA のマニフェスト
  components/          UIコンポーネント
  lib/
    domain/            時間計算・集計・タグの木などの純粋関数（単体テストの主な対象）
    store/             保存先（ブラウザ内 / Supabase）
    sync/              DB の行との変換・差分
    supabase/          Supabase クライアントとログイン状態
    server/            サーバー側の処理（通知の送信）
  app/api/push/dispatch/ 通知を送る API（定期実行から呼ばれる）
supabase/
  migrations/          DB のスキーマ（SQL）
  setup/               環境ごとの値を書き換えて実行する SQL（通知の定期実行）
  tests/               RLS のテスト（npm run test:db）
docs/
```

時間計算・日またぎの分割・タグの合算・超過判定といった **間違えやすいロジックは `lib/domain` に純粋関数として切り出し**、単体テストで固める。

## PWA・通知
- マニフェストは `src/app/manifest.ts`、アイコンは `public/icon-*.png` と `src/app/icon.svg` / `apple-icon.png`
- Service Worker は `public/sw.js`。通知の表示と、通知タップ時に画面を前面に出す役割だけを持つ（オフライン用キャッシュはしない）
- 予定時間の判定は `src/lib/domain/notification.ts`（純粋関数）。`DueNotifier`（`src/components/pwa.tsx`）が1秒ごとに確認し、通知済みのキーを localStorage（`wdyd:notified:v1`）に保存して重複を防ぐ
- 通知の `tag` を作業ごとに固定しているので、複数のタブで開いていても通知は1つにまとまる

### Web Push（アプリを閉じていても届く通知）

```
Supabase pg_cron（1分ごと）
  └─ pg_net で POST /api/push/dispatch（Authorization: Bearer CRON_SECRET）
        └─ Vercel の Route Handler（src/app/api/push/dispatch/route.ts）
              ├─ rpc claim_due_push_notifications()  … 送るべき通知を「送信済み」にしつつ取り出す
              ├─ web-push で各端末へ送信（VAPID）
              └─ 410/404 の宛先は rpc delete_push_subscription() で削除
```

- **宛先の登録**：ログイン中で通知が許可されていると、`PushSubscriptionSync`（`src/components/pwa.tsx`）がこの端末を `push_subscriptions` に登録する（本人の行だけ RLS で読み書き可）。ログアウト時に削除する
- **二重送信の防止**：`push_deliveries` の主キー（作業 ID・予定時刻）で、同じ通知は一度しか取り出されない。予定時間を編集すると予定時刻が変わるので、改めて送られる
- **古い通知は送らない**：予定時刻から12時間以上たったものは対象外
- **アプリ内の通知との重複**：アプリを開いているときはアプリ内でも通知するが、同じ `tag` なので1つにまとまる
- **秘密の値**：`SUPABASE_SECRET_KEY`・`VAPID_PRIVATE_KEY`・`CRON_SECRET` はサーバー（Vercel）だけが持つ。`push_deliveries` と送信用の関数は `service_role` 専用
- **なぜ Vercel Cron を使わないか**：Hobby プランでは1日1回しか実行できないため。Supabase の pg_cron は1分ごとに実行できる
- 定期実行の設定は `supabase/setup/push-cron.sql`（URL と合言葉を含むので、マイグレーションには入れない）

### 何も作業していない時間の通知（F8）
- 設定は `user_settings`（1ユーザー1行、RLS で本人のみ）。行がなければ既定値（オン・15分・8〜23時）で扱う。設定画面は `/settings`
- 同じ定期実行（毎分の `/api/push/dispatch`）の中で `claim_idle_push_notifications()` も呼ぶ
  - 対象：宛先が登録されていて、実行中の作業がないユーザー
  - 数え始め `base` = 最後の作業の終了時刻と、今日の通知時間帯の始まりの遅いほう（時間帯はユーザーのタイムゾーンで計算）
  - 区切り `slot` = `base + 間隔 × k`（k ≥ 1 で、今以前の最後の区切り）。今が時間帯の外なら送らない
  - `push_deliveries` に `('idle:<ユーザーID>', slot)` を記録して、同じ区切りで二重に送らない
  - テストしやすいように、関数は基準時刻 `at_time` を引数で受け取る（既定は `now()`）
- 通知の `tag` は `wdyd-idle` で固定し、新しい通知が古い通知を置き換える
- このマイグレーションが未適用でも、予定時間の通知は止めない（取り出しの失敗はログに出して無視する）
