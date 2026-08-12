#!/usr/bin/env node
/**
 * gen-docs-index.js
 *
 * 在 GitHub Actions 构建阶段运行,扫描本仓库的:
 *   - docs/knowledge-docs/   (知识库文档)
 *   - _posts/                (博客文章)
 *
 * 解析每篇 .md 的 frontmatter,生成 assets/data/docs-index.json
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT  = path.join(ROOT, 'assets', 'data', 'docs-index.json');

const SCAN_DIRS = [
  'docs/knowledge-docs',
  '_posts',
];

// ---- frontmatter 解析 (YAML 子集) ----

function parseFM(raw) {
  const meta = {};
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return meta;

  const lines = m[1].split('\n');
  let key = null;
  const arrKeys = new Set(['tags', 'categories', 'keywords']);

  for (const line of lines) {
    // inline array item:   - tagName
    const arrItem = line.match(/^\s*-\s+(.+)/);
    if (arrItem && key && arrKeys.has(key)) {
      const v = arrItem[1].trim().replace(/^["']|["']$/g, '');
      // strip inline comment
      const clean = v.replace(/\s*#.*$/, '').trim();
      if (clean) {
        if (!Array.isArray(meta[key])) meta[key] = [];
        meta[key].push(clean);
      }
      continue;
    }
    // key: value
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)/);
    if (kv) {
      key = kv[1].toLowerCase();
      let val = kv[2].trim().replace(/^["']|["']$/g, '');
      // strip inline comment
      val = val.replace(/\s*#.*$/, '').trim();
      // array-like: tags: 或 tags: [] 或 tags: [a, b] 或 tags: a, b
      if (arrKeys.has(key) && !Array.isArray(meta[key])) {
        val = val.replace(/^\[|\]$/g, '').trim();
        meta[key] = val ? val.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')) : [];
      } else {
        meta[key] = val;
      }
    }
  }
  return meta;
}

// ---- 递归扫描 ----

function scanDir(dir) {
  const results = [];
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return results;

  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = path.join(dir, entry.name);
    const fullPath = path.join(fullDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDir(relPath));
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      results.push({ relPath, fullPath });
    }
  }
  return results;
}

function extractDate(dateVal) {
  if (!dateVal) return '';
  // 如果是字符串,尝试提取 YYYY-MM-DD
  if (typeof dateVal === 'string') {
    const m = dateVal.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  // _posts 文件名自带日期,不在此处理
  return '';
}

// 把 "docs/knowledge-docs/database/mysql-guide.md" 转成 "/docs/knowledge-docs/database/mysql-guide/"
function pathToPermalink(relPath) {
  let p = relPath.replace(/^_posts\//, '_posts/'); // _posts 由 Jekyll 处理
  if (p.endsWith('.md')) p = p.slice(0, -3);
  if (!p.endsWith('/')) p += '/';
  return '/' + p;
}

// _posts 由 Jekyll 生成,文档需要走 docs 静态 URL
function pathToDisplay(relPath) {
  // 仅对 docs/knowledge-docs/ 下的文档生成 web URL
  if (relPath.startsWith('docs/knowledge-docs/')) {
    return pathToPermalink(relPath);
  }
  return null;
}

// 为 docs/knowledge-docs/*.md 注入 layout: doc + permalink,
// 让 Jekyll 渲染为 /path/index.html (带尾斜杠)
function ensureDocLayout(relPath, fullPath) {
  if (!relPath.startsWith('docs/knowledge-docs/')) return;
  const raw = fs.readFileSync(fullPath, 'utf8');

  // 计算 permalink: /docs/knowledge-docs/xxx/
  let p = relPath.replace(/^docs\/knowledge-docs\//, '');
  p = p.replace(/\.md$/i, '');
  if (!p.endsWith('/')) p += '/';
  const permalink = '/docs/knowledge-docs/' + p;

  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fmMatch) {
    let fm = fmMatch[1];

    // 注入 permalink(若已存在则不覆盖)
    if (!/^permalink\s*:/m.test(fm)) {
      fm = 'permalink: ' + permalink + '\n' + fm;
    }

    // 注入 layout(若已存在则不覆盖)
    if (!/^layout\s*:/m.test(fm)) {
      fm = 'layout: doc\n' + fm;
    }

    const newRaw = raw.replace(/^---\s*\n([\s\S]*?)\n---/, '---\n' + fm + '\n---');
    if (newRaw !== raw) fs.writeFileSync(fullPath, newRaw);
  } else {
    // 没有 frontmatter,添加一个最小化的
    const newRaw = `---\nlayout: doc\npermalink: ${permalink}\n---\n\n${raw}`;
    fs.writeFileSync(fullPath, newRaw);
  }
}

// ---- 主流程 ----

function main() {
  const allDocs = [];

  for (const scanDirName of SCAN_DIRS) {
    const mdFiles = scanDir(scanDirName);
    console.error(`📂 ${scanDirName}: ${mdFiles.length} .md file(s)`);

    for (const { relPath, fullPath } of mdFiles) {
      try {
        // 为 docs/knowledge-docs/*.md 自动注入 layout: doc
        ensureDocLayout(relPath, fullPath);

        const raw = fs.readFileSync(fullPath, 'utf8');
        const meta = parseFM(raw);

        // _posts 文件名格式: YYYY-MM-DD-slug.md
        let date = extractDate(meta.date);
        if (!date && scanDirName === '_posts') {
          const name = path.basename(relPath);
          const postDateMatch = name.match(/^(\d{4}-\d{2}-\d{2})/);
          if (postDateMatch) date = postDateMatch[1];
        }

        const name = path.basename(relPath, '.md');
        const blobUrl = `https://github.com/stan-fuls/stan-fuls.github.io/blob/master/${relPath}`;
        const webUrl  = pathToDisplay(relPath);

        allDocs.push({
          title:       meta.title || name,
          path:        relPath,
          date:        date,
          description: meta.description || meta.desc || '',
          category:    meta.category || '',
          tags:        Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : []),
          url:         blobUrl,
          webUrl:      webUrl,
        });
      } catch (e) {
        console.error(`⚠️  skip ${relPath}: ${e.message}`);
      }
    }
  }

  // 按日期倒序
  allDocs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(allDocs, null, 2) + '\n');
  console.error(`✅ wrote ${allDocs.length} doc(s) → assets/data/docs-index.json`);
}

main();
