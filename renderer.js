// ============================================================
// UTILS
// ============================================================
const fmt = n => `${parseFloat(n||0).toFixed(2)} ج.م`;
const td = () => new Date().toISOString().split('T')[0];
const tdM = () => new Date().toISOString().slice(0,7);
const dLeft = e => { if(!e) return 9999; return Math.ceil((new Date(e)-new Date())/86400000); };
const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

// ============================================================
// STATE
// ============================================================
let CU = null;
let allMeds = [];
let sCart = [], rCart = [], pCart = [];
let lastSaleId = null, lastRetId = null;
let selCustId = null;
let autoSaveTimer = null;

// ============================================================
// NOTIFY
// ============================================================
let notifT;
function notify(msg, type='success') {
  clearTimeout(notifT);
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.style.background = type==='error'?'#e74c3c':type==='warn'?'#f39c12':'#27ae60';
  el.style.display = 'block';
  notifT = setTimeout(()=>el.style.display='none', 3500);
}

function setSaveStatus(msg) {
  const el = document.getElementById('saveStatus');
  if(el) el.textContent = msg;
}

// ============================================================
// AUTH
// ============================================================
async function doLogin() {
  const u = document.getElementById('lu').value.trim();
  const p = document.getElementById('lp').value;
  const user = await window.api.login({username:u, password:p});
  if (user) {
    CU = user;
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('uname').textContent = CU.name;
    document.getElementById('urole').textContent = CU.role==='admin'?'🔑 مدير النظام':'👨‍💼 موظف مبيعات';
    document.getElementById('dateStr').textContent = new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    document.getElementById('expMon').value = tdM();
    const now = new Date();
    document.getElementById('repF').value = now.toISOString().slice(0,7)+'-01';
    document.getElementById('repT').value = td();
    document.getElementById('exDt').value = td();
    if(CU.role !== 'admin') document.querySelectorAll('.admin-only').forEach(el=>el.style.display='none');
    await loadCats();
    go('dashboard');
    // Auto backup every 10 minutes
    autoSaveTimer = setInterval(()=>doBackup(true), 10*60*1000);
  } else {
    const e = document.getElementById('lerr');
    e.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة ❌';
    e.style.display = 'block';
    setTimeout(()=>e.style.display='none', 3000);
  }
}
document.getElementById('lp').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });

function doLogout() {
  clearInterval(autoSaveTimer);
  CU = null; sCart=[]; rCart=[]; pCart=[];
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('lu').value = '';
  document.getElementById('lp').value = '';
}

// ============================================================
// NAVIGATION
// ============================================================
function go(pg) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+pg)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>{
    if(b.querySelector('span')?.textContent === pgLabel(pg)) b.classList.add('active');
  });
  renderPage(pg);
}
const pgLabel = p => ({dashboard:'الرئيسية',sales:'المبيعات',returns:'المرتجعات',inventory:'المخزن',purchases:'المشتريات',customers:'العملاء',expiry:'الصلاحية',expenses:'المصروفات',reports:'التقارير',orders:'الطلبيات',settings:'الإعدادات'})[p]||'';

async function renderPage(pg) {
  const map = {
    dashboard: renderDash, sales: ()=>renderGrid('s'), returns: ()=>renderGrid('r'),
    inventory: renderInv, purchases: ()=>renderGrid('p'), customers: renderCust,
    expiry: renderExpiry, expenses: renderExp, reports: renderReports,
    orders: renderOrders, settings: renderSettings
  };
  await map[pg]?.();
}

async function loadCats() {
  const cats = await window.api.getCategories();
  ['sCat','invCat'].forEach(id=>{
    const s = document.getElementById(id); if(!s) return;
    const v = s.value;
    s.innerHTML = '<option value="">كل الفئات</option>' + cats.map(c=>`<option>${c}</option>`).join('');
    s.value = v;
  });
  const dl = document.getElementById('catDL');
  if(dl) dl.innerHTML = cats.map(c=>`<option value="${c}">`).join('');
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDash() {
  const d = await window.api.getDashboard();
  const ab = document.getElementById('abadge');
  if(d.alerts>0){ab.textContent=d.alerts;ab.style.display='';}else ab.style.display='none';

  document.getElementById('dashStats').innerHTML = `
    <div class="sc" style="--c:#27ae60"><div class="icon">💰</div><div class="val">${fmt(d.today_sales.total)}</div><div class="lbl">مبيعات اليوم</div><div class="sub">${d.today_sales.count} فاتورة</div></div>
    <div class="sc" style="--c:#2980b9"><div class="icon">📈</div><div class="val">${fmt(d.month_sales.total)}</div><div class="lbl">مبيعات الشهر</div><div class="sub">${d.month_sales.count} فاتورة</div></div>
    <div class="sc" style="--c:#8e44ad"><div class="icon">📦</div><div class="val">${d.total_inv.qty} وحدة</div><div class="lbl">إجمالي المخزون</div><div class="sub">${d.total_inv.count} صنف</div></div>
    <div class="sc" style="--c:#e74c3c;cursor:pointer" onclick="go('expiry')"><div class="icon">⚠️</div><div class="val">${d.alerts}</div><div class="lbl">تنبيهات</div><div class="sub">${d.expired_count} منتهية صلاحية</div></div>`;

  const mx = Math.max(...d.weekly_chart.map(x=>x.total),1);
  document.getElementById('weekChart').innerHTML = d.weekly_chart.map(x=>`
    <div class="br2"><span class="bl">${new Date(x.date).toLocaleDateString('ar-EG',{month:'short',day:'numeric'})}</span>
    <div class="bt"><div class="bf" style="width:${x.total/mx*100}%"></div></div>
    <span class="bv">${fmt(x.total)}</span></div>`).join('');

  const mxR = Math.max(...d.top_meds.map(x=>x.total_rev),1);
  document.getElementById('topMeds').innerHTML = d.top_meds.map((m,i)=>`
    <div style="display:flex;align-items:center;gap:9px;margin-bottom:11px">
      <span style="font-size:17px">${medals[i]||'▪️'}</span>
      <div style="flex:1"><div style="font-size:12px;font-weight:bold;margin-bottom:3px">${m.medicine_name}</div>
      <div class="pb"><div class="pf" style="width:${m.total_rev/mxR*100}%"></div></div></div>
      <div style="font-size:11px;text-align:left"><div style="color:#27ae60;font-weight:bold">${fmt(m.total_rev)}</div><div style="color:#999">${m.total_qty} وحدة</div></div>
    </div>`).join('') || '<div style="color:#aaa;text-align:center;padding:20px">لا توجد بيانات</div>';

  document.getElementById('recentSales').innerHTML = d.recent_sales.map(s=>`
    <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f5f5f5;font-size:12px">
      <span style="color:#0d4f6e;font-weight:bold">${s.invoice_no}</span>
      <span style="color:#666">${s.customer_name||'نقدي'}</span>
      <span style="color:#27ae60;font-weight:bold">${fmt(s.final_total)}</span>
    </div>`).join('') || '<div style="color:#aaa;text-align:center;padding:20px">لا توجد مبيعات</div>';

  let ah = '';
  d.low_stock.forEach(m=>ah+=`<div style="background:#fff3f3;border-radius:7px;padding:8px 12px;margin-bottom:5px;font-size:12px;display:flex;justify-content:space-between"><span>🔴 ${m.name}</span><span style="color:#e74c3c;font-weight:bold">متبقي: ${m.quantity}</span></div>`);
  d.expiry_soon.forEach(m=>ah+=`<div style="background:#fffbf0;border-radius:7px;padding:8px 12px;margin-bottom:5px;font-size:12px;display:flex;justify-content:space-between"><span>🟡 ${m.name}</span><span style="color:#f39c12;font-weight:bold">${m.days_left} يوم</span></div>`);
  document.getElementById('dashAlerts').innerHTML = ah || '<div style="color:#27ae60;text-align:center;padding:20px">✅ لا توجد تنبيهات</div>';
}

// ============================================================
// MED GRID
// ============================================================
async function renderGrid(ctx) {
  const searchId = {s:'sSearch',r:'rSearch',p:'purQ'}[ctx];
  const catId = {s:'sCat'}[ctx];
  const gridId = {s:'sGrid',r:'rGrid',p:'pGrid'}[ctx];
  const cart = ctx==='s'?sCart:ctx==='r'?rCart:pCart;
  const q = document.getElementById(searchId)?.value||'';
  const cat = document.getElementById(catId)?.value||'';
  allMeds = await window.api.getMedicines({q, cat});
  const grid = document.getElementById(gridId); if(!grid) return;
  grid.innerHTML = allMeds.map(m=>{
    const ic = cart.find(i=>i.medicine_id===m.id);
    const cls = m.quantity<=0?'ot':ic?'ic':m.quantity<=m.min_stock?'lw':'';
    return `<div class="mc2 ${cls}" onclick="addCart('${ctx}',${m.id})">
      ${ic?`<span class="cb">x${ic.quantity}</span>`:''}
      <div class="mn">${m.name}</div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span class="mp">${fmt(ctx==='p'?m.cost_price:m.price)}</span>
        <span class="ms" style="color:${m.quantity<=m.min_stock?'#e74c3c':'#999'}">📦${m.quantity}</span>
      </div>
      <div style="font-size:10px;color:#bbb;margin-top:2px">${m.category||''}</div>
    </div>`;
  }).join('');
}

function addCart(ctx, medId) {
  const med = allMeds.find(m=>m.id===medId); if(!med) return;
  let cart = ctx==='s'?sCart:ctx==='r'?rCart:pCart;
  if(ctx==='s' && med.quantity<=0){notify('هذا الصنف نفد من المخزون ❌','error');return;}
  const ex = cart.find(i=>i.medicine_id===medId);
  if(ex){
    if(ctx==='s' && ex.quantity>=med.quantity){notify('لا يوجد مخزون كافٍ ❌','error');return;}
    ex.quantity++; ex.total=ex.quantity*ex.price;
  } else {
    const price = ctx==='p'?med.cost_price:med.price;
    cart.push({medicine_id:med.id,name:med.name,quantity:1,price,cost_price:med.cost_price,total:price,dosage:med.dosage||'',new_expiry:''});
  }
  if(ctx==='s'){sCart=[...cart];renderSCart();}
  else if(ctx==='r'){rCart=[...cart];renderRCart();}
  else{pCart=[...cart];renderPCart();}
  renderGrid(ctx);
}

// ============================================================
// SALES
// ============================================================
function renderSCart() {
  const el = document.getElementById('sCart');
  if(!sCart.length){el.innerHTML='<div style="color:#ccc;text-align:center;padding:25px;font-size:12px">انقر على دواء لإضافته</div>';calcSale();return;}
  el.innerHTML = sCart.map((item,i)=>`
    <div class="ci">
      <div class="nm">${item.name}<br><span style="font-size:10px;color:#aaa">${item.dosage||''}</span></div>
      <input type="number" value="${item.quantity}" min="1" onchange="chgSQty(${i},this.value)"/>
      <span class="pr">${fmt(item.total)}</span>
      <button class="dl" onclick="delSItem(${i})">✕</button>
    </div>`).join('');
  calcSale();
}

function chgSQty(i,v) {
  v=parseInt(v)||1;
  const med=allMeds.find(x=>x.id===sCart[i].medicine_id);
  if(med&&v>med.quantity){notify('الكمية تتجاوز المتاح ❌','error');return;}
  sCart[i].quantity=v; sCart[i].total=v*sCart[i].price; renderSCart();
}
function delSItem(i){sCart.splice(i,1);renderSCart();renderGrid('s');}
function calcSale(){
  const sub=sCart.reduce((a,i)=>a+i.total,0),disc=parseFloat(document.getElementById('sDisc')?.value)||0,fin=Math.max(sub-disc,0);
  document.getElementById('sSub').textContent=fmt(sub);
  document.getElementById('sFin').textContent=fmt(fin);
}

async function saveSale() {
  if(!sCart.length){notify('أضف أصناف للفاتورة ❌','error');return;}
  const disc=parseFloat(document.getElementById('sDisc').value)||0;
  const cust=document.getElementById('sCustName').value.trim()||document.getElementById('sCustSrc').value.trim()||'نقدي';
  const res=await window.api.saveSale({
    items:sCart.map(i=>({medicine_id:i.medicine_id,quantity:i.quantity,price:i.price,dosage:i.dosage})),
    customer_name:cust, discount:disc,
    payment_method:document.getElementById('sPay').value, cashier:CU.username
  });
  if(res.ok){
    lastSaleId=res.id;
    document.getElementById('pLastSale').disabled=false;
    notify(`✅ تم حفظ الفاتورة ${res.invoice_no}`);
    sCart=[];selCustId=null;
    document.getElementById('sCustSrc').value='';
    document.getElementById('sCustName').value='';
    document.getElementById('sDisc').value='0';
    renderSCart();renderGrid('s');renderDash();
  } else notify(res.error||'حدث خطأ','error');
}

async function printLast(type) {
  const id = type==='sale'?lastSaleId:lastRetId; if(!id) return;
  const inv = await window.api.getInvoice(id);
  doPrint(inv);
}

// ============================================================
// RETURNS
// ============================================================
function renderRCart() {
  const el=document.getElementById('rCart');
  if(!rCart.length){el.innerHTML='<div style="color:#ccc;text-align:center;padding:20px;font-size:12px">أضف أصناف</div>';document.getElementById('rTot').textContent=fmt(0);return;}
  el.innerHTML=rCart.map((item,i)=>`
    <div class="ci">
      <div class="nm">${item.name}</div>
      <span style="color:#888">x${item.quantity}</span>
      <span class="pr" style="color:#e74c3c">${fmt(item.total)}</span>
      <button class="dl" onclick="delRItem(${i})">✕</button>
    </div>`).join('');
  document.getElementById('rTot').textContent=fmt(rCart.reduce((a,i)=>a+i.total,0));
}
function delRItem(i){rCart.splice(i,1);renderRCart();renderGrid('r');}

async function saveReturn() {
  if(!rCart.length){notify('أضف أصناف ❌','error');return;}
  const cust=document.getElementById('rCust').value.trim();
  if(!cust){notify('أدخل اسم العميل ❌','error');return;}
  const res=await window.api.saveReturn({
    items:rCart.map(i=>({medicine_id:i.medicine_id,name:i.name,quantity:i.quantity,price:i.price})),
    customer_name:cust, reason:document.getElementById('rReason').value, cashier:CU.username
  });
  if(res.ok){
    lastRetId=res.id;
    notify(`✅ تم تسجيل المرتجع ${res.invoice_no}`);
    const inv=await window.api.getInvoice(res.id); doPrint(inv);
    rCart=[];document.getElementById('rCust').value='';document.getElementById('rReason').value='';
    renderRCart();renderGrid('r');renderDash();
  } else notify(res.error||'حدث خطأ','error');
}

// ============================================================
// PURCHASES
// ============================================================
function renderPCart() {
  const el=document.getElementById('pCart');
  const tot=pCart.reduce((a,i)=>a+i.total,0);
  document.getElementById('pTot').textContent=fmt(tot);
  if(!pCart.length){el.innerHTML='<div style="color:#ccc;text-align:center;padding:20px;font-size:12px">أضف أصناف</div>';return;}
  el.innerHTML=pCart.map((item,i)=>`
    <div style="margin-bottom:8px;padding:8px;background:white;border-radius:6px;border:1px solid #e8f4f8">
      <div style="font-size:11px;font-weight:bold;color:#0d4f6e;margin-bottom:5px">${item.name}</div>
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
        <span style="font-size:11px">كمية:</span>
        <input type="number" value="${item.quantity}" min="1" style="width:44px;padding:3px;border:1px solid #ddd;border-radius:4px;font-size:11px;text-align:center" onchange="chgPQty(${i},this.value)"/>
        <span style="font-size:11px">سعر:</span>
        <input type="number" value="${item.cost_price}" min="0" step="0.01" style="width:60px;padding:3px;border:1px solid #ddd;border-radius:4px;font-size:11px;text-align:center" onchange="chgPPr(${i},this.value)"/>
        <span style="font-size:11px">صلاحية:</span>
        <input type="date" value="${item.new_expiry}" style="width:115px;padding:3px;border:1px solid #ddd;border-radius:4px;font-size:10px" onchange="chgPExp(${i},this.value)"/>
        <span style="color:#27ae60;font-size:11px;font-weight:bold;margin-right:auto">${fmt(item.total)}</span>
        <button onclick="delPItem(${i})" style="background:#fee;border:none;color:#e74c3c;cursor:pointer;border-radius:4px;padding:2px 6px;font-size:11px">✕</button>
      </div>
    </div>`).join('');
}
function chgPQty(i,v){pCart[i].quantity=parseInt(v)||1;pCart[i].total=pCart[i].quantity*pCart[i].cost_price;renderPCart();}
function chgPPr(i,v){pCart[i].cost_price=parseFloat(v)||0;pCart[i].price=pCart[i].cost_price;pCart[i].total=pCart[i].quantity*pCart[i].cost_price;renderPCart();}
function chgPExp(i,v){pCart[i].new_expiry=v;}
function delPItem(i){pCart.splice(i,1);renderPCart();renderGrid('p');}
function togglePurForm(){const w=document.getElementById('purFormWrap');w.style.display=w.style.display==='none'?'block':'none';if(w.style.display==='block')renderGrid('p');}

async function savePurchase() {
  if(!pCart.length){notify('أضف أصناف ❌','error');return;}
  const sup=document.getElementById('purSup').value.trim();
  if(!sup){notify('أدخل اسم المورد ❌','error');return;}
  const res=await window.api.savePurchase({
    supplier:sup, receiver:document.getElementById('purRec').value, notes:document.getElementById('purNote').value,
    items:pCart.map(i=>({medicine_id:i.medicine_id,name:i.name,quantity:i.quantity,cost_price:i.cost_price,new_expiry:i.new_expiry})),
    cashier:CU.username
  });
  if(res.ok){
    notify(`✅ تم تسجيل المشتريات ${res.invoice_no}`);
    const inv=await window.api.getInvoice(res.id); doPrint(inv);
    pCart=[];document.getElementById('purSup').value='';document.getElementById('purRec').value='';document.getElementById('purNote').value='';
    renderPCart();renderGrid('p');renderDash();
    document.getElementById('purFormWrap').style.display='none';
  } else notify(res.error||'حدث خطأ','error');
}

// ============================================================
// INVOICE LIST
// ============================================================
async function toggleList(type) {
  const key = type.charAt(0).toUpperCase()+type.slice(1);
  const el = document.getElementById('list'+key); if(!el) return;
  if(el.style.display!=='none'){el.style.display='none';return;}
  const invs=await window.api.getInvoices({type});
  const lbl={sale:'مبيعات',return:'مرتجعات',purchase:'مشتريات'}[type];
  const clr={sale:'#0d4f6e',return:'#e74c3c',purchase:'#8e44ad'}[type];
  el.innerHTML=`<div class="card">
    <h4 style="color:${clr};margin-bottom:13px">📋 سجل ${lbl} (${invs.length})</h4>
    <div class="tw"><table>
    <thead><tr><th style="background:${clr}">رقم</th><th style="background:${clr}">${type==='purchase'?'المورد':'العميل'}</th><th style="background:${clr}">التاريخ</th><th style="background:${clr}">الإجمالي</th><th style="background:${clr}">الخصم</th><th style="background:${clr}">الصافي</th><th style="background:${clr}">طباعة</th></tr></thead>
    <tbody>${invs.map((s,i)=>`<tr style="background:${i%2===0?'white':'#f9fbfc'}">
      <td style="font-weight:bold;color:${clr};padding:8px 12px">${s.invoice_no}</td>
      <td style="padding:8px 12px">${s.customer_name||s.supplier||'-'}</td>
      <td style="padding:8px 12px">${s.date}</td>
      <td style="padding:8px 12px">${fmt(s.subtotal)}</td>
      <td style="padding:8px 12px;color:#e74c3c">${s.discount>0?fmt(s.discount):'-'}</td>
      <td style="padding:8px 12px;font-weight:bold;color:#27ae60">${fmt(s.final_total)}</td>
      <td style="padding:8px 12px"><button class="btn sm bp" onclick="printById(${s.id})">🖨️</button></td>
    </tr>`).join('')}</tbody></table></div></div>`;
  el.style.display='block';
}

async function printById(id){const inv=await window.api.getInvoice(id);doPrint(inv);}

// ============================================================
// INVENTORY
// ============================================================
async function renderInv() {
  const q=document.getElementById('invQ')?.value||'';
  const cat=document.getElementById('invCat')?.value||'';
  const st=document.getElementById('invSt')?.value||'';
  let meds=await window.api.getMedicines({q,cat});
  if(st==='low') meds=meds.filter(m=>m.quantity>0&&m.quantity<=m.min_stock);
  else if(st==='out') meds=meds.filter(m=>m.quantity<=0);
  else if(st==='exp') meds=meds.filter(m=>m.days_left>0&&m.days_left<=60);
  const isAdmin=CU?.role==='admin';
  document.getElementById('invBody').innerHTML=meds.map((m,i)=>{
    const dl=m.days_left; const ex=dl<=0;
    const[st2,bc]=m.quantity<=0?['نفد','bgr']:ex?['منتهي','br']:m.quantity<=m.min_stock?['منخفض','br']:dl<=30?['ينتهي قريباً','by']:['جيد','bg'];
    return `<tr>
      <td>${i+1}</td>
      <td><b>${m.name}</b><br><span style="font-size:10px;color:#aaa">${m.barcode||''}</span></td>
      <td>${m.category||'-'}</td>
      <td style="font-weight:bold;font-size:15px;color:${m.quantity<=m.min_stock?'#e74c3c':'#333'}">${m.quantity}</td>
      <td style="color:#27ae60;font-weight:bold">${fmt(m.price)}</td>
      <td style="color:#888">${fmt(m.cost_price)}</td>
      <td>${m.min_stock}</td>
      <td style="color:${dl<=60?'#e74c3c':'#333'};font-size:12px">${m.expiry_date||'-'}</td>
      <td style="font-size:12px;color:${dl<=0?'#95a5a6':dl<=30?'#e74c3c':'#f39c12'}">${dl<=0?'منتهي':dl>=9999?'-':dl+' يوم'}</td>
      <td><span class="badge ${bc}">${st2}</span></td>
      ${isAdmin?`<td><div style="display:flex;gap:4px"><button class="btn sm bp" onclick="editMed(${m.id})">✏️</button><button class="btn sm bd" onclick="delMed(${m.id})">🗑️</button></div></td>`:'<td></td>'}
    </tr>`;
  }).join('')||'<tr><td colspan="11" style="text-align:center;padding:25px;color:#aaa">لا توجد نتائج</td></tr>';
}

function openMedModal(data=null){
  document.getElementById('medModT').textContent=data?'تعديل صنف':'إضافة صنف جديد';
  const f={mId:'',mName:'',mSci:'',mCat:'',mUnit:'علبة',mQty:0,mMin:5,mPr:0,mCo:0,mExp:'',mBar:'',mMfr:'',mLoc:'',mDos:'',mNot:''};
  if(data) Object.assign(f,{mId:data.id,mName:data.name,mSci:data.scientific_name||'',mCat:data.category||'',mUnit:data.unit||'علبة',mQty:data.quantity,mMin:data.min_stock,mPr:data.price,mCo:data.cost_price,mExp:data.expiry_date||'',mBar:data.barcode||'',mMfr:data.manufacturer||'',mLoc:data.location||'',mDos:data.dosage||'',mNot:data.notes||''});
  for(const[k,v] of Object.entries(f)) if(document.getElementById(k)) document.getElementById(k).value=v;
  document.getElementById('medMod').classList.add('open');
}
async function editMed(id){const m=await window.api.getMedicine(id);openMedModal(m);}
async function delMed(id){
  if(!confirm('حذف هذا الصنف؟'))return;
  const res=await window.api.deleteMedicine(id);
  if(res.ok){notify('✅ تم الحذف');renderInv();loadCats();}
}
async function saveMed(){
  const name=document.getElementById('mName').value; if(!name){notify('أدخل اسم الدواء ❌','error');return;}
  const id=parseInt(document.getElementById('mId').value)||0;
  const body={name,scientific_name:document.getElementById('mSci').value,category:document.getElementById('mCat').value,unit:document.getElementById('mUnit').value,quantity:document.getElementById('mQty').value,min_stock:document.getElementById('mMin').value,price:document.getElementById('mPr').value,cost_price:document.getElementById('mCo').value,expiry_date:document.getElementById('mExp').value,barcode:document.getElementById('mBar').value,manufacturer:document.getElementById('mMfr').value,location:document.getElementById('mLoc').value,dosage:document.getElementById('mDos').value,notes:document.getElementById('mNot').value};
  const res=id?await window.api.updateMedicine({...body,id}):await window.api.addMedicine(body);
  if(res.ok){notify(id?'✅ تم التعديل':'✅ تم الإضافة');closeMod('medMod');renderInv();loadCats();}
  else notify(res.error||'حدث خطأ','error');
}

// ============================================================
// CUSTOMERS
// ============================================================
async function renderCust(){
  const q=document.getElementById('custQ')?.value||'';
  const custs=await window.api.getCustomers(q);
  document.getElementById('custBody').innerHTML=custs.map((c,i)=>`<tr>
    <td>${i+1}</td><td><b>${c.name}</b></td><td>${c.phone||'-'}</td><td>${c.address||'-'}</td>
    <td style="color:${c.balance>0?'#e74c3c':'#27ae60'};font-weight:bold">${fmt(c.balance)}</td>
    <td style="font-size:12px;color:#888">${c.notes||'-'}</td>
    <td><div style="display:flex;gap:4px">
      <button class="btn sm bp" onclick="viewCustHist(${c.id})">📋</button>
      <button class="btn sm" style="background:#e8f4f8;color:#0d4f6e" onclick="editCust(${c.id},'${c.name}','${c.phone||''}','${c.address||''}','${c.notes||''}')">✏️</button>
    </div></td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;padding:20px;color:#aaa">لا يوجد عملاء</td></tr>';
}

function openCustModal(){document.getElementById('cId').value='';document.getElementById('cName').value='';document.getElementById('cPh').value='';document.getElementById('cAddr').value='';document.getElementById('cNote').value='';document.getElementById('custModT').textContent='إضافة عميل';document.getElementById('custMod').classList.add('open');}
function editCust(id,name,ph,addr,notes){document.getElementById('cId').value=id;document.getElementById('cName').value=name;document.getElementById('cPh').value=ph;document.getElementById('cAddr').value=addr;document.getElementById('cNote').value=notes;document.getElementById('custModT').textContent='تعديل بيانات العميل';document.getElementById('custMod').classList.add('open');}

async function saveCust(){
  const name=document.getElementById('cName').value; if(!name){notify('أدخل الاسم ❌','error');return;}
  const id=parseInt(document.getElementById('cId').value)||0;
  const d={name,phone:document.getElementById('cPh').value,address:document.getElementById('cAddr').value,notes:document.getElementById('cNote').value};
  const res=id?await window.api.updateCustomer({...d,id}):await window.api.addCustomer(d);
  if(res.ok){notify('✅ تم الحفظ');closeMod('custMod');renderCust();}
}

async function viewCustHist(id){
  const data=await window.api.getCustomerHistory(id);
  const c=data.customer; const invs=data.invoices;
  const spent=invs.filter(s=>s.type==='sale').reduce((a,s)=>a+s.final_total,0);
  document.getElementById('custHistT').textContent=`سجل العميل: ${c.name}`;
  document.getElementById('custHistC').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:15px">
      <div class="sc" style="--c:#27ae60;padding:12px"><div class="val" style="font-size:16px">${fmt(spent)}</div><div class="lbl" style="font-size:12px">إجمالي المشتريات</div></div>
      <div class="sc" style="--c:#2980b9;padding:12px"><div class="val" style="font-size:16px">${invs.length}</div><div class="lbl" style="font-size:12px">عدد الفواتير</div></div>
      <div class="sc" style="--c:${c.balance>0?'#e74c3c':'#27ae60'};padding:12px"><div class="val" style="font-size:16px">${fmt(c.balance)}</div><div class="lbl" style="font-size:12px">الرصيد</div></div>
    </div>
    <p style="font-size:13px;color:#666;margin-bottom:12px">📞 ${c.phone||'-'} | 📍 ${c.address||'-'}</p>
    <div class="tw"><table><thead><tr><th>رقم</th><th>التاريخ</th><th>النوع</th><th>الصافي</th><th>طباعة</th></tr></thead>
    <tbody>${invs.map((s,i)=>`<tr style="background:${i%2===0?'white':'#f9fbfc'}">
      <td style="font-weight:bold;color:#0d4f6e">${s.invoice_no}</td><td>${s.date}</td>
      <td><span class="badge ${s.type==='sale'?'bg':'br'}">${s.type==='sale'?'مبيعات':'مرتجع'}</span></td>
      <td style="font-weight:bold">${fmt(s.final_total)}</td>
      <td><button class="btn sm bp" onclick="printById(${s.id})">🖨️</button></td>
    </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:#aaa;padding:15px">لا توجد فواتير</td></tr>'}</tbody></table></div>`;
  document.getElementById('custHistMod').classList.add('open');
}

async function suggestCust(){
  const q=document.getElementById('sCustSrc').value.trim(); const el=document.getElementById('sCustDrop');
  if(!q){el.innerHTML='';return;}
  const custs=await window.api.getCustomers(q);
  if(!custs.length){el.innerHTML='';return;}
  el.innerHTML=`<div style="position:absolute;background:white;border:2px solid #e0e8f0;border-radius:7px;z-index:100;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
    ${custs.slice(0,5).map(c=>`<div onclick="selCust(${c.id},'${c.name}')" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f5f5f5" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background=''">
    <b>${c.name}</b> <span style="color:#888;font-size:11px">${c.phone||''}</span></div>`).join('')}</div>`;
}
function selCust(id,name){selCustId=id;document.getElementById('sCustSrc').value=name;document.getElementById('sCustDrop').innerHTML='';}

// ============================================================
// EXPIRY
// ============================================================
async function renderExpiry(){
  const meds=await window.api.getMedicines({});
  const expired=meds.filter(m=>m.days_left<=0);
  const crit=meds.filter(m=>m.days_left>0&&m.days_left<=30);
  const warn=meds.filter(m=>m.days_left>30&&m.days_left<=60);
  const low=meds.filter(m=>m.quantity>0&&m.quantity<=m.min_stock);
  const out=meds.filter(m=>m.quantity<=0);
  document.getElementById('expStats').innerHTML=`
    <div class="sc" style="--c:#7f1d1d"><div class="icon">💀</div><div class="val">${expired.length}</div><div class="lbl">منتهية الصلاحية</div></div>
    <div class="sc" style="--c:#e74c3c"><div class="icon">🚨</div><div class="val">${crit.length}</div><div class="lbl">خلال 30 يوم</div></div>
    <div class="sc" style="--c:#f39c12"><div class="icon">⚠️</div><div class="val">${warn.length}</div><div class="lbl">خلال 60 يوم</div></div>
    <div class="sc" style="--c:#3498db"><div class="icon">📉</div><div class="val">${low.length}</div><div class="lbl">رصيد منخفض</div></div>
    <div class="sc" style="--c:#95a5a6"><div class="icon">❌</div><div class="val">${out.length}</div><div class="lbl">نفد المخزون</div></div>`;
  const mkT=(list,title,clr,bg)=>{
    if(!list.length)return'';
    return `<div class="card" style="margin-bottom:14px;overflow:hidden">
      <div style="background:${bg};padding:12px 18px;border-bottom:3px solid ${clr};margin:-18px -18px 14px"><h4 style="color:${clr};margin:0">${title} <span style="background:${clr};color:white;border-radius:10px;padding:1px 8px;font-size:12px">${list.length}</span></h4></div>
      <div class="tw"><table><thead><tr><th>الدواء</th><th>الفئة</th><th>الكمية</th><th>تاريخ الصلاحية</th><th>المتبقي</th></tr></thead>
      <tbody>${list.map(m=>`<tr><td><b>${m.name}</b></td><td>${m.category||'-'}</td><td style="font-weight:bold;color:${m.quantity<=m.min_stock?'#e74c3c':'#333'}">${m.quantity}</td><td>${m.expiry_date||'-'}</td><td style="font-weight:bold;color:${clr}">${m.days_left<=0?'منتهي':m.days_left+' يوم'}</td></tr>`).join('')}</tbody></table></div></div>`;
  };
  document.getElementById('expSecs').innerHTML=
    mkT(expired,'💀 منتهية الصلاحية','#7f1d1d','#f5f5f5')+
    mkT(crit,'🚨 تنتهي خلال 30 يوم','#e74c3c','#fff5f5')+
    mkT(warn,'⚠️ تنتهي خلال 60 يوم','#f39c12','#fffbf0')+
    mkT(low,'📉 رصيد منخفض','#3498db','#f0f8ff')+
    mkT(out,'❌ نفد المخزون','#95a5a6','#f5f5f5')||
    '<div class="card" style="text-align:center;padding:40px;color:#27ae60;font-size:16px">✅ لا توجد تنبيهات</div>';
}

// ============================================================
// EXPENSES
// ============================================================
async function renderExp(){
  const mon=document.getElementById('expMon')?.value||tdM();
  const data=await window.api.getExpenses(mon);
  document.getElementById('expTot').textContent=fmt(data.total);
  const maxC=Math.max(...data.by_category.map(x=>x.total),1);
  document.getElementById('expCats').innerHTML=data.by_category.map(c=>`
    <div class="br2" style="margin-bottom:9px">
      <span style="width:80px;font-size:12px;color:#555">${c.category}</span>
      <div class="bt"><div class="bf" style="width:${c.total/maxC*100}%;background:linear-gradient(90deg,#e74c3c,#f39c12)"></div></div>
      <span style="width:85px;text-align:left;font-size:12px;font-weight:bold;color:#e74c3c">${fmt(c.total)}</span>
    </div>`).join('')||'<div style="color:#aaa;text-align:center;padding:20px">لا توجد مصروفات</div>';
  const isAdmin=CU?.role==='admin';
  document.getElementById('expBody').innerHTML=data.expenses.map((e,i)=>`<tr style="background:${i%2===0?'white':'#f9fbfc'}">
    <td>${e.category}</td><td>${e.description}</td>
    <td style="color:#e74c3c;font-weight:bold">${fmt(e.amount)}</td>
    <td>${e.date}</td>
    ${isAdmin?`<td><button class="btn sm bd" onclick="delExp(${e.id})">🗑️</button></td>`:'<td></td>'}
  </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:20px;color:#aaa">لا توجد مصروفات</td></tr>';
}
function openExpModal(){document.getElementById('exDt').value=td();document.getElementById('exAmt').value='';document.getElementById('exDesc').value='';document.getElementById('exNote').value='';document.getElementById('expMod').classList.add('open');}
async function saveExp(){
  const desc=document.getElementById('exDesc').value,amt=document.getElementById('exAmt').value;
  if(!desc||!amt){notify('أكمل البيانات ❌','error');return;}
  const res=await window.api.addExpense({category:document.getElementById('exCat').value,description:desc,amount:amt,date:document.getElementById('exDt').value,notes:document.getElementById('exNote').value,created_by:CU.username});
  if(res.ok){notify('✅ تم الحفظ');closeMod('expMod');renderExp();}
}
async function delExp(id){if(!confirm('حذف؟'))return;const res=await window.api.deleteExpense(id);if(res.ok){notify('✅ تم الحذف');renderExp();}}

// ============================================================
// REPORTS
// ============================================================
async function renderReports(){
  const f=document.getElementById('repF')?.value||'',t2=document.getElementById('repT')?.value||'';
  const d=await window.api.getReport({from:f,to:t2});
  document.getElementById('repStats').innerHTML=`
    <div class="sc" style="--c:#27ae60"><div class="icon">💰</div><div class="val">${fmt(d.summary.revenue)}</div><div class="lbl">إجمالي المبيعات</div><div class="sub">${d.summary.sale_count} فاتورة</div></div>
    <div class="sc" style="--c:#e74c3c"><div class="icon">↩️</div><div class="val">${fmt(d.summary.returns)}</div><div class="lbl">إجمالي المرتجعات</div></div>
    <div class="sc" style="--c:#2980b9"><div class="icon">📈</div><div class="val">${fmt(d.net_revenue)}</div><div class="lbl">صافي الإيرادات</div></div>
    <div class="sc" style="--c:${d.profit>=0?'#27ae60':'#e74c3c'}"><div class="icon">${d.profit>=0?'💹':'📉'}</div><div class="val">${fmt(d.profit)}</div><div class="lbl">الربح الصافي</div></div>`;
  const mxR=Math.max(...d.top_meds.map(x=>x.total_rev),1);
  document.getElementById('repTop').innerHTML=d.top_meds.map((m,i)=>`
    <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px">
      <span style="font-size:16px">${medals[i]}</span>
      <div style="flex:1"><div style="font-size:12px;font-weight:bold;margin-bottom:3px">${m.medicine_name}</div>
      <div class="pb"><div class="pf" style="width:${m.total_rev/mxR*100}%"></div></div></div>
      <div style="font-size:11px;text-align:left"><div style="color:#27ae60;font-weight:bold">${fmt(m.total_rev)}</div><div style="color:#999">${m.total_qty} وحدة</div></div>
    </div>`).join('')||'<div style="color:#aaa;text-align:center;padding:20px">لا توجد بيانات</div>';
  const mxD=Math.max(...d.daily.map(x=>x.total),1);
  document.getElementById('repChart').innerHTML=d.daily.slice(-14).map(x=>`
    <div class="br2"><span class="bl">${new Date(x.date).toLocaleDateString('ar-EG',{month:'short',day:'numeric'})}</span>
    <div class="bt"><div class="bf" style="width:${x.total/mxD*100}%"></div></div>
    <span class="bv">${fmt(x.total)}</span></div>`).join('')||'<div style="color:#aaa;text-align:center;padding:20px">لا توجد بيانات</div>';
  const sl=await window.api.getInvoices({type:'sale',from:f,to:t2});
  const rt=await window.api.getInvoices({type:'return',from:f,to:t2});
  const all=[...sl,...rt].sort((a,b)=>b.id-a.id);
  document.getElementById('repInvs').innerHTML=all.map((s,i)=>`<tr style="background:${i%2===0?'white':'#f9fbfc'}">
    <td style="font-weight:bold;color:${s.type==='return'?'#e74c3c':'#0d4f6e'}">${s.invoice_no}</td>
    <td>${s.date}</td><td>${s.customer_name||'-'}</td>
    <td><span class="badge ${s.type==='return'?'br':'bg'}">${s.type==='return'?'مرتجع':'مبيعات'}</span></td>
    <td style="font-weight:bold">${fmt(s.final_total)}</td>
    <td><button class="btn sm bp" onclick="printById(${s.id})">🖨️</button></td>
  </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;padding:20px;color:#aaa">لا توجد فواتير</td></tr>';
}

async function exportData(){const res=await window.api.exportData();if(res.ok)notify(`✅ تم التصدير`);}

// ============================================================
// ORDERS
// ============================================================
async function renderOrders(){
  const sug=await window.api.getOrders();
  document.getElementById('ordBody').innerHTML=sug.map((m,i)=>{
    const[p,bc]=m.quantity<=0?['عاجل','br']:m.quantity<=m.min_stock?['عالية','by']:['متوسطة','bb'];
    return `<tr><td>${i+1}</td><td><b>${m.name}</b></td><td>${m.category||'-'}</td>
      <td style="font-weight:bold;font-size:15px;color:${m.quantity<=m.min_stock?'#e74c3c':'#333'}">${m.quantity}</td>
      <td>${m.min_stock}</td><td style="color:#27ae60">${m.monthly_sold} وحدة</td>
      <td style="font-weight:bold;color:#0d4f6e;font-size:15px">${m.suggested} وحدة</td>
      <td style="color:#8e44ad">${fmt(m.estimated_cost)}</td>
      <td><span class="badge ${bc}">${p}</span></td></tr>`;
  }).join('')||'<tr><td colspan="9" style="text-align:center;padding:25px;color:#27ae60;font-size:15px">✅ المخزون بمستويات ممتازة</td></tr>';
}

async function printOrders(){
  const sug=await window.api.getOrders();
  const sets=await window.api.getSettings();
  const w=window.open('','_blank','width=600,height=700');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>طلبية</title>
  <style>body{font-family:Arial;padding:25px;font-size:13px}h2,h3{color:#0d4f6e;text-align:center}table{width:100%;border-collapse:collapse}th{background:#0d4f6e;color:white;padding:8px;text-align:right}td{padding:7px;border-bottom:1px solid #eee}</style></head>
  <body><h2>🫁 ${sets.pharmacy_name||'صيدلية الجهاز التنفسي'}</h2><h3>قائمة الطلبيات المقترحة</h3>
  <p style="text-align:center">التاريخ: ${new Date().toLocaleDateString('ar-EG')} | أصناف: ${sug.length} | تكلفة مقدرة: ${fmt(sug.reduce((a,m)=>a+m.estimated_cost,0))}</p>
  <table><tr><th>#</th><th>الدواء</th><th>الكمية الحالية</th><th>الكمية المقترحة</th><th>التكلفة</th><th>الأولوية</th></tr>
  ${sug.map((m,i)=>{const p=m.quantity<=0?'عاجل':m.quantity<=m.min_stock?'عالية':'متوسطة';return`<tr><td>${i+1}</td><td>${m.name}</td><td style="${m.quantity<=0?'color:#e74c3c;font-weight:bold':''}">${m.quantity}</td><td><b>${m.suggested}</b></td><td>${fmt(m.estimated_cost)}</td><td>${p}</td></tr>`;}).join('')}
  <tr style="background:#f0f8ff;font-weight:bold"><td colspan="4">الإجمالي التقديري</td><td colspan="2">${fmt(sug.reduce((a,m)=>a+m.estimated_cost,0))}</td></tr></table>
  <script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}

// ============================================================
// SETTINGS
// ============================================================
async function renderSettings(){
  const s=await window.api.getSettings();
  document.getElementById('stName').value=s.pharmacy_name||'';
  document.getElementById('stAddr').value=s.pharmacy_address||'';
  document.getElementById('stPh').value=s.pharmacy_phone||'';
  document.getElementById('stPh2').value=s.pharmacy_phone2||'';
  document.getElementById('stExpD').value=s.expiry_warning_days||60;
  await renderUsers();
  await loadBackupList();
}

async function saveSettings(){
  const res=await window.api.saveSettings({pharmacy_name:document.getElementById('stName').value,pharmacy_address:document.getElementById('stAddr').value,pharmacy_phone:document.getElementById('stPh').value,pharmacy_phone2:document.getElementById('stPh2').value,expiry_warning_days:document.getElementById('stExpD').value});
  if(res.ok) notify('✅ تم حفظ الإعدادات');
}

async function renderUsers(){
  const users=await window.api.getUsers();
  document.getElementById('usrBody').innerHTML=users.map(u=>`<tr>
    <td><b>${u.name}</b></td><td style="direction:ltr;text-align:right">${u.username}</td>
    <td><span class="badge ${u.role==='admin'?'bb':'bg'}">${u.role==='admin'?'مدير':'موظف'}</span></td>
    <td><button class="btn sm" style="background:#e8f4f8;color:#0d4f6e" onclick="editUser(${u.id},'${u.name}','${u.role}')">✏️</button></td>
  </tr>`).join('');
}

function openUserModal(){document.getElementById('uId').value='';document.getElementById('uNm').value='';document.getElementById('uUn').value='';document.getElementById('uPw').value='';document.getElementById('uRl').value='sales';document.getElementById('usrModT').textContent='إضافة مستخدم';document.getElementById('uUn').disabled=false;document.getElementById('usrMod').classList.add('open');}
function editUser(id,name,role){document.getElementById('uId').value=id;document.getElementById('uNm').value=name;document.getElementById('uRl').value=role;document.getElementById('uPw').value='';document.getElementById('usrModT').textContent='تعديل مستخدم';document.getElementById('uUn').disabled=true;document.getElementById('usrMod').classList.add('open');}

async function saveUser(){
  const id=parseInt(document.getElementById('uId').value)||0;
  const d={name:document.getElementById('uNm').value,username:document.getElementById('uUn').value,password:document.getElementById('uPw').value,role:document.getElementById('uRl').value};
  if(!d.name){notify('أدخل الاسم ❌','error');return;}
  const res=id?await window.api.updateUser({...d,id}):await window.api.addUser(d);
  if(res.ok){notify('✅ تم الحفظ');closeMod('usrMod');renderUsers();}
  else notify(res.error||'حدث خطأ','error');
}

function stab(id,btn){['tGen','tUsr','tBak'].forEach(t=>document.getElementById(t).style.display='none');document.querySelectorAll('.tbb').forEach(b=>b.classList.remove('active'));document.getElementById(id).style.display='block';btn.classList.add('active');}

// BACKUP
async function doBackup(silent=false){
  const res=await window.api.backup();
  if(res.ok){
    const t=new Date().toLocaleTimeString('ar-EG');
    setSaveStatus(`✅ محفوظ ${t}`);
    if(!silent) notify(`✅ تم الحفظ: ${res.file}`);
    await loadBackupList();
  }
}

async function loadBackupList(){
  const el=document.getElementById('backupList'); if(!el) return;
  const files=await window.api.getBackups();
  el.innerHTML=files.slice(0,10).map(f=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f8fafc;border-radius:7px;margin-bottom:6px;font-size:12px">
      <span>💾 ${f}</span>
    </div>`).join('')||'<div style="color:#aaa;font-size:12px">لا توجد نسخ احتياطية</div>';
}

async function openBackupFolder(){await window.api.openBackupFolder();}

// ============================================================
// PRINT
// ============================================================
async function doPrint(inv){
  const sets=await window.api.getSettings();
  const typeMap={sale:'فاتورة مبيعات',return:'فاتورة مرتجع',purchase:'فاتورة مشتريات'};
  const w=window.open('','_blank','width=450,height=680');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>${typeMap[inv.type]||'فاتورة'}</title>
  <style>body{font-family:Arial,sans-serif;padding:22px;font-size:13px;color:#111;max-width:400px;margin:0 auto}
  .logo{text-align:center;margin-bottom:14px}.logo h2{color:#0d4f6e;margin:8px 0 3px;font-size:17px}.logo p{color:#555;font-size:11px;margin:2px}
  hr{border:none;border-top:2px dashed #0d4f6e;margin:9px 0}
  .row{display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px}
  table{width:100%;border-collapse:collapse;margin:9px 0;font-size:12px}
  th{background:#0d4f6e;color:white;padding:6px 8px;text-align:right}td{padding:5px 8px;border-bottom:1px solid #eee}
  .dos{font-size:10px;color:#888;font-style:italic}
  .tbox{background:#f0f8ff;border:2px solid #0d4f6e;border-radius:6px;padding:10px;margin-top:9px}
  .tr{display:flex;justify-content:space-between;margin:3px 0;font-size:12px}
  .big{font-size:15px;font-weight:bold;color:#0d4f6e}
  .foot{text-align:center;margin-top:18px;color:#555;font-size:11px;border-top:1px dashed #ccc;padding-top:9px}
  @media print{body{padding:10px}}</style></head><body>
  <div class="logo">
    <svg width="55" height="55" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" rx="16" fill="#0d4f6e"/><path d="M40 12C40 12 22 22 22 38C22 50 30 58 40 60C50 58 58 50 58 38C58 22 40 12 40 12Z" fill="#1a8fa8" opacity="0.6"/><rect x="30" y="36" width="20" height="8" fill="white"/><rect x="36" y="30" width="8" height="20" fill="white"/></svg>
    <h2>${sets.pharmacy_name||'صيدلية الجهاز التنفسي'}</h2>
    <p>${sets.pharmacy_address||'كوبري القبة - القاهرة'}</p>
    ${sets.pharmacy_phone?`<p>📞 ${sets.pharmacy_phone}</p>`:''}
  </div>
  <hr/>
  <div class="row"><span><b>${typeMap[inv.type]||'فاتورة'}</b></span><span><b>${inv.invoice_no}</b></span></div>
  <div class="row"><span>التاريخ:</span><span>${inv.date}</span></div>
  ${inv.customer_name?`<div class="row"><span>${inv.type==='purchase'?'المورد:':'العميل:'}</span><span><b>${inv.customer_name}</b></span></div>`:''}
  ${inv.supplier?`<div class="row"><span>المورد:</span><span><b>${inv.supplier}</b></span></div>`:''}
  <div class="row"><span>طريقة الدفع:</span><span>${inv.payment_method||'نقدي'}</span></div>
  <hr/>
  <table><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
  ${(inv.items||[]).map(i=>`<tr><td>${i.medicine_name}${i.dosage_instructions?`<br><span class="dos">${i.dosage_instructions}</span>`:''}</td><td>${i.quantity}</td><td>${fmt(i.unit_price||i.cost_price)}</td><td>${fmt(i.total)}</td></tr>`).join('')}
  </table>
  <div class="tbox">
    <div class="tr"><span>الإجمالي:</span><span>${fmt(inv.subtotal)}</span></div>
    ${inv.discount>0?`<div class="tr"><span>الخصم:</span><span style="color:#e74c3c">- ${fmt(inv.discount)}</span></div>`:''}
    <div class="tr big"><span>الصافي:</span><span>${fmt(inv.final_total)}</span></div>
  </div>
  ${inv.notes?`<p style="font-size:11px;color:#888;margin-top:8px">ملاحظة: ${inv.notes}</p>`:''}
  <div class="foot">شكراً لتعاملكم معنا 💚<br/>${sets.pharmacy_name||''}<br/>${sets.pharmacy_address||''}</div>
  <script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}

// ============================================================
// MODALS
// ============================================================
function closeMod(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.ov').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');}));
