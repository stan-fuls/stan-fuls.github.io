---
layout: doc
title: "示例文档 · 文档中心使用指南"
date: 2026-08-12
description: "演示文档中心如何以站内页面的形式展示文档内容"
category: 指南
tags:
  - 示例
  - 入门
author: Stam
---

# 文档中心使用指南

这是一篇示例文档，演示如何通过 `docs/knowledge-docs/` 目录管理知识文档并直接在站内打开。

## 工作流

1. 在 Obsidian 中通过 Templater 基于 `docs/_templates/document.md` 创建新笔记
2. 保存到 `docs/knowledge-docs/<主题>/` 目录
3. Push 到 GitHub → CI 自动构建 → 文档中心以站内页面形式展示

## 示例代码块

```javascript
// scripts/gen-docs-index.js 会自动为本文档注入 layout: doc
// 让 Jekyll 直接渲染为站内页面
const path = require('path');
console.log(path.join('docs', 'knowledge-docs', 'example.md'));
```

## 列表示例

- 支持多级标题
- 支持行内代码 `like this`
- 支持有序 / 无序列表
- 支持代码块与表格

## 引用

> 文档现在就像博客文章一样，在站内打开后有：
> 标题、目录、点赞 / 评论、归档标签、面包屑导航。

## 表格

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 否 | 文档标题，未填则使用文件名 |
| `date` | 否 | 文档日期 |
| `tags` | 否 | 标签数组 |

## 下一步

- 在归档页面中，本文档会出现在 **指南** 标签分组下
- 在文档中心页面，本文档会按时间段分组（这里属于 2026 年 8 月）
- 点击后跳转到本页面（站内），而不是 GitHub blob

> 💡 提示：可以删除本文件，或者把它改成你自己想要保留的真实文档。