---
permalink: /docs/knowledge-docs/navigation/
title: 章节导航与自定义样式
description: 为文档页添加"上一章 / 下一章"导航，并统一视觉风格。
category: 文档站教程
tags:
  - 示例
  - Jekyll
author: Stam
date: 2026-08-14 21:00:00
toc: "true"
layout: doc
---

## 概述

长文档最怕"读了下一篇找不到上一篇"。本章实操：在正文结束后插入**上一章 / 下一章**两个链接，并用 CSS 统一样式。

> 你当前看到的这页，正文下方就有一组可点击的章节导航——它正是本章要讲的效果。

## 核心内容

### 用数据文件定义章节顺序

在 `_data/docs_nav.yml` 中，按阅读顺序列出每一章：

```yaml
- title: 入门：为什么选择 Jekyll
  url: /docs/knowledge-docs/intro/
- title: 项目结构与 Front Matter
  url: /docs/knowledge-docs/structure/
- title: 章节导航与自定义样式
  url: /docs/knowledge-docs/navigation/
```

顺序即导航顺序，新增或调整章节只需改这个文件，无需动其他代码。

### 渲染导航的片段

在 `_layouts/doc.html` 的正文 `{{ content }}` 之后，引入一个可复用片段：

```liquid
{% include doc_prev_next.html %}
```

该片段会读取 `docs_nav.yml`，根据当前 `page.url` 定位章节，自动输出上一章 / 下一章；位于首尾时则显示禁用态。

### 统一视觉风格

导航样式写在 `assets/css/custom.css`，沿用主题变量（`--color-primary` 等），保证与全站一致：

```css
.doc-prevnext { display: flex; gap: 16px; margin: 36px 0 8px; }
.doc-prevnext-link { flex: 1; padding: 14px 18px; border-radius: var(--radius); }
.doc-prevnext-link:hover { border-color: var(--color-primary); color: var(--color-primary); }
```

### 验证清单

- [x] 三篇示例文档已就位
- [x] `docs_nav.yml` 顺序正确
- [x] 移动端导航自动纵向堆叠
- [ ] 本地 `bundle exec jekyll serve` 自测通过

## 小结

至此，你拥有了一个带目录、章节导航与统一风格的文档站雏形。接下来可以填充真实内容、接入评论，或把它同步进 Obsidian 继续写作。
