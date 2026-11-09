/* Modul Aset: actions  (dimuat berurutan setelah file sebelumnya; berbagi scope global dengan modul aset lainnya) */
/* --- aksi --- */
AM.act=async function(id,k){const a=find(id);if(!a)return;
 if(k==='hist')return Swal.fire({title:esc(a.name),html:`<div class="text-left text-xs space-y-2 max-h-72 overflow-y-auto">${a.history.slice().reverse().map(h=>`<div class="p-2 bg-[#150a05] rounded-lg"><b>${esc(h.t)}</b> — ${esc(h.by)}<br>${esc(h.act)}</div>`).join('')}</div>`,background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'});
 if(k==='photo'){const dp=a.disposal||{},ids=dp.photos||[];if(!ids.length)return Swal.fire({title:'Tidak ada foto',text:'Aset ini dimusnahkan sebelum foto bukti diwajibkan.',icon:'info',background:'#22120a',color:'#fcf6f0'});
  Swal.fire({title:'Memuat foto...',background:'#22120a',color:'#fcf6f0',didOpen:()=>Swal.showLoading()});const imgs=await Promise.all(ids.map(getPhoto));
  return Swal.fire({title:'Bukti Pemusnahan',html:`<div class="text-left text-xs mb-3">${esc(dp.method||'-')} · ${esc(dp.date||'-')}<br>${esc(dp.reason||'')}${dp.witness?'<br>Disaksikan: '+esc(dp.witness):''}</div>`+imgs.map(u=>u?`<img src="${u}" class="w-full rounded-lg mb-2 border border-white/10">`:'<div class="p-4 text-xs text-[#edd5b3]/60 bg-[#150a05] rounded-lg mb-2">Foto tidak ditemukan di perangkat ini.</div>').join(''),background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'})}
 if(k==='rep'){if(!(await confirmBox('Lapor aset rusak?',a.name)))return;a.status='Broken';hist(a,'Dilaporkan rusak oleh cabang');return save()}
 if(!isGA())return deny();
 if(k==='edit'){const r=await ask('Edit Aset',[{k:'name',l:'Nama aset',v:a.name,req:1},{k:'category',l:'Kategori',v:a.category,opts:opt0(appState.categories,a.category)},{k:'branch',l:'Cabang / Lokasi',v:a.branch,opts:opt0(appState.branches,a.branch)},{k:'division',l:'Divisi',v:a.division,opts:opt0(appState.divisions,a.division)},{k:'qty',l:'Qty (jumlah unit)',t:'number',v:q(a)},{k:'price',l:'Harga per unit (Rp)',t:'number',v:a.price},{k:'date',l:'Tanggal perolehan',t:'date',v:a.date},{k:'status',l:'Status',v:a.status,opts:[['Good','Baik'],['Maintenance','Maintenance'],['Broken','Rusak']]}]);if(!r)return;
  const nq=Math.max(1,parseInt(r.qty)||1),oq=q(a),np=Number(r.price)||0,ch=[];
  if(nq<onLoan(a))return Swal.fire({title:'Qty terlalu kecil',text:`${onLoan(a)} unit sedang dipinjam. Qty tidak boleh di bawah jumlah itu.`,icon:'info',background:'#22120a',color:'#fcf6f0'});
  [['name','Nama'],['category','Kategori'],['branch','Cabang'],['division','Divisi'],['date','Tanggal']].forEach(([f,l])=>{if((a[f]||'')!==r[f]){ch.push(`${l}: ${a[f]||'-'} → ${r[f]||'-'}`);a[f]=r[f]}});
  if(nq!==oq){ch.push(`Qty: ${oq} → ${nq}`);a.qty=nq}if(np!==(a.price||0)){ch.push(`Harga/unit: ${rp(a.price)} → ${rp(np)}`);a.price=np}
  if(r.status!==a.status){ch.push(`Status: ${ST[a.status][1]} → ${ST[r.status][1]}`);a.status=r.status}
  if(ch.length)hist(a,'Diedit: '+ch.join('; '));return save()}
 if(k==='split'){const have=q(a);if(have<2)return;
  const r=await ask(`Alokasikan dari “${a.name}” (Qty ${have})`,[{k:'n',l:`Jumlah unit yang dialokasikan (1–${have-Math.max(1,onLoan(a))})`,t:'number',v:1},{k:'branch',l:'Cabang tujuan',v:a.branch,opts:opt0(appState.branches,a.branch)},{k:'category',l:'Kategori tujuan',v:a.category,opts:opt0(appState.categories,a.category)},{k:'division',l:'Divisi tujuan',v:a.division,opts:opt0(appState.divisions,a.division)},{k:'status',l:'Status unit tersebut',v:a.status,opts:[['Good','Baik'],['Maintenance','Maintenance'],['Broken','Rusak']]}],'Alokasikan');if(!r)return;
  const n=parseInt(r.n);if(!(n>=1&&n<=have-Math.max(1,onLoan(a))))return Swal.fire({title:'Jumlah tidak valid',text:`Isi antara 1 dan ${have-Math.max(1,onLoan(a))} (unit yang sedang dipinjam tidak bisa dialokasikan).`,icon:'warning',background:'#22120a',color:'#fcf6f0'});
  let id,x=2;do{id=`${a.id}-A${x++}`}while(find(id));
  const b={...a,id,qty:n,branch:r.branch,category:r.category,division:r.division,status:r.status,assigned:null,history:[]};a.qty=have-n;
  hist(a,`${n} unit dialokasikan ke ${r.branch||'(cabang kosong)'} / ${r.category||'(kategori kosong)'} / divisi ${r.division||'(kosong)'} sebagai ${id}`);hist(b,`Hasil alokasi ${n} unit dari ${a.id}`);AM.assets.push(b);return save()}
 if(k==='st'){const r=await ask('Ubah Status',[{k:'s',l:'Status baru',v:a.status,opts:[['Good','Baik'],['Maintenance','Maintenance'],['Broken','Rusak']]}]);if(!r)return;a.status=r.s;hist(a,'Status diubah menjadi '+ST[r.s][1]);return save()}
 if(k==='disp'){const avail=q(a)-onLoan(a),W={background:'#22120a',color:'#fcf6f0'};
  if(avail<1)return Swal.fire({title:'Aset masih dipinjam',text:'Selesaikan pengembalian dulu sebelum dimusnahkan.',icon:'info',...W});
  const r=await disposeAsk(`Pemusnahan: ${a.name}`,avail);if(!r)return;const n=parseInt(r.n)||0;
  if(n<1||n>avail)return Swal.fire({title:'Jumlah tidak valid',text:`Isi antara 1 dan ${avail}.`,icon:'warning',...W});
  if(!(await confirmBox(`Musnahkan ${n} unit?`,'Nilai buku menjadi Rp 0 dan unit ini tidak lagi dihitung sebagai aset aktif. Bisa dibatalkan lewat tombol Pulihkan.')))return;
  try{r.photos=await savePhotos(r._ph)}catch(e){return Swal.fire({title:'Foto gagal disimpan',text:'Periksa koneksi lalu coba lagi. Pemusnahan dibatalkan.',icon:'error',background:'#22120a',color:'#fcf6f0'})}
  dispose(a,n,r);return save()}
 if(k==='restore'&&a.status==='Lost'){if(!(await confirmBox('Aset ditemukan?','Unit kembali berstatus Baik dan dihitung sebagai aset aktif.')))return;a.status='Good';hist(a,'Aset yang hilang ditemukan kembali');AM.incidents.filter(i=>i.newAssetId===a.id&&i.kind==='lost').forEach(i=>i.found=today());return save()}
 if(k==='restore'){if(!(await confirmBox('Batalkan pemusnahan?','Aset kembali berstatus Baik dan dihitung sebagai aset aktif.')))return;hist(a,'Pemusnahan dibatalkan (dipulihkan). Sebelumnya: '+((a.disposal||{}).method||'-'));a.status='Good';a.disposal=null;return save()}
 if(k==='del'){if(!(await confirmBox('Hapus permanen?','Data dan riwayat aset akan hilang. Aset dari tiket yang sama bisa terdaftar ulang saat sinkron.')))return;AM.assets=AM.assets.filter(x=>x.id!==id);AM.loans=AM.loans.filter(l=>l.assetId!==id);return save()}
 if(k==='mtc'){const r=await ask('Jadwalkan Servis',[{k:'v',l:'Vendor',v:a.vendorId,opts:[['','— Tanpa vendor —'],...vOpts()]},{k:'d',l:'Tanggal servis',t:'date',v:a.mtcDate||today()},{k:'n',l:'Catatan kerusakan / pekerjaan',v:a.mtcNote||''}]);if(!r)return;
  a.vendorId=r.v;a.mtcDate=r.d;a.mtcNote=r.n;if(a.status==='Good')a.status='Maintenance';hist(a,`Servis dijadwalkan ${r.d}${r.v?' (vendor '+(AM.vendors.find(v=>v.id===r.v)||{}).name+')':''}. ${r.n}`);return save()}
 if(k==='fin'){const r=await ask('Selesai Servis',[{k:'c',l:'Biaya servis (Rp)',t:'number',v:0},{k:'n',l:'Catatan hasil',v:''}]);if(!r)return;const c=Number(r.c)||0;a.mtcCost=(a.mtcCost||0)+c;a.status='Good';hist(a,`Servis selesai. Biaya ${rp(c)}. ${r.n}`);a.vendorId='';a.mtcDate='';a.mtcNote='';return save()}
 };
AM.add=async function(){if(!isGA())return deny();const brs=(appState.branches||[]).map(b=>[b,b]),cats=(appState.categories||[]).map(c=>[c,c]);
 const r=await ask('Tambah Aset Manual',[{k:'name',l:'Nama aset',req:1},{k:'category',l:'Kategori',opts:cats},{k:'branch',l:'Cabang',opts:brs},{k:'division',l:'Divisi',opts:opt0(appState.divisions)},{k:'qty',l:'Qty (jumlah unit)',t:'number',v:1},{k:'date',l:'Tanggal perolehan',t:'date',v:today()},{k:'price',l:'Harga per unit (Rp)',t:'number',v:0}]);if(!r)return;
 let id,n=AM.assets.length+1;do{id='AST-M'+String(n++).padStart(4,'0')}while(find(id));
 const a={id,name:r.name,category:r.category,branch:r.branch,division:r.division,qty:Math.max(1,parseInt(r.qty)||1),date:r.date||today(),status:'Good',price:Number(r.price)||0,assigned:null,src:'manual|'+id,history:[]};hist(a,'Didaftarkan manual');AM.assets.push(a);save()};
AM.setLoanTab=function(k){AM.loanTab=k;loanView()};
AM.loan=async function(){if(!isGA())return deny();const free=mine().filter(a=>a.status==='Good'&&q(a)-onLoan(a)>0).slice(0,300),W={background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'};
 if(!free.length)return Swal.fire({title:'Tidak ada aset tersedia',text:'Belum ada aset berstatus Baik yang bisa dipinjam, atau semuanya sedang dipinjam.',icon:'info',...W});
 const r=await ask('Pinjamkan Aset',[{k:'a',l:'Aset',opts:free.map(a=>[a.id,`${a.name} — ${a.branch||'-'} (tersedia ${q(a)-onLoan(a)})`])},{k:'qty',l:'Jumlah dipinjam',t:'number',v:1},{k:'n',l:'Nama peminjam',req:1},{k:'nik',l:'NIK'},{k:'dept',l:'Divisi / Departemen'},{k:'purpose',l:'Keperluan'},{k:'date',l:'Tanggal pinjam',t:'date',v:today()},{k:'due',l:'Batas pengembalian',t:'date',req:1}],'Pinjamkan');if(!r)return;
 const a=find(r.a),qty=parseInt(r.qty)||0,av=q(a)-onLoan(a);
 if(qty<1||qty>av)return Swal.fire({title:'Jumlah tidak valid',text:`Unit yang tersedia: ${av}.`,icon:'warning',...W});
 if(r.date&&r.due<r.date)return Swal.fire({title:'Tanggal tidak valid',text:'Batas pengembalian tidak boleh sebelum tanggal pinjam.',icon:'warning',...W});
 AM.loans.push({id:'LN-'+Date.now().toString(36).toUpperCase(),assetId:a.id,qty,name:r.n,nik:r.nik,dept:r.dept,purpose:r.purpose,date:r.date||today(),due:r.due,returnedAt:'',retCond:'',retNote:''});
 hist(a,`Dipinjam ${qty} unit oleh ${r.n}${r.dept?' ('+r.dept+')':''}, batas kembali ${r.due}`);AM.loanTab='active';save()};
AM.loanRet=async function(id){if(!isGA())return deny();const L=AM.loans.find(x=>x.id===id);if(!L)return;const a=find(L.assetId),W={background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'};
 const r=await ask('Pengembalian Aset',[{k:'n',l:`Jumlah dikembalikan (dipinjam ${L.qty})`,t:'number',v:L.qty},{k:'date',l:'Tanggal kembali',t:'date',v:today()},{k:'cond',l:'Kondisi saat kembali',opts:[['Good','Baik'],['Maintenance','Perlu servis (Maintenance)'],['Broken','Rusak']]},{k:'note',l:'Catatan'}],'Kembalikan');if(!r)return;
 const n=parseInt(r.n)||0;if(n<1||n>L.qty)return Swal.fire({title:'Jumlah tidak valid',text:`Isi antara 1 dan ${L.qty}.`,icon:'warning',...W});
 let rec=L;if(n<L.qty){rec={...L,id:L.id+'-R'+Date.now().toString(36).toUpperCase(),qty:n};L.qty-=n;AM.loans.push(rec)}
 rec.returnedAt=r.date||today();rec.retCond=r.cond;rec.retNote=r.note;
 if(a){hist(a,`Dikembalikan ${n} unit oleh ${L.name}, kondisi ${ST[r.cond][1]}${r.note?'. '+r.note:''}`);
  if(r.cond!=='Good'){if(q(a)===n)a.status=r.cond;else{let x=2,nid;do{nid=`${a.id}-R${x++}`}while(find(nid));const b={...a,id:nid,qty:n,status:r.cond,history:[]};a.qty=q(a)-n;hist(b,`Dipisah otomatis dari ${a.id}: ${n} unit kembali dalam kondisi ${ST[r.cond][1]}`);AM.assets.push(b)}}}
 save()};
AM.loanExt=async function(id){if(!isGA())return deny();const L=AM.loans.find(x=>x.id===id);if(!L)return;const r=await ask('Perpanjang Peminjaman',[{k:'due',l:'Batas pengembalian baru',t:'date',v:L.due,req:1}],'Perpanjang');if(!r)return;
 const a=find(L.assetId);if(a)hist(a,`Peminjaman oleh ${L.name} diperpanjang ${L.due||'-'} → ${r.due}`);L.due=r.due;save()};
AM.vendor=async function(id){if(!isGA())return deny();const v=AM.vendors.find(x=>x.id===id)||{};
 const r=await ask(id?'Edit Vendor':'Tambah Vendor',[{k:'type',l:'Status kerja sama',v:id?vt(v):'contract',opts:[['contract','Ada kontrak'],['none','Tanpa kontrak (per panggilan / per pekerjaan)']]},{k:'name',l:'Nama vendor',v:v.name,req:1},{k:'service',l:'Layanan',v:v.service},{k:'phone',l:'Telepon',v:v.phone},{k:'contractNo',l:'No. kontrak (opsional)',v:v.contractNo},{k:'start',l:'Kontrak mulai',t:'date',v:v.start||''},{k:'expiry',l:'Kontrak berakhir',t:'date',v:v.expiry||''},{k:'note',l:'Catatan / ketentuan (tarif, sistem bayar, dll)',v:v.note}],'Simpan',{
  open:()=>{const t=$('sw_type'),sync=()=>{const off=t.value==='none';['contractNo','start','expiry'].forEach(k=>{const e=$('sw_'+k);e.disabled=off;e.style.opacity=off?.35:1})};t.onchange=sync;sync()},
  check:o=>{if(o.type==='contract'){if(!o.expiry)return 'Tanggal berakhir kontrak wajib diisi';if(o.start&&o.start>o.expiry)return 'Tanggal mulai tidak boleh setelah tanggal berakhir'}return ''}});
 if(!r)return;if(r.type==='none'){r.contractNo='';r.start='';r.expiry=''}
 if(id)Object.assign(v,r);else AM.vendors.push({id:'VND-'+Date.now().toString(36).toUpperCase(),...r});save()};
AM.delVendor=async function(id){if(!isGA())return deny();if(!(await confirmBox('Hapus vendor?','')))return;AM.vendors=AM.vendors.filter(v=>v.id!==id);save()};
