---
layout: page
title: "API 接口文档"
permalink: /docs/api/
toc: true
---

本文档说明"文档管理系统"的架构、接口和使用方式。

---

## 架构概览

```
┌──────────────────────────┐      GitHub API        ┌──────────────────────────┐
│  stan-fuls.github.io     │  ◄──────────────────►   │  stan-fuls/obsidian-knowledge-docs │
│  (Web 前端 + 服务)         │   fetch/contents       │  (文档存储仓库)             │
│                          │   fetch/file            │                          │
│  • 博客展示               │                         │  • Markdown 文件           │
│  • 文档浏览               │                         │  • YAML Frontmatter       │
│  • API 入口               │                         │  • 图片等静态资源            │
└──────────────────────────┘                         └──────────────────────────┘
```

两个仓库分工明确：**当前仓库**负责页面渲染与服务逻辑，**文档仓库**负责 Markdown 文档的版本化存储。

---

## 文档仓库规范

### 仓库结构要求

文档仓库 `stan-fuls/obsidian-knowledge-docs` 的结构如下：

```
obsidian-knowledge-docs/
├── README.md              # 仓库说明
├── database/
│   ├── mysql-guide.md     # 文档：MySQL 指南
│   └── redis-guide.md     # 文档：Redis 指南
├── backend/
│   ├── go-basics.md
│   └── python-tips.md
└── devops/
    └── docker-basics.md
```

### 文档格式要求

每个 `.md` 文件需遵循以下格式：

```markdown
---
title: "文档标题"
date: 2026-01-01
category: "后端开发"
tags: ["Go", "并发", "goroutine"]
description: "文档简述，用于列表展示"
author: "Stam"
---

## 正文内容

文档正文使用标准 Markdown 语法...
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 否 | 文档标题，未填则使用文件名 |
| `date` | 否 | 文档日期 |
| `category` | 否 | 分类，用于筛选 |
| `tags` | 否 | 标签数组，格式 `["tag1", "tag2"]` |
| `description` | 否 | 简要描述，显示在卡片中 |
| `author` | 否 | 作者 |

---

## 前端 API（JavaScript 模块）

以下是 `assets/js/docs.js` 暴露的可用接口：

### 全局对象

#### `window.DocsApp` — 文档应用控制器

<script>
var docsApp = window.DocsApp;
</script>

### 接口列表

#### 1. 获取文档仓库目录

```javascript
// 通过 GitHub API 获取文档仓库根目录的文件列表
DocsGitHubAPI.fetchContents(path)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `path` | `string` | 目录路径，空字符串表示根目录 |
| **返回值** | `Promise<Array>` | GitHub API 文件/目录列表 |

#### 2. 获取单个文档内容

```javascript
// 获取指定 Markdown 文件的内容（自动 base64 解码）
DocsGitHubAPI.fetchFile(filePath)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | 文件完整路径（如 `database/mysql-guide.md`） |
| **返回值** | `Promise<Object>` | 文件对象，含 `decodedContent`, `sha`, `name`, `size` 等 |

#### 3. 解析 Frontmatter

```javascript
// 解析 Markdown 中的 YAML Frontmatter
DocsGitHubAPI.parseFrontmatter(content)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `content` | `string` | 原始 Markdown 文本 |
| **返回值** | `{ meta: Object, body: string }` | 元数据与正文分离 |

#### 4. Markdown 渲染

```javascript
// 轻量级 Markdown 转 HTML
MD.render(markdownText)
```

#### 5. 搜索文档

```javascript
// App 级搜索，修改搜索框文本自动触发
DocsApp.filterDocs()
```

#### 6. 打开文档详情

```javascript
// 在弹窗中展示文档完整内容
DocsApp.openDocument(filePath)
```

---

## GitHub REST API 接口

前端模块通过以下 GitHub API 端点获取数据：

### 获取目录内容

```
GET https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}
```

**Headers:**
```
Accept: application/vnd.github.v3+json
Authorization: token {GITHUB_TOKEN}   // 可选，提升频率限制
```

**响应示例:**
```json
[
  {
    "name": "mysql-guide.md",
    "path": "database/mysql-guide.md",
    "type": "file",
    "size": 2456,
    "sha": "abc123..."
  },
  {
    "name": "database",
    "path": "database",
    "type": "dir"
  }
]
```

### 获取文件内容

```
GET https://api.github.com/repos/{owner}/{repo}/contents/{filePath}?ref={branch}
```

**响应示例:**
```json
{
  "name": "mysql-guide.md",
  "path": "database/mysql-guide.md",
  "content": "IyBNeVNRTCDmjIfljZcK...",
  "encoding": "base64",
  "size": 2456,
  "sha": "abc123..."
}
```

---

## GitHub Token 配置（私有库必备）

> ⚠️ 由于 `obsidian-knowledge-docs` 为私有仓库，**必须**配置 Token 才能拉取文档。

1. 访问 [GitHub Settings → Tokens](https://github.com/settings/tokens) 创建 Fine-grained token
2. 权限范围选择 **Only select repositories** → 仅授权 `stan-fuls/obsidian-knowledge-docs`
3. Repository permissions 设为 `Contents: Read-only`
4. 将生成的 Token 填入 `_config.yml` 的 `docs_repo.token` 字段

---

## 部署说明

### 文档仓库初始化

```bash
# 1. 创建文档仓库
#    在 GitHub 上创建新仓库: stan-fuls/obsidian-knowledge-docs

# 2. 克隆并添加示例文档
git clone https://github.com/stan-fuls/obsidian-knowledge-docs.git
cd obsidian-knowledge-docs

# 3. 创建分类目录和文档
mkdir -p database backend devops

cat > database/mysql-guide.md << 'EOF'
---
title: "MySQL 实战指南"
date: 2026-01-01
category: "数据库"
tags: ["MySQL", "SQL", "数据库"]
description: "MySQL 使用技巧与最佳实践"
---

# MySQL 实战指南

## 索引优化

### B+Tree 索引
...
EOF

git add . && git commit -m "docs: add sample documents"
git push
```

### Web 站点部署

```bash
# 1. 安装 Ruby + Bundler
gem install bundler

# 2. 安装依赖
cd stan-fuls.github.io
bundle install

# 3. 本地预览
bundle exec jekyll serve

# 4. 推送到 GitHub 自动部署
git add . && git commit -m "deploy: update site"
git push
```

推送后，GitHub Pages 会自动构建并部署到 `https://stan-fuls.github.io`。

---

## 扩展建议

- **全文搜索**：集成 Lunr.js 实现离线搜索
- **文档版本**：利用 GitHub 分支/标签管理文档版本
- **Webhook**：文档仓库更新时触发 Pages 重新构建
- **评论**：集成 Gitalk/Utterances 基于 GitHub Issues 的评论系统
