/* ================================================================
 * docs.js — 文档中心
 *   从 stan-fuls/knowledge-docs 拉取 Markdown 文档列表
 *   支持两种视图: 时间段分组 / 标签归档（自动识别已有/新标签）
 * ================================================================ */

(function () {
  'use strict';

  var REPO_OWNER = 'stan-fuls';
  var REPO_NAME  = 'knowledge-docs';
  var API_BASE   = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/';
  var CACHE_KEY  = 'docs_cache';
  var CACHE_TTL  = 10 * 60 * 1000;

  var allDocs     = [];
  var currentView = 'time'; // 'time' | 'tag'

  // DOM 引用
  var $container  = null;
  var $loading    = null;
  var $error      = null;
  var $search     = null;
  var $timeRange  = null;
  var $timeFilter = null;
  var $btnTime    = null;
  var $btnTag     = null;

  function init() {
    $container  = document.getElementById('docs-container');
    $loading    = document.getElementById('docs-loading');
    $error      = document.getElementById('docs-error');
    $search     = document.getElementById('docs-search-input');
    $timeRange  = document.getElementById('docs-time-range');
    $timeFilter = document.getElementById('docs-time-filter');
    $btnTime    = document.getElementById('docs-view-time');
    $btnTag     = document.getElementById('docs-view-tag');

    if ($search)    $search.addEventListener('input', render);
    if ($timeRange) $timeRange.addEventListener('change', render);
    if ($btnTime)   $btnTime.addEventListener('click', function () { switchView('time'); });
    if ($btnTag)    $btnTag.addEventListener('click',  function () { switchView('tag');  });

    loadDocs();
  }

  // --------------- 加载 ---------------

  function loadDocs() {
    var cached = getCache();
    if (cached && cached.length > 0) {
      allDocs = cached;
      showContainer();
      render();
    }

    fetch(API_BASE)
      .then(function (res) {
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
        showContainer();
        render();
      })
      .catch(function (err) {
        console.warn('docs.js: 拉取失败，尝试缓存:', err.message);
        if (allDocs.length > 0) {
          showContainer();
          render();
        } else {
          if ($loading) $loading.style.display = 'none';
          if ($error)   $error.style.display   = 'block';
        }
      });
  }

  function fetchMeta(file) {
    return fetch(file.url)
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
          status:   meta.status || '',
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

  function showContainer() {
    if ($loading) $loading.style.display = 'none';
    if ($container) $container.style.display = 'block';
  }

  // --------------- 视图切换 ---------------

  function switchView(view) {
    currentView = view;
    if ($btnTime) $btnTime.classList.toggle('is-active', view === 'time');
    if ($btnTag)  $btnTag.classList.toggle('is-active',  view === 'tag');
    if ($timeFilter) $timeFilter.style.display = (view === 'tag') ? 'none' : '';
    render();
  }

  // --------------- 渲染 ---------------

  function render() {
    var filtered = filterDocs(allDocs);
    if (currentView === 'tag') {
      $container.innerHTML = buildTagView(filtered);
    } else {
      $container.innerHTML = buildTimeView(filtered);
    }
  }

  function filterDocs(docs) {
    var q = $search ? $search.value.trim().toLowerCase() : '';
    if (!q) return docs;
    return docs.filter(function (d) {
      return d.title.toLowerCase().indexOf(q) > -1 ||
             d.desc.toLowerCase().indexOf(q)  > -1 ||
             d.tags.some(function (t) { return t.toLowerCase().indexOf(q) > -1; });
    });
  }

  // ==============================================================
  //  时间段视图
  // ==============================================================

  function buildTimeView(docs) {
    var range = $timeRange ? $timeRange.value : 'all';
    var groups = groupByTime(docs);

    if (range !== 'all') {
      groups = groups.filter(function (g) { return passesFilter(g.key, range); });
    }

    if (groups.length === 0) {
      return '<p class="docs-empty">📭 该时间段暂无文档</p>';
    }

    return groups.map(function (g) {
      return '<div class="doc-time-group">' +
        '<h3 class="doc-group-heading">' + g.label + ' <span class="doc-count">' + g.docs.length + '</span></h3>' +
        '<div class="doc-card-grid">' + g.docs.map(card).join('') + '</div></div>';
    }).join('');
  }

  function getTimeGroup(dateStr) {
    if (!dateStr) return { key: 'unknown', label: '日期未知' };
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return { key: 'unknown', label: '日期未知' };
    var now  = new Date();
    var dm   = d.getMonth(); var dy = d.getFullYear();
    var nm   = now.getMonth(); var ny = now.getFullYear();
    if (dy === ny && dm === nm) return { key: 'thisMonth',    label: '本月' };
    var prev = new Date(ny, nm - 1, 1);
    if (dy === prev.getFullYear() && dm === prev.getMonth()) return { key: 'lastMonth', label: '上个月' };
    var m3 = new Date(ny, nm - 3, 1);
    if (d >= m3) return { key: 'last3Months', label: '最近三个月' };
    var m6 = new Date(ny, nm - 6, 1);
    if (d >= m6) return { key: 'last6Months', label: '最近半年' };
    return { key: 'older', label: '更早' };
  }

  function groupByTime(docs) {
    var order = ['thisMonth', 'lastMonth', 'last3Months', 'last6Months', 'older', 'unknown'];
    var map = {};
    docs.forEach(function (d) {
      var g = getTimeGroup(d.date);
      if (!map[g.key]) map[g.key] = { key: g.key, label: g.label, docs: [] };
      map[g.key].docs.push(d);
    });
    return order.filter(function (k) { return map[k] && map[k].docs.length > 0; }).map(function (k) { return map[k]; });
  }

  function passesFilter(key, range) {
    if (range === 'all')      return true;
    if (range === '6months')  return ['thisMonth','lastMonth','last3Months','last6Months'].indexOf(key) > -1;
    if (range === '3months')  return ['thisMonth','lastMonth','last3Months'].indexOf(key) > -1;
    if (range === '1month')   return ['thisMonth','lastMonth'].indexOf(key) > -1;
    return true;
  }

  // ==============================================================
  //  标签归档视图 — 核心: 已有标签归入 新标签自动建组
  // ==============================================================

  function buildTagView(docs) {
    if (docs.length === 0) {
      return '<p class="docs-empty">📭 暂无文档</p>';
    }

    var tagMap = {};
    var untagged = [];

    docs.forEach(function (d) {
      if (d.tags.length === 0) {
        untagged.push(d);
      } else {
        d.tags.forEach(function (t) {
          if (!tagMap[t]) tagMap[t] = [];
          tagMap[t].push(d);
        });
      }
    });

    // 标签名按字母排序 (中文按 localeCompare)
    var tagNames = Object.keys(tagMap).sort(function (a, b) {
      return a.localeCompare(b, 'zh-CN');
    });

    var html = '';

    tagNames.forEach(function (tag) {
      var list = tagMap[tag];
      html += '<div class="doc-tag-group">' +
        '<h3 class="doc-group-heading doc-tag-heading">#' + esc(tag) + ' <span class="doc-count">' + list.length + '</span></h3>' +
        '<div class="doc-card-grid">' + list.map(card).join('') + '</div></div>';
    });

    if (untagged.length > 0) {
      html += '<div class="doc-tag-group doc-tag-untagged">' +
        '<h3 class="doc-group-heading">📋 未分类 <span class="doc-count">' + untagged.length + '</span></h3>' +
        '<div class="doc-card-grid">' + untagged.map(card).join('') + '</div></div>';
    }

    return html;
  }

  // --------------- 文档卡片 ---------------

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
