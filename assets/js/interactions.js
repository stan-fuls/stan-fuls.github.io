/**
 * Share of Stam - 文章互动功能
 * 点赞 (localStorage) / 评论 (Giscus) / 分享 (Web Share + 复制链接)
 */
(function () {
  'use strict';

  // ============================================================
  // 1. 点赞系统 (localStorage)
  // ============================================================
  const pageKey = window.location.pathname;

  function getLikes() {
    try {
      const data = JSON.parse(localStorage.getItem('sos_likes') || '{}');
      return data;
    } catch (e) { return {}; }
  }

  function saveLikes(data) {
    localStorage.setItem('sos_likes', JSON.stringify(data));
  }

  function initLikes() {
    const btn = document.getElementById('btn-like');
    const countEl = document.getElementById('like-count');
    if (!btn || !countEl) return;

    const likes = getLikes();
    const count = likes[pageKey] || 0;
    countEl.textContent = count;

    // 检查当前用户是否已点赞
    if (localStorage.getItem('sos_liked_' + btoa(pageKey)) === '1') {
      btn.classList.add('is-liked');
      btn.disabled = true;
      btn.title = '已点赞';
    }

    btn.addEventListener('click', function () {
      if (this.classList.contains('is-liked')) return;

      const current = getLikes();
      current[pageKey] = (current[pageKey] || 0) + 1;
      saveLikes(current);
      localStorage.setItem('sos_liked_' + btoa(pageKey), '1');

      countEl.textContent = current[pageKey];
      this.classList.add('is-liked');
      this.disabled = true;
      this.title = '已点赞';

      // 点赞动画
      countEl.classList.remove('like-pop');
      void countEl.offsetWidth; // reflow
      countEl.classList.add('like-pop');
    });
  }

  // ============================================================
  // 2. 分享功能
  // ============================================================
  function initShare() {
    const shareBtn = document.getElementById('btn-share');
    if (!shareBtn) return;

    const url = window.location.href;
    const title = document.title.replace(/\s*\|\s*Share of Stam$/, '');

    shareBtn.addEventListener('click', function () {
      // 优先使用 Web Share API (移动端原生分享)
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(() => {});
        return;
      }
      // 桌面端: 弹出分享面板
      showSharePanel(url, title);
    });
  }

  function showSharePanel(url, title) {
    // 移除已有面板
    const existing = document.querySelector('.share-panel');
    if (existing) { existing.remove(); return; }

    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);

    const panel = document.createElement('div');
    panel.className = 'share-panel';
    panel.innerHTML = `
      <div class="share-panel-inner">
        <button class="share-option" data-action="copy" title="复制链接">
          <span class="share-icon">🔗</span><span>复制链接</span>
        </button>
        <a class="share-option" href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener" title="分享到 Twitter/X">
          <span class="share-icon">𝕏</span><span>Twitter</span>
        </a>
        <a class="share-option" href="https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener" title="分享到微博">
          <span class="share-icon">📢</span><span>微博</span>
        </a>
        <button class="share-option share-cancel">取消</button>
      </div>
      <div class="share-overlay"></div>
    `;
    document.body.appendChild(panel);

    // 点击复制
    panel.querySelector('[data-action="copy"]').addEventListener('click', () => {
      navigator.clipboard.writeText(url).then(() => {
        showToast('链接已复制到剪贴板');
      }).catch(() => {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('链接已复制到剪贴板');
      });
      panel.remove();
    });

    // 点击遮罩关闭
    panel.querySelector('.share-overlay').addEventListener('click', () => panel.remove());
    panel.querySelector('.share-cancel').addEventListener('click', () => panel.remove());
  }

  // ============================================================
  // 3. Toast 提示
  // ============================================================
  function showToast(msg) {
    const existing = document.querySelector('.interaction-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'interaction-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // ============================================================
  // 启动
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    initLikes();
    initShare();
  });
})();
