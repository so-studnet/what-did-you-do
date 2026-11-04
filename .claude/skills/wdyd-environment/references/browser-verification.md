# ブラウザでの動作確認

変更を報告する前に、実際の画面を操作して確かめる。単体テストが通っても、画面の配線ミスや表示崩れは見つからないため。

## 起動

```bash
npm run build && (npx next start -p 3123 > <スクラッチパッド>/server.log 2>&1 &)
for i in $(seq 1 30); do curl -s localhost:3123 >/dev/null && break; sleep 0.5; done
```

終わったら `kill $(ps aux | grep "[n]ext-ser" | awk '{print $2}')` と `rm -rf .next`。`pkill -f "next start"` は自分のコマンドにも一致してシェルが落ちるので使わない。

## Playwright のスクリプト

スクリプトはスクラッチパッドに置き、`TZ=Asia/Tokyo NODE_PATH=$(npm root -g) node <script> <出力先>` で実行する。

```js
const { chromium, devices } = require('playwright');
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Tokyo', locale: 'ja-JP' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
```

- データを入れるときは `localStorage.setItem('wdyd:data:v2', JSON.stringify({ activities, tags, templates }))` → `page.reload()`。旧形式 `wdyd:activities:v1` からの移行もこれで試せる
- 一度開いたページは非表示のまま DOM に残る（Next.js 16 の Activity）。`main ul li:visible` のように `:visible` を付ける
- `getByRole('alert')` は Next.js のルートアナウンサーにも当たるので、`p[role=alert]` のように絞る
- ダイアログは `page.locator('dialog[open]')` で取る
- `fullPage: true` のスクリーンショットでは固定のタブバーが途中に写るが、実際の画面では下に固定されている
- ダークモードは `colorScheme: 'dark'` のコンテキストで確かめる

## 通知のテスト

ヘッドレスの Chromium は `Notification.permission` が `denied` 固定で、許可できない。アプリ側の処理を確かめるには差し替える:

```js
await ctx.addInitScript(() => {
  Object.defineProperty(Notification, 'permission', { get: () => 'granted' }); // 案内バナーは 'default'
  const shown = JSON.parse(sessionStorage.getItem('__shown') ?? '[]');
  ServiceWorkerRegistration.prototype.showNotification = async function (title, opts) {
    shown.push(`${title} | ${opts.body} | ${opts.tag}`);
    sessionStorage.setItem('__shown', JSON.stringify(shown));
  };
});
```

Web Push の実際の配信（通知サービス経由で端末に届くこと）はここでは確かめられない。実機での確認が必要だと報告する。

## Supabase の通信を模倣する

本物の Supabase に接続できないので、偽の URL でビルドし、ブラウザの通信を横取りして応答する:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://fake-supabase.test NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npm run build
```

```js
await ctx.route('http://fake-supabase.test/**', handle);   // GoTrue と PostgREST を模倣
await ctx.routeWebSocket(/fake-supabase/, () => {});       // Realtime は接続だけ受ける
```

`handle` で扱うもの:
- `OPTIONS` → 204（CORS ヘッダー付き）
- `POST /auth/v1/token` → `{ access_token: <JWT 風>, token_type, expires_in, expires_at, refresh_token, user }`。パスワード違いは 400 と `{ code: 'invalid_credentials' }`
- `GET /rest/v1/<table>` → `offset` / `limit` に従って配列を返す（日時は `+00:00` 形式にすると本物に近い）
- `POST /rest/v1/<table>`（upsert）→ 201、`DELETE ...?id=in.(...)` → 204
- `Authorization: Bearer <JWT>` が付いているかも確かめる

これでログイン・取り込み・開始/終了/削除の送信・他端末の変更の反映（`visibilitychange` を発火）・ログアウトまで通しで確かめられる。確かめ終わったら、接続情報なしでビルドし直して、ブラウザ内保存モードが壊れていないことも確認する。

## API（Route Handler）の確認

`/api/push/dispatch` は curl で応答を確かめる。環境変数なしで 503（`missing` の一覧）、合言葉違いで 401、正しい合言葉で DB に届かなければ 500。
