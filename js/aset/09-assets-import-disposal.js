/* Modul Aset: upload aset massal, pilih banyak, pemusnahan, kosongkan registry */
/* --- upload aset massal (CSV / XLSX) --- */
const HMAP={id:['id','id (opsional)','id aset','kode','kode aset'],name:['nama','nama aset','name','aset'],category:['kategori','category'],branch:['cabang','branch','lokasi'],date:['tanggal','tanggal perolehan','tgl perolehan','date'],price:['harga','harga perolehan','price','nilai'],status:['status','kondisi'],qty:['jumlah','qty','unit'],division:['divisi','division','departemen','dept']};
function parseCSV(t){t=t.replace(/^\ufeff/,'');const f=t.split(/\r?\n/)[0],d=(f.match(/;/g)||[]).length>(f.match(/,/g)||[]).length?';':',',rows=[];let r=[],c='',q=false;
 for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}else if(ch==='"')q=true;else if(ch===d){r.push(c);c=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;r.push(c);c='';rows.push(r);r=[]}else c+=ch}
 if(c!==''||r.length){r.push(c);rows.push(r)}return rows.filter(x=>x.some(v=>String(v).trim()!==''))}
function loadXLSX(){return new Promise((ok,no)=>{if(window.XLSX)return ok();const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=ok;s.onerror=()=>no(new Error('Library XLSX gagal dimuat. Simpan file sebagai CSV lalu coba lagi.'));document.head.appendChild(s)})}
function pDate(v){if(v==null||v==='')return today();const p=n=>String(n).padStart(2,'0');
 if(v instanceof Date)return `${v.getFullYear()}-${p(v.getMonth()+1)}-${p(v.getDate())}`;
 if(typeof v==='number'&&v>20000)return new Date(Math.round((v-25569)*864e5)).toISOString().slice(0,10);
 const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${p(m[2])}-${p(m[3])}`;
 m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);if(m)return `${m[3]}-${p(m[2])}-${p(m[1])}`;return null}
function buildRows(tb){if(tb.length<2)return{err:'File kosong atau hanya berisi header.'};
 const norm=s=>String(s==null?'':s).trim().toLowerCase(),H=tb[0].map(norm),ix={};
 for(const k in HMAP){ix[k]=H.findIndex(h=>HMAP[k].includes(h))}
 if(ix.name<0)return{err:'Kolom “Nama” tidak ditemukan. Gunakan template.'};
 const cats=Object.fromEntries((appState.categories||[]).map(c=>[c.toLowerCase(),c])),brs=Object.fromEntries((appState.branches||[]).map(b=>[b.toLowerCase(),b])),dvs=Object.fromEntries((appState.divisions||[]).map(d=>[d.toLowerCase(),d])),
  SM={baik:'Good',good:'Good',maintenance:'Maintenance',servis:'Maintenance',rusak:'Broken',broken:'Broken'},seen=new Set(AM.assets.map(a=>a.id)),ok=[],bad=[],warn=[];
 tb.slice(1).forEach((r,n)=>{const g=k=>ix[k]<0?'':r[ix[k]],line=n+2,e=[],wn=[],name=String(g('name')).trim(),cat=cats[norm(g('category'))],br=brs[norm(g('branch'))],dv=dvs[norm(g('division'))],date=pDate(g('date')),
  st=norm(g('status'))===''?'Good':SM[norm(g('status'))],price=Number(String(g('price')).replace(/[^\d]/g,''))||0,qty=Math.min(100000,Math.max(1,parseInt(g('qty'))||1)),id=String(g('id')).trim().replace(/[^\w-]/g,'');
  if(!name)e.push('Nama kosong');if(String(g('category')).trim()&&!cat)wn.push(`Kategori “${g('category')}” tidak dikenali`);if(String(g('branch')).trim()&&!br)wn.push(`Cabang “${g('branch')}” tidak dikenali`);if(String(g('division')).trim()&&!dv)wn.push(`Divisi “${g('division')}” tidak dikenali`);
  if(!date)e.push('Format tanggal tidak dikenali');if(!st)e.push(`Status “${g('status')}” tidak valid`);
  if(id){const ids=[id];if(ids.some(x=>seen.has(x)))e.push(`ID “${id}” sudah dipakai`);else if(!e.length)ids.forEach(x=>seen.add(x))}
  if(wn.length&&!e.length)warn.push({line,name,e:wn.join('; ')});e.length?bad.push({line,name,e:e.join('; ')}):ok.push({name,category:cat||'',branch:br||'',division:dv||'',date,price,status:st,qty,id})});
 return{ok,bad,warn}}
AM.tpl=function(){const c=(appState.categories||[])[0]||'PERALATAN',b=(appState.branches||[])[0]||'CABANG A',dv=(appState.divisions||[])[0]||'GA';
 const t=['ID (opsional),Nama,Kategori,Cabang,Divisi,Tanggal Perolehan,Harga,Status,Jumlah',`,Showcase Chiller,${c},${b},${dv},${today()},4500000,Baik,1`,`,Kursi Kasir,${c},${b},${dv},${today()},350000,Baik,5`,',Meja Kasir (kolom lain diisi nanti),,,,,,,'].join('\r\n');
 const l=document.createElement('a');l.href=URL.createObjectURL(new Blob(['\ufeff'+t],{type:'text/csv'}));l.download='template_upload_aset.csv';l.click()};
AM.bulk=function(){if(!isGA())return deny();AM._rows=null;
 Swal.fire({title:'Upload Aset Massal',width:680,background:'#22120a',color:'#fcf6f0',showCancelButton:true,confirmButtonText:'Impor',cancelButtonText:'Batal',confirmButtonColor:'#f4a23a',
  html:`<div class="text-left text-xs space-y-3"><p class="text-[#edd5b3]">Unggah file <b>.csv</b> atau <b>.xlsx</b>. Hanya kolom <b>Nama</b> yang wajib. Kolom lain (Kategori, Cabang, Divisi, Tanggal Perolehan, Harga, Status, Jumlah, ID) boleh dikosongkan dan diisi belakangan lewat <b>Isi Kolom</b> di Registry. Kategori/cabang/divisi yang tidak sama dengan Master Data akan dikosongkan.</p>
  <button type="button" onclick="AM.tpl()" class="px-3 py-2 rounded-lg bg-[#331d14] border border-white/10 text-[#e1b782] font-bold"><i class="fa-solid fa-download mr-1"></i>Unduh Template CSV</button>
  <input id="amFile" type="file" accept=".csv,.xlsx,.xls" class="block w-full text-xs file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#f4a23a] file:text-[#150a05] file:font-bold"><div id="amPrev"></div></div>`,
  didOpen:()=>{Swal.disableButtons();$('amFile').onchange=async e=>{const f=e.target.files[0],pv=$('amPrev');if(!f)return;pv.innerHTML='<p class="italic text-[#edd5b3]">Membaca file...</p>';AM._rows=null;Swal.disableButtons();
   try{let tb;if(/\.xlsx?$/i.test(f.name)){await loadXLSX();const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});tb=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''}).filter(r=>r.some(v=>String(v).trim()!==''))}else tb=parseCSV(await f.text());
    const r=buildRows(tb);if(r.err){pv.innerHTML=`<p class="text-rose-400 font-bold">${esc(r.err)}</p>`;return}
    const total=r.ok.reduce((s,x)=>s+x.qty,0);AM._rows=r.ok;
    pv.innerHTML=`<div class="p-3 bg-[#150a05] rounded-lg"><span class="text-emerald-400 font-bold">${r.ok.length} baris valid (${total} unit aset)</span>${r.bad.length?` · <span class="text-rose-400 font-bold">${r.bad.length} baris bermasalah (dilewati)</span>`:''}${r.warn.length?` · <span class="text-amber-400 font-bold">${r.warn.length} baris kategori/cabang/divisi tidak dikenali dikosongkan (baris ${r.warn.slice(0,5).map(x=>x.line).join(', ')}${r.warn.length>5?'…':''})</span>`:''}</div>
    ${r.ok.length?`<div class="overflow-x-auto max-h-40 mt-2"><table class="w-full text-[11px]"><tr class="text-[#e1b782] text-left"><th class="p-1">Nama</th><th>Cabang</th><th>Divisi</th><th>Harga</th><th>Jml</th></tr>${r.ok.slice(0,6).map(x=>`<tr class="border-t border-white/5"><td class="p-1">${esc(x.name)}</td><td>${esc(x.branch)||'—'}</td><td>${esc(x.division)||'—'}</td><td>${rp(x.price)}</td><td>${x.qty}</td></tr>`).join('')}</table>${r.ok.length>6?`<p class="text-[#edd5b3]/60 mt-1">…dan ${r.ok.length-6} baris lainnya</p>`:''}</div>`:''}
    ${r.bad.length?`<div class="mt-2 max-h-32 overflow-y-auto text-[11px] text-rose-300">${r.bad.slice(0,15).map(x=>`<div>Baris ${x.line}: ${esc(x.e)}</div>`).join('')}${r.bad.length>15?`<div>…dan ${r.bad.length-15} masalah lain</div>`:''}</div>`:''}`;
    if(r.ok.length){Swal.enableButtons();Swal.getConfirmButton().textContent=`Impor ${total} aset`}
   }catch(err){pv.innerHTML=`<p class="text-rose-400 font-bold">${esc(err.message||'Gagal membaca file.')}</p>`}}},
  preConfirm:()=>AM._rows}).then(async r=>{if(!r.isConfirmed||!r.value)return;let n=0,k=AM.assets.length+1;const ts=Date.now().toString(36).toUpperCase();
   r.value.forEach(x=>{let id=x.id||null;if(!id)do{id=`AST-U${ts}-${String(k++).padStart(4,'0')}`}while(find(id));
    const a={id,name:x.name,category:x.category,branch:x.branch,division:x.division,qty:x.qty,date:x.date,status:x.status,price:x.price,assigned:null,src:'upload|'+id,history:[]};hist(a,'Diimpor via upload massal');AM.assets.push(a);n+=x.qty});
   const ok=await save(true);Swal.fire(ok?{title:'Berhasil',text:`${r.value.length} baris aset (${n} unit) berhasil diimpor dan tersimpan ke cloud.`,icon:'success',...WN,background:'#22120a',color:'#fcf6f0'}:{title:'Belum tersimpan ke cloud',text:`${r.value.length} baris aset (${n} unit) masuk di perangkat ini, tetapi GAGAL disimpan ke cloud (${AM.cloudErr}). Jangan muat ulang halaman, hubungi admin / kirim pesan error ini.`,icon:'warning',...WN,background:'#22120a',color:'#fcf6f0'})})};


/* --- pilih banyak & isi kolom massal --- */
const inc=a=>!a.category||!a.branch||!a.price;AM.sel=new Set();
function selBar(){const k=AM.sel.size,e=$('amSel');if(!e)return;e.innerHTML=k?`<div class="glass-panel p-3 flex flex-wrap items-center gap-3 border border-dobah-400/30"><span class="text-xs font-bold text-dobah-300">${k} aset dipilih</span><button onclick="AM.fill()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-4 py-2"><i class="fa-solid fa-table-columns mr-1"></i>Isi Kolom</button><button onclick="AM.disposeSel()" class="modern-button bg-cocoa-800 text-amber-400 text-xs font-bold px-4 py-2 border border-amber-400/30"><i class="fa-solid fa-fire mr-1"></i>Musnahkan Terpilih</button><button onclick="AM.selAll(false)" class="modern-button bg-cocoa-800 text-dobah-200 text-xs font-bold px-4 py-2 border border-white/10">Batal Pilih</button></div>`:''}
AM.selOne=function(id,c){c?AM.sel.add(id):AM.sel.delete(id);regRows()};
AM.selAll=function(c){if(c)filtered().forEach(a=>AM.sel.add(a.id));else AM.sel.clear();regRows()};
AM.fill=async function(){if(!isGA())return deny();const ids=[...AM.sel].filter(id=>find(id));if(!ids.length)return;
 const c=await ask(`Isi Kolom untuk ${ids.length} aset`,[{k:'col',l:'Kolom yang diisi',opts:[['category','Kategori'],['branch','Cabang'],['division','Divisi'],['price','Harga per Unit'],['qty','Qty (jumlah unit)'],['date','Tanggal Perolehan'],['status','Status']]},{k:'mode',l:'Jika kolom sudah terisi (Kategori / Cabang / Divisi / Harga)',opts:[['empty','Lewati — hanya isi yang kosong'],['all','Timpa semua']]}],'Lanjut');if(!c)return;
 const F={category:{l:'Kategori',opts:(appState.categories||[]).map(x=>[x,x])},branch:{l:'Cabang',opts:(appState.branches||[]).map(x=>[x,x])},division:{l:'Divisi',opts:(appState.divisions||[]).map(x=>[x,x])},date:{l:'Tanggal Perolehan',t:'date',v:today()},price:{l:'Harga per Unit (Rp)',t:'number',v:0},qty:{l:'Qty (jumlah unit)',t:'number',v:1},status:{l:'Status',opts:[['Good','Baik'],['Maintenance','Maintenance'],['Broken','Rusak']]}}[c.col];
 if(F.opts&&!F.opts.length)return Swal.fire({title:'Master Data kosong',text:'Tambahkan dulu kategori/cabang di Master Data & Akun.',icon:'info',background:'#22120a',color:'#fcf6f0'});
 const r=await ask(F.l,[{k:'v',...F,req:1}],'Terapkan');if(!r)return;
 const only=['category','branch','division','price'].includes(c.col)&&c.mode==='empty';let n=0;
 ids.forEach(id=>{const a=find(id),emp=c.col==='price'?!a.price:!a[c.col];if(only&&!emp)return;if(c.col==='status'&&dead(a))return;
  const v=c.col==='price'?Number(r.v)||0:c.col==='qty'?Math.max(1,parseInt(r.v)||1):r.v;if(c.col==='qty'&&v<onLoan(a))return;a[c.col]=v;hist(a,`${F.l} diisi massal: ${c.col==='price'?rp(v):v}`);n++});
 AM.sel.clear();save();Swal.fire({title:'Selesai',text:`${n} dari ${ids.length} aset diperbarui.`,icon:'success',background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'})};

/* --- pemusnahan aset --- */
AM._ph={};
function cv(src,w,h){const k=Math.min(1,800/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(src,0,0,c.width,c.height);return c.toDataURL('image/jpeg',0.6)}
function shrink(f){return new Promise((ok,no)=>{const im=new Image(),u=URL.createObjectURL(f);im.onload=()=>{URL.revokeObjectURL(u);ok(cv(im,im.naturalWidth,im.naturalHeight))};im.onerror=()=>no(new Error('x'));im.src=u})}
async function savePhotos(list){const ids=[];for(const u of list){const id='PH-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);let ok=false;
 if(window.db){try{await window.fbDeps.setDoc(window.fbDeps.doc(window.db,'asset_photos',id),{data:u,ts:Date.now(),by:(user()||{}).name||''});ok=true}catch(e){}}
 if(!ok){try{localStorage.setItem('ga_ph_'+id,u);ok=true}catch(e){}}
 if(!ok)throw new Error('gagal simpan foto');AM._ph[id]=u;ids.push(id)}return ids}
async function getPhoto(id){if(AM._ph[id])return AM._ph[id];let u=null;try{u=localStorage.getItem('ga_ph_'+id)}catch(e){}
 if(!u&&window.db){try{const sn=await window.fbDeps.getDoc(window.fbDeps.doc(window.db,'asset_photos',id));if(sn.exists())u=sn.data().data}catch(e){}}
 if(u)AM._ph[id]=u;return u}
async function disposeAsk(title,avail){const f=[];if(avail!=null)f.push({k:'n',l:`Jumlah unit dimusnahkan (maks ${avail})`,t:'number',v:avail});
 f.push({k:'method',l:'Metode / jenis pelepasan',opts:[['Dimusnahkan','Dimusnahkan'],['Dijual','Dijual'],['Dihibahkan','Dihibahkan / disumbangkan'],['Hilang','Hilang / dicuri'],['Rusak Total','Rusak total (afkir)']]},{k:'date',l:'Tanggal pelepasan',t:'date',v:today()},{k:'reason',l:'Alasan',req:1});
 if(avail!=null)f.push({k:'proceeds',l:'Nilai jual / ganti rugi (Rp), opsional',t:'number',v:0});
 f.push({k:'witness',l:'Disaksikan / disetujui oleh'});
 const PH=[],MOB=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);let stream=null;const bc='px-3 py-2 rounded-lg bg-[#331d14] border border-white/10 text-[#e1b782] font-bold text-xs';
 const stop=()=>{if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}const v=$('phVid');if(v)v.classList.add('hidden')};
 const draw=()=>{$('phPrev').innerHTML=PH.map((u,i)=>`<div class="relative"><img src="${u}" class="w-20 h-20 object-cover rounded-lg border border-white/10"><button type="button" data-i="${i}" class="phx absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] leading-none">×</button></div>`).join('');document.querySelectorAll('.phx').forEach(b=>b.onclick=()=>{PH.splice(+b.dataset.i,1);draw()})};
 const add=async fs=>{for(const x of fs){if(PH.length>=3){Swal.showValidationMessage('Maksimal 3 foto');break}if(!/^image\//.test(x.type))continue;try{PH.push(await shrink(x))}catch(e){}}draw()};
 const X={html:`<div class="text-left mt-4"><label class="block text-xs font-bold mb-2 text-[#edd5b3]">Foto bukti pemusnahan * <span class="font-normal opacity-70">(wajib, maks. 3 foto)</span></label>
  <div class="flex gap-2"><button type="button" id="phCam" class="flex-1 ${bc}"><i class="fa-solid fa-camera mr-1"></i>Ambil Foto</button><button type="button" id="phFile" class="flex-1 ${bc}"><i class="fa-solid fa-folder-open mr-1"></i>Pilih dari File</button></div>
  <input id="phI1" type="file" accept="image/*" capture="environment" class="hidden"><input id="phI2" type="file" accept="image/*" multiple class="hidden">
  <div id="phVid" class="hidden mt-3"><video id="phV" autoplay playsinline muted class="w-full rounded-lg bg-black"></video><div class="flex gap-2 mt-2"><button type="button" id="phSnap" class="flex-1 ${bc}"><i class="fa-solid fa-circle-dot mr-1"></i>Jepret</button><button type="button" id="phStop" class="${bc}">Tutup kamera</button></div></div>
  <div id="phPrev" class="flex gap-2 mt-3 flex-wrap"></div></div>`,
  open:()=>{$('phI1').onchange=e=>{add([...e.target.files]);e.target.value=''};$('phI2').onchange=e=>{add([...e.target.files]);e.target.value=''};$('phFile').onclick=()=>$('phI2').click();$('phStop').onclick=stop;
   $('phCam').onclick=async()=>{if(MOB||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return $('phI1').click();
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});$('phV').srcObject=stream;$('phVid').classList.remove('hidden')}catch(e){$('phI1').click()}};
   $('phSnap').onclick=()=>{const v=$('phV');if(!v.videoWidth)return;if(PH.length>=3)return Swal.showValidationMessage('Maksimal 3 foto');PH.push(cv(v,v.videoWidth,v.videoHeight));draw();stop()}},
  close:stop,check:()=>PH.length?'':'Foto bukti pemusnahan wajib dilampirkan (kamera atau file)'};
 const r=await ask(title,f,'Musnahkan',X);if(r)r._ph=PH.slice();return r}
function dispose(a,n,r){const info={method:r.method,date:r.date||today(),reason:r.reason,proceeds:Number(r.proceeds)||0,witness:r.witness||'',by:(user()||{}).name||'',qty:n,photos:r.photos||[]},
 txt=`${n} unit — ${r.method}: ${r.reason}${info.proceeds?' (nilai '+rp(info.proceeds)+')':''}${r.witness?', disaksikan '+r.witness:''}`;
 if(n<q(a)){let id,x=2;do{id=`${a.id}-X${x++}`}while(find(id));const b={...a,id,qty:n,status:'Disposed',disposal:info,history:[]};a.qty=q(a)-n;hist(a,`Pemusnahan sebagian: ${txt} → ${id}`);hist(b,`Dimusnahkan dari ${a.id}: ${txt}`);AM.assets.push(b)}
 else{a.status='Disposed';a.disposal=info;hist(a,'Pemusnahan: '+txt)}}
AM.disposeSel=async function(){if(!isGA())return deny();const L=[...AM.sel].map(find).filter(a=>a&&!dead(a));if(!L.length)return;
 const r=await disposeAsk(`Pemusnahan ${L.length} aset terpilih`,null);if(!r)return;
 if(!(await confirmBox(`Musnahkan ${L.length} aset?`,'Seluruh unit tiap aset dimusnahkan. Unit yang sedang dipinjam tidak ikut dimusnahkan.')))return;
 try{r.photos=await savePhotos(r._ph)}catch(e){return Swal.fire({title:'Foto gagal disimpan',text:'Periksa koneksi lalu coba lagi. Pemusnahan dibatalkan.',icon:'error',background:'#22120a',color:'#fcf6f0'})}
 let ok=0,skip=0;L.forEach(a=>{const av=q(a)-onLoan(a);if(av<1){skip++;return}dispose(a,av,r);ok++});
 AM.sel.clear();save();Swal.fire({title:'Selesai',text:`${ok} aset dimusnahkan${skip?`, ${skip} dilewati karena masih dipinjam`:''}.`,icon:ok?'success':'info',background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'})};

/* --- kosongkan registry --- */
AM.reset=async function(){if(!isGA())return deny();const n=AM.assets.length,l=AM.loans.length,W={background:'#22120a',color:'#fcf6f0'};
 if(!n&&!l)return Swal.fire({title:'Registry sudah kosong',icon:'info',...W,confirmButtonColor:'#f4a23a'});
 const r=await Swal.fire({title:'Kosongkan Data Registry?',html:`<div class="text-left text-xs space-y-2"><p>Menghapus permanen <b>${n} baris aset</b> (${sq(AM.assets)} unit), <b>${l} data peminjaman</b>, seluruh riwayat, dan foto bukti pemusnahan.</p><p>Data vendor, umur ekonomis, dan pengajuan permintaan <b>tidak</b> ikut terhapus. File cadangan (.json) diunduh otomatis sebelum data dihapus.</p><p>Ketik <b>KOSONGKAN</b> untuk melanjutkan:</p></div>`,input:'text',inputPlaceholder:'KOSONGKAN',showCancelButton:true,confirmButtonText:'Kosongkan',cancelButtonText:'Batal',...W,confirmButtonColor:'#e11d48',
  preConfirm:v=>{if((v||'').trim()!=='KOSONGKAN'){Swal.showValidationMessage('Ketik KOSONGKAN untuk konfirmasi');return false}return true}});
 if(!r.isConfirmed)return;
 try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),assets:AM.assets,loans:AM.loans},null,1)],{type:'application/json'}));a.download=`backup_registry_aset_${today()}.json`;a.click()}catch(e){}
 const ids=AM.assets.flatMap(a=>(a.disposal&&a.disposal.photos)||[]);
 for(const id of ids){try{localStorage.removeItem('ga_ph_'+id)}catch(e){}if(window.db){try{await window.fbDeps.deleteDoc(window.fbDeps.doc(window.db,'asset_photos',id))}catch(e){}}}
 AM._ph={};AM.assets=[];AM.loans=[];AM.market=[];AM.incidents=[];AM.sel.clear();AM.f={q:'',loc:'',st:'',div:'',page:1};
 await save();Swal.fire({title:'Registry dikosongkan',text:'Seluruh data aset dan peminjaman sudah dihapus.',icon:'success',...W,confirmButtonColor:'#f4a23a'})};
