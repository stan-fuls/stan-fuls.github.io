/**
 * DocsGitHubAPI - 从独立仓库 stan-fuls/knowledge-docs 拉取文档
 * 使用 GitHub REST API（无需鉴权，限速 60次/小时）
 *
 * 暴露接口：
 *   - fetchContents(path) → [{name, path, type, sha, ...}]
 *   - fetchFile(filePath)    → {content: "decoded", sha, ...}
 *   - parseFrontmatter(raw)  → {meta, body}
 */
var DocsGitHubAPI = (function () {
  'use strict';

  var API_BASE = 'https://api.github.com';
  var owner = 'stan-fuls';
  var repo = 'knowledge-docs';
  var branch = 'main';

  function apiUrl(endpoint) {
    return API_BASE + endpoint;
  }

  /** 获取仓库目录下的文件/目录列表（仅 *.md 文件） */
  function fetchContents(path) {
    var p = path || '';
    var url = apiUrl('/repos/' + owner + '/' + repo + '/contents/' + p + '?ref=' + branch);
    return fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (items) {
        if (!Array.isArray(items)) items = [items];
        // 仅保留 .md 文件，忽略目录
        return items.filter(function (item) {
          return item.type === 'file' && item.name.match(/\.md$/i);
        });
      });
  }

  /** 获取单个 Markdown 文件内容（base64 解码） */
  function fetchFile(filePath) {
    var url = apiUrl('/repos/' + owner + '/' + repo + '/contents/' + filePath + '?ref=' + branch);
    return fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.content) {
          data.decoded = decodeURIComponent(
            atob(data.content.replace(/\s/g, ''))
              .split('')
              .map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); })
              .join('')
          );
        }
        return data;
      });
  }

  /** 解析 YAML frontmatter，返回 { meta, body } */
  function parseFrontmatter(content) {
    var result = { meta: {}, body: content };
    if (!content) return result;
    var match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) return result;
    result.body = match[2];

    var metaStr = match[1];
    var meta = {};
    metaStr.split('\n').forEach(function (line) {
      var colonIdx = line.indexOf(':');
      if (colonIdx < 1) return;
      var key = line.substring(0, colonIdx).trim();
      var val = line.substring(colonIdx + 1).trim();
      // 去除引号
      val = val.replace(/^["']|["']$/g, '');
      // 处理数组 [a, b]
      if (val.match(/^\[.*\]$/)) {
        val = val.slice(1, -1).split(',').map(function (v) { return v.trim().replace(/^["']|["']$/g, ''); });
      }
      meta[key] = val;
    });
    result.meta = meta;
    return result;
  }

  return {
    fetchContents: fetchContents,
    fetchFile: fetchFile,
    parseFrontmatter: parseFrontmatter
  };
})();


/**
 * MD - 轻量级 Markdown → HTML 渲染器
 */
var MD = (function () {
  'use strict';

  var rules = [
    { re: /^### (.+)$/gm,        fn: '<h3>$1</h3>' },
    { re: /^## (.+)$/gm,         fn: '<h2>$1</h2>' },
    { re: /^# (.+)$/gm,          fn: '<h1>$1</h1>' },
    { re: /\*\*(.+?)\*\*/g,      fn: '<strong>$1</strong>' },
    { re: /\*(.+?)\*/g,          fn: '<em>$1</em>' },
    { re: /`{3}(\w*)\n([\s\S]*?)`{3}/g, fn: '<pre><code class="language-$1">$2</code></pre>' },
    { re: /`([^`]+)`/g,          fn: '<code>$1</code>' },
    { re: /\[([^\]]+)\]\(([^)]+)\)/g, fn: '<a href="$2" target="_blank" rel="noopener">$1</a>' },
    { re: /^---$/gm,             fn: '<hr>' },
    { re: /!\[([^\]]*)\]\(([^)]+)\)/g, fn: '<img src="$2" alt="$1" loading="lazy">' }
  ];

  function render(text) {
    if (!text) return '';
    var html = text;
    // 先处理代码块（特殊规则免转义），用占位符保护
    var codeBlocks = [];
    html = html.replace(/`{3}(\w*)\n([\s\S]*?)`{3}/g, function (m, lang, code) {
      codeBlocks.push('<pre><code class="language-' + lang + '">' + escapeHtml(code) + '</code></pre>');
      return '%%CODEBLOCK_' + (codeBlocks.length - 1) + '%%';
    });

    // 转义 HTML
    html = escapeHtml(html);

    // 恢复代码块
    html = html.replace(/%%CODEBLOCK_(\d+)%%/g, function (_, i) {
      return codeBlocks[parseInt(i)];
    });

    // 应用规则
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');

    // 空行 → 段落分隔
    html = html.replace(/\n\n+/g, '</p><p>');
    html = '<p>' + html + '</p>';
    // 清理被块级元素打断的 <p>
    html = html.replace(/<p><(h[123]|hr|pre|ul|ol|blockquote)/g, '<$1');
    html = html.replace(/<\/(h[123]|pre|ul|ol|blockquote)><\/p>/g, '</$1>');
    // 清理空段落
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { render: render, escapeHtml: escapeHtml };
})();


/**
 * DocsApp - 文档应用：加载、按时间段分组、搜索
 *
 * 暴露接口：
 *   - load()            初始化加载所有文档
 *   - search(query)     搜索过滤
 *   - timeFilter(range) 按时间范围过滤
 */
var DocsApp = (function () {
  'use strict';

  var allDocs = [];
  var currentDocs = [];
  var searchQuery = '';
  var currentTimeRange = 'all';

  /* ─── 时间段分组 ─── */
  function getTimeGroup(date) {
    if (!date) return 'earlier';
    var d = new Date(date);
    if (isNaN(d.getTime())) return 'earlier';
    var now = new Date();
    var monthDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthDiff <= 0) return 'this-month';
    if (monthDiff <= 1) return 'last-month';
    if (monthDiff <= 3) return 'three-months';
    if (monthDiff <= 6) return 'six-months';
    return 'earlier';
  }

  var GROUP_LABELS = {
    'this-month': '📅 本月',
    'last-month': '📅 上个月',
    'three-months': '📅 最近三个月',
    'six-months': '📅 最近半年',
    'earlier': '📅 更早'
  };

  var GROUP_ORDER = ['this-month', 'last-month', 'three-months', 'six-months', 'earlier'];

  /* ─── 时间过滤 ─── */
  function passesTimeFilter(date, range) {
    if (range === 'all') return true;
    if (!date) return range === 'all';
    var d = new Date(date);
    if (isNaN(d.getTime())) return true;
    var now = new Date();
    var cutoff = new Date(now);
    if (range === '1month') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (range === '3months') cutoff.setMonth(cutoff.getMonth() - 3);
    else if (range === '6months') cutoff.setMonth(cutoff.getMonth() - 6);
    return d >= cutoff;
  }

  /* ─── 搜索匹配 ─── */
  function matchesSearch(doc, query) {
    if (!query) return true;
    var q = query.toLowerCase();
    return [doc.name, doc.meta_title, doc.meta_description, doc.meta_category, (doc.meta_tags || []).join(' ')]
      .join(' ')
      .toLowerCase()
      .indexOf(q) !== -1;
  }

  /* ─── 构建视图 ─── */
  function buildView(docs) {
    // 按时间段分组
    var groups = {};
    GROUP_ORDER.forEach(function (g) { groups[g] = []; });
    docs.forEach(function (doc) {
      var g = getTimeGroup(doc.meta_date);
      if (groups[g]) {
        groups[g].push(doc);
      } else {
        groups['earlier'].push(doc);
      }
    });

    // 渲染
    var container = document.getElementById('docs-container');
    if (!container) return;

    var html = '';
    var hasAny = false;
    GROUP_ORDER.forEach(function (groupKey) {
      var list = groups[groupKey];
      if (!list || list.length === 0) return;
      // 组内按时间倒序排列
      list.sort(function (a, b) {
        var da = a.meta_date ? new Date(a.meta_date) : new Date(0);
        var db = b.meta_date ? new Date(b.meta_date) : new Date(0);
        return db - da;
      });
      hasAny = true;
      html += '<section class="doc-time-group">';
      html += '<h2 class="doc-time-group-heading">' + GROUP_LABELS[groupKey] + ' <span class="doc-time-group-count">' + list.length + ' 篇</span></h2>';
      html += '<div class="doc-card-grid">';
      list.forEach(function (doc) {
        var title = doc.meta_title || doc.name.replace(/\.md$/i, '');
        var desc = doc.meta_description || '';
        var date = doc.meta_date || '';
        var tags = Array.isArray(doc.meta_tags) ? doc.meta_tags : [];

        html += '<article class="doc-card" onclick="DocsApp.openDocument(\'' + escapeHtmlAttr(doc.path) + '\')">';
        html += '<div class="doc-card-body">';
        html += '<h3 class="doc-card-title">' + escapeHtmlAttr(title) + '</h3>';
        if (desc) html += '<p class="doc-card-desc">' + escapeHtmlAttr(desc) + '</p>';
        html += '<div class="doc-card-meta">';
        if (date) html += '<span class="doc-card-date">' + escapeHtmlAttr(date) + '</span>';
        if (tags.length > 0) {
          html += '<span class="doc-card-tags">';
          tags.forEach(function (t) {
            html += '<span class="doc-tag">' + escapeHtmlAttr(t) + '</span>';
          });
          html += '</span>';
        }
        html += '</div></div></article>';
      });
      html += '</div></section>';
    });

    if (!hasAny) {
      html = '<div class="docs-empty"><p>📭 没有找到匹配的文档</p><p class="docs-empty-hint">试试调整搜索关键词或时间范围</p></div>';
    }

    container.innerHTML = html;
  }

  function escapeHtmlAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ─── 过滤 ─── */
  function doFilter() {
    var filtered = allDocs.filter(function (doc) {
      return matchesSearch(doc, searchQuery) && passesTimeFilter(doc.meta_date, currentTimeRange);
    });
    currentDocs = filtered;
    buildView(filtered);
  }

  /* ─── 公开方法 ─── */

  function load() {
    var loadingEl = document.getElementById('docs-loading');
    var errorEl = document.getElementById('docs-error');
    var container = document.getElementById('docs-container');

    DocsGitHubAPI.fetchContents('')
      .then(function (files) {
        loadingEl.style.display = 'none';
        if (!files || files.length === 0) {
          container.innerHTML = '<div class="docs-empty"><p>📂 文档仓库中暂无 Markdown 文件</p><p class="docs-empty-hint">请前往 <a href="https://github.com/stan-fuls/knowledge-docs" target="_blank" rel="noopener">stan-fuls/knowledge-docs</a> 添加 <code>.md</code> 文档</p></div>';
          container.style.display = 'block';
          return;
        }

        // 为每个文件拉取内容并解析 frontmatter
        var fetches = files.map(function (file) {
          return DocsGitHubAPI.fetchFile(file.path).then(function (data) {
            var fm = DocsGitHubAPI.parseFrontmatter(data.decoded || '');
            return {
              name: file.name,
              path: file.path,
              size: file.size,
              raw_content: data.decoded || '',
              meta_title: fm.meta.title || '',
              meta_date: fm.meta.date || '',
              meta_description: fm.meta.description || '',
              meta_category: fm.meta.category || '',
              meta_tags: fm.meta.tags || [],
              fm: fm
            };
          }).catch(function () {
            // 某些文件无法读取时跳过
            return null;
          });
        });

        return Promise.all(fetches).then(function (results) {
          allDocs = results.filter(function (r) { return r !== null; });

          // 按时间倒序排列
          allDocs.sort(function (a, b) {
            var da = a.meta_date ? new Date(a.meta_date) : new Date(0);
            var db = b.meta_date ? new Date(b.meta_date) : new Date(0);
            return db - da;
          });

          container.style.display = 'block';
          doFilter();
        });
      })
      .catch(function () {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
      });
  }

  function search(query) {
    searchQuery = (query || '').trim();
    doFilter();
  }

  function timeFilter(range) {
    currentTimeRange = range || 'all';
    doFilter();
  }

  function openDocument(filePath) {
    var doc = allDocs.find(function (d) { return d.path === filePath; });
    if (!doc) return;

    var overlay = document.createElement('div');
    overlay.className = 'doc-overlay';
    overlay.onclick = function (e) {
      if (e.target === overlay) closeDocModal(overlay);
    };

    var content = doc.raw_content || '';
    if (doc.fm && doc.fm.body) content = doc.fm.body;

    overlay.innerHTML = [
      '<div class="doc-modal">',
      '<header class="doc-modal-header">',
      '<button class="doc-modal-close" onclick="this.closest(\'.doc-overlay\').remove();document.body.style.overflow=\'\'">×</button>',
      '<h2 class="doc-modal-title">' + MD.escapeHtml(doc.meta_title || doc.name.replace(/\.md$/i, '')) + '</h2>',
      '<div class="doc-modal-meta">',
      (doc.meta_date ? '<span class="doc-modal-date">' + MD.escapeHtml(doc.meta_date) + '</span>' : ''),
      (doc.meta_category ? '<span class="doc-modal-cat">' + MD.escapeHtml(doc.meta_category) + '</span>' : ''),
      '</div>',
      '</header>',
      '<article class="doc-modal-body">' + MD.render(content) + '</article>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  function closeDocModal(overlay) {
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
  }

  return {
    load: load,
    search: search,
    timeFilter: timeFilter,
    openDocument: openDocument
  };
})();


/* ─── 页面初始化 ─── */
(function () {
  var searchInput = document.getElementById('docs-search-input');
  var timeSelect = document.getElementById('docs-time-range');

  // 搜索
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      DocsApp.search(this.value);
    });
  }

  // 时间范围下拉
  if (timeSelect) {
    timeSelect.addEventListener('change', function () {
      DocsApp.timeFilter(this.value);
    });
  }

  // 初始化加载
  if (document.getElementById('docs-container')) {
    DocsApp.load();
  }
})();
