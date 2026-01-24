# PWAアイコンの準備

PWAアイコンを準備して、以下のファイルを`public/`ディレクトリに配置してください：

- `public/icon-192x192.png` (192x192ピクセル)
- `public/icon-512x512.png` (512x512ピクセル)

## アイコン作成方法

### 方法1: PWA Asset Generatorを使用

```bash
npx pwa-asset-generator logo.png public --icon-only
```

### 方法2: オンラインツールを使用

- [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)

### 方法3: デザインツールで作成

- Figma、Adobe Illustrator、Canvaなどで作成
- 背景は透明または単色
- 角丸は推奨（iOS用）

## アイコンの要件

- **形式**: PNG
- **サイズ**: 192x192px、512x512px
- **背景**: 透明または単色（推奨: 白または黒）
- **内容**: Post-X-Flowのロゴまたはアイコン

## 一時的な解決策

開発中は、以下のコマンドでプレースホルダーアイコンを生成できます：

```bash
# ImageMagickを使用
convert -size 192x192 xc:blue public/icon-192x192.png
convert -size 512x512 xc:blue public/icon-512x512.png
```

または、オンラインでプレースホルダーを生成：
- [Placeholder.com](https://via.placeholder.com/192x192)
- [DummyImage](https://dummyimage.com/192x192/000/fff.png&text=Post-X-Flow)
