/* kota.js: panel admin "Kota" > Progres. Satu aksi menulis ke DUA tempat:
   (1) Firebase toko: timeline order (lacak/{kode}/timeline) dan resi  -> tampil di Cek Pesanan web utama
   (2) Firebase city: cityFeed/{kode}                                  -> menggerakkan ikon baju di kota */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, getDoc, doc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { STORE, CITY, CLOUD, cityReady } from "./kota-config.js";
import { buildUploadForm } from "./city-upload.js";

const $ = s => document.querySelector(s), app = $("#app");
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
const toast = m => { const t = $("#kToast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3800); };
const named = (cfg, name) => getApps().find(a => a.name === name) || initializeApp(cfg, name);

/* Langkah baku (default sama dengan config kota). Teks bisa diubah admin dan disimpan di cityConfig/steps. */
const STEPS = [
  { id: "received",  at: "Toko FTR",   label: "Pesanan diterima",   text: "Pesananmu mendarat di markas FTR. Kami mulai bergerak." },
  { id: "vendor",    at: "Vendor",     label: "Masuk vendor",       text: "Desainmu sudah di tangan vendor. Mesin sablon mulai menyala." },
  { id: "producing", at: "Vendor",     label: "Produksi",           text: "Kain dipotong, sablon naik. Kaosmu lagi dibentuk." },
  { id: "done",      at: "Vendor",     label: "Kaos jadi",          text: "Lolos pemeriksaan kualitas. Kaosmu siap tampil." },
  { id: "packed",    at: "Office FTR", label: "Dikemas",            text: "Dibungkus rapi, tinggal berangkat." },
  { id: "jnt",       at: "Kantor J&T", label: "Diserahkan ke J&T",  text: "Paket sudah di tangan J&T. Perjalanan dimulai." },
  { id: "arrived",   at: "Rumah",      label: "Sampai tujuan",      text: "Paket mendarat di rumahmu. Kaos ini resmi jadi milikmu." }
];
const COLORS = [[/hitam|black/, "#1b1c1a"], [/putih|white/, "#efece0"], [/maroon|marun|burgundy/, "#6a1f2a"], [/merah|red/, "#b8322f"], [/navy|dongker/, "#1f2f55"], [/biru|blue/, "#3a64b0"], [/olive|army/, "#5d6a3a"], [/hijau|green/, "#4a7a4a"], [/kuning|yellow|gold/, "#dcb43a"], [/abu|grey|gray/, "#8d8f90"]];
const hexOf = n => { n = String(n || "").toLowerCase(); for (const [re, h] of COLORS) if (re.test(n)) return h; return "#6b6f72"; };
const mask = n => { n = String(n || "").trim(); return n ? n[0].toUpperCase() + "•••" : ""; };
const itemsOf = o => Array.isArray(o.produk) ? o.produk.map(p => ({ nama: p.nama || "", warna: p.warna || "", size: p.size || "" })) : [{ nama: o.produk || "", warna: o.warna || "", size: o.size || "" }];

let storeDb, cityDb, gallery = [], loaded = false, orders = [], feed = {}, thumbs = {}, sel = new Set(), resiIn = {};
const F = { st: "bayar", q: "", art: "" };

/* ---------- mulai: tunggu login ---------- */
if (!cityReady()) {
  app.innerHTML = "";
  const b = el("div", "k-box"); b.append(el("h2", "", "Firebase kota belum diisi"), el("p", "k-muted", "Isi objek CITY di kota-config.js dengan config project Firebase \"city\", lalu muat ulang. Sampai itu terisi, panel ini tidak menulis apa pun."));
  app.append(b);
} else {
  const sApp = named(STORE, "fvckAdminApp"), cApp = named(CITY, "cityAdmin");
  storeDb = getFirestore(sApp); cityDb = getFirestore(cApp);
  let ok = 0; const need = [getAuth(sApp), getAuth(cApp)], seen = new Set();
  need.forEach((a, i) => onAuthStateChanged(a, u => { if (u) seen.add(i); if (seen.size === 2 && !ok) { ok = 1; load(); } }));
  setTimeout(() => { if (!ok) app.innerHTML = '<div class="k-box"><p class="k-muted">Belum login ke project toko dan project kota. Login ulang dari halaman utama admin (email dan password harus sama di kedua project).</p></div>'; }, 6000);
}
window.kotaTab = t => { window.__kotaTab = t; if (loaded) draw(); };
window.__kotaTab = "progres";

async function load() {
  app.innerHTML = '<p class="k-muted">Mengambil data…</p>';
  try {
    const [os, fs, ps, cs, gs] = await Promise.all([
      getDocs(query(collection(storeDb, "orders"), orderBy("createdAt", "desc"))),
      getDocs(collection(cityDb, "cityFeed")),
      getDocs(collection(storeDb, "produk")).catch(() => null),
      getDoc(doc(cityDb, "cityConfig", "steps")).catch(() => null),
      getDocs(collection(cityDb, "cityGallery")).catch(() => null)
    ]);
    gallery = gs ? gs.docs.map(d => ({ id: d.id, ...d.data() })) : [];
    orders = os.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.kodePelunasan);
    feed = {}; fs.docs.forEach(d => feed[d.id] = d.data());
    thumbs = {}; if (ps) ps.docs.forEach(d => { const p = d.data(); const n = p.nama || p.name; if (n) thumbs[String(n).toLowerCase()] = p.thumbnail || ""; });
    if (cs && cs.exists()) (cs.data().steps || []).forEach(x => { const s = STEPS.find(y => y.id === x.id); if (s && x.text) s.text = String(x.text).slice(0, 200); });
  } catch (e) { console.error(e); app.innerHTML = ""; const b = el("div", "k-box"); b.append(el("p", "k-err", "Gagal memuat: " + (e.code || e.message)), el("p", "k-muted", "Cek aturan Firestore di project kota dan login admin.")); app.append(b); return; }
  loaded = true; draw();
}

const paid = o => ["dp", "lunas"].includes(o.status || "pending");
const stepOf = id => STEPS.find(s => s.id === id);
function visible() {
  const q = F.q.toLowerCase();
  return orders.filter(o => (F.st === "semua" || paid(o)) && (!F.art || itemsOf(o).some(i => i.nama === F.art)) &&
    (!q || (o.kodePelunasan + " " + (o.orderNo || "") + " " + (o.nama || "") + " " + itemsOf(o).map(i => i.nama).join(" ")).toLowerCase().includes(q)));
}

/* ---------- tampilan ---------- */
function draw() { return window.__kotaTab === "galeri" ? drawGaleri() : drawProgres(); }
function drawProgres() {
  app.innerHTML = "";
  const head = el("div"); head.append(el("h2", "", "Progres pesanan"), el("p", "k-muted", "Pilih order, pilih langkah, kirim. Timeline web utama dan posisi ikon di kota berubah bersamaan."));
  const filt = el("div", "k-box k-bar");
  const q = el("input", "k-in"); q.placeholder = "Cari kode / nama / kaos"; q.value = F.q; q.oninput = () => { F.q = q.value; list(); };
  const st = el("select", "k-sel"); [["bayar", "Sudah DP / lunas"], ["semua", "Semua order"]].forEach(([v, t]) => st.add(new Option(t, v, false, v === F.st))); st.onchange = () => { F.st = st.value; list(); };
  const arts = [...new Set(orders.flatMap(o => itemsOf(o).map(i => i.nama)).filter(Boolean))].sort();
  const ar = el("select", "k-sel"); ar.add(new Option("Semua artikel", "")); arts.forEach(a => ar.add(new Option(a, a, false, a === F.art))); ar.onchange = () => { F.art = ar.value; list(); };
  const all = el("button", "k-btn", "Pilih semua yang tampil"); all.onclick = () => { visible().forEach(o => sel.add(o.id)); list(); };
  const none = el("button", "k-btn", "Kosongkan"); none.onclick = () => { sel.clear(); list(); };
  const sync = el("button", "k-btn", "Sinkronkan ke kota"); sync.onclick = syncMissing;
  filt.append(q, st, ar, all, none, sync);
  const box = el("div", "k-box"); box.id = "kList";
  app.append(head, filt, box, stepsEditor(), actionBar());
  list();
}
function list() {
  const box = $("#kList"); if (!box) return; box.innerHTML = "";
  const rows = visible(); if (!rows.length) { box.append(el("p", "k-muted", "Tidak ada order.")); } 
  rows.slice(0, 200).forEach(o => {
    const f = feed[o.kodePelunasan], its = itemsOf(o), r = el("div", "k-row");
    const cb = el("input"); cb.type = "checkbox"; cb.checked = sel.has(o.id); cb.onchange = () => { cb.checked ? sel.add(o.id) : sel.delete(o.id); bar(); };
    const info = el("div"), t = el("b", "", (o.orderNo ? o.orderNo + " · " : "") + o.kodePelunasan);
    const s = f ? stepOf(f.step) : null; const chip = el("span", "k-chip" + (f ? (f.hidden ? " off" : "") : " bad"), f ? (f.hidden ? "disembunyikan" : (s ? s.label : f.step)) : "belum di kota"); t.append(chip);
    info.append(t, el("small", "", its.map(i => i.nama + (i.size ? " (" + i.size + ")" : "")).join(", ")), el("small", "", (o.nama || "") + " · " + (o.status || "pending") + (o.isPO ? " · PO" : " · Ready")));
    if (f && f.resi) info.append(el("small", "", "Resi " + f.resi));
    r.append(cb, info);
    if (f) { const hb = el("button", "k-btn", f.hidden ? "Tampilkan" : "Sembunyikan"); hb.style.gridColumn = "2"; hb.style.justifySelf = "start"; hb.onclick = () => toggleHide(o, f); r.append(hb); }
    const ri = el("div", "k-resi"); ri.dataset.id = o.id; const inp = el("input", "k-in"); inp.placeholder = "No. resi (untuk langkah J&T)"; inp.value = resiIn[o.id] ?? (o.resi || ""); inp.oninput = () => { resiIn[o.id] = inp.value; }; ri.append(inp); r.append(ri);
    box.append(r);
  });
  if (rows.length > 200) box.append(el("p", "k-muted", "Menampilkan 200 pertama. Persempit dengan pencarian."));
  bar();
}
function actionBar() {
  const w = el("div", "k-act"), c = el("div", "k-bar"); w.append(c);
  const sl = el("select", "k-sel"); sl.id = "kStep"; STEPS.forEach(s => sl.add(new Option(s.label + "  →  " + s.at, s.id)));
  const note = el("input", "k-in"); note.id = "kNote"; note.placeholder = "Catatan (opsional)"; note.maxLength = 120;
  const go = el("button", "k-btn ac", "Kirim update"); go.id = "kGo"; go.onclick = send;
  c.append(sl, note, go); const pv = el("p", "k-muted"); pv.id = "kPrev"; pv.style.margin = "6px 0 0"; w.append(pv); sl.onchange = bar; return w;
}
function bar() {
  const go = $("#kGo"), pv = $("#kPrev"), sl = $("#kStep"); if (!go) return;
  go.textContent = "Kirim update (" + sel.size + ")"; go.disabled = !sel.size;
  const s = stepOf(sl.value); pv.textContent = "Tampil di web: “" + (s ? s.text : "") + "”";
}
function stepsEditor() {
  const d = el("details", "k-box k-steps"), sm = el("summary", "", "Teks tiap langkah (bisa diedit)"); d.append(sm);
  STEPS.forEach(s => { d.append(el("label", "", s.label + " · " + s.at)); const t = el("textarea", "k-in"); t.value = s.text; t.maxLength = 200; t.onchange = () => { s.text = t.value.trim() || s.text; bar(); }; d.append(t); });
  const sv = el("button", "k-btn ac", "Simpan teks"); sv.style.marginTop = "10px";
  sv.onclick = async () => { try { await setDoc(doc(cityDb, "cityConfig", "steps"), { steps: STEPS.map(s => ({ id: s.id, text: s.text })), updatedAt: serverTimestamp() }); toast("Teks langkah disimpan"); } catch (e) { toast("Gagal: " + (e.code || e.message)); } };
  d.append(sv); return d;
}

/* ---------- penulisan ---------- */
const feedDoc = (o, step, note, resi, prev) => {
  const its = itemsOf(o), first = its[0] || {}, img = thumbs[String(first.nama || "").toLowerCase()] || "";
  const old = (prev && prev.timeline) || [];
  return {
    code: o.kodePelunasan, orderId: o.id, name: (first.nama || "Pesanan") + (its.length > 1 ? " +" + (its.length - 1) : ""),
    color: hexOf(first.warna), size: first.size || "", image: img, buyer: mask(o.nama), isPO: !!o.isPO,
    step, note: note || "", resi: resi || "", hidden: prev ? !!prev.hidden : false,
    timeline: [...old.filter(t => t.step !== step), { step, at: new Date().toISOString() }], updatedAt: serverTimestamp()
  };
};
async function send() {
  const stepId = $("#kStep").value, s = stepOf(stepId), note = $("#kNote").value.trim(), go = $("#kGo");
  const rows = orders.filter(o => sel.has(o.id)); if (!rows.length) return;
  if (!confirm("Kirim “" + s.label + "” ke " + rows.length + " order?\nTimeline web utama dan posisi di kota ikut berubah.")) return;
  go.disabled = true; let ok = 0; const bad = [];
  for (const o of rows) {
    const kode = o.kodePelunasan, text = s.text + (note ? " Catatan: " + note + "." : "");
    try {
      const lk = await getDoc(doc(storeDb, "lacak", kode));
      if (!lk.exists()) throw new Error("belum disinkronkan di Pengiriman");
      let resi = (resiIn[o.id] ?? o.resi ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
      if (stepId === "jnt") {
        if (!resi) throw new Error("isi nomor resi dulu");
        const at = new Date().toISOString();
        await updateDoc(doc(storeDb, "orders", o.id), { resi, resiAt: at }); await updateDoc(doc(storeDb, "lacak", kode), { resi, resiAt: at });
        if (o.isPO) await setDoc(doc(storeDb, "lacak", kode, "timeline", "resi"), { kode, orderId: o.id, text, type: "manual", kind: "resi", createdAt: serverTimestamp() });
        o.resi = resi;
      } else if (o.isPO) {
        await setDoc(doc(storeDb, "lacak", kode, "timeline", "city-" + stepId), { kode, orderId: o.id, text, type: "manual", kind: "city", step: stepId, createdAt: serverTimestamp() });
      }
      const fd = feedDoc(o, stepId, note, stepId === "jnt" || stepId === "arrived" ? resi : (feed[kode] && feed[kode].resi) || "", feed[kode]);
      await setDoc(doc(cityDb, "cityFeed", kode), fd); feed[kode] = { ...fd, updatedAt: null }; ok++;
    } catch (e) { bad.push((o.orderNo || kode) + ": " + (e.code || e.message)); }
  }
  toast(ok + " order terkirim" + (bad.length ? ", gagal " + bad.length + " (" + bad[0] + ")" : "")); if (bad.length) console.warn(bad);
  sel.clear(); go.disabled = false; draw();
}
async function toggleHide(o, f) {
  try { await setDoc(doc(cityDb, "cityFeed", o.kodePelunasan), { hidden: !f.hidden }, { merge: true }); f.hidden = !f.hidden; list(); toast(f.hidden ? "Disembunyikan dari kota" : "Ditampilkan di kota"); } catch (e) { toast("Gagal: " + (e.code || e.message)); }
}
async function syncMissing() {
  const todo = orders.filter(o => paid(o) && !feed[o.kodePelunasan]); if (!todo.length) return toast("Semua order dibayar sudah ada di kota");
  if (!confirm("Salin " + todo.length + " order ke kota? Posisi awal: Pesanan diterima, atau J&T bila sudah ada resi.")) return;
  let ok = 0;
  for (const o of todo) { try { const st = o.resi ? "jnt" : "received", fd = feedDoc(o, st, "", o.resi || "", null); await setDoc(doc(cityDb, "cityFeed", o.kodePelunasan), fd); feed[o.kodePelunasan] = fd; ok++; } catch (e) { console.error(e); } }
  toast(ok + " order disalin ke kota"); draw();
}

/* ---------- tab Galeri: antrean persetujuan + upload manual ---------- */
const ms = v => (v && v.toMillis ? v.toMillis() : 0);
function photoCard(g, pending) {
  const c = el("div", "k-card"), a = el("a"); a.href = g.url; a.target = "_blank"; a.rel = "noopener"; const im = new Image(); im.src = g.thumb || g.url; im.loading = "lazy"; im.alt = g.caption || ""; a.append(im);
  const d = el("div"); d.append(el("b", "", g.ig ? "@" + g.ig : "(tanpa IG)"), el("span", "", g.cityArea || ""), el("span", "k-muted", g.placeName || (g.lat != null ? g.lat + ", " + g.lng : "tanpa lokasi nyata")));
  if (g.caption) d.append(el("span", "", g.caption));
  const bar = el("div", "k-bar");
  if (pending) { const ok = el("button", "k-btn ac", "Setujui"); ok.onclick = () => setGal(g, "approved"); bar.append(ok); }
  const del = el("button", "k-btn", pending ? "Tolak" : "Hapus"); del.onclick = () => delGal(g); bar.append(del); d.append(bar); c.append(a, d); return c;
}
async function setGal(g, status) { try { await updateDoc(doc(cityDb, "cityGallery", g.id), { status }); g.status = status; toast("Disetujui, tampil di kota"); draw(); } catch (e) { toast("Gagal: " + (e.code || e.message)); } }
async function delGal(g) { if (!confirm("Hapus foto ini dari galeri kota? (file di Cloudinary tidak ikut terhapus)")) return; try { await deleteDoc(doc(cityDb, "cityGallery", g.id)); gallery = gallery.filter(x => x.id !== g.id); draw(); toast("Dihapus"); } catch (e) { toast("Gagal: " + (e.code || e.message)); } }
function drawGaleri() {
  app.innerHTML = "";
  const pend = gallery.filter(g => g.status === "pending").sort((a, b) => ms(b.createdAt) - ms(a.createdAt)), ok = gallery.filter(g => g.status === "approved").sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  const h = el("div"); h.append(el("h2", "", "Galeri kota"), el("p", "k-muted", "Foto dari pengunjung menunggu persetujuan. Foto yang disetujui tampil sebagai pin di kota."));
  const b1 = el("div", "k-box"); b1.append(el("h2", "", "Antrean (" + pend.length + ")"));
  if (!pend.length) b1.append(el("p", "k-muted", "Tidak ada foto menunggu.")); else { const g = el("div", "k-gal"); pend.forEach(x => g.append(photoCard(x, true))); b1.append(g); }
  const b2 = el("div", "k-box"); b2.append(el("h2", "", "Upload manual"), el("p", "k-muted", "Untuk foto dari IG atau dokumentasi stadion. Langsung tampil tanpa antrean."));
  b2.append(buildUploadForm({ cloud: CLOUD, precision: 5, submitLabel: "Upload dan tampilkan", onSubmit: async d => {
    const row = { ...d, status: "approved", device: "admin", createdAt: serverTimestamp() }; const r = await addDoc(collection(cityDb, "cityGallery"), row);
    gallery.push({ id: r.id, ...row, createdAt: null }); toast("Foto ditambahkan ke kota"); setTimeout(draw, 1200); } }));
  const b3 = el("div", "k-box"); b3.append(el("h2", "", "Tampil di kota (" + ok.length + ")"));
  if (!ok.length) b3.append(el("p", "k-muted", "Belum ada.")); else { const g = el("div", "k-gal"); ok.slice(0, 120).forEach(x => g.append(photoCard(x, false))); b3.append(g); }
  app.append(h, b1, b2, b3);
}
