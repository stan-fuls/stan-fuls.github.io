/**
 * Share of Stam - 文章互动功能
 *
 *   点赞 (localStorage,可切换,每篇文档/文章独立计数)
 *   评论 (占位 - 等待 Giscus 配置)
 *   分享 (固定弹窗 - 微信/微博/QQ/Twitter/复制链接)
 *
 * 说明: 静态站无后端,点赞数仅在本浏览器维护;
 *       点赞数据以当前页面 URL 为唯一 key 存储,
 *       每篇文档互不干涉, 刷新后计数保持不变。
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'sos_likes_index';

  function getStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function setStore(obj) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  // ============================================================
  // 1. 点赞 - 每篇文档独立计数
  //    以当前页面 URL (pathname+search) 作为唯一标识,
  //    不同文档之间的点赞数据完全隔离,互不影响。
  // ============================================================
  function initLikes() {
    const btn = document.getElementById('btn-like');
    const countEl = document.getElementById('like-count');
    const labelEl = document.getElementById('like-label');
    if (!btn || !countEl || !labelEl) return;

    // 页面唯一标识: 路径 + 查询参数 (含中文路径, 经 encodeURIComponent 安全存储)
    const pageKey = window.location.pathname + window.location.search;
    const likedKey = 'sos_liked_' + encodeURIComponent(pageKey);

    function sync() {
      let liked = false;
      try { liked = localStorage.getItem(likedKey) === '1'; } catch (e) {}
      const count = getStore()[pageKey] || 0;
      countEl.textContent = count;
      btn.classList.toggle('is-liked', liked);
      labelEl.textContent = liked ? '已点赞' : '点赞';
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      btn.title = liked ? '再次点击取消点赞' : '点赞这篇文章 (共 ' + count + ' 赞)';
    }

    sync();

    btn.addEventListener('click', function () {
      let liked = false;
      try { liked = localStorage.getItem(likedKey) === '1'; } catch (e) {}
      const store = getStore();

      if (liked) {
        // 取消点赞: 计数 -1
        store[pageKey] = Math.max(0, (store[pageKey] || 0) - 1);
        setStore(store);
        try { localStorage.removeItem(likedKey); } catch (e) {}
        showToast('已取消点赞');
      } else {
        // 点赞: 计数 +1
        store[pageKey] = (store[pageKey] || 0) + 1;
        setStore(store);
        try { localStorage.setItem(likedKey, '1'); } catch (e) {}

        // 心跳动画
        btn.classList.remove('like-pulse');
        void btn.offsetWidth;
        btn.classList.add('like-pulse');
        showToast('感谢你的点赞 ❤');
      }
      sync();
    });
  }

  // ============================================================
  // 2. 评论 - 滚动到占位提示(无 Giscus 报错)
  // ============================================================
  function initComments() {
    const btn = document.getElementById('btn-comment');
    if (!btn) return;

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.getElementById('comments-section');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        showToast('评论区尚未配置');
      }
    });
  }

  // ============================================================
  // 3. 分享 - 始终使用固定弹窗
  // ============================================================
  function initShare() {
    const shareBtn = document.getElementById('btn-share');
    if (!shareBtn) return;

    const url = window.location.href;
    const title = (document.title || '').replace(/\s*\|\s*Share of Stam$/, '').trim() || '分享文章';

    shareBtn.addEventListener('click', function () {
      showSharePanel(url, title);
    });
  }

  function showSharePanel(url, title) {
    const existing = document.querySelector('.share-panel');
    if (existing) { existing.remove(); return; }

    const enc = { u: encodeURIComponent(url), t: encodeURIComponent(title) };

    const panel = document.createElement('div');
    panel.className = 'share-panel';
    panel.innerHTML = `
      <div class="share-overlay"></div>
      <div class="share-panel-inner">
        <h4 class="share-panel-title">分享到</h4>
        <div class="share-grid">
          <button class="share-option" data-action="wechat" title="微信">
            <span class="share-icon wechat">💬</span><span>微信</span>
          </button>
          <button class="share-option" data-action="weibo" title="微博">
            <span class="share-icon weibo">📢</span><span>微博</span>
          </button>
          <button class="share-option" data-action="qq" title="QQ">
            <span class="share-icon qq">🐧</span><span>QQ</span>
          </button>
          <button class="share-option" data-action="twitter" title="Twitter / X">
            <span class="share-icon twitter">𝕏</span><span>Twitter</span>
          </button>
          <button class="share-option" data-action="linkedin" title="LinkedIn">
            <span class="share-icon linkedin">in</span><span>LinkedIn</span>
          </button>
          <button class="share-option" data-action="copy" title="复制链接">
            <span class="share-icon copy">🔗</span><span>复制链接</span>
          </button>
        </div>
        <button class="share-option share-cancel">关闭</button>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('[data-action="wechat"]').addEventListener('click', () => {
      copyToClipboard(url);
      showToast('微信分享请粘贴链接 (或截图发好友)');
    });
    panel.querySelector('[data-action="weibo"]').addEventListener('click', () => {
      window.open('https://service.weibo.com/share/share.php?url=' + enc.u + '&title=' + enc.t, '_blank');
    });
    panel.querySelector('[data-action="qq"]').addEventListener('click', () => {
      window.open('https://connect.qq.com/widget/shareqq/index.html?url=' + enc.u + '&title=' + enc.t, '_blank');
    });
    panel.querySelector('[data-action="twitter"]').addEventListener('click', () => {
      window.open('https://twitter.com/intent/tweet?url=' + enc.u + '&text=' + enc.t, '_blank');
    });
    panel.querySelector('[data-action="linkedin"]').addEventListener('click', () => {
      window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + enc.u, '_blank');
    });
    panel.querySelector('[data-action="copy"]').addEventListener('click', () => {
      copyToClipboard(url);
      panel.remove();
    });
    panel.querySelector('.share-overlay').addEventListener('click', () => panel.remove());
    panel.querySelector('.share-cancel').addEventListener('click', () => panel.remove());
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('链接已复制到剪贴板'))
        .catch(() => fallbackCopy(text));
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制到剪贴板'); }
    catch (e) { showToast('复制失败,请手动复制'); }
    document.body.removeChild(ta);
  }

  // ============================================================
  // 4. Toast
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

  document.addEventListener('DOMContentLoaded', function () {
    initLikes();
    initComments();
    initShare();
  });
})();