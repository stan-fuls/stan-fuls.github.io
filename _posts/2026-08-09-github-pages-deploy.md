---
layout: post
title: "GitHub Pages 部署与自定义域名配置"
date: 2026-08-09
categories: [技术, DevOps]
tags: [github pages, jekyll, 部署, 自定义域名]
toc: true
---

GitHub Pages 是一个免费的静态网站托管服务，非常适合个人博客、项目文档和知识库的搭建。

## 基本原理

GitHub Pages 直接从 GitHub 仓库托管静态网站。推送 HTML、CSS 和 JavaScript 文件后，网站会自动构建和部署。

### 仓库命名规则

- **用户/组织站点**：`<username>.github.io`
- **项目站点**：任意仓库名，通过 `gh-pages` 分支或 `/docs` 目录部署

本站使用的就是用户站点方式：`stan-fuls.github.io`

## 部署步骤

1. 创建名为 `<username>.github.io` 的仓库
2. 推送 Jekyll 项目到 `master` 或 `main` 分支
3. GitHub 自动运行 Jekyll 构建
4. 几分钟后，站点在 `https://<username>.github.io` 上线

## 自定义域名

如果需要绑定自己的域名：

1. 在仓库根目录创建 `CNAME` 文件，写入域名
2. 在域名 DNS 中添加 CNAME 记录，指向 `<username>.github.io`
3. 在仓库 Settings → Pages 中确认自定义域名

## 注意事项

- GitHub Pages 支持的 Jekyll 插件有限，需要确认插件兼容性
- 构建过程有资源限制
- 站点内容是公开的（除非使用付费方案）
