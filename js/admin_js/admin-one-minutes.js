// 用 sel() 避免與其他工具衝突
    const sel = (s, root=document) => root.querySelector(s);

    // === 1) 自動偵測表單檔名（在 admin_page 子資料夾下要回到上層） ===
    const CANDIDATE_FORMS = ["one-minute.html", "mood.html", "one_minute.html"];
    function baseRoot(){
      // 例如 /web/admin_page/admin-one-minutes.html → /web/
      return location.origin + location.pathname.replace(/admin_page\/admin-one-minutes\.html.*/, '');
    }
    async function fileExists(url){ try{ const r = await fetch(url,{method:'HEAD',cache:'no-store'}); return r.ok; }catch{return false;} }
    let detectedFormPath = null;
    async function detectFormPath(){
      const base = baseRoot();
      for (const name of CANDIDATE_FORMS) {
        if (await fileExists(base + name + '?_=' + Date.now())) { detectedFormPath = name; break; }
      }
      const badge = sel('#form-detect-badge');
      if (!badge) return;
      if (detectedFormPath) badge.innerHTML = `<span class="badge success">已偵測表單檔：${detectedFormPath}</span>`;
      else badge.innerHTML = `<span class="badge danger">找不到表單檔（請上傳 one-minute.html 或套新版 mood.html）</span>`;
    }

    // === 2) 連結 & QR ===
    function buildLinks(courseId, sessionId){
      const base = baseRoot();
      const c = courseId ? `&course=${Number(courseId)}` : '';
      const s = sessionId ? `&session=${Number(sessionId)}` : '';
      const form = detectedFormPath || CANDIDATE_FORMS[0];
      return {
        pre : `${base}${form}?tp=pre${s}${c}`,
        post: `${base}${form}?tp=post${s}${c}`,
        h72 : `${base}${form}?tp=72h${s}${c}`,
      };
    }
    function renderAll(){
      const cid = sel('#course-input').value || sel('#course-select').value || '';
      const sid = sel('#session-input').value || '';
      const links = buildLinks(cid, sid);

      sel('#btn-pre').href  = links.pre;
      sel('#btn-post').href = links.post;
      sel('#btn-72h').href  = links.h72;

      sel('#url-pre').textContent  = links.pre;
      sel('#url-post').textContent = links.post;
      sel('#url-72h').textContent  = links.h72;

      sel('#qr-pre').innerHTML  = '';
      sel('#qr-post').innerHTML = '';
      sel('#qr-72h').innerHTML  = '';
      new QRCode(sel('#qr-pre'),  { text: links.pre,  width:128, height:128 });
      new QRCode(sel('#qr-post'), { text: links.post, width:128, height:128 });
      new QRCode(sel('#qr-72h'),  { text: links.h72,  width:128, height:128 });
    }
    function bindCopyButtons(){
      document.querySelectorAll('.btn.copy').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const text = sel(btn.getAttribute('data-copy')).textContent.trim();
          try{ await navigator.clipboard.writeText(text); btn.textContent='已複製'; setTimeout(()=>btn.textContent='複製連結',1200);}catch{alert('複製失敗，請手動複製');}
        });
      });
    }

    // === 3) 用 sb 載入課程下拉（等 sb 好再叫） ===
    async function loadCourseOptions(){
      const { data, error } = await sb.from('courses')
        .select('id,title,category,published,deleted_at,created_at')
        .order('created_at',{ascending:false})
        .limit(50);
      if (error) throw error;
      const box = sel('#course-select');
      box.innerHTML = '<option value="">— 請選擇課程 —</option>';
      (data||[]).forEach(row=>{
        if (!(row.published && row.deleted_at==null)) return; // 受 RLS 影響，保留可見者
        const opt = document.createElement('option');
        opt.value = row.id;
        opt.textContent = `#${row.id}｜${row.title}（${row.category||"—"}）`;
        box.appendChild(opt);
      });
    }

    // === 4) 測試課程工具（需 courses 寫入權限或後端代理） ===
    const log = (m)=>{ const el=sel('#admin-log'); el.textContent=(el.textContent?el.textContent+'\n':'')+m; };
    function bindAdminTools(){
      sel('#btn-create-course')?.addEventListener('click', async ()=>{
        try{
          const title = '【測試】園藝療癒體驗 ' + new Date().toLocaleString();
          const payload = { title, summary:'用來測心聚 1 分鐘表單流程', category:'horti', published:true };
          const { data, error } = await sb.from('courses').insert(payload).select('id,title,category,created_at').single();
          if (error) throw error;
          log('✅ 建立成功：id='+data.id+'｜'+data.title);
          sel('#course-input').value = data.id;
          sel('#course-select').value = '';
          renderAll();
          loadCourseOptions();
        }catch(e){ console.error(e); log('❌ 建立失敗：'+(e.message||e)); }
      });

      sel('#btn-list-course')?.addEventListener('click', async ()=>{
        try{
          const { data, error } = await sb.from('courses')
            .select('id,title,category,published,created_at')
            .ilike('title','【測試】%')
            .order('created_at',{ascending:false}).limit(20);
          if (error) throw error;
          if (!data?.length) return log('ℹ️ 查無【測試】課程。');
          log('📃 測試課程清單：\n'+data.map(r=>`- id=${r.id}｜${r.title}｜${r.category}｜${r.created_at}`).join('\n'));
        }catch(e){ console.error(e); log('❌ 查詢失敗：'+(e.message||e)); }
      });

      sel('#btn-clear-course')?.addEventListener('click', async ()=>{
        if(!confirm('確定要刪除所有「【測試】」開頭的課程嗎？')) return;
        try{
          const { data, error } = await sb.from('courses').delete().ilike('title','【測試】%').select('id');
          if (error) throw error;
          log('🗑️ 已刪除 '+(data?.length||0)+' 筆測試課程。');
          sel('#course-input').value=''; sel('#course-select').value='';
          renderAll(); loadCourseOptions();
        }catch(e){ console.error(e); log('❌ 刪除失敗：'+(e.message||e)); }
      });
    }

    // === 5) 綁 UI ===
    function bindUI(){
      sel('#btn-refresh')?.addEventListener('click', renderAll);
      sel('#course-select')?.addEventListener('change', ()=>{ sel('#course-input').value = sel('#course-select').value || ''; renderAll(); });
      sel('#course-input')?.addEventListener('input', ()=>{ sel('#course-select').value=''; });
      sel('#session-input')?.addEventListener('input', renderAll);
      bindCopyButtons();
    }

    // === 初始化（關鍵：等 sb 準備好） ===
    waitForSB(async ()=>{
      try{
        await detectFormPath();     // 找出你實際的表單檔名
        await loadCourseOptions();  // 這裡才有 sb
        bindAdminTools();
        bindUI();
        renderAll();
      }catch(e){ console.error(e); }
    });

