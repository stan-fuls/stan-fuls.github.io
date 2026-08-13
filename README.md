# Share of Stam

个人知识分享站点：**Obsidian 写作 → GitHub 托管 → Jekyll 静态展示**，托管于 GitHub Pages。

> 在线访问：[https://stan-fuls.github.io](https://stan-fuls.github.io)
> 文档中心：[https://stan-fuls.github.io/docs/](https://stan-fuls.github.io/docs/)
> 归档：[https://stan-fuls.github.io/archive/](https://stan-fuls.github.io/archive/)

---

## 目录

- [1. 技术栈与架构](#1-技术栈与架构)
- [2. 目录结构](#2-目录结构)
- [3. 部署架构（GitHub Actions CI）](#3-部署架构github-actions-ci)
- [4. 知识库文档发布流程](#4-知识库文档发布流程核心)
- [5. 博客文章发布流程](#5-博客文章发布流程)
- [6. 本地开发与预览](#6-本地开发与预览)
- [7. 注意事项（务必阅读）](#7-注意事项务必阅读)
- [8. 常见问题 FAQ](#8-常见问题-faq)

---

## 1. 技术栈与架构

| 层 | 技术 |
|----|------|
| 写作端 | Obsidian（dataview / Calendar / Templater 插件） |
| 静态站点 | Jekyll + Liquid + kramdown(GFM) |
| 文档索引 | Node.js 脚本 `scripts/gen-docs-index.js` |
| 自动化 | GitHub Actions（`deploy.yml`） |
| 托管 | GitHub Pages（master 分支） |
| 互动 | Giscus 评论 / 点赞(localStorage) / 分享 |
| 富内容 | Mermaid 图表 / MathJax 公式 |

数据流总览：

```
┌─────────────┐    push master     ┌────────────────────┐
│  Obsidian    │ ─────────────────► │ GitHub 仓库          │
│  (写作/模板)  │   docs/knowledge-  │ stan-fuls.github.io │
└─────────────┘   docs/*.md + _posts│                    │
                                     └────────┬───────────┘
                                              │ GitHub Actions 触发
                                              ▼
                        ┌─────────────────────────────────────┐
                        │ 1. node scripts/gen-docs-index.js   │
                        │    · 注入 layout:doc / permalink     │
                        │    · 生成 assets/data/docs-index.json│
                        │ 2. 提交自动注入的 frontmatter        │
                        │ 3. bundle exec jekyll build          │
                        │ 4. deploy-pages 发布到 GitHub Pages  │
                        └─────────────────────────────────────┘
                                              │
                                              ▼
                        ┌─────────────────────────────────────┐
                        │ 站点: 首页 / 文档中心 / 归档 / 文章     │
                        │ JS 实时拉取 docs-index.json 展示       │
                        └─────────────────────────────────────┘
```

---

## 2. 目录结构

| 路径 | 说明 |
|------|------|
| `_layouts/` | 页面布局（default / home / page / post / doc / archive） |
| `_includes/` | 可复用组件（header / footer / toc / 互动栏等） |
| `_posts/` | 博客文章（Markdown） |
| `_data/` | 导航、国际化等数据文件 |
| `assets/` | CSS / JS / 图片；`data/docs-index.json` 为 CI 生成的文档索引 |
| `docs/knowledge-docs/` | **知识库文档目录**（Obsidian 写作内容存放处，按主题分子目录） |
| `docs/_templates/` | Obsidian 文档模板（仅下载用途，Jekyll 不渲染） |
| `docs/index.html` | 文档中心页面 |
| `scripts/gen-docs-index.js` | CI 文档索引生成脚本 |
| `.github/workflows/deploy.yml` | GitHub Pages 自动部署流水线 |

---

## 3. 部署架构（GitHub Actions CI）

推送 `master` 分支后，[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 自动执行：

1. **生成文档索引**：`node scripts/gen-docs-index.js` 扫描 `docs/knowledge-docs/` 下所有 `.md`
   - 为缺少 `layout` / `permalink` 的文档**自动注入 frontmatter**
   - 生成 `assets/data/docs-index.json`（含标题、日期、描述、分类、标签、URL）
2. **回写注入结果**：把脚本自动注入的 frontmatter 提交回仓库（确保下次构建文件已就绪）
3. **Jekyll 构建**：`bundle exec jekyll build`（Ruby 3.2）产出静态站点到 `_site/`
4. **发布**：通过 `deploy-pages` 部署到 GitHub Pages

> GitHub Pages 部署源：Settings → Pages → **GitHub Actions**（不是"分支部署"）。

---

## 4. 知识库文档发布流程（核心）

### 第 1 步：获取模板

把 [`.docs/_templates/document.md`](docs/_templates/document.md) 保存到你的 Obsidian 库（推荐 `templates/` 目录）。

```
https://raw.githubusercontent.com/stan-fuls/stan-fuls.github.io/master/docs/_templates/document.md
```

### 第 2 步：在 Obsidian 中创建文档

- 用 Templater 插件执行模板，`{{title}}` 等占位符自动替换
- 模板已内置 **dataview** 表达式自动生成日期/时间，无需手填
- 日历插件（Calendar）读取 frontmatter 的 `date` 字段（`YYYY-MM-DD`），文档会显示在日历上

### 第 3 步：填写 Frontmatter

模板中已包含注释说明，核心字段如下：

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✅ | 文档标题（卡片与详情页展示） |
| `description` | ✅ | 一句话描述（文档中心卡片副标题） |
| `categories` | ✅ | **多分类数组**：`- 技术` 逐行写。归档页按此分组，一篇文档可同时出现在多个分类组 |
| `date` | ✅ | 文档日期 `YYYY-MM-DD`（文档中心分组排序 + 日历定位）。**push 前必须是真实日期**，不能是 dataview 表达式 |
| `tags` | ❌ | 数组形式：`- 标签A` 逐行。文档中心/详情页展示、支持搜索（不参与归档分组） |
| `status` | ❌ | `草稿 / 撰写中 / 已完成 / 已归档` |

> 兼容说明：旧文档的 `category: 单值` 仍有效，会被自动当作 `categories: [单值]` 处理，无需迁移。

> 已移除字段：`time` / `weekday` / `month` / `author` 之前从未被消费，已从模板删除。

### 第 4 步：文件命名与存放

```
docs/knowledge-docs/<主题目录>/YYYY-MM-DD-标题.md
```

示例：`docs/knowledge-docs/技术/2026-08-11-golang-channel.md`

- 文件名中的日期需与 frontmatter 的 `date` 保持一致
- 按主题分子目录存放，便于 Obsidian 侧管理

### 第 5 步：推送

```bash
git add docs/knowledge-docs/
git commit -m "docs: 新增 xxx 文档"
git push origin master
```

### 第 6 步：验证发布

推送后约 1–2 分钟，CI 完成构建：

- 文档中心 [`/docs/`](https://stan-fuls.github.io/docs/)：新文档出现在列表（按日期倒序），显示多分类徽标
- 归档页 [`/archive/`](https://stan-fuls.github.io/archive/)：按 `categories` 归入对应分组（**多分类 = 出现在多个分组**），`tags` 显示为可点击徽章（点击跳转文档中心自动搜索该标签）
- 文档详情页：点击卡片跳转到站内 `/docs/knowledge-docs/.../` 页面（含目录、点赞、评论、面包屑）

---

## 5. 博客文章发布流程

1. 在 `_posts/` 新建 `YYYY-MM-DD-标题.md`
2. Frontmatter 必填 `layout: post`、`title`、`date`，可选 `tags` / `category` / `toc: true`
3. Push `master` 分支，CI 自动构建发布

> 博客文章的 date 是 Jekyll 文章日期（决定 permalink 路径），与文档的 `date` 含义不同。

---

## 6. 本地开发与预览

```bash
bundle install
bundle exec jekyll serve --livereload
```

访问 `http://127.0.0.1:4000` 预览。

本地首次构建生成文档索引：

```bash
node scripts/gen-docs-index.js
```

---

## 7. 注意事项（务必阅读）

### ⚠️ 7.1 不要手写 `layout` / `permalink`

CI 的 `gen-docs-index.js` 会自动为 `docs/knowledge-docs/` 下的文档注入：

```yaml
layout: doc
permalink: /docs/knowledge-docs/<路径>/
```

**如果你手写了任一字段，CI 会跳过注入**，可能导致页面无布局或 URL 不一致。文档模板中默认不写这两个字段。

### ⚠️ 7.2 `date` 必须是真实日期字符串（push 前检查）

模板中 `date` 默认是 **dataview 表达式**（Obsidian 内实时求值显示），但：

- **CI 用正则解析真实日期**（`YYYY-MM-DD`），dataview 表达式无法解析 → 文档日期为空、排序到末尾
- **Calendar 日历插件**同样需要真实日期值

因此 **push 到 GitHub 前，务必把 `date` 改为实际日期**：

```yaml
date: "=dateformat(date(today), 'yyyy-MM-dd')"   # Obsidian 内显示为今天（模板默认）
date: "2026-08-13"                               # ✅ push 前改成这个
```

另外 `date` 建议**加引号**：裸的 `date: 2026-08-13` 会被 Jekyll 解析成 `[2026, 8, 13]` 数组，导致渲染异常。

### ⚠️ 7.3 文档必须放在 `docs/knowledge-docs/` 下

`gen-docs-index.js` 只扫描该目录。其他位置的 `.md` 不会进入文档中心与归档。

### ⚠️ 7.4 `categories` 多分类 + 优先使用已有分类

- 用 `categories:` 数组（模板默认），**一篇文档可归属多个分类组**；旧文档的 `category: 单值` 依然兼容
- 优先使用已有分类（技术/生活/工作/学习/项目/随笔）；新分类会自动创建新分组
- 注意与 `tags` 的区别：`categories` 决定归档分组与文档中心徽标；`tags` 在文档中心与详情页展示、支持搜索，归档页显示为 `#标签` 徽章（点击跳转 `/docs/?q=标签` 直达搜索结果）

### ⚠️ 7.5 本地 Ruby 版本与 Gemfile 补丁

- 本地若用 **Ruby 4.0**，`bundle install` 需要在 Gemfile 添加 `csv` / `bigdecimal`（仅本地构建用）
- **不要**把本地补丁后的 Gemfile 变更用于线上判断：GitHub Actions 使用 Ruby 3.2，不需要这两个依赖
- 若本地构建报错与线上无关，以 CI 构建日志为准

### ⚠️ 7.6 资源缓存

所有 CSS / JS 已带 `?v=<构建时间戳>`（cache busting），每次部署后浏览器自动拉取新版本。若本地预览看到旧样式，硬刷新（Cmd+Shift+R）即可。

### ⚠️ 7.7 Obsidian 特有语法在 Web 端受限

| 特性 | Web 端 |
|------|--------|
| 标准 Markdown | ✅ |
| 代码高亮 / 公式 / Mermaid | ✅ |
| 双向链接 `[[]]` | ⚠️ 渲染为普通文本，建议用 Markdown 链接 |
| Obsidian Callout | ⚠️ 用标准引用 `>` 替代 |

### ⚠️ 7.8 评论（Giscus）配置

评论已配置（`repo` / `repo_id` / `category_id` 已填）。如需调整：

1. 仓库 Settings → Features 勾选 **Discussions**
2. 访问 [giscus.app/zh-CN](https://giscus.app/zh-CN) 获取配置
3. 更新 `_config.yml` 的 `comments.giscus` 段

---

## 8. 常见问题 FAQ

**Q：推送后文档中心没出现新文档？**
检查：① 文档是否在 `docs/knowledge-docs/` 下；② frontmatter 的 `date` 是否为真实日期；③ Actions 构建是否成功（仓库 Actions 页）。

**Q：归档页文档分组不对？**
检查 `categories` 字段（旧文档是 `category` 单值，两者都会被识别）；两个都没有的文档归入「未分类」组。想归属多个分组就用 `categories:` 多行数组。

**Q：文档详情页没有目录？**
在 frontmatter 开启 `toc: true`。

**Q：本地构建报 `cannot load such file -- csv`？**
Ruby 4.0 需要 Gemfile 加 `gem 'csv'` / `gem 'bigdecimal'`，再 `bundle install`。

**Q：想完全用独立私有库存文档？**
当前实现是"文档放本仓库 `docs/knowledge-docs/`"，无需 Token。若改回独立私有库方案，需在 `_config.yml` 配置 `docs_repo.token`（Fine-grained Token，仅授权 `Contents: Read`），并调整 `docs.js` 数据源。

---

> 📥 文档模板：[`docs/_templates/document.md`](docs/_templates/document.md)
> 📄 在线文档中心：[https://stan-fuls.github.io/docs/](https://stan-fuls.github.io/docs/)
