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
/* === Dialog 基本 === */
dialog{
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
dialog::backdrop{ background: rgba(0,0,0,.35); }

/* 內容容器 */
dialog .panel, dialog form.card{
  position: relative;
  padding: 16px 18px;
  overflow: auto;
  max-height: calc(90dvh - 32px);
  background: #fff;
}

/* 頂部藍綠細緞帶（呼應主題，不需改 HTML） */
dialog .panel::before{
  content:"";
  position:absolute;
  left: 0; right: 0; top: 0;
  height: 3px;
  border-radius: 0 0 8px 8px;
  background: linear-gradient(90deg, var(--accent-blue, #3bb3c3), #a7dcd7);
  opacity:.75;
}

/* 表單元素 */
dialog form.card label{ display:block; margin:12px 0 8px; font-weight:700; }
dialog form.card label input{
  width:100%;
  box-sizing:border-box;
  margin-top:6px;
  padding:12px 12px;
  border-radius:12px;
  border:1px solid rgba(59,179,195,.25);
  background:#fff;
  transition: box-shadow .18s ease, border-color .18s ease;
  font: inherit;
}
dialog form.card label input:focus-visible{
  outline: none;
  box-shadow: 0 0 0 4px rgba(59,179,195,.22);
  border-color: var(--accent-blue, #3bb3c3);
}
dialog form.card .actions{
  display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;
}

/* === Auth Tabs（登入／註冊）=== */
.auth-tabs{
  display:flex; gap:8px;
  padding:8px;
  border-radius:12px;
  margin: 2px 0 12px;
  background: linear-gradient(180deg, rgba(59,179,195,.06), rgba(167,220,215,.06));
  border:1px solid rgba(59,179,195,.18);
}
.auth-tab{
  flex:1; text-align:center;
  padding:10px 12px;
  border-radius:999px;
  cursor:pointer;
  border:1px solid transparent;
  background: rgba(255,255,255,.8);
  color: var(--accent-blue, #3bb3c3);
  font-weight:700;
  transition: background .18s ease, box-shadow .18s ease, color .18s ease, transform .12s ease;
}
@media (hover:hover) and (pointer:fine){
  .auth-tab:hover{
    background: linear-gradient(135deg, rgba(59,179,195,.10), rgba(167,220,215,.16));
    color:#0c4030;
    box-shadow: 0 2px 10px rgba(59,179,195,.12);
    transform: translateY(-1px);
  }
}
.auth-tab[aria-selected="true"]{
  background: linear-gradient(135deg, var(--accent-blue, #3bb3c3), #a7dcd7);
  color:#0c4030;
  border-color: rgba(59,179,195,.28);
  box-shadow: 0 2px 12px rgba(59,179,195,.18);
}

/* 分頁內容切換動畫 */
.auth-view{ display:none; }
.auth-view.active{
  display:block;
  animation: authFade .2s ease;
}
@keyframes authFade{
  from{ opacity:0; transform: translateY(4px); }
  to  { opacity:1; transform: none; }
}

/* === 對話框內的按鈕主題（沿用你的藍綠 CTA） === */
dialog .actions .btn.primary{
  border: none;
  background: linear-gradient(135deg, var(--accent-blue, #3bb3c3), #a7dcd7);
  color: #0c4030;
}
dialog .actions .btn.primary:hover{
  background: linear-gradient(135deg, #a7dcd7, var(--accent-blue, #3bb3c3));
}
dialog .actions .btn.secondary{
  background:#fff;
  color: var(--accent-blue, #3bb3c3);
  border:1px solid rgba(59,179,195,.28);
}
dialog .actions .btn.secondary:hover{
  background: rgba(167,220,215,.16);
}

/* Admin 視窗寬度 */
#admin-panel{ width: min(980px, 95vw); max-width: 95vw; }

/* 行動端全螢幕化 */
@media (max-width: 420px){
  dialog{ width: 100dvw; height: 100dvh; max-width: none; max-height: none; inset: 0; transform: none; border-radius: 0; }
  dialog .panel, dialog form.card{ height: 100%; max-height: none; padding: 16px; }
}

/* 防捲動 */
body.modal-open{ overflow: hidden; }

/* === Search dialog === */
.search-head{
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}
#search-input{
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(59,179,195,.25);
  background: #fff;
  font: inherit;
  transition: box-shadow .18s ease, border-color .18s ease;
}
#search-input:focus-visible{
  outline: none;
  box-shadow: 0 0 0 4px rgba(59,179,195,.22);
  border-color: var(--accent-blue, #3bb3c3);
}
#search-suggest{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
#search-suggest .chip{
  padding: 6px 12px; border-radius: 999px; cursor: pointer;
  border: 1px solid #d7ead9; background: #fff; font-weight: 700;
}
#search-suggest .chip:hover{ background: #ecfdf5; border-color:#b7ebc0; }

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


  // --- Search dialog（改為：個人化課程推薦） ---
  const searchDlg = ensureDialog('search-modal', `
    <dialog id="search-modal">
      <form id="rec-form" class="card panel" novalidate>
        <h3 style="margin-top:0;">個人化課程推薦</h3>
  
        <div class="form-grid" style="margin-top:10px;">
          <label>年齡
            <input type="number" id="age" min="5" max="120" placeholder="例如 28" required />
          </label>
          <label>性別
            <select id="gender" required>
              <option value="">— 選擇 —</option>
              <option value="female">女性</option>
              <option value="male">男性</option>
              <option value="nonbinary">非二元/不透露</option>
            </select>
          </label>
          <label>興趣（可多選，以逗號分隔）
            <input type="text" id="interests" placeholder="室內植物, 多肉, 正念, 手作, 園藝入門" />
          </label>
          <label>職業
            <select id="profession">
              <option value="">— 選擇 —</option>
              <option value="student">學生</option>
              <option value="teacher">教師/輔導</option>
              <option value="healthcare">醫護/照護</option>
              <option value="office">上班族</option>
              <option value="retired">退休</option>
              <option value="other">其他</option>
            </select>
          </label>
        </div>
  
        <div class="actions" style="margin-top:10px;">
          <button type="submit" class="btn primary">產生推薦</button>
          <button type="reset" class="btn secondary">清除</button>
          <button type="button" class="btn secondary" onclick="document.getElementById('search-modal').close()">關閉</button>
        </div>
  
        <!-- 推薦結果 -->
        <div id="rec-results" class="search-results" style="margin-top:12px;"></div>
      </form>
    </dialog>
  `);
  bindModalLock(searchDlg);

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
            <button type="button" class="btn secondary" onclick="document.getElementById('auth-modal').close()">取消</button>
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
            <button id="btn-do-signup" class="btn primary" type="submit">註冊</button>
            <button type="button" class="btn secondary" onclick="document.getElementById('auth-modal').close()">取消</button>
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
          <button class="btn secondary" type="button" onclick="document.getElementById('enroll-dialog').close()">取消</button>
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

  // === wire search modal（個人化推薦內嵌版） ===
  (function wireSearch(){
    const dlg   = document.getElementById('search-modal');
    const form  = document.getElementById('rec-form');
    const box   = document.getElementById('rec-results');
  
    function openSearch(e){
      if (e) e.preventDefault();
      dlg.showModal();
      // 每次開啟清空結果
      if (box) box.innerHTML = '';
      // 把焦點放到第一個欄位
      setTimeout(()=> document.getElementById('age')?.focus(), 0);
    }
  
    // 後備工具：normalize / interests / score / render（若頁面沒提供就用這些）
    const normalizeTitle = window.normalizeTitle || (t => (t||'').toString().toLowerCase().replace(/\s+/g,'-'));
    const parseInterests = window.parseInterests || (s => (s||'')
        .split(/[，,]/).map(x=>x.trim()).filter(Boolean).map(x=>x.toLowerCase()));
    const fallbackScore  = (course, ctx) => {
      // 非常簡化：興趣關鍵字匹配 title/summary/description
      const hay = ((course.title||'')+' '+(course.summary||'')+' '+(course.description||'')).toLowerCase();
      let score = 0, tags=[];
      (ctx.interests||[]).forEach(k=>{
        if (hay.includes(k)) { score += 2; tags.push(k); }
      });
      // 年齡/職業簡單加權（可按需擴充）
      if (ctx.profession && /teacher|health|office|student|retired/.test(ctx.profession)) score += 1;
      return { score, tags, level: course.level || '一般' };
    };
    const scoreDbCourse = window.scoreDbCourse || fallbackScore;
  
    const renderRecommendationsFromDb = window.renderRecommendationsFromDb || function(list){
      if (!box) return;
      if (!list.length){
        box.innerHTML = `<p class="muted">沒有找到合適的推薦，試試不同的興趣關鍵字（如：室內植物、正念、多肉、親子）。</p>`;
        return;
      }
      box.innerHTML = list.map(c => `
        <article class="course-card">
          <img src="${c.cover_url || `https://picsum.photos/seed/${normalizeTitle(c.title)}/640/360`}" alt="${c.title}" style="width:100%;height:140px;object-fit:cover;border-radius:8px" />
          <h3>${c.title}</h3>
          <div class="course-meta">
            <span class="badge">${c._level || '一般'}</span>
            ${(c._tags || []).slice(0,4).map(t=>`<span class="badge">${t}</span>`).join('')}
          </div>
          <div class="cta">
            <a href="course.html?id=${c.id}" class="btn primary">查看課程</a>
          </div>
        </article>
      `).join('');
    };
  
    async function runRecommendFromForm(){
      const age = parseInt(document.getElementById('age')?.value || '0', 10);
      const gender = document.getElementById('gender')?.value || 'nonbinary';
      const interests = parseInterests(document.getElementById('interests')?.value);
      const profession = document.getElementById('profession')?.value || 'other';
  
      // 顯示 loading
      if (box) box.innerHTML = `<div class="search-empty">產生推薦中…</div>`;
  
      try{
        const { data: courses, error } = await (window.sb || {}).from('courses')
          .select('id,title,summary,description,cover_url,teacher,level,published,deleted_at')
          .eq('published', true)
          .is('deleted_at', null);
  
        if (error) throw error;
  
        const scored = (courses||[]).map(c => {
          const r = scoreDbCourse(c, {age, gender, interests, profession});
          return { ...c, _score: r.score, _tags: r.tags, _level: r.level };
        });
        const top = scored.filter(c=>c._score>0).sort((a,b)=>b._score-a._score).slice(0,6);
        renderRecommendationsFromDb(top);
      } catch(err){
        console.error('[recommend] load/score error:', err);
        if (box) box.innerHTML = `<div class="search-empty">載入推薦時發生錯誤，請稍後再試。</div>`;
      }
    }
  
    // 送出表單 → 在對話框內渲染推薦
    form?.addEventListener('submit', (e)=>{
      e.preventDefault();
      runRecommendFromForm();
    });
  
    // Reset 清空結果
    form?.addEventListener('reset', ()=>{
      if (box) box.innerHTML = '';
    });
  
    // 快捷鍵 "/" 開啟（避免其他 dialog 開啟時觸發）
    window.addEventListener('keydown', (e)=>{
      if (e.key === '/' && !document.querySelector('dialog[open]')) {
        e.preventDefault(); openSearch();
      }
    });
  
    // 綁定右上角放大鏡（shared-layout 可能延後插入）
    function tryBind(times=12){
      const link = document.getElementById('recommend-link');
      if (link && !link.dataset.bound) {
        link.addEventListener('click', openSearch, { passive:false });
        link.dataset.bound = '1';
        return;
      }
      if (times > 0) setTimeout(()=>tryBind(times-1), 150);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ()=>tryBind());
    } else {
      tryBind();
    }
  })();

  // 通知其他腳本可以綁定事件
  document.dispatchEvent(new Event('dialogs:mounted'));
})();
