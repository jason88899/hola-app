/* Read-only "what's in stock today" view for salesmen. No prices anywhere in
   this file -- the backing view (v_stok_tersedia) doesn't expose a price
   column at all, so there's nothing here to accidentally leak. */

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('id-ID');
const num = v => nf.format(Math.round(Number(v) || 0));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const namaBarang = b => [b.merek, b.tipe, b.ukuran, b.warna].filter(Boolean).join(' ') || b.sku || '—';
const slugify = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const CFG = window.BUKUGUDANG_CONFIG || {};
const K_DEVICE = 'bukugudang.perangkat';

// A stable id for this phone/browser, sent on every request. The server
// only serves stock to devices Master has approved, so a leaked login is
// useless on someone else's device.
function deviceId() {
  let id = null;
  try { id = localStorage.getItem(K_DEVICE); } catch (e) {}
  if (!id) {
    id = crypto.randomUUID();
    try { localStorage.setItem(K_DEVICE, id); } catch (e) {}
  }
  return id;
}
let sb = null;
let rows = [];

async function initSupabase() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  // Sessions persist here on purpose: each salesman has their own individual
  // account (unlike the desktop app's shared Master/Admin passwords), this
  // view is read-only, and it carries no price/financial data -- so staying
  // logged in on a salesman's own phone is a normal, low-risk convenience.
  sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
    global: { headers: { 'x-device-id': deviceId() } }
  });
}

function wireLogin() {
  $('btnLogin').onclick = doLogin;
  $('loginPassword').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
  // Enter on the name jumps to the password instead of submitting nothing.
  $('loginId').onkeydown = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if ($('loginPassword').value) doLogin(); else $('loginPassword').focus();
  };
}

async function doLogin() {
  const idRaw = $('loginId').value.trim();
  const password = $('loginPassword').value;
  if (!idRaw || !password) return;
  if (!sb) { setHint('Belum siap menyambung, coba lagi sesaat lagi.', true); return; }
  $('btnLogin').disabled = true;
  setHint('Menyambung…', false);
  const email = `sales-${slugify(idRaw)}@internal.bukugudang.app`;
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const izin = await cekPerangkat(data.user, idRaw);
    if (!izin.ok) {
      await sb.auth.signOut();
      setHint(izin.pesan, true);
      return;
    }
    $('loginPassword').value = '';
    await enterApp();
  } catch (e) {
    setHint('Nama atau kata sandi salah.', true);
  } finally {
    $('btnLogin').disabled = false;
  }
}

// This phone has to be approved by Master before it sees any stock. An
// unknown one registers itself (with a name the salesman types, so Master
// knows whose phone it is) and waits.
async function cekPerangkat(user, namaLogin) {
  const did = deviceId();
  let hasil = 'DITOLAK', pesan = '';
  try {
    const { data: rows } = await sb.from('perangkat').select('status')
      .eq('user_id', user.id).eq('device_id', did).limit(1);
    const status = rows && rows[0] ? rows[0].status : null;

    if (status === 'APPROVED') {
      hasil = 'OK';
    } else if (status === 'BLOCKED') {
      hasil = 'DIBLOKIR';
      pesan = 'HP ini diblokir. Hubungi Master.';
    } else {
      hasil = 'MENUNGGU';
      if (!status) {
        const label = (window.prompt('HP ini belum terdaftar. Beri nama supaya Master tahu ini HP siapa:', 'HP ' + namaLogin) || '').trim();
        await sb.from('perangkat').insert({
          device_id: did, nama: namaLogin.trim(), label: label || 'Tanpa nama'
        });
        pesan = 'HP ini didaftarkan dan menunggu persetujuan Master. Coba masuk lagi setelah disetujui.';
      } else {
        pesan = 'HP ini masih menunggu persetujuan Master.';
      }
    }
    await sb.from('log_masuk').insert({ nama: namaLogin.trim(), device_id: did, hasil });
  } catch (e) {
    return { ok: false, pesan: 'Tidak bisa memeriksa izin HP: ' + (e.message || e) };
  }
  return hasil === 'OK' ? { ok: true } : { ok: false, pesan };
}
function setHint(msg, bad) {
  $('loginHint').textContent = msg;
  $('loginHint').className = 'hint' + (bad ? ' bad' : '');
}

async function doLogout() {
  if (penyegar) { clearInterval(penyegar); penyegar = null; }
  if (pengawas) { clearInterval(pengawas); pengawas = null; }
  try { await sb.auth.signOut(); } catch (e) { /* ignore */ }
  rows = [];
  $('appShell').hidden = true;
  $('loginScreen').hidden = false;
  setHint('', false);
}

async function enterApp() {
  $('loginScreen').hidden = true;
  $('appShell').hidden = false;
  siapkanKatalog();
  await muatStok();
  mulaiPenyegar();
  mulaiPengawasSesi();
}

// Same as the desktop app: when Master changes this account (a location
// added or taken away, the phone blocked, the account deleted) the open
// page must not keep showing what was true at login. The server already
// refuses the old scope on the next read; this makes that visible by
// sending the salesman back to the login screen with a reason.
let pengawas = null, metaAwal = null;
function mulaiPengawasSesi() {
  if (pengawas) clearInterval(pengawas);
  metaAwal = null;
  pengawas = setInterval(async () => {
    if (!navigator.onLine) return;
    try {
      const { data, error } = await sb.auth.getUser();
      if (error || !data?.user) { await paksaKeluar('Sesi Anda sudah tidak berlaku. Silakan masuk kembali.'); return; }
      const meta = JSON.stringify(data.user.app_metadata || {});
      if (metaAwal === null) { metaAwal = meta; return; }
      if (meta !== metaAwal) await paksaKeluar('Akses Anda baru saja diubah oleh Master. Silakan masuk kembali.');
    } catch (e) { /* transient -- next tick */ }
  }, 15000);
}
async function paksaKeluar(pesan) {
  await doLogout();
  setHint(pesan, true);
}

// A salesman may keep the page open for hours: without this the numbers he
// quotes are whatever was true when he logged in.
let penyegar = null, stempelTerakhir = null;
function mulaiPenyegar() {
  if (penyegar) clearInterval(penyegar);
  stempelTerakhir = null;
  penyegar = setInterval(async () => {
    if (!navigator.onLine) return;
    try {
      const { data, error } = await sb.rpc('stempel_data');
      if (error || typeof data !== 'string') return;
      if (stempelTerakhir === null) { stempelTerakhir = data; return; }
      if (data === stempelTerakhir) return;
      stempelTerakhir = data;
      await muatStok();
    } catch (e) { /* next tick */ }
  }, 20000);
}
// Supabase answers at most 1,000 rows per request (the API's default
// "max rows"), silently. The ledger passes that within days, and a single
// select would then drop the newest entries without a word. Anything that
// can grow is read page by page, until a page comes back empty -- that works
// whatever the server's cap happens to be. `buat` returns a fresh query each
// time (a query builder can only be sent once) with a stable order.
async function ambilSemua(buat, ukuran = 1000) {
  const semua = [];
  for (let dari = 0; ; ) {
    const { data, error } = await buat().range(dari, dari + ukuran - 1);
    if (error) return { data: null, error };
    if (!data || !data.length) return { data: semua, error: null };
    semua.push(...data);
    dari += data.length;
  }
}
async function muatStok() {
  const { data, error } = await ambilSemua(() => sb.from('v_stok_tersedia').select('*').order('sku').order('lokasi_urutan').order('lokasi_id'));
  if (error) {
    $('list').innerHTML = `<div class="empty"><b>Tidak bisa memuat stok</b>${esc(error.message)}</div>`;
    return;
  }
  rows = data || [];
  render();
}

// Narrowing by attribute: pick a brand and the other dropdowns only offer
// what that brand actually has (sizes, colours...), the same way the
// desktop's item filters work. Each dropdown lists the values that exist
// among items matching every OTHER active filter.
const FILTER = [['fKategori', 'kategori', 'Semua kategori'], ['fMerek', 'merek', 'Semua merek'],
  ['fTipe', 'tipe', 'Semua tipe'], ['fUkuran', 'ukuran', 'Semua ukuran'], ['fWarna', 'warna', 'Semua warna']];
const nilaiFilter = () => Object.fromEntries(FILTER.map(([id, k]) => [k, $(id).value]));
const cocokFilter = (it, f, kecuali) => FILTER.every(([, k]) => k === kecuali || !f[k] || String(it[k] ?? '').trim() === f[k]);
function isiFilter(items) {
  const f = nilaiFilter();
  FILTER.forEach(([id, k, label]) => {
    const ada = [...new Set(items.filter(it => cocokFilter(it, f, k)).map(it => String(it[k] ?? '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    const sel = $(id);
    const cur = ada.includes(f[k]) ? f[k] : '';
    sel.innerHTML = `<option value="">${esc(label)}</option>` + ada.map(v => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
    sel.classList.toggle('on', !!cur);
    // hide a dropdown that has nothing to offer (e.g. no categories set)
    sel.hidden = !ada.length && !cur;
  });
  $('btnResetFilter').hidden = !FILTER.some(([id]) => $(id).value);
}
function semuaItem() {
  const byItem = new Map();
  rows.forEach(r => {
    if (!byItem.has(r.barang_id)) byItem.set(r.barang_id, { ...r, lokasi: [] });
    byItem.get(r.barang_id).lokasi.push({ nama: r.lokasi_nama, stok: r.stok, lebih: r.lebih });
  });
  // Any location capped at 50 makes the item's total a '+' figure too.
  return [...byItem.values()].map(it => ({
    ...it,
    total: it.lokasi.reduce((s, l) => s + Number(l.stok), 0),
    lebih: it.lokasi.some(l => l.lebih)
  }));
}
// The printed catalogue, as page images, at the very top: a strip of
// pages to flick through, tap one to read it full screen. Pure static
// files -- swap the images in /katalog and bump HALAMAN to update it.
const KATALOG = { judul: 'Katalog Colorado 2026', halaman: 11, berkas: n => `katalog/hal-${String(n).padStart(2, '0')}.jpg` };
let ekSiap = false;
function siapkanKatalog() {
  if (ekSiap) return; ekSiap = true;
  $('ekJudul').textContent = KATALOG.judul;
  $('ekViewerJudul').textContent = KATALOG.judul;
  $('ekSub').textContent = `${KATALOG.halaman} halaman · ketuk untuk membaca`;
  const n = KATALOG.halaman;
  $('ekStrip').innerHTML = Array.from({ length: n }, (_, i) => i + 1).map(h =>
    `<button class="pg${h === 1 ? ' cover' : ''}" data-hal="${h}"><img src="${KATALOG.berkas(h)}" alt="Halaman ${h}" loading="lazy"><small>${h === 1 ? 'Sampul' : 'Hal. ' + h}</small></button>`).join('');
  $('ekPages').innerHTML = Array.from({ length: n }, (_, i) => i + 1).map(h =>
    `<img src="${KATALOG.berkas(h)}" alt="Halaman ${h}" data-hal="${h}" loading="lazy">`).join('');
  $('ekStrip').querySelectorAll('[data-hal]').forEach(b => { b.onclick = () => bukaKatalog(Number(b.dataset.hal)); });
  $('ekTutup').onclick = tutupKatalog;
  // Which page is on screen, for the counter in the header.
  const io = new IntersectionObserver(ents => {
    ents.forEach(e => { if (e.isIntersecting) $('ekHal').textContent = `${e.target.dataset.hal} / ${n}`; });
  }, { root: $('ekPages'), threshold: 0.5 });
  $('ekPages').querySelectorAll('img').forEach(img => io.observe(img));
  // Phone back button closes the viewer instead of leaving the app.
  window.addEventListener('popstate', () => { if (!$('ekViewer').hidden) tutupKatalog(false); });
}
function bukaKatalog(hal) {
  $('ekViewer').hidden = false;
  document.body.style.overflow = 'hidden';
  history.pushState({ katalog: true }, '');
  const img = $('ekPages').querySelector(`img[data-hal="${hal}"]`);
  if (img) requestAnimationFrame(() => img.scrollIntoView({ block: 'start' }));
}
function tutupKatalog(mundur = true) {
  $('ekViewer').hidden = true;
  document.body.style.overflow = '';
  if (mundur && history.state && history.state.katalog) history.back();
}

// Stock by brand: one tile per brand, with how many items and
// units it has right now. Tapping a tile is the same as picking that brand
// in the dropdown -- the tiles are a friendlier front for the same filter.
function renderKatalog(semua) {
  const box = $('katalog');
  const perMerek = new Map();
  semua.forEach(it => {
    const m = String(it.merek ?? '').trim(); if (!m) return;
    const g = perMerek.get(m) || { n: 0, unit: 0, lebih: false };
    g.n++; g.unit += it.total; g.lebih = g.lebih || it.lebih;
    perMerek.set(m, g);
  });
  const merek = [...perMerek.keys()].sort((a, b) => a.localeCompare(b, 'id'));
  box.hidden = merek.length < 2;
  if (box.hidden) return;
  const cur = $('fMerek').value;
  const totN = semua.length, totU = semua.reduce((t, it) => t + it.total, 0), totL = semua.some(it => it.lebih);
  box.innerHTML = `<div class="judul">Stok per merek</div><div class="grid">
    <button class="tile semua${cur ? '' : ' on'}" data-merek=""><b>Semua</b><small>${num(totN)} barang · ${num(totU)}${totL ? '+' : ''} unit</small></button>` +
    merek.map(m => { const g = perMerek.get(m); return `<button class="tile${m === cur ? ' on' : ''}" data-merek="${esc(m)}"><b>${esc(m)}</b><small>${num(g.n)} barang · ${num(g.unit)}${g.lebih ? '+' : ''} unit</small></button>`; }).join('') +
    '</div>';
  box.querySelectorAll('[data-merek]').forEach(b => {
    b.onclick = () => {
      // A new brand wipes the narrower choices, which belonged to the old one.
      $('fMerek').value = b.dataset.merek;
      ['fKategori', 'fTipe', 'fUkuran', 'fWarna'].forEach(id => { $(id).value = ''; });
      render();
      $('cari').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
}
function render() {
  const q = $('cari').value.trim().toLowerCase();
  const semua = semuaItem();
  renderKatalog(semua);
  isiFilter(semua);
  const f = nilaiFilter();
  const adaFilter = FILTER.some(([, k]) => f[k]);
  let items = semua.filter(it => cocokFilter(it, f));
  if (q) items = items.filter(it => (it.sku + ' ' + namaBarang(it)).toLowerCase().includes(q));
  items.sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));

  // With a filter on, the sum of what is listed is the useful number --
  // "how many of brand X do we have" -- so it gets a line of its own.
  const ringkas = $('ringkas');
  ringkas.hidden = !adaFilter || !items.length;
  if (adaFilter && items.length) {
    const tot = items.reduce((s, it) => s + it.total, 0), lebih = items.some(it => it.lebih);
    ringkas.innerHTML = `<span>${esc(FILTER.map(([, k]) => f[k]).filter(Boolean).join(' · '))} — ${num(items.length)} barang</span><b>${num(tot)}${lebih ? '+' : ''} unit</b>`;
  }

  const list = $('list');
  if (!items.length) {
    list.innerHTML = `<div class="empty"><b>Tidak ada barang</b>${rows.length ? (adaFilter ? 'Tidak ada stok dengan pilihan itu. Coba longgarkan filternya.' : 'Coba kata kunci lain.') : 'Belum ada data stok untuk lokasi yang bisa Anda lihat.'}</div>`;
    return;
  }
  list.innerHTML = items.map(it => `
    <div class="item">
      <div class="nm">${esc(namaBarang(it))}</div>
      <div class="sku">${esc(it.sku)}</div>
      <div class="tot${it.total <= 0 ? ' zero' : ''}">${num(it.total)}${it.lebih ? '+' : ''} unit</div>
      ${it.lokasi.length > 1 ? it.lokasi.map(l => `<div class="lok"><span>${esc(l.nama)}</span><b>${num(l.stok)}${l.lebih ? '+' : ''}</b></div>`).join('') : ''}
    </div>
  `).join('');
}

(async function start() {
  wireLogin();
  $('cari').oninput = render;
  FILTER.forEach(([id]) => { $(id).onchange = render; });
  $('btnResetFilter').onclick = () => { FILTER.forEach(([id]) => { $(id).value = ''; }); render(); };
  $('btnKeluar').onclick = doLogout;
  try {
    await initSupabase();
    const { data } = await sb.auth.getSession();
    if (data.session) {
      // Re-check on return: the phone may have been blocked since last time,
      // and an empty stock list would be a confusing way to find that out.
      const izin = await cekPerangkat(data.session.user, data.session.user.email || '');
      if (izin.ok) await enterApp();
      else { await sb.auth.signOut(); setHint(izin.pesan, true); }
    }
  } catch (e) {
    setHint('Tidak bisa menyambung ke layanan. Periksa koneksi internet lalu muat ulang.', true);
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
