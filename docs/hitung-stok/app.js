/* Hitung Stok -- a standalone phone tally sheet for counting stock.
   No login, no server: the item list is typed in or imported from a
   spreadsheet, every − / + press is saved on this phone straight away, and
   the result is downloaded as Excel/CSV. Several counts (per shop, rack,
   day) can live side by side on the home screen. */

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('id-ID');
const num = v => nf.format(Math.round(Number(v) || 0));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const rapikan = s => String(s ?? '').replace(/\s+/g, ' ').trim();

const K_DAFTAR = 'hitungstok.daftar';      // index: [{id, nama, tanggal, dibuat}]
const K_SESI   = id => 'hitungstok.sesi.' + id;
const simpan = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Gagal menyimpan — penyimpanan HP penuh?', true); } };
const baca   = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const hapus  = k => { try { localStorage.removeItem(k); } catch (e) {} };

let sesi = null;          // { id, nama, tanggal, dibuat, items:[{id,kode,nama,sistem}], hitung:{id:n}, urung:[] }
let filter = 'semua';
let lihatSistem = false;
let wakeLock = null;
let calonImpor = null;    // items parsed from a picked file, awaiting "Buat"

/* ---------- small helpers ---------- */
let toastTimer = null;
function toast(msg, bad) {
  const t = $('toast');
  t.textContent = msg; t.className = bad ? 'bad' : ''; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 4200 : 2600);
}
const getar = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
const konfirmasi = msg => window.confirm(msg);
const punyaSistem = () => !!sesi && sesi.items.some(it => it.sistem !== null && it.sistem !== undefined);

function tampil(id) {
  ['pBeranda', 'pBaru', 'pHitung', 'pSelesai'].forEach(p => { $(p).hidden = p !== id; });
  window.scrollTo(0, 0);
  if (id === 'pHitung') mintaWakeLock(); else lepasWakeLock();
}
async function mintaWakeLock() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function lepasWakeLock() {
  try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
}

/* ---------- storage ---------- */
const daftar = () => baca(K_DAFTAR) || [];
function simpanSesi() {
  if (!sesi) return;
  simpan(K_SESI(sesi.id), sesi);
  const d = daftar().filter(x => x.id !== sesi.id);
  d.unshift({ id: sesi.id, nama: sesi.nama, tanggal: sesi.tanggal, dibuat: sesi.dibuat });
  simpan(K_DAFTAR, d);
}
function muatSesi(id) {
  const s = baca(K_SESI(id));
  if (!s || !Array.isArray(s.items)) return null;
  s.hitung = s.hitung || {}; s.urung = s.urung || []; s.riwayat = s.riwayat || [];
  for (const id of Object.keys(s.hitung)) {
    if (typeof s.hitung[id] === 'number') s.hitung[id] = { 1: s.hitung[id] };
  }
  return s;
}
function hapusSesiId(id) {
  hapus(K_SESI(id));
  simpan(K_DAFTAR, daftar().filter(x => x.id !== id));
}

/* ---------- beranda ---------- */
function renderBeranda() {
  const d = daftar();
  const box = $('daftarSesi');
  if (!d.length) {
    box.innerHTML = `<div class="empty"><b>Belum ada hitungan</b>Tekan "+ Hitungan baru", isi daftar barang, lalu hitung dengan tombol − dan +.</div>`;
    return;
  }
  box.innerHTML = d.map(x => {
    const s = muatSesi(x.id);
    const total = s ? s.items.length : 0;
    const n = s ? Object.keys(s.hitung).length : 0;
    const pct = total ? Math.round(n * 100 / total) : 0;
    return `<div class="sesi${n && n === total ? ' done' : ''}" data-id="${esc(x.id)}">
      <div class="info">
        <div class="nm">${esc(x.nama)}</div>
        <div class="sub">${esc(x.tanggal)} · ${num(total)} barang · ${num(n)} dihitung</div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="pct">${pct}%</div>
      <button class="hapus" data-hapus="${esc(x.id)}" aria-label="Hapus ${esc(x.nama)}" title="Hapus">🗑</button>
    </div>`;
  }).join('');
}

/* ---------- baru ---------- */
function bukaBaru() {
  $('bNama').value = '';
  $('bTgl').value = today();
  $('bTeks').value = '';
  $('bFile').value = '';
  $('bFileInfo').textContent = '';
  $('bPratinjau').textContent = '';
  $('bHint').textContent = '';
  calonImpor = null;
  const d = daftar();
  $('tabSalin').hidden = !d.length;
  $('bSumber').innerHTML = d.map(x => `<option value="${esc(x.id)}">${esc(x.nama)} (${esc(x.tanggal)})</option>`).join('');
  pilihSumber('ketik');
  tampil('pBaru');
  setTimeout(() => $('bNama').focus(), 50);
}
function pilihSumber(t) {
  document.querySelectorAll('.tab[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('srcKetik').hidden = t !== 'ketik';
  $('srcImpor').hidden = t !== 'impor';
  $('srcSalin').hidden = t !== 'salin';
  pratinjau();
}
const sumberAktif = () => document.querySelector('.tab.on').dataset.t;

// Typed list: one item per line. "Nama", "Kode ; Nama", or
// "Kode ; Nama ; Stok". Separators: ; tab |  (not comma -- names have them).
function parseTeks(teks) {
  const items = [];
  teks.split(/\r?\n/).forEach(baris => {
    const b = baris.trim();
    if (!b) return;
    const bagian = b.split(/\s*[;\t|]\s*/).map(rapikan);
    let kode = '', nama = '', sistem = null;
    if (bagian.length === 1) nama = bagian[0];
    else { kode = bagian[0]; nama = bagian[1]; if (bagian.length > 2 && bagian[2] !== '') sistem = angka(bagian[2]); }
    if (!nama && !kode) return;
    items.push({ id: uid(), kode, nama: nama || kode, sistem });
  });
  return items;
}
function angka(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
// Spreadsheet: find the header row by its titles; without one, fall back to
// column A = code, column B = name (or A = name when there is one column).
function parseSheet(aoa) {
  const rows = aoa.filter(r => r && r.some(c => rapikan(c) !== ''));
  if (!rows.length) return [];
  const low = rows[0].map(c => rapikan(c).toLowerCase());
  const cari = (...k) => low.findIndex(h => k.includes(h));
  let iKode = cari('kode', 'sku', 'code', 'kode barang', 'artikel', 'id');
  let iNama = cari('nama', 'barang', 'nama barang', 'name', 'item', 'produk', 'product', 'deskripsi', 'description');
  let iSis  = cari('sistem', 'stok', 'stock', 'stok sistem', 'qty', 'jumlah', 'saldo', 'stok awal');
  let mulai = 1;
  const adaHeader = iKode >= 0 || iNama >= 0;
  if (!adaHeader) {
    mulai = 0;
    const lebar = Math.max(...rows.map(r => r.length));
    if (lebar >= 2) { iKode = 0; iNama = 1; iSis = lebar >= 3 ? 2 : -1; }
    else { iKode = -1; iNama = 0; iSis = -1; }
  } else if (iNama < 0) { iNama = iKode; iKode = -1; }
  const items = [];
  for (let r = mulai; r < rows.length; r++) {
    const row = rows[r];
    const kode = iKode >= 0 ? rapikan(row[iKode]) : '';
    const nama = rapikan(row[iNama]);
    if (!nama && !kode) continue;
    items.push({ id: uid(), kode, nama: nama || kode, sistem: iSis >= 0 ? angka(row[iSis]) : null });
  }
  return items;
}
async function bacaFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return parseSheet(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }));
}
function itemsDariSumber() {
  const t = sumberAktif();
  if (t === 'ketik') return parseTeks($('bTeks').value);
  if (t === 'impor') return calonImpor || [];
  const s = muatSesi($('bSumber').value);
  return s ? s.items.map(it => ({ id: uid(), kode: it.kode, nama: it.nama, sistem: it.sistem })) : [];
}
function pratinjau() {
  const items = itemsDariSumber();
  const sis = items.filter(it => it.sistem !== null).length;
  $('bPratinjau').textContent = items.length
    ? `${num(items.length)} barang siap dihitung${sis ? ` · ${num(sis)} punya stok sistem (selisih akan dihitung)` : ''}.`
    : '';
}
function buatSesi() {
  const nama = rapikan($('bNama').value);
  if (!nama) { $('bHint').textContent = 'Isi nama hitungan dulu.'; $('bNama').focus(); return; }
  const items = itemsDariSumber();
  if (!items.length) { $('bHint').textContent = 'Daftar barang masih kosong.'; return; }
  sesi = { id: uid(), nama, tanggal: $('bTgl').value || today(), dibuat: new Date().toISOString(), items, hitung: {}, urung: [], riwayat: [] };
  simpanSesi();
  bukaHitung();
}

/* ---------- hitung ---------- */
// The same item can sit on both floors, so a count is kept per floor and
// "fisik" is their sum. An item counts as done once either floor is entered.
const LANTAI = [1, 2];
let lantaiAktif = 1;
const sudah = it => Object.prototype.hasOwnProperty.call(sesi.hitung, it.id);
const fisikLantai = (it, l) => (sudah(it) && sesi.hitung[it.id][l] !== undefined) ? sesi.hitung[it.id][l] : null;
const fisik = it => sudah(it) ? LANTAI.reduce((t, l) => t + (sesi.hitung[it.id][l] || 0), 0) : null;
function setLantai(l) {
  lantaiAktif = l;
  document.querySelectorAll('#segLantai button').forEach(b => b.classList.toggle('on', Number(b.dataset.l) === l));
  renderList();
}
const punyaSis = it => it.sistem !== null && it.sistem !== undefined;

function bukaHitung() {
  filter = 'semua';
  lantaiAktif = 1;
  document.querySelectorAll('#segLantai button').forEach(b => b.classList.toggle('on', b.dataset.l === '1'));
  document.querySelectorAll('.chip[data-f]').forEach(c => c.classList.toggle('on', c.dataset.f === 'semua'));
  $('cari').value = '';
  $('hNama').textContent = sesi.nama;
  const ada = punyaSistem();
  $('chipSelisih').hidden = !ada;
  $('btnLihat').hidden = !ada;
  renderList();
  tampil('pHitung');
}
function itemsTersaring() {
  const q = $('cari').value.trim().toLowerCase();
  return sesi.items.filter(it => {
    if (q && !(it.kode + ' ' + it.nama).toLowerCase().includes(q)) return false;
    if (filter === 'belum') return !sudah(it);
    if (filter === 'sudah') return sudah(it);
    if (filter === 'selisih') return sudah(it) && punyaSis(it) && fisik(it) !== it.sistem;
    return true;
  });
}
function htmlSistem(it) {
  if (!lihatSistem || !punyaSis(it)) return '';
  const f = fisik(it);
  const d = f === null ? null : f - it.sistem;
  const beda = d === null ? '' : ` · selisih <span class="beda ${d === 0 ? 'pos' : 'neg'}">${d > 0 ? '+' : ''}${num(d)}</span>`;
  return `<div class="sis">sistem <b>${num(it.sistem)}</b>${beda}</div>`;
}
function htmlLantai(it) {
  if (!sudah(it)) return '';
  const bag = LANTAI.map(l => {
    const v = fisikLantai(it, l);
    return `<span class="${l === lantaiAktif ? 'on' : ''}">L${l} ${v === null ? '·' : num(v)}</span>`;
  }).join(' · ');
  return `<div class="lt">${bag} · total <b>${num(fisik(it))}</b></div>`;
}
function htmlItem(it) {
  const f = fisikLantai(it, lantaiAktif);
  const tot = fisik(it);
  const cls = 'item' + (tot === null ? '' : ' done') + (tot === 0 ? ' zero' : '');
  return `<div class="${cls}" data-id="${esc(it.id)}">
    <div class="info" data-act="ubah" title="Ketuk untuk ubah / hapus">
      <div class="nm">${esc(it.nama)}</div>
      ${it.kode ? `<div class="sku">${esc(it.kode)}</div>` : ''}
      ${htmlLantai(it)}
      ${htmlSistem(it)}
    </div>
    <div class="ctr">
      <button class="pm minus" data-act="-1" aria-label="Kurangi ${esc(it.nama)}">−</button>
      <button class="n" data-act="ketik" aria-label="Ketik jumlah ${esc(it.nama)} lantai ${lantaiAktif}">${f === null ? '·' : num(f)}</button>
      <button class="pm plus" data-act="+1" aria-label="Tambah ${esc(it.nama)}">+</button>
    </div>
  </div>`;
}
function renderList() {
  const items = itemsTersaring();
  const list = $('list');
  if (!items.length) {
    const pesan = filter === 'belum' ? 'Semua barang sudah dihitung.' : filter === 'selisih' ? 'Tidak ada selisih.' : 'Coba kata kunci lain, atau tambah barang di bawah.';
    list.innerHTML = `<div class="empty"><b>Tidak ada barang</b>${pesan}</div>`;
  } else {
    list.innerHTML = items.map(htmlItem).join('');
  }
  $('btnLihat').textContent = 'Stok sistem: ' + (lihatSistem ? 'tampil' : 'sembunyi');
  renderProgres();
  renderRiwayat();
}
function renderProgres() {
  const n = Object.keys(sesi.hitung).length;
  $('hProgres').textContent = `${n} / ${sesi.items.length} dihitung`;
  $('btnUrungkan').disabled = !sesi.urung.length;
}
// Re-draw one card in place rather than the whole list, so a press never
// makes the list jump under your thumb.
function segarkanKartu(id) {
  const el = $('list').querySelector(`.item[data-id="${CSS.escape(id)}"]`);
  const it = sesi.items.find(x => x.id === id);
  if (!el) return;
  if (!it) { el.remove(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = htmlItem(it);
  el.replaceWith(tmp.firstElementChild);
}
function setHitung(id, nilai, catatUrung = true, lantai = lantaiAktif) {
  const rec = sesi.hitung[id];
  const prev = (rec && rec[lantai] !== undefined) ? rec[lantai] : null;
  if (catatUrung) {
    sesi.urung.push({ id, lantai, prev });
    if (sesi.urung.length > 100) sesi.urung.shift();
  }
  if (nilai === null) {
    if (rec) { delete rec[lantai]; if (!Object.keys(rec).length) delete sesi.hitung[id]; }
  } else {
    sesi.hitung[id] = { ...(rec || {}), [lantai]: nilai };
  }
  catatRiwayat(id, prev, nilai, catatUrung ? '' : 'urung', lantai);
  simpanSesi();
  segarkanKartu(id);
  renderProgres();
}
// Every change to a count is logged, newest first, so a mis-press or a
// "wait, did I already count that shelf?" can be checked on the spot.
function catatRiwayat(id, dari, ke, jenis, lantai = lantaiAktif) {
  const it = sesi.items.find(x => x.id === id);
  sesi.riwayat.unshift({ t: Date.now(), id, nama: it ? it.nama : '?', dari, ke, jenis, lantai });
  if (sesi.riwayat.length > 500) sesi.riwayat.length = 500;
  renderRiwayat();
}
const jam = t => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
function labelRiwayat(r) {
  if (r.jenis === 'urung') return { cls: 'urung', teks: '↩ ' + (r.ke === null ? '—' : num(r.ke)) };
  if (r.jenis === 'baru') return { cls: 'tambah', teks: 'baru +1' };
  if (r.ke === null) return { cls: 'urung', teks: 'dikosongkan' };
  const d = r.ke - (r.dari === null ? 0 : r.dari);
  if (r.dari !== null && (d === 1 || d === -1)) return { cls: d > 0 ? 'tambah' : 'kurang', teks: (d > 0 ? '+' : '−') + '1 → ' + num(r.ke) };
  if (r.dari === null && r.ke === 1) return { cls: 'tambah', teks: '+1 → 1' };
  if (r.dari === null && r.ke === 0) return { cls: 'kurang', teks: 'kosong (0)' };
  return { cls: 'ketik', teks: (r.dari === null ? '·' : num(r.dari)) + ' → ' + num(r.ke) };
}
function renderRiwayat() {
  const box = $('riwayat');
  const list = sesi.riwayat;
  if (!list.length) { box.hidden = true; return; }
  box.hidden = false;
  const tampilN = 50;
  $('riwayatJudul').textContent = `Riwayat (${num(list.length)})`;
  $('riwayatIsi').innerHTML = list.slice(0, tampilN).map(r => {
    const l = labelRiwayat(r);
    return `<div class="rw" data-id="${esc(r.id)}"><span class="jam">${jam(r.t)}</span><span class="nm">${esc(r.nama)}${r.lantai ? ` <small>L${r.lantai}</small>` : ''}</span><b class="${l.cls}">${l.teks}</b></div>`;
  }).join('') + (list.length > tampilN ? `<div class="hint">${num(list.length - tampilN)} catatan lebih lama tidak ditampilkan.</div>` : '');
}
function onListClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const id = el.closest('.item').dataset.id;
  const it = sesi.items.find(x => x.id === id);
  if (!it) return;
  const cur = fisikLantai(it, lantaiAktif);
  const act = el.dataset.act;
  if (act === 'ubah') return ubahBarang(it);
  if (act === 'ketik') {
    const raw = window.prompt(`Jumlah fisik ${it.nama} di lantai ${lantaiAktif}:`, cur === null ? '' : String(cur));
    if (raw === null) return;
    const t = raw.trim();
    if (t === '') { setHitung(id, null); return; }
    const n = Math.round(Number(t.replace(/[^\d.-]/g, '')));
    if (!Number.isFinite(n) || n < 0) return toast('Angka tidak valid.', true);
    setHitung(id, n);
    return;
  }
  const d = Number(act);
  // First press on an untouched item: + counts one, − marks it "0, checked"
  // -- pressing − is how you say "I looked, the shelf is empty".
  const next = Math.max(0, (cur === null ? 0 : cur) + d);
  getar(d > 0 ? 12 : 20);
  setHitung(id, next);
}
function urungkan() {
  const u = sesi.urung.pop();
  if (!u) return;
  setHitung(u.id, u.prev, false, u.lantai || 1);
  toast('Dibatalkan.');
}
function ubahBarang(it) {
  const raw = window.prompt('Ubah nama barang (kosongkan lalu OK untuk menghapus):', it.nama);
  if (raw === null) return;
  const nama = rapikan(raw);
  if (!nama) {
    if (!konfirmasi(`Hapus "${it.nama}" dari daftar?`)) return;
    sesi.items = sesi.items.filter(x => x.id !== it.id);
    delete sesi.hitung[it.id];
    sesi.urung = sesi.urung.filter(u => u.id !== it.id);
    sesi.riwayat = sesi.riwayat.filter(r => r.id !== it.id);
    simpanSesi(); segarkanKartu(it.id); renderProgres(); renderRiwayat();
    toast('Barang dihapus.');
    return;
  }
  it.nama = nama;
  simpanSesi(); segarkanKartu(it.id);
}
// Something on the shelf that is not on the list yet.
function tambahBarang() {
  const raw = window.prompt('Nama barang baru (boleh "Kode ; Nama"):', '');
  if (raw === null) return;
  const [it] = parseTeks(raw);
  if (!it) return;
  const cari = $('cari').value.trim().toLowerCase();
  sesi.items.push(it);
  sesi.hitung[it.id] = { [lantaiAktif]: 1 };   // you are holding one -- start there
  sesi.urung.push({ id: it.id, lantai: lantaiAktif, prev: null });
  catatRiwayat(it.id, null, 1, 'baru');
  simpanSesi();
  if (cari && !(it.kode + ' ' + it.nama).toLowerCase().includes(cari)) $('cari').value = '';
  renderList();
  const el = $('list').querySelector(`.item[data-id="${CSS.escape(it.id)}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------- selesai ---------- */
function ringkas() {
  const isi = sesi.items.filter(sudah);
  return {
    isi,
    belum: sesi.items.filter(it => !sudah(it)),
    unit: isi.reduce((s, it) => s + fisik(it), 0),
    lantai: LANTAI.map(l => isi.reduce((s, it) => s + (fisikLantai(it, l) || 0), 0)),
    beda: isi.filter(it => punyaSis(it) && fisik(it) !== it.sistem)
  };
}
function renderSelesai() {
  const r = ringkas();
  const ada = punyaSistem();
  $('sSub').textContent = `${sesi.nama} · ${sesi.tanggal}`;
  $('sDihitung').textContent = num(r.isi.length);
  $('sBelum').textContent = num(r.belum.length);
  $('sUnit').textContent = num(r.unit);
  $('sL1').textContent = num(r.lantai[0]);
  $('sL2').textContent = num(r.lantai[1]);
  $('statSelisih').hidden = !ada;
  $('sSelisih').textContent = num(r.beda.length);
  $('sCatatan').textContent = r.belum.length
    ? `${r.belum.length} barang belum dihitung — di file hasil kolom Fisik-nya kosong. Tekan Kembali dan pilih filter "Belum" untuk melihatnya.`
    : 'Semua barang sudah dihitung.';
  $('kartuSelisih').hidden = !ada || !r.beda.length;
  if (ada && r.beda.length) {
    $('tblSelisih').innerHTML = r.beda.map(it => {
      const d = fisik(it) - it.sistem;
      return `<div class="sel-row"><div class="nm">${esc(it.nama)}${it.kode ? `<small>${esc(it.kode)}</small>` : ''}</div>
        <div class="k">sistem<b>${num(it.sistem)}</b></div>
        <div class="k">fisik<b>${num(fisik(it))}</b></div>
        <div class="k ${d > 0 ? 'pos' : 'neg'}">selisih<b>${d > 0 ? '+' : ''}${num(d)}</b></div></div>`;
    }).join('');
  }
  $('btnBagikan').hidden = !(navigator.share && navigator.canShare);
}

// Result table: Kode, Barang, [Sistem], Fisik, [Selisih] -- the same shape
// most stock systems (and the desktop Buku Gudang Opname import) accept.
function barisHasil() {
  const ada = punyaSistem();
  return sesi.items.map(it => {
    const f = fisik(it);
    const r = { Kode: it.kode, Barang: it.nama };
    if (ada) r.Sistem = punyaSis(it) ? it.sistem : '';
    r['Lantai 1'] = fisikLantai(it, 1) ?? '';
    r['Lantai 2'] = fisikLantai(it, 2) ?? '';
    r.Fisik = f === null ? '' : f;
    if (ada) r.Selisih = (f === null || !punyaSis(it)) ? '' : f - it.sistem;
    return r;
  });
}
const namaFile = ext => `hitung-stok-${sesi.nama.replace(/[^\w\-]+/g, '_')}-${sesi.tanggal}.${ext}`;
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function blobXlsx() {
  const ws = XLSX.utils.json_to_sheet(barisHasil());
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hitung Stok');
  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: MIME_XLSX });
}
function blobCsv() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = barisHasil();
  const head = Object.keys(rows[0] || { Kode: '', Barang: '', 'Lantai 1': '', 'Lantai 2': '', Fisik: '' });
  const bom = String.fromCharCode(0xFEFF);   // so Excel opens it as UTF-8
  const teks = bom + head.map(q).join(';') + '\r\n' + rows.map(r => head.map(h => q(r[h])).join(';')).join('\r\n');
  return new Blob([teks], { type: 'text/csv;charset=utf-8' });
}
function unduh(blob, nama) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function bagikan() {
  try {
    const file = new File([blobXlsx()], namaFile('xlsx'), { type: MIME_XLSX });
    if (!navigator.canShare({ files: [file] })) return unduh(blobXlsx(), namaFile('xlsx'));
    await navigator.share({ files: [file], title: 'Hasil hitung stok', text: `${sesi.nama} ${sesi.tanggal}` });
  } catch (e) { if (e && e.name !== 'AbortError') unduh(blobXlsx(), namaFile('xlsx')); }
}
function hapusSesi() {
  if (!konfirmasi(`Hapus hitungan "${sesi.nama}" dari HP? Angka yang belum diunduh akan hilang.`)) return;
  hapusSesiId(sesi.id);
  sesi = null;
  renderBeranda();
  tampil('pBeranda');
}

/* ---------- wiring ---------- */
(function start() {
  $('btnBaru').onclick = bukaBaru;
  $('daftarSesi').onclick = e => {
    const tombolHapus = e.target.closest('[data-hapus]');
    if (tombolHapus) {
      const x = daftar().find(s => s.id === tombolHapus.dataset.hapus);
      if (x && konfirmasi(`Hapus hitungan "${x.nama}" dari HP? Angka yang belum diunduh akan hilang.`)) {
        hapusSesiId(x.id);
        renderBeranda();
        toast('Hitungan dihapus.');
      }
      return;
    }
    const el = e.target.closest('.sesi');
    if (!el) return;
    const s = muatSesi(el.dataset.id);
    if (!s) { toast('Hitungan ini rusak / tidak terbaca.', true); hapusSesiId(el.dataset.id); renderBeranda(); return; }
    sesi = s;
    bukaHitung();
  };

  $('btnBaruKembali').onclick = () => { renderBeranda(); tampil('pBeranda'); };
  document.querySelectorAll('.tab[data-t]').forEach(b => { b.onclick = () => pilihSumber(b.dataset.t); });
  $('bTeks').oninput = pratinjau;
  $('bSumber').onchange = pratinjau;
  $('btnPilihFile').onclick = () => $('bFile').click();
  $('bFile').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      calonImpor = await bacaFile(f);
      $('bFileInfo').textContent = `${f.name}: ${num(calonImpor.length)} barang terbaca.`;
      if (!$('bNama').value.trim()) $('bNama').value = f.name.replace(/\.[^.]+$/, '');
    } catch (err) {
      calonImpor = null;
      $('bFileInfo').textContent = 'File tidak terbaca: ' + (err.message || err);
    }
    pratinjau();
  };
  $('btnBuat').onclick = buatSesi;

  $('btnKeBeranda').onclick = () => { renderBeranda(); tampil('pBeranda'); };
  $('btnUrungkan').onclick = urungkan;
  $('btnSelesai').onclick = () => { renderSelesai(); tampil('pSelesai'); };
  $('list').onclick = onListClick;
  $('cari').oninput = renderList;
  document.querySelectorAll('.chip[data-f]').forEach(c => {
    c.onclick = () => {
      filter = c.dataset.f;
      document.querySelectorAll('.chip[data-f]').forEach(x => x.classList.toggle('on', x === c));
      renderList();
    };
  });
  $('btnLihat').onclick = () => { lihatSistem = !lihatSistem; renderList(); };
  document.querySelectorAll('#segLantai button').forEach(b => { b.onclick = () => setLantai(Number(b.dataset.l)); });
  $('btnTambahBarang').onclick = tambahBarang;
  $('riwayatIsi').onclick = e => {
    const row = e.target.closest('.rw');
    if (!row) return;
    const id = row.dataset.id;
    let el = $('list').querySelector(`.item[data-id="${CSS.escape(id)}"]`);
    if (!el) {
      $('cari').value = ''; filter = 'semua';
      document.querySelectorAll('.chip[data-f]').forEach(x => x.classList.toggle('on', x.dataset.f === 'semua'));
      renderList();
      el = $('list').querySelector(`.item[data-id="${CSS.escape(id)}"]`);
    }
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('sorot'); setTimeout(() => el.classList.remove('sorot'), 1200);
  };
  $('btnHapusRiwayat').onclick = () => {
    if (!konfirmasi('Kosongkan riwayat? Angka hitungan tidak berubah.')) return;
    sesi.riwayat = []; simpanSesi(); renderRiwayat();
  };

  $('btnKeHitung').onclick = () => { renderList(); tampil('pHitung'); };
  $('btnUnduhXlsx').onclick = () => unduh(blobXlsx(), namaFile('xlsx'));
  $('btnUnduhCsv').onclick = () => unduh(blobCsv(), namaFile('csv'));
  $('btnBagikan').onclick = bagikan;
  $('btnHapusSesi').onclick = hapusSesi;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('pHitung').hidden) mintaWakeLock(); });

  renderBeranda();
  tampil('pBeranda');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
