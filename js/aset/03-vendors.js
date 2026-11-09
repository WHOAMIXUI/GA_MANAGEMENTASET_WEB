/* Modul Aset: vendors  (dimuat berurutan setelah file sebelumnya; berbagi scope global dengan modul aset lainnya) */
/* --- manajemen vendor: berkontrak & tanpa kontrak --- */
const vt=v=>(v.type==='none'||(!v.type&&!v.expiry))?'none':'contract';
function vcard(v){const ga=isGA(),n=vt(v)==='none';let b;
 if(n)b=`<span class="px-2 py-1 text-[10px] font-bold rounded border bg-slate-500/10 text-slate-300 border-slate-500/30 whitespace-nowrap">Tanpa Kontrak</span>`;
 else{const d=days(v.expiry),c=d<0?'rose':d<=60?'amber':'emerald';b=`<span class="px-2 py-1 text-[10px] font-bold rounded border bg-${c}-500/10 text-${c}-400 border-${c}-500/20 whitespace-nowrap">${d<0?'Kontrak berakhir':d+' hari lagi'}</span>`}
 return `<div class="glass-panel p-5"><div class="flex justify-between items-start gap-2"><h3 class="font-bold text-white text-sm">${esc(v.name)}</h3>${b}</div>
 <p class="text-xs text-dobah-200/80 mt-2">${esc(v.service)}</p>
 ${v.phone?`<p class="text-xs text-dobah-200/60 mt-2"><i class="fa-solid fa-phone mr-1"></i>${esc(v.phone)}</p>`:''}
 ${n?`<p class="text-xs text-dobah-200/60 mt-1"><i class="fa-solid fa-file-circle-xmark mr-1"></i>Tidak terikat kontrak (per panggilan / per pekerjaan)</p>`
 :`<p class="text-xs text-dobah-200/60 mt-1"><i class="fa-regular fa-calendar mr-1"></i>${v.start?esc(v.start)+' s/d '+esc(v.expiry):'Kontrak s/d '+esc(v.expiry)}</p>${v.contractNo?`<p class="text-xs text-dobah-200/60 mt-1"><i class="fa-solid fa-file-signature mr-1"></i>No. ${esc(v.contractNo)}</p>`:''}`}
 ${v.note?`<p class="text-[11px] text-dobah-200/60 mt-2 italic">${esc(v.note)}</p>`:''}
 ${ga?`<div class="mt-3">${btn(`AM.vendor('${v.id}')`,'fa-pen','Edit')}${btn(`AM.delVendor('${v.id}')`,'fa-trash','Hapus','text-rose-400')}</div>`:''}</div>`}
function venGrid(){const el=$('amVenGrid');if(!el)return;const f=AM.vf,qq=(f.q||'').toLowerCase();
 const L=AM.vendors.filter(v=>(f.t==='all'||vt(v)===f.t)&&(!qq||((v.name||'')+' '+(v.service||'')).toLowerCase().includes(qq)));
 el.innerHTML=L.length?L.map(vcard).join(''):'<div class="glass-panel p-10 text-center text-dobah-200/50 italic md:col-span-2 xl:col-span-3">Tidak ada vendor pada filter ini.</div>'}
function ven(){const ga=isGA(),V=AM.vendors,f=AM.vf,nC=V.filter(v=>vt(v)==='contract').length,nN=V.length-nC,soon=V.filter(v=>vt(v)==='contract'&&v.expiry&&days(v.expiry)<=60).length;
 const tabs=[['all','Semua ('+V.length+')'],['contract','Berkontrak ('+nC+')'],['none','Tanpa Kontrak ('+nN+')']].map(([k,l])=>`<button onclick="AM.vTab('${k}')" class="modern-button text-xs font-bold px-4 py-2 border ${f.t===k?'bg-dobah-400 text-cocoa-950 border-dobah-400':'bg-cocoa-800 text-dobah-200 border-white/10'}">${l}</button>`).join('');
 $('view-aven').innerHTML=`<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">${kpi('Total Vendor',V.length,'fa-handshake')}${kpi('Berkontrak',nC,'fa-file-signature','emerald')}${kpi('Tanpa Kontrak',nN,'fa-file-circle-xmark','slate')}${kpi('Kontrak ≤ 60 hari',soon,'fa-hourglass-half','amber')}</div>
 <div class="flex flex-wrap justify-between items-center gap-3"><div class="flex gap-2 flex-wrap">${tabs}</div><div class="flex gap-2"><button onclick="AM.vExport()" class="modern-button bg-cocoa-800 text-dobah-200 border border-white/10 text-xs font-bold px-4 py-2"><i class="fa-solid fa-file-excel mr-1"></i>Download Excel</button>${ga?`<button onclick="AM.vendor()" class="modern-button bg-dobah-400 text-cocoa-950 text-xs font-bold px-4 py-2"><i class="fa-solid fa-plus mr-1"></i>Tambah Vendor</button>`:''}</div></div>
 <div class="glass-panel p-4"><input placeholder="Cari nama vendor / layanan..." value="${esc(f.q)}" oninput="AM.vQ(this.value)" class="w-full glass-input px-3.5 py-2 text-xs sm:text-sm font-semibold"></div>
 <div id="amVenGrid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>`;venGrid()}
AM.vTab=function(k){AM.vf.t=k;ven()};
AM.vQ=function(v){AM.vf.q=v;venGrid()};
