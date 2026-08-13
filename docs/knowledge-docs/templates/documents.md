---
layout: doc
permalink: /docs/knowledge-docs/templates/documents/
# ⚠️ 请勿手写 layout / permalink 这两个字段！
# 文档 push 到 GitHub 后,CI (gen-docs-index.js) 会自动注入:
#   layout: doc       → 让 Jekyll 把 .md 渲染成完整 HTML 页面
#   permalink: /.../  → 让 URL 带尾斜杠,与文档中心跳转保持一致
# 如果你手写了其中任一字段,CI 会跳过注入。(不推荐写)

title: "文档标题(必填)"

# ============================================================
# 📅 日期 / 时间 —— 由 Obsidian dataview 插件自动生成,无需手填
# ------------------------------------------------------------
# 取值说明 (dataview 语法):
#   date      → "=dateformat(date(today), 'yyyy-MM-dd')"       今天日期
#   dateTime  → "=dateformat(date(now), 'yyyy-MM-dd HH:mm')"   此刻(精确到分钟)
#   time      → "=dateformat(date(now), 'HH:mm')"              当前时分
#   weekday   → "=dateformat(date(today), 'EEEE')"             今天星期几
#   month     → "=dateformat(date(today), 'yyyy-MM')"          当前月份
# ------------------------------------------------------------
# 📌 与插件的配合:
#   1. Calendar 日历插件读取 frontmatter 的 date 字段(格式 YYYY-MM-DD),
#      把本文档显示在对应日期上 → 日历中可直接跳转打开
#   2. dataview 表达式在 Obsidian 中实时求值显示,不会写入文件
# ⚠️ push 到 GitHub 前,请把 date 改成真实日期(CI 用正则解析,
#    dataview 表达式无法解析会导致文档中心日期为空/排序靠后):
#      修改前: date: "=dateformat(date(today), 'yyyy-MM-dd')"
#      修改后: date: "2026-08-13"
# ============================================================
date: "=dateformat(date(today), 'yyyy-MM-dd')"
dateTime: "=dateformat(date(now), 'yyyy-MM-dd HH:mm')"
time: "=dateformat(date(now), 'HH:mm')"
weekday: "=dateformat(date(today), 'EEEE')"
month: "=dateformat(date(today), 'yyyy-MM')"

description: "一句话描述文档内容,用于文档中心卡片展示(必填)"
# 👆 建议 ≤ 50 字,文档中心卡片、归档列表、搜索都会用到

category: 技术
# 可选分类: 技术 / 生活 / 工作 / 学习 / 项目 / 随笔
# 归档页按此字段分组,请使用已有分类;新分类会自动创建新分组

tags:
  - 标签A
  - 标签B
# ✅ 每个文档支持多个标签,文档中心会按标签自动归档
#    新标签会自动创建归档分组,已有标签直接归入已有分组
#    不想被归档就把 tags 整段(含 tags:)删掉
#    标签会显示在文档详情页与归档列表,便于检索

status: 撰写中
# 可选: 草稿 / 撰写中 / 已完成 / 已归档

author: Stam
# 作者,与 _config.yml 中 author.name 保持一致

# 💡 可选字段(按需添加,不需要就删掉):
#   toc: true                 # 详情页右侧显示目录(h1-h3)
#   sticky: true              # 文档置顶
#   updated: "=dateformat(date(now), 'yyyy-MM-dd')"   # 最后更新时间(dataview 自动)
#   cover: /assets/images/xx.png   # 封面图
#   slug: my-doc              # 自定义 URL 标识(一般不用)
---

# {{title}}

> [!NOTE] <!--easygit-callout:original=info,collapse=--> 文档信息（Obsidian 内由 dataview 自动生成，无需手改）
> - 📅 创建日期：`=dateformat(date(this.date), 'yyyy-MM-dd')`
> - 🕐 创建时间：`=dateformat(date(this.dateTime), 'yyyy-MM-dd HH:mm')`
> - 📂 分类：`=this.category` ｜ 🏷️ 标签：`=this.tags`
> - 🚦 状态：`=this.status`
>
> 提示：若上面显示空白，请确认已安装并启用 **Dataview** 插件；`date` 字段改成真实日期后，Calendar 插件会在日历上定位本文档。

> [!NOTE] <!--easygit-callout:original=abstract,collapse=--> 发布流程
> 1. 在 Obsidian 中通过 Templater 插件基于本模板创建新笔记
> 2. 完成写作，把 `date` 改为真实日期，确认 `category` / `tags`
> 3. 保存到本仓库的 `docs/knowledge-docs/<主题>/` 目录
> 4. Push 到 GitHub → CI 自动生成索引 → 文档中心展示 ✅
> - **已有标签** → 文档直接归入该标签分组
> - **新标签** → 自动创建一个新的标签分组
> - 一个文档可以有多个标签，会同时出现在多个分组中
> - 没有填 tags 的文档会归入「未分类」

## 概述

在这里用 2-3 句话说明本文档要解决的问题或分享的内容。

## 核心内容

### 一级标题：主题

正文段落，支持 Markdown 标准语法与 Obsidian 特有语法：

- **粗体**、*斜体*、`行内代码`
- [[Obsidian 模板|双向链接]] 到其他笔记
- 任务列表
  - [x] 已完成事项
  - [ ] 待办事项

### 代码示例

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Share of Stam!")
}
```

### 表格

| 列 1 | 列 2 | 列 3 |
|------|------|------|
| A    | B    | C    |
| 1    | 2    | 3    |

### 数学公式 (可选)

$$
E = mc^2
$$

行内公式：$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$

### 流程图 (可选)

```mermaid
flowchart LR
    A[Obsidian 编辑] --> B[Git 推送]
    B --> C[文档中心加载]
    C --> D[按标签自动归档]
```

## 关键点总结

1. 核心要点 1
2. 核心要点 2
3. 核心要点 3

## 参考

- [Obsidian 官方文档](https://help.obsidian.md/)
- [Jekyll Frontmatter](https://jekyllrb.com/docs/front-matter/)

---

> **发布前检查清单**
> - [ ] `title` / `description` 已填写
> - [ ] `date` 已改为真实日期（push 前必须）
> - [ ] `category` 为已有分类
> - [ ] `tags` 已确认（可留空删除）
> - [ ] 已保存到 `docs/knowledge-docs/<主题>/`
> - [ ] 已执行 `git add` → `git commit` → `git push origin master`