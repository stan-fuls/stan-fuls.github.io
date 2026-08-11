# Share of Stam

个人知识分享站点，基于 Jekyll 构建，托管于 GitHub Pages。

> 访问：[https://stan-fuls.github.io](https://stan-fuls.github.io)

## 项目结构

| 目录           | 说明 |
|----------------|------|
| `_layouts/`    | 页面布局模板 |
| `_includes/`   | 可复用组件（header, footer, head 等） |
| `_posts/`      | 博客文章（Markdown） |
| `_data/`       | 导航、国际化等数据文件 |
| `assets/`      | CSS、JS、图片等静态资源 |
| `docs/`        | 文档管理系统页面、API 文档、Obsidian 模板 |
| `docs/_templates/` | Obsidian 文档模板（不会被 Jekyll 发布） |

## 文档管理系统

通过 GitHub API 从独立仓库 `stan-fuls/obsidian-knowledge-docs` 读取 Markdown 文档。

### 数据源策略（按优先级）

| 顺序 | 数据源 | 适用场景 |
|------|--------|----------|
| 1️⃣ | `/assets/data/docs-index.json`（静态索引） | 私有库，无需 Token；推荐方案 |
| 2️⃣ | GitHub Trees API + Contents API | 公开库或已配置 Token |

> 由于 `obsidian-knowledge-docs` 是**私有仓库**，GitHub API 拒绝匿名访问，且前端公开页面无法安全存放 Token。推荐使用 **静态索引**：
>
> 1. 维护一个 `docs-index.json` 文件存放在本站 `assets/data/` 下
> 2. 列表项包含：`title`、`path`、`date`、`description`、`tags`、`category`、`url`
> 3. 在 `obsidian-knowledge-docs` 仓库用 GitHub Action 自动生成该文件并推回本仓库
> 4. 或直接手动编辑 [`assets/data/docs-index.json`](assets/data/docs-index.json)

### 列表特性

- **递归遍历**：Git Trees API 拉取所有子文件夹的 `.md` 文件
- **搜索**：按标题、描述、标签实时过滤
- **排序**：按 `date` 倒序（最新在前）

配置见 `_config.yml` 的 `docs_repo` 段。

## 文章互动功能

每篇博客文章底部提供三项互动：

| 功能 | 实现方式 | 说明 |
|------|----------|------|
| **点赞** | localStorage + URL 种子基数 | 显示总计数（基础数 + 本机增量），可再次点击取消 |
| **评论** | Giscus (GitHub Discussions) | 未启用时显示配置占位，需补全 `repo_id`/`category_id` |
| **分享** | 固定弹窗（微信 / 微博 / QQ / Twitter / LinkedIn / 复制） | 不调用系统原生 Web Share API |

### Giscus 评论配置

1. 在仓库 Settings → Features 中勾选 **Discussions**
2. 访问 [https://github.com/apps/giscus](https://github.com/apps/giscus) 安装 Giscus App
3. 访问 [https://giscus.app/zh-CN](https://giscus.app/zh-CN) 填写仓库名获取配置
4. 将 `repo_id` / `category_id` 填入 `_config.yml` 的 `comments.giscus` 段

## 部署

推送 master 分支后，GitHub Pages 自动构建。

---

## 📚 Obsidian 文档写作流程

### 1. 获取模板

下载文档模板到本地（任选其一）：

- **直接下载**：[`docs/_templates/document.md`](docs/_templates/document.md)
- **通过 GitHub Raw**：
  ```
  https://raw.githubusercontent.com/stan-fuls/stan-fuls.github.io/master/docs/_templates/document.md
  ```

把模板保存到你的 Obsidian 知识库的 `templates/` 目录。

### 2. 在 Obsidian 中创建文档

推荐使用 [Templater](https://github.com/SAManuelRea/obsidian-templater) 插件自动化模板填充：

- 创建文档时执行模板
- `{{date:YYYY-MM-DD}}`、`{{title}}` 等占位符会自动替换
- 完成 Obsidian 风格的元数据（双链、Callout、Mermaid、数学公式）

### 3. Frontmatter 字段说明

Jekyll 文档中心会读取以下字段：

| 字段          | 必填 | 说明                                            |
| ------------- | ---- | ----------------------------------------------- |
| `title`       | ✅   | 文档标题（卡片与详情页展示）                    |
| `date`        | ✅   | 创建日期 `YYYY-MM-DD`（用于时间段分组）         |
| `description` | ✅   | 一句话描述（卡片副标题）                        |
| `category`    | ❌   | 分类：`技术 / 生活 / 工作 / 学习 / 项目 / 随笔` |
| `tags`        | ❌   | 数组形式：`[tag1, tag2]`                        |
| `status`      | ❌   | 状态：`草稿 / 撰写中 / 已完成 / 已归档`         |
| `author`      | ❌   | 作者名                                          |

### 4. 文件命名规范

```
YYYY-MM-DD-标题.md
```

示例：

```
2026-08-11-golang-channel.md
2026-08-11-obsidian-templater.md
```

文件名中的日期需与 frontmatter 的 `date` 保持一致，便于按时间排序。

### 5. 同步到文档中心

将编辑好的 `.md` 文件保存到 `stan-fuls/obsidian-knowledge-docs` 仓库（默认根目录）。推送后几分钟：

1. Jekyll 文档中心的 [`docs.js`](assets/js/docs.js) 调用 GitHub API 拉取最新文档
2. 按创建时间倒序排列展示
3. 支持搜索框实时过滤（按标题、描述、标签名）

> ⚠️ **私有库 Token 配置**：`obsidian-knowledge-docs` 是私有仓库，必须在 `_config.yml` 中配置 `docs_repo.token`。
> 
> 创建 [Fine-grained Token](https://github.com/settings/tokens)，仅授权此仓库的 `Contents: Read` 权限即可。

### 6. Obsidian 特有语法在文档中心可用性

| 特性                 | 是否支持 | 备注                                     |
| -------------------- | -------- | ---------------------------------------- |
| 标准 Markdown        | ✅       | 标题、列表、引用、表格等                 |
| 代码块高亮           | ✅       | 识别 ` ```语言 ` 标记                    |
| LaTeX 数学公式       | ✅       | 全局启用 mathjax                         |
| Mermaid 图表         | ✅       | 全局启用 mermaid                         |
| YAML 双链 `[[]]`     | ⚠️       | 渲染为普通文本，建议用 Markdown 链接     |
| Obsidian Callout     | ⚠️       | 使用标准 Markdown 引用 `>` 替代          |

> Obsidian 自身使用实时渲染，写作用法照旧；但同步到文档中心后，前端仅渲染通用 Markdown，复杂双链/嵌入会被简化（可在后续迭代中扩展解析器）。
