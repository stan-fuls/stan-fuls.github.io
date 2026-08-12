/* ================================================================
 * docs.js — 文档中心
 *
 * 数据源: /assets/data/docs-index.json (CI 构建时由 gen-docs-index.js 生成)
 * 展示:   按时间段(年-月)分组的列表
 * 点击:   跳转到对应文档的 web 页面 URL
 * ================================================================ */

(function () {
  'use strict';

  var CONFIG    = window.DOCS_REPO_CONFIG || {};
  var SITE_BASE = CONFIG.siteBase || '';

  var INDEX_URL = SITE_BASE + '/assets/data/docs-index.json';

  var CACHE_KEY = 'docs_cache_v5';
  var CACHE_TTL = 10 * 60 * 1000;

  var allDocs  = [];
  var $list    = null;
  var $loading = null;
  var $error   = null;
  var $search  = null;

  // ---- 初始化 ----

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
    fetch(INDEX_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('index ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data) || data.length === 0) throw new Error('empty index');
        allDocs = data.map(normalizeEntry).filter(Boolean);
        finishLoad();
      })
      .catch(function (err) {
        showError(err);
      });
  }

  function finishLoad() {
    if (allDocs.length > 0) {
      setCache(allDocs);
      showList();
      render();
    }
  }

  function normalizeEntry(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    // 优先 webUrl（指向站内页面），其次 url（GitHub blob）
    var target = raw.webUrl || raw.url || '';
    return {
      title:    raw.title || (raw.path || 'doc-' + idx).replace(/\.md$/i, '').split('/').pop(),
      path:     raw.path || '',
      date:     raw.date || '',
      desc:     raw.description || raw.desc || '',
      category: raw.category || '',
      tags:     normTags(raw.tags),
      href:     target,
      isInternal: !!raw.webUrl,
    };
  }

  function normTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags.map(function (t) { return String(t).trim(); }).filter(Boolean);
    return String(tags).split(',').map(function (t) { return t.trim().replace(/^["']|["']$/g, ''); }).filter(Boolean);
  }

  // ---- 搜索 ----

  function filterDocs(docs) {
    var q = $search ? $search.value.trim().toLowerCase() : '';
    if (!q) return docs;
    return docs.filter(function (d) {
      return d.title.toLowerCase().indexOf(q) > -1 ||
             d.desc.toLowerCase().indexOf(q)  > -1 ||
             d.tags.some(function (t) { return t.toLowerCase().indexOf(q) > -1; });
    });
  }

  // ---- 渲染: 按时间段分组 ----

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
      g.items.forEach(function (d) {
        var dateStr = d.date ? d.date.substring(0, 10) : '';
        var hrefAttr = d.href ? (' href="' + esc(d.href) + '"') : ' href="#"';
        var targetAttr = d.isInternal ? '' : ' target="_blank" rel="noopener"';
        html += '<li class="doc-item">';
        html +=   '<a class="doc-item-link"' + hrefAttr + targetAttr + '>';
        html +=     '<div class="doc-item-main">';
        html +=       '<time class="doc-item-date">' + esc(dateStr) + '</time>';
        html +=       '<span class="doc-item-title">' + esc(d.title) + '</span>';
        if (d.category) html += '<span class="doc-item-category">' + esc(d.category) + '</span>';
        html +=     '</div>';
        if (d.desc) html += '<p class="doc-item-desc">' + esc(d.desc) + '</p>';
        if (d.tags.length > 0) {
          html += '<div class="doc-item-tags">' +
            d.tags.map(function (t) { return '<span class="doc-item-tag">#' + esc(t) + '</span>'; }).join('') +
            '</div>';
        }
        html +=   '</a>';
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

  // ---- 缓存 / 辅助 ----

  function showError(err) {
    if (allDocs.length > 0) { showList(); render(); return; }
    if ($loading) $loading.style.display = 'none';
    if (!$error) return;
    $error.style.display = 'block';
    var msg = err.message || String(err);
    $error.innerHTML = '<p>⚠️ 无法加载文档列表</p>' +
      '<p style="color:#78350f;">原因: ' + esc(msg) + '</p>' +
      '<p>请确认 <code>scripts/gen-docs-index.js</code> 已在 CI 中正确运行。</p>';
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