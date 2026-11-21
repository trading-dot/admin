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
  return { id: o.id, kode: o.kodePelunasan || o.orderNo || o.id, orderNo: o.orderNo || "", nama: o.nama || "", t: toMs(o.createdAt), status: String(o.status || "pending").toLowerCase(), total: num(o.totalAkhir != null ? o.totalAkhir : o.total), sisa: num(o.sisaBayar != null ? o.sisaBayar : o.sisa), ongkir: num(o.ongkir), isPO: !!o.isPO, resi: o.resi || "", items: items.map(i => ({ nama: String(i.nama || i.name || ""), qty: Math.max(1, num(i.qty != null ? i.qty : (i.jumlah != null ? i.jumlah : 1))) })) };
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
