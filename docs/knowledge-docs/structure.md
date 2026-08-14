---
permalink: /docs/knowledge-docs/structure/
title: 项目结构与 Front Matter
description: 拆解文档站的关键目录与每篇文档头部的 Front Matter 字段含义。
category: 文档站教程
tags:
  - 示例
  - Jekyll
author: Stam
date: 2026-08-14 20:30:00
toc: "true"
layout: doc
---

## 概述

一篇文档之所以能被正确渲染、出现在导航里，靠的是**目录约定**和** Front Matter 字段**。本章带你逐一看清它们。

## 核心内容

### 关键目录

- `docs/knowledge-docs/`：知识库文档源文件（Markdown）存放处。
- `_layouts/doc.html`：文档页模板，决定页头、目录、正文与导航的排布。
- `_includes/`：可复用的页面片段，例如章节导航组件。
- `_data/docs_nav.yml`：定义"上一章 / 下一章"的阅读顺序。
- `assets/css/custom.css`：自定义样式，覆盖主题默认外观。

### Front Matter 字段说明

每篇文档顶部都需要一段 YAML，常见字段如下：

| 字段 | 作用 | 示例 |
| --- | --- | --- |
| `permalink` | 页面最终访问路径 | `/docs/knowledge-docs/intro/` |
| `title` | 文档标题 | `入门：为什么选择 Jekyll` |
| `description` | 摘要，用于列表与 SEO | `从需求出发……` |
| `category` | 归档分类 | `文档站教程` |
| `tags` | 标签列表 | `[示例, Jekyll]` |
| `date` | 发布时间 | `2026-08-14 20:00:00` |
| `layout` | 使用的模板 | `doc` |
| `toc` | 是否生成目录 | `"true"` |

### 写作建议

1. 标题层级保持 `## 概述 → ## 核心内容 → ### 子主题`，目录会自动生成。
2. `permalink` 建议与文件名一致，避免链接漂移。
3. 新增章节后，记得把它加入 `_data/docs_nav.yml`，否则不会出现在上一章 / 下一章里。

> ⚠️ `layout: doc` 是文档页的关键，漏写会导致页面使用默认布局、丢失目录与导航。

## 小结

理解目录与 Front Matter 后，你已经可以独立产出一篇可被站点识别的文档。下一章我们动手为文档加上**章节导航**与自定义样式。
