/* ================================================================
 * docs.js — 文档中心
 *
 * 数据源:
 *   1. /assets/data/docs-index.json  (静态索引,GitHub Actions 自动同步)
 *   2. GitHub Trees API (回退)
 *
 * 展示: 按时间段(年-月)分组的列表
 * 点击: 弹出模态窗口,不跳转仓库
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
    // 委托点击,拦截文档条目
    if ($list) $list.addEventListener('click', onDocClick);

    var cached = getCache();
    if (cached && cached.length > 0) {
      allDocs = cached;
      showList();
      render();
    }
    loadDocs();
  }

  function loadDocs() {
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
      .catch(function () { loadViaAPI(); });
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
        allDocs = docs.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
        finishLoad();
      })
      .catch(function (err) { showError(err); });
  }

  function finishLoad() {
    if (allDocs.length > 0) {
      allDocs.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      setCache(allDocs);
      showList();
      render();
    }
  }

  function normalizeIndexEntry(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      title:    raw.title || (raw.path || 'doc-' + idx).replace(/\.md$/i, '').split('/').pop(),
      path:     raw.path || '',
      date:     raw.date || '',
      desc:     raw.description || raw.desc || '',
      tags:     normTags(raw.tags),
      category: raw.category || '',
      htmlUrl:  raw.url || raw.htmlUrl || ('https://github.com/' + OWNER + '/' + REPO + '/blob/' + BRANCH + '/' + raw.path)
    };
  }

  function fetchRawAndParse(fpath) {
    if (TOKEN) {
      var contentsUrl = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + fpath;
      return fetch(contentsUrl, { headers: apiHeaders() })
        .then(function (r) { if (!r.ok) throw new Error('fail: ' + fpath); return r.json(); })
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
      .then(function (r) { if (!r.ok) throw new Error('fail: ' + fpath); return r.text(); })
      .then(function (raw) { return buildDoc(fpath, raw, rawUrl); });
  }

  function buildDoc(fpath, raw, url) {
    var meta = parseFM(raw);
    return {
      title:    meta.title  || fpath.split('/').pop().replace(/\.md$/i, ''),
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
    return String(tags).split(',').map(function (t) { return t.trim().replace(/^["']|["']$/g, ''); }).filter(Boolean);
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

  function showError(err) {
    if (allDocs.length > 0) { showList(); render(); return; }
    if ($loading) $loading.style.display = 'none';
    if (!$error) return;
    $error.style.display = 'block';
    var msg = err.message || String(err);
    var reason = '未知错误';
    if (msg.indexOf('404') > -1) reason = '仓库不可访问(私有库需 Token)';
    else if (msg.indexOf('401') > -1) reason = 'Token 无效';
    else if (msg.indexOf('403') > -1) reason = 'API 频率超限';
    else if (msg.indexOf('HTTP') > -1) reason = msg;
    $error.innerHTML = '<p>⚠️ 无法加载文档列表</p>' +
      '<p style="color:#78350f;">原因: ' + esc(reason) + '</p>' +
      '<p>请确认 <code>scripts/gen-docs-index.js</code> 已在 Actions 中正确执行,<br>生成的 <code>assets/data/docs-index.json</code> 已提交。</p>';
  }

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
    if ($list)    $list.style.display    = 'block';
  }

  // ---- 搜索 ----
  function filterDocs(docs) {
    var q = $search ? $search.value.trim().toLowerCase() : '';
    if (!q) return docs;
    return docs.filter(function (d) {
      return d.title.toLowerCase().indexOf(q) > -1 ||
             d.desc.toLowerCase().indexOf(q) > -1 ||
             d.tags.some(function (t) { return t.toLowerCase().indexOf(q) > -1; });
    });
  }

  // ---- 渲染: 按时间段 (YYYY年M月) 分组 ----
  function render() {
    if (!$list) return;
    var filtered = filterDocs(allDocs);

    if (filtered.length === 0) {
      $list.innerHTML = '<p class="docs-empty">📭 暂无匹配的文档</p>';
      return;
    }

    var groups = groupByPeriod(filtered);
    var html = '';
    groups.forEach(function (g) {
      html += '<section class="doc-period">';
      html += '<h2 class="doc-period-title">' + esc(g.label) + ' <span class="doc-period-count">' + g.items.length + ' 篇</span></h2>';
      html += '<ul class="doc-item-list">';
      g.items.forEach(function (d, i) {
        var dateStr = d.date ? d.date.substring(0, 10) : '';
        html += '<li class="doc-item" data-index="' + i + '" data-src="' + esc(JSON.stringify(d)) + '">';
        html +=   '<div class="doc-item-main">';
        html +=     '<time class="doc-item-date">' + esc(dateStr) + '</time>';
        html +=     '<span class="doc-item-title">' + esc(d.title) + '</span>';
        html +=     '<span class="doc-item-category">' + esc(d.category || folderLabel(d)) + '</span>';
        html +=   '</div>';
        if (d.desc) html += '<p class="doc-item-desc">' + esc(d.desc) + '</p>';
        if (d.tags.length > 0) {
          html += '<div class="doc-item-tags">' +
            d.tags.map(function (t) { return '<span class="doc-item-tag">#' + esc(t) + '</span>'; }).join('') +
            '</div>';
        }
        html += '</li>';
      });
      html += '</ul></section>';
    });
    $list.innerHTML = html;
  }

  function groupByPeriod(docs) {
    var map = {};
    docs.forEach(function (d) {
      var key = '未知时间';
      if (d.date) {
        var parts = d.date.substring(0, 7).split('-');
        if (parts.length === 2) key = parts[0] + '年' + parseInt(parts[1], 10) + '月';
      }
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    var order = Object.keys(map).sort(function (a, b) {
      if (a === '未知时间') return 1;
      if (b === '未知时间') return -1;
      return b.localeCompare(a);
    });
    return order.map(function (k) { return { label: k, items: map[k] }; });
  }

  function folderLabel(d) {
    if (!d.path) return '';
    var parts = d.path.split('/');
    parts.pop();
    return parts.length > 0 ? parts.join('/') : '';
  }

  // ---- 模态窗口 ----
  function onDocClick(e) {
    var item = e.target.closest('.doc-item');
    if (!item) return;
    var src = item.getAttribute('data-src');
    if (!src) return;
    var doc;
    try { doc = JSON.parse(src); } catch (err) { return; }
    openModal(doc);
  }

  function openModal(doc) {
    removeModal();

    var overlay = document.createElement('div');
    overlay.className = 'doc-overlay';
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) removeModal();
    });

    var modal = document.createElement('div');
    modal.className = 'doc-modal';

    var tagsHtml = '';
    if (doc.tags && doc.tags.length > 0) {
      tagsHtml = '<div class="doc-modal-tags">' +
        doc.tags.map(function (t) { return '<span class="doc-item-tag">#' + esc(t) + '</span>'; }).join('') +
        '</div>';
    }

    modal.innerHTML =
      '<div class="doc-modal-header">' +
        '<h2 class="doc-modal-title">' + esc(doc.title) + '</h2>' +
        '<button class="doc-modal-close" title="关闭">✕</button>' +
      '</div>' +
      '<div class="doc-modal-meta">' +
        (doc.date ? '<span class="doc-modal-date">📅 ' + doc.date.substring(0, 10) + '</span>' : '') +
        (doc.category ? '<span class="doc-modal-cat">' + esc(doc.category) + '</span>' : '') +
        '<span class="doc-modal-path" title="文件路径">📄 ' + esc(doc.path) + '</span>' +
      '</div>' +
      tagsHtml +
      '<div class="doc-modal-body">' +
        '<div class="doc-modal-loading"><span class="loading-spinner"></span> 正在加载文档内容…</div>' +
        '<div class="doc-modal-content" style="display:none;"></div>' +
      '</div>' +
      '<div class="doc-modal-footer">' +
        '<a href="' + esc(doc.htmlUrl) + '" target="_blank" rel="noopener" class="btn">在 GitHub 查看原始文件 →</a>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // 绑定关闭
    modal.querySelector('.doc-modal-close').addEventListener('click', removeModal);

    // 尝试加载原始内容
    fetchDocContent(doc, modal);
  }

  function fetchDocContent(doc, modal) {
    var contentDiv = modal.querySelector('.doc-modal-content');
    var loadingDiv = modal.querySelector('.doc-modal-loading');

    var rawUrl = RAW_BASE + doc.path;

    fetch(rawUrl)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (raw) {
        var html = renderMarkdown(raw);
        contentDiv.innerHTML = html;
        contentDiv.style.display = 'block';
        if (loadingDiv) loadingDiv.style.display = 'none';
      })
      .catch(function () {
        // 私有仓库 raw 不可访问 → 显示摘要
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (doc.desc) {
          contentDiv.innerHTML = '<div class="doc-modal-desc-only">' +
            '<p>📖 <strong>摘要</strong></p>' +
            '<p>' + esc(doc.desc) + '</p>' +
            '<p style="margin-top:16px;color:var(--color-text-light);font-size:0.88rem;">' +
            '⚠️ 文档内容无法直接获取（私有仓库），点击下方按钮查看完整文件。</p>' +
            '</div>';
        } else {
          contentDiv.innerHTML = '<div class="doc-modal-desc-only">' +
            '<p style="color:var(--color-text-light);font-size:0.88rem;">' +
            '⚠️ 文档内容无法直接获取（私有仓库），点击下方按钮查看完整文件。</p>' +
            '</div>';
        }
        contentDiv.style.display = 'block';
      });
  }

  function renderMarkdown(raw) {
    // 移除 frontmatter
    var body = raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');

    // 简单 markdown → HTML
    var html = body
      // 代码块
      .replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
        return '<pre><code class="language-' + esc(lang) + '">' + esc(code.trim()) + '</code></pre>';
      })
      // 行内代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 标题
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      // 粗体/斜体
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // 链接
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      // 图片
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
      // 水平线
      .replace(/^---$/gm, '<hr>')
      // 无序列表
      .replace(/^(\s*)- (.+)$/gm, function (_, indent, text) {
        return '<li>' + text + '</li>';
      })
      // 有序列表 (简单处理)
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // 段落 (非空行,非标签开头)
      .replace(/^(?!<[a-z])(.+)$/gm, '<p>$1</p>')
      // 包裹连续的 <li>
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
      // 清理空段
      .replace(/<p>\s*<\/p>/g, '');

    return html;
  }

  function removeModal() {
    var el = document.querySelector('.doc-overlay');
    if (el) el.remove();
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  function esc(s) {
    if (!s) return '';
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
