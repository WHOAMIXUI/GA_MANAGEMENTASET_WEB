/* Modul Aset: core  (dimuat berurutan setelah file sebelumnya; berbagi scope global dengan modul aset lainnya) */
const LS='assetRegistryV1', $=id=>document.getElementById(id);
const AM=window.AM={assets:[],vendors:[],contacts:[],cf:{t:'all',s:'',q:''},life:{},loans:[],market:[],trades:[],incidents:[],incF:'all',mktTab:'browse',mq:'',vf:{t:'all',q:''},loanTab:'active',f:{q:'',loc:'',st:'',div:'',page:1},size:15,chart:null,built:false};
const DEF_VENDORS=[
 {id:'VND-01',type:'contract',name:'PT Dingin Sejahtera',service:'Perawatan & Servis AC / Chiller',phone:'021-5551234',expiry:'2026-11-15'},
 {id:'VND-02',type:'contract',name:'CV Generator Utama',service:'Maintenance Genset & Listrik',phone:'021-7789012',expiry:'2026-12-30'},
 {id:'VND-03',type:'contract',name:'Solusi IT Mandiri',service:'Support Kasir, Server & Jaringan',phone:'021-8899441',expiry:'2027-01-10'},
 {id:'VND-04',type:'none',name:'Tukang Harian (contoh)',service:'Perbaikan ringan & bongkar pasang',phone:'',expiry:'',note:'Tanpa kontrak, dibayar per pekerjaan.'}];
const ST={Good:['emerald','Baik'],Maintenance:['amber','Maintenance'],Broken:['rose','Rusak'],Disposed:['slate','Dimusnahkan'],Lost:['violet','Hilang']};
const COL=['#f4a23a','#d97d26','#e1b782','#a75d22','#34d399','#60a5fa','#fb7185','#a78bfa'];
const user=()=>getCurrentUser(), isGA=()=>{const u=user();return !!u&&u.role==='General Affair Manager'};
const rp=n=>formatRupiah(n||0), today=()=>{const t=new Date(),p=n=>String(n).padStart(2,'0');return `${t.getFullYear()}-${p(t.getMonth()+1)}-${p(t.getDate())}`};
const mine=()=>{const u=user();if(!u)return[];return(isGA()||(u.branches||[]).includes('ALL'))?AM.assets:AM.assets.filter(a=>(u.branches||[]).includes(a.branch))};
const badge=s=>{const[c,l]=ST[s]||ST.Good;return `<span class="px-2.5 py-1 text-[10px] uppercase font-bold rounded border bg-${c}-500/10 text-${c}-400 border-${c}-500/20">${l}</span>`};
const hist=(a,act)=>a.history.push({t:new Date().toLocaleString('id-ID'),act,by:(user()||{}).name||'System'});
const kpi=(l,v,ic,c='dobah')=>`<div class="glass-panel p-5"><div class="flex justify-between items-start mb-3"><span class="text-[11px] font-extrabold uppercase tracking-wide text-dobah-200/70">${l}</span><div class="w-8 h-8 rounded-lg bg-${c}-400/20 text-${c}-400 flex items-center justify-center border border-${c}-400/30"><i class="fa-solid ${ic}"></i></div></div><span class="font-mono font-black text-2xl text-white">${v}</span></div>`;
const btn=(fn,ic,t,cls='text-dobah-300')=>`<button onclick="${fn}" title="${t}" class="modern-button bg-cocoa-800 hover:bg-cocoa-900 ${cls} text-[11px] px-2.5 py-1.5 border border-white/5 ml-1"><i class="fa-solid ${ic}"></i></button>`;
const th=(...h)=>`<thead><tr class="bg-cocoa-900/90 text-dobah-200 font-mono text-xs uppercase border-b border-white/10">${h.map(x=>`<th class="p-4">${x}</th>`).join('')}</tr></thead>`;
const tbl=(head,rows,empty='Tidak ada data.')=>`<div class="glass-panel overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-left border-collapse">${head}<tbody class="divide-y divide-white/5 text-xs sm:text-sm font-medium text-dobah-100">${rows||`<tr><td colspan="9" class="p-8 text-center text-dobah-200/50 italic">${empty}</td></tr>`}</tbody></table></div></div>`;
const sub=a=>`<br><span class="text-[11px] text-dobah-200/60 font-normal">${a}</span>`;
const days=d=>Math.ceil((new Date(d)-new Date(today()))/864e5);
const q=a=>Math.max(1,parseInt(a.qty)||1),sq=L=>L.reduce((n,a)=>n+q(a),0),tot=a=>(a.price||0)*q(a);
const onLoan=a=>AM.loans.filter(l=>l.assetId===a.id&&!l.returnedAt).reduce((n,l)=>n+l.qty,0),overdue=()=>AM.loans.filter(l=>!l.returnedAt&&l.due&&days(l.due)<0);

/* --- penyimpanan --- */
function migrate(){let ch=false;AM.assets.forEach(a=>{if(a.assigned){const o=a.assigned;AM.loans.push({id:'LN-M'+Date.now().toString(36).toUpperCase()+AM.loans.length,assetId:a.id,qty:1,name:o.name,nik:o.nik||'',dept:o.dept||'',purpose:'',date:today(),due:o.due||'',returnedAt:'',retCond:'',retNote:''});a.assigned=null;ch=true}});return ch}
function load(){try{const d=JSON.parse(localStorage.getItem(LS)||'null');if(d){AM.assets=d.assets||[];AM.vendors=d.vendors||[];AM.contacts=d.contacts||[];AM.life=d.life||{};AM.loans=d.loans||[];AM.market=d.market||[];AM.trades=d.trades||[];AM.incidents=d.incidents||[];migrate()}}catch(e){}if(!AM.vendors.length)AM.vendors=JSON.parse(JSON.stringify(DEF_VENDORS));AM.loaded=true}
let wBusy=false,wDirty=false;
const encU=new TextEncoder();
function cloudWarn(msg){try{Swal.fire({toast:true,position:'top-end',icon:'error',title:'Gagal simpan ke cloud',text:msg,showConfirmButton:false,timer:8000})}catch(e){}}
async function doWrite(){const{setDoc,doc}=window.fbDeps,db=window.db;
 try{const parts=[[]];let sz=0,lim=450000;
  for(const a of AM.assets){const l=encU.encode(JSON.stringify(a)).length+16;if(sz+l>lim&&parts[parts.length-1].length){parts.push([]);sz=0;lim=600000}parts[parts.length-1].push(a);sz+=l}
  const n=parts.length-1,old=AM._rp||0;
  for(let i=1;i<=n;i++)await setDoc(doc(db,'settings','asset_registry_p'+(i+1)),{assets:parts[i],ts:Date.now()});
  for(let i=n+1;i<=old;i++)await setDoc(doc(db,'settings','asset_registry_p'+(i+1)),{assets:[],ts:Date.now()});
  await setDoc(doc(db,'settings','asset_registry'),{vendors:AM.vendors,contacts:AM.contacts,life:AM.life,loans:AM.loans,market:AM.market,trades:AM.trades,incidents:AM.incidents,assets:parts[0],parts:n});
  AM._rp=n;AM.cloudErr='';return true}
 catch(e){AM.cloudErr=String((e&&(e.code||e.message))||e||'tidak diketahui');console.error('Simpan cloud gagal:',e);return false}}
async function cloudWrite(){if(wBusy){wDirty=true;return true}wBusy=true;let ok=true;try{do{wDirty=false;ok=await doWrite()}while(wDirty)}finally{wBusy=false}return ok}
async function save(quiet){try{localStorage.setItem(LS,JSON.stringify({assets:AM.assets,vendors:AM.vendors,contacts:AM.contacts,life:AM.life,loans:AM.loans,market:AM.market,trades:AM.trades,incidents:AM.incidents}))}catch(e){console.warn('localStorage penuh',e)}
 let ok=true;if(window.db){ok=await cloudWrite();if(!ok&&!quiet)cloudWarn('Data baru hanya tersimpan di perangkat ini ('+AM.cloudErr+'). Coba lagi atau hubungi admin.')}
 renderActive();updateNotifications();return ok}
AM.save=save;
let acT=0;
/* Beberapa halaman registry bisa masuk berurutan; digabung jadi satu kali proses + gambar ulang */
function applyCloud(){clearTimeout(acT);acT=setTimeout(applyCloudNow,80)}
function applyCloudNow(){const d=AM._main;if(!d)return;const n=d.parts||0;let as=(d.assets||[]).slice();
 for(let i=2;i<=n+1;i++){if(AM._pd[i]===undefined)return;as=as.concat(AM._pd[i])}
 AM.assets=as;AM.vendors=(d.vendors&&d.vendors.length)?d.vendors:AM.vendors;AM.contacts=Array.isArray(d.contacts)?d.contacts:(AM.contacts||[]);AM.life=d.life||{};AM.loans=d.loans||[];AM.market=d.market||[];AM.trades=d.trades||[];AM.incidents=d.incidents||[];
 const mg=migrate();try{localStorage.setItem(LS,JSON.stringify({assets:AM.assets,vendors:AM.vendors,contacts:AM.contacts,life:AM.life,loans:AM.loans,market:AM.market,trades:AM.trades,incidents:AM.incidents}))}catch(e){}
 renderActive();updateNotifications();if(mg)save()}
function subscribe(){if(AM.sub||!window.db)return;AM.sub=1;AM._pd={};AM._watch={};try{const{doc,onSnapshot}=window.fbDeps,db=window.db;
 onSnapshot(doc(db,'settings','asset_registry'),s=>{if(!s.exists())return;if(s.metadata&&s.metadata.hasPendingWrites)return;const d=s.data();AM._main=d;AM._rp=d.parts||0;
  for(let i=2;i<=AM._rp+1;i++){if(AM._watch[i])continue;AM._watch[i]=1;
   onSnapshot(doc(db,'settings','asset_registry_p'+i),ps=>{if(ps.metadata&&ps.metadata.hasPendingWrites)return;AM._pd[i]=ps.exists()?(ps.data().assets||[]):undefined;applyCloud()})}
  applyCloud()})}catch(e){console.error(e)}}

/* --- sinkron dari permintaan yang selesai --- */
function pendingImport(){const have=new Set(AM.assets.map(a=>String(a.src||'').split('|').slice(0,2).join('|'))),out=[];
 (appState.requests||[]).forEach(r=>(r.items||[]).forEach((it,i)=>{if(it.itemStatus!=='Selesai'&&r.status!=='Diterima')return;const key=`${r.id}|${i}`;if(!have.has(key))out.push({r,it,i,key})}));return out}
function syncReq(){const p=pendingImport();if(!p.length)return Swal.fire({title:'Sudah Sinkron',text:'Semua item permintaan berstatus Selesai sudah terdaftar sebagai aset.',icon:'info',background:'#22120a',color:'#fcf6f0'});
 p.forEach(({r,it,i,key})=>{let id=`AST-${r.id.replace('TKT-','')}-${i+1}`;while(find(id))id+='x';const a={id,name:it.name,category:it.category||'-',branch:r.branch,qty:Math.min(Math.max(parseInt(it.qty)||1,1),100000),date:r.submissionDate||today(),status:'Good',price:Number(it.cost)||0,assigned:null,src:key+'|1',history:[]};
  hist(a,`Terdaftar otomatis dari tiket ${r.id}`);AM.assets.push(a)});
 save();Swal.fire({title:'Berhasil',text:`${p.length} item permintaan didaftarkan sebagai aset. Qty mengikuti jumlah di permintaan.`,icon:'success',background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'})}

/* --- dialog form --- */
async function ask(title,fields,ok='Simpan',x){const inp='w-full px-3 py-2 text-sm rounded-lg bg-[#150a05] border border-white/10 text-white';
 const html=fields.map(f=>`<label class="block text-left text-xs font-bold mb-1 mt-3 text-[#edd5b3]">${f.l}</label>`+(f.opts?`<select id="sw_${f.k}" class="${inp}">${f.opts.map(o=>`<option value="${esc(o[0])}" ${o[0]==f.v?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`:`<input id="sw_${f.k}" type="${f.t||'text'}" value="${esc(f.v==null?'':f.v)}" class="${inp}">`)).join('');
 const r=await Swal.fire({title,html:html+((x&&x.html)||''),didOpen:()=>{if(x&&x.open)x.open()},willClose:()=>{if(x&&x.close)x.close()},showCancelButton:true,confirmButtonText:ok,cancelButtonText:'Batal',background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a',
  preConfirm:()=>{const o={};for(const f of fields){o[f.k]=$('sw_'+f.k).value.trim();if(f.req&&!o[f.k]){Swal.showValidationMessage(f.l+' wajib diisi');return false}}if(x&&x.check){const m=x.check(o);if(m){Swal.showValidationMessage(m);return false}}return o}});
 return r.isConfirmed?r.value:null}
const confirmBox=(t,txt)=>Swal.fire({title:t,text:txt,icon:'warning',showCancelButton:true,confirmButtonText:'Ya, lanjutkan',cancelButtonText:'Batal',background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#e11d48'}).then(r=>r.isConfirmed);
const deny=()=>Swal.fire({title:'Akses Dibatasi',text:'Aksi ini hanya untuk GA Manager.',icon:'warning',background:'#22120a',color:'#fcf6f0'});
const find=id=>AM.assets.find(a=>a.id===id);
const vOpts=()=>AM.vendors.map(v=>[v.id,v.name+(v.type==='none'||(!v.type&&!v.expiry)?' (tanpa kontrak)':'')]);
const opt0=(l,cur)=>{const o=(l||[]).map(x=>[x,x]);if(cur&&!o.some(x=>x[0]===cur))o.unshift([cur,cur]);o.unshift(['','— Belum diisi —']);return o};

/* --- depresiasi garis lurus --- */
function dep(a){const life=Number(AM.life[a.category])||5,yrs=Math.max(0,(Date.now()-new Date(a.date))/31557600000);
 if(dead(a))return{life,annual:0,acc:tot(a),book:0,pct:1};
 const P=tot(a),annual=P/life,acc=Math.min(P,annual*yrs);return{life,annual,acc,book:P-acc,pct:P?acc/P:0}}
