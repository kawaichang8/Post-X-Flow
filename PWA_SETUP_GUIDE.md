# PWA（Progressive Web App）セットアップガイド

Post-X-FlowのPWA対応機能の実装内容と使用方法を説明します。

## 実装内容

### 1. PWA基本機能

- **manifest.json**: アプリのメタデータとインストール情報
- **Service Worker**: オフライン対応とキャッシュ管理
- **PWAインストールプロンプト**: ユーザーにアプリインストールを促す
- **オフライン下書き保存**: IndexedDBを使用したオフライン対応

### 2. オフライン機能

- **IndexedDB**: オフライン時の下書き保存
- **自動同期**: オンライン復帰時に自動的にサーバーに同期
- **オフラインインジケーター**: オフライン状態を表示

## セットアップ手順

### 1. アイコン画像の準備

PWAアイコンを準備して`public/`ディレクトリに配置してください：

- `public/icon-192x192.png` (192x192ピクセル)
- `public/icon-512x512.png` (512x512ピクセル)

**アイコン作成方法**:
- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)を使用
- または、デザインツールで作成

**推奨サイズ**:
- 192x192px: 最小サイズ
- 512x512px: 高解像度デバイス用

### 2. 依存関係のインストール

```bash
npm install --legacy-peer-deps
```

`workbox-window`が自動的にインストールされます。

### 3. Service Workerの登録

Service Workerは`app/layout.tsx`で自動的に登録されます。

### 4. ビルドとデプロイ

```bash
npm run build
npm run start
```

または、Vercelにデプロイ:

```bash
git add .
git commit -m "feat: PWA対応を追加"
git push origin main
```

## 使用方法

### アプリのインストール

1. **モバイル（Android）**:
   - Chromeでアプリを開く
   - メニュー → 「ホーム画面に追加」
   - または、インストールプロンプトが表示されたら「インストール」をタップ

2. **モバイル（iOS Safari）**:
   - Safariでアプリを開く
   - 共有ボタン → 「ホーム画面に追加」

3. **デスクトップ（Chrome/Edge）**:
   - アドレスバーのインストールアイコンをクリック
   - または、インストールプロンプトが表示されたら「インストール」をクリック

### オフライン下書きの使用

1. **オフライン時に下書きを作成**:
   - インターネット接続がない状態でツイートを生成
   - 下書きは自動的にIndexedDBに保存されます

2. **オフライン下書きの確認**:
   - ダッシュボードで「下書き」タブを開く
   - 「オフライン下書き」セクションで確認

3. **オンライン復帰時の自動同期**:
   - インターネット接続が復帰すると、自動的にサーバーに同期されます
   - 同期完了時に通知が表示されます

## 技術的な実装

### manifest.json

```json
{
  "name": "Post-X-Flow",
  "short_name": "Post-X-Flow",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "icons": [...]
}
```

### Service Worker (sw.js)

- **キャッシュ戦略**: ネットワーク優先、フォールバックでキャッシュ
- **オフラインページ**: `/offline`ページを表示
- **バックグラウンド同期**: オフライン時の下書きを自動同期

### IndexedDB

- **データベース名**: `post-x-flow-drafts`
- **ストア名**: `drafts`
- **スキーマ**: `OfflineDraft`インターフェース

## ファイル構成

```
freexboost/
├── public/
│   ├── manifest.json          # PWAマニフェスト
│   ├── sw.js                   # Service Worker
│   ├── icon-192x192.png        # アイコン（要作成）
│   └── icon-512x512.png        # アイコン（要作成）
├── app/
│   ├── layout.tsx              # PWA設定とService Worker登録
│   └── offline/
│       └── page.tsx            # オフラインページ
├── components/
│   ├── PWAInstallPrompt.tsx   # インストールプロンプト
│   ├── OfflineIndicator.tsx   # オフラインインジケーター
│   └── OfflineDraftsPanel.tsx # オフライン下書きパネル
└── lib/
    ├── pwa-installer.ts        # PWAインストール機能
    └── offline-draft-manager.ts # オフライン下書き管理
```

## 期待される効果

### ユーザー体験の向上

- **オフライン対応**: インターネット接続がなくても下書きを作成可能
- **アプリのような体験**: ホーム画面に追加して、ネイティブアプリのように使用
- **高速読み込み**: Service Workerによるキャッシュで高速化

### モバイルユーザー向けの利便性

- **外出時の利用**: オフラインでも下書きを作成・保存
- **データ使用量の削減**: キャッシュによりデータ使用量を削減
- **プッシュ通知対応**: 将来的にプッシュ通知を追加可能

## 注意事項

1. **HTTPS必須**: PWAはHTTPS（またはlocalhost）でのみ動作します
2. **アイコン画像**: アイコン画像を準備する必要があります
3. **Service Workerの更新**: Service Workerを更新する場合は、キャッシュをクリアする必要がある場合があります

## トラブルシューティング

### Service Workerが登録されない

- HTTPSでアクセスしているか確認
- ブラウザの開発者ツール → Application → Service Workersで確認
- キャッシュをクリアして再試行

### オフライン下書きが表示されない

- ブラウザの開発者ツール → Application → IndexedDBで確認
- IndexedDBがサポートされているか確認

### インストールプロンプトが表示されない

- PWAのインストール要件を満たしているか確認
- すでにインストール済みの場合は表示されません
- ブラウザがPWAをサポートしているか確認

## 今後の拡張

- プッシュ通知機能
- バックグラウンド同期の強化
- オフライン時の機能拡張
- アプリ更新の通知

## 参考資料

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Next.js PWA Guide](https://nextjs.org/docs/app/building-your-application/configuring/progressive-web-apps)
