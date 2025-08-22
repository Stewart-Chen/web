// === shared-dialog.js ===
// Auto-generated shared dialog DOM
(function(){
  if (document.getElementById('shared-dialogs-mounted')) return;
  var tpl = document.createElement('template');
  tpl.innerHTML = `
  <div id="shared-dialogs-mounted" hidden></div>
  <dialog id="lesson-modal">
    <form method="dialog" class="card">
      <h3 id="lesson-title">單元</h3>
      <article id="lesson-content" class="prose" style="margin-top:6px;"></article>
      <div class="actions" style="margin-top:10px; display:flex; gap:10px;">
        <button id="mark-done" class="btn primary">標記完成</button>
        <button value="close" class="btn secondary">關閉</button>
      </div>
    </form>
  </dialog>

  <dialog id="auth-modal">
    <form method="dialog" class="card" style="min-width:min(520px,92vw);">
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

  <dialog id="enroll-dialog">
    <form id="enroll-form" class="card" method="dialog" style="min-width:min(480px, 92vw);">
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

  <!-- 隱藏管理面板 -->
  <dialog id="admin-panel">
    <div method="dialog" class="card" style="min-width:min(980px,95vw);">
      <header style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <h3 style="margin:0;">管理面板</h3>
        <div>
          <button class="btn" type="button" onclick="document.getElementById('admin-panel').close()">關閉</button>
        </div>
      </header>
  
      <section style="display:grid;grid-template-columns: 1fr 1fr;gap:16px;margin-top:12px;">
        <!-- 左：課程清單 -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <h4 style="margin:0;">課程清單</h4>
            <div style="display:flex;gap:8px;">
              <button type="button" class="btn" id="admin-refresh">重新整理</button>
              <button type="button" class="btn primary" id="admin-new-course">＋ 新增課程</button>
            </div>
          </div>
          <div id="admin-courses" style="margin-top:8px;max-height:340px;overflow:auto;"></div>
        </div>
  
        <!-- 右：課程編輯表單 -->
        <div>
          <h4 style="margin:0;">課程內容</h4>
          <form id="admin-course-form" class="form-grid" style="margin-top:8px;">
            <input type="hidden" id="ac-id" />
            <label>標題 <input id="ac-title" required /></label>
            <label>摘要 <input id="ac-summary" /></label>
            <label>描述 <textarea id="ac-desc" rows="4"></textarea></label>
            <label>封面網址 <input id="ac-cover" placeholder="https://..." /></label>
            <label>授課老師
              <select id="ac-teacher" required>
                <option value="">— 選擇 —</option>
                <option value="fanfan">汎汎（園藝）</option>
                <option value="xd">小D（藝術）</option>
              </select>
            </label>
            <label><input type="checkbox" id="ac-published" /> 已發佈（公開可見）</label>
  
            <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="submit" class="btn primary">儲存</button>
              <button type="button" id="admin-soft-delete" class="btn secondary">移到回收（軟刪除）</button>
              <button type="button" id="admin-hard-delete" class="btn danger">永久刪除</button>
            </div>
          </form>
  
          <hr />
  
          <!-- 單元管理 -->
          <h4 style="margin:0;">單元（Lessons）</h4>
          <div id="admin-lessons" style="margin-top:8px;max-height:220px;overflow:auto;"></div>
          <form id="admin-lesson-form" class="form-grid" style="margin-top:8px;">
            <input type="hidden" id="al-id" />
            <label>順序 <input type="number" id="al-order" min="1" value="1" required /></label>
            <label>標題 <input id="al-title" required /></label>
            <label>內容 <textarea id="al-content" rows="3"></textarea></label>
            <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="submit" class="btn">新增 / 更新單元</button>
              <button type="button" id="admin-lesson-delete" class="btn danger">刪除選取單元</button>
            </div>
          </form>
        </div>
      </section>
  
      <p class="muted" style="margin-top:10px;">＊只有被加入管理者清單的帳號才能看到這個面板。</p>
    </div>
  </dialog>
  
  `.trim();
  document.body.appendChild(tpl.content);
})();

