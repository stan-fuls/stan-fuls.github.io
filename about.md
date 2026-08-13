---
layout: page
title: "关于"
permalink: /about/
key: about
show_title: true
toc: false
---

## 关于本站

**Share of Stam** 是我（Stam）个人搭建的知识分享与内容记录站点，托管于 GitHub Pages，采用 Jekyll 静态构建，零后端依赖。

站点围绕一条核心工作流运转：**Obsidian 写作 → 推送 GitHub → CI 自动构建 → 站点展示**。日常沉淀的技术笔记、工作心得与生活随笔，都能以极低摩擦发布上线。

### 站点内容

- 📝 **博客文章** — 技术心得、项目经验与日常感悟，位于 `_posts/`
- 📚 **文档中心** — 基于 `docs/knowledge-docs/` 的 Markdown 知识库，CI 自动生成索引，支持搜索与按时间段分组浏览
- 🗂️ **归档** — 按分类 + 标签自动归档，支持一键筛选

### 站点特性

- ✍️ **Obsidian 原生写作** — 提供可复用的文档模板，日期/时间由 dataview 插件自动生成，Calendar 插件定位日历
- 🏷️ **标签体系** — 文档与文章按标签归类，新标签自动创建归档分组
- 💬 **互动能力** — 点赞（本地存储计数）、Giscus 评论（GitHub Discussions）、多平台分享
- 🔍 **站内搜索** — 文章与文档均支持实时搜索
- 🎨 **极简响应式** — 桌面与移动端自适应，专注内容本身
- ⚡ **纯静态部署** — GitHub Pages + GitHub Actions，提交即发布

### 写作与发布流程

1. 在 Obsidian 中基于 [`docs/_templates/document.md`](https://github.com/stan-fuls/stan-fuls.github.io/blob/master/docs/_templates/document.md) 创建新文档
2. 完成写作，保存到 `docs/knowledge-docs/<主题>/` 目录
3. Push 到 GitHub → CI 自动注入 frontmatter、生成索引 → 文档中心与归档页自动更新

> 想快速上手？见 [README · 部署流程](https://github.com/stan-fuls/stan-fuls.github.io#readme)。

### 技术栈

| 类别 | 技术 |
|------|------|
| 站点框架 | Jekyll |
| 托管平台 | GitHub Pages |
| 自动化 | GitHub Actions |
| 文档索引 | Node.js（`gen-docs-index.js`） |
| 写作端 | Obsidian（dataview / Calendar / Templater） |
| 评论 | Giscus（GitHub Discussions） |
| 图表 | Mermaid |
| 公式 | MathJax |

---

## 关于作者

我是 **Stam**，一名热爱技术的开发者。

日常工作涉及后端开发、系统设计与 Infra 相关领域，对 Golang、分布式系统及可观测性有浓厚兴趣。业余时间喜欢折腾个人项目、记录技术笔记、探索效率工具。

### 联系方式

- 📧 邮箱：[HJworkspace@163.com](mailto:HJworkspace@163.com)
- 🐙 GitHub：[stan-fuls](https://github.com/stan-fuls)
- 🌐 本站：[https://stan-fuls.github.io](https://stan-fuls.github.io)

---

<p class="about-meta">本网站内容基于 <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener">MIT License</a> 开源，欢迎交流与指正。</p>
