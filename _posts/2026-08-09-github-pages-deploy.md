---
title: "GitHub Pages + Jekyll 部署指南"
date: 2026-08-09
categories: 技术
tags:
  - GitHub Pages
  - Jekyll
  - 部署
  - 教程
toc: true
---

## 概述

GitHub Pages 是 GitHub 提供的免费静态站点托管服务，配合 Jekyll 可以快速搭建个人博客。本文记录从零搭建的全过程。

## 环境准备

### 1. 安装 Ruby 和 Jekyll

macOS 默认已预装 Ruby，可以直接安装 Jekyll：

```bash
gem install bundler jekyll
```

### 2. 创建站点

```bash
jekyll new my-blog
cd my-blog
bundle install
bundle exec jekyll serve
```

访问 `http://localhost:4000` 即可看到初始页面。

## 目录结构

```
├── _config.yml      # 站点配置
├── _posts/          # 文章（Markdown）
├── _layouts/        # 布局模板
├── _includes/       # 可复用组件
├── _data/           # 数据文件
├── assets/          # 静态资源（CSS/JS/图片）
├── _site/           # 构建输出（自动生成）
└── Gemfile          # Ruby 依赖
```

## 部署到 GitHub Pages

### 仓库命名

GitHub Pages 对于个人/组织站点，要求仓库名为 `<username>.github.io`。

例如本项目：`stan-fuls.github.io`。

### 发布流程

1. `git push` 到仓库的 `master` 分支（或配置的部署分支）
2. GitHub 自动触发 Jekyll 构建
3. 构建完成后，站点即发布到 `https://stan-fuls.github.io`

### GitHub Actions（可选）

如果需要自定义构建流程，可以创建 `.github/workflows/jekyll.yml`：

```yaml
name: Deploy Jekyll Site

on:
  push:
    branches: [master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
      - run: bundle install
      - run: bundle exec jekyll build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: {% raw %}${{ secrets.GITHUB_TOKEN }}{% endraw %}
          publish_dir: ./_site
```

## 常见问题

### 样式不加载

检查 `_config.yml` 中 `baseurl` 和 `url` 是否正确：

```yaml
url: "https://stan-fuls.github.io"
baseurl: ""
```

### 页面 404

确认页面文件包含正确的 `permalink`：

```yaml
---
layout: page
permalink: /about/
---
```

## 总结

GitHub Pages + Jekyll 的组合让个人博客搭建变得非常简单。核心流程：写 Markdown → git push → 自动构建部署。无需服务器、无需域名、零成本运维。

下一篇将介绍如何接入外部文档仓库，实现文档与博客的分离管理。
