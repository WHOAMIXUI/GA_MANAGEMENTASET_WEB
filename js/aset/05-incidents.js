/* Modul Aset: incidents  (dimuat berurutan setelah file sebelumnya; berbagi scope global dengan modul aset lainnya) */
/* --- klasifikasi aset rusak / hilang --- */
const dead=a=>a.status==='Disposed'||a.status==='Lost';
const KIND={dmg_emp:['amber','Rusak — kelalaian karyawan'],dmg_use:['orange','Rusak — pemakaian wajar'],lost:['violet','Hilang'],mtc:['sky','Maintenance']};
const KEFF={dmg_emp:'Broken',dmg_use:'Broken',lost:'Lost',mtc:'Maintenance'}; // dampak tiap klasifikasi ke status aset
/* klasifikasi tambahan buatan GA (disimpan di appState.incidentKinds = [{id,label,effect:'Broken'|'Lost'}]) */
function syncKinds(){Object.keys(KIND).forEach(k=>{if(k.startsWith('ik_')){delete KIND[k];delete KEFF[k]}});
 (appState.incidentKinds||[]).forEach(x=>{if(!x||!x.id)return;KIND[x.id]=[x.effect==='Lost'?'violet':'rose',x.label];KEFF[x.id]=x.effect==='Lost'?'Lost':'Broken'})}
const isHid=k=>(appState.hiddenKinds||[]).includes(k);window.syncKinds=syncKinds;syncKinds();
const kbadge=k=>{const[c,l]=KIND[k]||['slate',k];return `<span class="px-2.5 py-1 text-[10px] uppercase font-bold rounded border bg-${c}-500/10 text-${c}-400 border-${c}-500/20">${l}</span>`};
AM.report=async function(pre){syncKinds();const E=mine().filter(a=>!dead(a)&&freeQty(a)>=1);
 if(!E.length)return Swal.fire({title:'Tidak ada aset yang bisa dilaporkan',text:'Semua unit sedang dipinjam / dijual atau sudah dihapuskan.',icon:'info',...WN});
 const r=await ask('Lapor Rusak / Hilang',[
  {k:'a',l:'Aset',v:pre,opts:E.map(a=>[a.id,`${a.name} — ${a.branch||'-'} (${freeQty(a)} unit tersedia)`])},
  {k:'kind',l:'Klasifikasi',opts:[...Object.keys(KIND).filter(k=>!isHid(k)).map(k=>[k,KIND[k][1]]),...(isGA()?[['__new','➕ Tambah klasifikasi baru…']]:[])]},
  {k:'qty',l:'Jumlah unit',t:'number',v:1},
  {k:'who',l:'Karyawan terkait / penanggung jawab'},
  {k:'date',l:'Tanggal kejadian',t:'date',v:today()},
  ...(isGA()?[{k:'comp',l:'Ganti rugi dibebankan ke karyawan (Rp, opsional)',t:'number',v:0}]:[]),
  {k:'note',l:'Kronologi / catatan'}],'Simpan Laporan',{
  open:()=>{const s=$('sw_kind'),box=$('swNewKind');if(s&&box)s.onchange=()=>{box.style.display=s.value==='__new'?'block':'none';if(s.value==='__new')setTimeout(()=>$('swNkName').focus(),0)}},
  html:'<div id="swNewKind" style="display:none" class="text-left mt-3 p-3 rounded-lg border border-white/10 bg-[#150a05]"><label class="block text-xs font-bold mb-1 text-[#edd5b3]">Nama klasifikasi baru</label><input id="swNkName" type="text" maxlength="40" placeholder="mis. Rusak — bencana / force majeure" class="w-full px-3 py-2 text-sm rounded-lg bg-[#22120a] border border-white/10 text-white"><label class="block text-xs font-bold mb-1 mt-3 text-[#edd5b3]">Dampak ke status aset</label><select id="swNkEff" class="w-full px-3 py-2 text-sm rounded-lg bg-[#22120a] border border-white/10 text-white"><option value="Broken">Rusak (status aset menjadi Rusak)</option><option value="Lost">Hilang (status aset menjadi Hilang)</option></select></div>'
   +'<p class="text-left text-[11px] mt-3" style="color:#e1b782">Contoh: piring 16 unit → laporkan 6 unit “Rusak”, lalu laporkan lagi 7 unit “Hilang”. Sisa 3 unit tetap Baik. Pilih “Maintenance” bila aset hanya perlu servis/perawatan (bukan rusak atau hilang): status berubah ke Maintenance, tanpa nilai kerugian.</p>',
  check:o=>{if(o.kind==='__new'){const nm=($('swNkName').value||'').trim().replace(/\s+/g,' ');if(!nm)return 'Nama klasifikasi baru wajib diisi';if(Object.values(KIND).some(v=>v[1].toLowerCase()===nm.toLowerCase()))return 'Klasifikasi dengan nama itu sudah ada';o._nk={id:'ik_'+Date.now().toString(36),label:nm,effect:$('swNkEff').value==='Lost'?'Lost':'Broken'}}
   const ek=o._nk?o._nk.effect:KEFF[o.kind];
   const a=find(o.a);if(!a)return 'Aset tidak ditemukan';const n=parseInt(o.qty),mx=freeQty(a);
   if(!(n>=1&&n<=mx))return `Jumlah harus antara 1 dan ${mx}`;
   if(o.kind==='mtc'&&a.status==='Maintenance')return 'Aset ini sudah berstatus Maintenance';
   if(ek==='Broken'&&a.status==='Broken')return 'Aset ini sudah berstatus Rusak';
   if(o.kind==='dmg_emp'&&!o.who)return 'Nama karyawan wajib diisi untuk kerusakan karena kelalaian';
   if(o.comp!==undefined&&o.comp!==''&&!(Number(o.comp)>=0))return 'Nominal ganti rugi tidak valid';
   if(o.kind==='mtc'&&Number(o.comp)>0)return 'Ganti rugi tidak berlaku untuk Maintenance (aset tidak rusak/hilang)';return ''}});
 if(!r){syncKinds();return}
 if(r._nk){(appState.incidentKinds=appState.incidentKinds||[]).push(r._nk);r.kind=r._nk.id;syncKinds();try{await saveMasterSettings()}catch(e){console.error(e)}}
 const a=find(r.a),n=parseInt(r.qty),k=r.kind,st=KEFF[k]==='Lost'?'Lost':KEFF[k]==='Maintenance'?'Maintenance':'Broken',lab=KIND[k][1],who=r.who?' · '+r.who:'';
 let tgt;const mtcInfo=x=>{if(k==='mtc'){x.mtcDate=r.date||today();x.mtcNote=(r.who?r.who+' — ':'')+(r.note||'')}};
 if(n===q(a)){a.status=st;tgt=a;mtcInfo(a);hist(a,`${lab}: ${n} unit${who}. ${r.note||''}`)}
 else{let id,x=2;do{id=`${a.id}-R${x++}`}while(find(id));
  tgt={...a,id,qty:n,status:st,assigned:null,history:[],mtcDate:'',mtcNote:'',vendorId:'',mtcCost:0};a.qty=q(a)-n;
  mtcInfo(tgt);hist(a,`${n} unit dipisah (${lab}${who}) menjadi ${id}`);hist(tgt,`Dari ${a.id}: ${lab}, ${n} unit${who}. ${r.note||''}`);AM.assets.push(tgt)}
 if(k!=='mtc')AM.incidents.push({id:'INC-'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,4).toUpperCase(),assetId:a.id,newAssetId:tgt.id,name:a.name,category:a.category,branch:a.branch,division:a.division||'',qty:n,kind:k,who:r.who,date:r.date||today(),note:r.note,unit:a.price||0,loss:k==='mtc'?0:(a.price||0)*n,comp:k==='mtc'?0:(Number(r.comp)||0),by:(user()||{}).name||'-',ts:Date.now(),found:''});
 await save();
 if(k==='mtc'){switchTab('amtc');return Swal.fire({title:'Masuk ke menu Maintenance',text:`${n} unit “${a.name}” berstatus Maintenance. Jadwalkan vendor/servisnya dari menu ini.`,icon:'success',...WN})}
 Swal.fire({title:'Laporan tersimpan',text:`${n} unit “${a.name}” dicatat: ${lab}. Sisa unit Baik di baris asal: ${q(a)===n&&tgt===a?0:q(a)}.`,icon:'success',...WN})};
function incView(){syncKinds();const all=canAll(),mb=myBranches(),f=AM.incF||'all',ga=isGA();
 const L=AM.incidents.filter(i=>i.kind!=='mtc'&&(all||mb.includes(i.branch))).sort((a,b)=>(b.ts||0)-(a.ts||0)),V=L.filter(i=>f==='all'||i.kind===f),
  sq2=k=>L.filter(i=>i.kind===k).reduce((n,i)=>n+i.qty,0),loss=L.reduce((n,i)=>n+(i.loss||0),0),comp=L.reduce((n,i)=>n+(i.comp||0),0);
 const tabs=[['all','Semua ('+L.length+')'],...Object.keys(KIND).filter(k=>k!=='mtc'&&(!isHid(k)||AM.incidents.some(i=>i.kind===k))).map(k=>[k,KIND[k][1]+' ('+L.filter(i=>i.kind===k).length+')'])].map(([k,l])=>`<button onclick="AM.incTab('${k}')" class="modern-button text-xs font-bold px-4 py-2 border ${f===k?'bg-dobah-400 text-cocoa-950 border-dobah-400':'bg-cocoa-800 text-dobah-200 border-white/10'}">${l}</button>`).join('');
 const rows=V.map(i=>`<tr class="hover:bg-white/[0.02]"><td class="p-4 whitespace-nowrap">${esc(i.date)}${sub(esc(i.id))}</td><td class="p-4 font-bold text-white">${esc(i.name)}${sub(esc(i.branch)||'-')}</td><td class="p-4">${kbadge(i.kind)}${i.found?sub('<span class="text-emerald-400">Ditemukan '+esc(i.found)+'</span>'):''}</td><td class="p-4 font-mono font-bold text-white text-base">${i.qty}</td><td class="p-4">${esc(i.who)||'<span class="text-dobah-200/40">—</span>'}</td>${ga?`<td class="p-4 font-mono">${rp(i.loss)}${i.comp?sub('Ganti rugi '+rp(i.comp)):''}</td>`:''}<td class="p-4 text-xs">${esc(i.note)||'—'}${sub('Pelapor: '+esc(i.by))}</td><td class="p-4">${ga?btn(`AM.incDel('${i.id}')`,'fa-trash','Hapus catatan (aset tidak berubah)','text-rose-400'):''}</td></tr>`).join('');
 $('view-ainc').innerHTML=`<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">${kpi('Rusak (karyawan)',sq2('dmg_emp')+' unit','fa-user-xmark','amber')}${kpi('Rusak (wajar)',sq2('dmg_use')+' unit','fa-wrench','rose')}${kpi('Hilang',sq2('lost')+' unit','fa-magnifying-glass','violet')}${ga?kpi('Total Kerugian',rp(loss),'fa-money-bill-trend-up','rose')+kpi('Ganti Rugi Dibebankan',rp(comp),'fa-hand-holding-dollar','emerald'):''}</div>
 <div class="flex flex-wrap justify-between items-center gap-3"><div class="flex gap-2 flex-wrap">${tabs}</div><div class="flex gap-2">${ga?'<button onclick="AM.kinds()" class="modern-button bg-cocoa-800 text-dobah-200 border border-white/10 text-xs font-bold px-4 py-2"><i class="fa-solid fa-tags mr-1"></i>Kelola Klasifikasi</button>':''}<button onclick="AM.report()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-4 py-2"><i class="fa-solid fa-flag mr-1"></i>Lapor Rusak / Hilang</button></div></div>`
 +tbl(th('Tanggal','Aset','Klasifikasi','Qty','Karyawan Terkait',...(ga?['Nilai Kerugian']:[]),'Catatan','Aksi'),rows,'Belum ada laporan aset rusak atau hilang.')}
/* kelola klasifikasi: tambah / ubah nama / hapus / pulihkan.
   Hapus klasifikasi bawaan atau yang sudah dipakai laporan = disembunyikan dari pilihan (laporan lama tetap menampilkan namanya, bisa dipulihkan).
   Klasifikasi buatan GA yang belum pernah dipakai dihapus permanen. */
AM.kinds=async function(){if(!isGA())return deny();syncKinds();
 const used=id=>AM.incidents.some(i=>i.kind===id),custom=id=>(appState.incidentKinds||[]).some(x=>x.id===id),ids=Object.keys(KIND);
 const rows=ids.map(id=>{const h=isHid(id),bi=!custom(id);return `<div class="flex items-center justify-between gap-2 p-2 rounded-lg border border-white/10 bg-[#150a05] text-xs ${h?'opacity-60':''}"><span class="text-left"><b>${esc(KIND[id][1])}</b><br><span class="opacity-60">${bi?'Bawaan':'Tambahan'}${used(id)?' · dipakai laporan':''}${h?' · dihapus dari pilihan':''}</span></span><span class="flex gap-1">${h?`<button type="button" data-k="res" data-id="${id}" class="px-2 py-1 rounded border border-emerald-500/30 text-emerald-400">Pulihkan</button>`:`${bi?'':`<button type="button" data-k="ren" data-id="${id}" class="px-2 py-1 rounded border border-white/10">Ubah nama</button>`}<button type="button" data-k="del" data-id="${id}" class="px-2 py-1 rounded border border-rose-500/30 text-rose-400">Hapus</button>`}</span></div>`}).join('');
 const r=await Swal.fire({title:'Kelola Klasifikasi',width:540,background:'#22120a',color:'#fcf6f0',showDenyButton:true,confirmButtonText:'Tutup',denyButtonText:'➕ Tambah baru',confirmButtonColor:'#f4a23a',
  html:`<p class="text-left text-[11px] mb-3" style="color:#e1b782">Klasifikasi yang dihapus hilang dari pilihan form. Laporan lama tetap menampilkan namanya dan klasifikasi bisa dipulihkan kapan saja.</p><div class="space-y-2" style="max-height:50vh;overflow:auto">${rows}</div>`,
  didOpen:p=>p.querySelectorAll('button[data-k]').forEach(b=>b.onclick=()=>{AM._kact=[b.dataset.k,b.dataset.id];Swal.close()})});
 const act=AM._kact,hid=()=>appState.hiddenKinds=appState.hiddenKinds||[];AM._kact=null;
 if(act){const id=act[1],x=(appState.incidentKinds||[]).find(z=>z.id===id);
  if(act[0]==='res'){appState.hiddenKinds=(appState.hiddenKinds||[]).filter(k=>k!==id);syncKinds();await saveMasterSettings()}
  else if(act[0]==='del'){const left=Object.keys(KIND).filter(k=>!isHid(k)&&k!==id).length;
   if(left<1){await Swal.fire({title:'Tidak bisa dihapus',text:'Minimal harus ada satu klasifikasi yang tersisa.',icon:'info',background:'#22120a',color:'#fcf6f0'})}
   else if(await confirmBox('Hapus klasifikasi?',used(id)||!x?`“${KIND[id][1]}” dihapus dari pilihan. Laporan lama tetap tampil dan bisa dipulihkan.`:`“${KIND[id][1]}” akan dihapus permanen (belum pernah dipakai laporan).`)){
    if(x&&!used(id)){appState.incidentKinds=appState.incidentKinds.filter(z=>z.id!==id)}else{hid();if(!appState.hiddenKinds.includes(id))appState.hiddenKinds.push(id)}
    syncKinds();await saveMasterSettings()}}
  else if(act[0]==='ren'&&x){const n=await ask('Ubah nama klasifikasi',[{k:'l',l:'Nama',v:x.label,req:1}],'Simpan',{check:o=>Object.entries(KIND).some(([k,v])=>k!==id&&v[1].toLowerCase()===o.l.toLowerCase())?'Nama itu sudah dipakai':''});if(n){x.label=n.l;syncKinds();await saveMasterSettings()}}
  incView();return AM.kinds()}
 if(r.isDenied){const n=await ask('Klasifikasi baru',[{k:'l',l:'Nama klasifikasi',req:1},{k:'e',l:'Dampak ke status aset',opts:[['Broken','Rusak'],['Lost','Hilang']]}],'Tambah',{check:o=>Object.values(KIND).some(v=>v[1].toLowerCase()===o.l.toLowerCase())?'Klasifikasi dengan nama itu sudah ada':''});
  if(n){(appState.incidentKinds=appState.incidentKinds||[]).push({id:'ik_'+Date.now().toString(36),label:n.l,effect:n.e==='Lost'?'Lost':'Broken'});syncKinds();await saveMasterSettings()}
  incView();return AM.kinds()}
 incView()};
AM.incTab=function(k){AM.incF=k;incView()};
AM.incDel=async function(id){if(!isGA())return deny();if(!(await confirmBox('Hapus catatan?','Hanya catatan laporan yang dihapus, status unit aset tidak berubah.')))return;AM.incidents=AM.incidents.filter(i=>i.id!==id);save()};

function divBlock(){const L=mine().filter(a=>!dead(a)),g={};L.forEach(a=>{const k=a.division||'(Belum dialokasikan)';const x=g[k]=g[k]||{u:0,v:0,b:0};x.u+=q(a);x.v+=tot(a);x.b+=dep(a).book});
 AM._dk=Object.keys(g).sort((a,b)=>g[b].u-g[a].u);
 const rows=AM._dk.map((k,i)=>`<tr class="hover:bg-white/[0.02]"><td class="p-4 font-bold text-white">${esc(k)}</td><td class="p-4 font-mono">${g[k].u}</td>${isGA()?`<td class="p-4 font-mono">${rp(g[k].v)}</td><td class="p-4 font-mono text-emerald-300">${rp(g[k].b)}</td>`:''}<td class="p-4">${btn(`AM.goDiv(${i})`,'fa-list','Lihat aset divisi ini')}</td></tr>`).join('');
 return `<h3 class="text-sm font-bold text-white mt-2"><i class="fa-solid fa-sitemap text-dobah-400 mr-2"></i>Alokasi per Divisi</h3>`+tbl(th('Divisi','Unit',...(isGA()?['Nilai Perolehan','Nilai Buku']:[]),'Aksi'),rows,'Belum ada aset.')}
function mapAll(){map();$('view-amap').insertAdjacentHTML('beforeend',divBlock())}
AM.goDiv=function(i){const k=AM._dk[i];AM.f.div=k==='(Belum dialokasikan)'?'__NONE':k;AM.f.page=1;switchTab('areg')};
const R={adash:dash,areg:reg,amap:mapAll,amtc:mtc,ainc:incView,adep:depr,aasg:loanView,amkt:mkt,aven:ven,acon:()=>con()}; // con() ada di 07-contacts.js (dimuat setelah file ini), jadi dipanggil lewat pembungkus
function renderActive(){const t=appState.activeTab;if(R[t])R[t]()}
