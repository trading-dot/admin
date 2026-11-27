/* insight-calc.js — hitungan murni (tanpa DOM/Firebase) untuk panel Insight, supaya mudah diuji. Zona waktu: WIB (UTC+7). */
const WIB = 7 * 36e5;
export const dayOf = ms => new Date(ms + WIB).toISOString().slice(0, 10);
export const parts = d => d.split("-").map(Number);
export const addDays = (d, n) => { const [y, m, x] = parts(d); return new Date(Date.UTC(y, m - 1, x + n)).toISOString().slice(0, 10); };
export const weekStart = d => { const [y, m, x] = parts(d), w = new Date(Date.UTC(y, m - 1, x)).getUTCDay(); return addDays(d, -((w + 6) % 7)); };   // Senin
export const monthOf = d => d.slice(0, 7);
export const addMonths = (mo, n) => { const [y, m] = mo.split("-").map(Number), t = y * 12 + (m - 1) + n; return Math.floor(t / 12) + "-" + String(t % 12 + 1).padStart(2, "0"); };
export const toMs = v => { if (v == null) return 0; if (typeof v === "number") return v; if (v.toMillis) return v.toMillis(); if (v.seconds) return v.seconds * 1000; const t = new Date(v).getTime(); return isNaN(t) ? 0 : t; };
export const num = v => { const n = Number(String(v == null ? 0 : v).replace(/[^\d.-]/g, "")); return isFinite(n) ? n : 0; };
export const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const labelOf = (kind, key) => { if (kind === "month") { const [y, m] = key.split("-"); return BLN[+m - 1] + " " + y.slice(2); } const [, m, d] = key.split("-"); return +d + " " + BLN[+m - 1]; };

/* ---------- pengunjung: stats/{d_<site>_<hari>} = {site, day, hits, uniq, fresh} ---------- */
export function buildVisits(docs) {
  const days = {};
  docs.forEach(x => { if (!x || !x.site || !x.day) return; (days[x.site] = days[x.site] || {})[x.day] = { hits: num(x.hits), uniq: num(x.uniq), fresh: num(x.fresh) }; });
  return days;
}
const keyFor = (kind, day) => kind === "day" ? day : kind === "week" ? weekStart(day) : monthOf(day);
export function periodKeys(kind, n, today) {
  const out = []; let k = keyFor(kind, today);
  for (let i = 0; i < n; i++) { out.unshift(k); k = kind === "day" ? addDays(k, -1) : kind === "week" ? addDays(k, -7) : addMonths(k, -1); }
  return out;
}
/* deret per periode untuk beberapa situs; cum = kumulatif perangkat sejak awal (all-time) sampai akhir periode */
export function series(days, sites, kind, n, today) {
  const keys = periodKeys(kind, n, today), idx = Object.fromEntries(keys.map((k, i) => [k, i])), rows = keys.map(k => ({ key: k, hits: 0, uniq: 0, fresh: 0, cum: 0 }));
  let before = 0;
  sites.forEach(s => Object.entries(days[s] || {}).forEach(([d, v]) => { const k = keyFor(kind, d); if (k in idx) { const r = rows[idx[k]]; r.hits += v.hits; r.uniq += v.uniq; r.fresh += v.fresh; } else if (k < keys[0]) before += v.fresh; }));
  rows.forEach(r => { before += r.fresh; r.cum = before; });
  return rows;
}
export function siteSummary(days, site, today) {
  const wk = weekStart(today), mo = monthOf(today), pm = addMonths(mo, -1), t = { today: { hits: 0, uniq: 0 }, week: { hits: 0, uniq: 0 }, month: { hits: 0, uniq: 0 }, prev: { hits: 0, uniq: 0 }, hits: 0, devices: 0, first: "" };
  Object.entries(days[site] || {}).forEach(([d, v]) => {
    t.hits += v.hits; t.devices += v.fresh; if (!t.first || d < t.first) t.first = d;
    if (d === today) { t.today.hits += v.hits; t.today.uniq += v.uniq; }
    if (d >= wk && d <= today) { t.week.hits += v.hits; t.week.uniq += v.uniq; }
    if (monthOf(d) === mo) { t.month.hits += v.hits; t.month.uniq += v.uniq; }
    if (monthOf(d) === pm) { t.prev.hits += v.hits; t.prev.uniq += v.uniq; }
  });
  return t;
}

/* ---------- order, stok, keuangan ---------- */
const PAID = ["dp", "lunas", "selesai", "dikirim"];
export const isPaid = o => PAID.includes(String(o.status || "").toLowerCase());
export function normOrder(o) {
  const items = Array.isArray(o.produk) ? o.produk : (o.produk ? [{ nama: o.produk }] : []);
  return { id: o.id, kode: o.kodePelunasan || o.orderNo || o.id, orderNo: o.orderNo || "", nama: o.nama || "", t: toMs(o.createdAt), status: String(o.status || "pending").toLowerCase(), total: num(o.totalAkhir != null ? o.totalAkhir : o.total), sisa: num(o.sisaBayar != null ? o.sisaBayar : o.sisa), ongkir: num(o.ongkir), isPO: !!o.isPO, sumber: String(o.sumber || "").toLowerCase() === "game" ? "game" : "web", resi: o.resi || "", items: items.map(i => ({ nama: String(i.nama || i.name || ""), qty: Math.max(1, num(i.qty != null ? i.qty : (i.jumlah != null ? i.jumlah : 1))) })) };
}
/* Pembeli per sumber: order berbayar dipisah antara game (sumber "game") dan web utama (tanpa penanda). */
export function sourceSummary(orders, today) {
  const mo = monthOf(today), mk = () => ({ monthN: 0, paidN: 0, omzet: 0, unpaidN: 0 }), r = { game: mk(), web: mk() };
  orders.forEach(o => {
    const x = r[o.sumber === "game" ? "game" : "web"], d = o.t ? dayOf(o.t) : "";
    if (isPaid(o)) { x.paidN++; x.omzet += o.total; if (d && monthOf(d) === mo) x.monthN++; }
    else if (o.status === "pending") x.unpaidN++;
  });
  return r;
}

export function salesSummary(orders, today) {
  const mo = monthOf(today), by = {}, status = {}, top = {}, months = {};
  let todayN = 0, monthN = 0, monthOmzet = 0, piutang = 0, paidN = 0;
  orders.forEach(o => {
    const d = o.t ? dayOf(o.t) : ""; status[o.status] = (status[o.status] || 0) + 1;
    if (d) by[d] = by[d] || { n: 0, omzet: 0 };
    if (d === today) todayN++;
    if (d && monthOf(d) === mo) monthN++;
    if (isPaid(o)) { paidN++; if (d) { by[d].n++; by[d].omzet += o.total; const m = monthOf(d); (months[m] = months[m] || { n: 0, omzet: 0 }); months[m].n++; months[m].omzet += o.total; if (m === mo) monthOmzet += o.total; } o.items.forEach(i => { if (i.nama) top[i.nama] = (top[i.nama] || 0) + i.qty; }); }
    if (o.status === "dp") piutang += o.sisa;
  });
  return { by, status, months, todayN, monthN, monthOmzet, piutang, paidN, top: Object.entries(top).sort((a, b) => b[1] - a[1]) };
}
export function parseStock(p) {
  const sizes = String(p.ukuran || p.sizes || "").split("/").map(s => s.trim()).filter(Boolean), st = String(p.stok != null ? p.stok : "").split("/").map(s => s.trim()).filter(s => s !== "");
  const per = st.map((v, i) => ({ size: sizes[i] || (st.length > 1 ? String(i + 1) : ""), n: Math.max(0, num(v)) }));
  return { per, total: per.reduce((a, x) => a + x.n, 0) };
}
export function stockRows(produk, aksesoris) {
  const rows = [];
  produk.forEach(p => { const s = parseStock(p); rows.push({ name: p.nama || p.name || "", kind: "Produk", badge: p.badge || "", poOpen: p.badge === "pre" && !p.poClosed, per: s.per, total: s.total }); });
  aksesoris.forEach(p => { const s = parseStock(p); rows.push({ name: p.nama || p.name || "", kind: "Aksesoris", badge: p.badge || "", poOpen: p.badge === "pre" && !p.poClosed, per: s.per, total: s.total }); });
  return rows.filter(r => r.name);
}
export const lowStock = rows => rows.filter(r => r.badge !== "pre" && r.badge !== "sold" && r.total <= 5);
export function moneySummary(tx, today) {
  const mo = monthOf(today), months = {}, grup = {}, last = [...tx].sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "") || num(b.createdAt) - num(a.createdAt)).slice(0, 8);
  let kas = 0, masuk = 0, keluar = 0;
  tx.forEach(x => { const n = num(x.nominal), m = (x.tanggal || "").slice(0, 7); const masukX = x.tipe === "masuk"; kas += masukX ? n : -n; if (m) { const r = months[m] = months[m] || { masuk: 0, keluar: 0 }; masukX ? r.masuk += n : r.keluar += n; if (m === mo) { masukX ? masuk += n : keluar += n; const g = x.grup || "umum", gg = grup[g] = grup[g] || { masuk: 0, keluar: 0 }; masukX ? gg.masuk += n : gg.keluar += n; } } });
  return { kas, masuk, keluar, net: masuk - keluar, months, grup, last };
}
export const rp = n => "Rp" + Math.round(n).toLocaleString("id-ID");
export const short = n => { const a = Math.abs(n); return (n < 0 ? "-" : "") + (a >= 1e9 ? (a / 1e9).toFixed(1) + "M" : a >= 1e6 ? (a / 1e6).toFixed(1) + "jt" : a >= 1e3 ? Math.round(a / 1e3) + "rb" : String(Math.round(a))); };

/* ---------- aktivitas pelanggan: aktivitas/{hari}_{perangkat} = {dev, day, ua, ev:["ms|situs|kode|detail", ...]} ---------- */
export const hhmm = ms => { const d = new Date(ms + WIB); return String(d.getUTCHours()).padStart(2, "0") + "." + String(d.getUTCMinutes()).padStart(2, "0"); };
export function parseEv(arr) {
  return (Array.isArray(arr) ? arr : []).map(s => { const p = String(s).split("|"); return { t: Number(p[0]) || 0, site: p[1] || "", k: p[2] || "", d: p.slice(3).join("|") }; }).filter(e => e.t && e.k).sort((a, b) => a.t - b.t);
}
const titleCase = s => String(s).replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
/* nama halaman dari alamat (path) yang dicatat pelacak, per situs */
export function pageLabel(site, path) {
  const p = String(path || "/").toLowerCase().replace(/\/+$/, "") || "/", seg = p.split("/").filter(Boolean);
  if (site === "game") return "membuka toko game 3D";
  if (site === "kota") return "membuka Kota 3D";
  if (site === "jurnal") return p === "/" || p === "/index.html" ? "membuka beranda Jurnal" : p === "/article.html" ? "membaca artikel Jurnal" : p === "/discussion.html" ? "membuka diskusi Jurnal" : "membuka halaman Jurnal " + p;
  const known = { "/": "halaman utama", "/preorder": "menu Pre-Order", "/katalog": "Katalog", "/arsip": "Arsip", "/galeri": "Galeri", "/tentang": "halaman Tentang", "/berita": "Berita", "/diskusi": "Diskusi", "/pantau": "Pantau Pesanan", "/pelunasan": "Pelunasan", "/resi": "Cek Resi", "/index.html": "halaman utama" };
  if (known[p]) return "membuka " + known[p];
  if (p === "/keranjang") return "membuka keranjang";
  if (p === "/keranjang/form") return "membuka form pengiriman (keranjang)";
  if (p === "/keranjang/summary") return "melihat ringkasan pesanan (keranjang)";
  if (seg.length === 1) return "membuka produk " + titleCase(seg[0]);
  if (seg.length === 2 && seg[1] === "form") return "membuka form pengiriman " + titleCase(seg[0]);
  if (seg.length === 2 && seg[1] === "summary") return "melihat ringkasan pesanan " + titleCase(seg[0]);
  return "membuka halaman " + p;
}
export function describe(e) {
  switch (e.k) {
    case "buka": return pageLabel(e.site, e.d);
    case "katalog": return "membuka katalog" + (e.d ? " (" + e.d.toLowerCase() + ")" : "");
    case "produk": return "membuka produk " + (e.d || "");
    case "ukuran": return "memilih ukuran " + e.d;
    case "warna": return "memilih warna " + e.d;
    case "tas": return "memasukkan " + (e.d || "produk") + " ke tas belanja";
    case "keranjang": return "membuka tas belanja";
    case "checkout": return "membuka form pengiriman";
    case "alamat": return "mengisi alamat";
    case "bayar_buka": return e.d === "P" ? "membuka pelunasan" : "membuka halaman pembayaran";
    case "pesan": return "membuat pesanan (menunggu pembayaran)";
    case "bayar_ok": return e.d === "P" ? "pelunasan berhasil" : "pembayaran berhasil";
    case "bayar_tunggu": return "pembayaran belum selesai, menunggu";
    case "keluar": return "meninggalkan website";
    case "kembali": return "kembali ke website";
    default: return e.k + (e.d ? " " + e.d : "");
  }
}
/* gabungkan aksi jadi baris timeline: ukuran+warna jadi satu baris, "mengisi alamat" + keluar jadi satu baris, situs ditandai di awal tiap kunjungan */
export function timeline(events) {
  const out = []; let prev = null;
  const GAP = 30 * 60e3;
  events.forEach(e => {
    const newVisit = !prev || prev.site !== e.site || e.t - prev.t > GAP || prev.k === "keluar";
    const last = out[out.length - 1];
    if (last && !newVisit && (e.k === "ukuran" || e.k === "warna") && last.opts && e.t - last.t0 < 5 * 6e4) {
      last.opts[e.k] = e.d; last.text = optsText(last.opts); prev = e; return;
    }
    if (e.k === "keluar" && last && !newVisit && last.site === e.site && !last.left && e.t - last.t < 10 * 6e4) { last.text += ", lalu meninggalkan website"; last.left = true; prev = e; return; }
    const row = { t: e.t, t0: e.t, site: e.site, k: e.k, text: describe(e), newVisit, left: false };
    if (e.k === "ukuran" || e.k === "warna") { row.opts = { [e.k]: e.d }; row.text = optsText(row.opts); }
    out.push(row); prev = e;
  });
  return out;
}
const optsText = o => o.ukuran && o.warna ? "memilih ukuran " + o.ukuran + " dan warna " + o.warna : o.ukuran ? "memilih ukuran " + o.ukuran : "memilih warna " + o.warna;
const STAGE = [["bayar_ok", "Sudah bayar", 6], ["pesan", "Pesan, belum bayar", 5], ["bayar_buka", "Buka pembayaran", 5], ["alamat", "Isi alamat", 4], ["checkout", "Buka form kirim", 3], ["tas", "Masuk tas", 3], ["produk", "Lihat produk", 2]];
/* ringkasan satu perangkat: jumlah aksi, jam pertama/terakhir, situs yang dikunjungi, tahap terjauh */
export function deviceSummary(doc) {
  const ev = parseEv(doc.ev), sites = []; ev.forEach(e => { if (e.site && !sites.includes(e.site)) sites.push(e.site); });
  let stage = ["", "Menjelajah", 1]; STAGE.forEach(s => { if (ev.some(e => e.k === s[0]) && s[2] > stage[2]) stage = s; });
  return { dev: doc.dev || String(doc.id || "").split("_").slice(1).join("_"), ua: doc.ua || "", ev, n: ev.length, first: ev.length ? ev[0].t : 0, last: ev.length ? ev[ev.length - 1].t : 0, sites, stage: stage[1], paid: ev.some(e => e.k === "bayar_ok") };
}
