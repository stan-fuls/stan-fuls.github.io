---
layout: page
title: "项目架构说明"
permalink: /docs/api/
toc: true
---

本文档说明站点的架构、文档管理方式和工作流。

---

## 架构概览

```
┌────────────────────────────────────┐
│     stan-fuls.github.io            │
│  (博客 + 文档中心 · 单仓库)          │
│                                    │
│  • Jekyll 静态博客                  │
│  • docs/knowledge-docs/  知识文档   │
│  • _posts/               博客文章   │
│  • docs/_templates/      文档模板   │
│  • scripts/gen-docs-index.js 索引   │
└────────────────────────────────────┘
```

文档和博客在**同一个仓库**中，构建时 `gen-docs-index.js` 扫描 `docs/knowledge-docs/` 和 `_posts/` 目录，生成 `assets/data/docs-index.json`，前端页面通过该索引展示文档列表。

---

## 文档结构

```
docs/knowledge-docs/        ← 知识库文档（按主题分目录）
├── database/
│   ├── mysql-guide.md
│   └── redis-guide.md
├── backend/
│   ├── go-basics.md
│   └── python-tips.md
└── devops/
    └── docker-basics.md

_posts/                     ← 博客文章
├── 2026-08-10-welcome.md
└── ...

docs/_templates/
└── document.md             ← Obsidian 文档模板
```

---

## 文档格式要求

每篇 `.md` 文件需在顶部包含 YAML Frontmatter：

```markdown
---
title: "MySQL 实战指南"
date: 2026-01-01
category: "数据库"
tags:
  - MySQL
  - SQL
description: "MySQL 使用技巧与最佳实践"
author: "Stam"
---

## 正文内容
...
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 否 | 文档标题，未填则使用文件名 |
| `date` | 否 | 文档日期 `YYYY-MM-DD` |
| `category` | 否 | 分类 |
| `tags` | 否 | 标签数组，用于归档 |
| `description` | 否 | 简要描述 |
| `author` | 否 | 作者 |

---

## CI 工作流

每次 push 到 `master` 分支，GitHub Actions 自动：

1. 运行 `node scripts/gen-docs-index.js` — 扫描 `docs/knowledge-docs/` + `_posts/` 生成 `assets/data/docs-index.json`
2. 执行 `bundle exec jekyll build` — 构建站点
3. 部署到 GitHub Pages

---

## 发布流程

1. 在 Obsidian 中用 Templater 基于 `docs/_templates/document.md` 创建新笔记
2. 保存到 `docs/knowledge-docs/` 下对应目录
3. Push 到 GitHub → CI 自动构建 → 文档中心展示

---

## 扩展建议

- **全文搜索**：集成 Lunr.js 实现离线搜索
- **评论**：已集成 Giscus，基于 GitHub Discussions
