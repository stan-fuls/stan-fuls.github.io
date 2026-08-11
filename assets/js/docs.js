/* ================================================================
 * docs.js — 文档中心
 *
 * 数据源优先级:
 *   1. /assets/data/docs-index.json  (静态索引,公开可用,推荐用于私有仓库)
 *   2. GitHub Trees API + Contents API (需 Token 才能访问私有仓库)
 * ================================================================ */

(function () {
  'use strict';

  var CONFIG   = window.DOCS_REPO_CONFIG || {};
  var OWNER    = CONFIG.owner || 'stan-fuls';
  var REPO     = CONFIG.repo  || 'obsidian-knowledge-docs';
  var BRANCH   = CONFIG.branch || 'main';
  var TOKEN    = CONFIG.token || '';

  var INDEX_URL = (CONFIG.siteBase || '') + '/assets/data/docs-index.json';
  var TREE_API  = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/git/trees/' + BRANCH + '?recursive=1';
  var RAW_BASE  = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/';

  var CACHE_KEY = 'docs_cache_v3';
  var CACHE_TTL = 10 * 60 * 1000;

  function apiHeaders() {
    var h = { 'Accept': 'application/vnd.github.v3+json' };
    if (TOKEN) h['Authorization'] = 'token ' + TOKEN;
    return h;
  }

  var allDocs  = [];
  var $list    = null;
  var $loading = null;
  var $error   = null;
  var $search  = null;

  function init() {
    $list    = document.getElementById('docs-list');
    $loading = document.getElementById('docs-loading');
    $error   = document.getElementById('docs-error');
    $search  = document.getElementById('docs-search-input');

    if ($search) $search.addEventListener('input', render);

    var cached = getCache();
    if (cached && cached.length > 0) {
      allDocs = cached;
      showList();
      render();
    }
    loadDocs();
  }

  function loadDocs() {
    // ---- 策略 1: 静态索引 (公开,无需认证) ----
    fetch(INDEX_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('index ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data) || data.length === 0) throw new Error('empty index');
        allDocs = data.map(normalizeIndexEntry).filter(Boolean);
        finishLoad();
      })
      .catch(function () {
        // ---- 策略 2: GitHub API (需 Token) ----
        loadViaAPI();
      });
  }

  function loadViaAPI() {
    fetch(TREE_API, { headers: apiHeaders() })
      .then(function (res) {
        if (res.status === 404) throw new Error('仓库不存在或未授权(私有库需 Token)');
        if (res.status === 401) throw new Error('Token 无效或已过期');
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText);
        return res.json();
      })
      .then(function (treeData) {
        var mdFiles = (treeData.tree || []).filter(function (item) {
          return item.type === 'blob' && /\.md$/i.test(item.path || '');
        });
        if (mdFiles.length === 0) throw new Error('仓库中未找到 .md 文档');
        return Promise.all(mdFiles.map(fetchRawAndParse));
      })
      .then(function (docs) {
        allDocs = docs.sort(function (a, b) {
          return (b.date || '').localeCompare(a.date || '');
        });
        finishLoad();
      })
      .catch(function (err) {
        showError(err);
      });
  }

  function finishLoad() {
    if (allDocs.length > 0) {
      allDocs.sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });
      setCache(allDocs);
      showList();
      render();
    }
  }

  // ---- 静态索引条目的标准化 ----

  function normalizeIndexEntry(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    var title = raw.title || (raw.path || 'doc-' + idx).replace(/\.md$/i, '').split('/').pop();
    return {
      title:    title,
      path:     raw.path || '',
      date:     raw.date || '',
      desc:     raw.description || raw.desc || '',
      tags:     normTags(raw.tags),
      category: raw.category || '',
      htmlUrl:  raw.url || raw.htmlUrl || ('https://github.com/' + OWNER + '/' + REPO)
    };
  }

  // ---- API 模式: 拉取单个文件并解析 ----

  function fetchRawAndParse(fpath) {
    if (TOKEN) {
      var contentsUrl = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + fpath;
      return fetch(contentsUrl, { headers: apiHeaders() })
        .then(function (r) {
          if (!r.ok) throw new Error('获取失败: ' + fpath);
          return r.json();
        })
        .then(function (d) {
          var raw = '';
          try {
            var clean = (d.content || '').replace(/\s/g, '');
            var padded = clean + '='.repeat((4 - clean.length % 4) % 4);
            raw = decodeURIComponent(escape(atob(padded)));
          } catch (e) { raw = ''; }
          return buildDoc(fpath, raw, d.html_url);
        });
    }
    var rawUrl = RAW_BASE + fpath;
    return fetch(rawUrl)
      .then(function (r) {
        if (!r.ok) throw new Error('获取失败: ' + fpath);
        return r.text();
      })
      .then(function (raw) { return buildDoc(fpath, raw, rawUrl); });
  }

  function buildDoc(fpath, raw, url) {
    var meta = parseFM(raw);
    var name = fpath.split('/').pop();
    return {
      title:    meta.title  || name.replace(/\.md$/i, ''),
      path:     fpath,
      date:     meta.date   || '',
      desc:     meta.description || '',
      category: meta.category || '',
      tags:     normTags(meta.tags),
      htmlUrl:  url || ('https://github.com/' + OWNER + '/' + REPO + '/blob/' + BRANCH + '/' + fpath)
    };
  }

  function normTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags.map(function (t) { return String(t).trim(); }).filter(Boolean);
    return String(tags).split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function parseFM(raw) {
    var meta = {};
    var m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!m) return meta;
    var lines = m[1].split('\n');
    var key = null;
    lines.forEach(function (line) {
      var arr = line.match(/^\s*-\s+(.+)/);
      if (arr && key) {
        if (!meta[key]) meta[key] = [];
        meta[key].push(arr[1].trim().replace(/^["']|["']$/g, ''));
        return;
      }
      var kv = line.match(/^(\w[\w-]*)\s*:\s*(.+)/);
      if (kv) {
        key = kv[1];
        meta[key] = kv[2].trim().replace(/^["']|["']$/g, '');
      }
    });
    return meta;
  }

  // ---- 错误展示 ----

  function showError(err) {
    if (allDocs.length > 0) { showList(); render(); return; }
    if ($loading) $loading.style.display = 'none';
    if (!$error) return;
    $error.style.display = 'block';

    var msg = err.message || String(err);
    var reason = '未知错误';
    if (msg.indexOf('404') > -1 || msg.indexOf('未授权') > -1) reason = '仓库不可访问(可能是私有仓库)';
    else if (msg.indexOf('401') > -1 || msg.indexOf('Token') > -1) reason = 'Token 无效';
    else if (msg.indexOf('403') > -1) reason = 'API 频率超限';
    else if (msg.indexOf('HTTP') > -1) reason = msg;

    var html = '<p>⚠️ 无法加载文档列表</p>' +
      '<p style="color:#78350f;font-weight:600;">原因: ' + esc(reason) + '</p>' +
      '<p>由于 <code>obsidian-knowledge-docs</code> 是私有仓库,GitHub API 拒绝匿名访问,前端也无法安全暴露 Token。</p>' +
      '<p><strong>推荐方案: 使用静态索引</strong></p>' +
      '<ol>' +
        '<li>在 <code>obsidian-knowledge-docs</code> 仓库中创建 <code>docs-index.json</code>,列出所有文档元数据</li>' +
        '<li>通过 GitHub Action 自动推送该文件到本仓库 <code>assets/data/docs-index.json</code></li>' +
        '<li>或直接修改 <a href="https://github.com/stan-fuls/stan-fuls.github.io/edit/master/assets/data/docs-index.json" target="_blank" rel="noopener">本站索引文件</a></li>' +
      '</ol>' +
      '<p>索引文件格式示例:</p>' +
      '<pre style="background:#fef3c7;padding:12px;border-radius:6px;font-size:0.78rem;overflow:auto;">[\n' +
      '  {\n' +
      '    "title": "文档标题",\n' +
      '    "path": "folder/doc.md",\n' +
      '    "date": "2026-08-10",\n' +
      '    "description": "描述",\n' +
      '    "tags": ["标签1", "标签2"],\n' +
      '    "category": "分类",\n' +
      '    "url": "GitHub 链接"\n' +
      '  }\n' +
      ']</pre>';

    $error.innerHTML = html;
  }

  // ---- 缓存 ----

  function getCache() {
    try {
      var r = localStorage.getItem(CACHE_KEY);
      if (!r) return null;
      var o = JSON.parse(r);
      return (Date.now() - o.ts < CACHE_TTL) ? o.data : null;
    } catch (e) { return null; }
  }

  function setCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: data, ts: Date.now() })); } catch (e) {}
  }

  function showList() {
    if ($loading) $loading.style.display = 'none';
    if ($list)    $list.style.display    = 'grid';
  }

  // ---- 搜索过滤 ----

  function filterDocs(docs) {
    var q = $search ? $search.value.trim().toLowerCase() : '';
    if (!q) return docs;
    return docs.filter(function (d) {
      return d.title.toLowerCase().indexOf(q) > -1 ||
             d.desc.toLowerCase().indexOf(q)  > -1 ||
             d.tags.some(function (t) { return t.toLowerCase().indexOf(q) > -1; });
    });
  }

  // ---- 渲染 ----

  function render() {
    if (!$list) return;
    var filtered = filterDocs(allDocs);

    if (filtered.length === 0) {
      $list.innerHTML = '<p class="docs-empty" style="grid-column:1/-1;">📭 暂无匹配的文档</p>';
      return;
    }
    $list.innerHTML = filtered.map(card).join('');
  }

  function card(d) {
    var tagsHtml = '';
    if (d.tags.length > 0) {
      tagsHtml = '<div class="doc-card-tags">' +
        d.tags.map(function (t) { return '<span class="doc-card-tag">#' + esc(t) + '</span>'; }).join('') +
        '</div>';
    }
    return '<a class="doc-card" href="' + esc(d.htmlUrl) + '" target="_blank" rel="noopener">' +
      '<div class="doc-card-meta">' +
        '<span class="doc-card-category">' + esc(folderLabel(d)) + '</span>' +
        (d.date ? '<span class="doc-card-date">' + d.date.substring(0, 10) + '</span>' : '') +
      '</div>' +
      '<h4 class="doc-card-title">' + esc(d.title) + '</h4>' +
      '<p class="doc-card-desc">' + (d.desc ? esc(d.desc) : '暂无描述') + '</p>' +
      tagsHtml +
    '</a>';
  }

  function folderLabel(d) {
    if (d.category) return d.category;
    if (!d.path) return '根目录';
    var parts = d.path.split('/');
    parts.pop();
    return parts.length > 0 ? parts.join(' / ') : '根目录';
  }

  function esc(s) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();