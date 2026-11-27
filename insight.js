/* insight.js — panel Insight: Utama (ringkas), Ringkasan (lengkap), Pengunjung, Aktivitas Pelanggan, AI. Membaca: toko, keuangan, jurnal, kota (+ statistik pengunjung), Worker AI. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, deleteDoc, query, where, orderBy, limit, getCountFromServer } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { STORE, JURNAL, KEU, AI_WORKER, SITES } from "./insight-config.js";
import { CITY, cityReady } from "./kota-config.js";
import * as C from "./insight-calc.js";

const $ = s => document.querySelector(s), app = $("#app");
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3800); };
const named = (cfg, name) => getApps().find(a => a.name === name) || initializeApp(cfg, name);
const n0 = v => Number(v || 0).toLocaleString("id-ID");
const COL = { ink: "#111", sun: "#ffd51e", lav: "#e6b3ef", mint: "#5be39a", pop: "#f26a35", sky: "#7cc4e8", bad: "#c4302b" };
const today = () => C.dayOf(Date.now());

/* ---------- grafik SVG ringan ---------- */
function legend(series) { return series.length > 1 || (series[0] && series[0].name) ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name || "")}</span>`).join("")}</div>` : ""; }
function bars(labels, series, o = {}) {
  const h = o.h || 170, fmt = o.fmt || C.short, W = 600, L = 38, R = 6, T = 10, B = 24, n = labels.length || 1, pw = W - L - R, ph = h - T - B, max = Math.max(1, ...series.flatMap(s => s.vals));
  let g = ""; [0, .5, 1].forEach(f => { const y = T + ph - ph * f; g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#d6d6d4" stroke-dasharray="3 3"/><text x="${L - 4}" y="${y + 3}" text-anchor="end">${fmt(max * f)}</text>`; });
  const gw = pw / n, bw = Math.max(2, gw * .74 / series.length);
  series.forEach((s, si) => s.vals.forEach((v, i) => { const bh = ph * v / max, x = L + i * gw + (gw - bw * series.length) / 2 + si * bw; g += `<rect x="${x.toFixed(1)}" y="${(T + ph - bh).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${s.color}" stroke="#111" stroke-width="1.2"/>`; }));
  const step = Math.ceil(n / 8); labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += `<text x="${(L + i * gw + gw / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle">${esc(l)}</text>`; });
  return `<svg class="ch" viewBox="0 0 ${W} ${h}" role="img">${g}</svg>${legend(series)}`;
}
function line(labels, series, o = {}) {
  const h = o.h || 170, fmt = o.fmt || C.short, W = 600, L = 38, R = 10, T = 10, B = 24, n = labels.length, pw = W - L - R, ph = h - T - B, max = Math.max(1, ...series.flatMap(s => s.vals));
  let g = ""; [0, .5, 1].forEach(f => { const y = T + ph - ph * f; g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#d6d6d4" stroke-dasharray="3 3"/><text x="${L - 4}" y="${y + 3}" text-anchor="end">${fmt(max * f)}</text>`; });
  const X = i => L + (n > 1 ? pw * i / (n - 1) : pw / 2), Y = v => T + ph - ph * v / max;
  series.forEach(s => { g += `<polyline fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round" points="${s.vals.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ")}"/>`; const i = s.vals.length - 1; if (i >= 0) g += `<circle cx="${X(i).toFixed(1)}" cy="${Y(s.vals[i]).toFixed(1)}" r="4" fill="${s.color}" stroke="#111" stroke-width="1.5"/>`; });
  const step = Math.ceil(n / 8); labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += `<text x="${X(i).toFixed(1)}" y="${h - 8}" text-anchor="middle">${esc(l)}</text>`; });
  return `<svg class="ch" viewBox="0 0 ${W} ${h}" role="img">${g}</svg>${legend(series)}`;
}
function donut(parts, centerTxt) {
  const tot = parts.reduce((a, p) => a + p.value, 0), r = 42, c = 2 * Math.PI * r; let off = 0, g = "";
  if (!tot) g = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="#e7e5ea" stroke-width="18"/>`;
  parts.forEach(p => { const len = c * p.value / tot; if (len > 0) g += `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${p.color}" stroke-width="18" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"/>`; off += len; });
  g += `<circle cx="60" cy="60" r="${r + 9}" fill="none" stroke="#111" stroke-width="1.5"/><circle cx="60" cy="60" r="${r - 9}" fill="none" stroke="#111" stroke-width="1.5"/><text x="60" y="64" text-anchor="middle" class="v" style="font-size:12px">${esc(centerTxt || "")}</text>`;
  return `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 120 120" width="130" height="130" role="img">${g}</svg><div class="legend" style="flex-direction:column;gap:4px">${parts.map(p => `<span><i style="background:${p.color}"></i>${esc(p.label)} · <b>${esc(p.fmt || n0(p.value))}</b></span>`).join("")}</div></div>`;
}
const kpi = (label, value, sub, tone) => `<div class="kpi ${tone || ""}"><small>${esc(label)}</small><b>${esc(value)}</b><i>${esc(sub || "")}</i></div>`;
const card = (title, body, sub) => `<div class="card"><h3>${esc(title)}</h3>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}${body}</div>`;
const table = (head, rows, tot) => `<div class="wrap"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}${tot ? `<tr class="tot">${tot.map(c => `<td>${c}</td>`).join("")}</tr>` : ""}</tbody></table></div>`;

/* ---------- data ---------- */
const D = { loaded: false, has: {}, errs: [], orders: [], produk: [], aksesoris: [], tx: [], visits: {}, jur: null, city: {}, ai: null };
const waitUser = (auth, ms = 6000) => new Promise(res => { let done = 0, un = () => { }; const fin = u => { if (done) return; done = 1; try { un(); } catch { } res(u); }; un = onAuthStateChanged(auth, u => { if (u) fin(u); }); setTimeout(() => fin(null), ms); });
let sApp, sDb, cDb;
async function load() {
  sApp = named(STORE, "fvckAdminApp"); sDb = getFirestore(sApp);
  const jApp = named(JURNAL, "jurnalAdmin"), kApp = named(KEU, "keuanganAdmin"), cApp = cityReady() ? named(CITY, "cityAdmin") : null;
  const us = await Promise.all([waitUser(getAuth(sApp)), waitUser(getAuth(kApp), 4000), waitUser(getAuth(jApp), 4000), cApp ? waitUser(getAuth(cApp), 4000) : null]);
  D.has = { store: !!us[0], keu: !!us[1], jur: !!us[2], city: !!us[3] };
  if (!D.has.store) { app.innerHTML = '<div class="card"><p class="muted">Belum login ke project toko. Login ulang dari halaman utama admin.</p></div>'; return; }
  const kDb = getFirestore(kApp), jDb = getFirestore(jApp); cDb = cApp ? getFirestore(cApp) : null;
  const E = (n, p) => p.catch(e => { D.errs.push(n + ": " + (e.code || e.message)); return null; });
  const docs = s => s ? s.docs.map(d => ({ id: d.id, ...d.data() })) : [];
  const cnt = async q => { const r = await getCountFromServer(q); return r.data().count; };
  const [os, ps, as, tx, st, arts, posts, users, pend, appr, ca, sp, ai] = await Promise.all([
    E("order", getDocs(collection(sDb, "orders"))), E("produk", getDocs(collection(sDb, "produk"))), E("aksesoris", getDocs(collection(sDb, "aksesoris"))),
    D.has.keu ? E("keuangan", getDocs(collection(kDb, "transaksi"))) : null,
    D.has.city ? E("statistik", getDocs(collection(cDb, "stats"))) : null,
    D.has.jur ? E("artikel", getDocs(collection(jDb, "articles"))) : null,
    D.has.jur ? E("diskusi", cnt(collection(jDb, "posts"))) : null, D.has.jur ? E("anggota", cnt(collection(jDb, "users"))) : null,
    D.has.city ? E("foto", cnt(query(collection(cDb, "cityGallery"), where("status", "==", "pending")))) : null,
    D.has.city ? E("foto", cnt(query(collection(cDb, "cityGallery"), where("status", "==", "approved")))) : null,
    D.has.city ? E("kota", getDocs(collection(cDb, "cityArticles"))) : null,
    D.has.city ? E("sorotan", getDoc(doc(cDb, "cityConfig", "spotlight"))) : null,
    aiCall("/agen").catch(() => null)
  ]);
  D.orders = docs(os).map(C.normOrder); D.produk = docs(ps); D.aksesoris = docs(as); D.tx = docs(tx);
  D.visits = C.buildVisits(docs(st)); D.city = { pending: pend, approved: appr, arts: docs(ca), spot: sp && sp.exists() ? sp.data() : null };
  D.jur = D.has.jur ? { arts: docs(arts), posts, users } : null; D.ai = ai; D.loaded = true; render();
}
async function aiCall(path, body, ms = 45000) {
  const tk = await getAuth(sApp).currentUser.getIdToken(), ctl = new AbortController(), t = ms ? setTimeout(() => ctl.abort(), ms) : 0;
  try { const r = await fetch(AI_WORKER + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; } catch (e) { if (e && e.name === "AbortError") throw new Error("waktu habis (" + Math.round(ms / 1000) + " detik)"); throw e; } finally { if (t) clearTimeout(t); }
}

/* ---------- pengunjung ---------- */
const ALL = SITES.map(s => s.id), PV = { site: "all", kind: "day", metric: "hits" };
const sitesOf = k => k === "all" ? ALL : [k];
const KIND = { day: ["Harian", 30], week: ["Mingguan", 12], month: ["Bulanan", 12] };
const MET = { hits: ["Kunjungan", COL.sun], uniq: ["Unik harian", COL.lav], fresh: ["Perangkat baru", COL.mint] };
const hasVisits = () => Object.keys(D.visits).length > 0;
const noVisits = () => `<div class="note"><b>Belum ada data pengunjung.</b> Pasang pelacak <code>ftr-track.js</code> di web utama, game, kota, dan jurnal (lihat PANDUAN-INSIGHT.md), lalu data mulai terkumpul. Data sebelum pelacak dipasang tidak bisa dihitung ulang.</div>`;

function vPengunjung() {
  const t = today(), [kl, n] = KIND[PV.kind], rows = C.series(D.visits, sitesOf(PV.site), PV.kind, n, t), labels = rows.map(r => C.labelOf(PV.kind === "month" ? "month" : "day", r.key)), m = MET[PV.metric];
  const lab = PV.kind === "week" ? labels.map(l => "mgg " + l) : labels;
  const seg = (obj, cur, key) => `<div class="seg" data-k="${key}">${Object.entries(obj).map(([k, v]) => `<button data-v="${k}" class="${k === cur ? "on" : ""}">${esc(v[0])}</button>`).join("")}</div>`;
  const sel = `<select id="pvSite"><option value="all">Semua website</option>${SITES.map(s => `<option value="${s.id}" ${PV.site === s.id ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>`;
  const tot = r => r.reduce((a, x) => ({ hits: a.hits + x.hits, uniq: a.uniq + x.uniq, fresh: a.fresh + x.fresh }), { hits: 0, uniq: 0, fresh: 0 });
  const sums = SITES.map(s => ({ s, v: C.siteSummary(D.visits, s.id, t) })), g = sums.reduce((a, { v }) => ({ today: { hits: a.today.hits + v.today.hits, uniq: a.today.uniq + v.today.uniq }, week: { hits: a.week.hits + v.week.hits, uniq: a.week.uniq + v.week.uniq }, month: { hits: a.month.hits + v.month.hits, uniq: a.month.uniq + v.month.uniq }, prev: { hits: a.prev.hits + v.prev.hits, uniq: a.prev.uniq + v.prev.uniq }, hits: a.hits + v.hits, devices: a.devices + v.devices }), { today: { hits: 0, uniq: 0 }, week: { hits: 0, uniq: 0 }, month: { hits: 0, uniq: 0 }, prev: { hits: 0, uniq: 0 }, hits: 0, devices: 0 });
  const pair = x => `${n0(x.hits)} <span class="muted">/ ${n0(x.uniq)}</span>`;
  const months = C.series(D.visits, sitesOf(PV.site), "month", 12, t).reverse();
  app.innerHTML = `<div class="sec"><h2>Pengunjung</h2><span class="muted">${esc(KIND[PV.kind][0])} · ${esc(PV.site === "all" ? "semua website" : SITES.find(s => s.id === PV.site).label)}</span></div>
  <div class="bar">${sel}${seg(KIND, PV.kind, "kind")}${seg(MET, PV.metric, "metric")}</div>
  ${hasVisits() ? "" : noVisits()}
  <div class="grid g2"><div class="card"><h3>${esc(m[0])} ${esc(kl.toLowerCase())}</h3>${bars(lab, [{ name: m[0], color: m[1], vals: rows.map(r => r[PV.metric]) }])}</div>
  <div class="card"><h3>Total perangkat (all-time)</h3><p class="sub">Berapa HP/perangkat berbeda yang pernah masuk, bertambah setiap ada perangkat baru.</p>${line(lab, [{ name: "Perangkat all-time", color: COL.pop, vals: rows.map(r => r.cum) }])}</div></div>
  <div class="card" style="margin-top:12px"><h3>Per website</h3><p class="sub">Format: kunjungan <span class="muted">/ pengunjung unik hari itu</span>. “Perangkat all-time” = HP berbeda sepanjang waktu.</p>${table(["Website", "Hari ini", "Minggu ini", "Bulan ini", "Bulan lalu", "Total kunjungan", "Perangkat all-time"], sums.map(({ s, v }) => [`<b>${esc(s.label)}</b>`, pair(v.today), pair(v.week), pair(v.month), pair(v.prev), n0(v.hits), n0(v.devices)]), ["TOTAL", pair(g.today), pair(g.week), pair(g.month), pair(g.prev), n0(g.hits), n0(g.devices)])}</div>
  <div style="margin-top:12px">${cardSumber()}</div>
  <div class="card" style="margin-top:12px"><h3>Rincian ${esc(kl.toLowerCase())}</h3>${table(["Periode", "Kunjungan", "Unik harian", "Perangkat baru", "Perangkat all-time"], [...rows].reverse().map(r => [esc(C.labelOf(PV.kind === "month" ? "month" : "day", r.key)) + (PV.kind === "week" ? " (mgg)" : ""), n0(r.hits), n0(r.uniq), n0(r.fresh), n0(r.cum)]), ["TOTAL " + n + " periode", n0(tot(rows).hits), n0(tot(rows).uniq), n0(tot(rows).fresh), n0(rows.length ? rows[rows.length - 1].cum : 0)])}</div>
  <div class="card" style="margin-top:12px"><h3>Bulan-bulan sebelumnya</h3>${table(["Bulan", "Kunjungan", "Unik harian", "Perangkat baru"], months.map(r => [esc(C.labelOf("month", r.key)), n0(r.hits), n0(r.uniq), n0(r.fresh)]))}</div>
  <div class="note" style="margin-top:12px"><b>Cara membaca.</b><br>• <b>Kunjungan</b>: setiap kali halaman dibuka, bertambah terus walau dari HP yang sama.<br>• <b>Unik harian</b>: satu perangkat dihitung sekali per hari. Untuk minggu/bulan, ini penjumlahan unik tiap hari (HP yang datang 3 hari terhitung 3).<br>• <b>Perangkat baru / all-time</b>: HP yang baru pertama kali masuk ke website itu; all-time = jumlahnya sepanjang waktu, jadi satu HP hanya dihitung sekali selamanya.<br>• Perangkat dikenali dari penyimpanan browser, bukan IP. Hapus data situs, mode samaran, atau browser lain dihitung perangkat baru. Satu HP yang membuka dua website berbeda terhitung di masing-masing website, dan TOTAL adalah penjumlahannya.</div>`;
  const rerender = () => vPengunjung();
  $("#pvSite").onchange = e => { PV.site = e.target.value; rerender(); };
  document.querySelectorAll(".seg").forEach(sg => sg.onclick = e => { const b = e.target.closest("button"); if (!b) return; PV[sg.dataset.k] = b.dataset.v; rerender(); });
}

/* ---------- pembeli per sumber (game vs web utama) ---------- */
function cardSumber() {
  const r = C.sourceSummary(D.orders, today()), tot = r.game.paidN + r.web.paidN;
  const parts = [{ label: "Game", value: r.game.paidN, color: COL.lav, fmt: n0(r.game.paidN) + " order" }, { label: "Web utama", value: r.web.paidN, color: COL.sun, fmt: n0(r.web.paidN) + " order" }].filter(p => p.value > 0);
  const row = (l, x) => [l, n0(x.monthN), n0(x.paidN), C.rp(x.omzet), n0(x.unpaidN)];
  return card("Pembeli per sumber", (tot ? donut(parts, n0(tot)) : '<p class="muted">Belum ada order berbayar.</p>') + table(["Sumber", "Bulan ini", "Semua", "Omzet", "Belum bayar"], [row("Game", r.game), row("Web utama", r.web)]), "Order berbayar (DP atau lunas) berdasarkan tempat pembeli memesan");
}

/* ---------- aktivitas pelanggan: daftar kunjungan harian per perangkat + kalender + timeline ---------- */
const AK = { day: "", month: "", cache: {}, dev: "", site: "all", tok: 0 };
const BLN_P = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const dayHits = d => ALL.reduce((a, s) => a + (((D.visits[s] || {})[d] || {}).hits || 0), 0);
const dayLong = d => { const [y, m, x] = C.parts(d); return x + " " + BLN_P[m - 1] + " " + y; };
const siteName = id => (SITES.find(s => s.id === id) || { label: id }).label;
const siteCol = id => (SITES.find(s => s.id === id) || { color: "#ccc" }).color;
const inkOn = c => { const h = String(c).replace("#", ""), v = h.length === 3 ? h.split("").map(x => x + x).join("") : h, [r, g, b] = [0, 2, 4].map(i => parseInt(v.substr(i, 2), 16) || 0); return (r * 299 + g * 587 + b * 114) / 1000 < 140 ? "#fff" : "#111"; };
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function calHTML() {
  const t = today(), [y, m] = AK.month.split("-").map(Number), off = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let cells = "".padEnd(0); for (let i = 0; i < off; i++) cells += "<span></span>";
  for (let d = 1; d <= n; d++) { const key = AK.month + "-" + String(d).padStart(2, "0"), h = dayHits(key), fut = key > t; cells += `<button data-d="${key}" class="${key === AK.day ? "on " : ""}${key === t ? "now " : ""}${h ? "has" : ""}" ${fut ? "disabled" : ""}><b>${d}</b>${h ? `<i>${C.short(h)}</i>` : ""}</button>`; }
  return `<div class="cal"><div class="calh"><button class="btn" data-m="-1">‹</button><b>${BLN_P[m - 1]} ${y}</b><button class="btn" data-m="1" ${C.addMonths(AK.month, 1) > C.monthOf(t) ? "disabled" : ""}>›</button></div>
  <div class="calg">${["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(x => `<small>${x}</small>`).join("")}${cells}</div></div>`;
}
async function akLoad(day, force) {
  if (!force && day !== today() && AK.cache[day]) return AK.cache[day];   // hari ini selalu diambil ulang
  const s = await getDocs(query(collection(cDb, "aktivitas"), where("day", "==", day), limit(500)));
  return AK.cache[day] = s.docs.map(d => C.deviceSummary({ id: d.id, ...d.data() }));
}
function vAktivitas() {
  if (!AK.day) { AK.day = today(); AK.month = C.monthOf(AK.day); }
  if (!cDb) { app.innerHTML = `<div class="sec"><h2>Aktivitas Pelanggan</h2></div><div class="note"><b>Belum login ke project kota.</b> Aktivitas pelanggan disimpan di project kota (sama dengan statistik pengunjung). Login ulang dari halaman utama admin.</div>`; return; }
  app.innerHTML = `<div class="sec"><h2>Aktivitas Pelanggan</h2><span class="muted">Apa saja yang dilakukan tiap perangkat di web, per hari</span></div>
  <div class="grid g2 ak"><div class="card"><h3>Kalender</h3><p class="sub">Angka kecil = jumlah kunjungan hari itu. Ketuk tanggal untuk melihat daftar perangkat.</p><div id="akCal">${calHTML()}</div></div>
  <div class="card"><h3 id="akTitle"></h3><div class="bar" style="margin-top:4px"><select id="akSite"><option value="all">Semua website</option>${SITES.map(s => `<option value="${s.id}" ${AK.site === s.id ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select><button class="btn" id="akRef">Segarkan</button></div><div id="akList"><p class="muted">Memuat…</p></div></div></div>
  <div class="card" id="akDetail" style="margin-top:12px" hidden></div>
  <div class="note" style="margin-top:12px"><b>Cara membaca.</b><br>• Satu baris daftar = satu perangkat (HP/browser) dalam satu hari. Nama perangkat berupa ID acak, bukan nama orang.<br>• Perangkat dikenali dari ID di browser, jadi hapus data situs atau mode samaran dihitung perangkat baru. Web utama, game, dan kota berbagi ID yang sama; Jurnal terpisah.<br>• Yang tercatat hanya aksi (buka halaman, lihat produk, pilih ukuran/warna, isi alamat, bayar, keluar). Isi alamat, nama, nomor HP, dan email tidak dikirim.<br>• Data mulai terkumpul sejak pelacak versi baru dipasang; hari sebelumnya hanya punya hitungan kunjungan.</div>`;
  const paint = async force => {
    const tok = ++AK.tok, list = $("#akList"), title = $("#akTitle"); if (!list) return;
    title.textContent = "Daftar kunjungan harian · " + dayLong(AK.day); list.innerHTML = '<p class="muted">Memuat…</p>'; $("#akDetail").hidden = true;
    let rows; try { rows = await akLoad(AK.day, force); } catch (e) { if (tok !== AK.tok) return; list.innerHTML = `<div class="note"><b>Belum bisa membaca aktivitas</b> (${esc(e.code || e.message)}). Kalau pesannya permission-denied, publikasikan <code>firestore.rules</code> terbaru di project city (Firebase Console, Firestore, Rules).</div>`; return; }
    if (tok !== AK.tok) return;
    rows = rows.filter(r => AK.site === "all" || r.sites.includes(AK.site)).sort((a, b) => b.last - a.last);
    if (!rows.length) { list.innerHTML = `<p class="muted">Belum ada aktivitas tercatat di ${esc(dayLong(AK.day))}${dayHits(AK.day) ? " (ada " + n0(dayHits(AK.day)) + " kunjungan di statistik, tapi dari sebelum pelacak aktivitas dipasang)" : ""}.</p>`; return; }
    const paid = rows.filter(r => r.paid).length;
    list.innerHTML = `<p class="sub">${n0(rows.length)} perangkat · ${n0(rows.reduce((a, r) => a + r.n, 0))} aksi${paid ? " · " + n0(paid) + " sudah bayar" : ""}. Terbaru di atas.</p><div class="devs">${rows.map(r => `<button class="dev" data-dev="${esc(r.dev)}"><span class="dn"><b>${esc(r.dev)}</b><small>${esc(r.ua || "-")}</small></span><span class="dm">${C.hhmm(r.first)}–${C.hhmm(r.last)} · ${n0(r.n)} aksi</span><span class="dt">${r.sites.map(s => `<i style="background:${siteCol(s)}" title="${esc(siteName(s))}"></i>`).join("")}<span class="chip ${r.paid ? "" : r.stage === "Menjelajah" ? "off" : "warn"}">${esc(r.stage)}</span></span></button>`).join("")}</div>`;
    list.querySelectorAll(".dev").forEach(b => b.onclick = () => { AK.dev = b.dataset.dev; detail(rows.find(r => r.dev === AK.dev)); });
    if (AK.dev) { const cur = rows.find(r => r.dev === AK.dev); if (cur) detail(cur, true); }
  };
  const detail = (r, quiet) => {
    const box = $("#akDetail"); if (!r) { box.hidden = true; return; }
    const tl = C.timeline(r.ev), path = r.sites.map(siteName).join(" → ");
    box.hidden = false;
    box.innerHTML = `<h3>Daftar kunjungan harian "${esc(r.dev)}"</h3><p class="sub">${esc(dayLong(AK.day))} · ${esc(r.ua || "-")} · ${esc(path)} · ${n0(r.n)} aksi</p>
    <ol class="tl">${tl.map(x => `<li class="${x.newVisit ? "nv" : ""}"><time>${C.hhmm(x.t)}</time><span>—</span><div>${x.newVisit ? `<em style="background:${siteCol(x.site)};color:${inkOn(siteCol(x.site))}">${esc(siteName(x.site))}</em> ` : ""}${esc(x.newVisit ? x.text : cap(x.text))}${x.newVisit ? "" : ""}</div></li>`).join("")}</ol>`;
    if (!quiet) box.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const cal = $("#akCal");
  cal.onclick = e => {
    const mb = e.target.closest("[data-m]"), db = e.target.closest("[data-d]");
    if (mb) { AK.month = C.addMonths(AK.month, Number(mb.dataset.m)); cal.innerHTML = calHTML(); }
    else if (db && !db.disabled) { AK.day = db.dataset.d; AK.dev = ""; cal.innerHTML = calHTML(); paint(); }
  };
  $("#akSite").onchange = e => { AK.site = e.target.value; paint(); };
  $("#akRef").onclick = () => paint(true);
  paint();
}

/* ---------- ringkasan data ---------- */
function agg() {
  const t = today(), sm = C.salesSummary(D.orders, t), mm = C.moneySummary(D.tx, t), sr = C.stockRows(D.produk, D.aksesoris), low = C.lowStock(sr), vs = C.series(D.visits, ALL, "day", 14, t);
  return { t, sm, mm, sr, low, vs };
}
function todoList(a) {
  const pendingN = D.orders.filter(o => o.status === "pending").length, dpN = D.orders.filter(o => o.status === "dp").length;
  const items = [["Order belum dibayar", pendingN, "web/order"], ["DP belum lunas", dpN, "web/order"], ["Stok menipis / habis", a.low.length, "web/stok"], ["Foto galeri menunggu", D.city.pending || 0, "kota/galeri"]];
  return `<div class="todo">${items.map(([l, n, go]) => `<a href="#" data-go="${go}"><span>${esc(l)}</span><b>${n0(n)}</b></a>`).join("")}</div>`;
}
function aiMini() {
  if (!D.ai || !D.ai.agents) return `<p class="muted">Data agen AI belum terbaca (Worker AI belum bisa dihubungi dari admin). Buka tab AI untuk petunjuk.</p>`;
  const act = D.ai.agents.filter(a => a.mode === "kerja").length, b = D.ai.anggaran_ai || {};
  return `<p><b>${D.ai.agents.length}</b> agen · <b>${act}</b> sedang bekerja${b.batas ? ` · anggaran AI hari ini <b>${n0(b.terpakai)}/${n0(b.batas)}</b>` : ""}</p><div class="legend">${D.ai.agents.slice(0, 8).map(a => `<span>${esc(a.emoji || "")} ${esc(a.role)}</span>`).join("")}</div>`;
}
function vUtama() {
  const a = agg(), v = a.vs, last = v[v.length - 1], mo = C.monthOf(a.t);
  const m6 = []; for (let i = 5; i >= 0; i--) m6.push(C.addMonths(mo, -i));
  const orders14 = v.map(r => (a.sm.by[r.key] || { n: 0 }).n);
  const grupIn = Object.entries(a.mm.grup).map(([g, x]) => ({ label: g, value: x.masuk, color: { kaos: COL.sun, ongkir: COL.sky, umum: COL.lav, vendor: COL.pop }[g] || COL.mint, fmt: C.rp(x.masuk) })).filter(p => p.value > 0);
  app.innerHTML = `<div class="sec"><h2>Utama</h2><span class="muted">Ringkasan semua · ${esc(C.labelOf("day", a.t))}</span></div>
  ${D.errs.length ? `<div class="note">Sebagian data belum terbaca: ${esc(D.errs.slice(0, 4).join(" · "))}</div>` : ""}
  <div class="kpis">${kpi("Kunjungan hari ini", n0(last.hits), "unik " + n0(last.uniq) + " perangkat", "t1")}${kpi("Order hari ini", n0(a.sm.todayN), "bulan ini " + n0(a.sm.monthN), "t2")}${kpi("Omzet bulan ini", C.rp(a.sm.monthOmzet), "piutang DP " + C.rp(a.sm.piutang), "t3")}${kpi("Kas bersih bulan ini", C.rp(a.mm.net), "saldo kas " + C.rp(a.mm.kas), a.mm.net < 0 ? "t4" : "")}${kpi("Stok menipis", n0(a.low.length), "dari " + n0(a.sr.length) + " item", a.low.length ? "t4" : "")}${kpi("Foto menunggu", D.city.pending == null ? "-" : n0(D.city.pending), "galeri kota", "")}</div>
  <div class="grid g2">
   ${card("Kunjungan 14 hari", hasVisits() ? bars(v.map(r => C.labelOf("day", r.key)), [{ name: "Kunjungan", color: COL.sun, vals: v.map(r => r.hits) }, { name: "Unik", color: COL.lav, vals: v.map(r => r.uniq) }]) : noVisits())}
   ${card("Order berbayar 14 hari", bars(v.map(r => C.labelOf("day", r.key)), [{ name: "Order", color: COL.mint, vals: orders14 }]))}
   ${card("Omzet 6 bulan", bars(m6.map(m => C.labelOf("month", m)), [{ name: "Omzet", color: COL.pop, vals: m6.map(m => (a.sm.months[m] || { omzet: 0 }).omzet) }]))}
   ${card("Pemasukan bulan ini", donut(grupIn, C.short(a.mm.masuk)), "Per kelompok, dari Keuangan")}
   ${cardSumber()}
  </div>
  <div class="grid g2" style="margin-top:12px">${card("Perlu tindakan", todoList(a))}${card("AI", aiMini() + `<p><a href="#" data-go="insight/ai" class="btn ac" style="text-decoration:none;display:inline-block">Buka AI</a></p>`)}</div>`;
}
function vRingkasan() {
  const a = agg(), t = a.t, mo = C.monthOf(t), sm = a.sm, mm = a.mm, v30 = C.series(D.visits, ALL, "day", 30, t), m6 = [], m12 = []; for (let i = 5; i >= 0; i--) m6.push(C.addMonths(mo, -i)); for (let i = 11; i >= 0; i--) m12.push(C.addMonths(mo, -i));
  const stCol = { pending: COL.sun, dp: COL.lav, lunas: COL.mint, selesai: COL.sky, dikirim: COL.pop, ditolak: "#bbb" };
  const sec = (id, title, sub) => `<div class="sec" id="${id}"><h2>${esc(title)}</h2><span class="muted">${esc(sub || "")}</span></div>`;
  const sums = SITES.map(s => ({ s, v: C.siteSummary(D.visits, s.id, t) }));
  const poRows = D.produk.filter(p => p.badge === "pre"), sold = D.produk.filter(p => p.badge === "sold").length;
  const gal = D.city;
  const stepN = {}; (gal.arts || []).filter(x => !x.hidden).forEach(x => { stepN[x.step] = (stepN[x.step] || 0) + 1; });
  const arts = D.jur ? D.jur.arts : [], pub = arts.filter(x => x.status === "published").length, drf = arts.filter(x => x.status === "draft").length, rej = arts.filter(x => x.status === "rejected").length;
  app.innerHTML = `<div class="sec"><h2>Ringkasan</h2><span class="muted">Versi lengkap: grafik dan rincian · ${esc(C.labelOf("day", t))}</span></div>
  <div class="bar">${[["rg-v", "Pengunjung"], ["rg-s", "Penjualan"], ["rg-p", "Produk & Stok"], ["rg-k", "Keuangan"], ["rg-j", "Jurnal"], ["rg-c", "Kota"], ["rg-a", "AI"]].map(([id, l]) => `<a class="btn" style="text-decoration:none" href="#${id}" data-jump="${id}">${l}</a>`).join("")}</div>
  ${D.errs.length ? `<div class="note">Sebagian data belum terbaca: ${esc(D.errs.join(" · "))}</div>` : ""}
  ${sec("rg-v", "Pengunjung", "30 hari terakhir")}
  <div class="grid g2">${card("Kunjungan dan unik", hasVisits() ? bars(v30.map(r => C.labelOf("day", r.key)), [{ name: "Kunjungan", color: COL.sun, vals: v30.map(r => r.hits) }, { name: "Unik", color: COL.lav, vals: v30.map(r => r.uniq) }]) : noVisits())}${card("Per website", table(["Website", "Hari ini", "Bulan ini", "Total", "Perangkat"], sums.map(({ s, v }) => [esc(s.label), n0(v.today.hits), n0(v.month.hits), n0(v.hits), n0(v.devices)])), "Rincian lengkap di tab Pengunjung")}</div>
  ${sec("rg-s", "Penjualan", "order, omzet, dan artikel terlaris")}
  <div class="kpis">${kpi("Order bulan ini", n0(sm.monthN), "hari ini " + n0(sm.todayN))}${kpi("Order berbayar (semua)", n0(sm.paidN), "dari " + n0(D.orders.length) + " order", "t3")}${kpi("Omzet bulan ini", C.rp(sm.monthOmzet), "", "t1")}${kpi("Piutang DP", C.rp(sm.piutang), "sisa yang belum dibayar", "t4")}</div>
  <div class="grid g2">${card("Omzet 12 bulan", bars(m12.map(m => C.labelOf("month", m)), [{ name: "Omzet", color: COL.pop, vals: m12.map(m => (sm.months[m] || { omzet: 0 }).omzet) }]))}${card("Status order", donut(Object.entries(sm.status).map(([k, n]) => ({ label: k, value: n, color: stCol[k] || "#ccc" })), n0(D.orders.length)))}${cardSumber()}</div>
  <div class="grid g2" style="margin-top:12px">${card("Artikel terlaris", sm.top.length ? table(["Artikel", "Terjual"], sm.top.slice(0, 10).map(([n, q]) => [esc(n), n0(q)])) : '<p class="muted">Belum ada order berbayar.</p>')}${card("Order terakhir", table(["Kode", "Nama", "Total", "Status"], [...D.orders].sort((x, y) => y.t - x.t).slice(0, 8).map(o => [esc(o.kode), esc(o.nama), C.rp(o.total), `<span class="chip ${o.status === "lunas" ? "" : o.status === "pending" ? "warn" : "off"}">${esc(o.status)}</span>`])))}</div>
  ${sec("rg-p", "Produk & Stok", "stok per ukuran")}
  <div class="kpis">${kpi("Item", n0(a.sr.length), "produk + aksesoris")}${kpi("Menipis / habis", n0(a.low.length), "stok ≤ 5 (bukan PO/sold)", a.low.length ? "t4" : "t3")}${kpi("PO dibuka", n0(poRows.filter(p => !p.poClosed).length), "produk badge pre", "t2")}${kpi("Sold out", n0(sold), "badge sold")}</div>
  <div class="card">${table(["Item", "Jenis", "Stok per ukuran", "Total", "Status"], [...a.sr].sort((x, y) => x.total - y.total).map(r => [esc(r.name), esc(r.kind), r.per.length ? r.per.map(p => `${esc(p.size)}:${p.n}`).join(" ") : "-", n0(r.total), r.badge === "pre" ? '<span class="chip warn">PO</span>' : r.badge === "sold" ? '<span class="chip off">sold</span>' : r.total === 0 ? '<span class="chip bad">habis</span>' : r.total <= 5 ? '<span class="chip warn">menipis</span>' : '<span class="chip">aman</span>']))}</div>
  ${sec("rg-k", "Keuangan", D.has.keu ? "dari aplikasi Keuangan" : "belum login ke Keuangan")}
  <div class="kpis">${kpi("Saldo kas", C.rp(mm.kas), "semua waktu", "t1")}${kpi("Pemasukan bulan ini", C.rp(mm.masuk), "", "t3")}${kpi("Pengeluaran bulan ini", C.rp(mm.keluar), "", "t4")}${kpi("Bersih bulan ini", C.rp(mm.net), "", "t2")}</div>
  <div class="grid g2">${card("Masuk vs keluar 6 bulan", bars(m6.map(m => C.labelOf("month", m)), [{ name: "Masuk", color: COL.mint, vals: m6.map(m => (mm.months[m] || { masuk: 0 }).masuk) }, { name: "Keluar", color: COL.pop, vals: m6.map(m => (mm.months[m] || { keluar: 0 }).keluar) }]))}${card("Per kelompok bulan ini", table(["Kelompok", "Masuk", "Keluar"], Object.entries(mm.grup).map(([g, x]) => [esc(g), C.rp(x.masuk), C.rp(x.keluar)])))}</div>
  <div class="card" style="margin-top:12px"><h3>Transaksi terakhir</h3>${table(["Tanggal", "Keterangan", "Kelompok", "Nominal"], mm.last.map(x => [esc(x.tanggal || ""), esc(x.ket || ""), esc(x.grup || ""), `<b style="color:${x.tipe === "masuk" ? "#157347" : COL.bad}">${x.tipe === "masuk" ? "+" : "-"}${C.rp(C.num(x.nominal))}</b>`]))}</div>
  ${sec("rg-j", "Jurnal", D.jur ? "artikel dan diskusi" : "belum login ke Jurnal")}
  ${D.jur ? `<div class="kpis">${kpi("Artikel terbit", n0(pub), "", "t3")}${kpi("Draf", n0(drf), "")}${kpi("Ditolak", n0(rej), "")}${kpi("Diskusi", D.jur.posts == null ? "-" : n0(D.jur.posts), "post")}${kpi("Anggota", D.jur.users == null ? "-" : n0(D.jur.users), "")}</div>` : ""}
  ${sec("rg-c", "Kota", "progres artikel dan galeri")}
  <div class="grid g2">${card("Artikel per langkah", Object.keys(stepN).length ? table(["Langkah", "Artikel"], Object.entries(stepN).map(([k, n]) => [esc(k), n0(n)])) : '<p class="muted">Belum ada artikel di kota.</p>')}${card("Galeri dan sorotan", `<p>Foto menunggu: <b>${n0(gal.pending || 0)}</b> · disetujui: <b>${n0(gal.approved || 0)}</b></p><p>Sorotan: ${gal.spot ? `<b>${esc(gal.spot.name)}</b> · ${esc(gal.spot.label)}${gal.spot.hidden ? " (disembunyikan)" : ""}` : "belum ada"}</p>`)}</div>
  ${sec("rg-a", "AI", "agen dan anggaran")}
  <div class="card">${aiMini()}${D.ai && D.ai.agents ? table(["Agen", "Aktivitas", "Terakhir"], D.ai.agents.map(x => [esc((x.emoji || "") + " " + x.role), esc(x.aktivitas + (x.ket ? " · " + x.ket : "")), esc(x.lastAt ? new Date(x.lastAt).toLocaleString("id-ID") : "-")])) : ""}</div>`;
  document.querySelectorAll("[data-jump]").forEach(b => b.onclick = e => { e.preventDefault(); const t0 = document.getElementById(b.dataset.jump); if (t0) t0.scrollIntoView({ behavior: "smooth", block: "start" }); });
}

/* ---------- AI: Kantor mini + chat + hasil agen (terhubung dengan Kantor AI lewat Worker yang sama) ---------- */
const AI = { chats: [], cur: null, busy: false, ro: true, check: false, loaded: false, ag: null, sel: null, work: {}, tab: "akt", feed: {}, local: [], t0: 0, timer: null, poll: null };
const PROMPTS = ["Penjualan sepi, gimana strategimu", "Ringkas order hari ini", "Order yang belum lunas", "Stok yang menipis", "Laporan keuangan bulan ini", "Ide konten IG minggu ini"];
const ROUTE = [[/pemasaran|marketing|promosi|iklan|strategi|sepi|campaign|kampanye|jualan|laris/i, ["PEMASARAN", "KONTEN IG"]], [/konten|\big\b|instagram|caption|postingan|reels|tiktok|upload/i, ["KONTEN IG", "CREATIVE"]], [/desain|visual|poster|kreatif|creative|gambar|foto/i, ["CREATIVE"]], [/stok|kirim|pengiriman|resi|ekspedisi|gudang|logistik|paket/i, ["LOGISTIK"]], [/keuangan|\buang\b|\bkas\b|laba|rugi|biaya|pengeluaran|pemasukan|omzet/i, ["KEUANGAN"]], [/order|pesanan|produk|harga|katalog|pembayaran|lunas|\bdp\b/i, ["COMMERCE"]], [/\bbug\b|error|eror|\bweb\b|situs|website|lambat|rusak|fitur/i, ["QA", "DEVELOPER"]], [/aman|keamanan|hack|spam|bahaya|phishing/i, ["SECURITY"]], [/laporan|ringkas|rangkum|evaluasi|gimana|bagaimana/i, ["ORCHESTRATOR"]]];
function routeRoles(text) { const out = []; ROUTE.forEach(([re, rs]) => { if (re.test(text)) rs.forEach(r => { if (!out.includes(r)) out.push(r); }); }); if (!out.length || out.length > 1 && !out.includes("ORCHESTRATOR")) out.push("ORCHESTRATOR"); return out.slice(0, 4); }
const chatsCol = () => collection(cDb, "adminChats");
async function loadChats() { if (!cDb) return; try { const s = await getDocs(query(chatsCol(), orderBy("updatedAt", "desc"), limit(40))); AI.chats = s.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { console.warn(e); } AI.loaded = true; }
const saveChat = async c => { if (!cDb) return; c.updatedAt = Date.now(); try { await setDoc(doc(cDb, "adminChats", c.id), { title: c.title, msgs: c.msgs.slice(-60), createdAt: c.createdAt, updatedAt: c.updatedAt }); } catch (e) { console.warn(e); } };
const agState = a => { const w = AI.work[a.role]; return w ? (w.done ? "done" : "work") : a.mode === "kerja" ? "work" : a.mode === "selesai" ? "done" : "santai"; };
const emojiOf = r => ((AI.ag && AI.ag.agents.find(a => a.role === r)) || {}).emoji || "🤖";
const when = v => { const t = Date.parse(v); return t ? new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; };
function stopPoll() { if (AI.poll) { clearInterval(AI.poll); AI.poll = null; } if (AI.timer) { clearInterval(AI.timer); AI.timer = null; } }

async function vAI() {
  stopPoll(); if (!AI.loaded) await loadChats();
  app.innerHTML = `<div class="sec"><h2>AI</h2><span class="muted">Kantor AI versi simpel: suruh agen, lihat hasilnya, semuanya terhubung dengan Kantor AI</span></div>
  <div class="card"><h3>Kantor</h3><p class="sub" id="agSub">Memuat agen…</p><div class="agrid" id="agGrid"></div><div id="agDetail"></div><div class="bar"><button class="btn" id="agRef">Segarkan</button></div></div>
  <div class="ai" id="aiBox" style="margin-top:12px"><div class="hist"><div class="bar" style="margin-top:0"><button class="btn ac" id="aiNew">+ Chat baru</button></div><div id="aiHist"></div></div>
   <div class="chat"><div class="msgs" id="aiMsgs"></div><div class="compose"><div class="chips" id="aiChips"></div><textarea id="aiIn" placeholder="Suruh agen AI… (Ctrl+Enter untuk kirim)" rows="2"></textarea>
    <div class="bar" style="margin:0"><button class="btn ink" id="aiSend">Kirim</button><label class="muted"><input type="checkbox" id="aiRo" ${AI.ro ? "checked" : ""}> Hanya baca (aman)</label><label class="muted"><input type="checkbox" id="aiCk" ${AI.check ? "checked" : ""}> Cek silang (lebih lambat)</label><button class="btn" id="aiHbtn">Riwayat</button></div>
    <div class="ext"><span class="muted">Buka di aplikasi AI:</span><button class="btn" data-x="gpt">ChatGPT</button><button class="btn" data-x="gem">Gemini</button><button class="btn" data-x="cla">Claude</button></div>
    <p class="sub" style="margin:0">ChatGPT dan Claude membuka aplikasinya (jika terpasang) dengan teks di atas. Gemini: teks disalin, tinggal tempel.</p></div></div></div>
  <div class="card" style="margin-top:12px"><h3>Hasil agen</h3><div class="seg" id="feedSeg"><button data-t="akt">Aktivitas</button><button data-t="draf">Draf konten</button><button data-t="lap">Laporan</button><button data-t="apr">Persetujuan</button></div><div id="feedBody" style="margin-top:10px"></div></div>`;
  const msgs = $("#aiMsgs"), inp = $("#aiIn"), cur = () => AI.chats.find(c => c.id === AI.cur);

  /* --- kantor: kartu agen beranimasi --- */
  const paintAgents = () => {
    const g = $("#agGrid"); if (!g) return; const j = AI.ag;
    if (!j || !j.agents) { g.innerHTML = `<p class="muted">Agen belum terbaca (Worker AI belum bisa dihubungi).</p>`; return; }
    const b = j.anggaran_ai || {}; $("#agSub").textContent = `${j.agents.length} agen · anggaran AI hari ini ${n0(b.terpakai)}/${n0(b.batas)}`;
    g.innerHTML = j.agents.map(a => { const s = agState(a), w = AI.work[a.role], txt = w ? (w.text || "") : a.ket || a.aktivitas || ""; return `<button class="ag ${s}${AI.sel === a.role ? " sel" : ""}" data-r="${esc(a.role)}"><span class="av">${esc(a.emoji || "🤖")}</span><b>${esc(a.role)}</b><span class="st">${s === "work" ? 'Bekerja <span class="dots"><i></i><i></i><i></i></span>' : s === "done" ? "Selesai ✓" : "Santai"}</span><small>${esc(txt).slice(0, 90)}</small></button>`; }).join("");
    g.querySelectorAll(".ag").forEach(b => b.onclick = () => { AI.sel = AI.sel === b.dataset.r ? null : b.dataset.r; paintAgents(); paintDetail(); });
    paintDetail();
  };
  const paintDetail = () => {
    const d = $("#agDetail"); if (!d) return; const a = AI.ag && AI.ag.agents.find(x => x.role === AI.sel); if (!a) { d.innerHTML = ""; return; }
    const r = (a.riwayat || []);
    d.innerHTML = `<div class="agd"><h3>${esc(a.emoji || "")} ${esc(a.role)}</h3><p class="sub">${esc(a.tugas || "")}${a.jam ? " · jam kerja " + esc(a.jam) : ""}${a.berikut ? " · berikutnya " + esc(a.berikut) : ""}</p><div class="bar" style="margin-top:0"><button class="btn ac" id="agRun" ${AI.work[a.role] ? "disabled" : ""}>Suruh bekerja sekarang</button></div>${r.length ? r.map(x => `<details class="hr"><summary>${esc(x.label || "Tugas")} <span class="muted">${esc(when(x.waktu))}</span>${x.flag ? ' <span class="chip bad">perlu dicek</span>' : ""}</summary><div class="isi">${esc(x.hasil || "(tanpa isi)")}</div></details>`).join("") : '<p class="muted">Belum ada riwayat hasil.</p>'}</div>`;
    const rb = $("#agRun"); if (rb) rb.onclick = () => runAgent(a.role);
  };
  async function loadAgents() { try { AI.ag = await aiCall("/agen"); D.ai = AI.ag; } catch (e) { if (!AI.ag) AI.ag = null; } paintAgents(); paintFeed(); }
  async function runAgent(role) {
    AI.work[role] = { text: "Mengerjakan tugasnya…" }; startPoll(); paintAgents();
    try { const j = await aiCall("/agen/jalankan", { role }, 0); toast(j.skip ? role + ": dilewati" : j.ok === false ? role + ": gagal. " + (j.detail || "") : role + ": selesai. " + (j.label || "")); }
    catch (e) { toast(role + ": " + e.message); }
    AI.work[role] = { done: true }; paintAgents(); setTimeout(() => { delete AI.work[role]; paintAgents(); }, 8000); await loadAgents();
  }
  const startPoll = () => { if (AI.poll) clearInterval(AI.poll); AI.poll = setInterval(() => { loadAgents(); }, Object.keys(AI.work).length ? 4000 : 20000); };

  /* --- hasil agen: aktivitas, draf, laporan, persetujuan --- */
  const row = (agent, label, hasil, waktu, flag, extra) => `<details class="hr"><summary><b>${esc(emojiOf(agent))} ${esc(agent)}</b> · ${esc(label || "")} <span class="muted">${esc(when(waktu))}</span>${flag ? ' <span class="chip bad">perlu dicek</span>' : ""}${extra || ""}</summary><div class="isi">${esc(hasil || "(tanpa isi)")}</div></details>`;
  async function paintFeed() {
    const body = $("#feedBody"); if (!body) return; document.querySelectorAll("#feedSeg button").forEach(b => b.classList.toggle("on", b.dataset.t === AI.tab));
    try {
      if (AI.tab === "akt") {
        const items = [...AI.local.map(x => ({ ...x, local: true })), ...((AI.ag && AI.ag.agents) || []).flatMap(a => (a.riwayat || []).map(x => ({ agent: a.role, ...x }))), ...((AI.ag && AI.ag.tugas) || [])].filter(x => x.label).sort((x, y) => (Date.parse(y.waktu) || 0) - (Date.parse(x.waktu) || 0)).slice(0, 30);
        body.innerHTML = items.length ? items.map(x => row(x.agent, x.label, x.hasil, x.waktu, x.flag, x.local ? ' <span class="chip">dari chat</span>' : "")).join("") : '<p class="muted">Belum ada aktivitas. Suruh agen lewat chat di atas.</p>';
      } else {
        const ep = { draf: "/draf", lap: "/laporan", apr: "/persetujuan" }[AI.tab];
        if (!AI.feed[AI.tab]) { body.innerHTML = '<p class="muted">Memuat…</p>'; AI.feed[AI.tab] = await aiCall(ep); }
        const f = AI.feed[AI.tab];
        if (AI.tab === "draf") body.innerHTML = (f.items || []).length ? f.items.map(x => `<details class="hr"><summary><b>📝 ${esc(x.judul || x.jenis || "Draf")}</b> <span class="muted">${esc(x.jenis || "")}${x.tema ? " · " + esc(x.tema) : ""} · ${esc(when(x.waktu))}</span>${x.diposting ? ' <span class="chip">sudah diposting</span>' : ""}</summary><div class="isi">${esc(x.isi || "")}</div><div class="bar"><button class="btn" data-copy="${esc(x.id)}">Salin teks</button></div></details>`).join("") : '<p class="muted">Belum ada draf konten.</p>';
        if (AI.tab === "lap") body.innerHTML = ((f.laporan || []).map(x => row("ORCHESTRATOR", x.label, x.hasil, x.waktu, x.flag)).join("") || '<p class="muted">Belum ada laporan.</p>') + ((f.perhatian || []).length ? '<p class="sub" style="margin-top:10px">Perlu perhatian</p>' + f.perhatian.map(x => row(x.agent, x.label, x.hasil, x.waktu, true)).join("") : "");
        if (AI.tab === "apr") body.innerHTML = (f.items || []).length ? f.items.map(x => `<details class="hr"><summary><b>${x.status === "pending" ? "⏳" : x.status === "setuju" || x.status === "approved" ? "✅" : "⛔"} ${esc(x.aksi || "Aksi")}</b> <span class="muted">${esc(when(x.waktu))}</span> <span class="chip ${x.status === "pending" ? "warn" : "off"}">${esc(x.status)}</span></summary><div class="isi">${esc(String(x.detail && x.detail.slice ? x.detail : JSON.stringify(x.detail || {}))) }${x.alasan ? "\n\nAlasan: " + esc(x.alasan) : ""}${x.hasil ? "\n\nHasil: " + esc(x.hasil) : ""}</div>${x.status === "pending" ? `<div class="bar"><button class="btn ac" data-ap="${esc(x.id)}" data-v="1">Setujui</button><button class="btn" data-ap="${esc(x.id)}" data-v="0">Tolak</button></div>` : ""}</details>`).join("") : '<p class="muted">Tidak ada permintaan persetujuan.</p>';
        body.querySelectorAll("[data-copy]").forEach(b => b.onclick = async () => { const it = (f.items || []).find(z => z.id === b.dataset.copy); try { await navigator.clipboard.writeText((it && it.isi) || ""); toast("Teks disalin"); } catch { toast("Gagal menyalin"); } });
        body.querySelectorAll("[data-ap]").forEach(b => b.onclick = async () => { b.disabled = true; try { await aiCall("/persetujuan/putuskan", { id: b.dataset.ap, keputusan: b.dataset.v === "1" ? "setuju" : "tolak" }, 0); toast("Keputusan disimpan"); delete AI.feed.apr; paintFeed(); } catch (e) { toast("Gagal: " + e.message); b.disabled = false; } });
      }
    } catch (e) { body.innerHTML = `<p class="muted">Belum terbaca (${esc(e.message)}).</p>`; delete AI.feed[AI.tab]; }
  }
  $("#feedSeg").onclick = e => { const b = e.target.closest("button"); if (!b) return; AI.tab = b.dataset.t; paintFeed(); };

  /* --- chat --- */
  const paintHist = () => { const h = $("#aiHist"); h.innerHTML = ""; if (!AI.chats.length) h.append(el("p", "muted", cDb ? "Belum ada riwayat." : "Riwayat butuh login ke project kota.")); AI.chats.forEach(c => { const b = el("button", "item" + (c.id === AI.cur ? " on" : ""), c.title || "Chat"); b.append(el("small", "", new Date(c.updatedAt || 0).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))); b.onclick = () => { AI.cur = c.id; $("#aiBox").classList.remove("showh"); paintHist(); paintMsgs(); }; h.append(b); }); };
  const paintMsgs = () => { msgs.innerHTML = ""; const c = cur(); if (!c || !c.msgs.length) msgs.append(el("div", "m s", "Tulis perintah, mis. “Penjualan sepi, gimana strategimu”. Agen yang terkait ikut bekerja di atas, dan hasilnya muncul di “Hasil agen”.")); else c.msgs.forEach(m => msgs.append(el("div", "m " + (m.r === "u" ? "u" : "a"), m.t))); if (AI.busy) msgs.append(el("div", "m s", "AI sedang bekerja… " + Math.round((Date.now() - AI.t0) / 1000) + " dtk (tidak ada batas waktu)")); msgs.scrollTop = msgs.scrollHeight; };
  const chips = $("#aiChips"); PROMPTS.forEach(p => { const b = el("button", "", p); b.onclick = () => { inp.value = p; inp.focus(); }; chips.append(b); });
  async function send() {
    const text = inp.value.trim(); if (!text || AI.busy) return;
    let c = cur(); if (!c) { c = { id: "c" + Date.now().toString(36), title: text.slice(0, 40), msgs: [], createdAt: Date.now(), updatedAt: Date.now() }; AI.chats.unshift(c); AI.cur = c.id; }
    c.msgs.push({ r: "u", t: text, ts: Date.now() }); inp.value = ""; AI.busy = true; AI.t0 = Date.now(); paintHist(); paintMsgs();
    const roles = routeRoles(text); roles.forEach((r, i) => setTimeout(() => { if (AI.busy) { AI.work[r] = { text: "Mengerjakan: " + text.slice(0, 50) }; paintAgents(); } }, i * 900));
    startPoll(); if (AI.timer) clearInterval(AI.timer); AI.timer = setInterval(() => { if (AI.busy) paintMsgs(); }, 1000);
    let reply;
    try { const j = await aiCall("/chat", { readonly: AI.ro, check: AI.check, messages: c.msgs.slice(-10).map(m => ({ role: m.r === "u" ? "user" : "model", text: m.t })) }, 0); reply = j.reply || ("Error: " + (j.error || "tanpa jawaban")); }
    catch (e) { reply = "Tidak bisa menghubungi Worker AI: " + e.message + "\nPeriksa ALLOWED_ORIGINS dan status Worker."; }
    AI.busy = false; clearInterval(AI.timer); AI.timer = null;
    c.msgs.push({ r: "a", t: reply + "\n\n— dikerjakan: " + roles.join(", "), ts: Date.now() });
    AI.local.unshift({ agent: roles[0], label: text.slice(0, 80), hasil: reply, waktu: new Date().toISOString() }); AI.local = AI.local.slice(0, 10);
    roles.forEach(r => { AI.work[r] = { done: true }; setTimeout(() => { delete AI.work[r]; paintAgents(); }, 9000); });
    paintAgents(); paintFeed(); await saveChat(c); paintHist(); paintMsgs(); loadAgents();
  }
  $("#aiSend").onclick = send; inp.onkeydown = e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); };
  $("#aiRo").onchange = e => { AI.ro = e.target.checked; }; $("#aiCk").onchange = e => { AI.check = e.target.checked; };
  $("#aiNew").onclick = () => { AI.cur = null; paintHist(); paintMsgs(); inp.focus(); };
  $("#aiHbtn").onclick = () => $("#aiBox").classList.toggle("showh");
  $("#agRef").onclick = () => { AI.feed = {}; loadAgents(); };
  document.querySelectorAll("[data-x]").forEach(b => b.onclick = async () => {
    const q = inp.value.trim() || (cur() && [...cur().msgs].reverse().find(m => m.r === "u") || {}).t || "", enc = encodeURIComponent(q);
    if (b.dataset.x === "gpt") window.open("https://chatgpt.com/" + (q ? "?q=" + enc : ""), "_blank", "noopener");
    else if (b.dataset.x === "cla") window.open("https://claude.ai/new" + (q ? "?q=" + enc : ""), "_blank", "noopener");
    else { try { if (q) await navigator.clipboard.writeText(q); toast(q ? "Teks disalin. Tempel di Gemini." : "Membuka Gemini"); } catch { } window.open("https://gemini.google.com/app", "_blank", "noopener"); }
  });
  paintHist(); paintMsgs(); paintAgents(); paintFeed(); loadAgents(); startPoll();
}

/* ---------- router ---------- */
function render() {
  const t = window.__insightTab || "utama"; if (t !== "ai") stopPoll();
  if (!D.loaded) return;
  ({ utama: vUtama, ringkasan: vRingkasan, pengunjung: vPengunjung, aktivitas: vAktivitas, ai: vAI }[t] || vUtama)();
  document.querySelectorAll("[data-go]").forEach(a => a.onclick = e => { e.preventDefault(); try { parent.location.hash = "#" + a.dataset.go; } catch { } });
}
window.insightTab = t => { window.__insightTab = t; render(); };
window.__insightTab = "utama";
load().catch(e => { console.error(e); app.innerHTML = `<div class="card"><p class="muted">Gagal memuat: ${esc(e.code || e.message)}</p></div>`; });
