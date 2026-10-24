# かんたん家系図

クリックだけで家系図を作れるWebアプリ。入力した情報はブラウザの localStorage にのみ保存し、サーバーへは一切送信しない。

## 機能

- 人物をクリック → 「＋親」「＋配偶者」「＋子」「＋兄弟姉妹」で関係者を追加
- 再婚・離別（点線表示）、旧姓、没年不明の故人に対応
- 西暦 / 和暦の表示切り替え、満年齢・没年齢の表示
- 続柄表示：基準の人を選ぶと「義父」「夫の伯母」「夫のいとこ」のように全員の続柄を表示（`src/lib/kinship.ts`）
- 呼び名・ひとことをカードに表示
- 世帯：一緒に暮らしている単位を色で表示し、凡例クリックでその世帯だけ強調
- 自動レイアウト：兄弟姉妹は年長順、婚姻で入った人は配偶者の外側に配置。カードは横方向にドラッグで微調整でき、「レイアウトをリセット」で自動配置に戻せる
- 編集画面から親の組み合わせを付け替え
- PNG 画像で書き出し
- JSON でのバックアップ・読み込み（読み込み時に参照整合性・循環チェック）

## プライバシー

- データは localStorage のみに保存
- 本番ビルドでは CSP（`connect-src 'none'` / `form-action 'none'`）を `index.html` に埋め込み、外部への通信をブラウザレベルで禁止している（`vite.config.ts`）

## 使い方

```bash
npm install
npm run dev      # 開発サーバー
npm run build    # プロダクションビルド
npm run preview  # ビルド結果の確認（CSP 有効）
```

## データモデル

人物同士を直接つながず、間に「夫婦ノード（Union）」を挟む。GEDCOM の FAM と同じ考え方で、再婚は Union が2つになるだけで表現できる。

```
Person ──partner──▶ Union ──child──▶ Person
```

## 技術スタック

| 用途 | ライブラリ |
|---|---|
| UI フレームワーク | React 19 + TypeScript |
| 描画 | @xyflow/react (React Flow v12) |
| 自動レイアウト | elkjs（layered、遅延読み込み） |
| 画像書き出し | html-to-image |
| スタイリング | Tailwind CSS v4 |
| ビルドツール | Vite |

## ディレクトリ構成

```
src/
├── types.ts                  # Person / Union / FamilyTree
├── App.tsx                   # ホーム ↔ エディタ
├── lib/
│   ├── storage.ts            # localStorage CRUD
│   ├── treeOps.ts            # 関係の追加・削除などの純粋関数
│   ├── layout.ts             # ELK レイアウト
│   ├── dateFormat.ts         # 日付検証・和暦・年齢
│   ├── kinship.ts            # 続柄の判定
│   ├── transfer.ts           # JSON 入出力とバリデーション
│   └── imageExport.ts        # PNG 書き出し
└── components/
    ├── HomeScreen.tsx        # 家系図一覧・新規作成
    ├── TreeEditor.tsx        # メインエディタ
    ├── PersonNode.tsx        # 人物ノード（選択時ツールバー）
    ├── UnionNode.tsx         # 夫婦ノード
    ├── FamilyEdge.tsx        # 直角の家系図線
    ├── PersonModal.tsx       # 人物の追加・編集
    ├── UnionModal.tsx        # 婚姻 / 離別の切り替え
    ├── HouseholdPanel.tsx    # 世帯の凡例・強調
    └── HouseholdModal.tsx    # 世帯の編集（構成員の一括選択）
```
