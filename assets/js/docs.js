/* ================================================================
 * docs.js — 文档中心
 *   从 stan-fuls/obsidian-knowledge-docs 拉取 Markdown 文档
 *   支持私有库(需 Personal Access Token)
 * ================================================================ */

(function () {
  'use strict';

  // 由 docs/index.html 通过 Liquid 模板注入
  var CONFIG = window.DOCS_REPO_CONFIG || {};

  var REPO_OWNER = CONFIG.owner || 'stan-fuls';
  var REPO_NAME  = CONFIG.repo  || 'obsidian-knowledge-docs';
  var TOKEN      = CONFIG.token || '';
  var API_BASE   = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/';
  var CACHE_KEY  = 'docs_cache';
  var CACHE_TTL  = 10 * 60 * 1000;

  // GitHub API 请求头(有 Token 则带认证)
  function apiHeaders() {
    var h = { 'Accept': 'application/vnd.github.v3+json' };
    if (TOKEN) h['Authorization'] = 'token ' + TOKEN;
    return h;
  }

  var allDocs    = [];
  var $list      = null;
  var $loading   = null;
  var $error     = null;
  var $search    = null;

  function init() {
    $list    = document.getElementById('docs-list');
    $loading = document.getElementById('docs-loading');
    $error   = document.getElementById('docs-error');
    $search  = document.getElementById('docs-search-input');

    if ($search) $search.addEventListener('input', render);
    loadDocs();
  }

  // --------------- 加载 ---------------

  function loadDocs() {
    var cached = getCache();
    if (cached && cached.length > 0) {
      allDocs = cached;
      showList();
      render();
    }

    fetch(API_BASE, { headers: apiHeaders() })
      .then(function (res) {
        if (res.status === 404) throw new Error('仓库不存在或未授权(私有库需要 Token)');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (files) {
        var mds = Array.isArray(files)
          ? files.filter(function (f) { return f.type === 'file' && /\.md$/i.test(f.name); })
          : [];
        return Promise.all(mds.map(fetchMeta));
      })
      .then(function (docs) {
        allDocs = docs.sort(function (a, b) {
          return (b.date || '').localeCompare(a.date || '');
        });
        setCache(allDocs);
        showList();
        render();
      })
      .catch(function (err) {
        console.warn('docs.js: 拉取失败:', err.message);
        if (allDocs.length > 0) {
          showList();
          render();
        } else {
          if ($loading) $loading.style.display = 'none';
          if ($error) {
            $error.style.display = 'block';
            // 私有库提示更明确的错误信息
            if (!TOKEN && err.message.indexOf('404') > -1) {
              $error.innerHTML =
                '<p>⚠️ 无法加载文档列表。仓库是私有库，请在 <code>_config.yml</code> 中配置 <code>docs_repo.token</code></p>' +
                '<ol><li>访问 <a href="https://github.com/settings/tokens" target="_blank">GitHub Token 设置</a></li>' +
                '<li>创建 Fine-grained token，仅授权 <code>stan-fuls/obsidian-knowledge-docs</code> 读取权限</li>' +
                '<li>填入 _config.yml 的 docs_repo.token 字段</li></ol>';
            }
          }
        }
      });
  }

  function fetchMeta(file) {
    return fetch(file.url, { headers: apiHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var raw  = atob(d.content);
        var meta = parseFM(raw);
        return {
          name:     file.name,
          path:     file.path,
          title:    meta.title  || file.name.replace(/\.md$/i, ''),
          date:     meta.date   || '',
          desc:     meta.description || '',
          category: meta.category || '',
          tags:     normTags(meta.tags),
          htmlUrl:  d.html_url  || ''
        };
      });
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
      if (arr && key) { if (!meta[key]) meta[key] = []; meta[key].push(arr[1].trim().replace(/^["']|["']$/g, '')); return; }
      var kv = line.match(/^(\w[\w-]*)\s*:\s*(.+)/);
      if (kv) { key = kv[1]; meta[key] = kv[2].trim().replace(/^["']|["']$/g, ''); }
    });
    return meta;
  }

  // --------------- 缓存 ---------------

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

  // --------------- 搜索过滤 ---------------

  function filterDocs(docs) {
    var q = $search ? $search.value.trim().toLowerCase() : '';
    if (!q) return docs;
    return docs.filter(function (d) {
      return d.title.toLowerCase().indexOf(q) > -1 ||
             d.desc.toLowerCase().indexOf(q)  > -1 ||
             d.tags.some(function (t) { return t.toLowerCase().indexOf(q) > -1; });
    });
  }

  // --------------- 渲染 ---------------

  function render() {
    if (!$list) return;
    var filtered = filterDocs(allDocs);

    if (filtered.length === 0) {
      $list.innerHTML = '<p class="docs-empty">📭 暂无文档</p>';
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
        '<span class="doc-card-category">' + esc(d.category || '无分类') + '</span>' +
        (d.date ? '<span class="doc-card-date">' + d.date.substring(0, 10) + '</span>' : '') +
      '</div>' +
      '<h4 class="doc-card-title">' + esc(d.title) + '</h4>' +
      '<p class="doc-card-desc">' + (d.desc ? esc(d.desc) : '暂无描述') + '</p>' +
      tagsHtml +
    '</a>';
  }

  function esc(s) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
  }

  // --------------- 启动 ---------------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
