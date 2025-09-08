// one-minute.js（即時套用、不改網址；無 displayName/快捷鍵）
// 送出後在本頁顯示「625 狀態名 + 25 種表情」
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle-ids');
  const idSection = document.getElementById('id-section');
  let isShown = false;

  toggleBtn.addEventListener('click', () => {
    isShown = !isShown;
    idSection.style.display = isShown ? 'block' : 'none';
    toggleBtn.textContent = isShown ? '隱藏課程/場次 ID' : '顯示課程/場次 ID';
  });
  
  const $  = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  // 控制台
  const pills = $$('.pill[data-tp]');
  const tpLabel = $('#tp-label');
  const inputCourse  = $('#ctrl-course');
  const inputSession = $('#ctrl-session');

  // 表單/區塊
  const form = $('#one-minute-form');
  const hTimepoint = $('#timepoint');
  const hCourseId  = $('#course_id');
  const hSessionId = $('#session_id');

  const elPostActions = $('#post-only-actions');
  const elPostScope   = $('#post-only-scope');
  const el72h         = $('#h72-only');

  const npsInputs = $$('input[name="nps"]');
  const npsHint   = $('#nps-hint');

  const progressText = $('#progress-text');
  const progressBar  = $('#progress-bar');
  const btnFill3     = $('#btn-fill-3');

  const oneLine      = $('textarea[name="one_line"]');
  const oneLineCount = $('#one-line-count');

  const formMsg      = $('#form-msg');

  // Dock
  const dockTp       = $('#dock-tp');
  const dockMeta     = $('#dock-meta');
  const dockStatus   = $('#dock-status');
  const dockSubmit   = $('#dock-submit');
  const dockBack     = $('#dock-back');
  const dockReset    = $('#dock-reset');

  // ===== 狀態 =====
  let currentTp = 'pre';
  let currentCourse = null;
  let currentSession = null;

  // 允許從網址讀初值（不會寫回去）
  const params = new URLSearchParams(location.search);
  if (['pre','post','72h'].includes((params.get('tp')||'').toLowerCase())) {
    currentTp = params.get('tp').toLowerCase();
  }
  currentCourse  = params.get('course')  ? Number(params.get('course'))  : null;
  currentSession = params.get('session') ? Number(params.get('session')) : null;

  // ===== 小工具 =====
  function syncPills(){
    pills.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.tp === currentTp)));
  }
  function setNpsRequired(required){
    npsInputs.forEach((el,i)=> {
      if (required && i===0) el.setAttribute('required','');
      else el.removeAttribute('required');
    });
    npsHint.textContent = required
      ? '0（完全不會）– 10（一定會）'
      : '0–10（本段在 72 小時追蹤為選填）';
  }
  function applyStateToForm(){
    // 隱藏欄位
    hTimepoint.value = currentTp;
    hCourseId.value  = currentCourse  ?? '';
    hSessionId.value = currentSession ?? '';

    // tp 標籤
    const label = (currentTp === 'pre') ? '課前' : (currentTp === 'post' ? '課後' : '72 小時追蹤');
    tpLabel.textContent = label;
    dockTp.textContent  = label;

    // 區塊顯示
    if (currentTp === 'pre'){
      elPostActions.classList.add('hidden');
      elPostScope.classList.add('hidden');
      el72h.classList.add('hidden');
      setNpsRequired(true);
    } else if (currentTp === 'post'){
      elPostActions.classList.remove('hidden');
      elPostScope.classList.remove('hidden');
      el72h.classList.add('hidden');
      setNpsRequired(true);
    } else { // 72h
      elPostActions.classList.add('hidden');
      elPostScope.classList.add('hidden');
      el72h.classList.remove('hidden');
      setNpsRequired(false);
    }

    // 控制台輸入框
    inputCourse.value  = currentCourse  ?? '';
    inputSession.value = currentSession ?? '';

    // Dock meta
    dockMeta.textContent = `課程：${currentCourse ?? '—'}　場次：${currentSession ?? '—'}`;

    // 讀取草稿與更新進度
    restoreDraft();
    oneLineCount.textContent = oneLine.value.length || 0;
    updateProgress();
  }

  // 進度條：四項核心指標
  function countCoreFilled(){
    const names = ['stability','recovery','connectedness','focus'];
    return names.reduce((acc,n)=> acc + ($$(`input[name="${n}"]`).some(r=>r.checked) ? 1 : 0), 0);
  }
  function updateProgress(){
    const filled = countCoreFilled();
    progressText.textContent = `${filled} / 4`;
    progressBar.style.width = `${(filled/4)*100}%`;
    dockStatus.textContent = filled<4 ? `尚缺 ${4-filled} 題核心指標` : '核心指標已完成';
  }

  // 字數計數器
  oneLine.addEventListener('input', () => { oneLineCount.textContent = oneLine.value.length; saveDraftSoon(); });

  // 一鍵填 3 分
  function setGroupValue(name, val){
    const radios = $$(`input[name="${name}"]`);
    const target = radios.find(r => r.value === String(val));
    if (target){ target.checked = true; target.dispatchEvent(new Event('change', {bubbles:true})); }
  }
  btnFill3.addEventListener('click', () => {
    ['stability','recovery','connectedness','focus'].forEach(k => setGroupValue(k, 3));
    showToast('已套用「3 分」到四個指標，可再微調。');
  });

  // Dock 行為（整合返回/重填/送出）
  dockBack?.addEventListener('click', () => { if (document.referrer) history.back(); else location.href = 'index.html'; });
  dockReset?.addEventListener('click', () => { form.reset(); clearDraft(); updateProgress(); showToast('已重置表單'); });
  dockSubmit.addEventListener('click', () => form.requestSubmit());

  // 即時套用：pills / inputs
  pills.forEach(btn => {
    btn.addEventListener('click', () => { currentTp = btn.dataset.tp; syncPills(); applyStateToForm(); });
  });
  inputCourse.addEventListener('input', () => {
    const c = inputCourse.value.trim();
    currentCourse = c === '' ? null : Number(c);
    applyStateToForm();
  });
  inputSession.addEventListener('input', () => {
    const s = inputSession.value.trim();
    currentSession = s === '' ? null : Number(s);
    applyStateToForm();
  });

  // 任何 radio/checkbox 變更都即時更新完成度 + 儲存草稿
  form.addEventListener('change', (e) => {
    if (e.target && (e.target.type === 'radio' || e.target.type === 'checkbox')) {
      updateProgress();
      saveDraftSoon();
    }
  });

  // ===== 草稿儲存（localStorage） =====
  const draftKey = () => `oneMinuteDraft:${currentTp}:${currentCourse ?? ''}:${currentSession ?? ''}`;
  let draftTimer = null;
  function saveDraftSoon(){ clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 300); }
  function saveDraft(){
    const fd = new FormData(form);
    const obj = {};
    for (const [k,v] of fd.entries()){ obj[k] = v; }
    ['stability','recovery','connectedness','focus','nps'].forEach(k=>{
      const r = $$(`input[name="${k}"]:checked`)[0];
      if (r) obj[k] = r.value;
    });
    obj._ts = Date.now();
    try{ localStorage.setItem(draftKey(), JSON.stringify(obj)); }catch(e){}
  }
  function restoreDraft(){
    try{
      const raw = localStorage.getItem(draftKey());
      if (!raw) return;
      const obj = JSON.parse(raw);
      Object.entries(obj).forEach(([k,v])=>{
        if (k.startsWith('_')) return;
        const el = form.elements[k];
        if (!el) return;
        if (el instanceof RadioNodeList){
          const r = $$(`input[name="${k}"]`).find(x=>x.value===String(v));
          if (r) r.checked = true;
        } else {
          el.value = v;
        }
      });
    }catch(e){}
  }
  function clearDraft(){ try{ localStorage.removeItem(draftKey()); }catch(e){} }

  // ===== Toast / 訊息 =====
  function showToast(msg, type='ok'){
    formMsg.innerHTML = msg;
    formMsg.className = `alert ${type}`;
    formMsg.classList.remove('hidden');
    setTimeout(()=> formMsg.classList.add('hidden'), 2000);
  }

  // ===== 狀態代號（5^4） + 25 種表情（5×5 情緒格） =====
  const NAME_STAB = ['飄','安','穩','定','泰'];      // 穩定度 1..5
  const NAME_RECV = ['脆','回','韌','強','堅'];      // 復原 1..5
  const NAME_CONN = ['孤','疏','連','親','融'];      // 連結 1..5
  const NAME_FOCUS= ['散','亂','專','聚','澄'];      // 專注 1..5

  function buildStateName(s,r,c,f){ return `${NAME_STAB[s-1]}${NAME_RECV[r-1]}${NAME_CONN[c-1]}${NAME_FOCUS[f-1]}`; }

  // 以檔名規則回傳 25 張圖其中之一：img/emogi/mood-<row>-<col>.png
  function clamp5(n){ return Math.min(5, Math.max(1, n)); }
  function levelFromAvg(a,b){ return clamp5(Math.round((a+b)/2)); } // 1..5
  
  function stateIconSrc(s, r, c, f) {
    const row = levelFromAvg(r, c); // 復原 x 連結
    const col = levelFromAvg(s, f); // 穩定 x 專注
    return `img/emogi/mood-${row}-${col}.png`;
  }

  function showStateResult(s,r,c,f){
    const name    = buildStateName(s,r,c,f);
    const iconSrc = stateIconSrc(s,r,c,f);
  
    formMsg.className = 'alert ok';
    formMsg.innerHTML =
      `<div class="state-result">
         <img src="${iconSrc}" alt="狀態圖示" class="state-icon" width="40" height="40" loading="lazy" decoding="async">
         <div><strong>狀態：${name}</strong><div class="muted">已成功記錄</div></div>
       </div>`;
    formMsg.classList.remove('hidden');
  }

  // ===== 初始化 =====
  syncPills();
  applyStateToForm();

  // ===== 送出（留在本頁；顯示狀態代號 + 表情） =====
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 需登入（共用：未登入會開登入/註冊）
    if (typeof requireAuthOrOpenModal === 'function'){
      if (!requireAuthOrOpenModal(e)) return;
    }
    const user = window.currentUser || null;
    if (!user) { showToast('請先登入再送出表單','danger'); return; }

    const fd = new FormData(form);
    const getChecked = (name) => $$(`input[name="${name}"]:checked`).map(cb => cb.value);

    // post 的其他
    const nextActions = getChecked('next_actions');
    const naOther = (fd.get('next_actions_other')||'').trim();
    if (naOther) nextActions.push(naOther);

    // 72h 的其他
    const doneActions = getChecked('actions_done');
    const daOther = (fd.get('actions_done_other')||'').trim();
    if (daOther) doneActions.push(daOther);

    const toNum = (v) => (v===null || v==='') ? null : Number(v);
    const stability     = toNum(fd.get('stability'));
    const recovery      = toNum(fd.get('recovery'));
    const connectedness = toNum(fd.get('connectedness'));
    const focus         = toNum(fd.get('focus'));
    const nps           = toNum(fd.get('nps')); // 72h 可為 null

    if (![stability,recovery,connectedness,focus].every(n => typeof n === 'number' && n>=1 && n<=5)){
      showToast('四個核心指標需要 1~5 的分數','danger'); return;
    }
    if (!(currentTp === 'pre' || currentTp === 'post' || currentTp === '72h')) {
      showToast('timepoint 錯誤','danger'); return;
    }
    if (!(nps === null || (nps>=0 && nps<=10))) {
      showToast('NPS 需為 0–10','danger'); return;
    }

    const supabase = window.sb;
    if (!supabase) { showToast('Supabase 尚未初始化','danger'); return; }

    const payload = {
      user_id: user.id,
      course_id: currentCourse ?? null,
      session_id: currentSession ?? null,
      timepoint: currentTp,
      stability, recovery, connectedness, focus,
      nps,
      one_line: String(fd.get('one_line') || ''),
      next_actions: (currentTp === 'post') ? nextActions : [],
      actions_done: (currentTp === '72h') ? doneActions : [],
      adoption_scope: (currentTp === 'post') ? getChecked('adoption_scope') : [],
      submitted_at: new Date().toISOString()
    };

    dockSubmit.disabled = true;
    try {
      const { error } = await supabase.from('one_minute').insert(payload);
      if (error) {
        console.error('[one_minute insert error]', error);
        showToast(`送出失敗：${error.message || '不明錯誤'}`,'danger');
        dockSubmit.disabled = false;
        return;
      }
      clearDraft();
      showStateResult(stability, recovery, connectedness, focus); // 留在本頁顯示結果
      dockSubmit.disabled = false;
    } catch (err) {
      console.error(err);
      showToast('送出失敗（例外），請稍後再試或聯絡我們。','danger');
      dockSubmit.disabled = false;
    }
  });
});
