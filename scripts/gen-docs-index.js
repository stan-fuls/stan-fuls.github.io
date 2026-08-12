#!/usr/bin/env node
/**
 * gen-docs-index.js
 *
 * 在 GitHub Actions 构建阶段运行,从 obsidian-knowledge-docs 私有仓库
 * 实时拉取所有 .md 文件,解析 frontmatter,生成 assets/data/docs-index.json
 *
 * 使用方式:
 *   node scripts/gen-docs-index.js <owner/repo> <branch> <token>
 */

const fs = require('fs');
const path = require('path');

const [,, REPO_SLUG = 'stan-fuls/obsidian-knowledge-docs', BRANCH = 'main', TOKEN = ''] = process.argv;
const [OWNER, REPO] = REPO_SLUG.split('/');
const OUT = path.join(__dirname, '..', 'assets', 'data', 'docs-index.json');

const headers = {
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'docs-index-bot',
};
if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

function gh(path) {
  return `https://api.github.com/repos/${OWNER}/${REPO}/${path.replace(/^\//, '')}`;
}

/** frontmatter parser — handles both JSON-safe and YAML-ish values */
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
      if (!Array.isArray(meta[key])) meta[key] = [];
      meta[key].push(v);
      continue;
    }
    // key: value
    const kv = line.match(/^([\w-]+)\s*:\s*(.+)/);
    if (kv) {
      key = kv[1].toLowerCase();
      let val = kv[2].trim().replace(/^["']|["']$/g, '');
      // strip YAML inline comment (# ...)
      val = val.replace(/\s*#.*$/, '').trim();
      // normalize array-like strings: "tag1, tag2" or "[tag1, tag2]"
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

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
  console.error(`📂 fetching tree: ${OWNER}/${REPO} @ ${BRANCH}`);

  // 1. 获取目录树
  const treeRes = await fetch(gh(`git/trees/${BRANCH}?recursive=1`), { headers });
  if (!treeRes.ok) {
    console.error(`❌ tree api failed: ${treeRes.status}`);
    // 如果失败,保留已有 index 不变
    if (fs.existsSync(OUT)) { console.error('⚠️  kept existing index'); process.exit(0); }
    process.exit(1);
  }
  const { tree = [] } = await treeRes.json();
  const mdFiles = tree.filter(t => t.type === 'blob' && /\.md$/i.test(t.path));
  console.error(`📄 found ${mdFiles.length} .md file(s)`);

  if (mdFiles.length === 0) {
    // 空仓库: 写空数组
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, '[]\n');
    console.error('✅ wrote empty index');
    return;
  }

  // 2. 逐个读取文件并解析 frontmatter
  const out = [];
  for (const { path: fp } of mdFiles) {
    try {
      const r = await fetch(gh(`contents/${fp}?ref=${BRANCH}`), { headers });
      if (!r.ok) throw new Error(`contents: ${r.status}`);
      const d = await r.json();
      const raw = Buffer.from((d.content || '').replace(/\s/g, ''), 'base64').toString('utf8');
      const meta = parseFM(raw);
      const name = fp.split('/').pop();

      out.push({
        title: meta.title || name.replace(/\.md$/i, ''),
        path: fp,
        date: meta.date || '',
        description: meta.description || meta.desc || '',
        category: meta.category || '',
        tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : []),
        url: d.html_url,
      });

      // gentle rate limit
      if (mdFiles.length > 20) await sleep(100);
    } catch (e) {
      console.error(`⚠️  skip ${fp}: ${e.message}`);
      // 跳过单个失败的文件
    }
  }

  // 3. 排序 & 写入
  out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.error(`✅ wrote ${out.length} doc(s) → assets/data/docs-index.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
