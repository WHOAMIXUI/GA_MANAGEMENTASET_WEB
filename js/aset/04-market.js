/* Modul Aset: market  (dimuat berurutan setelah file sebelumnya; berbagi scope global dengan modul aset lainnya) */
/* --- jual beli aset antar toko --- */
const myBranches=()=>((user()||{}).branches||[]).filter(b=>b!=='ALL');
const canAll=()=>{const u=user();return isGA()||!!(u&&(u.branches||[]).includes('ALL'))};
const reserved=(aid,ex)=>AM.market.filter(m=>m.assetId===aid&&m.status==='Open'&&m.id!==ex).reduce((n,m)=>n+m.left,0);
const freeQty=(a,ex)=>q(a)-onLoan(a)-reserved(a.id,ex);
const perUnit=a=>Math.round(dep(a).book/q(a));
const mOwn=m=>canAll()||myBranches().includes(m.branch);
/* --- toko pembeli (penawaran langsung) ---
   m.to = nama toko pembeli. Kosong / tidak ada (listing lama) = terbuka untuk semua toko. */
const allStores=()=>appState.branches||[];
const buyerStores=from=>allStores().filter(b=>b!==from);
const forStore=m=>(m.to&&allStores().includes(m.to))?m.to:'';           // toko tujuan yang masih valid; '' = terbuka
const toLabel=m=>forStore(m)||'Semua toko';
const seeListing=m=>canAll()||(!myBranches().includes(m.branch)&&(!forStore(m)||myBranches().includes(forStore(m))));
const stamp=()=>new Date().toLocaleString('id-ID');
const WN={background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'};
const mbadge=s=>{const[c,l]={Open:['emerald','Dijual'],Sold:['blue','Terjual'],Cancelled:['slate','Dibatalkan']}[s]||['slate',s];return `<span class="px-2.5 py-1 text-[10px] uppercase font-bold rounded border bg-${c}-500/10 text-${c}-400 border-${c}-500/20">${l}</span>`};
function mktCards(){const el=$('amMktGrid');if(!el)return;const all=canAll(),mb=myBranches(),qq=(AM.mq||'').toLowerCase();
 const L=AM.market.filter(m=>m.status==='Open'&&seeListing(m)&&(!qq||(m.name+' '+m.branch+' '+(m.category||'')+' '+toLabel(m)).toLowerCase().includes(qq))).sort((a,b)=>(b.ts||0)-(a.ts||0));
 el.innerHTML=L.length?L.map(m=>{const a=find(m.assetId),bk=a?perUnit(a):null,age=a?Math.max(0,Math.floor((Date.now()-new Date(a.date))/2629800000)):null;
  return `<div class="glass-panel p-5 flex flex-col"><div class="flex justify-between items-start gap-2"><h3 class="font-bold text-white text-sm">${esc(m.name)}</h3><span class="px-2 py-1 text-[10px] font-bold rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 whitespace-nowrap">${m.left} unit</span></div>
  <p class="text-xs text-dobah-200/70 mt-1">${esc(m.category)||'—'}</p>
  <p class="text-xs text-dobah-200/80 mt-2"><i class="fa-solid fa-store mr-1"></i>${esc(m.branch)}</p>
  ${forStore(m)?`<p class="mt-2"><span class="px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold text-[10px] uppercase"><i class="fa-solid fa-bullseye mr-1"></i>Khusus ${esc(forStore(m))}</span></p>`:''}
  <p class="font-mono font-black text-xl text-white mt-3">${rp(m.price)}<span class="text-[11px] font-semibold text-dobah-200/60"> / unit</span></p>
  ${bk!=null?`<p class="text-[11px] text-dobah-200/60 mt-1">Nilai buku ± ${rp(bk)} / unit · umur ${age} bln</p>`:''}
  ${m.note?`<p class="text-xs text-dobah-200/70 mt-2 italic">“${esc(m.note)}”</p>`:''}
  <p class="text-[10px] text-dobah-200/50 mt-2">Oleh ${esc(m.createdBy)} · ${esc(m.createdAt)}</p>
  <div class="mt-auto pt-4"><button onclick="AM.buy('${m.id}')" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-4 py-2"><i class="fa-solid fa-cart-shopping mr-1"></i>Beli</button></div></div>`}).join('')
 :'<div class="glass-panel p-10 text-center text-dobah-200/50 italic md:col-span-2 xl:col-span-3">Belum ada aset yang dijual toko lain.</div>'}
function mkt(){const all=canAll(),mb=myBranches(),t=AM.mktTab||'browse';
 const browse=AM.market.filter(m=>m.status==='Open'&&seeListing(m)),mineL=AM.market.filter(mOwn).sort((a,b)=>(b.ts||0)-(a.ts||0)),
  T=AM.trades.filter(x=>all||mb.includes(x.from)||mb.includes(x.to)).sort((a,b)=>(b.ts||0)-(a.ts||0)),sum=T.reduce((n,x)=>n+x.total,0);
 const tabs=[['browse','Pasar Aset ('+browse.length+')'],['mine',(all?'Semua Listing':'Listing Cabang Saya')+' ('+mineL.length+')'],['hist','Riwayat Transaksi ('+T.length+')']].map(([k,l])=>`<button onclick="AM.mTab('${k}')" class="modern-button text-xs font-bold px-4 py-2 border ${t===k?'bg-dobah-400 text-cocoa-950 border-dobah-400':'bg-cocoa-800 text-dobah-200 border-white/10'}">${l}</button>`).join('');
 let body='';
 if(t==='browse')body=`<div class="glass-panel p-4"><input placeholder="Cari aset / cabang penjual..." value="${esc(AM.mq)}" oninput="AM.mQ(this.value)" class="w-full glass-input px-3.5 py-2 text-xs sm:text-sm font-semibold"></div><div id="amMktGrid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>`;
 else if(t==='mine'){const rows=mineL.map(m=>`<tr class="hover:bg-white/[0.02]"><td class="p-4 font-bold text-white">${esc(m.name)}${sub(esc(m.assetId)+' · '+esc(m.createdAt))}</td><td class="p-4">${esc(m.branch)}</td><td class="p-4">${forStore(m)?esc(forStore(m)):'<span class="text-dobah-200/60">Semua toko</span>'}</td><td class="p-4 font-mono font-bold text-white">${m.left}<span class="text-dobah-200/50 text-xs"> / ${m.qty}</span></td><td class="p-4 font-mono">${rp(m.price)}</td><td class="p-4">${mbadge(m.status)}</td><td class="p-4 whitespace-nowrap">${m.status==='Open'?btn(`AM.mktEdit('${m.id}')`,'fa-pen','Ubah harga / jumlah')+btn(`AM.mktCancel('${m.id}')`,'fa-ban','Batalkan listing','text-rose-400'):''}${isGA()?btn(`AM.mktDel('${m.id}')`,'fa-trash','Hapus listing','text-rose-400'):''}</td></tr>`).join('');
  body=tbl(th('Aset','Cabang Penjual','Dibeli oleh','Sisa / Awal','Harga / Unit','Status','Aksi'),rows,'Belum ada listing. Klik “Jual Aset” untuk memasang aset ke toko lain.')}
 else{const rows=T.map(x=>`<tr class="hover:bg-white/[0.02]"><td class="p-4 whitespace-nowrap">${esc(x.date)}${sub(esc(x.id))}</td><td class="p-4 font-bold text-white">${esc(x.name)}${sub(esc(x.category)||'—')}</td><td class="p-4 text-xs">${esc(x.from)} <i class="fa-solid fa-arrow-right mx-1 text-dobah-400"></i> ${esc(x.to)}${sub('Penjual: '+esc(x.seller)+' · Pembeli: '+esc(x.buyer))}</td><td class="p-4 font-mono font-bold text-white">${x.qty}</td><td class="p-4 font-mono">${rp(x.price)}</td><td class="p-4 font-mono font-bold text-white">${rp(x.total)}</td><td class="p-4 whitespace-nowrap">${btn(`AM.mktPrint('trade','${x.id}')`,'fa-print','Cetak PDF transaksi')}${isGA()?btn(`AM.tradeDel('${x.id}')`,'fa-trash','Hapus riwayat transaksi','text-rose-400'):''}</td></tr>`).join('');
  body=tbl(th('Tanggal','Aset','Dari → Ke','Qty','Harga / Unit','Total','Aksi'),rows,'Belum ada transaksi jual beli antar toko.')}
 $('view-amkt').innerHTML=`<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">${kpi('Dijual Toko Lain',sq(browse.map(m=>({qty:m.left}))),'fa-store')}${kpi('Listing Aktif Saya',mineL.filter(m=>m.status==='Open').length,'fa-tag','emerald')}${kpi('Transaksi',T.length,'fa-handshake','blue')}${kpi('Nilai Transaksi',rp(sum),'fa-wallet')}</div>
 <div class="flex flex-wrap justify-between items-center gap-3"><div class="flex gap-2 flex-wrap">${tabs}</div><div class="flex gap-2 flex-wrap">${t!=='browse'?`<button onclick="AM.mktPrint('${t}')" class="modern-button bg-cocoa-800 text-dobah-200 border border-white/10 text-xs font-bold px-4 py-2"><i class="fa-solid fa-print mr-1"></i>Cetak PDF</button>`:''}<button onclick="AM.sell()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-4 py-2"><i class="fa-solid fa-tag mr-1"></i>Jual Aset</button></div></div>${body}`;
 if(t==='browse')mktCards()}
AM.mTab=function(k){AM.mktTab=k;mkt()};
AM.mQ=function(v){AM.mq=v;mktCards()};
/* --- jual aset: BEBERAPA aset sekaligus ---
   Satu toko penjual + satu toko pembeli + satu catatan, lalu banyak baris aset (jumlah & harga per baris).
   Tiap baris menjadi SATU listing biasa (jadi beli / ubah / batal / cetak tidak berubah); listing dari satu pengiriman diberi tanda `batch` yang sama. */
AM.sell=async function(pre){if(!isGA())return deny();const E=mine().filter(a=>a.status==='Good'&&a.branch&&freeQty(a)>=1);
 if(!E.length)return Swal.fire({title:'Tidak ada aset yang bisa dijual',text:'Hanya aset berstatus Baik, sudah punya cabang, dan tidak sedang dipinjam / dilisting penuh yang bisa dijual.',icon:'info',...WN});
 if(allStores().length<2)return Swal.fire({title:'Cabang belum cukup',text:'Jual beli antar toko butuh minimal 2 cabang di Master Data.',icon:'info',...WN});
 const by={};E.forEach(a=>(by[a.branch]=by[a.branch]||[]).push(a));const stores=Object.keys(by).sort();
 const pa=pre&&E.find(a=>a.id===pre),st0=pa?pa.branch:stores[0],a0=pa||by[st0][0];
 const inp='w-full px-3 py-2 text-sm rounded-lg bg-[#150a05] border border-white/10 text-white',lab='block text-left text-xs font-bold mb-1 mt-3 text-[#edd5b3]';
 const toOpts=b=>[['','Semua toko (terbuka, siapa saja boleh beli)'],...buyerStores(b).map(x=>[x,x])];
 const oh=(opts,sel)=>opts.map(o=>`<option value="${esc(o[0])}"${o[0]===sel?' selected':''}>${esc(o[1])}</option>`).join('');
 const short=l=>l.slice(0,3).join(', ')+(l.length>3?` +${l.length-3} lainnya`:'');
 let rows=[{id:a0.id,qty:1,price:perUnit(a0)}];
 const html=`<label class="${lab}">Toko penjual</label><select id="sl_from" class="${inp}">${oh(stores.map(b=>[b,`${b} — ${by[b].length} jenis aset, ${by[b].reduce((n,a)=>n+freeQty(a),0)} unit tersedia`]),st0)}</select>
  <div class="sl-head text-[#edd5b3]"><span>Aset yang dijual</span><span>Jumlah</span><span>Harga / unit (Rp)</span><span></span></div>
  <div id="sl_rows" class="sl-rows"></div>
  <button type="button" id="sl_add" class="sl-add"><i class="fa-solid fa-plus mr-1"></i>Tambah aset</button>
  <label class="${lab}">Dibeli oleh toko mana?</label><select id="sl_to" class="${inp}">${oh(toOpts(st0),'')}</select>
  <label class="${lab}">Catatan (kondisi, alasan jual, dll) — berlaku untuk semua aset</label><input id="sl_note" type="text" class="${inp}">
  <div id="swSum" class="mt-4 p-3 rounded-lg text-left text-xs leading-relaxed bg-[#150a05] border border-white/10 text-[#edd5b3]"></div>`;
 const bad=m=>{Swal.showValidationMessage(m);return false};
 const r=await Swal.fire({title:'Jual Aset ke Toko Lain',html,width:700,showCancelButton:true,confirmButtonText:'Pasang Listing',cancelButtonText:'Batal',background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a',
  didOpen:()=>{const F=()=>$('sl_from').value,avail=()=>by[F()]||[];
   const upd=()=>{const box=$('swSum');if(!box)return;const to=$('sl_to').value;let u=0,t=0;const low=[],zero=[];
    rows.forEach(x=>{const a=find(x.id);if(!a)return;const n=parseInt(x.qty)||0,p=Number(x.price)||0;u+=n;t+=n*p;if(p===0)zero.push(a.name);else if(p<perUnit(a))low.push(a.name)});
    box.innerHTML=`<div><b>${rows.length}</b> aset · <b>${u}</b> unit · Total jual: <b>${rp(t)}</b></div>`
     +(zero.length?`<div class="mt-1 text-amber-400">Rp 0 (serah tanpa pembayaran): ${esc(short(zero))}</div>`:'')
     +(low.length?`<div class="mt-1 text-amber-400">Di bawah nilai buku: ${esc(short(low))}</div>`:'')
     +`<div class="mt-1">Pembeli: <b>${to?esc(to):'Semua toko (terbuka)'}</b>${to?' — hanya toko ini yang bisa membeli':''}</div>`;
    const c=Swal.getConfirmButton();if(c)c.textContent=rows.length>1?`Pasang ${rows.length} Listing`:'Pasang Listing'};
   // gambar ulang baris (aset yang sudah dipilih di baris lain tidak muncul lagi di pilihan)
   const draw=()=>{$('sl_rows').innerHTML=rows.map((x,i)=>{const used=new Set(rows.filter((_,j)=>j!==i).map(y=>y.id)),a=find(x.id);
     const opts=avail().filter(b=>!used.has(b.id)).map(b=>[b.id,`${b.name} (tersedia ${freeQty(b)} unit · ±${rp(perUnit(b))}/unit)`]);
     return `<div class="sl-row" data-i="${i}"><select class="${inp} sl-a" aria-label="Aset">${oh(opts,x.id)}</select><label class="sl-f"><span class="sl-fl text-[#edd5b3]">Jumlah</span><input type="number" min="1" max="${a?freeQty(a):1}" value="${esc(x.qty)}" class="${inp} sl-q" aria-label="Jumlah unit"></label><label class="sl-f"><span class="sl-fl text-[#edd5b3]">Harga / unit (Rp)</span><input type="number" min="0" value="${esc(x.price)}" class="${inp} sl-p" aria-label="Harga jual per unit"></label><button type="button" class="sl-x" title="Hapus baris" aria-label="Hapus baris"${rows.length<2?' disabled':''}><i class="fa-solid fa-xmark"></i></button></div>`}).join('');
    $('sl_add').disabled=rows.length>=avail().length;upd()};
   $('sl_rows').addEventListener('change',e=>{const w=e.target.closest('.sl-row');if(!w||!e.target.classList.contains('sl-a'))return;const i=+w.dataset.i,a=find(e.target.value);if(a){rows[i]={id:a.id,qty:1,price:perUnit(a)};draw()}});
   $('sl_rows').addEventListener('input',e=>{const w=e.target.closest('.sl-row');if(!w)return;const i=+w.dataset.i;if(e.target.classList.contains('sl-q'))rows[i].qty=e.target.value;else if(e.target.classList.contains('sl-p'))rows[i].price=e.target.value;else return;upd()});
   $('sl_rows').addEventListener('click',e=>{const x=e.target.closest('.sl-x');if(!x||x.disabled)return;rows.splice(+x.closest('.sl-row').dataset.i,1);draw()});
   $('sl_add').onclick=()=>{const used=new Set(rows.map(y=>y.id)),a=avail().find(b=>!used.has(b.id));if(!a)return;rows.push({id:a.id,qty:1,price:perUnit(a)});draw();const box=$('sl_rows');box.scrollTop=box.scrollHeight};
   // ganti toko penjual -> baris dimulai ulang dengan aset toko itu; toko pembeli tidak boleh sama dengan penjual
   $('sl_from').onchange=()=>{const keep=$('sl_to').value,first=avail()[0];rows=first?[{id:first.id,qty:1,price:perUnit(first)}]:[];$('sl_to').innerHTML=oh(toOpts(F()),(keep&&keep!==F()&&buyerStores(F()).includes(keep))?keep:'');draw()};
   $('sl_to').onchange=upd;draw()},
  preConfirm:()=>{const from=$('sl_from').value,to=$('sl_to').value,note=$('sl_note').value.trim(),seen=new Set();
   if(!rows.length)return bad('Pilih minimal satu aset');
   for(let i=0;i<rows.length;i++){const x=rows[i],a=find(x.id),k=rows.length>1?`Baris ${i+1}: `:'';
    if(!a)return bad(k+'Aset tidak ditemukan');if(a.branch!==from)return bad(k+'Aset bukan milik toko yang dipilih');
    if(seen.has(a.id))return bad(k+'Aset yang sama dipilih dua kali');seen.add(a.id);
    const n=parseInt(x.qty),mx=freeQty(a);if(!(n>=1&&n<=mx))return bad(`${k}${a.name}: jumlah harus antara 1 dan ${mx}`);
    if(x.price===''||!(Number(x.price)>=0))return bad(`${k}${a.name}: harga jual wajib diisi`)}
   if(to){if(to===from)return bad('Toko pembeli tidak boleh sama dengan toko penjual');if(!allStores().includes(to))return bad('Toko pembeli tidak dikenal')}
   return{to,note,rows:rows.map(x=>({id:x.id,n:parseInt(x.qty),p:Number(x.price)||0}))}}});
 if(!r.isConfirmed)return;const v=r.value,base=Date.now(),N=v.rows.length,batch=N>1?'BTC-'+base.toString(36).toUpperCase():'',me=(user()||{}).name||'-',at=stamp();
 // beberapa listing dibuat pada milidetik yang sama -> ID dijamin unik
 const newId=()=>{let id,x=0;do{id='MKT-'+(base+x++).toString(36).toUpperCase()}while(AM.market.some(m=>m.id===id));return id};
 v.rows.forEach((x,i)=>{const a=find(x.id);
  AM.market.push({id:newId(),assetId:a.id,name:a.name,category:a.category,branch:a.branch,to:v.to,qty:x.n,left:x.n,price:x.p,note:v.note,status:'Open',createdBy:me,createdAt:at,ts:base+(N-1-i),...(batch?{batch}:{})});
  hist(a,`Dilisting dijual ${x.n} unit @ ${rp(x.p)} — ${v.to?'khusus '+v.to:'terbuka untuk semua toko'}${batch?` (paket ${N} aset, ${batch})`:''} (Pasar Antar Toko)`)});
 AM.mktTab='mine';await save();switchTab('amkt');
 if(N>1)Swal.fire({toast:true,position:'top-end',icon:'success',title:`${N} aset berhasil dilisting`,showConfirmButton:false,timer:2600,background:'#22120a',color:'#fcf6f0'})};
AM.buy=async function(id){if(!isGA())return deny();const m=AM.market.find(x=>x.id===id);if(!m||m.status!=='Open')return Swal.fire({title:'Listing tidak tersedia',text:'Aset ini sudah terjual atau dibatalkan.',icon:'info',...WN});
 const fixed=forStore(m),opts=fixed?[fixed]:(canAll()?allStores():myBranches()).filter(b=>b!==m.branch);
 if(!opts.length)return Swal.fire({title:'Tidak bisa membeli',text:'Akun Anda tidak terhubung ke cabang lain selain cabang penjual.',icon:'warning',...WN});
 const a=find(m.assetId);if(!a||a.status!=='Good'){m.status='Cancelled';await save();return Swal.fire({title:'Aset tidak lagi tersedia',text:'Listing dibatalkan otomatis karena aset berubah status atau dihapus.',icon:'info',...WN})}
 const mx=Math.min(m.left,q(a)-onLoan(a));
 if(mx<1)return Swal.fire({title:'Stok tidak cukup',text:'Unit sedang dipinjam sehingga belum bisa dijual.',icon:'info',...WN});
 const r=await ask(`Beli “${m.name}”`,[{k:'branch',l:fixed?'Masuk ke cabang (sesuai penawaran penjual)':'Masuk ke cabang',opts:opts.map(b=>[b,b])},{k:'qty',l:`Jumlah unit (maks ${mx}) — ${rp(m.price)} / unit`,t:'number',v:1},{k:'note',l:'Catatan pembeli (opsional)'}],'Lanjut',{check:o=>{const n=parseInt(o.qty);return n>=1&&n<=mx?'':`Jumlah harus antara 1 dan ${mx}`}});
 if(!r)return;const n=parseInt(r.qty),total=n*m.price;
 if(!(await confirmBox(`Beli ${n} unit seharga ${rp(total)}?`,`Aset berpindah dari ${m.branch} ke ${r.branch}. Pembayaran antar cabang diselesaikan di luar sistem.`)))return;
 const A=find(m.assetId),me=(user()||{}).name||'-';
 if(!A||A.status!=='Good'||n>Math.min(m.left,q(A)-onLoan(A)))return Swal.fire({title:'Stok berubah',text:'Jumlah tersedia sudah berubah. Coba lagi.',icon:'warning',...WN});
 const tid='TRD-'+Date.now().toString(36).toUpperCase();let tgt;
 if(n===q(A)){A.branch=r.branch;A.division='';tgt=A;hist(A,`Dibeli ${n} unit dari ${m.branch} oleh ${r.branch} @ ${rp(m.price)} (${tid})`)}
 else{let id2,x=2;do{id2=`${A.id}-T${x++}`}while(find(id2));
  tgt={...A,id:id2,qty:n,branch:r.branch,division:'',assigned:null,history:[],src:'trade|'+tid};A.qty=q(A)-n;
  hist(A,`${n} unit dijual ke ${r.branch} @ ${rp(m.price)} (${tid})`);hist(tgt,`Dibeli ${n} unit dari ${m.branch} (aset ${A.id}) @ ${rp(m.price)} (${tid})`);AM.assets.push(tgt)}
 m.left-=n;if(m.left<=0){m.left=0;m.status='Sold'}
 AM.trades.push({id:tid,listingId:m.id,assetId:A.id,newAssetId:tgt.id,name:m.name,category:m.category,from:m.branch,to:r.branch,qty:n,price:m.price,total,date:today(),ts:Date.now(),seller:m.createdBy,buyer:me,note:r.note||''});
 AM.mktTab='hist';await save();switchTab('amkt');Swal.fire({title:'Pembelian berhasil',text:`${n} unit “${m.name}” kini terdaftar di ${r.branch}.`,icon:'success',...WN})};
AM.mktCancel=async function(id){if(!isGA())return deny();const m=AM.market.find(x=>x.id===id);if(!m||!mOwn(m))return deny();if(!(await confirmBox('Batalkan listing?',m.name)))return;m.status='Cancelled';const a=find(m.assetId);if(a)hist(a,'Listing penjualan dibatalkan');save()};
AM.mktEdit=async function(id){if(!isGA())return deny();const m=AM.market.find(x=>x.id===id);if(!m||!mOwn(m))return deny();const a=find(m.assetId);if(!a)return;const mx=freeQty(a,m.id);
 const r=await ask('Ubah Listing',[{k:'price',l:'Harga jual per unit (Rp)',t:'number',v:m.price},{k:'qty',l:`Jumlah unit masih dijual (1–${mx})`,t:'number',v:m.left},{k:'to',l:'Dibeli oleh toko mana?',v:forStore(m),opts:[['','Semua toko (terbuka, siapa saja boleh beli)'],...buyerStores(m.branch).map(b=>[b,b])]},{k:'note',l:'Catatan',v:m.note}],'Simpan',{check:o=>{const n=parseInt(o.qty);if(!(n>=1&&n<=mx))return `Jumlah harus antara 1 dan ${mx}`;if(o.price===''||!(Number(o.price)>=0))return 'Harga wajib diisi';return ''}});
 if(!r)return;const n=parseInt(r.qty),sold=m.qty-m.left;m.price=Number(r.price)||0;m.left=n;m.qty=sold+n;m.note=r.note;m.to=r.to||'';hist(a,`Listing diubah: ${n} unit @ ${rp(m.price)} — ${m.to?'khusus '+m.to:'terbuka untuk semua toko'}`);save()};

/* --- hapus listing & riwayat transaksi (GA Manager) --- */
AM.mktDel=async function(id){if(!isGA())return deny();const m=AM.market.find(x=>x.id===id);if(!m||!mOwn(m))return deny();
 const txt=m.status==='Open'?'Listing masih aktif dan akan dihapus permanen. Aset tidak berubah.':'Hanya catatan listing yang dihapus. Riwayat transaksi dan perpindahan aset yang sudah terjadi tidak ikut terhapus.';
 if(!(await confirmBox('Hapus listing “'+m.name+'”?',txt)))return;
 const a=find(m.assetId);if(a)hist(a,'Listing penjualan dihapus ('+m.id+')');
 AM.market=AM.market.filter(x=>x.id!==id);await save();switchTab('amkt')};
AM.tradeDel=async function(id){if(!isGA())return deny();const x=AM.trades.find(t=>t.id===id);if(!x)return;
 if(!(await confirmBox('Hapus riwayat transaksi '+x.id+'?','Hanya catatan transaksi yang dihapus dari riwayat dan laporan. Aset yang sudah berpindah ke '+x.to+' TIDAK dikembalikan.')))return;
 AM.trades=AM.trades.filter(t=>t.id!==id);await save();switchTab('amkt')};
/* --- cetak PDF (template sama dengan cetak pengajuan di Daftar & Status: #print-sheet + window.print) --- */
AM.mktPrint=async function(kind,id){const all=canAll(),mb=myBranches(),u=user()||{};
 const logoEl=document.querySelector('#loginModal img[alt="Dobah"]')||document.querySelector('img[data-logo="full"]'),logo=logoEl?logoEl.src:'';
 const T=AM.trades.filter(x=>all||mb.includes(x.from)||mb.includes(x.to)).sort((a,b)=>(b.ts||0)-(a.ts||0));
 const foot=`<div class="ps-foot"><span>GA MAINTENANCE &middot; Dobah</span><span>Dicetak oleh ${esc(u.name||'-')} &middot; ${esc(stamp())}</span></div>`;
 const head=(title,sub2)=>`<div class="ps-head">${logo?`<img src="${logo}" alt="Dobah">`:'<b>DOBAH</b>'}<div class="ps-title"><h1>${title}</h1><p>${sub2}</p></div></div>`;
 let html='',fname='Jual-Beli-Aset';
 if(kind==='trade'){const x=AM.trades.find(t=>t.id===id);if(!x)return Swal.fire({title:'Transaksi tidak ditemukan',icon:'info',...WN});
  fname='Transaksi-'+x.id;
  html=`<div class="ps">${head('FORM JUAL BELI ASET ANTAR TOKO','#'+esc(x.id))}
   <div class="ps-grid"><div><span>Tanggal</span><b>${esc(x.date)}</b></div><div><span>Toko penjual</span><b>${esc(x.from)}</b></div><div><span>Toko pembeli</span><b>${esc(x.to)}</b></div>
   <div><span>Penjual</span><b>${esc(x.seller||'-')}</b></div><div><span>Pembeli</span><b>${esc(x.buyer||'-')}</b></div><div><span>Total</span><b>${rp(x.total)}</b></div></div>
   <h2>Rincian aset</h2><table><thead><tr><th class="c" style="width:28px">No</th><th>Aset</th><th>Kategori</th><th class="c" style="width:50px">Qty</th><th class="r">Harga / Unit</th><th class="r">Total</th></tr></thead>
   <tbody><tr><td class="c">1</td><td><b>${esc(x.name)}</b><br><small>${esc(x.assetId)}${x.newAssetId&&x.newAssetId!==x.assetId?' &rarr; '+esc(x.newAssetId):''}</small></td><td>${esc(x.category||'-')}</td><td class="c"><b>${x.qty}</b></td><td class="r">${rp(x.price)}</td><td class="r"><b>${rp(x.total)}</b></td></tr></tbody></table>
   ${x.note?`<h2>Catatan pembeli</h2><div class="ps-box">${esc(x.note)}</div>`:''}
   <div class="ps-sign"><div><b>${esc(x.seller||'')}</b><span>Penjual (${esc(x.from)})</span></div><div><b>${esc(x.buyer||'')}</b><span>Pembeli (${esc(x.to)})</span></div><div><b>&nbsp;</b><span>Manager GA</span></div></div>${foot}</div>`}
 else if(kind==='mine'){const L=AM.market.filter(mOwn).sort((a,b)=>(b.ts||0)-(a.ts||0));if(!L.length)return Swal.fire({title:'Belum ada data',text:'Tidak ada listing untuk dicetak.',icon:'info',...WN});
  fname='Listing-Jual-Aset';const act=L.filter(m=>m.status==='Open').reduce((n,m)=>n+m.left*m.price,0);
  html=`<div class="ps">${head('DATA LISTING JUAL ASET ANTAR TOKO',esc(today()))}
   <div class="ps-grid"><div><span>Jumlah listing</span><b>${L.length}</b></div><div><span>Listing aktif</span><b>${L.filter(m=>m.status==='Open').length}</b></div><div><span>Nilai listing aktif</span><b>${rp(act)}</b></div></div>
   <h2>Daftar listing</h2><table><thead><tr><th class="c" style="width:28px">No</th><th>Aset</th><th>Toko penjual</th><th>Dibeli oleh</th><th class="c">Sisa / Awal</th><th class="r">Harga / Unit</th><th class="c">Status</th></tr></thead><tbody>
   ${L.map((m,i)=>`<tr><td class="c">${i+1}</td><td><b>${esc(m.name)}</b><br><small>${esc(m.assetId)} &middot; ${esc(m.createdAt)}</small></td><td>${esc(m.branch)}</td><td>${esc(toLabel(m))}</td><td class="c">${m.left} / ${m.qty}</td><td class="r">${rp(m.price)}</td><td class="c">${({Open:'Dijual',Sold:'Terjual',Cancelled:'Dibatalkan'})[m.status]||esc(m.status)}</td></tr>`).join('')}</tbody></table>${foot}</div>`}
 else{if(!T.length)return Swal.fire({title:'Belum ada data',text:'Belum ada transaksi jual beli untuk dicetak.',icon:'info',...WN});
  fname='Riwayat-Jual-Beli-Aset';const sum=T.reduce((n,x)=>n+x.total,0),qt=T.reduce((n,x)=>n+x.qty,0);
  html=`<div class="ps">${head('LAPORAN JUAL BELI ASET ANTAR TOKO',esc(today()))}
   <div class="ps-grid"><div><span>Jumlah transaksi</span><b>${T.length}</b></div><div><span>Total unit</span><b>${qt}</b></div><div><span>Nilai transaksi</span><b>${rp(sum)}</b></div></div>
   <h2>Riwayat transaksi</h2><table><thead><tr><th class="c" style="width:28px">No</th><th>Tanggal</th><th>Aset</th><th>Dari &rarr; Ke</th><th class="c" style="width:40px">Qty</th><th class="r">Harga / Unit</th><th class="r">Total</th></tr></thead><tbody>
   ${T.map((x,i)=>`<tr><td class="c">${i+1}</td><td>${esc(x.date)}<br><small>${esc(x.id)}</small></td><td><b>${esc(x.name)}</b><br><small>${esc(x.category||'-')}</small></td><td>${esc(x.from)} &rarr; ${esc(x.to)}<br><small>${esc(x.seller||'-')} / ${esc(x.buyer||'-')}</small></td><td class="c">${x.qty}</td><td class="r">${rp(x.price)}</td><td class="r">${rp(x.total)}</td></tr>`).join('')}</tbody>
   <tfoot><tr><td colspan="6" class="r">TOTAL</td><td class="r">${rp(sum)}</td></tr></tfoot></table>
   <div class="ps-sign"><div><b>&nbsp;</b><span>Dibuat oleh</span></div><div><b>&nbsp;</b><span>Kepala Cabang</span></div><div><b>&nbsp;</b><span>Manager GA</span></div></div>${foot}</div>`}
 document.getElementById('print-sheet').innerHTML=html;
 const imgs=Array.from(document.querySelectorAll('#print-sheet img'));await Promise.all(imgs.map(im=>im.complete?Promise.resolve():new Promise(r=>{im.onload=im.onerror=r})));
 const old=document.title;document.title=fname;window.addEventListener('afterprint',()=>{document.title=old},{once:true});window.print()};
