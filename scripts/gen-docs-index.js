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
const OUT          = path.join(ROOT, 'assets', 'data', 'docs-index.json');
const PREV_NEXT_OUT = path.join(ROOT, '_data', 'docs_prev_next.yml');

const SCAN_DIRS = [
  'docs/knowledge-docs',  // 仅扫描知识库文档目录
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
    const relPath = path.join(dir, entry.name).replace(/\\/g, '/');
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

// docs/knowledge-docs/xxx.md → /docs/knowledge-docs/xxx/
function pathToPermalink(relPath) {
  let p = relPath.replace(/\\/g, '/').replace(/^docs\/knowledge-docs\//, '');
  p = p.replace(/\.md$/i, '');
  if (!p.endsWith('/')) p += '/';
  return '/docs/knowledge-docs/' + p;
}

function yamlQuote(str) {
  if (str === '' || str == null) return '""';
  // JSON.stringify 生成合法 YAML 双引号字符串(含转义)
  return JSON.stringify(String(str));
}

function generatePrevNextYaml(allDocs) {
  // 按完整 date 升序排列: 上一篇=更早, 下一篇=更晚
  const sorted = [...allDocs].sort((a, b) => {
    const ta = a.fullDate ? new Date(a.fullDate).getTime() : 0;
    const tb = b.fullDate ? new Date(b.fullDate).getTime() : 0;
    return ta - tb;
  });

  let yml = '# 文档「上一篇 / 下一篇」导航映射\n';
  yml += '# 由 scripts/gen-docs-index.js 自动生成,请勿手动修改\n';
  yml += '# 上一篇 = 时间更早(更旧), 下一篇 = 时间更晚(更新)\n';

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    yml += `${yamlQuote(cur.webUrl)}:\n`;
    yml += `  prev_url: ${yamlQuote(prev ? prev.webUrl : '')}\n`;
    yml += `  prev_title: ${yamlQuote(prev ? prev.title : '')}\n`;
    yml += `  next_url: ${yamlQuote(next ? next.webUrl : '')}\n`;
    yml += `  next_title: ${yamlQuote(next ? next.title : '')}\n`;
  }

  fs.mkdirSync(path.dirname(PREV_NEXT_OUT), { recursive: true });
  fs.writeFileSync(PREV_NEXT_OUT, yml);
  console.error(`✅ wrote prev/next nav → _data/docs_prev_next.yml`);
}

// 为 docs/knowledge-docs/*.md 注入 layout: doc + permalink,
// 让 Jekyll 渲染为 /path/index.html (带尾斜杠)
function ensureDocLayout(relPath, fullPath) {
  const raw = fs.readFileSync(fullPath, 'utf8');

  // 统一为正斜杠,避免 Windows 本地运行时路径分隔符问题
  relPath = relPath.replace(/\\/g, '/');

  // 计算 permalink: /docs/knowledge-docs/xxx/
  let p = relPath.replace(/^docs\/knowledge-docs\//, '');
  p = p.replace(/\.md$/i, '');
  if (!p.endsWith('/')) p += '/';
  const permalink = '/docs/knowledge-docs/' + p;

  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  let newRaw;

  if (fmMatch) {
    let fm = fmMatch[1];

    if (!/^permalink\s*:/m.test(fm)) {
      fm = 'permalink: ' + permalink + '\n' + fm;
    }
    if (!/^layout\s*:/m.test(fm)) {
      fm = 'layout: doc\n' + fm;
    }

    // 确保 date 是带引号字符串 - 否则 Jekyll 会把 YYYY-MM-DD 解析成 Array
    if (/^date\s*:\s*\d{4}-\d{2}-\d{2}\s*$/m.test(fm)) {
      fm = fm.replace(/^date\s*:\s*(\d{4}-\d{2}-\d{2})\s*$/m, 'date: "$1"');
    } else if (!/^date\s*:/m.test(fm)) {
      const today = new Date().toISOString().substring(0, 10);
      fm = fm + '\ndate: "' + today + '"';
    }

    newRaw = raw.replace(/^---\s*\n([\s\S]*?)\n---/, '---\n' + fm + '\n---');
  } else {
    const baseName = path.basename(relPath, '.md');
    const title = baseName.replace(/^\d{4}-\d{2}-\d{2}-?/, '').replace(/_/g, ' ') || baseName;
    const today = new Date().toISOString().substring(0, 10);
    newRaw = `---\npermalink: ${permalink}\nlayout: doc\ntitle: "${title}"\ndate: "${today}"\n---\n\n${raw}`;
  }

  if (newRaw !== raw) {
    fs.writeFileSync(fullPath, newRaw);
    console.error(`  ↳ 注入 frontmatter: ${relPath}`);
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
        ensureDocLayout(relPath, fullPath);

        const raw = fs.readFileSync(fullPath, 'utf8');
        const meta = parseFM(raw);

        const date = extractDate(meta.date);
        const name = path.basename(relPath, '.md');
        const blobUrl = `https://github.com/stan-fuls/stan-fuls.github.io/blob/master/${relPath}`;
        const webUrl  = pathToPermalink(relPath);

        // categories 优先取多值数组;兼容旧文档的 category 单值
        const cats = Array.isArray(meta.categories) && meta.categories.length > 0
          ? meta.categories
          : (meta.category ? [meta.category] : []);

        allDocs.push({
          title:       meta.title || name,
          path:        relPath,
          date:        date,
          fullDate:    meta.date || '',             // 保留完整时间,用于上一篇/下一篇排序
          description: meta.description || meta.desc || '',
          categories:  cats,                       // 多分类数组,空数组表示未分类
          category:    meta.category || '',        // 兼容旧字段,前端优先用 categories
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

  // 生成「上一篇 / 下一篇」导航数据 (按完整 date 升序)
  generatePrevNextYaml(allDocs);
}

main();
