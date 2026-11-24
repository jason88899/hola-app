/* HOLA — demo barcode per unit.
   Berdiri sendiri: tidak terhubung ke Supabase / HOLA asli.
   Semua data disimpan di localStorage perangkat ini. */
'use strict';

const KUNCI = 'holaDemoBarcode.v1';
const LOKASI = [
  { id: 'HO', nama: 'Kantor Pusat' },
  { id: 'GDG-01', nama: 'Gudang Cabang' },
  { id: 'SRV-HO', nama: 'Servis Pusat' },
];
const PERAN = {
  master: { nama: 'Master', tabs: ['label', 'masuk', 'keluar', 'pindah', 'hitung', 'stok', 'cari', 'riwayat', 'barang'] },
  gudang: { nama: 'Admin Gudang', tabs: ['masuk', 'keluar', 'pindah', 'hitung', 'stok', 'cari', 'riwayat'] },
  label:  { nama: 'Admin Label', tabs: ['label'] },
};
const TAB = { label: 'Label', masuk: 'Masuk', keluar: 'Keluar', pindah: 'Pindah', hitung: 'Hitung', stok: 'Stok', cari: 'Cari unit', riwayat: 'Riwayat', barang: 'Barang' };

/* Label formats. A4 = sticker sheet grid; nota = receipt printer, one label per page. */
const FORMAT = {
  'a4-3x8': { nama: 'A4 stiker 3×8 · 24 label (70×37 mm)', a4: true, kol: 3, bar: 8, w: 70, h: 37, atas: 0.5, kiri: 0, jk: 0, jb: 0 },
  'a4-2x7': { nama: 'A4 stiker 2×7 · 14 label (99×38 mm)', a4: true, kol: 2, bar: 7, w: 99.1, h: 38.1, atas: 15.1, kiri: 4.6, jk: 2.5, jb: 0 },
  'a4-2x5': { nama: 'A4 kertas biasa 2×5 · 10 label besar (gunting)', a4: true, kol: 2, bar: 5, w: 105, h: 59.3, atas: 0, kiri: 0, jk: 0, jb: 0, garis: true },
  'roll': { nama: 'Printer label roll (Zebra GT820 dll.) · 1 label per stiker', nota: true, roll: true },
  'nota-80': { nama: 'Printer kasir 80 mm', nota: true, w: 80, h: 45, isi: 72 },
  'nota-58': { nama: 'Printer kasir 58 mm', nota: true, w: 58, h: 40, isi: 48 },
};

/* Label-roll printers (Zebra etc.): page = one sticker, size set by the user to match the roll. */
const UKURAN_ROLL = { w: 60, h: 40 };
function formatDari(key) {
  const f = FORMAT[key] || FORMAT['a4-3x8'];
  if (!f.roll) return f;
  const r = { ...UKURAN_ROLL, ...(S && S.roll) };
  return { ...f, w: r.w, h: r.h, isi: r.w };
}

/* ---------- demo item master (spring bed COLORADO, kategori MATRAS) ---------- */
const SEED = [
  ['DELUXE COIL', ['120', '160', '180'], ['ABU', 'COKLAT']],
  ['DELUXE DOUBLE PILLO', ['120', '160', '180'], ['ABU', 'COKLAT']],
  ['DELUXE PILLO', ['120', '160', '180'], ['ABU', 'COKLAT']],
  ['DELUXE PILLO', ['180'], ['BIRU']],
  ['DEPRIMA', ['120', '160', '180'], ['BIRU', 'COKLAT']],
  ['DIAMOND', ['160', '180'], ['PUTIH']],
  ['EMERALD', ['160', '180'], ['COKLAT']],
  ['ETERNA', ['160', '180'], ['ABU', 'BIRU', 'COKLAT']],
  ['INFINITY', ['160', '180'], ['ABU', 'BIRU', 'COKLAT']],
  ['LEGEND', ['160', '180'], ['COKLAT']],
  ['MEDALION PILLO9', ['120', '160', '180'], ['BIRU', 'COKLAT', 'MERAH']],
];
const WARNA_SINGKAT = { ABU: 'AB', COKLAT: 'CK', BIRU: 'BR', MERAH: 'MR', PUTIH: 'PT' };
const singkatTipe = t => { const w = t.split(/\s+/).filter(Boolean); return w.length === 1 ? w[0].slice(0, 3) : w.map(x => x[0]).join(''); };

function buatBarang() {
  const daftar = [], pakai = new Set();
  SEED.forEach(([tipe, ukur, warna]) => ukur.forEach(u => warna.forEach(w => {
    const dasar = 'CO' + singkatTipe(tipe) + u + (WARNA_SINGKAT[w] || w.slice(0, 2));
    let k = dasar, i = 2;
    while (pakai.has(k)) k = dasar + i++;
    pakai.add(k);
    daftar.push({ id: 'b' + (daftar.length + 1), kode: k, kategori: 'MATRAS', merek: 'COLORADO', tipe, ukuran: u, warna: w, kunci: false });
  })));
  return daftar;
}
function buatLama(barang) {
  const m = {};
  barang.forEach((b, i) => {
    m[b.id + '|HO'] = (i * 7 + 3) % 9;
    m[b.id + '|GDG-01'] = (i * 5 + 1) % 6;
    m[b.id + '|SRV-HO'] = i % 11 === 0 ? 1 : 0;
  });
  return m;
}
function kosong() {
  const barang = buatBarang();
  return { versi: 1, barang, lama: buatLama(barang), nomor: {}, unit: {}, cetak: [], mutasi: [], audit: [], peran: 'master', tab: 'label', seq: 1 };
}
function contoh() {
  S = kosong();
  const H = 864e5, t0 = Date.now() - 6 * H;
  const ck = S.barang.find(b => b.kode === 'CODP180CK'), ab = S.barang.find(b => b.kode === 'CODP180AB');
  S.lama[ck.id + '|HO'] = 4; S.lama[ck.id + '|GDG-01'] = 2;
  S.lama[ab.id + '|HO'] = 0; S.lama[ab.id + '|GDG-01'] = 0;
  const c1 = cetakBaru(ck.id, 12, 'Admin Label', t0);
  const c2 = cetakBaru(ab.id, 5, 'Admin Label', t0 + 9e5);
  catatMutasi({ jenis: 'MASUK', lok: 'HO', units: c1.slice(0, 10), ket: 'Dari produksi · SJ-0001', oleh: 'Admin Gudang', t: t0 + 0.2 * H });
  catatMutasi({ jenis: 'MASUK', lok: 'HO', units: c2, ket: 'Dari produksi · SJ-0002', oleh: 'Admin Gudang', t: t0 + 0.25 * H });
  catatMutasi({ jenis: 'KELUAR', lok: 'HO', units: [c1[2], c1[6]], lama: [{ bid: ck.id, qty: 1 }], ket: 'Toko Contoh · F-0001', oleh: 'Admin Gudang', t: t0 + 3 * H });
  catatMutasi({ jenis: 'PINDAH', lok: 'HO', ke: 'GDG-01', units: [c1[9]], ket: 'Stok cabang', oleh: 'Admin Gudang', t: t0 + 4 * H });
  S.peran = 'master'; S.tab = 'label';
  simpan();
}

/* ---------- state ---------- */
let S;
function simpan() { try { localStorage.setItem(KUNCI, JSON.stringify(S)); } catch (e) { /* storage blocked: demo still works for this visit */ } }
function muat() { try { const t = localStorage.getItem(KUNCI); return t ? JSON.parse(t) : null; } catch (e) { return null; } }

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ISI = $('#isi');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(4, '0');
const tglJam = t => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const tgl = t => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const barangById = id => S.barang.find(b => b.id === id);
const namaBarang = b => b ? `${b.merek} ${b.tipe}` : '?';
const detailBarang = b => b ? [b.ukuran, b.warna].filter(Boolean).join(' · ') : '';
const namaLok = id => (LOKASI.find(l => l.id === id) || { nama: id || '-' }).nama;
const oleh = () => PERAN[S.peran].nama;
const kodeUnit = (b, n) => b.kode + '-' + pad(n);
const lamaDi = (bid, lok) => S.lama[bid + '|' + lok] || 0;
const nid = () => (S.seq = (S.seq || 1) + 1).toString(36) + Date.now().toString(36).slice(-5);
const bersihkan = raw => String(raw || '').trim().toUpperCase().replace(/\s+/g, '');

function toast(pesan) {
  const t = $('#toast'); t.textContent = pesan; t.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2600);
}
function cariUnit(k) {
  if (S.unit[k]) return S.unit[k];
  const m = /^(.+?)-?(\d{1,6})$/.exec(k);          // accept without dash or short number
  if (m) { const k2 = m[1] + '-' + pad(+m[2]); if (S.unit[k2]) return S.unit[k2]; }
  return null;
}
function riwayatTerakhir(u, aksi) { for (let i = u.r.length - 1; i >= 0; i--) if (aksi.includes(u.r[i].a)) return u.r[i]; return null; }
function posisiUnit(u) {
  if (u.status === 'DICETAK') return 'label sudah dicetak, <b>belum di-scan masuk</b>';
  if (u.status === 'MASUK') return `di stok <b>${esc(namaLok(u.lok))}</b>`;
  const r = riwayatTerakhir(u, ['KELUAR']);
  return `<b>sudah keluar</b> ${r ? tgl(r.t) : ''}${r && r.ket ? ' · ' + esc(r.ket) : ''}`;
}
function kelompok(codes) {
  const m = new Map();
  codes.forEach(k => { const u = S.unit[k]; if (!u) return; if (!m.has(u.bid)) m.set(u.bid, []); m.get(u.bid).push(k); });
  for (const l of m.values()) l.sort((a, b) => S.unit[a].no - S.unit[b].no);
  return [...m.entries()];
}
function stokLabel() {
  const label = {}, dicetak = {};
  for (const u of Object.values(S.unit)) {
    if (u.status === 'MASUK') label[u.bid + '|' + u.lok] = (label[u.bid + '|' + u.lok] || 0) + 1;
    else if (u.status === 'DICETAK') dicetak[u.bid] = (dicetak[u.bid] || 0) + 1;
  }
  return { label, dicetak };
}
const unitDi = (bid, lok) => Object.values(S.unit).filter(u => u.bid === bid && u.status === 'MASUK' && u.lok === lok).map(u => u.k).sort((a, b) => S.unit[a].no - S.unit[b].no);

/* ---------- core operations ---------- */
function cetakBaru(bid, jumlah, siapa, t = Date.now()) {
  const b = barangById(bid);
  const dari = (S.nomor[bid] || 0) + 1, sampai = dari + jumlah - 1;
  S.nomor[bid] = sampai; b.kunci = true;
  const codes = [];
  for (let n = dari; n <= sampai; n++) {
    const k = kodeUnit(b, n); codes.push(k);
    S.unit[k] = { k, bid, no: n, status: 'DICETAK', lok: null, r: [{ t, a: 'DICETAK', oleh: siapa }] };
  }
  S.cetak.push({ id: nid(), t, oleh: siapa, bid, codes, ulang: false });
  simpan();
  return codes;
}
function cetakUlangCatat(codes, siapa, t = Date.now()) {
  codes.forEach(k => S.unit[k].r.push({ t, a: 'CETAK ULANG', oleh: siapa }));
  kelompok(codes).forEach(([bid, list]) => S.cetak.push({ id: nid(), t, oleh: siapa, bid, codes: list, ulang: true }));
  simpan();
}
function catatMutasi({ jenis, lok, ke = null, units = [], lama = [], ket = '', oleh: siapa, t = Date.now() }) {
  const id = nid(), retur = [];
  units.forEach(k => {
    const u = S.unit[k];
    if (jenis === 'MASUK') {
      const aksi = u.status === 'KELUAR' ? 'RETUR' : 'MASUK';
      if (aksi === 'RETUR') retur.push(k);
      u.status = 'MASUK'; u.lok = lok;
      u.r.push({ t, a: aksi, lok, oleh: siapa, ket, ref: id });
    } else if (jenis === 'KELUAR') {
      u.status = 'KELUAR';
      u.r.push({ t, a: 'KELUAR', lok, oleh: siapa, ket, ref: id });
    } else if (jenis === 'PINDAH') {
      u.lok = ke;
      u.r.push({ t, a: 'PINDAH', lok, ke, oleh: siapa, ket, ref: id });
    }
  });
  const tambah = (bid, l, q) => { S.lama[bid + '|' + l] = lamaDi(bid, l) + q; };
  lama.forEach(({ bid, qty }) => {
    if (jenis === 'MASUK') tambah(bid, lok, qty);
    else { tambah(bid, lok, -qty); if (jenis === 'PINDAH') tambah(bid, ke, qty); }
  });
  S.mutasi.push({ id, t, jenis, lok, ke, oleh: siapa, ket, units: [...units], retur, lama });
  simpan();
  return id;
}

/* ---------- sound & vibration feedback ---------- */
let ac = null;
function bunyi(jenis) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const nada = jenis === 'ok' ? [[1760, .09]] : jenis === 'warn' ? [[880, .08], [880, .08]] : [[220, .35]];
    let t = ac.currentTime;
    nada.forEach(([f, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = f; g.gain.value = .06;
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d); t += d + .06;
    });
  } catch (e) { /* no audio */ }
  try { if (navigator.vibrate) navigator.vibrate(jenis === 'ok' ? 40 : jenis === 'warn' ? [60, 50, 60] : 250); } catch (e) { /* no vibration */ }
}

/* ---------- scanner: keyboard-wedge scanner (USB/OTG/Bluetooth) + phone camera ---------- */
const SENTUH = matchMedia('(pointer:coarse)').matches;
let scanAktif = null, kamera = null;

async function nyalakanKamera(id, cb) {
  await matikanKamera();
  if (!window.Html5Qrcode) throw new Error('pustaka kamera tidak termuat');
  const F = window.Html5QrcodeSupportedFormats;
  const k = new Html5Qrcode(id, { formatsToSupport: [F.QR_CODE, F.CODE_128], experimentalFeatures: { useBarCodeDetectorIfSupported: true }, verbose: false });
  kamera = k;
  let akhir = '', tAkhir = 0;
  await k.start({ facingMode: 'environment' }, {
    fps: 12,
    qrbox: (w, h) => ({ width: Math.max(120, Math.floor(Math.min(w * .85, 380))), height: Math.max(90, Math.floor(Math.min(h * .6, 240))) }),
  }, txt => {
    const now = Date.now();
    if (txt === akhir && now - tAkhir < 3000) return;   // same label still in view
    akhir = txt; tAkhir = now; cb(txt);
  }, () => {});
}
async function matikanKamera() {
  const k = kamera; kamera = null;
  if (!k) return;
  try { if (k.isScanning) await k.stop(); k.clear(); } catch (e) { /* already gone */ }
}

function pemindai(host, onKode, { petunjuk } = {}) {
  const camId = 'cam' + Math.random().toString(36).slice(2, 8);
  host.innerHTML = `
    <div class="scan aktif">
      <div class="scan-row">
        <input class="scan-in" placeholder="${SENTUH ? 'Scan pakai scanner atau kamera' : 'Scan, atau ketik kode lalu Enter'}"
               autocomplete="off" autocapitalize="characters" spellcheck="false" ${SENTUH ? 'inputmode="none"' : ''}>
        <button type="button" class="btn" data-a="kamera">📷 Kamera</button>
        ${SENTUH ? '<button type="button" class="btn quiet" data-a="ketik" title="Ketik manual">⌨</button>' : ''}
      </div>
      <div class="scan-status">${petunjuk || 'Siap. Arahkan scanner ke label.'}</div>
      <div class="kamera" hidden><div id="${camId}"></div></div>
    </div>`;
  const inp = $('.scan-in', host), st = $('.scan-status', host), kam = $('.kamera', host), bK = $('[data-a=kamera]', host);
  const tampil = ({ jenis = 'ok', pesan = '' }) => { st.className = 'scan-status ' + jenis; st.innerHTML = pesan; bunyi(jenis); };
  const proses = raw => { const k = bersihkan(raw); if (!k) return; tampil(onKode(k) || { jenis: 'ok', pesan: '' }); };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const v = inp.value; inp.value = ''; proses(v); }
  });
  bK.onclick = async () => {
    if (kam.hidden) {
      kam.hidden = false; bK.textContent = '■ Stop';
      try { await nyalakanKamera(camId, proses); }
      catch (err) {
        kam.hidden = true; bK.textContent = '📷 Kamera';
        tampil({ jenis: 'bad', pesan: 'Kamera tidak bisa dibuka: ' + esc(err && err.message || err) + '. Pastikan halaman dibuka lewat https dan izin kamera diberikan.' });
      }
    } else { await matikanKamera(); kam.hidden = true; bK.textContent = '📷 Kamera'; }
  };
  const bT = $('[data-a=ketik]', host);
  if (bT) bT.onclick = () => { inp.inputMode = inp.inputMode === 'none' ? 'text' : 'none'; inp.blur(); setTimeout(() => inp.focus(), 60); };
  scanAktif = proses;
  setTimeout(() => inp.focus({ preventScroll: true }), 60);
  return { tampil, fokus: () => inp.focus({ preventScroll: true }) };
}

/* A scanner types fast and ends with Enter: catch it even when no field has focus. */
let buf = '', bufT = 0;
document.addEventListener('keydown', e => {
  if (!scanAktif || $('#dlg').open) return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  const now = Date.now();
  if (now - bufT > 400) buf = '';
  bufT = now;
  if (e.key === 'Enter') { if (buf.length >= 3) { e.preventDefault(); const b = buf; buf = ''; scanAktif(b); } return; }
  if (e.key.length === 1) buf += e.key;
});

/* ---------- item picker: merek → nama barang → ukuran → warna ---------- */
function pemilihBarang(host, { onChange, awal } = {}) {
  const kol = [['merek', 'Merek'], ['tipe', 'Nama barang'], ['ukuran', 'Ukuran'], ['warna', 'Warna']];
  host.innerHTML = `<div class="row c4">${kol.map(([k, l]) => `<label class="f">${l}<select data-k="${k}"></select></label>`).join('')}</div>`;
  const sel = Object.fromEntries(kol.map(([k]) => [k, $(`select[data-k="${k}"]`, host)]));
  const pilihan = {};
  if (awal) { const b = barangById(awal); if (b) kol.forEach(([k]) => { pilihan[k] = b[k]; }); }
  const kandidat = () => { let k = S.barang; kol.forEach(([c]) => { if (pilihan[c]) k = k.filter(b => b[c] === pilihan[c]); }); return k; };
  function isi() {
    let kand = S.barang;
    kol.forEach(([k, l]) => {
      const nilai = [...new Set(kand.map(b => b[k]))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
      if (!nilai.includes(pilihan[k])) pilihan[k] = nilai.length === 1 ? nilai[0] : '';
      sel[k].innerHTML = (nilai.length > 1 ? `<option value="">— pilih —</option>` : '') +
        nilai.map(v => `<option ${v === pilihan[k] ? 'selected' : ''}>${esc(v)}</option>`).join('');
      if (pilihan[k]) kand = kand.filter(b => b[k] === pilihan[k]);
    });
  }
  const bid = () => { const k = kandidat(); return k.length === 1 ? k[0].id : null; };
  host.addEventListener('change', e => {
    const k = e.target.dataset.k; if (!k) return;
    pilihan[k] = e.target.value; isi(); if (onChange) onChange(bid());
  });
  isi();
  return { get: bid };
}

/* ---------- unit list rendering ---------- */
function daftarUnit(codes, { hapus = false, kelas = () => '', kosongTeks = 'Belum ada yang di-scan.' } = {}) {
  if (!codes.length) return `<div class="kosong">${kosongTeks}</div>`;
  return kelompok(codes).map(([bid, list]) => {
    const b = barangById(bid);
    return `<div class="grup">
      <div class="grup-hd"><b>${esc(namaBarang(b))}</b><span class="sub">${esc(detailBarang(b))}</span><span class="n">${list.length} unit</span></div>
      <div class="chips">${list.map(k => `<span class="chip ${kelas(k)}">#${pad(S.unit[k].no)}${hapus ? `<button type="button" data-hapus="${esc(k)}" aria-label="hapus">×</button>` : ''}</span>`).join('')}</div>
    </div>`;
  }).join('');
}
const opsiLokasi = pilih => LOKASI.map(l => `<option value="${l.id}" ${l.id === pilih ? 'selected' : ''}>${esc(l.nama)} (${l.id})</option>`).join('');

/* =================================================================
   TAB: LABEL (cetak label baru + cetak ulang + riwayat cetak)
   ================================================================= */
function tabLabel() {
  const master = S.peran === 'master';
  ISI.innerHTML = `
  ${S.peran === 'label' ? `<section class="card"><b>Login sebagai Admin Label.</b>
     <p class="hint">Akun ini hanya bisa mencetak label. Angka stok, harga, dan riwayat tidak terlihat.
     Label yang dicetak <b>belum dihitung sebagai stok</b> sampai admin gudang men-scan masuk.</p></section>` : ''}
  <div class="grid2">
    <section class="card">
      <div class="card-hd"><h2>1. Pilih barang</h2></div>
      <div id="lPilih"></div>
      <p class="hint" id="lInfo">Pilih barang sampai warna.</p>
      <div class="row">
        <label class="f">Jumlah label<input id="lJumlah" type="number" min="1" max="500" value="10" inputmode="numeric"></label>
        <label class="f">&nbsp;<button class="btn" id="lTambah" type="button" disabled>+ Tambah ke daftar</button></label>
      </div>
      <p class="hint">Ulangi untuk barang lain. Semua barang di daftar dicetak sekaligus di lembar yang sama.
        Maksimal 500 label per barang sekali cetak (± 21 lembar A4); lebih dari itu dicetak bertahap.</p>
    </section>
    <section class="card">
      <div class="card-hd"><h2>Contoh label</h2><span class="sub" id="lUkuran"></span></div>
      <div class="pratinjau" id="lPrev"><div class="kosong">Pilih barang untuk melihat contoh.</div></div>
      <p class="hint">Barcode garis untuk scanner kasir, QR untuk kamera HP. Isinya sama.</p>
      <label class="f" style="max-width:260px">Lihat contoh nomor lain (tidak dicetak)
        <input id="lContohNo" type="number" min="1" max="9999999" placeholder="mis. 10000" inputmode="numeric"></label>
    </section>
  </div>
  <section class="card">
    <div class="card-hd"><h2>2. Daftar cetak</h2><span class="sub" id="lTotal"></span>
      <div class="kanan"><button class="btn quiet sm" id="lKosong" type="button">Kosongkan</button></div></div>
    <div class="tbl-wrap" id="lAntri"></div>
    <div class="row c3" style="margin-top:12px">
      <label class="f">Kertas<select id="lFormat">${Object.entries(FORMAT).map(([k, f]) => `<option value="${k}" ${k === (S.format || 'a4-3x8') ? 'selected' : ''}>${esc(f.nama)}</option>`).join('')}</select></label>
      <label class="f" id="lPosWrap">Mulai di kotak ke- (stiker sisa)<input id="lPos" type="number" min="1" value="1" inputmode="numeric"></label>
      <label class="f" id="lRollWrap">Ukuran stiker di roll (lebar × tinggi, mm)
        <span style="display:flex;gap:6px;align-items:center"><input id="lRollW" type="number" min="25" max="104" inputmode="numeric"> ×
        <input id="lRollH" type="number" min="15" max="150" inputmode="numeric"></span></label>
      <label class="cek"><input type="checkbox" id="lGaris"> Garis potong</label>
    </div>
    <button class="btn besar" id="lCetak" disabled>Cetak</button>
    <p class="hint">Di jendela print pilih <b>Margins: None</b> dan <b>Scale: 100%</b>.
    Nomor langsung tercatat saat menekan Cetak. Kalau print dibatalkan, label bisa dicetak ulang dengan nomor yang sama.</p>
  </section>
  <section class="card">
    <div class="card-hd"><h2>Cetak ulang label rusak</h2></div>
    <p class="hint">Ketik kode yang ada di label (mis. <span class="mono">CODP180CK-0004</span>), atau scan kalau masih terbaca. Nomornya tetap sama.</p>
    <div id="lUlangScan"></div>
    <div id="lUlangDaftar"></div>
    <button class="btn" id="lUlang" disabled>Cetak ulang</button>
  </section>
  <section class="card">
    <div class="card-hd"><h2>Riwayat cetak</h2></div>
    <div class="tbl-wrap" id="lLog"></div>
  </section>`;

  const garis = $('#lGaris'), fmt = $('#lFormat'), jml = $('#lJumlah'), pos = $('#lPos');
  garis.checked = !!formatDari(fmt.value).garis;
  let bid = null;
  const pilih = pemilihBarang($('#lPilih'), { awal: S.labelBarang, onChange: v => { bid = v; S.labelBarang = v; segarkan(); } });
  bid = pilih.get();

  S.antri = (S.antri || []).filter(x => barangById(x.bid));   // print list: [{bid, n}]
  const diAntri = id => (S.antri.find(x => x.bid === id) || { n: 0 }).n;
  const jumlah = () => Math.max(1, Math.min(500, parseInt(jml.value, 10) || 0));

  function segarkan() {
    if (!fmt.isConnected) return;   // tab already closed
    const f = formatDari(fmt.value);
    $('#lUkuran').textContent = `${f.a4 ? f.w : f.isi} × ${f.h} mm`;
    const n = jumlah();
    $('#lTambah').disabled = !bid;
    if (!bid) { $('#lInfo').textContent = 'Pilih barang sampai warna.'; $('#lPrev').innerHTML = '<div class="kosong">Pilih barang untuk melihat contoh.</div>'; return; }
    const b = barangById(bid), akhir = S.nomor[bid] || 0, antri = diAntri(bid);
    const { dicetak } = stokLabel();
    $('#lInfo').innerHTML = `Kode barang <b class="mono">${esc(b.kode)}</b> ${b.kunci ? '🔒' : '<span class="sub">(dikunci setelah cetak pertama)</span>'}
      · Terakhir dicetak: <b>${akhir ? '#' + pad(akhir) : 'belum pernah'}</b>
      ${antri ? `· Sudah di daftar: <b>${antri} label</b>` : ''}
      · Berikutnya: <b>#${pad(akhir + antri + 1)} – #${pad(akhir + antri + n)}</b>
      ${master && dicetak[bid] ? `<br>Dicetak tapi belum di-scan masuk: <b>${dicetak[bid]} unit</b>` : ''}`;
    $('#lTambah').textContent = `+ Tambah ${n} ke daftar`;
    const lihat = parseInt($('#lContohNo').value, 10);
    const no = lihat > 0 ? lihat : akhir + antri + 1;
    tampilPratinjau($('#lPrev'), { k: kodeUnit(b, no), bid, no }, f, garis.checked);
  }

  function gambarAntri() {
    if (!fmt.isConnected) return;
    const f = formatDari(fmt.value);
    $('#lPosWrap').hidden = !f.a4;
    $('#lRollWrap').hidden = !f.roll;
    const total = S.antri.reduce((a, x) => a + x.n, 0);
    $('#lAntri').innerHTML = S.antri.length ? `<table><thead><tr><th>Barang</th><th class="n">Jumlah</th><th>Nomor</th><th></th></tr></thead><tbody>${S.antri.map((x, i) => {
      const b = barangById(x.bid), mulai = (S.nomor[x.bid] || 0) + 1;
      return `<tr><td>${esc(namaBarang(b))}<span class="sub">${esc(detailBarang(b))}</span></td>
        <td class="n"><input type="number" min="1" max="500" value="${x.n}" data-ubahantri="${i}" style="width:72px;text-align:right" inputmode="numeric"></td>
        <td class="mono">#${pad(mulai)} – #${pad(mulai + x.n - 1)}</td>
        <td class="n"><button class="btn quiet sm" data-hapusantri="${i}" type="button" aria-label="hapus">×</button></td></tr>`;
    }).join('')}</tbody></table>` : '<div class="kosong">Belum ada. Pilih barang di atas, isi jumlah, lalu tekan "+ Tambah ke daftar".</div>';
    const per = f.a4 ? f.kol * f.bar : 1, awal = f.a4 ? Math.min(per, Math.max(1, parseInt(pos.value, 10) || 1)) : 1;
    const lembar = total ? Math.ceil((awal - 1 + total) / per) : 0;
    $('#lTotal').textContent = total ? `${S.antri.length} barang · ${total} label · ${f.a4 ? lembar + ' lembar A4' : total + (f.roll ? ' stiker' : ' potong kertas kasir')}` : '';
    $('#lCetak').disabled = !total;
    $('#lCetak').textContent = total ? `Cetak ${total} label` : 'Cetak';
    $('#lKosong').hidden = !total;
  }

  fmt.onchange = () => { S.format = fmt.value; garis.checked = !!formatDari(fmt.value).garis; simpan(); segarkan(); gambarAntri(); };
  jml.oninput = segarkan; garis.onchange = segarkan; pos.oninput = gambarAntri;
  $('#lContohNo').oninput = segarkan;
  const rW = $('#lRollW'), rH = $('#lRollH'), roll = { ...UKURAN_ROLL, ...S.roll };
  rW.value = roll.w; rH.value = roll.h;
  rW.onchange = rH.onchange = () => {
    const w = Math.max(25, Math.min(104, parseFloat(rW.value) || UKURAN_ROLL.w));   // GT820 prints up to 104 mm wide
    const h = Math.max(15, Math.min(150, parseFloat(rH.value) || UKURAN_ROLL.h));
    rW.value = w; rH.value = h; S.roll = { w, h }; simpan(); segarkan(); gambarAntri();
  };
  addEventListener('resize', segarkan, { once: true });

  $('#lTambah').onclick = () => {
    if (!bid) return;
    const n = jumlah(), b = barangById(bid);
    const ada = S.antri.find(x => x.bid === bid);
    if (ada) ada.n = Math.min(500, ada.n + n); else S.antri.push({ bid, n });
    simpan(); gambarAntri(); segarkan();
    toast(`+${n} ${b.tipe} ${detailBarang(b)}`);
  };
  $('#lAntri').onclick = e => {
    const i = e.target.dataset.hapusantri; if (i === undefined) return;
    S.antri.splice(+i, 1); simpan(); gambarAntri(); segarkan();
  };
  $('#lAntri').onchange = e => {
    const i = e.target.dataset.ubahantri; if (i === undefined) return;
    S.antri[+i].n = Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1));
    simpan(); gambarAntri(); segarkan();
  };
  $('#lKosong').onclick = () => { if (!confirm('Kosongkan daftar cetak?')) return; S.antri = []; simpan(); gambarAntri(); segarkan(); };

  $('#lCetak').onclick = () => {
    const total = S.antri.reduce((a, x) => a + x.n, 0);
    const rincian = S.antri.map(x => { const b = barangById(x.bid), m = (S.nomor[x.bid] || 0) + 1; return `• ${b.tipe} ${detailBarang(b)}: ${x.n} label (#${pad(m)} – #${pad(m + x.n - 1)})`; }).join('\n');
    if (!confirm(`Cetak ${total} label?\n\n${rincian}\n\nNomor ini langsung tercatat.`)) return;
    const codes = [];
    S.antri.forEach(x => codes.push(...cetakBaru(x.bid, x.n, oleh())));
    cetakKeKertas(codes, fmt.value, parseInt(pos.value, 10) || 1, garis.checked);
    toast(`${total} label dicetak`);
    S.antri = []; simpan(); pos.value = 1;
    gambarAntri(); segarkan(); isiLog();
  };

  /* reprint */
  const ulang = [];
  const gambarUlang = () => {
    $('#lUlangDaftar').innerHTML = daftarUnit(ulang, { hapus: true, kosongTeks: 'Belum ada label yang dipilih.' });
    $('#lUlang').disabled = !ulang.length;
    $('#lUlang').textContent = ulang.length ? `Cetak ulang ${ulang.length} label` : 'Cetak ulang';
  };
  $('#lUlangDaftar').onclick = e => { const k = e.target.dataset.hapus; if (k) { ulang.splice(ulang.indexOf(k), 1); gambarUlang(); } };
  pemindai($('#lUlangScan'), k => {
    const u = cariUnit(k);
    if (!u) return { jenis: 'bad', pesan: `<span class="mono">${esc(k)}</span> tidak ditemukan. Label ini tidak pernah dicetak.` };
    const nm = `${esc(namaBarang(barangById(u.bid)))} ${esc(detailBarang(barangById(u.bid)))} <b>#${pad(u.no)}</b>`;
    if (u.status === 'KELUAR') return { jenis: 'bad', pesan: `${nm} sudah keluar dari gudang. Label tidak dicetak ulang.` };
    if (ulang.includes(u.k)) return { jenis: 'warn', pesan: `${nm} sudah ada di daftar.` };
    ulang.push(u.k); gambarUlang();
    return { jenis: 'ok', pesan: `${nm} ditambahkan.` };
  }, { petunjuk: 'Ketik kode label lalu Enter.' });
  $('#lUlang').onclick = () => {
    cetakUlangCatat([...ulang], oleh());
    cetakKeKertas([...ulang], fmt.value, 1, garis.checked);
    toast(`${ulang.length} label dicetak ulang`);
    ulang.length = 0; gambarUlang(); isiLog();
  };
  gambarUlang();

  function isiLog() {
    const log = [...S.cetak].reverse().slice(0, 100);
    if (!log.length) { $('#lLog').innerHTML = '<div class="kosong">Belum ada label yang dicetak.</div>'; return; }
    $('#lLog').innerHTML = `<table><thead><tr><th>Waktu</th><th>Barang</th><th>Nomor</th><th>Oleh</th><th></th></tr></thead><tbody>${log.map(c => {
      const b = barangById(c.bid), no = c.codes.map(k => S.unit[k].no);
      const rentang = !c.ulang && no.length > 1 ? `#${pad(no[0])} – #${pad(no[no.length - 1])}` : no.map(n => '#' + pad(n)).join(', ');
      return `<tr><td>${tglJam(c.t)}</td><td>${esc(namaBarang(b))}<span class="sub">${esc(detailBarang(b))}</span></td>
        <td><span class="mono">${rentang}</span> <span class="sub">${c.codes.length} label ${c.ulang ? '· <span class="badge b-CETAK">CETAK ULANG</span>' : ''}</span></td>
        <td>${esc(c.oleh)}</td><td><button class="btn quiet sm" data-ulang="${c.id}">Cetak ulang</button></td></tr>`;
    }).join('')}</tbody></table>`;
  }
  $('#lLog').onclick = e => {
    const id = e.target.dataset.ulang; if (!id) return;
    const c = S.cetak.find(x => x.id === id);
    const bisa = c.codes.filter(k => S.unit[k].status !== 'KELUAR');
    if (!bisa.length) { toast('Semua unit di catatan ini sudah keluar'); return; }
    if (!confirm(`Cetak ulang ${bisa.length} label dengan nomor yang sama?${bisa.length < c.codes.length ? `\n(${c.codes.length - bisa.length} unit sudah keluar, tidak ikut dicetak)` : ''}`)) return;
    cetakUlangCatat(bisa, oleh());
    cetakKeKertas(bisa, fmt.value, 1, garis.checked);
    isiLog();
  };
  isiLog(); segarkan(); gambarAntri();
}

/* ---------- label drawing ---------- */
function svgBarcode(text) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, text, { format: 'CODE128', displayValue: false, margin: 0, marginLeft: 10, marginRight: 10, width: 1, height: 40, background: '#ffffff', lineColor: '#000000' });
  const w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.removeAttribute('width'); svg.removeAttribute('height'); svg.removeAttribute('style');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('style', 'width:100%;height:100%');
  return svg.outerHTML;
}
function svgQR(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(); let p = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;
}
function elLabel(u, f, garis) {
  const b = barangById(u.bid);
  const w = f.a4 ? f.w : f.isi, h = f.h;
  const s = h / 37, pd = Math.max(1.6, h * .06), bcH = h * .27, sela = h * .035;
  const qr = Math.min(h - bcH - pd * 2 - sela, w * .42);
  const d = document.createElement('div');
  d.className = 'lbl' + (garis ? ' garis' : '');
  d.style.cssText = `width:${w}mm;height:${h}mm;padding:${pd}mm ${pd + .6}mm`;
  d.innerHTML = `
    <div class="bc" style="height:${bcH}mm">${svgBarcode(u.k)}</div>
    <div class="bawah" style="margin-top:${sela}mm">
      <div class="qr" style="width:${qr}mm;height:${qr}mm">${svgQR(u.k)}</div>
      <div class="teks">
        <span class="nama" style="font-size:${(7.2 * s).toFixed(1)}pt">${esc(b.merek)}<br>${esc(b.tipe)}</span>
        <span style="font-size:${(8 * s).toFixed(1)}pt;font-weight:700">${esc(detailBarang(b))}</span>
        <span class="kode" style="font-size:${(6 * s).toFixed(1)}pt;margin-top:${(1 * s).toFixed(1)}mm">${esc(u.k)}</span>
      </div>
    </div>`;
  return d;
}
function tampilPratinjau(host, u, f, garis) {
  const el = elLabel(u, f, garis);
  host.innerHTML = '';
  const bungkus = document.createElement('div');
  host.appendChild(bungkus); bungkus.appendChild(el);
  const pxMm = 96 / 25.4, lw = (f.a4 ? f.w : f.isi) * pxMm, lh = f.h * pxMm;
  const ruang = Math.max(200, host.clientWidth - 24);
  const sk = Math.min(2.2, ruang / lw);
  el.style.transform = `scale(${sk})`; el.style.transformOrigin = 'top left';
  bungkus.style.cssText = `width:${lw * sk}px;height:${lh * sk}px`;
}
function cetakKeKertas(codes, fKey, posisi, garis) {
  const f = formatDari(fKey), box = $('#cetak'), gaya = $('#gayaHalaman');
  box.innerHTML = '';
  if (f.a4) {
    gaya.textContent = '@page{size:A4;margin:0}';
    const per = f.kol * f.bar;
    const sel = [...Array(Math.max(0, Math.min(per - 1, posisi - 1))).fill(null), ...codes];
    for (let i = 0; i < sel.length; i += per) {
      const lb = document.createElement('div'); lb.className = 'lembar';
      lb.style.cssText = `padding:${f.atas}mm 0 0 ${f.kiri}mm;grid-template-columns:repeat(${f.kol},${f.w}mm);grid-auto-rows:${f.h}mm;column-gap:${f.jk}mm;row-gap:${f.jb}mm;align-content:start`;
      sel.slice(i, i + per).forEach(k => {
        if (!k) { const e = document.createElement('div'); e.className = 'lbl kosong-sel'; lb.appendChild(e); }
        else lb.appendChild(elLabel(S.unit[k], f, garis));
      });
      box.appendChild(lb);
    }
  } else {
    gaya.textContent = `@page{size:${f.w}mm ${f.h}mm;margin:0}`;
    codes.forEach(k => {
      const n = document.createElement('div'); n.className = 'nota'; n.style.height = f.h + 'mm';
      n.appendChild(elLabel(S.unit[k], f, garis)); box.appendChild(n);
    });
  }
  setTimeout(() => window.print(), 150);
}

/* =================================================================
   TAB: MASUK / KELUAR / PINDAH
   ================================================================= */
function tabMutasi(jenis) {
  const st = { units: [], lama: [] };
  const judul = { MASUK: 'Scan barang masuk', KELUAR: 'Scan barang keluar', PINDAH: 'Pindah gudang' }[jenis];
  const info = {
    MASUK: 'Scan setiap unit yang sampai di gudang. Unit baru dihitung sebagai stok setelah di-scan di sini. Unit yang pernah keluar otomatis dicatat sebagai RETUR.',
    KELUAR: 'Scan setiap unit berlabel yang dikirim. Barang lama tanpa label diisi jumlahnya di bagian bawah.',
    PINDAH: 'Scan unit yang dipindah ke gudang lain, termasuk yang dikirim ke Servis Pusat.',
  }[jenis];
  const ketLabel = { MASUK: 'Asal / no. surat jalan', KELUAR: 'Tujuan / no. faktur', PINDAH: 'Keterangan' }[jenis];
  ISI.innerHTML = `
  <div class="grid2">
    <section class="card">
      <div class="card-hd"><h2>${judul}</h2></div>
      <p class="hint">${info}</p>
      <div class="row ${jenis === 'PINDAH' ? '' : 'c1'}">
        <label class="f">${jenis === 'PINDAH' ? 'Dari' : 'Gudang'}<select id="mLok">${opsiLokasi(S.lok || 'HO')}</select></label>
        ${jenis === 'PINDAH' ? `<label class="f">Ke<select id="mKe">${opsiLokasi(S.lok === 'GDG-01' ? 'HO' : 'GDG-01')}</select></label>` : ''}
      </div>
      <div id="mScan"></div>
      <label class="f">${ketLabel}<input id="mKet" placeholder="${jenis === 'KELUAR' ? 'mis. Toko ABC · F-0123' : jenis === 'MASUK' ? 'mis. Produksi · SJ-0456' : ''}"></label>
      ${jenis !== 'MASUK' ? `
      <details class="card" style="margin:12px 0 0;padding:10px 12px;background:var(--rule-soft);box-shadow:none" id="mLamaBox">
        <summary><b>Barang lama tanpa label</b> <span class="sub">isi jumlah, seperti sekarang</span></summary>
        <div id="mLamaPilih" style="margin-top:8px"></div>
        <p class="hint" id="mLamaInfo"></p>
        <div class="row">
          <label class="f">Jumlah<input id="mLamaQty" type="number" min="1" value="1" inputmode="numeric"></label>
          <label class="f">&nbsp;<button class="btn quiet" id="mLamaTambah" type="button">+ Tambah</button></label>
        </div>
      </details>` : ''}
    </section>
    <section class="card">
      <div class="card-hd"><h2>Daftar</h2><div class="kanan"><button class="btn quiet sm" id="mBatal">Kosongkan</button></div></div>
      <div id="mDaftar"></div>
      <div id="mLamaDaftar"></div>
      <button class="btn ok besar" id="mSimpan" disabled style="margin-top:10px">Simpan</button>
    </section>
  </div>`;

  const lokEl = $('#mLok'), keEl = $('#mKe');
  const lok = () => lokEl.value, ke = () => keEl && keEl.value;
  let lokLama = lok();

  function gambar() {
    $('#mDaftar').innerHTML = daftarUnit(st.units, { hapus: true, kelas: k => S.unit[k].status === 'KELUAR' ? 'warn' : '' });
    $('#mLamaDaftar').innerHTML = st.lama.length ? `<div class="grup"><div class="grup-hd"><b>Tanpa label</b></div>${st.lama.map((l, i) => {
      const b = barangById(l.bid);
      return `<div class="grup-hd"><span>${esc(namaBarang(b))} <span class="sub">${esc(detailBarang(b))}</span></span><span class="n">${l.qty} unit <button class="btn quiet sm" data-hapuslama="${i}">×</button></span></div>`;
    }).join('')}</div>` : '';
    const nU = st.units.length, nL = st.lama.reduce((a, l) => a + l.qty, 0);
    const salahTujuan = jenis === 'PINDAH' && lok() === ke();
    $('#mSimpan').disabled = !(nU + nL) || salahTujuan;
    $('#mSimpan').textContent = salahTujuan ? 'Gudang asal dan tujuan sama' : `Simpan ${jenis.toLowerCase()} · ${nU + nL} unit`;
  }
  $('#mDaftar').onclick = e => { const k = e.target.dataset.hapus; if (k) { st.units.splice(st.units.indexOf(k), 1); gambar(); } };
  $('#mLamaDaftar').onclick = e => { const i = e.target.dataset.hapuslama; if (i !== undefined) { st.lama.splice(+i, 1); gambar(); } };
  lokEl.onchange = () => {
    if ((st.units.length || st.lama.length) && !confirm('Ganti gudang akan mengosongkan daftar. Lanjut?')) { lokEl.value = lokLama; return; }
    st.units.length = 0; st.lama.length = 0; lokLama = lok(); S.lok = lok(); simpan(); gambar(); infoLama();
  };
  if (keEl) keEl.onchange = gambar;
  $('#mBatal').onclick = () => { st.units.length = 0; st.lama.length = 0; gambar(); };

  pemindai($('#mScan'), k => {
    const u = cariUnit(k);
    if (!u) return { jenis: 'bad', pesan: `<span class="mono">${esc(k)}</span> tidak dikenal. Label ini tidak pernah dicetak.` };
    const b = barangById(u.bid);
    const nm = `${esc(namaBarang(b))} ${esc(detailBarang(b))} <b>#${pad(u.no)}</b>`;
    if (st.units.includes(u.k)) return { jenis: 'warn', pesan: `${nm} sudah di-scan.` };
    if (jenis === 'MASUK') {
      if (u.status === 'MASUK') return { jenis: 'bad', pesan: `${nm} sudah ada di stok ${esc(namaLok(u.lok))}. Tidak bisa masuk dua kali.` };
      st.units.push(u.k); gambar();
      if (u.status === 'KELUAR') { const r = riwayatTerakhir(u, ['KELUAR']); return { jenis: 'warn', pesan: `${nm} tercatat keluar ${r ? tgl(r.t) : ''}${r && r.ket ? ' (' + esc(r.ket) + ')' : ''}. Dicatat sebagai <b>RETUR</b>.` }; }
      return { jenis: 'ok', pesan: `✓ ${nm}` };
    }
    if (u.status === 'DICETAK') return { jenis: 'bad', pesan: `${nm} belum pernah di-scan masuk. Scan masuk dulu di tab Masuk.` };
    if (u.status === 'KELUAR') { const r = riwayatTerakhir(u, ['KELUAR']); return { jenis: 'bad', pesan: `${nm} sudah keluar ${r ? tgl(r.t) : ''}${r && r.ket ? ' (' + esc(r.ket) + ')' : ''}. Tidak bisa keluar dua kali.` }; }
    if (u.lok !== lok()) return { jenis: 'bad', pesan: `${nm} tercatat di ${esc(namaLok(u.lok))}, bukan di ${esc(namaLok(lok()))}.` };
    st.units.push(u.k); gambar();
    return { jenis: 'ok', pesan: `✓ ${nm}` };
  });

  /* unlabeled old stock */
  let pilihLama = null, infoLama = () => {};
  if (jenis !== 'MASUK') {
    const p = pemilihBarang($('#mLamaPilih'), { onChange: () => infoLama() });
    infoLama = () => {
      const bid = p.get();
      if (!bid) { $('#mLamaInfo').textContent = 'Pilih barang sampai warna.'; return; }
      const sisa = lamaDi(bid, lok()) - st.lama.filter(l => l.bid === bid).reduce((a, l) => a + l.qty, 0);
      const berlabel = unitDi(bid, lok()).length;
      $('#mLamaInfo').innerHTML = `Di ${esc(namaLok(lok()))}: <b>${sisa}</b> unit tanpa label · <b>${berlabel}</b> unit berlabel (wajib scan)` +
        (sisa <= 0 ? `<br><b style="color:var(--stamp)">Stok tanpa label sudah habis. Barang ini wajib di-scan.</b>` : '');
    };
    pilihLama = p;
    $('#mLamaTambah').onclick = () => {
      const bid = p.get(), q = parseInt($('#mLamaQty').value, 10) || 0;
      if (!bid) { toast('Pilih barang dulu'); return; }
      if (q < 1) { toast('Jumlah minimal 1'); return; }
      const sisa = lamaDi(bid, lok()) - st.lama.filter(l => l.bid === bid).reduce((a, l) => a + l.qty, 0);
      if (sisa <= 0) { bunyi('bad'); toast('Stok tanpa label habis: barang ini wajib di-scan'); infoLama(); return; }
      if (q > sisa) { bunyi('bad'); toast(`Stok tanpa label cuma ${sisa} unit. Sisanya wajib di-scan.`); return; }
      const ada = st.lama.find(l => l.bid === bid);
      if (ada) ada.qty += q; else st.lama.push({ bid, qty: q });
      $('#mLamaQty').value = 1; gambar(); infoLama();
    };
    infoLama();
  }

  $('#mSimpan').onclick = () => {
    const nU = st.units.length, nL = st.lama.reduce((a, l) => a + l.qty, 0);
    catatMutasi({ jenis, lok: lok(), ke: ke(), units: [...st.units], lama: st.lama.map(l => ({ ...l })), ket: $('#mKet').value.trim(), oleh: oleh() });
    toast(`Tersimpan: ${jenis} ${nU + nL} unit`);
    st.units.length = 0; st.lama.length = 0; $('#mKet').value = '';
    gambar(); infoLama();
  };
  gambar();
}

/* =================================================================
   TAB: HITUNG (audit fisik dengan scan)
   ================================================================= */
function tabHitung() {
  ISI.innerHTML = `
  <section class="card" id="hForm">
    <div class="card-hd"><h2>Hitung stok (audit)</h2></div>
    <p class="hint">Pilih barang dan gudang, lalu scan semua unit yang ada di rak. Sistem menunjukkan nomor mana yang tidak ditemukan.</p>
    <div id="hPilih"></div>
    <div class="row c1"><label class="f">Gudang<select id="hLok">${opsiLokasi(S.lok || 'HO')}</select></label></div>
    <button class="btn besar" id="hMulai" disabled>Mulai hitung</button>
  </section>
  <div id="hSesi"></div>
  <section class="card"><div class="card-hd"><h2>Hasil hitung sebelumnya</h2></div><div id="hLog"></div></section>`;

  let bid = null;
  const p = pemilihBarang($('#hPilih'), { awal: S.hitungBarang, onChange: v => { bid = v; S.hitungBarang = v; $('#hMulai').disabled = !v; } });
  bid = p.get(); $('#hMulai').disabled = !bid;
  $('#hMulai').onclick = () => mulai(bid, $('#hLok').value);

  function mulai(bid, lok) {
    S.lok = lok; simpan();
    const b = barangById(bid);
    const harus = unitDi(bid, lok), ketemu = [], lain = [];
    const lamaSistem = lamaDi(bid, lok);
    $('#hForm').hidden = true;
    $('#hSesi').innerHTML = `
    <section class="card">
      <div class="card-hd"><h2>${esc(namaBarang(b))}</h2><span class="sub">${esc(detailBarang(b))} · ${esc(namaLok(lok))}</span>
        <div class="kanan"><button class="btn quiet sm" id="hBatal">Batal</button></div></div>
      <div class="ringkas">
        <div><span>Berlabel ditemukan</span><b class="besar-n" id="hN">0</b> <b>/ ${harus.length}</b></div>
      </div>
      <div id="hScan"></div>
      <div id="hKetemu"></div>
      <label class="cek" style="margin:6px 0"><input type="checkbox" id="hLihat"> Tampilkan nomor yang belum ditemukan</label>
      <div id="hBelum" hidden></div>
      <div id="hLain"></div>
      <div class="row" style="margin-top:10px">
        <label class="f">Barang tanpa label yang dihitung manual<input id="hLama" type="number" min="0" inputmode="numeric" placeholder="jumlah"></label>
      </div>
      <button class="btn ok besar" id="hSelesai">Selesai hitung</button>
    </section>`;
    const gambar = () => {
      $('#hN').textContent = ketemu.length;
      $('#hKetemu').innerHTML = daftarUnit(ketemu, { kelas: () => 'ok', kosongTeks: 'Belum ada unit yang di-scan.' });
      const belum = harus.filter(k => !ketemu.includes(k));
      $('#hBelum').innerHTML = belum.length ? `<div class="chips">${belum.map(k => `<span class="chip">#${pad(S.unit[k].no)}</span>`).join('')}</div>` : '<div class="kosong">Semua sudah ditemukan.</div>';
      $('#hLain').innerHTML = lain.length ? `<div class="grup"><div class="grup-hd"><b>Perlu dicek</b></div>${lain.map(x => `<div class="hint">• ${x.pesan}</div>`).join('')}</div>` : '';
    };
    $('#hLihat').onchange = e => { $('#hBelum').hidden = !e.target.checked; };
    $('#hBatal').onclick = () => { if (ketemu.length && !confirm('Batalkan hitung ini?')) return; render(); };
    pemindai($('#hScan'), k => {
      const u = cariUnit(k);
      if (!u) return { jenis: 'bad', pesan: `<span class="mono">${esc(k)}</span> tidak dikenal. Label ini tidak pernah dicetak.` };
      const ub = barangById(u.bid), nm = `${esc(namaBarang(ub))} ${esc(detailBarang(ub))} <b>#${pad(u.no)}</b>`;
      if (u.bid !== bid) {
        if (!lain.some(x => x.k === u.k)) lain.push({ k: u.k, pesan: `${nm} ada di rak, padahal bukan barang yang sedang dihitung.` });
        gambar(); return { jenis: 'warn', pesan: `Ini ${nm}, bukan ${esc(namaBarang(b))} ${esc(detailBarang(b))}.` };
      }
      if (ketemu.includes(u.k)) return { jenis: 'warn', pesan: `#${pad(u.no)} sudah dihitung.` };
      if (harus.includes(u.k)) { ketemu.push(u.k); gambar(); return { jenis: 'ok', pesan: `✓ #${pad(u.no)} · ${ketemu.length} / ${harus.length}` }; }
      const alasan = u.status === 'DICETAK' ? 'belum pernah di-scan masuk' : u.status === 'KELUAR' ? 'tercatat sudah keluar' : `tercatat di ${esc(namaLok(u.lok))}`;
      if (!lain.some(x => x.k === u.k)) lain.push({ k: u.k, pesan: `${nm} ada di rak, tapi ${alasan}.` });
      gambar(); return { jenis: 'warn', pesan: `${nm} ${alasan}. Dicatat untuk dicek.` };
    });
    $('#hSelesai').onclick = () => {
      const belum = harus.filter(k => !ketemu.includes(k));
      const lamaHitung = $('#hLama').value === '' ? null : parseInt($('#hLama').value, 10) || 0;
      if (belum.length && !confirm(`${belum.length} unit belum ditemukan. Selesaikan hitung?`)) return;
      const rec = { id: nid(), t: Date.now(), oleh: oleh(), bid, lok, harus, ketemu: [...ketemu], hilang: belum, lain: lain.map(x => x.pesan), lamaSistem, lamaHitung };
      S.audit.push(rec); simpan();
      $('#hSesi').innerHTML = `<section class="card">${hasilAudit(rec)}<div class="dlg-aksi"><button class="btn" id="hLagi">Hitung barang lain</button></div></section>`;
      $('#hLagi').onclick = render;
      scanAktif = null; matikanKamera(); isiLog();
    };
    gambar();
  }

  function isiLog() {
    const log = [...S.audit].reverse().slice(0, 30);
    $('#hLog').innerHTML = log.length ? log.map(a => `<div class="ent">${hasilAudit(a, true)}</div>`).join('') : '<div class="kosong">Belum ada.</div>';
  }
  isiLog();
}
function hasilAudit(a, ringkas) {
  const b = barangById(a.bid);
  const tanggalMasuk = k => { const r = riwayatTerakhir(S.unit[k], ['MASUK', 'RETUR', 'PINDAH']); return r ? ` <span class="sub">masuk ${tgl(r.t)}</span>` : ''; };
  const selisihLama = a.lamaHitung === null ? null : a.lamaHitung - a.lamaSistem;
  return `
    <div class="ent-hd"><span class="badge b-HITUNG">HITUNG</span><time>${tglJam(a.t)}</time><span>${esc(a.oleh)}</span></div>
    <h3 style="margin-top:4px">${esc(namaBarang(b))} <span class="sub" style="display:inline">${esc(detailBarang(b))} · ${esc(namaLok(a.lok))}</span></h3>
    <p style="margin:4px 0">Berlabel: seharusnya <b>${a.harus.length}</b>, ditemukan <b>${a.ketemu.length}</b>.
      ${a.hilang.length ? `<b style="color:var(--stamp)">Tidak ditemukan: ${a.hilang.length}</b>` : '<b style="color:var(--tally)">Lengkap.</b>'}</p>
    ${a.hilang.length ? `<div class="chips">${a.hilang.map(k => `<span class="chip bad">#${pad(S.unit[k].no)}${ringkas ? '' : tanggalMasuk(k)}</span>`).join('')}</div>` : ''}
    ${a.lamaHitung !== null ? `<p style="margin:6px 0 0">Tanpa label: sistem <b>${a.lamaSistem}</b>, dihitung <b>${a.lamaHitung}</b>
      ${selisihLama ? `<b style="color:var(--stamp)">(selisih ${selisihLama > 0 ? '+' : ''}${selisihLama})</b>` : '(cocok)'}</p>` : ''}
    ${a.lain.length ? `<div style="margin-top:6px">${a.lain.map(x => `<div class="hint">• ${x}</div>`).join('')}</div>` : ''}
    ${ringkas ? '' : '<p class="hint">Di aplikasi asli, selisih diperbaiki lewat koreksi oleh master, dan catatan hitung ini tetap tersimpan.</p>'}`;
}

/* =================================================================
   TAB: STOK
   ================================================================= */
function tabStok() {
  ISI.innerHTML = `
  <section class="card">
    <div class="card-hd"><h2>Stok per barang</h2>
      <div class="kanan"><label class="cek"><input type="checkbox" id="sAda" ${S.stokAda !== false ? 'checked' : ''}> Hanya yang berlabel</label></div></div>
    <p class="hint">Total = barang lama tanpa label + unit berlabel yang sudah di-scan masuk. Klik baris untuk melihat nomor unit.</p>
    <input id="sCari" placeholder="Cari nama barang, ukuran, warna…" style="margin-bottom:8px">
    <div class="tbl-wrap" id="sTabel"></div>
  </section>`;
  const gambar = () => {
    const { label, dicetak } = stokLabel();
    const q = $('#sCari').value.trim().toUpperCase().split(/\s+/).filter(Boolean);
    const ada = $('#sAda').checked;
    const baris = S.barang.filter(b => {
      const teks = `${b.merek} ${b.tipe} ${b.ukuran} ${b.warna} ${b.kode}`.toUpperCase();
      if (!q.every(w => teks.includes(w))) return false;
      if (ada) return LOKASI.some(l => label[b.id + '|' + l.id]) || dicetak[b.id] || S.nomor[b.id];
      return true;
    });
    if (!baris.length) { $('#sTabel').innerHTML = '<div class="kosong">Tidak ada barang. Hilangkan centang "Hanya yang berlabel" untuk melihat semua.</div>'; return; }
    $('#sTabel').innerHTML = `<table><thead><tr><th>Barang</th>${LOKASI.map(l => `<th class="n">${l.id}</th>`).join('')}<th class="n">Total</th><th class="n">Dicetak, belum masuk</th></tr></thead><tbody>
    ${baris.map(b => {
      let tot = 0;
      const sel = LOKASI.map(l => { const lb = label[b.id + '|' + l.id] || 0, lm = lamaDi(b.id, l.id); tot += lb + lm; return `<td class="n"><b>${lb + lm}</b><span class="sub">${lm} lama · ${lb} label</span></td>`; }).join('');
      return `<tr class="klik" data-bid="${b.id}"><td>${esc(namaBarang(b))}<span class="sub">${esc(detailBarang(b))} · <span class="mono">${esc(b.kode)}</span></span></td>${sel}<td class="n"><b>${tot}</b></td><td class="n">${dicetak[b.id] || ''}</td></tr>`;
    }).join('')}</tbody></table>`;
  };
  $('#sCari').oninput = gambar;
  $('#sAda').onchange = e => { S.stokAda = e.target.checked; simpan(); gambar(); };
  $('#sTabel').onclick = e => { const tr = e.target.closest('tr[data-bid]'); if (tr) detailStok(tr.dataset.bid); };
  gambar();
}
function detailStok(bid) {
  const b = barangById(bid);
  const dicetak = Object.values(S.unit).filter(u => u.bid === bid && u.status === 'DICETAK').map(u => u.k);
  const keluar = Object.values(S.unit).filter(u => u.bid === bid && u.status === 'KELUAR').length;
  bukaDialog(`
    <h2>${esc(namaBarang(b))}</h2><p class="hint">${esc(detailBarang(b))} · kode <span class="mono">${esc(b.kode)}</span> · terakhir dicetak #${pad(S.nomor[bid] || 0)}</p>
    ${LOKASI.map(l => { const u = unitDi(bid, l.id); return `<div class="grup"><div class="grup-hd"><b>${esc(l.nama)}</b><span class="n">${u.length + lamaDi(bid, l.id)} unit</span></div>
      <div class="hint">${lamaDi(bid, l.id)} tanpa label · ${u.length} berlabel</div>
      ${u.length ? `<div class="chips">${u.map(k => `<span class="chip ok">#${pad(S.unit[k].no)}</span>`).join('')}</div>` : ''}</div>`; }).join('')}
    ${dicetak.length ? `<div class="grup"><div class="grup-hd"><b>Dicetak, belum di-scan masuk</b><span class="n">${dicetak.length}</span></div><div class="chips">${dicetak.map(k => `<span class="chip warn">#${pad(S.unit[k].no)}</span>`).join('')}</div></div>` : ''}
    <p class="hint">${keluar} unit berlabel sudah keluar.</p>
    <div class="dlg-aksi"><button class="btn" data-tutup>Tutup</button></div>`);
}

/* =================================================================
   TAB: CARI UNIT
   ================================================================= */
function tabCari() {
  ISI.innerHTML = `
  <section class="card">
    <div class="card-hd"><h2>Cari unit</h2></div>
    <p class="hint">Scan label, atau ketik kodenya. Ketik nomornya saja (mis. <span class="mono">14</span>) untuk melihat semua unit bernomor itu.</p>
    <div id="cScan"></div>
  </section>
  <section class="card" id="cHasil" hidden></section>`;
  pemindai($('#cScan'), k => {
    const out = $('#cHasil');
    if (/^#?\d{1,6}$/.test(k)) {
      const no = parseInt(k.replace('#', ''), 10);
      const list = Object.values(S.unit).filter(u => u.no === no);
      out.hidden = false;
      out.innerHTML = list.length ? `<h2>Unit bernomor #${pad(no)}</h2>${list.map(u => `<div class="ent"><button class="btn quiet sm" data-lihat="${esc(u.k)}">Lihat</button> ${esc(namaBarang(barangById(u.bid)))} ${esc(detailBarang(barangById(u.bid)))} <span class="badge b-${u.status}">${u.status}</span></div>`).join('')}`
        : `<div class="kosong">Tidak ada unit bernomor #${pad(no)}.</div>`;
      return list.length ? { jenis: 'ok', pesan: `${list.length} unit bernomor #${pad(no)}.` } : { jenis: 'warn', pesan: 'Tidak ditemukan.' };
    }
    const u = cariUnit(k);
    if (!u) { out.hidden = true; return { jenis: 'bad', pesan: `<span class="mono">${esc(k)}</span> tidak dikenal. Label ini tidak pernah dicetak.` }; }
    out.hidden = false; out.innerHTML = kartuUnit(u);
    return { jenis: 'ok', pesan: `#${pad(u.no)} ditemukan.` };
  });
  $('#cHasil').onclick = e => { const k = e.target.dataset.lihat; if (k) $('#cHasil').innerHTML = kartuUnit(S.unit[k]); };
}
function kartuUnit(u) {
  const b = barangById(u.bid);
  const ketR = r => {
    const t = r.a === 'PINDAH' ? `${esc(namaLok(r.lok))} → ${esc(namaLok(r.ke))}` : r.a === 'KELUAR' ? `dari ${esc(namaLok(r.lok))}` : r.lok ? `di ${esc(namaLok(r.lok))}` : '';
    return t + (r.ket ? ` · ${esc(r.ket)}` : '');
  };
  return `
    <div class="card-hd"><h2>#${pad(u.no)}</h2><span class="badge b-${u.status}">${u.status}</span><span class="mono sub">${esc(u.k)}</span></div>
    <p style="margin:0"><b>${esc(namaBarang(b))}</b> · ${esc(detailBarang(b))}</p>
    <p class="hint">Sekarang: ${posisiUnit(u)}</p>
    <ul class="lini">${[...u.r].reverse().map(r => `<li><time>${tglJam(r.t)}</time><div><span class="badge b-${r.a.split(' ')[0]}">${r.a}</span> ${ketR(r)}<span class="sub">oleh ${esc(r.oleh)}</span></div></li>`).join('')}</ul>`;
}

/* =================================================================
   TAB: RIWAYAT (+ ekspor Excel)
   ================================================================= */
function tabRiwayat() {
  ISI.innerHTML = `
  <section class="card">
    <div class="card-hd"><h2>Riwayat</h2>
      <div class="kanan">
        <select id="rJenis" style="width:auto"><option value="">Semua</option><option>MASUK</option><option>KELUAR</option><option>PINDAH</option><option>CETAK</option><option>HITUNG</option></select>
        <button class="btn sm" id="rExcel">Excel</button>
      </div></div>
    <div id="rDaftar"></div>
  </section>`;
  const semua = () => [
    ...S.mutasi.map(m => ({ t: m.t, jenis: m.jenis, m })),
    ...S.cetak.map(c => ({ t: c.t, jenis: 'CETAK', c })),
    ...S.audit.map(a => ({ t: a.t, jenis: 'HITUNG', a })),
  ].sort((x, y) => y.t - x.t);
  const gambar = () => {
    const j = $('#rJenis').value;
    const list = semua().filter(e => !j || e.jenis === j).slice(0, 200);
    $('#rDaftar').innerHTML = list.length ? list.map(e => {
      if (e.a) return `<div class="ent">${hasilAudit(e.a, true)}</div>`;
      if (e.c) {
        const b = barangById(e.c.bid), no = e.c.codes.map(k => S.unit[k].no);
        return `<div class="ent"><div class="ent-hd"><span class="badge b-CETAK">${e.c.ulang ? 'CETAK ULANG' : 'CETAK'}</span><time>${tglJam(e.t)}</time><span>${esc(e.c.oleh)}</span></div>
          <div>${esc(namaBarang(b))} <span class="sub" style="display:inline">${esc(detailBarang(b))}</span> · <span class="mono">${!e.c.ulang && no.length > 1 ? `#${pad(no[0])} – #${pad(no[no.length - 1])}` : no.map(n => '#' + pad(n)).join(', ')}</span> (${no.length} label)</div></div>`;
      }
      const m = e.m;
      const tempat = m.jenis === 'PINDAH' ? `${esc(namaLok(m.lok))} → ${esc(namaLok(m.ke))}` : esc(namaLok(m.lok));
      return `<div class="ent"><div class="ent-hd"><span class="badge b-${m.jenis}">${m.jenis}</span>${m.retur.length ? `<span class="badge b-RETUR">RETUR ${m.retur.length}</span>` : ''}
          <time>${tglJam(m.t)}</time><span>${tempat}</span><span>· ${esc(m.oleh)}</span>${m.ket ? `<span class="sub" style="display:inline">· ${esc(m.ket)}</span>` : ''}</div>
        ${m.units.length ? daftarUnit(m.units, { kelas: k => m.retur.includes(k) ? 'warn' : '' }) : ''}
        ${m.lama.map(l => { const b = barangById(l.bid); return `<div class="grup"><div class="grup-hd"><b>${esc(namaBarang(b))}</b><span class="sub">${esc(detailBarang(b))} · tanpa label</span><span class="n">${l.qty} unit</span></div></div>`; }).join('')}
      </div>`;
    }).join('') : '<div class="kosong">Belum ada.</div>';
  };
  $('#rJenis').onchange = gambar;
  $('#rExcel').onclick = () => eksporExcel($('#rJenis').value);
  gambar();
}
function eksporExcel(filter) {
  const baris = [];
  const isiBarang = b => ({ Merek: b.merek, 'Nama barang': b.tipe, Ukuran: b.ukuran, Warna: b.warna });
  S.mutasi.forEach(m => {
    if (filter && filter !== m.jenis) return;
    const dasar = { Tanggal: new Date(m.t), Dari: namaLok(m.lok), Ke: m.jenis === 'PINDAH' ? namaLok(m.ke) : '' };
    m.units.forEach(k => { const u = S.unit[k]; baris.push({ ...dasar, Jenis: m.retur.includes(k) ? 'RETUR' : m.jenis, ...isiBarang(barangById(u.bid)), 'Kode unit': u.k, No: u.no, Jumlah: 1, Label: 'Berlabel', Keterangan: m.ket, Oleh: m.oleh }); });
    m.lama.forEach(l => baris.push({ ...dasar, Jenis: m.jenis, ...isiBarang(barangById(l.bid)), 'Kode unit': '', No: '', Jumlah: l.qty, Label: 'Tanpa label', Keterangan: m.ket, Oleh: m.oleh }));
  });
  if (!filter || filter === 'CETAK') S.cetak.forEach(c => c.codes.forEach(k => { const u = S.unit[k]; baris.push({ Tanggal: new Date(c.t), Jenis: c.ulang ? 'CETAK ULANG' : 'CETAK', Dari: '', Ke: '', ...isiBarang(barangById(u.bid)), 'Kode unit': u.k, No: u.no, Jumlah: 1, Label: 'Berlabel', Keterangan: '', Oleh: c.oleh }); }));
  baris.sort((a, b) => a.Tanggal - b.Tanggal);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(baris, { dateNF: 'dd/mm/yyyy hh:mm' }), 'Riwayat');
  if (!filter || filter === 'HITUNG') {
    const audit = S.audit.map(a => { const b = barangById(a.bid); return { Tanggal: new Date(a.t), ...isiBarang(b), Gudang: namaLok(a.lok), Seharusnya: a.harus.length, Ditemukan: a.ketemu.length, 'Tidak ditemukan': a.hilang.map(k => '#' + pad(S.unit[k].no)).join(', '), 'Tanpa label (sistem)': a.lamaSistem, 'Tanpa label (dihitung)': a.lamaHitung ?? '', Oleh: a.oleh }; });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(audit, { dateNF: 'dd/mm/yyyy hh:mm' }), 'Hitung');
  }
  XLSX.writeFile(wb, `demo-barcode-riwayat${filter ? '-' + filter.toLowerCase() : ''}.xlsx`);
}

/* =================================================================
   TAB: BARANG (master): kode barang & stok lama awal
   ================================================================= */
function tabBarang() {
  ISI.innerHTML = `
  <section class="card">
    <div class="card-hd"><h2>Kode barang</h2></div>
    <p class="hint">Kode barang menjadi awal kode di setiap label (mis. <span class="mono">CODP180CK-0014</span>).
      Masih bisa diubah sampai label pertama dicetak, lalu dikunci 🔒 supaya label yang sudah tertempel tetap terbaca.
      Kolom "tanpa label" adalah stok lama untuk percobaan.</p>
    <input id="bCari" placeholder="Cari…" style="margin-bottom:8px">
    <div class="tbl-wrap" id="bTabel"></div>
  </section>`;
  const gambar = () => {
    const q = $('#bCari').value.trim().toUpperCase().split(/\s+/).filter(Boolean);
    const baris = S.barang.filter(b => q.every(w => `${b.tipe} ${b.ukuran} ${b.warna} ${b.kode}`.toUpperCase().includes(w)));
    $('#bTabel').innerHTML = `<table><thead><tr><th>Kode barang</th><th>Barang</th><th class="n">No. terakhir<span class="sub">demo: bisa dinaikkan</span></th>${LOKASI.map(l => `<th class="n">Tanpa label ${l.id}</th>`).join('')}</tr></thead><tbody>
      ${baris.map(b => `<tr><td style="min-width:130px">${b.kunci ? `<span class="mono">${esc(b.kode)}</span> 🔒` : `<input class="mono" data-kode="${b.id}" value="${esc(b.kode)}" maxlength="12">`}</td>
        <td>${esc(namaBarang(b))}<span class="sub">${esc(detailBarang(b))}</span></td><td class="n"><input type="number" min="0" style="width:96px" data-nomor="${b.id}" value="${S.nomor[b.id] || 0}" title="Khusus demo: lompat nomor"></td>
        ${LOKASI.map(l => `<td class="n"><input type="number" min="0" style="width:70px" data-lama="${b.id}|${l.id}" value="${lamaDi(b.id, l.id)}"></td>`).join('')}</tr>`).join('')}
    </tbody></table>`;
  };
  $('#bCari').oninput = gambar;
  $('#bTabel').onchange = e => {
    const el = e.target;
    if (el.dataset.nomor) {   // demo only: jump the counter forward to try big numbers
      const id = el.dataset.nomor, lama = S.nomor[id] || 0, v = parseInt(el.value, 10);
      if (!(v >= lama)) { toast(`Tidak bisa mundur: sudah dicetak sampai #${pad(lama)}`); el.value = lama; return; }
      S.nomor[id] = v; simpan(); toast(`Label berikutnya mulai #${pad(v + 1)}`); return;
    }
    if (el.dataset.lama) { S.lama[el.dataset.lama] = Math.max(0, parseInt(el.value, 10) || 0); simpan(); toast('Stok tanpa label disimpan'); return; }
    if (el.dataset.kode) {
      const b = barangById(el.dataset.kode), v = bersihkan(el.value).replace(/[^A-Z0-9]/g, '');
      if (v.length < 3) { toast('Kode minimal 3 huruf/angka'); el.value = b.kode; return; }
      if (S.barang.some(x => x !== b && x.kode === v)) { toast('Kode sudah dipakai barang lain'); el.value = b.kode; return; }
      b.kode = v; el.value = v; simpan(); toast('Kode barang disimpan');
    }
  };
  gambar();
}

/* ---------- dialog & demo data ---------- */
function bukaDialog(html) {
  const d = $('#dlg'); $('#dlgIsi').innerHTML = html;
  if (!d.open) d.showModal();
}
$('#dlg').addEventListener('click', e => { if (e.target.closest('[data-tutup]') || e.target === $('#dlg')) $('#dlg').close(); });

$('#btnData').onclick = () => {
  bukaDialog(`
    <h2>Data demo</h2>
    <p class="hint">Semua data demo hanya ada di perangkat ini dan tidak terhubung ke HOLA asli.
      Untuk memindahkan data ke perangkat lain (mis. label dicetak di PC, lalu scan di HP), ekspor di sini lalu impor di perangkat lain.</p>
    <div class="dlg-aksi" style="justify-content:flex-start">
      <button class="btn" id="dContoh">Isi ulang data contoh</button>
      <button class="btn quiet" id="dKosong">Mulai kosong</button>
      <button class="btn quiet" id="dEkspor">Ekspor data</button>
      <label class="btn quiet" style="display:inline-block">Impor data<input type="file" id="dImpor" accept=".json,application/json" hidden></label>
    </div>
    <p class="hint">Data contoh: label COLORADO DELUXE PILLO 180 COKLAT #0001–#0012 (10 sudah masuk HO, #0003 dan #0007 keluar, #0010 pindah ke cabang, #0011–#0012 belum masuk), dan 180 ABU #0001–#0005.</p>
    <div class="dlg-aksi"><button class="btn quiet" data-tutup>Tutup</button></div>`);
  $('#dContoh').onclick = () => { if (!confirm('Hapus data demo sekarang dan isi ulang dengan contoh?')) return; contoh(); $('#dlg').close(); render(); toast('Data contoh dimuat'); };
  $('#dKosong').onclick = () => { if (!confirm('Hapus semua data demo dan mulai kosong?')) return; S = kosong(); simpan(); $('#dlg').close(); render(); toast('Data demo dikosongkan'); };
  $('#dEkspor').onclick = () => {
    const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `hola-demo-barcode-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#dImpor').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.barang) || typeof d.unit !== 'object') throw new Error('bukan file data demo');
      if (!confirm('Ganti data demo di perangkat ini dengan isi file?')) return;
      S = d; simpan(); $('#dlg').close(); render(); toast('Data diimpor');
    } catch (err) { toast('Gagal impor: ' + err.message); }
  };
};

/* ---------- shell ---------- */
const pilihPeran = $('#pilihPeran');
pilihPeran.innerHTML = Object.entries(PERAN).map(([k, p]) => `<option value="${k}">${p.nama}</option>`).join('');
pilihPeran.onchange = () => { S.peran = pilihPeran.value; render(); toast('Login sebagai ' + PERAN[S.peran].nama); };
$('#tabs').onclick = e => { const t = e.target.dataset.tab; if (t) { S.tab = t; render(); scrollTo(0, 0); } };

function render() {
  matikanKamera(); scanAktif = null;
  const tabs = PERAN[S.peran].tabs;
  if (!tabs.includes(S.tab)) S.tab = tabs[0];
  pilihPeran.value = S.peran;
  $('#tabs').innerHTML = tabs.map(t => `<button data-tab="${t}" class="${t === S.tab ? 'on' : ''}">${TAB[t]}</button>`).join('');
  ({ label: tabLabel, masuk: () => tabMutasi('MASUK'), keluar: () => tabMutasi('KELUAR'), pindah: () => tabMutasi('PINDAH'),
     hitung: tabHitung, stok: tabStok, cari: tabCari, riwayat: tabRiwayat, barang: tabBarang })[S.tab]();
  simpan();
}

S = muat();
if (!S || !Array.isArray(S.barang)) contoh();
render();
