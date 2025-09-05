// === shared-dialog.js ===
// Shared dialogs (lesson/enroll/auth) with idempotent mounting & modal behaviors.
(function(){
  if (window.__SHARED_DIALOGS_MOUNTED__) return;
  window.__SHARED_DIALOGS_MOUNTED__ = true;

  // --- Inject CSS (once) ---
  if (!document.getElementById('shared-dialog-style')) {
    const style = document.createElement('style');
    style.id = 'shared-dialog-style';
    style.textContent = `
dialog {
  padding: 0; border: none; margin: 0;
  width: min(560px, 92vw);
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

dialog .panel, dialog form.card {
  padding: 16px 18px;
  overflow: auto;
  max-height: calc(90dvh - 32px);
}

dialog form.card label { display:block; margin:10px 0; font-weight:600; }
dialog form.card label input { width:100%; box-sizing:border-box; margin-top:6px; }
dialog form.card .actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }

/* Auth tabs */
.auth-tabs { display:flex; gap:8px; background:#f6f8fa; padding:8px; border-radius:10px; margin-bottom:8px; }
.auth-tab { flex:1; text-align:center; padding:8px 10px; border-radius:8px; cursor:pointer; border:1px solid transparent; }
.auth-tab[aria-selected="true"] { background:#fff; border-color:#e6e6e6; font-weight:600; }
.auth-view { display:none; }
.auth-view.active { display:block; }

#admin-panel { width: min(980px, 95vw); max-width: 95vw; }

@media (max-width: 420px){
  dialog { width: 100dvw; height: 100dvh; max-width: none; max-height: none; inset: 0; transform: none; border-radius: 0; }
  dialog .panel, dialog form.card { height: 100%; max-height: none; padding: 16px; }
}

body.modal-open { overflow: hidden; }
    `.trim();
    document.head.appendChild(style);
  }

  // Helpers
  function ensureDialog(id, html){
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
      dlg.showModal = function(){ orig(); document.body.classList.add('modal-open'); };
      dlg.__patchedShowModal = true;
    }
  }

  // --- Lesson dialog ---
  const lessonDlg = ensureDialog('lesson-modal', `
    <dialog id="lesson-modal">
      <form method="dialog" class="card panel">
        <h3 id="lesson-title">單元</h3>
        <article id="lesson-content" class="prose" style="margin-top:6px;"></article>
        <div class="actions">
          <button id="mark-done" class="btn primary">標記完成</button>
          <button value="close" class="btn secondary">關閉</button>
        </div>
      </form>
    </dialog>
  `);

  // --- Auth dialog（分頁：登入 / 註冊） ---
  const authDlg = document.getElementById('auth-modal') || ensureDialog('auth-modal', `
    <dialog id="auth-modal">
      <div class="card panel">
        <div class="auth-tabs" role="tablist" aria-label="登入/註冊切換">
          <button id="tab-login"  class="auth-tab" role="tab" aria-selected="true"  aria-controls="view-login">登入</button>
          <button id="tab-signup" class="auth-tab" role="tab" aria-selected="false" aria-controls="view-signup">註冊</button>
        </div>

        <!-- 登入頁 -->
        <form id="view-login" class="auth-view active" role="tabpanel" aria-labelledby="tab-login">
          <label>Email
            <input type="email" id="login-email" required placeholder="you@example.com" autocomplete="email" />
          </label>
          <label>密碼
            <input type="password" id="login-password" required placeholder="你的密碼" autocomplete="current-password" />
          </label>
          <div class="actions">
            <button id="btn-do-login" class="btn primary">登入</button>
            <button type="button" class="btn" onclick="document.getElementById('auth-modal').close()">取消</button>
          </div>
        </form>

        <!-- 註冊頁 -->
        <form id="view-signup" class="auth-view" role="tabpanel" aria-labelledby="tab-signup">
          <label>Email
            <input type="email" id="signup-email" required placeholder="you@example.com" autocomplete="email" />
          </label>
          <label>密碼
            <input type="password" id="signup-password" required placeholder="至少 6 碼" autocomplete="new-password" />
          </label>
          <label>暱稱
            <input type="text" id="signup-nickname" required placeholder="例如：小芳、David" autocomplete="nickname" />
          </label>
          <div class="actions">
            <button id="btn-do-signup" class="btn secondary">註冊</button>
            <button type="button" class="btn" onclick="document.getElementById('auth-modal').close()">取消</button>
          </div>
          <p class="muted" style="margin:6px 0 0;">
            若顯示「Email not confirmed」，請到信箱點驗證連結或再試註冊以重寄驗證信。
          </p>
        </form>
      </div>
    </dialog>
  `);

  // --- Enroll dialog ---
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

  // Bind modal lock
  [lessonDlg, authDlg, enrollDlg, document.getElementById('admin-panel')].forEach(bindModalLock);

  // 簡單的分頁切換（避免頁面重載）
  function wireTabs(){
    const dlg = document.getElementById('auth-modal');
    if (!dlg || dlg.dataset.tabsBound) return;
    dlg.dataset.tabsBound = '1';

    const tabLogin  = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const viewLogin = document.getElementById('view-login');
    const viewSignup= document.getElementById('view-signup');

    function activate(which){
      const loginOn = which === 'login';
      tabLogin.setAttribute('aria-selected', loginOn ? 'true' : 'false');
      tabSignup.setAttribute('aria-selected', loginOn ? 'false' : 'true');
      viewLogin.classList.toggle('active', loginOn);
      viewSignup.classList.toggle('active', !loginOn);
      (loginOn ? document.getElementById('login-email')
               : document.getElementById('signup-email'))?.focus();
    }

    tabLogin?.addEventListener('click', e=>{ e.preventDefault(); activate('login'); });
    tabSignup?.addEventListener('click', e=>{ e.preventDefault(); activate('signup'); });

    // 預設停留在登入
    activate('login');
  }
  wireTabs();

  // 通知其他腳本可以綁定事件
  document.dispatchEvent(new Event('dialogs:mounted'));
})();
