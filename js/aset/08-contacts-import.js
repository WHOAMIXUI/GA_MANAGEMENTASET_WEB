/* Modul Aset: upload massal kontak sales (XLSX / CSV) */
/* --- upload massal kontak sales (XLSX / CSV) + template --- */
const CMAP={type:['jenis','tipe','type','kategori'],name:['nama sales','nama','nama kontak','nama sales / kontak','name'],company:['perusahaan','company','pemilik','agen','perusahaan / pemilik / agen','instansi'],offer:['penawaran','yang ditawarkan','tawaran','offer','yang ditawarkan (lokasi, mesin, harga, dll)'],phone:['telepon / whatsapp','telepon','telp','no hp','no. hp','hp','wa','whatsapp','phone'],email:['email','e-mail'],area:['alamat / area','alamat','area','lokasi'],status:['status','status follow-up','status follow up'],last:['kontak terakhir','tanggal kontak terakhir','tgl kontak terakhir','last contact'],note:['catatan','note','keterangan']};
const CHEAD=['Jenis','Nama Sales','Perusahaan','Penawaran','Telepon / WhatsApp','Email','Alamat / Area','Status','Kontak Terakhir','Catatan'];
const cPhone=v=>{if(v==null||v==='')return '';if(typeof v==='number'){const t=String(Math.round(v));return t.startsWith('8')?'0'+t:t}return String(v).trim()};
function buildContacts(tb){if(tb.length<2)return{err:'File kosong atau hanya berisi header.'};
 const norm=x=>String(x==null?'':x).trim().toLowerCase().replace(/\s+/g,' '),H=tb[0].map(norm),ix={};
 for(const k in CMAP)ix[k]=H.findIndex(h=>CMAP[k].includes(h));
 if(ix.name<0)return{err:'Kolom “Nama Sales” tidak ditemukan. Gunakan template.'};
 const types={};ctList().forEach(t=>{types[norm(t.label)]=t.id;types[norm(t.id)]=t.id});
 const stats={};Object.entries(CS).forEach(([k,v])=>{stats[norm(k)]=k;stats[norm(v[0])]=k});
 const dk=c=>norm(c.name)+'|'+(String(c.phone||'').replace(/\D/g,'')||norm(c.email));
 const seen=new Set(AM.contacts.map(dk)),ok=[],bad=[],dup=[];
 tb.slice(1).forEach((r,n)=>{const g=k=>ix[k]<0?'':r[ix[k]],line=n+2,e=[],name=String(g('name')).trim(),phone=cPhone(g('phone')),email=String(g('email')).trim(),
  tRaw=String(g('type')).trim(),type=types[norm(tRaw)],sRaw=String(g('status')).trim(),status=sRaw?stats[norm(sRaw)]:'baru',last=pDate(g('last'));
  if(!name)e.push('Nama kosong');if(!phone&&!email)e.push('Isi minimal telepon atau email');
  if(!tRaw)e.push('Jenis kosong');else if(!type)e.push(`Jenis “${tRaw}” tidak dikenali (lihat sheet Petunjuk di template)`);
  if(!status)e.push(`Status “${sRaw}” tidak valid`);if(!last)e.push('Format tanggal kontak terakhir tidak dikenali');
  const c={type,name,company:String(g('company')).trim(),offer:String(g('offer')).trim(),phone,email,area:String(g('area')).trim(),status,last:last||'',note:String(g('note')).trim()};
  if(e.length)return bad.push({line,name,e:e.join('; ')});
  const key=dk(c);if(seen.has(key))return dup.push({line,name});seen.add(key);ok.push(c)});
 return{ok,bad,dup}}
AM.cTpl=async function(){try{await loadXLSX()}catch(e){return Swal.fire({title:'Gagal memuat pustaka Excel',text:'Periksa koneksi internet lalu coba lagi.',icon:'error',background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'})}
 const T=ctList(),t0=(T[0]||{label:'Sales Mesin'}).label,t1=(T[1]||T[0]||{label:'Sales Mesin'}).label;
 const ws=XLSX.utils.aoa_to_sheet([CHEAD,[t0,'Budi Santoso','PT Contoh Mesin Jaya','Mesin donat otomatis 2 jalur, Rp 45.000.000','081234567890','budi@contoh.com','Bandung','Baru',today(),'Contoh baris, hapus sebelum upload'],[t1,'Ibu Sari','Agen Properti Sejahtera','Ruko 2 lantai 120 m², sewa Rp 60 jt/tahun','6281298765432','','Jl. Contoh No. 10, Bogor','Negosiasi',today(),'']]);
 ws['!cols']=[24,22,26,40,22,24,30,16,16,34].map(w=>({wch:w}));
 ['E2','E3'].forEach(a=>{if(ws[a])ws[a].t='s'});
 const guide=[['PETUNJUK PENGISIAN'],[''],['Kolom wajib','Nama Sales, Jenis, dan minimal salah satu dari Telepon / Email'],['Telepon','Boleh format 08xx atau 62xx. Agar angka 0 di depan tidak hilang, format kolom sebagai Teks'],['Kontak Terakhir','Format YYYY-MM-DD atau DD/MM/YYYY. Kosong = hari ini'],['Kontak ganda','Nama + telepon (atau email) yang sudah ada akan dilewati'],[''],['JENIS YANG VALID (kelola di Master Data & Akun)']].concat(T.map(t=>[t.label])).concat([[''],['STATUS YANG VALID']]).concat(Object.values(CS).map(v=>[v[0]]));
 const g=XLSX.utils.aoa_to_sheet(guide);g['!cols']=[{wch:22},{wch:80}];
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Template');XLSX.utils.book_append_sheet(wb,g,'Petunjuk');XLSX.writeFile(wb,'template-upload-kontak-sales.xlsx')};
AM.cBulk=function(){if(!isGA())return deny();AM._crows=null;
 if(!ctList().length)return Swal.fire({title:'Belum ada jenis kontak',text:'Tambahkan dulu di Master Data & Akun, bagian “Jenis kontak sales”.',icon:'info',background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'});
 Swal.fire({title:'Upload Kontak Sales Massal',width:700,background:'#22120a',color:'#fcf6f0',showCancelButton:true,confirmButtonText:'Impor',cancelButtonText:'Batal',confirmButtonColor:'#f4a23a',
  html:`<div class="text-left text-xs space-y-3"><p class="text-[#edd5b3]">Unggah file <b>.xlsx</b> atau <b>.csv</b>. Wajib diisi: <b>Nama Sales</b>, <b>Jenis</b>, dan minimal <b>Telepon</b> atau <b>Email</b>. Jenis harus sama dengan daftar di Master Data (lihat sheet <b>Petunjuk</b> di template). Kontak yang sudah ada (nama + telepon sama) otomatis dilewati.</p>
  <button type="button" onclick="AM.cTpl()" class="px-3 py-2 rounded-lg bg-[#331d14] border border-white/10 text-[#e1b782] font-bold"><i class="fa-solid fa-download mr-1"></i>Unduh Template Excel</button>
  <input id="amCFile" type="file" accept=".xlsx,.xls,.csv" class="block w-full text-xs file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#f4a23a] file:text-[#150a05] file:font-bold"><div id="amCPrev"></div></div>`,
  didOpen:()=>{Swal.disableButtons();$('amCFile').onchange=async e=>{const f=e.target.files[0],pv=$('amCPrev');if(!f)return;pv.innerHTML='<p class="italic text-[#edd5b3]">Membaca file...</p>';AM._crows=null;Swal.disableButtons();
   try{let tb;if(/\.xlsx?$/i.test(f.name)){await loadXLSX();const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});tb=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''}).filter(r=>r.some(v=>String(v).trim()!==''))}else tb=parseCSV(await f.text());
    const r=buildContacts(tb);if(r.err){pv.innerHTML=`<p class="text-rose-400 font-bold">${esc(r.err)}</p>`;return}
    AM._crows=r.ok;
    pv.innerHTML=`<div class="p-3 bg-[#150a05] rounded-lg"><span class="text-emerald-400 font-bold">${r.ok.length} kontak valid</span>${r.bad.length?` · <span class="text-rose-400 font-bold">${r.bad.length} baris bermasalah (dilewati)</span>`:''}${r.dup.length?` · <span class="text-amber-400 font-bold">${r.dup.length} kontak sudah ada (dilewati)</span>`:''}</div>
    ${r.ok.length?`<div class="overflow-x-auto max-h-40 mt-2"><table class="w-full text-[11px]"><tr class="text-[#e1b782] text-left"><th class="p-1">Nama</th><th>Jenis</th><th>Perusahaan</th><th>Kontak</th></tr>${r.ok.slice(0,6).map(x=>`<tr class="border-t border-white/5"><td class="p-1">${esc(x.name)}</td><td>${esc(ctInfo(x.type)[0])}</td><td>${esc(x.company)||'—'}</td><td>${esc(x.phone||x.email)}</td></tr>`).join('')}</table>${r.ok.length>6?`<p class="text-[#edd5b3]/60 mt-1">…dan ${r.ok.length-6} baris lainnya</p>`:''}</div>`:''}
    ${r.bad.length?`<div class="mt-2 max-h-32 overflow-y-auto text-[11px] text-rose-300">${r.bad.slice(0,15).map(x=>`<div>Baris ${x.line}${x.name?' ('+esc(x.name)+')':''}: ${esc(x.e)}</div>`).join('')}${r.bad.length>15?`<div>…dan ${r.bad.length-15} masalah lain</div>`:''}</div>`:''}`;
    if(r.ok.length){Swal.enableButtons();Swal.getConfirmButton().textContent=`Impor ${r.ok.length} kontak`}
   }catch(err){pv.innerHTML=`<p class="text-rose-400 font-bold">${esc(err.message||'Gagal membaca file.')}</p>`}}},
  preConfirm:()=>AM._crows}).then(async r=>{if(!r.isConfirmed||!r.value)return;const t=Date.now(),pre=t.toString(36).toUpperCase();
   r.value.forEach((c,i)=>AM.contacts.push({id:`CTK-${pre}${String(i).padStart(3,'0')}`,ts:t+i,...c}));
   const ok=await save(true),W={background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'};
   Swal.fire(ok?{title:'Berhasil',text:`${r.value.length} kontak sales berhasil diimpor.`,icon:'success',...W}:{title:'Belum tersimpan ke cloud',text:`${r.value.length} kontak masuk di perangkat ini, tetapi GAGAL disimpan ke cloud (${AM.cloudErr}). Jangan muat ulang halaman, hubungi admin.`,icon:'warning',...W})})};
AM.vExport=function(){const V=AM.vendors.slice();
 if(!V.length)return Swal.fire({title:'Belum ada data vendor',icon:'info',background:'#22120a',color:'#fcf6f0',confirmButtonColor:'#f4a23a'});
 return xlsDownload('data-vendor','Vendor',['Nama Vendor','Layanan','Telepon','Status Kerja Sama','No. Kontrak','Kontrak Mulai','Kontrak Berakhir','Sisa Hari','Catatan'],
  V.map(v=>{const n=vt(v)==='none';return [v.name||'',v.service||'',v.phone||'',n?'Tanpa Kontrak':'Berkontrak',n?'':(v.contractNo||''),n?'':(v.start||''),n?'':(v.expiry||''),(!n&&v.expiry)?days(v.expiry):'',v.note||'']}),[28,28,18,18,20,16,18,10,40])};
AM.setLife=function(c,v){if(!isGA())return;AM.life[c]=Math.max(1,Number(v)||5);save()};
AM.pg=function(d){const tp=Math.max(1,Math.ceil(filtered().length/AM.size));AM.f.page=Math.min(tp,Math.max(1,AM.f.page+d));regRows()};
AM.goBranch=function(b){AM.f.loc=b;AM.f.page=1;switchTab('areg')};
AM.sync=function(){if(!isGA())return deny();syncReq()};
AM.csv=function(){const q=s=>'"'+String(s==null?'':s).replace(/"/g,'""')+'"',L=filtered();
 const t=['ID,Nama,Kategori,Cabang,Divisi,Qty,Tgl Perolehan,Harga / Unit,Nilai Buku,Status,Dipinjam Oleh,Metode Pemusnahan,Tgl Pemusnahan,Alasan Pemusnahan'].concat(L.map(a=>[a.id,a.name,a.category,a.branch,a.division||'',q(a),a.date,a.price,Math.round(dep(a).book),ST[a.status][1],AM.loans.filter(l=>l.assetId===a.id&&!l.returnedAt).map(l=>l.name+' ('+l.qty+')').join('; '),(a.disposal||{}).method||'',(a.disposal||{}).date||'',(a.disposal||{}).reason||''].map(q).join(','))).join('\n');
 const l=document.createElement('a');l.href=URL.createObjectURL(new Blob(['\ufeff'+t],{type:'text/csv'}));l.download='registry_aset.csv';l.click()};
