@AGENTS.md

# プロジェクトのガイド

個人用の作業記録Webアプリ。仕様は `docs/requirements.md`、設計は `docs/architecture.md`、進捗は `docs/roadmap.md` を正とする。

## 開発ルール
- 1つのマイルストーン・Issueを小さく実装し、そのたびにコミットする
- 時間計算・集計・タグの木などのロジックは `src/lib/domain/` に純粋関数として置き、Vitest のテストを必ず書く
- 経過時間はカウンタで数えず、`startedAt` と現在時刻から計算する
- 日時の保存はUTC、表示は端末のタイムゾーン
- UIの文言は日本語
- 仕様を変えたら `docs/` も更新する

## コミット前に確認すること
```bash
npm test && npm run lint && npm run typecheck
```
