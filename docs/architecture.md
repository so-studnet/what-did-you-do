# 技術構成・設計

## 技術スタック

| 層 | 採用技術 | 理由 |
|---|---|---|
| 言語 | TypeScript | 型による安全性。AI支援開発との相性が良い |
| フレームワーク | Next.js (App Router) | 画面とサーバ処理を一つのプロジェクトで書ける |
| UI | Tailwind CSS + shadcn/ui | 見た目を素早く整えられ、スマホ対応もしやすい |
| DB・認証 | Supabase (PostgreSQL + Auth) | 無料枠あり。端末間でデータを同期できる |
| ORM | Drizzle ORM | 型安全で軽量。マイグレーションも管理できる |
| テスト | Vitest（単体）/ Playwright（E2E） | |
| ホスティング | Vercel | GitHubにpushすると自動でデプロイされる |
| PWA | Web App Manifest + Service Worker | ホーム画面への追加と通知 |

## データモデル

```
tags                     階層タグ
  id           uuid PK
  name         text
  parent_id    uuid FK -> tags.id (null = ルート)
  color        text
  sort_order   int

activities               作業記録
  id           uuid PK
  title        text
  started_at   timestamptz
  ended_at     timestamptz   null = 実行中
  planned_min  int           null = 無制限
  note         text
  created_at / updated_at

activity_tags            作業 × タグ（多対多）
  activity_id  uuid FK
  tag_id       uuid FK

templates                テンプレート
  id           uuid PK
  title        text
  planned_min  int           null = 無制限
  sort_order   int

template_tags            テンプレート × タグ（多対多）
  template_id  uuid FK
  tag_id       uuid FK
```

M2 までは、上の内容を1つの JSON（`{ activities, tags, templates }`）としてブラウザの localStorage（キー `wdyd:data:v2`）に保存する。保存処理は `src/lib/store/app-store.ts` の `AppStore` インターフェースの裏に隠してあり、M2 で Supabase 実装に差し替える。M1〜M3 の形式（`wdyd:activities:v1`）は読み込み時に自動で移行する。

すべてのテーブルに `user_id`（`auth.users.id`）を持たせ、Row Level Security で本人のデータだけを読み書きできるようにする。利用者は一人だけでも、多層防御としてRLSを入れておく。

### 設計のポイント
- **並行作業**は「`ended_at IS NULL` の行が複数ある状態」で表す。特別な仕組みはいらない
- **経過時間** = `now() - started_at`。画面は1秒ごとに再描画するが、値は毎回この式で計算する
- **超過**は保存せず、`ended_at - started_at > planned_min` から求める
- **タグの親への合算**は、PostgreSQLの再帰CTE（`WITH RECURSIVE`）か、アプリ側でタグの木を組み立てて計算する
- **時刻の整合性**：`ended_at >= started_at` をDBの制約で保証する

## ディレクトリ構成（予定）

```
src/
  app/                 Next.js のルート（画面）
    (app)/page.tsx       ホーム：開始・実行中一覧・テンプレート
    (app)/timeline/      タイムライン
    (app)/summary/       集計
    (app)/settings/      タグ・テンプレート管理
    login/
  components/          UIコンポーネント
  lib/
    db/                Drizzle のスキーマとクエリ
    domain/            時間計算・集計・タグの木などの純粋関数（単体テストの主な対象）
  test/
e2e/                   Playwright のテスト
docs/
```

時間計算・日またぎの分割・タグの合算・超過判定といった **間違えやすいロジックは `lib/domain` に純粋関数として切り出し**、単体テストで固める。
