---
permalink: /docs/knowledge-docs/intro/
title: 入门：为什么选择 Jekyll
description: 从需求出发，了解用 Jekyll + GitHub Pages 构建个人/团队知识库的优势与适用场景。
category: 文档站教程
tags:
  - 示例
  - Jekyll
author: Stam
date: 2026-08-14 20:00:00
toc: "true"
layout: doc
---

## 概述

本系列示例文档演示如何用 **Jekyll + GitHub Pages** 搭建一个轻量、免费、可版本化的文档站。你正在阅读的这个页面，本身就是用它生成的。

借助 Jekyll，你只需要写 Markdown，其余的构建、路由、部署都由工具完成。配合 Obsidian + Templater 写作，再推送到 GitHub，即可拥有一个带目录、章节导航与评论能力的知识库。

## 核心内容

### 适合谁用

- **个人知识沉淀**：把零散笔记整理成可检索、可分享的站点。
- **团队文档中心**：多人协作，变更走 PR 评审，历史可追溯。
- **技术博客 / 教程**：写作即发布，无需数据库与后台。

### 为什么不用重型方案

| 方案 | 上手成本 |  hosting 成本 | 版本管理 | 适合场景 |
| --- | --- | --- | --- | --- |
| Jekyll + GH Pages | 低 | 免费 | Git 原生 | 文档 / 博客 |
| 商业 Wiki | 中 | 订阅制 | 弱 | 企业内网 |
| 自建 CMS | 高 | 服务器费用 | 插件依赖 | 复杂站点 |

> 💡 如果你的内容以文字为主、更新频繁、需要版本控制，Jekyll 通常是最省心的选择。

### 一个最小示例

下面是一段典型的 Front Matter，它决定了页面的标题、链接与布局：

```yaml
---
permalink: /docs/knowledge-docs/intro/
title: 入门：为什么选择 Jekyll
layout: doc
---
```

## 小结

读完这一章，你应该对"为什么用 Jekyll 做文档站"有了整体认识。下一章将深入到**项目结构与 Front Matter**，看看一篇文档是如何被组织起来的。
