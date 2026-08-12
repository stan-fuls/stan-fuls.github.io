/* ================================================================
 * docs.js — 文档中心
 *
 * 数据源: /assets/data/docs-index.json (CI 构建时由 gen-docs-index.js 生成)
 * 展示:   按时间段(年-月)分组的列表
 * 点击:   弹出模态窗口查看文档内容
 * ================================================================ */

(function () {
  'use strict';

  var CONFIG   = window.DOCS_REPO_CONFIG || {};
  var SITE_BASE = CONFIG.siteBase || '';

  var INDEX_URL = SITE_BASE + '/assets/data/docs-index.json';

  // 本仓库固定信息
  var GITHUB_MASTER  = 'https://github.com/stan-fuls/stan-fuls.github.io/blob/master/';
  var RAW_BASE       = 'https://raw.githubusercontent.com/stan-fuls/stan-fuls.github.io/master/';

  var CACHE_KEY = 'docs_cache_v4';
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
    if ($list)   $list.addEventListener('click', onDocClick);

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
    return {
      title:    raw.title || (raw.path || 'doc-' + idx).replace(/\.md$/i, '').split('/').pop(),
      path:     raw.path || '',
      date:     raw.date || '',
      desc:     raw.description || raw.desc || '',
      category: raw.category || '',
      tags:     normTags(raw.tags),
      htmlUrl:  raw.url || (GITHUB_MASTER + (raw.path || '')),
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
      g.items.forEach(function (d, i) {
        var dateStr = d.date ? d.date.substring(0, 10) : '';
        var srcAttr = btoa(unescape(encodeURIComponent(JSON.stringify(d))));
        html += '<li class="doc-item" data-index="' + i + '" data-doc="' + srcAttr + '">';
        html +=   '<div class="doc-item-main">';
        html +=     '<time class="doc-item-date">' + esc(dateStr) + '</time>';
        html +=     '<span class="doc-item-title">' + esc(d.title) + '</span>';
        if (d.category) html += '<span class="doc-item-category">' + esc(d.category) + '</span>';
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

  // ---- 模态窗口 ----

  function onDocClick(e) {
    var item = e.target.closest('.doc-item');
    if (!item) return;
    var src = item.getAttribute('data-doc');
    if (!src) return;
    var doc;
    try {
      doc = JSON.parse(decodeURIComponent(escape(atob(src))));
    } catch (err) { return; }
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

    modal.querySelector('.doc-modal-close').addEventListener('click', removeModal);

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
      .catch(function (err) {
        if (loadingDiv) loadingDiv.style.display = 'none';
        var reason = (err && err.message) ? err.message : '网络错误';
        if (doc.desc) {
          contentDiv.innerHTML = '<div class="doc-modal-desc-only">' +
            '<p>📖 <strong>摘要</strong></p>' +
            '<p>' + esc(doc.desc) + '</p>' +
            '<p style="margin-top:16px;color:var(--color-text-light);font-size:0.88rem;">' +
            '⚠️ 正文预览失败 (' + esc(reason) + ')，点击下方按钮查看完整文件。</p>' +
            '</div>';
        } else {
          contentDiv.innerHTML = '<div class="doc-modal-desc-only">' +
            '<p style="color:var(--color-text-light);font-size:0.88rem;">' +
            '⚠️ 正文预览失败 (' + esc(reason) + ')，点击下方按钮查看完整文件。</p>' +
            '</div>';
        }
        contentDiv.style.display = 'block';
      });
  }

  function renderMarkdown(raw) {
    var body = raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
    var html = body
      .replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
        return '<pre><code class="language-' + esc(lang) + '">' + esc(code.trim()) + '</code></pre>';
      })
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
      .replace(/^---$/gm, '<hr>')
      .replace(/^(\s*)- (.+)$/gm, '<li>$2</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/^(?!<[a-z])(.+)$/gm, '<p>$1</p>')
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
      .replace(/<p>\s*<\/p>/g, '');
    return html;
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

  function removeModal() {
    var el = document.querySelector('.doc-overlay');
    if (el) el.remove();
    document.body.style.overflow = '';
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
