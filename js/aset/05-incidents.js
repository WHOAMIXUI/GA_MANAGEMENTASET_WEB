/* Modul Aset: incidents  (dimuat berurutan setelah file sebelumnya; berbagi scope global dengan modul aset lainnya) */
/* --- klasifikasi aset rusak / hilang --- */
const dead=a=>a.status==='Disposed'||a.status==='Lost';
const KIND={dmg_emp:['amber','Rusak — kelalaian karyawan'],dmg_use:['orange','Rusak — pemakaian wajar'],lost:['violet','Hilang']};
const kbadge=k=>{const[c,l]=KIND[k]||['slate',k];return `<span class="px-2.5 py-1 text-[10px] uppercase font-bold rounded border bg-${c}-500/10 text-${c}-400 border-${c}-500/20">${l}</span>`};
AM.report=async function(pre){const E=mine().filter(a=>!dead(a)&&freeQty(a)>=1);
 if(!E.length)return Swal.fire({title:'Tidak ada aset yang bisa dilaporkan',text:'Semua unit sedang dipinjam / dijual atau sudah dihapuskan.',icon:'info',...WN});
 const r=await ask('Lapor Rusak / Hilang',[
  {k:'a',l:'Aset',v:pre,opts:E.map(a=>[a.id,`${a.name} — ${a.branch||'-'} (${freeQty(a)} unit tersedia)`])},
  {k:'kind',l:'Klasifikasi',opts:Object.keys(KIND).map(k=>[k,KIND[k][1]])},
  {k:'qty',l:'Jumlah unit',t:'number',v:1},
  {k:'who',l:'Karyawan terkait / penanggung jawab'},
  {k:'date',l:'Tanggal kejadian',t:'date',v:today()},
  {k:'comp',l:'Ganti rugi dibebankan ke karyawan (Rp, opsional)',t:'number',v:0},
  {k:'note',l:'Kronologi / catatan'}],'Simpan Laporan',{
  html:'<p class="text-left text-[11px] mt-3" style="color:#e1b782">Contoh: piring 16 unit → laporkan 6 unit “Rusak”, lalu laporkan lagi 7 unit “Hilang”. Sisa 3 unit tetap Baik.</p>',
  check:o=>{const a=find(o.a);if(!a)return 'Aset tidak ditemukan';const n=parseInt(o.qty),mx=freeQty(a);
   if(!(n>=1&&n<=mx))return `Jumlah harus antara 1 dan ${mx}`;
   if(o.kind!=='lost'&&a.status==='Broken')return 'Aset ini sudah berstatus Rusak';
   if(o.kind==='dmg_emp'&&!o.who)return 'Nama karyawan wajib diisi untuk kerusakan karena kelalaian';
   if(o.comp!==''&&!(Number(o.comp)>=0))return 'Nominal ganti rugi tidak valid';return ''}});
 if(!r)return;const a=find(r.a),n=parseInt(r.qty),k=r.kind,st=k==='lost'?'Lost':'Broken',lab=KIND[k][1],who=r.who?' · '+r.who:'';
 let tgt;
 if(n===q(a)){a.status=st;tgt=a;hist(a,`${lab}: ${n} unit${who}. ${r.note||''}`)}
 else{let id,x=2;do{id=`${a.id}-R${x++}`}while(find(id));
  tgt={...a,id,qty:n,status:st,assigned:null,history:[],mtcDate:'',mtcNote:'',vendorId:'',mtcCost:0};a.qty=q(a)-n;
  hist(a,`${n} unit dipisah (${lab}${who}) menjadi ${id}`);hist(tgt,`Dari ${a.id}: ${lab}, ${n} unit${who}. ${r.note||''}`);AM.assets.push(tgt)}
 AM.incidents.push({id:'INC-'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,4).toUpperCase(),assetId:a.id,newAssetId:tgt.id,name:a.name,category:a.category,branch:a.branch,division:a.division||'',qty:n,kind:k,who:r.who,date:r.date||today(),note:r.note,unit:a.price||0,loss:(a.price||0)*n,comp:Number(r.comp)||0,by:(user()||{}).name||'-',ts:Date.now(),found:''});
 await save();Swal.fire({title:'Laporan tersimpan',text:`${n} unit “${a.name}” dicatat: ${lab}. Sisa unit Baik di baris asal: ${q(a)===n&&tgt===a?0:q(a)}.`,icon:'success',...WN})};
function incView(){const all=canAll(),mb=myBranches(),f=AM.incF||'all',ga=isGA();
 const L=AM.incidents.filter(i=>all||mb.includes(i.branch)).sort((a,b)=>(b.ts||0)-(a.ts||0)),V=L.filter(i=>f==='all'||i.kind===f),
  sq2=k=>L.filter(i=>i.kind===k).reduce((n,i)=>n+i.qty,0),loss=L.reduce((n,i)=>n+i.loss,0),comp=L.reduce((n,i)=>n+i.comp,0);
 const tabs=[['all','Semua ('+L.length+')'],...Object.keys(KIND).map(k=>[k,KIND[k][1]+' ('+L.filter(i=>i.kind===k).length+')'])].map(([k,l])=>`<button onclick="AM.incTab('${k}')" class="modern-button text-xs font-bold px-4 py-2 border ${f===k?'bg-dobah-400 text-cocoa-950 border-dobah-400':'bg-cocoa-800 text-dobah-200 border-white/10'}">${l}</button>`).join('');
 const rows=V.map(i=>`<tr class="hover:bg-white/[0.02]"><td class="p-4 whitespace-nowrap">${esc(i.date)}${sub(esc(i.id))}</td><td class="p-4 font-bold text-white">${esc(i.name)}${sub(esc(i.branch)||'-')}</td><td class="p-4">${kbadge(i.kind)}${i.found?sub('<span class="text-emerald-400">Ditemukan '+esc(i.found)+'</span>'):''}</td><td class="p-4 font-mono font-bold text-white text-base">${i.qty}</td><td class="p-4">${esc(i.who)||'<span class="text-dobah-200/40">—</span>'}</td><td class="p-4 font-mono">${rp(i.loss)}${i.comp?sub('Ganti rugi '+rp(i.comp)):''}</td><td class="p-4 text-xs">${esc(i.note)||'—'}${sub('Pelapor: '+esc(i.by))}</td><td class="p-4">${ga?btn(`AM.incDel('${i.id}')`,'fa-trash','Hapus catatan (aset tidak berubah)','text-rose-400'):''}</td></tr>`).join('');
 $('view-ainc').innerHTML=`<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">${kpi('Rusak (karyawan)',sq2('dmg_emp')+' unit','fa-user-xmark','amber')}${kpi('Rusak (wajar)',sq2('dmg_use')+' unit','fa-wrench','rose')}${kpi('Hilang',sq2('lost')+' unit','fa-magnifying-glass','violet')}${kpi('Total Kerugian',rp(loss),'fa-money-bill-trend-up','rose')}${kpi('Ganti Rugi Dibebankan',rp(comp),'fa-hand-holding-dollar','emerald')}</div>
 <div class="flex flex-wrap justify-between items-center gap-3"><div class="flex gap-2 flex-wrap">${tabs}</div><button onclick="AM.report()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-4 py-2"><i class="fa-solid fa-flag mr-1"></i>Lapor Rusak / Hilang</button></div>`
 +tbl(th('Tanggal','Aset','Klasifikasi','Qty','Karyawan Terkait','Nilai Kerugian','Catatan','Aksi'),rows,'Belum ada laporan aset rusak atau hilang.')}
AM.incTab=function(k){AM.incF=k;incView()};
AM.incDel=async function(id){if(!isGA())return deny();if(!(await confirmBox('Hapus catatan?','Hanya catatan laporan yang dihapus, status unit aset tidak berubah.')))return;AM.incidents=AM.incidents.filter(i=>i.id!==id);save()};

function divBlock(){const L=mine().filter(a=>!dead(a)),g={};L.forEach(a=>{const k=a.division||'(Belum dialokasikan)';const x=g[k]=g[k]||{u:0,v:0,b:0};x.u+=q(a);x.v+=tot(a);x.b+=dep(a).book});
 AM._dk=Object.keys(g).sort((a,b)=>g[b].u-g[a].u);
 const rows=AM._dk.map((k,i)=>`<tr class="hover:bg-white/[0.02]"><td class="p-4 font-bold text-white">${esc(k)}</td><td class="p-4 font-mono">${g[k].u}</td><td class="p-4 font-mono">${rp(g[k].v)}</td><td class="p-4 font-mono text-emerald-300">${rp(g[k].b)}</td><td class="p-4">${btn(`AM.goDiv(${i})`,'fa-list','Lihat aset divisi ini')}</td></tr>`).join('');
 return `<h3 class="text-sm font-bold text-white mt-2"><i class="fa-solid fa-sitemap text-dobah-400 mr-2"></i>Alokasi per Divisi</h3>`+tbl(th('Divisi','Unit','Nilai Perolehan','Nilai Buku','Aksi'),rows,'Belum ada aset.')}
function mapAll(){map();$('view-amap').insertAdjacentHTML('beforeend',divBlock())}
AM.goDiv=function(i){const k=AM._dk[i];AM.f.div=k==='(Belum dialokasikan)'?'__NONE':k;AM.f.page=1;switchTab('areg')};
const R={adash:dash,areg:reg,amap:mapAll,amtc:mtc,ainc:incView,adep:depr,aasg:loanView,amkt:mkt,aven:ven,acon:()=>con()}; // con() ada di 07-contacts.js (dimuat setelah file ini), jadi dipanggil lewat pembungkus
function renderActive(){const t=appState.activeTab;if(R[t])R[t]()}
