/**
 * Share of Stam - 文章互动功能
 *   点赞 (localStorage,可切换)
 *   评论 (滚动到 Giscus / fallback 提示)
 *   分享 (Web Share API + 复制链接)
 *
 * 说明: 由于这是 GitHub Pages 静态站,无后端,
 *       "点赞"仅在本机记录,不跨设备同步;状态可在同浏览器随时取消。
 */
(function () {
  'use strict';

  const pageKey = window.location.pathname;
  const likedKey = 'sos_liked_' + btoa(pageKey);

  // ============================================================
  // 1. 点赞系统 (可切换,个人状态)
  // ============================================================
  function initLikes() {
    const btn = document.getElementById('btn-like');
    const label = document.getElementById('like-label');
    if (!btn || !label) return;

    // 读取初始状态
    const sync = () => {
      const liked = localStorage.getItem(likedKey) === '1';
      btn.classList.toggle('is-liked', liked);
      label.textContent = liked ? '已点赞' : '点赞';
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      btn.title = liked ? '再次点击取消点赞' : '点赞这篇文章';
    };

    sync();

    btn.addEventListener('click', function () {
      const liked = localStorage.getItem(likedKey) === '1';
      if (liked) {
        localStorage.removeItem(likedKey);
        showToast('已取消点赞');
      } else {
        localStorage.setItem(likedKey, '1');
        // 点赞动画
        btn.classList.remove('like-pulse');
        void btn.offsetWidth;
        btn.classList.add('like-pulse');
        showToast('感谢你的点赞 ❤');
      }
      sync();
    });
  }

  // ============================================================
  // 2. 评论按钮 — 滚动到评论区,失败时给提示
  // ============================================================
  function initComments() {
    const btn = document.getElementById('btn-comment');
    if (!btn) return;

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.getElementById('comments-section');
      if (!target) {
        showToast('评论功能尚未配置');
        return;
      }

      // 平滑滚动到评论区
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // 检测 Giscus 是否成功加载(等待 3 秒)
      setTimeout(() => {
        const giscusFrame = document.querySelector('iframe.giscus-frame');
        const errorEl = target.querySelector('.giscus-error, .giscus-loading-error');
        if (errorEl || !giscusFrame) {
          showCommentsConfigHint(target);
        }
      }, 3500);
    });
  }

  function showCommentsConfigHint(section) {
    if (section.querySelector('.comments-fallback')) return;

    const hint = document.createElement('div');
    hint.className = 'comments-fallback';
    hint.innerHTML = `
      <p>⚠️ Giscus 评论组件未加载成功。</p>
      <p>可能原因:</p>
      <ol>
        <li>仓库 <code>stan-fuls/stan-fuls.github.io</code> 尚未启用 <strong>Discussions</strong></li>
        <li>未安装 <a href="https://github.com/apps/giscus" target="_blank" rel="noopener">Giscus GitHub App</a></li>
        <li><code>_config.yml</code> 中 <code>repo_id</code> / <code>category_id</code> 未填写</li>
      </ol>
      <p>请访问 <a href="https://giscus.app/zh-CN" target="_blank" rel="noopener">giscus.app</a> 生成配置后填入 <code>_config.yml</code>。</p>
    `;
    section.appendChild(hint);
  }

  // ============================================================
  // 3. 分享
  // ============================================================
  function initShare() {
    const shareBtn = document.getElementById('btn-share');
    if (!shareBtn) return;

    const url = window.location.href;
    const title = document.title.replace(/\s*\|\s*Share of Stam$/, '');

    shareBtn.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(() => {});
        return;
      }
      showSharePanel(url, title);
    });
  }

  function showSharePanel(url, title) {
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

    panel.querySelector('[data-action="copy"]').addEventListener('click', () => {
      copyToClipboard(url);
      panel.remove();
    });
    panel.querySelector('.share-overlay').addEventListener('click', () => panel.remove());
    panel.querySelector('.share-cancel').addEventListener('click', () => panel.remove());
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
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

  // ============================================================
  // 启动
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    initLikes();
    initComments();
    initShare();
  });
})();