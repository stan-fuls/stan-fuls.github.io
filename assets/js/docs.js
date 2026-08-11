/* ============================================
 * Document Management System
 * GitHub API-based document browser for knowledge docs
 * ============================================ */

(function () {
  'use strict';

  // =============================================
  // Configuration — Auto-detected from meta tags
  // =============================================
  var CONFIG = {
    owner: 'stan-fuls',
    repo: 'knowledge-docs',
    branch: 'main',
    basePath: '',
    perPage: 12,
    // GitHub token (set via ?token=XXX or GITHUB_TOKEN env at build time)
    token: '',
    cacheTTL: 5 * 60 * 1000 // 5-minute cache
  };

  // Read config from page meta tags
  function loadConfigFromMeta() {
    var metaRepo = document.querySelector('meta[name="docs-repo"]');
    var metaOwner = document.querySelector('meta[name="docs-owner"]');
    var metaBranch = document.querySelector('meta[name="docs-branch"]');
    var metaBasePath = document.querySelector('meta[name="docs-base-path"]');
    var metaToken = document.querySelector('meta[name="docs-token"]');

    if (metaOwner) CONFIG.owner = metaOwner.content;
    if (metaRepo) CONFIG.repo = metaRepo.content;
    if (metaBranch) CONFIG.branch = metaBranch.content;
    if (metaBasePath) CONFIG.basePath = metaBasePath.content;
    if (metaToken && metaToken.content) CONFIG.token = metaToken.content;

    // Check URL params for token (for personal use)
    var params = new URLSearchParams(window.location.search);
    if (params.get('token')) CONFIG.token = params.get('token');
  }

  // =============================================
  // GitHub API Client
  // =============================================
  var GitHubAPI = {
    /**
     * Fetch directory contents from GitHub API
     * @param {string} path - Directory path in the repo
     * @returns {Promise<Array>}
     */
    fetchContents: function (path) {
      var apiPath = path || CONFIG.basePath || '';
      var url = 'https://api.github.com/repos/' + CONFIG.owner + '/' +
                CONFIG.repo + '/contents/' + apiPath + '?ref=' + CONFIG.branch;

      var headers = { 'Accept': 'application/vnd.github.v3+json' };
      if (CONFIG.token) {
        headers['Authorization'] = 'token ' + CONFIG.token;
      }

      return fetch(url, { headers: headers })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('GitHub API error: ' + response.status + ' ' + response.statusText);
          }
          return response.json();
        });
    },

    /**
     * Fetch a single file's content (decoded from base64)
     * @param {string} filePath - Full path to the file
     * @returns {Promise<{content, sha, path, name, size}>}
     */
    fetchFile: function (filePath) {
      var url = 'https://api.github.com/repos/' + CONFIG.owner + '/' +
                CONFIG.repo + '/contents/' + filePath + '?ref=' + CONFIG.branch;

      var headers = { 'Accept': 'application/vnd.github.v3+json' };
      if (CONFIG.token) {
        headers['Authorization'] = 'token ' + CONFIG.token;
      }

      return fetch(url, { headers: headers })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('GitHub API error: ' + response.status);
          }
          return response.json();
        })
        .then(function (data) {
          if (data.content && data.encoding === 'base64') {
            var decoded = decodeURIComponent(
              atob(data.content.replace(/\s/g, ''))
                .split('')
                .map(function (c) {
                  return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                })
                .join('')
            );
            data.decodedContent = decoded;
          }
          return data;
        });
    },

    /**
     * Parse markdown YAML frontmatter
     * @param {string} content - Raw markdown with optional frontmatter
     * @returns {{ meta: Object, body: string }}
     */
    parseFrontmatter: function (content) {
      var meta = {};
      var body = content;

      var match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      if (match) {
        body = match[2];
        var yamlStr = match[1];
        yamlStr.split('\n').forEach(function (line) {
          var kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
          if (kv) {
            var key = kv[1];
            var val = kv[2].trim();
            // Parse arrays
            if (val.match(/^\[.*\]$/)) {
              try {
                meta[key] = val.slice(1, -1).split(',').map(function (s) { return s.trim().replace(/['"]/g, ''); });
              } catch (e) {
                meta[key] = val;
              }
            } else {
              meta[key] = val.replace(/^['"]|['"]$/g, '');
            }
          }
        });
      }

      return { meta: meta, body: body };
    }
  };

  // =============================================
  // Markdown Renderer (lightweight)
  // =============================================
  var MD = {
    render: function (text) {
      if (!text) return '';
      var html = text;

      // Headers
      html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

      // Bold / Italic
      html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

      // Inline code
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

      // Links
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

      // Images
      html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

      // Horizontal rules
      html = html.replace(/^---+$/gm, '<hr>');

      // Blockquotes
      html = html.replace(/^>\s?(.+)$/gm, '<blockquote>$1</blockquote>');

      // Code blocks (fenced)
      html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
        return '<pre><code class="lang-' + lang + '">' +
               code.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
               '</code></pre>';
      });

      // Lists
      html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>[\s\S]*?<\/li>)/g, function (match) {
        if (match.indexOf('\n<li>') > -1) {
          return '<ul>\n' + match + '\n</ul>';
        }
        return '<ul>\n' + match + '\n</ul>';
      });

      // Tables (basic)
      html = html.replace(/^\|(.+)\|$/gm, function (match) {
        var cells = match.split('|').filter(Boolean);
        if (cells.every(function (c) { return c.trim().match(/^-+$/); })) return '';
        return '<tr>' + cells.map(function (c) {
          return '<td>' + c.trim() + '</td>';
        }).join('') + '</tr>';
      });
      html = html.replace(/(<tr>[\s\S]*?<\/tr>)/g, function (match) {
        return '<table><tbody>' + match + '</tbody></table>';
      });

      // Paragraphs (lines not inside tags)
      var lines = html.split('\n');
      var result = [];
      var inBlock = false;
      lines.forEach(function (line) {
        var trimmed = line.trim();
        if (trimmed.match(/^<(h[1-4]|pre|ul|ol|li|table|hr|blockquote|img|code)/) || trimmed === '') {
          if (!inBlock && trimmed !== '' && !trimmed.match(/^<(h[1-4]|hr|img)/)) {
            inBlock = true;
          }
          result.push(line);
        } else if (trimmed.match(/^<\/(pre|ul|ol|table|blockquote)>/)) {
          inBlock = false;
          result.push(line);
        } else if (!inBlock && trimmed !== '') {
          result.push('<p>' + trimmed + '</p>');
        } else {
          result.push(line);
        }
      });
      html = result.join('\n');

      // Clean up: remove consecutive empty blockquotes caused by newlines
      html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');

      return html;
    }
  };

  // =============================================
  // Cache Helper
  // =============================================
  var Cache = {
    get: function (key) {
      try {
        var item = sessionStorage.getItem('docs_' + key);
        if (!item) return null;
        var data = JSON.parse(item);
        if (Date.now() - data.timestamp > CONFIG.cacheTTL) {
          sessionStorage.removeItem('docs_' + key);
          return null;
        }
        return data.value;
      } catch (e) {
        return null;
      }
    },
    set: function (key, value) {
      try {
        sessionStorage.setItem('docs_' + key, JSON.stringify({
          value: value,
          timestamp: Date.now()
        }));
      } catch (e) { /* quota exceeded, ignore */ }
    },
    remove: function (key) {
      sessionStorage.removeItem('docs_' + key);
    }
  };

  // =============================================
  // UI Helpers
  // =============================================
  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || '');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
  }

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getFileIcon(name) {
    if (/\.md$/i.test(name)) return '\u{1F4DD}'; // memo
    if (/\.(js|ts|jsx|tsx)$/i.test(name)) return '\u{1F4DC}'; // scroll
    if (/\.(py|rb|go|rs|java)$/i.test(name)) return '\u{1F40D}'; // snake
    if (/\.(html|css|scss)$/i.test(name)) return '\u{1F310}'; // globe
    if (/\.(json|xml|yaml|yml|toml)$/i.test(name)) return '\u{1F4CB}'; // clipboard
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name)) return '\u{1F5BC}'; // picture
    if (/\.(pdf)$/i.test(name)) return '\u{1F4D5}'; // book
    if (/\.(zip|tar|gz|rar)$/i.test(name)) return '\u{1F4E6}'; // package
    return '\u{1F4C4}'; // page
  }

  // =============================================
  // Document App (Main Controller)
  // =============================================
  var App = {
    allDocs: [],
    filteredDocs: [],
    currentPage: 1,
    selectedDoc: null,
    categories: [],
    tags: [],

    /**
     * Initialize the document browser
     */
    init: function () {
      loadConfigFromMeta();
      this.bindEvents();
      this.loadDocuments();
    },

    bindEvents: function () {
      var self = this;
      var searchEl = document.getElementById('docs-search');
      var filterEl = document.getElementById('docs-category-filter');

      if (searchEl) {
        var debounceTimer;
        searchEl.addEventListener('input', function () {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(function () {
            self.filterDocs();
          }, 300);
        });
      }

      if (filterEl) {
        filterEl.addEventListener('change', function () {
          self.filterDocs();
        });
      }
    },

    /**
     * Load documents from GitHub API with caching
     */
    loadDocuments: function () {
      var self = this;
      var container = document.getElementById('docs-container');

      // Try cache first
      var cached = Cache.get('docs_list');
      if (cached) {
        this.allDocs = cached;
        this.afterLoad();
        return;
      }

      if (container) {
        container.innerHTML = '<div class="docs-empty"><div class="loading-spinner"></div><p>正在加载文档...</p></div>';
      }

      GitHubAPI.fetchContents(CONFIG.basePath)
        .then(function (data) {
          // Filter: only .md files, exclude directories starting with _
          var mdFiles = data.filter(function (item) {
            return item.type === 'file' &&
                   /\.md$/i.test(item.name) &&
                   !item.name.startsWith('_') &&
                   !item.name.startsWith('.');
          });

          // Also accept directories as categories (fetch their contents too)
          var dirs = data.filter(function (item) {
            return item.type === 'dir' && !item.name.startsWith('_') && !item.name.startsWith('.');
          });

          // Convert files to doc objects
          var docs = mdFiles.map(function (file) {
            return {
              path: file.path,
              name: file.name.replace(/\.md$/i, ''),
              fileName: file.name,
              size: file.size,
              type: 'file',
              category: '',
              tags: [],
              description: '',
              lastModified: null
            };
          });

          self.allDocs = docs;

          // Cache the list
          Cache.set('docs_list', self.allDocs);

          self.afterLoad();
        })
        .catch(function (err) {
          console.error('Failed to load documents:', err);
          if (container) {
            container.innerHTML = '<div class="docs-empty"><div class="docs-empty-icon">&#9888;&#65039;</div>' +
              '<h3>加载失败</h3><p>无法从文档仓库加载文档。请确认仓库 <code>' +
              CONFIG.owner + '/' + CONFIG.repo +
              '</code> 存在且包含 Markdown 文件。</p>' +
              '<button class="btn btn-primary" onclick="location.reload()">重试</button></div>';
          }
          showToast('文档加载失败: ' + err.message, 'error');
        });
    },

    afterLoad: function () {
      // Collect categories and tags
      this.collectMeta();
      this.filterDocs();
      // Also fetch details for the first page's docs to show metadata
      if (this.allDocs.length > 0) {
        this.fetchDocDetails();
      }
    },

    collectMeta: function () {
      var catSet = {};
      var tagSet = {};
      this.allDocs.forEach(function (doc) {
        if (doc.category) catSet[doc.category] = true;
        (doc.tags || []).forEach(function (t) { tagSet[t] = true; });
      });
      this.categories = Object.keys(catSet).sort();
      this.tags = Object.keys(tagSet).sort();
    },

    /**
     * Fetch detailed info for visible docs (frontmatter parsing)
     */
    fetchDocDetails: function () {
      var self = this;
      var toFetch = this.allDocs.slice(0, Math.min(this.allDocs.length, 20));

      Promise.all(toFetch.map(function (doc) {
        return GitHubAPI.fetchFile(doc.path)
          .then(function (data) {
            if (data.decodedContent) {
              var parsed = GitHubAPI.parseFrontmatter(data.decodedContent);
              doc.description = parsed.meta.description || parsed.meta.excerpt || '';
              doc.tags = parsed.meta.tags || [];
              doc.category = parsed.meta.category || '';
              doc.title = parsed.meta.title || doc.name;
            }
          })
          .catch(function () { /* ignore individual errors */ });
      })).then(function () {
        self.collectMeta();
        self.renderDocs();
        self.renderFilters();
      });
    },

    /**
     * Filter and search documents
     */
    filterDocs: function () {
      var searchQuery = '';
      var searchEl = document.getElementById('docs-search');
      if (searchEl) searchQuery = searchEl.value.toLowerCase().trim();

      var categoryFilter = '';
      var filterEl = document.getElementById('docs-category-filter');
      if (filterEl) categoryFilter = filterEl.value;

      this.filteredDocs = this.allDocs.filter(function (doc) {
        var matchesSearch = true;
        if (searchQuery) {
          matchesSearch = doc.name.toLowerCase().indexOf(searchQuery) > -1 ||
                          (doc.description || '').toLowerCase().indexOf(searchQuery) > -1 ||
                          (doc.tags || []).some(function (t) { return t.toLowerCase().indexOf(searchQuery) > -1; });
        }
        var matchesCategory = !categoryFilter || doc.category === categoryFilter;
        return matchesSearch && matchesCategory;
      });

      this.currentPage = 1;
      this.renderDocs();
    },

    /**
     * Render the document cards
     */
    renderDocs: function () {
      var container = document.getElementById('docs-container');
      if (!container) return;

      if (this.filteredDocs.length === 0) {
        var emptyMsg = this.allDocs.length === 0
          ? '<div class="docs-empty"><div class="docs-empty-icon">&#128218;</div>' +
            '<h3>文档仓库为空</h3><p>在仓库 <code>' + CONFIG.owner + '/' + CONFIG.repo +
            '</code> 中添加 Markdown 文件即可在此浏览。</p></div>'
          : '<div class="docs-empty"><div class="docs-empty-icon">&#128269;</div>' +
            '<h3>未找到匹配的文档</h3><p>请尝试其他搜索词或筛选条件。</p></div>';
        container.innerHTML = emptyMsg;
        this.renderPagination();
        return;
      }

      // Paginate
      var totalPages = Math.ceil(this.filteredDocs.length / CONFIG.perPage);
      var start = (this.currentPage - 1) * CONFIG.perPage;
      var pageDocs = this.filteredDocs.slice(start, start + CONFIG.perPage);

      var self = this;
      var html = '<div class="docs-grid">';

      pageDocs.forEach(function (doc) {
        var name = escapeHTML(doc.title || doc.name);
        var desc = escapeHTML(doc.description || '');
        var icon = getFileIcon(doc.fileName || doc.name);
        var tagsHtml = (doc.tags || []).slice(0, 4).map(function (t) {
          return '<span class="doc-tag">' + escapeHTML(t) + '</span>';
        }).join('');

        html += '<div class="doc-card" data-path="' + escapeHTML(doc.path) + '">' +
          '<div class="doc-card-icon">' + icon + '</div>' +
          '<div class="doc-card-name">' + name + '</div>' +
          (desc ? '<div class="doc-card-desc" style="font-size:0.85rem;color:var(--color-text-light);">' + desc + '</div>' : '') +
          '<div class="doc-card-meta">' +
          '<span>' + formatSize(doc.size || 0) + '</span>' +
          '<span>.md</span>' +
          '</div>' +
          (tagsHtml ? '<div class="doc-card-tags">' + tagsHtml + '</div>' : '') +
          '</div>';
      });

      html += '</div>';
      container.innerHTML = html;

      // Bind click events
      container.querySelectorAll('.doc-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var path = card.getAttribute('data-path');
          self.openDocument(path);
        });
      });

      this.renderPagination(totalPages);
      this.updateStats();
    },

    renderFilters: function () {
      var filterEl = document.getElementById('docs-category-filter');
      if (!filterEl) return;

      var html = '<option value="">所有分类</option>';
      this.categories.forEach(function (cat) {
        html += '<option value="' + escapeHTML(cat) + '">' + escapeHTML(cat) + '</option>';
      });
      filterEl.innerHTML = html;
    },

    renderPagination: function (totalPages) {
      var pagEl = document.getElementById('docs-pagination');
      if (!pagEl) return;

      if (!totalPages || totalPages <= 1) {
        pagEl.innerHTML = '';
        return;
      }

      var self = this;
      var html = '<button ' + (this.currentPage <= 1 ? 'disabled' : '') +
                 ' data-page="prev">&laquo; 上一页</button>';

      for (var i = 1; i <= totalPages; i++) {
        html += '<button data-page="' + i + '"' +
                (i === this.currentPage ? ' class="active"' : '') + '>' + i + '</button>';
      }

      html += '<button ' + (this.currentPage >= totalPages ? 'disabled' : '') +
              ' data-page="next">下一页 &raquo;</button>';
      html += '<span class="page-info">共 ' + this.filteredDocs.length + ' 个文档</span>';

      pagEl.innerHTML = html;

      pagEl.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var page = btn.getAttribute('data-page');
          if (page === 'prev') self.currentPage = Math.max(1, self.currentPage - 1);
          else if (page === 'next') self.currentPage = Math.min(totalPages, self.currentPage + 1);
          else self.currentPage = parseInt(page, 10);
          self.renderDocs();
          document.getElementById('docs-container').scrollIntoView({ behavior: 'smooth' });
        });
      });
    },

    updateStats: function () {
      var statsEl = document.getElementById('docs-stats');
      if (!statsEl) return;
      var total = this.allDocs.length;
      var showing = this.filteredDocs.length;
      statsEl.innerHTML = '共 <span>' + total + '</span> 个文档' +
        (showing !== total ? '，当前筛选显示 <span>' + showing + '</span> 个' : '');
    },

    /**
     * Open document detail modal
     * @param {string} filePath
     */
    openDocument: function (filePath) {
      var self = this;
      var existingModal = document.querySelector('.doc-modal-overlay');
      if (existingModal) existingModal.remove();

      // Show loading modal
      var loadingModal = this.createModal('加载中...', '<div class="loading-spinner" style="margin:40px auto;"></div>', false);
      document.body.appendChild(loadingModal);

      // Check cache
      var cached = Cache.get('doc_' + filePath);
      if (cached) {
        loadingModal.remove();
        this.showDocModal(cached);
        return;
      }

      GitHubAPI.fetchFile(filePath)
        .then(function (data) {
          loadingModal.remove();

          if (!data.decodedContent) {
            showToast('文档内容为空或无法解析', 'error');
            return;
          }

          var parsed = GitHubAPI.parseFrontmatter(data.decodedContent);
          var doc = {
            path: filePath,
            name: parsed.meta.title || data.name.replace(/\.md$/i, ''),
            content: parsed.body,
            meta: parsed.meta,
            sha: data.sha,
            size: data.size
          };

          Cache.set('doc_' + filePath, doc);
          self.showDocModal(doc);
        })
        .catch(function (err) {
          loadingModal.remove();
          showToast('文档加载失败: ' + err.message, 'error');
        });
    },

    /**
     * Render document in a modal
     * @param {Object} doc
     */
    showDocModal: function (doc) {
      var contentHtml = MD.render(doc.content);
      var meta = doc.meta;

      var tagsHtml = '';
      if (meta.tags && meta.tags.length) {
        tagsHtml = meta.tags.map(function (t) {
          return '<span class="post-tag">' + escapeHTML(t) + '</span>';
        }).join('');
      }

      var metaHtml = '';
      if (meta.date) metaHtml += '<span>&#128197; ' + escapeHTML(meta.date) + '</span>';
      if (meta.category) metaHtml += '<span>&#128451; ' + escapeHTML(meta.category) + '</span>';
      if (meta.author) metaHtml += '<span>&#9997; ' + escapeHTML(meta.author) + '</span>';

      var bodyHtml = '<div class="doc-modal-body">' + contentHtml + '</div>';

      var footerHtml = '<div class="doc-modal-footer">' +
        '<a class="btn" href="https://github.com/' + CONFIG.owner + '/' + CONFIG.repo +
        '/blob/' + CONFIG.branch + '/' + encodeURIComponent(doc.path) +
        '" target="_blank" rel="noopener">在 GitHub 查看源文件</a>' +
        '<button class="btn btn-primary" onclick="this.closest(\'.doc-modal-overlay\').remove()">关闭</button>' +
        '</div>';

      var modal = this.createModal(doc.name, metaHtml + tagsHtml + bodyHtml + footerHtml, true);
      document.body.appendChild(modal);

      // Close on overlay click
      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
      });

      // Close on ESC
      var escHandler = function (e) {
        if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); }
      };
      document.addEventListener('keydown', escHandler);
    },

    createModal: function (title, content, showClose) {
      var overlay = document.createElement('div');
      overlay.className = 'doc-modal-overlay';

      var closeBtn = showClose !== false
        ? '<button class="doc-modal-close" onclick="this.closest(\'.doc-modal-overlay\').remove()">&times;</button>'
        : '';

      overlay.innerHTML = '<div class="doc-modal">' +
        '<div class="doc-modal-header">' +
        '<div class="doc-modal-title">' + escapeHTML(title) + '</div>' +
        closeBtn +
        '</div>' +
        (showClose ? '<div class="doc-modal-meta">' + content.split('</div>')[0] : '') +
        '</div>';

      return overlay;
    }
  };

  // =============================================
  // Initialize on DOM ready
  // =============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { App.init(); });
  } else {
    App.init();
  }

  // Expose API for external use
  window.DocsApp = App;
  window.DocsGitHubAPI = GitHubAPI;
})();
