'use strict';
/* ============================================================
   Keuangan Keluarga — aplikasi HP (PWA)
   Bicara ke Google Apps Script (Code.gs) yang menulis ke spreadsheet.
   ============================================================ */

/* ---------- Util ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  del(k) { try { localStorage.removeItem(k); } catch (_) {} }
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Math.round(Math.abs(n)).toLocaleString('id-ID');
const rp = n => (n < 0 ? '-' : '') + 'Rp ' + num(n);
const short = n => {
  const a = Math.abs(n), f = v => v.toLocaleString('id-ID', { maximumFractionDigits: 1 });
  return a >= 1e9 ? f(a / 1e9) + ' M' : a >= 1e6 ? f(a / 1e6) + ' jt' : a >= 1e3 ? f(a / 1e3) + ' rb' : String(Math.round(a));
};
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((fromIso(b) - fromIso(a)) / 864e5);
const todayIso = () => iso(new Date());
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const fmtShort = s => { const d = fromIso(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtLong = s => { const d = fromIso(s); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const I = {
  up: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M17 7 7 17M16 17H7V8"/></svg>',
  swap: '<svg viewBox="0 0 24 24"><path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/></svg>',
  sync: '<svg viewBox="0 0 24 24"><path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9M3.5 12A8.5 8.5 0 0 1 18.100 6.100M18.500 2.500v4h-4M5.500 21.500v-4h4"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><path d="M4 7.500A2.500 2.500 0 0 1 6.500 5H18v3M4 7.500V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H6.500A2.500 2.500 0 0 1 4 5.500M16 13.500h.01"/></svg>'
};
const JI = { Pemasukan: I.down, Pengeluaran: I.up, Transfer: I.swap };
const COLORS = ['#4f7cff', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#22c55e', '#06b6d4', '#f97316', '#94a3b8'];
const DEF = {
  Pengeluaran: ['Makan & Minum', 'Transportasi & BBM', 'Belanja Rumah Tangga', 'Tagihan', 'Lain-lain'],
  Pemasukan: ['Gaji', 'Usaha', 'Lainnya'], dompet: ['Tunai']
};

/* ---------- State ---------- */
const S = {
  cfg: store.get('cfg', null),
  meta: { kategori: [], dompet: [], anggota: [], target: {} },
  tx: [], loaded: false, syncing: false, error: null, last: 0,
  tab: 'home',
  period: store.get('period', { type: 'month', from: '', to: '' }),
  trend: 'd',
  hist: { q: '', cat: '', from: '', to: '', limit: 60 },
  pending: store.get('pending', []),
  prefs: store.get('prefs', {})
};
let installEvt = null;

const T = () => S.tx.concat(S.pending.map(p => ({ ...p.data, id: 'p' + p.rid, pending: true })));
const seq = t => (typeof t.id === 'number' ? t.id : 1e9);
const cmp = (a, b) => b.tanggal.localeCompare(a.tanggal) || seq(b) - seq(a);
const wallets = () => S.meta.dompet.length ? S.meta.dompet.map(d => d.nama) : DEF.dompet;
const members = () => S.meta.anggota;
function cats(jenis) {
  const l = S.meta.kategori.filter(k => k.jenis === jenis).map(k => k.nama);
  const base = l.length ? l : DEF[jenis] || [];
  const cnt = {}, since = iso(addDays(new Date(), -120));
  T().forEach(t => { if (t.jenis === jenis && t.tanggal >= since) cnt[t.kategori] = (cnt[t.kategori] || 0) + 1; });
  return base.slice().sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0));   // yang paling sering dipakai di depan
}

/* ---------- API ---------- */
async function api(action, payload = {}) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 30000);
  let res;
  try {
    res = await fetch(S.cfg.url, {
      method: 'POST', redirect: 'follow', signal: ctl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },     // tanpa preflight CORS
      body: JSON.stringify({ token: S.cfg.token, action, ...payload })
    });
  } finally { clearTimeout(timer); }
  let data;
  try { data = await res.json(); }
  catch (_) { const e = new Error("Alamat API tidak valid atau akses belum diatur ke 'Siapa saja' (Anyone)."); e.server = true; throw e; }
  if (!data.ok) { const e = new Error(data.error || 'Gagal'); e.code = data.code; e.server = true; throw e; }
  return data;
}
const normTx = t => ({ ...t, jumlah: Number(t.jumlah) || 0 });
function apply(r) {
  S.meta = r.meta || S.meta; S.tx = (r.data || []).map(normTx);
  S.loaded = true; S.last = Date.now(); S.error = null;
  store.set('cache', { meta: S.meta, tx: S.tx, t: S.last });
}
async function refresh(silent = false) {
  if (!S.cfg || S.syncing) return;
  S.syncing = true; document.body.classList.add('syncing');
  try { apply(await api('init')); }
  catch (e) {
    if (e.code === 'AUTH') { S.cfg = null; store.del('cfg'); toast('Kode rahasia ditolak. Hubungkan ulang.', 'err'); }
    else { S.error = e.server ? e.message : 'Tidak ada koneksi'; if (!silent) toast('Gagal sinkron: ' + S.error, 'err'); }
  } finally { S.syncing = false; document.body.classList.remove('syncing'); render(); }
}
async function flush() {
  if (S.flushing || !S.pending.length || !S.cfg) return;
  S.flushing = true; let sent = 0;
  try {
    while (S.pending.length) {
      const p = S.pending[0];
      try { await api('add', { data: p.data, rid: p.rid }); sent++; }
      catch (e) { if (!e.server || e.code === 'AUTH' || e.code === 'LOCK') throw e; toast('Transaksi tertunda ditolak: ' + e.message, 'err'); }
      S.pending.shift(); store.set('pending', S.pending);
    }
  } catch (_) { /* masih offline, coba lagi nanti */ }
  S.flushing = false;
  if (sent) { toast(sent + ' transaksi tertunda sudah terkirim', 'ok'); await refresh(true); } else render();
}

/* ---------- Periode & agregasi ---------- */
function getRange(p = S.period) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  let from, to;
  if (p.type === 'day') from = to = t;
  else if (p.type === 'week') { from = addDays(t, -((t.getDay() + 6) % 7)); to = addDays(from, 6); }
  else if (p.type === 'month') { from = new Date(t.getFullYear(), t.getMonth(), 1); to = new Date(t.getFullYear(), t.getMonth() + 1, 0); }
  else {
    from = fromIso(p.from || iso(new Date(t.getFullYear(), t.getMonth(), 1))); to = fromIso(p.to || iso(t));
    if (to < from) [from, to] = [to, from];
  }
  const f = iso(from), e = iso(to), last = e > todayIso() ? todayIso() : e;
  return { from: f, to: e, last, elapsed: Math.max(1, daysBetween(f, last) + 1), len: daysBetween(f, e) + 1 };
}
function prevRange(p, r) {
  const f = fromIso(r.from); let a, b;
  if (p.type === 'day') { a = b = addDays(f, -1); }
  else if (p.type === 'week') { a = addDays(f, -7); b = addDays(a, r.elapsed - 1); }
  else if (p.type === 'month') {
    a = new Date(f.getFullYear(), f.getMonth() - 1, 1);
    const end = new Date(f.getFullYear(), f.getMonth(), 0); b = addDays(a, r.elapsed - 1); if (b > end) b = end;
  } else { b = addDays(f, -1); a = addDays(b, -(r.len - 1)); }
  return { from: iso(a), to: iso(b) };
}
const periodLabel = r => r.from === r.to ? fmtLong(r.from) : `${fmtShort(r.from)} – ${fmtLong(r.to)}`;
const within = (a, b) => T().filter(t => t.tanggal >= a && t.tanggal <= b);
function agg(list) {
  const a = { in: 0, out: 0, cat: {} };
  list.forEach(t => {
    if (t.jenis === 'Pemasukan') a.in += t.jumlah;
    else if (t.jenis === 'Pengeluaran') { a.out += t.jumlah; const k = t.kategori || 'Tanpa kategori'; a.cat[k] = (a.cat[k] || 0) + t.jumlah; }
  });
  return a;
}
function balances() {
  const m = {}; S.meta.dompet.forEach(d => { m[d.nama] = d.saldoAwal; });
  const add = (k, v) => { if (k in m) m[k] += v; };
  T().forEach(t => {
    if (t.jenis === 'Pemasukan') add(t.dompet, t.jumlah);
    else if (t.jenis === 'Pengeluaran') add(t.dompet, -t.jumlah);
    else if (t.jenis === 'Transfer') { add(t.dompet, -t.jumlah); add(t.tujuan, t.jumlah); }
  });
  return m;
}

/* ---------- Potongan tampilan ---------- */
const head = (title, sub) => `
  ${S.error ? `<div class="banner">Offline — menampilkan data tersimpan${S.last ? ' (' + fmtShort(iso(new Date(S.last))) + ')' : ''}. ${esc(S.error)}</div>` : ''}
  <header class="top"><div><p>${esc(sub)}</p><h1>${esc(title)}</h1></div>
  <button class="icon-btn sync-btn" data-act="sync" aria-label="Sinkronkan data">${I.sync}</button></header>`;

function periodBar() {
  const P = [['day', 'Hari ini'], ['week', 'Minggu ini'], ['month', 'Bulan ini'], ['custom', 'Custom']];
  return `<div class="chips">${P.map(([k, l]) => `<button class="chip${S.period.type === k ? ' on' : ''}" data-p="${k}">${l}</button>`).join('')}</div>` +
    (S.period.type === 'custom' ? `<div class="custom"><input type="date" id="pf" value="${S.period.from}" aria-label="Dari tanggal"><i>–</i><input type="date" id="pt" value="${S.period.to}" aria-label="Sampai tanggal"></div>` : '');
}
function txRow(t) {
  const isT = t.jenis === 'Transfer';
  const title = isT ? `${t.dompet} → ${t.tujuan}` : (t.kategori || 'Tanpa kategori');
  const sub = [t.keterangan, !isT && t.dompet, t.oleh].filter(Boolean).join(' · ');
  const sign = t.jenis === 'Pemasukan' ? '+' : t.jenis === 'Pengeluaran' ? '−' : '';
  return `<button class="tx" data-id="${esc(t.id)}"><span class="ico ${t.jenis}">${JI[t.jenis] || ''}</span>
    <span class="tx-m"><b>${esc(title)}${t.pending ? '<span class="tag">menunggu</span>' : ''}</b><small>${esc(sub || fmtShort(t.tanggal))}</small></span>
    <span class="tx-a ${t.jenis}">${sign}${rp(t.jumlah)}</span></button>`;
}
const empty = (title, text, btn) => `<div class="empty">${I.wallet}<b>${title}</b><p>${text}</p>${btn ? '<button class="btn primary" data-act="add">Tambah transaksi</button>' : ''}</div>`;
const delta = (d, bad) => d === null ? '<b class="mut">–</b>' : `<b class="${d === 0 ? 'mut' : ((d > 0) === bad ? 'neg' : 'pos')}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${Math.abs(d)}%</b>`;
const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null;

/* ---------- Tampilan: Beranda ---------- */
function viewHome() {
  if (!S.loaded) return head('Halo', 'Ringkasan keuangan') + '<div class="sk" style="height:190px"></div><div class="ins" style="margin-top:20px"><div class="sk" style="height:90px"></div><div class="sk" style="height:90px"></div></div>';
  const r = getRange(), cur = agg(within(r.from, r.to)), pr = prevRange(S.period, r), prev = agg(within(pr.from, pr.to));
  const top = Object.entries(cur.cat).sort((a, b) => b[1] - a[1])[0];
  const bal = balances(), total = Object.values(bal).reduce((a, b) => a + b, 0);
  const recent = T().sort(cmp).slice(0, 5), net = cur.in - cur.out;
  return `${head('Halo' + (S.prefs.oleh ? ', ' + S.prefs.oleh : ''), 'Ringkasan keuangan')}
  ${periodBar()}
  <section class="hero">
    <p class="hero-l">Saldo bersih, ${periodLabel(r)}</p>
    <h2 class="hero-v">${rp(net)}</h2>
    <div class="hero-g">
      <div class="glass"><span class="dot">${I.down}</span><small>Pemasukan</small><b>${rp(cur.in)}</b></div>
      <div class="glass"><span class="dot">${I.up}</span><small>Pengeluaran</small><b>${rp(cur.out)}</b></div>
    </div>
  </section>
  <h3 class="sec">Insight</h3>
  <div class="ins">
    <article class="card"><small>Pengeluaran terbesar</small>${top ? `<b>${esc(top[0])}</b><p>${rp(top[1])}, ${Math.round(top[1] / cur.out * 100)}% dari total</p>` : '<b>–</b><p>Belum ada pengeluaran</p>'}</article>
    <article class="card"><small>Rata-rata harian</small><b>${rp(cur.out / r.elapsed)}</b><p>pengeluaran per hari (${r.elapsed} hari)</p></article>
    <article class="card wide"><small>Dibanding periode sebelumnya (${periodLabel(pr)})</small>
      <div class="cmp">
        <div><em>Pengeluaran</em>${delta(pct(cur.out, prev.out), true)}<p>sebelumnya ${rp(prev.out)}</p></div>
        <div><em>Pemasukan</em>${delta(pct(cur.in, prev.in), false)}<p>sebelumnya ${rp(prev.in)}</p></div>
      </div></article>
  </div>
  ${S.meta.dompet.length ? `<h3 class="sec">Saldo dompet <span>${rp(total)}</span></h3>
  <div class="wallets">${S.meta.dompet.map(d => `<div class="wal"><small>${esc(d.nama)}</small><b>${rp(bal[d.nama] || 0)}</b></div>`).join('')}</div>` : ''}
  <h3 class="sec">Transaksi terbaru <button class="link" data-tab="hist">Lihat semua</button></h3>
  <div class="list">${recent.length ? recent.map(txRow).join('') : empty('Belum ada transaksi', 'Catat transaksi pertamamu, cukup beberapa detik.', true)}</div>`;
}

/* ---------- Grafik SVG ---------- */
function donut(items, total) {
  const R = 52, C = 2 * Math.PI * R; let off = 0;
  const segs = items.map((it, i) => {
    const len = it[1] / total * C;
    const s = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="18" stroke-dasharray="${Math.max(len - 1.5, 0.1)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;
    off += len; return s;
  }).join('');
  return `<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Komposisi pengeluaran"><circle cx="70" cy="70" r="${R}" fill="none" stroke="#f1f3fb" stroke-width="18"/>${segs}
    <text x="70" y="66" text-anchor="middle" font-size="9.5" fill="#64748b">Total</text><text x="70" y="82" text-anchor="middle" font-size="13" font-weight="800" fill="#0f172a">${short(total)}</text></svg>`;
}
function bars(series) {
  const W = 320, H = 150, base = H - 20, max = Math.max(1, ...series.flatMap(s => [s.a, s.b])), bw = W / series.length;
  const step = series.length > 14 ? Math.ceil(series.length / 7) : 1;
  const w = Math.max(2, Math.min(14, bw * 0.34));
  let g = `<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="#e8eaf4"/>`;
  series.forEach((s, i) => {
    const x = i * bw + bw / 2, ha = s.a / max * (base - 14), hb = s.b / max * (base - 14);
    g += `<rect x="${x - w - 0.5}" y="${base - ha}" width="${w}" height="${ha}" rx="2.5" fill="#14b8a6"/><rect x="${x + 0.5}" y="${base - hb}" width="${w}" height="${hb}" rx="2.5" fill="#f43f5e"/>`;
    if (i % step === 0 || i === series.length - 1) g += `<text x="${x}" y="${H - 5}" text-anchor="middle">${esc(s.l)}</text>`;
  });
  return `<svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik pemasukan dan pengeluaran"><text x="0" y="9">${short(max)}</text>${g}</svg>`;
}
function trendData() {
  const r = getRange(), by = {};
  T().forEach(t => { const k = S.trend === 'm' ? t.tanggal.slice(0, 7) : t.tanggal; const o = by[k] || (by[k] = { a: 0, b: 0 }); if (t.jenis === 'Pemasukan') o.a += t.jumlah; else if (t.jenis === 'Pengeluaran') o.b += t.jumlah; });
  const out = [], end = fromIso(r.last > r.from ? r.last : r.from);
  if (S.trend === 'm') {
    for (let k = 5; k >= 0; k--) { const d = new Date(end.getFullYear(), end.getMonth() - k, 1), key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; out.push({ l: MON[d.getMonth()], ...(by[key] || { a: 0, b: 0 }) }); }
  } else {
    const n = Math.min(31, Math.max(1, daysBetween(r.from, iso(end)) + 1));
    for (let i = n - 1; i >= 0; i--) { const d = addDays(end, -i); out.push({ l: String(d.getDate()), ...(by[iso(d)] || { a: 0, b: 0 }) }); }
  }
  return out;
}

/* ---------- Tampilan: Statistik ---------- */
function viewStat() {
  if (!S.loaded) return head('Statistik', 'Pola keuanganmu') + '<div class="sk" style="height:220px"></div>';
  const r = getRange(), cur = agg(within(r.from, r.to));
  const items = Object.entries(cur.cat).sort((a, b) => b[1] - a[1]);
  const top = items.slice(0, 6), rest = items.slice(6).reduce((a, x) => a + x[1], 0); if (rest) top.push(['Lainnya', rest]);
  const now = new Date(), m0 = iso(new Date(now.getFullYear(), now.getMonth(), 1)), m1 = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const mc = agg(within(m0, m1)).cat;
  const buds = S.meta.kategori.filter(k => k.jenis === 'Pengeluaran' && k.anggaran > 0).map(k => ({ n: k.nama, b: k.anggaran, v: mc[k.nama] || 0 }));
  const ratio = cur.in > 0 ? Math.min(100, Math.round(cur.out / cur.in * 100)) : (cur.out > 0 ? 100 : 0);
  return `${head('Statistik', periodLabel(r))}
  ${periodBar()}
  <article class="card"><div class="card-h"><h4>Pengeluaran per kategori</h4></div>
  ${top.length ? `<div class="donut-w">${donut(top, cur.out)}<div class="legend">${top.map((it, i) => `<div class="lg"><i style="background:${COLORS[i % COLORS.length]}"></i><span>${esc(it[0])}</span><b>${Math.round(it[1] / cur.out * 100)}%</b></div>`).join('')}</div></div>` : empty('Belum ada pengeluaran', 'Grafik muncul setelah ada pengeluaran di periode ini.')}</article>
  <article class="card" style="margin-top:12px"><div class="card-h"><h4>Tren ${S.trend === 'm' ? 'bulanan' : 'harian'}</h4>
    <div class="seg2"><button data-trend="d" class="${S.trend === 'd' ? 'on' : ''}">Harian</button><button data-trend="m" class="${S.trend === 'm' ? 'on' : ''}">Bulanan</button></div></div>
    ${bars(trendData())}<div class="key"><span><i style="background:#14b8a6"></i>Pemasukan</span><span><i style="background:#f43f5e"></i>Pengeluaran</span></div></article>
  <article class="card" style="margin-top:12px"><h4>Pemasukan vs pengeluaran</h4>
    <div class="ratio"><i style="width:${ratio}%"></i></div>
    <div class="two"><span class="pos"><b>${rp(cur.in)}</b> masuk</span><span class="neg"><b>${rp(cur.out)}</b> keluar</span></div>
    <p class="help">${cur.in ? `Pengeluaran sebesar ${Math.round(cur.out / cur.in * 100)}% dari pemasukan.` : 'Belum ada pemasukan di periode ini.'}</p></article>
  ${buds.length ? `<article class="card" style="margin-top:12px"><h4>Anggaran bulan ini</h4>${buds.map(b => {
    const p = b.v / b.b, col = p > 1 ? '#e11d48' : p >= .8 ? '#f59e0b' : '#14b8a6';
    return `<div class="bud"><div class="bud-h"><b>${esc(b.n)}</b><span>${rp(b.v)} / ${rp(b.b)}</span></div><div class="meter"><i style="width:${Math.min(100, p * 100)}%;background:${col}"></i></div></div>`;
  }).join('')}</article>` : ''}`;
}

/* ---------- Tampilan: Riwayat ---------- */
function viewHist() {
  const set = new Set(S.meta.kategori.map(k => k.nama)); T().forEach(t => t.kategori && set.add(t.kategori));
  return `${head('Riwayat', 'Semua transaksi')}
  <div class="search">${I.search}<input id="q" type="search" placeholder="Cari keterangan, kategori, dompet" value="${esc(S.hist.q)}" aria-label="Cari transaksi"></div>
  <div class="filters"><select id="hc" aria-label="Kategori"><option value="">Semua kategori</option>${[...set].map(c => `<option${S.hist.cat === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
  <input type="date" id="hf" value="${S.hist.from}" aria-label="Dari tanggal"><input type="date" id="ht" value="${S.hist.to}" aria-label="Sampai tanggal"></div>
  <div id="hlist"></div>`;
}
function paintHist() {
  const h = S.hist, q = h.q.trim().toLowerCase();
  const list = T().filter(t => (!h.cat || t.kategori === h.cat) && (!h.from || t.tanggal >= h.from) && (!h.to || t.tanggal <= h.to) &&
    (!q || [t.kategori, t.keterangan, t.dompet, t.tujuan, t.oleh, t.jenis, t.jumlah].join(' ').toLowerCase().includes(q))).sort(cmp);
  const el = $('#hlist'); if (!el) return;
  if (!S.loaded) { el.innerHTML = '<div class="sk" style="height:260px;margin-top:14px"></div>'; return; }
  if (!list.length) { el.innerHTML = empty(T().length ? 'Tidak ada hasil' : 'Belum ada transaksi', T().length ? 'Coba ubah kata kunci atau filter.' : 'Transaksi yang kamu catat akan muncul di sini.', !T().length); return; }
  const a = agg(list), shown = list.slice(0, h.limit); let html = `<p class="sum">${list.length} transaksi, masuk ${rp(a.in)}, keluar ${rp(a.out)}</p><div class="list">`, day = '';
  shown.forEach(t => {
    if (t.tanggal !== day) {
      day = t.tanggal; const d = fromIso(day), td = todayIso(), yd = iso(addDays(new Date(), -1));
      html += `<div class="day"><span>${day === td ? 'Hari ini' : day === yd ? 'Kemarin' : DAY[d.getDay()] + ', ' + fmtLong(day)}</span></div>`;
    }
    html += txRow(t);
  });
  html += '</div>' + (list.length > shown.length ? '<button class="more" data-act="more">Tampilkan lebih banyak</button>' : '');
  el.innerHTML = html;
}

/* ---------- Tampilan: Akun & setup ---------- */
function viewMe() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `${head('Akun', 'Koneksi & pengaturan')}
  <div class="stack">
    <article class="card"><h4>Koneksi ke spreadsheet</h4>
      <div class="kv"><span>Status</span><b class="${S.error ? 'neg' : 'pos'}">${S.error ? 'Offline' : 'Terhubung'}</b></div>
      <div class="kv"><span>Terakhir sinkron</span><b>${S.last ? new Date(S.last).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '–'}</b></div>
      <div class="kv"><span>Jumlah transaksi</span><b>${S.tx.length}</b></div>
      <div class="kv"><span>Menunggu dikirim</span><b>${S.pending.length}</b></div>
      <div style="margin-top:12px;display:flex;gap:10px"><button class="btn ghost block" data-act="sync">Sinkronkan sekarang</button></div></article>
    <article class="card"><h4>Pasang di layar utama</h4>
      <p style="margin-top:6px">${standalone ? 'Aplikasi sudah terpasang di layar utama.' : ios ? 'Buka menu Bagikan di Safari, lalu pilih Tambahkan ke Layar Utama.' : installEvt ? 'Pasang agar terbuka seperti aplikasi biasa.' : 'Buka menu browser (titik tiga), lalu pilih Instal aplikasi atau Tambahkan ke layar utama.'}</p>
      ${installEvt && !standalone ? '<button class="btn primary block" style="margin-top:12px" data-act="install">Pasang aplikasi</button>' : ''}</article>
    <article class="card"><h4>Keamanan</h4><p style="margin-top:6px">Kode rahasia tersimpan di HP ini saja. Jika HP hilang, ganti TOKEN di Apps Script lalu terapkan ulang.</p>
      <button class="btn danger block" style="margin-top:12px" data-act="logout">Putuskan koneksi di HP ini</button></article>
    <p class="help" style="text-align:center">Keuangan Keluarga v1.0</p>
  </div>`;
}
function viewSetup(msg) {
  return `<div class="setup"><div class="logo">Rp</div><h1>Hubungkan ke spreadsheet</h1>
  <p>Isi dua hal ini sekali saja. Keduanya kamu dapat saat menyiapkan Apps Script.</p>
  <div class="fld"><label class="lab" for="s-url">Alamat Web App (berakhiran /exec)</label><input id="s-url" type="url" inputmode="url" autocapitalize="off" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec"></div>
  <div class="fld"><label class="lab" for="s-tok">Kode rahasia</label><input id="s-tok" type="password" autocapitalize="off" autocomplete="off" placeholder="Kode TOKEN dari Apps Script"></div>
  <div class="err" id="s-err">${esc(msg || '')}</div>
  <button class="btn primary block" id="s-go" data-act="connect" style="margin-top:8px">Hubungkan</button></div>`;
}

/* ---------- Render ---------- */
function render(animate) {
  const v = $('#view');
  document.body.classList.toggle('nocfg', !S.cfg);
  if (!S.cfg) { if (!$('#s-url')) v.innerHTML = viewSetup(); return; }
  const keep = document.activeElement && ['q', 'pf', 'pt', 'hf', 'ht', 'hc'].includes(document.activeElement.id);
  if (keep && S.tab === 'hist') { paintHist(); return; }
  v.innerHTML = ({ home: viewHome, hist: viewHist, stat: viewStat, me: viewMe })[S.tab]();
  if (S.tab === 'hist') paintHist();
  if (animate) { v.classList.remove('rise'); void v.offsetWidth; v.classList.add('rise'); }
  $$('.nav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
}
function go(tab) { S.tab = tab; render(true); window.scrollTo(0, 0); }

/* ---------- Toast & dialog ---------- */
let tt;
function toast(msg, type = 'ok') {
  const el = $('#toast'); el.className = 'toast ' + type + ' show';
  el.innerHTML = `<span>${type === 'ok' ? '✓' : type === 'err' ? '!' : 'i'}</span>${esc(msg)}`;
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), type === 'err' ? 4800 : 2500);
}
function confirmBox(title, body, okLabel) {
  return new Promise(res => {
    const el = document.createElement('div'); el.className = 'dlg';
    el.innerHTML = `<div class="scrim"></div><div class="dlg-box" role="alertdialog" aria-modal="true"><h3>${esc(title)}</h3><p>${esc(body)}</p>
      <div class="dlg-a"><button class="btn ghost" data-r="0">Batal</button><button class="btn danger" data-r="1">${esc(okLabel)}</button></div></div>`;
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (!b && !e.target.classList.contains('scrim')) return;
      el.classList.remove('show'); setTimeout(() => el.remove(), 220); res(!!b && b.dataset.r === '1');
    });
  });
}

/* ---------- Form tambah / ubah ---------- */
function openSheet(tx) {
  const edit = !!tx, root = $('#sheet-root');
  const f = {
    jenis: tx ? tx.jenis : 'Pengeluaran', jumlah: tx ? tx.jumlah : 0, kategori: tx ? tx.kategori : '', tanggal: tx ? tx.tanggal : todayIso(),
    keterangan: tx ? tx.keterangan : '', dompet: (tx && tx.dompet) || S.prefs.dompet || wallets()[0] || '', tujuan: tx ? tx.tujuan : '',
    oleh: (tx && tx.oleh) || S.prefs.oleh || members()[0] || ''
  };
  if (f.jenis === 'Transfer' && !f.tujuan) f.tujuan = wallets().find(w => w !== f.dompet) || '';
  const pick = (arr, key, cur) => `<div class="pick">${arr.map(v => `<button type="button" data-k="${key}" data-v="${esc(v)}" class="${v === cur ? 'on' : ''}">${esc(v)}</button>`).join('')}</div>`;
  const dyn = () => f.jenis === 'Transfer'
    ? `<div class="lab">Dari dompet</div>${pick(wallets(), 'dompet', f.dompet)}<div class="lab">Ke dompet</div>${pick(wallets(), 'tujuan', f.tujuan)}`
    : `<div class="lab">Kategori</div>${pick(cats(f.jenis), 'kategori', f.kategori)}<div class="lab">Dompet</div>${pick(wallets(), 'dompet', f.dompet)}`;
  root.innerHTML = `<div class="scrim"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${edit ? 'Ubah transaksi' : 'Tambah transaksi'}">
    <div class="sheet-b"><div class="grab"></div>
    <div class="sheet-h"><h2>${edit ? 'Ubah transaksi' : 'Transaksi baru'}</h2><button class="icon-btn" data-k="close" aria-label="Tutup">${I.x}</button></div>
    <div class="seg" id="seg">${['Pengeluaran', 'Pemasukan', 'Transfer'].map(j => `<button type="button" data-k="jenis" data-v="${j}" class="${j} ${f.jenis === j ? 'on' : ''}">${j}</button>`).join('')}</div>
    <label class="amt" for="amt"><span>Rp</span><input id="amt" inputmode="numeric" autocomplete="off" placeholder="0" value="${f.jumlah ? num(f.jumlah) : ''}" aria-label="Nominal"></label>
    <div class="quick">${[10000, 20000, 50000, 100000].map(n => `<button type="button" data-k="quick" data-v="${n}">+${short(n)}</button>`).join('')}<button type="button" data-k="quick" data-v="0">Reset</button></div>
    <div class="err" id="err" role="alert"></div>
    <div id="dyn">${dyn()}</div>
    <div class="row2"><div><div class="lab">Tanggal</div><input type="date" id="tgl" value="${f.tanggal}"></div>
      ${members().length ? `<div><div class="lab">Dicatat oleh</div><select id="oleh">${members().map(m => `<option${m === f.oleh ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></div>` : '<div></div>'}</div>
    <div class="fld"><input type="text" id="ket" maxlength="200" placeholder="Keterangan (opsional)" value="${esc(f.keterangan)}" aria-label="Keterangan"></div></div>
    <div class="actions">${edit ? '<button class="btn danger" data-k="del" aria-label="Hapus transaksi">' + I.trash + '</button>' : ''}
      <button class="btn primary" id="save" data-k="save">${edit ? 'Simpan perubahan' : 'Simpan'}</button></div></section>`;
  document.body.classList.add('lock'); requestAnimationFrame(() => root.classList.add('show'));
  if (!edit) setTimeout(() => $('#amt') && $('#amt').focus(), 380);

  const err = m => { const e = $('#err'); e.textContent = m || ''; if (m) { e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); } };
  const close = () => { root.classList.remove('show'); document.body.classList.remove('lock'); setTimeout(() => { root.innerHTML = ''; }, 380); };
  const amt = $('#amt');
  amt.addEventListener('input', () => {
    const d = amt.value.replace(/\D/g, '').slice(0, 12); f.jumlah = Number(d || 0); amt.value = d ? Number(d).toLocaleString('id-ID') : ''; err('');
  });
  root.onclick = async e => {
    if (e.target.classList.contains('scrim')) return close();
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k, v = b.dataset.v;
    if (k === 'close') return close();
    if (k === 'quick') { f.jumlah = v === '0' ? 0 : f.jumlah + Number(v); amt.value = f.jumlah ? num(f.jumlah) : ''; err(''); return; }
    if (k === 'jenis') {
      f.jenis = v; if (!cats(v).includes(f.kategori)) f.kategori = '';
      if (v === 'Transfer' && (!f.tujuan || f.tujuan === f.dompet)) f.tujuan = wallets().find(w => w !== f.dompet) || '';
      $$('#seg button').forEach(x => x.classList.toggle('on', x.dataset.v === v)); $('#dyn').innerHTML = dyn(); err(''); return;
    }
    if (k === 'kategori' || k === 'dompet' || k === 'tujuan') { f[k] = v; $('#dyn').innerHTML = dyn(); err(''); return; }
    if (k === 'del') {
      if (!(await confirmBox('Hapus transaksi ini?', `${tx.jenis} ${rp(tx.jumlah)}${tx.kategori ? ' (' + tx.kategori + ')' : ''}, ${fmtLong(tx.tanggal)}. Baris di spreadsheet akan dikosongkan.`, 'Hapus'))) return;
      return submit('delete', b);
    }
    if (k === 'save') {
      f.tanggal = $('#tgl').value; f.keterangan = $('#ket').value.trim(); if ($('#oleh')) f.oleh = $('#oleh').value;
      if (!f.jumlah || f.jumlah <= 0) { err('Nominal wajib diisi dan harus lebih dari 0.'); amt.focus(); return; }
      if (f.jenis === 'Transfer') {
        if (!f.dompet || !f.tujuan) return err('Pilih dompet asal dan tujuan.');
        if (f.dompet === f.tujuan) return err('Dompet asal dan tujuan tidak boleh sama.');
      } else if (!f.kategori) return err('Pilih kategori dulu.');
      if (!f.tanggal) return err('Tanggal wajib diisi.');
      return submit(edit ? 'update' : 'add', b);
    }
  };
  async function submit(action, btn) {
    const label = btn.innerHTML; btn.disabled = true; if (btn.id === 'save') btn.innerHTML = '<span class="spin"></span>Menyimpan';
    const data = { tanggal: f.tanggal, jenis: f.jenis, kategori: f.jenis === 'Transfer' ? '' : f.kategori, keterangan: f.keterangan, jumlah: f.jumlah, dompet: f.dompet, tujuan: f.jenis === 'Transfer' ? f.tujuan : '', oleh: f.oleh };
    try {
      if (action === 'add') {
        const rid = uid(), r = await api('add', { data, rid });
        S.tx.push(normTx({ ...data, id: r.id })); toast('Transaksi tersimpan ke spreadsheet', 'ok');
      } else {
        const check = { tanggal: tx.tanggal, jenis: tx.jenis, jumlah: tx.jumlah };
        if (action === 'update') { await api('update', { id: tx.id, check, data }); Object.assign(tx, normTx(data)); toast('Perubahan tersimpan', 'ok'); }
        else { await api('delete', { id: tx.id, check }); S.tx = S.tx.filter(t => t !== tx); toast('Transaksi dihapus', 'ok'); }
      }
      S.prefs = { ...S.prefs, dompet: f.dompet, oleh: f.oleh }; store.set('prefs', S.prefs);
      store.set('cache', { meta: S.meta, tx: S.tx, t: S.last }); close(); render();
    } catch (e) {
      if (!e.server && action === 'add') {            // offline: simpan di HP, kirim nanti
        S.pending.push({ rid: uid(), data }); store.set('pending', S.pending);
        S.prefs = { ...S.prefs, dompet: f.dompet, oleh: f.oleh }; store.set('prefs', S.prefs);
        toast('Tidak ada koneksi. Tersimpan di HP, dikirim otomatis nanti.', 'info'); close(); render();
      } else {
        btn.disabled = false; btn.innerHTML = label;
        toast(e.server ? e.message : 'Gagal menyimpan. Periksa koneksi lalu coba lagi.', 'err');
        if (e.server && /berubah/.test(e.message)) refresh(true);
      }
    }
  }
}

/* ---------- Koneksi awal ---------- */
async function connect() {
  const url = $('#s-url').value.trim(), token = $('#s-tok').value.trim(), err = $('#s-err'), btn = $('#s-go');
  if (!/^https:\/\/script\.google\.com\/(macros\/s\/|a\/)[^ ]+\/exec$/.test(url)) { err.textContent = 'Alamat harus diawali https://script.google.com/macros/s/ dan berakhiran /exec.'; return; }
  if (token.length < 8) { err.textContent = 'Isi kode rahasia dengan benar.'; return; }
  err.textContent = ''; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Menghubungkan';
  S.cfg = { url, token };
  try { apply(await api('init')); store.set('cfg', S.cfg); toast('Terhubung ke spreadsheet', 'ok'); S.tab = 'home'; render(true); flush(); }
  catch (e) {
    S.cfg = null; btn.disabled = false; btn.textContent = 'Hubungkan';
    err.textContent = e.code === 'AUTH' ? 'Kode rahasia salah.' : e.server ? e.message : 'Tidak bisa menghubungi server. Periksa internet dan alamat Web App.';
  }
}

/* ---------- Event ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-tab],[data-p],[data-act],[data-id],[data-trend]'); if (!el || el.closest('#sheet-root') || el.closest('.dlg')) return;
  const d = el.dataset;
  if (d.tab) return go(d.tab);
  if (d.p) {
    S.period.type = d.p;
    if (d.p === 'custom' && !S.period.from) { S.period.from = iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); S.period.to = todayIso(); }
    store.set('period', S.period); return render();
  }
  if (d.trend) { S.trend = d.trend; return render(); }
  if (d.id) { const t = T().find(x => String(x.id) === d.id); if (!t) return; if (t.pending) return toast('Transaksi ini masih menunggu dikirim.', 'info'); return openSheet(t); }
  switch (d.act) {
    case 'add': return openSheet();
    case 'sync': await refresh(false); return flush();
    case 'more': S.hist.limit += 60; return paintHist();
    case 'connect': return connect();
    case 'install': if (installEvt) { installEvt.prompt(); installEvt = null; render(); } return;
    case 'logout':
      if (await confirmBox('Putuskan koneksi?', 'Data di spreadsheet tidak terhapus. Kamu perlu mengisi alamat dan kode rahasia lagi.', 'Putuskan')) {
        ['cfg', 'cache', 'pending', 'prefs'].forEach(store.del); S.cfg = null; S.tx = []; S.pending = []; S.loaded = false; render();
      }
  }
});
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'q') { S.hist.q = e.target.value; S.hist.limit = 60; paintHist(); }
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'pf' || id === 'pt') { S.period[id === 'pf' ? 'from' : 'to'] = e.target.value; store.set('period', S.period); render(); }
  else if (id === 'hc') { S.hist.cat = e.target.value; S.hist.limit = 60; paintHist(); }
  else if (id === 'hf' || id === 'ht') { S.hist[id === 'hf' ? 'from' : 'to'] = e.target.value; S.hist.limit = 60; paintHist(); }
});
$('#fab').addEventListener('click', () => S.cfg ? openSheet() : toast('Hubungkan ke spreadsheet dulu.', 'info'));
window.addEventListener('online', () => { flush(); refresh(true); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.cfg && Date.now() - S.last > 60000) { refresh(true).then(flush); } });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (S.tab === 'me') render(); });

/* ---------- Mulai ---------- */
(function init() {
  const c = store.get('cache', null);
  if (c && S.cfg) { S.meta = c.meta; S.tx = c.tx || []; S.last = c.t || 0; S.loaded = true; }
  render(true);
  if (S.cfg) refresh(true).then(flush);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
