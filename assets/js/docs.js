/* ================================================================
 * docs.js — 文档中心
 *   使用 Git Trees API 递归遍历仓库所有子文件夹中的 .md 文件
 *   支持私有库(需 Personal Access Token)
 * ================================================================ */

(function () {
  'use strict';

  var CONFIG = window.DOCS_REPO_CONFIG || {};
  var REPO_OWNER = CONFIG.owner || 'stan-fuls';
  var REPO_NAME  = CONFIG.repo  || 'obsidian-knowledge-docs';
  var TOKEN      = CONFIG.token || '';
  var BRANCH     = CONFIG.branch || 'main';

  var TREE_API   = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/git/trees/' + BRANCH + '?recursive=1';
  var RAW_BASE   = 'https://raw.githubusercontent.com/' + REPO_OWNER + '/' + REPO_NAME + '/' + BRANCH + '/';

  var CACHE_KEY  = 'docs_cache_v2';
  var CACHE_TTL  = 10 * 60 * 1000;

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
    loadDocs();
  }

  // --------------- 核心:递归拉取 ---------------

  function loadDocs() {
    var cached = getCache();
    if (cached && cached.length > 0) {
      allDocs = cached;
      showList();
      render();
    }

    // Step 1: 用 Git Trees API 获取整个仓库的文件树
    fetch(TREE_API, { headers: apiHeaders() })
      .then(function (res) {
        if (res.status === 404) throw new Error('仓库不存在或未授权(私有库需 Token)');
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText);
        return res.json();
      })
      .then(function (treeData) {
        // Step 2: 过滤出所有 .md 文件
        var mdFiles = (treeData.tree || []).filter(function (item) {
          return item.type === 'blob' && /\.md$/i.test(item.path || '');
        });

        if (mdFiles.length === 0) {
          throw new Error('仓库中未找到 .md 文档');
        }

        // Step 3: 并行拉取每个 md 文件的内容并解析 frontmatter
        var fetchers = mdFiles.map(function (item) {
          return fetchRawAndParse(item.path);
        });
        return Promise.all(fetchers);
      })
      .then(function (docs) {
        // 按日期倒序
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
            if (!TOKEN && (err.message.indexOf('404') > -1 || err.message.indexOf('401') > -1)) {
              $error.innerHTML =
                '<p>⚠️ 无法拉取文档。仓库可能是私有库，请配置 Token</p>' +
                '<ol><li><a href="https://github.com/settings/tokens" target="_blank">创建 GitHub Token</a></li>' +
                '<li>填入 _config.yml 的 docs_repo.token</li></ol>';
            }
          }
        }
      });
  }

  // 直接通过 raw URL 获取文件内容(不走 API,不需要 Token 也可用公开库)
  // 对于私有库,改用 contents API 通过 Token 获取
  function fetchRawAndParse(fpath) {
    var rawUrl = RAW_BASE + fpath;
    var fetchOpts = {};
    if (TOKEN) {
      // 私有库:通过 contents API 获取(带认证)
      var contentsUrl = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + fpath;
      return fetch(contentsUrl, { headers: apiHeaders() })
        .then(function (r) {
          if (!r.ok) throw new Error('获取文件失败: ' + fpath + ' HTTP ' + r.status);
          return r.json();
        })
        .then(function (d) {
          var raw = atob(d.content.replace(/\s/g, ''));
          // 确保 base64 正确解码: 标准 base64
          try {
            raw = atob(d.content);
          } catch (e2) {
            // 某些特殊字符可能导致解码失败,尝试修复换行符
            try { raw = atob(d.content.replace(/\s/g, '')); } catch(e3) { raw = ''; }
          }
          return buildDoc(fpath, raw, d.html_url);
        });
    } else {
      // 公开库:直接用 raw URL
      return fetch(rawUrl)
        .then(function (r) {
          if (!r.ok) throw new Error('获取文件失败: ' + fpath + ' HTTP ' + r.status);
          return r.text();
        })
        .then(function (raw) {
          return buildDoc(fpath, raw, rawUrl);
        });
    }
  }

  function buildDoc(fpath, raw, url) {
    var meta = parseFM(raw);
    var name = fpath.split('/').pop();
    return {
      name:     name,
      path:     fpath,
      title:    meta.title  || name.replace(/\.md$/i, ''),
      date:     meta.date   || '',
      desc:     meta.description || '',
      category: meta.category || '',
      tags:     normTags(meta.tags),
      htmlUrl:  url || ''
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
        '<span class="doc-card-category">' + (d.path ? folderLabel(d.path) : '无分类') + '</span>' +
        (d.date ? '<span class="doc-card-date">' + d.date.substring(0, 10) + '</span>' : '') +
      '</div>' +
      '<h4 class="doc-card-title">' + esc(d.title) + '</h4>' +
      '<p class="doc-card-desc">' + (d.desc ? esc(d.desc) : '暂无描述') + '</p>' +
      tagsHtml +
    '</a>';
  }

  function folderLabel(fpath) {
    var parts = fpath.split('/');
    parts.pop(); // 去掉文件名
    return parts.length > 0 ? parts.join(' / ') : '根目录';
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
