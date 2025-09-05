// === shared-dialog.js ===
// Shared dialogs (lesson/enroll/auth) with idempotent mounting & modal behaviors.
(function(){
  // 任何頁面只允許掛一次（避免重複注入）
  if (window.__SHARED_DIALOGS_MOUNTED__) return;
  window.__SHARED_DIALOGS_MOUNTED__ = true;

  // --- 1) Inject modal CSS (only once) ---
  if (!document.getElementById('shared-dialog-style')) {
    const style = document.createElement('style');
    style.id = 'shared-dialog-style';
    style.textContent = `
/* 基本尺寸：置中卡片，內容可捲動 */
dialog {
  padding: 0; border: none; margin: 0;
  width: min(520px, 92vw);
  max-width: 92vw;
  max-height: 90dvh;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
  overflow: hidden;
  z-index: 1000;
}
dialog::backdrop { background: rgba(0,0,0,.35); }

/* 內容容器：負責捲動 */
dialog .panel, dialog form.card {
  padding: 16px 18px;
  overflow: auto;
  max-height: calc(90dvh - 32px);
}

/* 管理面板比較大 */
#admin-panel { width: min(980px, 95vw); max-width: 95vw; }

/* 超小螢幕：改為全螢幕 bottom sheet 風格 */
@media (max-width: 420px){
  dialog { width: 100dvw; height: 100dvh; max-width: none; max-height: none; inset: 0; transform: none; border-radius: 0; }
  dialog .panel, dialog form.card { height: 100%; max-height: none; padding: 16px; }
}

/* 開啟任一 dialog 時鎖住頁面滾動 */
body.modal-open { overflow: hidden; }
    `.trim();
    document.head.appendChild(style);
  }

  // --- 2) Helpers ---
  function ensureDialog(id, html){
    // 若頁面上不存在該 id，才建立
    if (!document.getElementById(id)) {
      const t = document.createElement('template');
      t.innerHTML = html.trim();
      document.body.appendChild(t.content);
    }
    return document.getElementById(id);
  }
  function bindModalLock(dlg){
    if (!dlg) return;
    const off = () => document.body.classList.remove('modal-open');
    dlg.addEventListener('close',  off);
    dlg.addEventListener('cancel', off);
    if (dlg.showModal && !dlg.__patchedShowModal) {
      const orig = dlg.showModal.bind(dlg);
      dlg.showModal = function(){
        orig();
        document.body.classList.add('modal-open');
      };
      dlg.__patchedShowModal = true;
    }
  }

  // --- 3) Mount dialogs (idempotent) ---
  // 3-1) 單元內容對話框
  const lessonDlg = ensureDialog('lesson-modal', `
    <dialog id="lesson-modal">
      <form method="dialog" class="card panel">
        <h3 id="lesson-title">單元</h3>
        <article id="lesson-content" class="prose" style="margin-top:6px;"></article>
        <div class="actions" style="margin-top:10px; display:flex; gap:10px;">
          <button id="mark-done" class="btn primary">標記完成</button>
          <button value="close" class="btn secondary">關閉</button>
        </div>
      </form>
    </dialog>
  `);

  // 3-2) Auth 對話框（若 shared-layout.js 已提供，就不再建立）
  const authDlg = document.getElementById('auth-modal') || ensureDialog('auth-modal', `
    <dialog id="auth-modal">
      <form method="dialog" class="card panel">
        <h3>登入 / 註冊</h3>
        <label>Email
          <input type="email" id="auth-email" required placeholder="you@example.com" autocomplete="email" />
        </label>
        <label>密碼
          <input type="password" id="auth-password" required placeholder="至少 6 碼" autocomplete="current-password" />
        </label>
        <div class="actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
          <button id="btn-signin"  value="signin"  class="btn primary">登入</button>
          <button id="btn-signup"  value="signup"  class="btn secondary">註冊</button>
          <button type="button" class="btn" onclick="document.getElementById('auth-modal').close()">取消</button>
        </div>
        <p class="muted" style="margin:8px 0 0;">
          若顯示「Email not confirmed」，請到信箱點驗證連結或再試註冊以重寄驗證信。
        </p>
      </form>
    </dialog>
  `);

  // 3-3) 報名對話框
  const enrollDlg = ensureDialog('enroll-dialog', `
    <dialog id="enroll-dialog">
      <form id="enroll-form" class="card panel" method="dialog">
        <h3 style="margin-top:0;">課程報名資訊</h3>
        <p class="muted" style="margin-top:-6px;">請填寫聯絡資訊以完成報名</p>
        <div class="form-grid" style="margin-top:10px;">
          <label>姓名（必填）
            <input id="enroll-name" type="text" required placeholder="請輸入姓名">
          </label>
          <label>電話（必填）
            <input id="enroll-phone" type="tel" required placeholder="例如 09xx-xxx-xxx">
          </label>
          <label>LINE ID（選填）
            <input id="enroll-line" type="text" placeholder="選填">
          </label>
        </div>
        <div class="actions">
          <button class="btn" type="button" onclick="document.getElementById('enroll-dialog').close()">取消</button>
          <button class="btn primary" type="submit">送出報名</button>
        </div>
      </form>
    </dialog>
  `);

  // --- 4) Behaviors: lock scroll when any dialog open ---
  [lessonDlg, authDlg, enrollDlg, document.getElementById('admin-panel')].forEach(bindModalLock);
})();
