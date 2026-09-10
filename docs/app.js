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
  try { await sb.auth.signOut(); } catch (e) { /* ignore */ }
  rows = [];
  $('appShell').hidden = true;
  $('loginScreen').hidden = false;
  setHint('', false);
}

async function enterApp() {
  $('loginScreen').hidden = true;
  $('appShell').hidden = false;
  await muatStok();
  mulaiPenyegar();
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
async function muatStok() {
  const { data, error } = await sb.from('v_stok_tersedia').select('*').order('sku').order('lokasi_urutan');
  if (error) {
    $('list').innerHTML = `<div class="empty"><b>Tidak bisa memuat stok</b>${esc(error.message)}</div>`;
    return;
  }
  rows = data || [];
  render();
}

function render() {
  const q = $('cari').value.trim().toLowerCase();
  const byItem = new Map();
  rows.forEach(r => {
    if (!byItem.has(r.barang_id)) byItem.set(r.barang_id, { ...r, lokasi: [] });
    byItem.get(r.barang_id).lokasi.push({ nama: r.lokasi_nama, stok: r.stok, lebih: r.lebih });
  });
  // Any location capped at 50 makes the item's total a '+' figure too.
  let items = [...byItem.values()].map(it => ({
    ...it,
    total: it.lokasi.reduce((s, l) => s + Number(l.stok), 0),
    lebih: it.lokasi.some(l => l.lebih)
  }));
  if (q) items = items.filter(it => (it.sku + ' ' + namaBarang(it)).toLowerCase().includes(q));
  items.sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));

  const list = $('list');
  if (!items.length) {
    list.innerHTML = `<div class="empty"><b>Tidak ada barang</b>${rows.length ? 'Coba kata kunci lain.' : 'Belum ada data stok untuk lokasi yang bisa Anda lihat.'}</div>`;
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
