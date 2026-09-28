/* SHUDDHO MEDNUTRI — UPLOAD-ONLY APP */
const state = {
  db: window.SHUDDHO_MEDNUTRI_DB || {},
  searchIndex: [],
  mode: localStorage.getItem("smn_mode") || "public",
  myMedicines: JSON.parse(localStorage.getItem("smn_meds") || "[]"),
  compare: []
};

const $ = (s,ctx=document)=>ctx.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const norm = s => String(s||"").toLowerCase().normalize("NFKC").replace(/\s+/g," ").trim();

function createSearchIndex(){
  const out=[];
  const add=(type,id,title,subtitle,aliases=[],raw={})=>out.push({
    type,id,title,subtitle,raw,
    hay:norm([title,subtitle,...aliases].join(" "))
  });
  (state.db.drugs||[]).forEach(x=>add("drug",x.id,x.generic_name,x.name_bn,[...(x.aliases||[]),...(x.drug_class||[])],x));
  (state.db.brands||[]).forEach(x=>add("brand",x.id,x.brand_name,`${x.strength||""} ${x.dosage_form||""}`,[...(x.aliases||[])],x));
  (state.db.supplements||[]).forEach(x=>add("supplement",x.id,x.product_name,x.brand,[...(x.category||[]),...(x.formulation_tags||[])],x));
  (state.db.herbal||[]).forEach(x=>add("herbal",x.id,x.name_en,x.name_bn,[x.scientific_name,...(x.aliases||[])],x));
  (state.db.ayurveda||[]).forEach(x=>add("ayurveda",x.id,x.name_en,x.name_bn,[],x));
  (state.db.homeopathy||[]).forEach(x=>add("homeopathy",x.id,x.name_en,x.name_bn,[],x));
  return out;
}
function suggestions(q){
  q=norm(q); if(!q)return[];
  return state.searchIndex.map(x=>{
    let score=0;
    if(norm(x.title)===q)score=120;
    else if(norm(x.title).startsWith(q))score=100;
    else if(x.hay.startsWith(q))score=90;
    else if(x.hay.includes(` ${q}`))score=80;
    else if(x.hay.includes(q))score=60;
    return {...x,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title))
    .slice(0,state.db.settings?.search_suggestion_limit||12);
}
function iconFor(type){
  return ({drug:"💊",brand:"🏷️",supplement:"🧴",herbal:"🌿",ayurveda:"🪷",homeopathy:"⚪"}[type]||"🔎");
}
function renderApp(){
  const s=state.db.settings;
  $("#app").innerHTML=`
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">SHUDDHO <span>MEDNUTRI</span></div>
      <nav class="nav">
        <button data-go="home">Home</button><button data-go="drugs">Medicines</button>
        <button data-go="supplements">Supplements</button><button data-go="interactions">Interactions</button>
        <button data-go="timing">Timing</button><button data-go="sideeffects">Nutrition Support</button>
      </nav>
      <button id="modeBtn" class="ghost">${state.mode==="public"?"Public":"Professional"} Mode</button>
    </header>

    <section class="hero" id="home">
      <canvas class="hero-canvas" id="heroCanvas"></canvas>
      <div class="hero-content">
        <span class="badge">Bangladesh-first Health Intelligence</span>
        <h1>Shuddho <span>MedNutri</span></h1>
        <p>${esc(state.db.homepage.hero.subtitle)}</p>
        <div class="search-wrap">
          <input id="globalSearch" class="search" autocomplete="off" placeholder="একটি অক্ষর লিখুন — medicine, supplement, nutrient, interaction...">
          <div id="suggestions" class="suggestions" hidden></div>
        </div>
        <div class="meta">${(state.db.homepage.trending_queries||[]).map(x=>`<button class="chip" data-query="${esc(x)}">${esc(x)}</button>`).join("")}</div>
      </div>
    </section>

    <section class="section" id="quick">
      <div class="section-head"><div><h2>Quick Tools</h2><p>Search → Check → Plan → Review</p></div></div>
      <div class="grid four">
        ${toolCard("⚡","Interaction Checker","Drug–Drug, Food–Drug, Drug–Nutrient, Supplement interactions","interactions")}
        ${toolCard("🕒","Medicine Timing Planner","Before/after food, empty stomach, mineral spacing","timing")}
        ${toolCard("🧾","My Medicine List","Save medicines and review flags","mylist")}
        ${toolCard("🥗","Side-effect Nutrition Support","Constipation, nausea, diarrhea, appetite loss, dry mouth","sideeffects")}
      </div>
    </section>

    ${featuredHTML()}
    ${familyHTML()}
    ${interactionHTML()}
    ${timingHTML()}
    ${sideEffectHTML()}
    ${myListHTML()}

    <div class="footer">
      <p>${esc(s.disclaimer_bn)}</p>
      <p>Data model is modular. Clinical/product claims should be verified from authoritative sources before production publication.</p>
    </div>
  </div>
  <div class="bottom-nav">
    <button data-go="home"><b>⌂</b>Home</button><button data-focus-search><b>⌕</b>Search</button>
    <button data-go="interactions"><b>⚡</b>Check</button><button data-go="mylist"><b>🧾</b>My List</button>
  </div>`;
  bindUI();
}
function toolCard(icon,title,desc,target){
  return `<article class="card"><div class="icon">${icon}</div><h3>${title}</h3><p>${desc}</p><div class="actions"><button class="primary" data-go="${target}">Open</button></div></article>`;
}
function featuredHTML(){
  const now=new Date().toISOString().slice(0,10);
  const list=(state.db.featured||[]).filter(x=>x.active&&(!x.start_date||x.start_date<=now)&&(!x.end_date||x.end_date>=now))
    .sort((a,b)=>(b.priority||0)-(a.priority||0)).slice(0,state.db.homepage.featured_limit||6);
  if(!list.length)return"";
  return `<section class="section"><div class="section-head"><div><h2>Bangladesh Formulation Focus</h2><p>Formulation characteristics; not automatic endorsement.</p></div></div>
  <div class="grid">${list.map(f=>{
    const item=findEntity(f.entity_type,f.entity_id);
    return `<article class="card"><span class="badge ${f.sponsored?"warn":""}">${esc(f.label)}</span><h3>${esc(item?.product_name||item?.generic_name||item?.name_en||f.entity_id)}</h3>
    <p>${esc(f.disclosure||"")}</p><button class="primary" data-open-type="${f.entity_type}" data-open-id="${f.entity_id}">${esc(f.cta_text||"View")}</button></article>`;
  }).join("")}</div></section>`;
}
function familyHTML(){
  const counts={
    modern_medicine:(state.db.drugs||[]).length,supplement:(state.db.supplements||[]).length,
    herbal:(state.db.herbal||[]).length,ayurveda:(state.db.ayurveda||[]).length,homeopathy:(state.db.homeopathy||[]).length
  };
  return `<section class="section" id="drugs"><div class="section-head"><div><h2>Database Families</h2><p>একই search engine, আলাদা evidence layer</p></div></div>
  <div class="grid">${(state.db.categories||[]).map(c=>`<article class="card"><div class="icon">${c.icon}</div><h3>${esc(c.name_bn)}</h3><p>${esc(c.name_en)} • ${counts[c.id]||0} seeded records</p><button class="primary" data-family="${c.id}">Browse</button></article>`).join("")}</div></section>`;
}
function interactionHTML(){
  return `<section class="section" id="interactions"><div class="section-head"><div><h2>Interaction Checker</h2><p>একাধিক medicine/supplement বেছে review করুন</p></div></div>
  <div class="panel cols">
    <div>
      <label>Item 1</label><select id="intA">${entityOptions()}</select>
      <br><br><label>Item 2</label><select id="intB">${entityOptions()}</select>
      <div class="actions"><button class="primary" id="checkInteraction">Analyze</button></div>
    </div>
    <div id="interactionResult" class="list"><div class="row"><div><b>Result</b><small>দুটি item নির্বাচন করুন।</small></div></div></div>
  </div></section>`;
}
function entityOptions(){
  const rows=[...state.searchIndex.filter(x=>["drug","supplement"].includes(x.type))];
  return `<option value="">Select</option>`+rows.map(x=>`<option value="${x.id}">${esc(x.title)} (${x.type})</option>`).join("");
}
function timingHTML(){
  return `<section class="section" id="timing"><div class="section-head"><div><h2>Medicine Timing Planner</h2><p>Database-driven timing rules</p></div></div>
  <div class="panel"><select id="timingSelect">${(state.db.drugs||[]).map(d=>`<option value="${d.id}">${esc(d.generic_name)}</option>`).join("")}</select>
  <div class="actions"><button class="primary" id="showTiming">Show Timing</button></div><div id="timingResult" class="list" style="margin-top:12px"></div></div></section>`;
}
function sideEffectHTML(){
  return `<section class="section" id="sideeffects"><div class="section-head"><div><h2>Side-effect → Nutrition Support</h2><p>Supportive nutrition cues with cautions/red flags</p></div></div>
  <div class="grid">${(state.db.sideEffects||[]).map(x=>`<article class="card"><div class="icon">🥗</div><h3>${esc(x.name_bn)}</h3><p>${esc(x.symptom)}</p><button class="primary" data-side="${x.id}">View support</button></article>`).join("")}</div></section>`;
}
function myListHTML(){
  return `<section class="section" id="mylist"><div class="section-head"><div><h2>My Medicine List</h2><p>Saved locally in this browser</p></div></div><div id="myListPanel" class="panel">${renderMyList()}</div></section>`;
}
function renderMyList(){
  if(!state.myMedicines.length)return `<p style="color:var(--muted)">কোনো medicine যোগ করা হয়নি। Medicine detail থেকে Add to My List দিন।</p>`;
  return `<div class="list">${state.myMedicines.map(id=>{
    const d=(state.db.drugs||[]).find(x=>x.id===id);
    return `<div class="row"><div><b>${esc(d?.generic_name||id)}</b><small>${esc(d?.name_bn||"")}</small></div><button class="ghost" data-remove-med="${id}">Remove</button></div>`;
  }).join("")}</div><div class="actions"><button class="primary" id="reviewMyList">Polypharmacy Review</button></div><div id="polyResult"></div>`;
}
function bindUI(){
  $("#modeBtn").onclick=()=>{state.mode=state.mode==="public"?"professional":"public";localStorage.setItem("smn_mode",state.mode);renderApp();initThree();};
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>$("#"+b.dataset.go)?.scrollIntoView({behavior:"smooth"}));
  document.querySelectorAll("[data-focus-search]").forEach(b=>b.onclick=()=>{$("#globalSearch").focus();$("#home").scrollIntoView({behavior:"smooth"});});
  document.querySelectorAll("[data-query]").forEach(b=>b.onclick=()=>{$("#globalSearch").value=b.dataset.query;showSuggestions(b.dataset.query);});
  $("#globalSearch").addEventListener("input",e=>showSuggestions(e.target.value));
  $("#globalSearch").addEventListener("keydown",e=>{if(e.key==="Escape")$("#suggestions").hidden=true;});
  document.addEventListener("click",globalClick,{once:false});
  $("#checkInteraction").onclick=checkInteraction;
  $("#showTiming").onclick=showTiming;
  bindDynamicButtons();
}
let globalBound=false;
function globalClick(e){
  const t=e.target.closest("[data-open-type],[data-suggest-id]");
  if(t){
    const type=t.dataset.openType||t.dataset.suggestType;
    const id=t.dataset.openId||t.dataset.suggestId;
    openEntity(type,id);
  }
  const fam=e.target.closest("[data-family]"); if(fam)browseFamily(fam.dataset.family);
  const side=e.target.closest("[data-side]"); if(side)openSide(side.dataset.side);
  const rm=e.target.closest("[data-remove-med]"); if(rm){state.myMedicines=state.myMedicines.filter(x=>x!==rm.dataset.removeMed);saveMeds();$("#myListPanel").innerHTML=renderMyList();bindDynamicButtons();}
}
function bindDynamicButtons(){
  $("#reviewMyList")?.addEventListener("click",reviewMyList);
}
function showSuggestions(q){
  const box=$("#suggestions"), list=suggestions(q);
  if(!q||!list.length){box.hidden=true;box.innerHTML="";return}
  box.hidden=false;box.innerHTML=list.map(x=>`<div class="suggestion" data-suggest-type="${x.type}" data-suggest-id="${x.id}">
  <span class="icon" style="font-size:22px">${iconFor(x.type)}</span><div><b>${esc(x.title)}</b><small>${esc(x.subtitle||"")}</small></div><span class="type">${esc(x.type)}</span></div>`).join("");
}
function findEntity(type,id){
  const key={drug:"drugs",brand:"brands",supplement:"supplements",herbal:"herbal",ayurveda:"ayurveda",homeopathy:"homeopathy"}[type]||type;
  return (state.db[key]||[]).find(x=>x.id===id);
}
function openEntity(type,id){
  $("#suggestions").hidden=true;
  const x=findEntity(type,id); if(!x)return;
  const title=x.generic_name||x.product_name||x.brand_name||x.name_en||id;
  const sub=x.name_bn||x.brand||x.strength||x.scientific_name||"";
  const publicHtml=entityPublicHTML(type,x);
  const proHtml=entityProfessionalHTML(type,x);
  document.body.insertAdjacentHTML("beforeend",`<div class="modal" id="entityModal"><div class="modal-card">
    <div class="modal-head"><div><span class="badge">${esc(type)}</span><h2>${esc(title)}</h2><p style="color:var(--muted)">${esc(sub)}</p></div><button class="close" onclick="document.getElementById('entityModal').remove()">×</button></div>
    <div>${state.mode==="professional"?proHtml:publicHtml}</div>
  </div></div>`);
  $("#entityModal").addEventListener("click",e=>{if(e.target.id==="entityModal")e.currentTarget.remove()});
  $("#addMedBtn")?.addEventListener("click",()=>{if(!state.myMedicines.includes(id))state.myMedicines.push(id);saveMeds();$("#addMedBtn").textContent="Saved ✓";});
}
function entityPublicHTML(type,x){
  if(type==="drug"){
    return `<div class="kpis"><div class="kpi"><span>Class</span>${esc((x.drug_class||[]).join(", "))}</div><div class="kpi"><span>Common use</span>${esc((x.common_uses||[]).join(", "))}</div><div class="kpi"><span>Food timing</span>${esc(x.food_instruction||"—")}</div><div class="kpi"><span>Monitoring</span>${esc((x.monitoring||[]).join(", "))}</div></div>
    <h3>Common side effects</h3><p>${esc((x.common_side_effects||[]).join(", ")||"No summary entered.")}</p>
    <div class="actions"><button class="primary" id="addMedBtn">＋ Add to My Medicine List</button></div>`;
  }
  if(type==="supplement"){
    return `<h3>Ingredients</h3><div class="list">${(x.ingredients||[]).map(i=>`<div class="row"><div><b>${esc(i.ingredient)}</b><small>${esc(i.declared_amount)} ${esc(i.elemental_amount)}</small></div></div>`).join("")}</div>
    <h3>Formulation tags</h3><div class="meta">${(x.formulation_tags||[]).map(t=>`<span class="badge">${esc(t)}</span>`).join("")}</div>`;
  }
  return `<p>${esc(x.evidence_based_use_summary||x.clinical_evidence_summary||x.clinical_effectiveness_note||"Directory record")}</p>`;
}
function entityProfessionalHTML(type,x){
  return `<pre style="white-space:pre-wrap;color:#cfe2f1;background:#06101d;padding:16px;border-radius:14px;border:1px solid var(--border)">${esc(JSON.stringify(x,null,2))}</pre>`;
}
function browseFamily(id){
  const map={modern_medicine:["drug",state.db.drugs],supplement:["supplement",state.db.supplements],herbal:["herbal",state.db.herbal],ayurveda:["ayurveda",state.db.ayurveda],homeopathy:["homeopathy",state.db.homeopathy]};
  const [type,arr]=map[id]||[null,[]];
  document.body.insertAdjacentHTML("beforeend",`<div class="modal" id="familyModal"><div class="modal-card"><div class="modal-head"><h2>${esc(id)}</h2><button class="close" onclick="document.getElementById('familyModal').remove()">×</button></div>
  <div class="list">${arr.map(x=>`<div class="row"><div><b>${esc(x.generic_name||x.product_name||x.name_en)}</b><small>${esc(x.name_bn||x.brand||x.scientific_name||"")}</small></div><button class="ghost" data-open-type="${type}" data-open-id="${x.id}">Open</button></div>`).join("")}</div></div></div>`);
}
function checkInteraction(){
  const a=$("#intA").value,b=$("#intB").value,res=$("#interactionResult");
  if(!a||!b){res.innerHTML=`<div class="row"><small>দুটি item নির্বাচন করুন।</small></div>`;return}
  const found=(state.db.interactions||[]).filter(i=>{
    const ids=[i.subject_a?.id,i.subject_b?.id];
    return ids.includes(a)&&ids.includes(b);
  });
  if(!found.length){
    res.innerHTML=`<div class="row"><div><b>No direct match in current database</b><small>এর অর্থ interaction নেই—এমন নয়। Database coverage সীমিত হতে পারে।</small></div></div>`;return;
  }
  res.innerHTML=found.map(i=>`<div class="row"><div><span class="badge warn">${esc(i.severity)}</span><b>${esc(i.public_message)}</b><small>${esc(i.mechanism_short||"")}</small></div></div>`).join("");
}
function showTiming(){
  const id=$("#timingSelect").value;
  const r=(state.db.timingRules||[]).find(x=>x.entity_id===id);
  $("#timingResult").innerHTML=r?`<div class="row"><div><b>${esc(r.instruction_bn)}</b><small>${(r.spacing_rules||[]).map(s=>`${esc(s.with)}: ${s.minutes} min`).join(" • ")}</small></div></div>`:`<div class="row"><small>Timing rule not entered yet.</small></div>`;
}
function openSide(id){
  const x=(state.db.sideEffects||[]).find(s=>s.id===id); if(!x)return;
  document.body.insertAdjacentHTML("beforeend",`<div class="modal" id="sideModal"><div class="modal-card"><div class="modal-head"><h2>${esc(x.name_bn)}</h2><button class="close" onclick="document.getElementById('sideModal').remove()">×</button></div>
  <h3>Nutrition support</h3><div class="list">${x.support.map(s=>`<div class="row"><div>✓ ${esc(s)}</div></div>`).join("")}</div>
  <h3>Cautions</h3><div class="meta">${x.cautions.map(s=>`<span class="badge warn">${esc(s)}</span>`).join("")||"—"}</div>
  <h3>Red flags</h3><div class="meta">${x.red_flags.map(s=>`<span class="badge red">${esc(s)}</span>`).join("")||"—"}</div></div></div>`);
}
function saveMeds(){localStorage.setItem("smn_meds",JSON.stringify(state.myMedicines));}
function reviewMyList(){
  const ids=state.myMedicines; const flags=[];
  (state.db.interactions||[]).forEach(i=>{
    const a=i.subject_a?.id,b=i.subject_b?.id;
    if(ids.includes(a)&&ids.includes(b))flags.push(i.public_message);
  });
  const mon=(state.db.monitoring||[]).filter(m=>ids.includes(m.entity_id)).flatMap(m=>m.items||[]);
  $("#polyResult").innerHTML=`<div class="cols" style="margin-top:14px"><div><h3>Interaction flags</h3>${flags.length?flags.map(f=>`<div class="row">${esc(f)}</div>`).join(""):`<div class="row">No direct match in current dataset.</div>`}</div><div><h3>Monitoring</h3>${[...new Set(mon)].map(m=>`<div class="row">${esc(m)}</div>`).join("")||`<div class="row">No monitoring data entered.</div>`}</div></div>`;
}
function initThree(){
  const canvas=$("#heroCanvas"); if(!canvas||!window.THREE)return;
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(60,canvas.clientWidth/Math.max(canvas.clientHeight,1),.1,100);
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  const geo=new THREE.IcosahedronGeometry(.12,1); const mat=new THREE.MeshBasicMaterial({color:0x32e0c4});
  const group=new THREE.Group(); scene.add(group);
  for(let i=0;i<60;i++){const m=new THREE.Mesh(geo,mat.clone()); m.material.color.setHSL(.45+Math.random()*.25,.75,.62); m.position.set((Math.random()-.5)*6,(Math.random()-.5)*4,(Math.random()-.5)*3); group.add(m)}
  camera.position.z=5;
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight||360;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  resize(); addEventListener("resize",resize);
  let t=0; (function loop(){t+=.004;group.rotation.y=t;group.rotation.x=Math.sin(t*.7)*.18;renderer.render(scene,camera);requestAnimationFrame(loop)})();
}
state.searchIndex=createSearchIndex();
renderApp();
initThree();
