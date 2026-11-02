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

## DB のテスト（開発者向け）

PostgreSQL 15 以上がインストールされていれば、マイグレーションと RLS をローカルで確認できる。

```bash
npm run test:db
```
