(() => {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const el = (tag, attrs = {}, html = "") => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => { if (k === "className") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k,v); });
    if (html) n.innerHTML = html;
    return n;
  };
  const style = `
    #stemHub{margin:26px 0;padding:24px;border:1px solid #e1e8e2;border-radius:18px;background:#fbfcfa;color:#34483b}
    #stemHub h2{margin:0 0 8px;color:#345d49}
    #stemHub h3{margin:0 0 10px;color:#456c52}
    #stemHub .stem-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
    #stemHub .stem-tabs button{margin:0;padding:10px 14px;background:#e8efe9;color:#355b45}
    #stemHub .stem-tabs button.active{background:#52745e;color:#fff}
    #stemHub .stem-card{background:#fff;border:1px solid #e2e9e3;border-radius:14px;padding:18px;margin:12px 0}
    #stemHub label{margin:12px 0 6px}
    #stemHub input,#stemHub textarea,#stemHub select{margin:5px 0 10px}
    #stemHub textarea{min-height:95px}
    #stemHub .stem-muted{font-size:13px;color:#758278;line-height:1.6}
    #stemHub .stem-result{white-space:pre-wrap;line-height:1.7;margin-top:10px}
    #stemHub .stem-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    #stemHub .stem-item{padding:12px 0;border-bottom:1px solid #edf1ed}
    #stemHub button{margin-right:6px}
    @media(max-width:650px){#stemHub{padding:14px}#stemHub .stem-row{grid-template-columns:1fr}}
  `;
  function addStyles(){ if(document.getElementById("stemFeatureStyles"))return; const s=el("style",{id:"stemFeatureStyles"});s.textContent=style;document.head.appendChild(s); }

  async function init(profile) {
    if (!window.supabase || typeof supabaseClient === "undefined" || !supabaseClient) return;
    const home = document.getElementById("homeSection");
    if (!home || home.classList.contains("hidden")) return;
    let hub = document.getElementById("stemHub");
    if (!hub) {
      addStyles();
      hub = el("section",{id:"stemHub"});
      const revision = document.getElementById("revisionPanel");
      home.insertBefore(hub, revision || home.querySelector("#logoutButton"));
    }
    const { data:userData } = await supabaseClient.auth.getUser();
    if (!userData?.user) return;
    const user = userData.user;
    const teacher = profile?.role === "teacher";
    hub.innerHTML = `
      <h2>Không gian học tập STEM</h2>
      <p class="stem-muted">Học tập chủ động, theo dõi tiến bộ và lưu giữ sản phẩm Ngữ văn của em.</p>
      <div class="stem-tabs">
        <button type="button" class="active" data-tab="assistant">Trợ lý Ngữ văn</button>
        <button type="button" data-tab="progress">Hồ sơ học tập</button>
        <button type="button" data-tab="practice">Luyện tập tương tác</button>
        <button type="button" data-tab="library">Thư viện học tập</button>
        <button type="button" data-tab="portfolio">Sản phẩm của em</button>
      </div>
      <div id="stemContent" aria-live="polite"></div>`;
    const content = hub.querySelector("#stemContent");
    const buttons = [...hub.querySelectorAll("[data-tab]")];
    buttons.forEach(b => b.addEventListener("click", () => {
      buttons.forEach(x => x.classList.toggle("active", x===b));
      render(b.dataset.tab);
    }));

    const say = (node, message) => { node.textContent = message; };
    const card = (title, desc="") => {
      const n=el("section",{className:"stem-card"});
      n.append(el("h3",{text:title}));
      if(desc)n.append(el("p",{className:"stem-muted",text:desc}));
      return n;
    };
    const getErr = (e) => e?.message || "Có lỗi xảy ra. Em/cô thử tải lại nhé.";
    async function render(tab) {
      content.innerHTML = '<p class="stem-muted">Đang tải dữ liệu...</p>';
      if(tab==="assistant") return assistant();
      if(tab==="progress") return progress();
      if(tab==="practice") return practice();
      if(tab==="library") return library();
      if(tab==="portfolio") return portfolio();
    }
    function assistant(){
      const c=card("Trợ lý học tập Ngữ văn","Trợ lý gợi mở cách hiểu đề, tìm ý, lập dàn ý và tự sửa bài. Không viết hộ bài hoàn chỉnh.");
      c.innerHTML += `
        <label for="stemPrompt">Em cần hỗ trợ điều gì?</label>
        <textarea id="stemPrompt" rows="5" maxlength="6000" placeholder="Ví dụ: Hướng dẫn em tìm ý cho đề bài trình bày cảm xúc về một bài thơ..."></textarea>
        <button type="button" id="stemAsk">Gửi câu hỏi</button>
        <div id="stemAnswer" class="stem-result"></div>`;
      c.querySelector("#stemAsk").addEventListener("click",async()=>{
        const prompt=c.querySelector("#stemPrompt").value.trim(), out=c.querySelector("#stemAnswer"), btn=c.querySelector("#stemAsk");
        if(!prompt){say(out,"Em hãy nhập câu hỏi trước nhé.");return;}
        btn.disabled=true;btn.textContent="Đang suy nghĩ...";
        try{
          const {data,error}=await supabaseClient.functions.invoke("learning-api",{body:{action:"study_assistant",prompt}});
          if(error||!data?.success)throw new Error(data?.error||error?.message||"Chưa nhận được phản hồi.");
          say(out,data.answer);
        }catch(e){say(out,"Trợ lý chưa sẵn sàng: "+getErr(e)+". Cần triển khai Edge Function learning-api và cấu hình OPENAI_API_KEY trong Supabase.");}
        finally{btn.disabled=false;btn.textContent="Gửi câu hỏi";}
      });
      content.replaceChildren(c);
    }
    async function progress(){
      const c=card(teacher?"Theo dõi tiến bộ học sinh":"Hồ sơ học tập cá nhân","Tổng hợp kết quả bài tập, lượt luyện tập và sản phẩm đã lưu.");
      try{
        if(teacher){
          const [subs,attempts,items]=await Promise.all([
            supabaseClient.from("submissions").select("student_id,score"),
            supabaseClient.from("learning_attempts").select("student_id,score,total"),
            supabaseClient.from("learning_portfolio").select("id")
          ]);
          if(subs.error)throw subs.error;
          const scored=(subs.data||[]).filter(x=>x.score!==null&&x.score!==undefined);
          const avg=scored.length?(scored.reduce((a,x)=>a+Number(x.score),0)/scored.length).toFixed(2):"Chưa có";
          c.innerHTML += `<div class="stem-row"><p><strong>${subs.data?.length||0}</strong><br><span class="stem-muted">Lượt nộp bài</span></p><p><strong>${avg}${avg==="Chưa có"?"":"/10"}</strong><br><span class="stem-muted">Điểm trung bình đã chấm</span></p><p><strong>${attempts.data?.length||0}</strong><br><span class="stem-muted">Lượt luyện tập</span></p><p><strong>${items.data?.length||0}</strong><br><span class="stem-muted">Sản phẩm lưu trong hồ sơ</span></p></div>`;
        }else{
          const [subs,attempts,items]=await Promise.all([
            supabaseClient.from("submissions").select("score,feedback,submitted_at,assignment_id").eq("student_id",user.id).order("submitted_at",{ascending:false}),
            supabaseClient.from("learning_attempts").select("score,total,submitted_at,activity_id").eq("student_id",user.id).order("submitted_at",{ascending:false}),
            supabaseClient.from("learning_portfolio").select("id").eq("student_id",user.id)
          ]);
          if(subs.error)throw subs.error;
          const scored=(subs.data||[]).filter(x=>x.score!==null&&x.score!==undefined);
          const avg=scored.length?(scored.reduce((a,x)=>a+Number(x.score),0)/scored.length).toFixed(2):"Chưa có";
          c.innerHTML += `<div class="stem-row"><p><strong>${subs.data?.length||0}</strong><br><span class="stem-muted">Lượt nộp bài</span></p><p><strong>${avg}${avg==="Chưa có"?"":"/10"}</strong><br><span class="stem-muted">Điểm trung bình</span></p><p><strong>${attempts.data?.length||0}</strong><br><span class="stem-muted">Lượt luyện tập</span></p><p><strong>${items.data?.length||0}</strong><br><span class="stem-muted">Sản phẩm cá nhân</span></p></div><h4>Lịch sử bài nộp gần đây</h4>`;
          (subs.data||[]).slice(0,8).forEach(x=>{const p=el("p",{className:"stem-item",text:(x.submitted_at?new Date(x.submitted_at).toLocaleDateString("vi-VN"):"") + " • " +(x.score==null?"Chưa chấm":x.score+"/10")+(x.feedback?" • "+x.feedback:"")});c.append(p);});
        }
      }catch(e){c.append(el("p",{className:"stem-muted",text:"Chưa tải được hồ sơ: "+getErr(e)+". Kiểm tra migration STEM đã được chạy trong Supabase."}));}
      content.replaceChildren(c);
    }
    async function practice(){
      const c=card(teacher?"Tạo hoạt động luyện tập":"Bài luyện tập dành cho lớp "+(profile.class_name||"em"),"Câu hỏi trắc nghiệm được chấm tự động trên máy chủ; đáp án đúng không gửi xuống trình duyệt trước khi nộp.");
      if(teacher){
        c.innerHTML += `
          <label>Tên hoạt động</label><input id="actTitle" maxlength="140" placeholder="Ví dụ: Nhận biết phó từ">
          <label>Mô tả ngắn</label><input id="actDesc" maxlength="300" placeholder="Mục tiêu luyện tập">
          <label>Lớp</label><select id="actClass"><option>7A</option><option>7C</option></select>
          <div id="stemQuestions"></div>
          <button type="button" id="addStemQuestion">+ Thêm câu hỏi</button>
          <button type="button" id="saveStemActivity">Đăng hoạt động</button><p id="actMsg" class="stem-result"></p>`;
        const qbox=c.querySelector("#stemQuestions");
        let count=0;
        const addQuestion=()=>{
          count++;const q=el("div",{className:"stem-item"});
          q.innerHTML=`<strong>Câu hỏi ${count}</strong><label>Nội dung câu hỏi</label><textarea class="q-prompt" rows="2"></textarea><div class="stem-row"><div><label>A</label><input class="q-a"></div><div><label>B</label><input class="q-b"></div><div><label>C</label><input class="q-c"></div><div><label>D</label><input class="q-d"></div></div><label>Đáp án đúng</label><select class="q-key"><option>A</option><option>B</option><option>C</option><option>D</option></select><label>Giải thích</label><input class="q-explain"><label>Điểm</label><input class="q-points" type="number" min="0.25" step="0.25" value="1">`;
          qbox.append(q);
        };
        addQuestion();c.querySelector("#addStemQuestion").addEventListener("click",addQuestion);
        c.querySelector("#saveStemActivity").addEventListener("click",async()=>{
          const msg=c.querySelector("#actMsg"),btn=c.querySelector("#saveStemActivity");
          const title=c.querySelector("#actTitle").value.trim(),cls=c.querySelector("#actClass").value;
          const questionRows=[...qbox.children].map(q=>({prompt:q.querySelector(".q-prompt").value.trim(),options:["a","b","c","d"].map(k=>q.querySelector(".q-"+k).value.trim()),correct_answer:q.querySelector(".q-key").value,explanation:q.querySelector(".q-explain").value.trim(),points:Number(q.querySelector(".q-points").value||1)}));
          if(!title||questionRows.some(q=>!q.prompt||q.options.some(x=>!x))){say(msg,"Cô vui lòng nhập tên hoạt động, nội dung và đủ 4 phương án cho mỗi câu.");return;}
          btn.disabled=true;
          try{
            const {data:u}=await supabaseClient.auth.getUser();
            const {data:a,error}=await supabaseClient.from("learning_activities").insert({title,description:c.querySelector("#actDesc").value.trim(),class_name:cls,created_by:u.user.id,is_published:true}).select("id").single();
            if(error)throw error;
            const rows=questionRows.map((q,i)=>({activity_id:a.id,prompt:q.prompt,options:q.options,correct_answer:q.correct_answer,explanation:q.explanation,points:q.points,position:i+1}));
            const saved=await supabaseClient.from("learning_questions").insert(rows);
            if(saved.error){await supabaseClient.from("learning_activities").delete().eq("id",a.id);throw saved.error;}
            say(msg,"Đã đăng hoạt động luyện tập cho lớp "+cls+".");c.querySelector("#actTitle").value="";qbox.innerHTML="";count=0;addQuestion();
          }catch(e){say(msg,"Chưa tạo được hoạt động: "+getErr(e));}
          finally{btn.disabled=false;}
        });
      }else{
        try{
          const {data:acts,error}=await supabaseClient.from("learning_activities").select("id,title,description,created_at").eq("class_name",profile.class_name).eq("is_published",true).order("created_at",{ascending:false});
          if(error)throw error;
          if(!acts?.length)c.append(el("p",{className:"stem-muted",text:"Chưa có hoạt động luyện tập mới."}));
          for(const a of acts||[]){
            const block=el("div",{className:"stem-item"});block.append(el("h4",{text:a.title}),el("p",{className:"stem-muted",text:a.description||""}));
            const {data:qs,error:qe}=await supabaseClient.from("learning_questions_public").select("id,prompt,options,points,position").eq("activity_id",a.id).order("position");
            if(qe)throw qe;
            const form=el("div");const answers={};
            (qs||[]).forEach((q,i)=>{
              const wrap=el("div",{className:"stem-item"});wrap.append(el("p",{text:(i+1)+". "+q.prompt}));
              (q.options||[]).forEach((option,j)=>{
                const key="ABCD"[j];const label=el("label");const radio=el("input",{type:"radio",name:"q_"+q.id,value:key});radio.style.width="auto";radio.addEventListener("change",()=>answers[q.id]=key);label.append(radio,document.createTextNode(" "+key+". "+option));wrap.append(label);
              });form.append(wrap);
            });
            const submit=el("button",{type:"button",text:"Nộp bài và xem kết quả"}),out=el("p",{className:"stem-result"});
            submit.addEventListener("click",async()=>{
              if(Object.keys(answers).length!==(qs||[]).length){say(out,"Em hãy trả lời tất cả câu hỏi nhé.");return;}
              submit.disabled=true;
              try{
                const {data,error}=await supabaseClient.functions.invoke("learning-api",{body:{action:"quiz_submit",activity_id:a.id,answers}});
                if(error||!data?.success)throw new Error(data?.error||error?.message||"Chưa chấm được bài.");
                say(out,"Kết quả: "+data.score+"/"+data.total+" điểm.\n"+data.review.map((r,i)=>"Câu "+(i+1)+": "+(r.correct?"Đúng":"Chưa đúng")+(r.explanation?" • "+r.explanation:"")).join("\n"));
                submit.remove();
              }catch(e){say(out,"Chưa chấm được: "+getErr(e)+". Cần triển khai Edge Function learning-api.");submit.disabled=false;}
            });
            block.append(form,submit,out);c.append(block);
          }
        }catch(e){c.append(el("p",{className:"stem-muted",text:"Chưa tải được hoạt động: "+getErr(e)+". Kiểm tra migration STEM."}));}
      }
      content.replaceChildren(c);
    }
    async function library(){
      const c=card(teacher?"Thư viện học liệu":"Thư viện học tập","Nơi lưu trữ tài liệu, hướng dẫn và đường dẫn học tập theo lớp.");
      if(teacher)c.innerHTML+=`<label>Tên tài liệu</label><input id="resTitle"><label>Mô tả</label><textarea id="resDesc" rows="2"></textarea><label>Nội dung ghi chú (nếu có)</label><textarea id="resContent" rows="3"></textarea><label>Đường dẫn tài liệu (nếu có)</label><input id="resUrl" type="url" placeholder="https://..."><label>Phạm vi</label><select id="resClass"><option value="">Tất cả lớp</option><option>7A</option><option>7C</option></select><button type="button" id="saveResource">Đăng tài liệu</button><p id="resMsg" class="stem-result"></p>`;
      if(teacher)c.querySelector("#saveResource").addEventListener("click",async()=>{
        const msg=c.querySelector("#resMsg"),title=c.querySelector("#resTitle").value.trim();
        if(!title){say(msg,"Cô hãy nhập tên tài liệu.");return;}
        try{const {data:u}=await supabaseClient.auth.getUser();const {error}=await supabaseClient.from("learning_resources").insert({title,description:c.querySelector("#resDesc").value.trim(),content:c.querySelector("#resContent").value.trim(),external_url:c.querySelector("#resUrl").value.trim()||null,class_name:c.querySelector("#resClass").value||null,created_by:u.user.id,resource_type:c.querySelector("#resUrl").value.trim()?"link":"note"});if(error)throw error;say(msg,"Đã đăng tài liệu.");await loadResources(c);}catch(e){say(msg,"Chưa đăng được: "+getErr(e));}
      });
      await loadResources(c);content.replaceChildren(c);
    }
    async function loadResources(c){
      try{
        c.querySelector(".stem-resource-list")?.remove();
        let query=supabaseClient.from("learning_resources").select("id,title,description,content,external_url,class_name,created_at").order("created_at",{ascending:false});
        if(!teacher)query=query.or("class_name.is.null,class_name.eq."+profile.class_name);
        const {data,error}=await query;if(error)throw error;
        const list=el("div",{className:"stem-resource-list"});
        (data||[]).forEach(r=>{const item=el("div",{className:"stem-item"});item.append(el("strong",{text:r.title}),el("p",{className:"stem-muted",text:(r.class_name||"Tất cả lớp")+" • "+(r.description||"")}));if(r.content)item.append(el("p",{className:"stem-result",text:r.content}));if(r.external_url){const a=el("a",{href:r.external_url,target:"_blank",rel:"noopener noreferrer",text:"Mở tài liệu"});item.append(a);}list.append(item);});
        if(!data?.length)list.append(el("p",{className:"stem-muted",text:"Thư viện chưa có tài liệu."}));
        c.append(list);
      }catch(e){c.append(el("p",{className:"stem-muted",text:"Chưa tải được thư viện: "+getErr(e)+". Kiểm tra migration STEM."}));}
    }
    async function portfolio(){
      const c=card("Sản phẩm học tập cá nhân","Lưu bài viết, cảm nhận, dự án hoặc đường dẫn sản phẩm để xem lại và phát triển theo thời gian.");
      if(!teacher)c.innerHTML+=`<label>Tên sản phẩm</label><input id="portTitle" maxlength="160" placeholder="Ví dụ: Đoạn văn cảm nhận bài thơ..."><label>Loại sản phẩm</label><select id="portType"><option value="writing">Bài viết</option><option value="reflection">Nhật kí học tập</option><option value="project">Dự án/sản phẩm STEM</option><option value="link">Đường dẫn sản phẩm</option></select><label>Nội dung / ghi chú</label><textarea id="portContent" rows="5"></textarea><label>Đường dẫn (nếu có)</label><input id="portUrl" type="url" placeholder="https://..."><button type="button" id="savePortfolio">Lưu vào hồ sơ</button><p id="portMsg" class="stem-result"></p>`;
      if(!teacher)c.querySelector("#savePortfolio").addEventListener("click",async()=>{
        const title=c.querySelector("#portTitle").value.trim(),msg=c.querySelector("#portMsg");
        if(!title){say(msg,"Em hãy đặt tên cho sản phẩm.");return;}
        try{const {error}=await supabaseClient.from("learning_portfolio").insert({student_id:user.id,title,item_type:c.querySelector("#portType").value,content:c.querySelector("#portContent").value.trim(),external_url:c.querySelector("#portUrl").value.trim()||null});if(error)throw error;say(msg,"Đã lưu sản phẩm vào hồ sơ học tập.");await loadPortfolio(c);}catch(e){say(msg,"Chưa lưu được: "+getErr(e));}
      });
      await loadPortfolio(c);content.replaceChildren(c);
    }
    async function loadPortfolio(c){
      try{
        c.querySelector(".stem-portfolio-list")?.remove();
        let query=supabaseClient.from("learning_portfolio").select("id,student_id,title,item_type,content,external_url,created_at").order("created_at",{ascending:false});
        if(!teacher)query=query.eq("student_id",user.id);
        const {data,error}=await query;if(error)throw error;
        let studentMap={};
        if(teacher && data?.length){
          const ids=[...new Set(data.map(item=>item.student_id))];
          const {data:students,error:studentError}=await supabaseClient.from("profiles").select("id,full_name,class_name").in("id",ids);
          if(studentError)throw studentError;
          (students||[]).forEach(st=>studentMap[st.id]=(st.full_name||"Học sinh")+" • "+(st.class_name||"Chưa rõ lớp"));
        }
        const list=el("div",{className:"stem-portfolio-list"});
        (data||[]).forEach(item=>{const b=el("div",{className:"stem-item"});b.append(el("strong",{text:item.title}),el("p",{className:"stem-muted",text:(teacher?(studentMap[item.student_id]||"Học sinh"):"Sản phẩm của em")+" • "+item.item_type+" • "+new Date(item.created_at).toLocaleDateString("vi-VN")}));if(item.content)b.append(el("p",{className:"stem-result",text:item.content}));if(item.external_url)b.append(el("a",{href:item.external_url,target:"_blank",rel:"noopener noreferrer",text:"Mở sản phẩm"}));list.append(b);});
        if(!data?.length)list.append(el("p",{className:"stem-muted",text:"Chưa có sản phẩm nào được lưu."}));
        c.append(list);
      }catch(e){c.append(el("p",{className:"stem-muted",text:"Chưa tải được sản phẩm: "+getErr(e)+". Kiểm tra migration STEM."}));}
    }
    await render("assistant");
  }

  window.initStemFeatures = init;
  window.addEventListener("load", async () => {
    try {
      if(typeof supabaseClient==="undefined" || !supabaseClient) return;
      const {data}=await supabaseClient.auth.getUser();
      if(!data?.user)return;
      const {data:profile}=await supabaseClient.from("profiles").select("full_name,role,class_name").eq("id",data.user.id).single();
      if(profile)await init(profile);
    } catch(e) { console.warn("STEM features init:",e); }
  });
})();