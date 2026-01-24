# PWAデプロイ手順

Post-X-FlowのPWA機能をデプロイする手順を説明します。

## デプロイ前の準備

### 1. アイコン画像の準備

PWAアイコンを準備して`public/`ディレクトリに配置してください：

```bash
# アイコン画像を配置
public/icon-192x192.png  # 192x192ピクセル
public/icon-512x512.png  # 512x512ピクセル
```

**アイコン作成方法**:
- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)を使用
- または、デザインツールで作成

### 2. 依存関係のインストール

```bash
npm install --legacy-peer-deps
```

### 3. ビルドテスト

```bash
npm run build
```

エラーがないことを確認してください。

## Vercelへのデプロイ

### 1. 変更をコミット

```bash
git add .
git commit -m "feat: PWA対応を追加（manifest.json、Service Worker、オフライン下書き保存）"
git push origin main
```

### 2. Vercelでの自動デプロイ

VercelはGitHubリポジトリと連携している場合、自動的にデプロイが開始されます。

### 3. デプロイ後の確認

1. **HTTPSでアクセス**: PWAはHTTPSでのみ動作します
2. **Service Workerの確認**: ブラウザの開発者ツール → Application → Service Workers
3. **manifest.jsonの確認**: ブラウザの開発者ツール → Application → Manifest
4. **インストールプロンプト**: モバイルデバイスでアクセスして、インストールプロンプトが表示されるか確認

## ローカル開発環境でのテスト

### 1. 開発サーバーの起動

```bash
npm run dev
```

### 2. Service Workerのテスト

1. ブラウザで `http://localhost:3000` にアクセス
2. 開発者ツール → Application → Service Workers
3. Service Workerが登録されているか確認

### 3. オフライン機能のテスト

1. 開発者ツール → Network → Offline を有効化
2. ツイートを生成
3. 下書きがIndexedDBに保存されることを確認
4. Network → Offline を無効化
5. 下書きが自動的に同期されることを確認

## トラブルシューティング

### Service Workerが登録されない

**原因**: HTTPSでアクセスしていない、またはService Workerのパスが間違っている

**解決方法**:
- 本番環境ではHTTPSでアクセス
- `public/sw.js`が正しく配置されているか確認
- ブラウザのキャッシュをクリア

### インストールプロンプトが表示されない

**原因**: PWAのインストール要件を満たしていない

**解決方法**:
- manifest.jsonが正しく設定されているか確認
- アイコン画像が正しく配置されているか確認
- すでにインストール済みの場合は表示されません

### オフライン下書きが保存されない

**原因**: IndexedDBがサポートされていない、またはエラーが発生している

**解決方法**:
- ブラウザの開発者ツール → Application → IndexedDBで確認
- コンソールでエラーを確認
- ブラウザがIndexedDBをサポートしているか確認

## 参考資料

- [PWA_SETUP_GUIDE.md](./PWA_SETUP_GUIDE.md) - 詳細なセットアップガイド
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
