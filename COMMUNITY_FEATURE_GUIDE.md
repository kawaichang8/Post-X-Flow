# コミュニティ共有機能ガイド

Post-X-Flowのコミュニティ共有機能の実装内容と使用方法を説明します。

## 実装内容

### 1. 承認済みツイートのテンプレート化

投稿済みのツイートをテンプレートとして共有できる機能を追加しました。

**機能**:
- 投稿済みツイートをテンプレートとして共有
- タイトル、説明、カテゴリ、タグを設定
- 匿名共有オプション
- モデレーション承認制（初期状態は未承認）

**使用方法**:
1. 投稿履歴から投稿済みツイートを選択
2. 「共有」ボタンをクリック
3. タイトル、説明、カテゴリ、タグを入力
4. 匿名オプションを選択（オプション）
5. 「共有する」ボタンをクリック

### 2. Supabase経由でユーザー間共有

Supabaseの公開テーブルを使用して、ユーザー間でテンプレートを共有します。

**機能**:
- 承認済みテンプレートの一覧表示
- 検索・フィルタ機能（カテゴリ、タグ、キーワード）
- ソート機能（新着順、人気順、エンゲージメント順、使用回数順）
- いいね機能
- 使用回数・閲覧回数の追跡

**データベーステーブル**:
- `community_templates`: 共有テンプレート
- `template_likes`: いいね情報
- `user_suggestions`: ユーザー提案

### 3. GitHub Issuesでユーザー提案集め

ユーザーの提案やフィードバックをGitHub Issuesに自動送信する機能を追加しました。

**機能**:
- 提案フォームからGitHub Issuesに自動送信
- カテゴリ分類（新機能、改善、バグ報告、UI/UX、その他）
- 匿名送信オプション
- Issue URLの表示

**設定**:
環境変数に以下を設定:
```env
GITHUB_REPO=username/repo-name
GITHUB_TOKEN=your_github_token
```

## 使用方法

### テンプレートを共有する

1. **ダッシュボード**で「履歴」タブを開く
2. **投稿済みツイート**を選択
3. **「共有」ボタン**をクリック
4. **共有フォーム**に入力:
   - タイトル（必須）
   - 説明（オプション）
   - カテゴリ（オプション）
   - タグ（オプション）
   - 匿名オプション
5. **「共有する」ボタン**をクリック

### テンプレートを閲覧・使用する

1. **ダッシュボード**で「コミュニティ」タブを開く
2. **検索・フィルタ**でテンプレートを検索
3. **テンプレートカード**から:
   - 「使用」ボタンでテンプレートをドラフトに追加
   - ハートアイコンでいいね
   - 詳細を確認

### 機能提案を送信する

1. **ダッシュボード**で「コミュニティ」タブを開く
2. **「機能提案・フィードバック」セクション**を開く
3. **提案フォーム**に入力:
   - タイトル（必須）
   - 説明（必須）
   - カテゴリ（必須）
   - 匿名オプション
4. **「GitHub Issuesに送信」ボタン**をクリック
5. **Issue URL**が表示されるので、進捗を確認可能

## 技術的な実装

### データベーススキーマ

#### `community_templates` テーブル

```sql
CREATE TABLE community_templates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  hashtags TEXT[],
  trend TEXT,
  purpose TEXT,
  format_type TEXT,
  naturalness_score INTEGER,
  engagement_score INTEGER,
  is_anonymous BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  category TEXT,
  tags TEXT[],
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### `template_likes` テーブル

```sql
CREATE TABLE template_likes (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES community_templates(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP,
  UNIQUE(template_id, user_id)
);
```

#### `user_suggestions` テーブル

```sql
CREATE TABLE user_suggestions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'pending',
  github_issue_url TEXT,
  github_issue_number INTEGER,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Row Level Security (RLS)

- **承認済みテンプレート**: 誰でも閲覧可能
- **自分のテンプレート**: 承認前でも閲覧可能
- **いいね**: 誰でも閲覧可能、自分のみ追加/削除可能
- **提案**: 自分の提案のみ閲覧可能、誰でも追加可能

### API

#### `app/actions-community.ts`

- `shareTemplateAsCommunity`: テンプレートを共有
- `getCommunityTemplates`: テンプレート一覧を取得（検索・フィルタ対応）
- `useTemplate`: テンプレートを使用（閲覧数・使用回数を増やす）
- `toggleTemplateLike`: いいね/いいね解除
- `submitUserSuggestion`: ユーザー提案をGitHub Issuesに送信
- `getUserSharedTemplates`: ユーザーが共有したテンプレート一覧
- `deleteTemplate`: テンプレートを削除

### UIコンポーネント

#### `components/CommunityTemplates.tsx`

- テンプレート一覧表示
- 検索・フィルタ機能
- いいね機能
- テンプレート使用機能

#### `components/ShareTemplateModal.tsx`

- テンプレート共有フォーム
- プレビュー表示
- 匿名オプション

#### `components/UserSuggestionForm.tsx`

- 機能提案フォーム
- GitHub Issues送信
- 送信結果表示

## セットアップ手順

### 1. データベースマイグレーション

Supabase SQL Editorで以下を実行:

```sql
-- supabase-community-templates.sql の内容を実行
```

### 2. 環境変数の設定

Vercel Dashboardまたは`.env.local`に以下を追加:

```env
# GitHub Issues連携（オプション）
GITHUB_REPO=your-username/your-repo
GITHUB_TOKEN=your_github_personal_access_token
```

**GitHub Tokenの取得方法**:
1. GitHub → Settings → Developer settings → Personal access tokens
2. "Generate new token" をクリック
3. スコープ: `repo` を選択
4. トークンを生成してコピー

### 3. モデレーション（オプション）

テンプレートは初期状態で`is_approved = false`です。承認するには:

```sql
-- 特定のテンプレートを承認
UPDATE community_templates
SET is_approved = true
WHERE id = 'template-id';

-- または、自動承認（開発環境のみ推奨）
UPDATE community_templates
SET is_approved = true
WHERE is_approved = false;
```

## 期待される効果

### ユーザーコミュニティの成長

- **テンプレート共有**: ユーザー間で高品質なツイートテンプレートを共有
- **エンゲージメント向上**: コミュニティ機能でユーザー同士の交流が促進
- **リテンション向上**: コミュニティ参加でアプリへの愛着が向上

### 売り出し時のエンゲージメント向上

- **ユーザー生成コンテンツ**: コミュニティで生成されたテンプレートが価値提供
- **口コミ効果**: 共有機能で自然な拡散
- **フィードバック収集**: GitHub Issuesで継続的な改善

## 注意事項

1. **モデレーション**: 不適切なコンテンツを削除する仕組みを用意
2. **プライバシー**: 匿名オプションを推奨
3. **API制限**: GitHub APIのレート制限に注意
4. **スパム対策**: 使用回数やいいね数でスパムを検出

## 今後の拡張

- テンプレートの評価・レビュー機能
- テンプレートのバージョン管理
- テンプレートのフォーク機能
- コミュニティランキング
- テンプレート作成者への報酬システム

## 参考資料

- [Post-X-Flow README](./README.md)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [GitHub Issues API](https://docs.github.com/en/rest/issues/issues)
