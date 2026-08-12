/**
 * Share of Stam - 文章互动功能
 *
 *   点赞 (localStorage,可切换,显示总计数)
 *   评论 (占位 - 等待 Giscus 配置)
 *   分享 (固定弹窗 - 微信/微博/QQ/Twitter/复制链接)
 *
 * 说明: 静态站无后端,点赞数仅在本浏览器维护;
 *       通过种子基数(由 URL 派生)模拟一个稳定数字。
 */
(function () {
  'use strict';

  const pageKey = window.location.pathname;
  const STORAGE_KEY = 'sos_likes_index';

  // 由 URL 派生稳定种子(让每篇文章有一个不会变的"基础数")
  function seedFromPath(path) {
    let h = 0;
    for (let i = 0; i < path.length; i++) {
      h = (h * 31 + path.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

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
  // 1. 点赞 - 显示总计数
  // ============================================================
  function initLikes() {
    const btn = document.getElementById('btn-like');
    const countEl = document.getElementById('like-count');
    const labelEl = document.getElementById('like-label');
    if (!btn || !countEl || !labelEl) return;

    const seed = seedFromPath(pageKey) % 40 + 5;   // 5 ~ 44
    const localCount = (getStore()[pageKey] || 0);

    function sync() {
      const liked = localStorage.getItem('sos_liked_' + btoa(pageKey)) === '1';
      const store = getStore();
      const local = store[pageKey] || 0;
      const total = seed + local;
      countEl.textContent = total;
      btn.classList.toggle('is-liked', liked);
      labelEl.textContent = liked ? '已点赞' : '点赞';
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      btn.title = liked ? '再次点击取消点赞' : '点赞这篇文章 (共 ' + total + ' 赞)';
    }

    sync();

    btn.addEventListener('click', function () {
      const liked = localStorage.getItem('sos_liked_' + btoa(pageKey)) === '1';
      const store = getStore();

      if (liked) {
        // 取消: 数字 -1
        store[pageKey] = Math.max(0, (store[pageKey] || 0) - 1);
        setStore(store);   // ★ 写入 localStorage,否则刷新后计数回到旧值
        localStorage.removeItem('sos_liked_' + btoa(pageKey));
        showToast('已取消点赞');
      } else {
        // 点赞: 数字 +1
        store[pageKey] = (store[pageKey] || 0) + 1;
        setStore(store);
        localStorage.setItem('sos_liked_' + btoa(pageKey), '1');

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
            <span class="share-icon wechat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.7 3C4.9 3 2 5.6 2 8.9c0 1.9 1 3.6 2.6 4.7l-.6 2.1 2.4-1.2c.6.2 1.3.3 2 .3h.3c-.2-.6-.3-1.2-.3-1.9 0-3.1 2.8-5.6 6.2-5.6h.5C14.4 4.6 11.8 3 8.7 3zm-2.2 3.6c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm4.5 0c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z"/><path d="M21.5 12.6c0-2.7-2.5-4.9-5.6-4.9s-5.6 2.2-5.6 4.9 2.5 4.9 5.6 4.9c.6 0 1.2-.1 1.8-.3l2 1-.5-1.7c1.5-.9 2.3-2.3 2.3-3.9zm-7.4-1.4c.4 0 .8.3.8.8s-.3.8-.8.8-.8-.3-.8-.8.3-.8.8-.8zm3.7 0c.4 0 .8.3.8.8s-.3.8-.8.8-.8-.3-.8-.8.3-.8.8-.8z"/></svg>
            </span><span>微信</span>
          </button>
          <button class="share-option" data-action="weibo" title="微博">
            <span class="share-icon weibo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10.9 14.5c1.9.6 4 .3 5.4-1.1 1.1-1.1 1.5-2.5 1-3.5-.4-.9-1.5-1.4-2.7-1.2-1.4.2-2.8 1.2-3.7 2.4-.8 1.2-1 2.5-.2 3.2.1.1.2.2.2.2zm2.5-3.3c.8-.1 1.5.1 1.7.6.2.4-.2 1-.9 1.2-.8.2-1.6-.1-1.8-.6-.1-.4.2-.9.8-1.1l.2-.1z"/><path d="M14.9 2.5c3.7.6 6.6 3.5 7.2 7.2.1.5.5.8.9.7.5-.1.8-.6.7-1.1-.7-4.4-4.1-7.7-8.5-8.4-.5-.1-1 .3-1.1.8-.1.5.3 1 .8 1.1l.1-.1z"/><path d="M11.7 1.9c.4-.1.7-.6.6-1-.1-.4-.6-.7-1-.6-5.7 1.3-9.9 6.1-9.9 11.8 0 .5.4 1 1 1s1-.4 1-1c0-5.1 3.8-9.3 8.9-10.4.1-.1.3-.2.4-.3z"/><path d="M15.4 12.8c.3-.3.5-.8.4-1.3-.1-.6-.6-1.1-1.4-1.4-1.5-.5-3.5.5-5.2 2.1-1.7 1.7-2.6 3.7-2.1 5.2.4 1.3 1.8 2.1 3.5 2.1.2 0 .5 0 .7-.1 2.1-.3 4-1.8 4.8-4.1.3-.9.2-1.8-.4-2.5h-.3zm-2.9 3.9c-.7.7-1.8.9-2.7.5-.9-.3-1.4-1.2-1.2-2.1.2-.9 1-1.6 2-2.2 1-.5 2.1-.8 3-.6.4.3.4 1.1-.1 2-.4.9-1 2.4-1 2.4z"/></svg>
            </span><span>微博</span>
          </button>
          <button class="share-option" data-action="qq" title="QQ">
            <span class="share-icon qq">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c-3.2 0-5.8 2.6-5.8 5.8v3.2c0 .9-.4 1.5-1.2 1.8-.3.1-.5.4-.5.8 0 .4.3.8.7.9.9.2 1.7.1 2.5-.2-.1 1.5.3 2.9 1 3.9-.6.5-1 1.2-1.1 2-.2 1 .4 1.8 1.3 1.8.8 0 1.5-.5 1.8-1.2h.2c.2 1 1 1.7 2.1 1.7 1.2 0 2.2-.9 2.3-2.1 0-.2 0-.4-.1-.6 0-.1 0-.2.1-.3l.1.1c.1 1 .9 1.7 1.9 1.7 1 0 1.9-.8 1.7-1.9-.1-.7-.5-1.4-1-1.9.8-.9 1.2-2.1 1.1-3.3.8.3 1.6.4 2.5.2.4-.1.7-.5.7-.9 0-.4-.2-.7-.5-.8-.8-.3-1.2-.9-1.2-1.8V8.3c0-3.2-2.6-5.8-5.8-5.8z"/></svg>
            </span><span>QQ</span>
          </button>
          <button class="share-option" data-action="twitter" title="Twitter / X">
            <span class="share-icon twitter">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L1.2 2h6.4l4.4 5.9L18.9 2zm-1.1 18h1.7L7.7 3.7H5.9L17.8 20z"/></svg>
            </span><span>Twitter</span>
          </button>
          <button class="share-option" data-action="linkedin" title="LinkedIn">
            <span class="share-icon linkedin">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
            </span><span>LinkedIn</span>
          </button>
          <button class="share-option" data-action="copy" title="复制链接">
            <span class="share-icon copy">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </span><span>复制链接</span>
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