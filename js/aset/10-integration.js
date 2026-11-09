/* Modul Aset: integration  (dimuat berurutan setelah file sebelumnya; berbagi scope global dengan modul aset lainnya) */
/* --- integrasi dengan aplikasi permintaan --- */
const TABS=['form','list','master','adash','areg','amap','amtc','ainc','adep','aasg','amkt','aven','acon'],GA_ONLY=['master','adep','aasg','amkt','aven','acon'],
 TT={form:'Buat Permintaan Aset',list:'Dashboard & Status Pengajuan Tiket',master:'Master Data & Akun',adash:'Dashboard Aset',areg:'Registry Aset',amap:'Pemetaan Cabang',amtc:'Maintenance Aset',ainc:'Aset Rusak & Hilang',adep:'Depresiasi & Nilai Buku',aasg:'Peminjaman Aset',amkt:'Jual Beli Aset Antar Toko',aven:'Manajemen Vendor',acon:'Kontak Sales & Penawaran'};
window.switchTab=function(t){const s=user();if(s&&s.role==='Staff Store'&&GA_ONLY.includes(t)){Swal.fire({title:'Akses Dibatasi',text:'Menu ini hanya untuk GA Manager.',icon:'warning',background:'#22120a',color:'#fcf6f0'});return}
 appState.activeTab=t;TABS.forEach(x=>{$('view-'+x).classList.add('hidden');$('tab-'+x).className=NAV_IDLE_CLS});$('view-'+t).classList.remove('hidden');$('tab-'+t).className=NAV_ACTIVE_CLS;
 const pt=$('page-title');if(pt)pt.textContent=TT[t]||'';const wb=$('welcomeBanner');if(wb)wb.style.display=(t==='list')?'none':'';if(window.innerWidth<768)toggleSidebar(false);
 if(t==='list'){applyTableFilters();updateMetrics()}else if(t==='master')renderMasterDataView();else if(R[t])R[t]()};
const _chk=window.checkUserSession;window.checkUserSession=function(){_chk();const st=(user()||{}).role==='Staff Store';['adep','aasg','amkt','aven','acon'].forEach(x=>{const b=$('tab-'+x);if(b)b.style.display=st?'none':'flex'});renderActive();NC.start()};
