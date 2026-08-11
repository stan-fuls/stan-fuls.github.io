/**
 * Archive - 标签筛选逻辑
 *
 * 行为：
 *   - 点击标签按钮：仅显示该标签的文章分组，隐藏其他
 *   - 点击"全部"：重置为显示所有标签
 *   - 当前选中状态写入 URL hash，支持刷新保留
 */
(function () {
  'use strict';

  var navButtons = document.querySelectorAll('.tag-pill[data-tag]');
  var groups = document.querySelectorAll('.tag-group[data-tag]');
  var resetBtn = document.getElementById('tag-reset');
  var tagNav = document.querySelector('.tag-nav');

  if (!navButtons.length || !groups.length) return;

  /** 重置所有筛选 */
  function clearFilter() {
    navButtons.forEach(function (btn) { btn.classList.remove('is-active'); });
    groups.forEach(function (g) { g.classList.remove('is-hidden'); });
    if (resetBtn) resetBtn.classList.add('is-hidden');
    if (history && history.replaceState) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  /** 按指定 tag 筛选 */
  function filterByTag(slug, tagName) {
    if (!slug) {
      clearFilter();
      return;
    }

    navButtons.forEach(function (btn) {
      if (btn.getAttribute('data-tag') === slug) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    groups.forEach(function (g) {
      if (g.getAttribute('data-tag') === slug) {
        g.classList.remove('is-hidden');
      } else {
        g.classList.add('is-hidden');
      }
    });

    if (resetBtn) resetBtn.classList.remove('is-hidden');

    // 写入 URL hash（便于刷新/分享保留状态）
    if (history && history.replaceState) {
      history.replaceState(null, '', '#tag=' + encodeURIComponent(slug));
    }

    // 滚动到对应分组
    var target = document.getElementById('tag-' + slug);
    if (target) {
      var rect = target.getBoundingClientRect();
      if (rect.top < 0 || rect.top > window.innerHeight * 0.5) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // 绑定标签按钮
  navButtons.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var slug = this.getAttribute('data-tag');
      filterByTag(slug);
    });
  });

  // 重置按钮
  if (resetBtn) {
    resetBtn.addEventListener('click', function (e) {
      e.preventDefault();
      clearFilter();
    });
  }

  // 初始状态：从 URL hash 恢复
  var hash = window.location.hash || '';
  var match = hash.match(/#tag=([^&]+)/);
  if (match) {
    var initSlug = decodeURIComponent(match[1]);
    if (initSlug) {
      filterByTag(initSlug);
      return;
    }
  }

  // 默认隐藏"全部"按钮
  if (resetBtn) resetBtn.classList.add('is-hidden');
})();