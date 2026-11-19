/* kota.js (v2): panel admin "Kota". Progres PER ARTIKEL: satu aksi menulis ke DUA tempat:
   (1) Firebase toko: event timeline di semua order PO yang memuat artikel itu (tampil di Cek Pesanan web utama)
   (2) Firebase city: cityArticles/{artikel} -> gambar artikel pindah ke bangunan yang sesuai di kota
   Resi per order tetap diisi di tab Pengiriman (kota tidak menampilkan resi/order). Tab Galeri Kota: moderasi + upload manual. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { STORE, CITY, CLOUD, STORE_BASE, CITY_SITE, cityReady } from "./kota-config.js";
import { buildUploadForm, loadCityMap } from "./city-upload.js";

const $ = s => document.querySelector(s), app = $("#app");
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
const toast = m => { const t = $("#kToast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 4200); };
const named = (cfg, name) => getApps().find(a => a.name === name) || initializeApp(cfg, name);

const STEPS = [
  { id: "received",  at: "Toko FTR",   label: "Pesanan diterima",  text: "Pesananmu mendarat di markas FTR. Kami mulai bergerak." },
  { id: "vendor",    at: "Vendor",     label: "Masuk vendor",      text: "Desainmu sudah di tangan vendor. Mesin sablon mulai menyala." },
  { id: "producing", at: "Vendor",     label: "Produksi",          text: "Kain dipotong, sablon naik. Kaosmu lagi dibentuk." },
  { id: "done",      at: "Vendor",     label: "Kaos jadi",         text: "Lolos pemeriksaan kualitas. Kaosmu siap tampil." },
  { id: "packed",    at: "Office FTR", label: "Dikemas",           text: "Dibungkus rapi, tinggal berangkat." },
  { id: "jnt",       at: "Kantor J&T", label: "Diserahkan ke J&T", text: "Paket sudah di tangan J&T. Perjalanan dimulai." },
  { id: "arrived",   at: "Rumah",      label: "Sampai tujuan",     text: "Paket mendarat di rumahmu. Kaos ini resmi jadi milikmu." }
];
const stepOf = id => STEPS.find(s => s.id === id);
const COLORS = [[/hitam|black/, "#1b1c1a"], [/putih|white/, "#efece0"], [/maroon|marun|burgundy/, "#6a1f2a"], [/merah|red/, "#b8322f"], [/navy|dongker/, "#1f2f55"], [/biru|blue/, "#3a64b0"], [/olive|army/, "#5d6a3a"], [/hijau|green/, "#4a7a4a"], [/kuning|yellow|gold/, "#dcb43a"], [/abu|grey|gray/, "#8d8f90"]];
const hexOf = n => { n = String(n || "").toLowerCase(); for (const [re, h] of COLORS) if (re.test(n)) return h; return "#6b6f72"; };
const slug = n => String(n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const absUrl = u => { if (!u) return ""; if (/^https?:/i.test(u)) return u; try { return new URL(u, STORE_BASE).href; } catch { return ""; } };
const itemsOf = o => Array.isArray(o.produk) ? o.produk.map(p => ({ nama: p.nama || "", warna: p.warna || "" })) : [{ nama: o.produk || "", warna: o.warna || "" }];
const paid = o => ["dp", "lunas"].includes(o.status || "pending");

let storeDb, cityDb, orders = [], produk = {}, feed = {}, gallery = [], spot = null, spotSel = null, loaded = false, sel = new Set();
const F = { q: "", all: false };

if (!cityReady()) {
  app.innerHTML = ""; const b = el("div", "k-box"); b.append(el("h2", "", "Firebase kota belum diisi"), el("p", "k-muted", "Isi objek CITY di kota-config.js, lalu muat ulang.")); app.append(b);
} else {
  const sApp = named(STORE, "fvckAdminApp"), cApp = named(CITY, "cityAdmin");
  storeDb = getFirestore(sApp); cityDb = getFirestore(cApp);
  let ok = 0; const seen = new Set();
  [getAuth(sApp), getAuth(cApp)].forEach((a, i) => onAuthStateChanged(a, u => { if (u) seen.add(i); if (seen.size === 2 && !ok) { ok = 1; load(); } }));
  setTimeout(() => { if (!ok) app.innerHTML = '<div class="k-box"><p class="k-muted">Belum login ke project toko dan project kota. Login ulang dari halaman utama admin (email dan password harus sama di kedua project).</p></div>'; }, 6000);
}
window.kotaTab = t => { window.__kotaTab = t; if (loaded) draw(); };
window.__kotaTab = "progres";

async function load() {
  app.innerHTML = '<p class="k-muted">Mengambil data…</p>';
  try {
    const [os, ps, as, fs, cs, gs, sp] = await Promise.all([
      getDocs(query(collection(storeDb, "orders"), orderBy("createdAt", "desc"))),
      getDocs(collection(storeDb, "produk")).catch(() => null),
      getDocs(collection(storeDb, "aksesoris")).catch(() => null),
      getDocs(collection(cityDb, "cityArticles")),
      getDoc(doc(cityDb, "cityConfig", "steps")).catch(() => null),
      getDocs(collection(cityDb, "cityGallery")).catch(() => null),
      getDoc(doc(cityDb, "cityConfig", "spotlight")).catch(() => null)
    ]);
    spot = sp && sp.exists() ? sp.data() : null; spotSel = spot ? spot.key : null;
    orders = os.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.kodePelunasan);
    produk = {};
    const addProd = (d, acc) => { const p = d.data(), n = p.nama || p.name; if (!n) return; produk[slug(n)] = { name: String(n), image: absUrl(p.thumbnail), color: hexOf(String(p.warna || "").split("/")[0]), badge: p.badge || "", poOpen: p.badge === "pre" && !p.poClosed, acc: !!acc }; };
    if (ps) ps.docs.forEach(d => addProd(d, false)); if (as) as.docs.forEach(d => addProd(d, true));
    feed = {}; fs.docs.forEach(d => feed[d.id] = d.data());
    if (cs && cs.exists()) (cs.data().steps || []).forEach(x => { const s = stepOf(x.id); if (s && x.text) s.text = String(x.text).slice(0, 200); });
    gallery = gs ? gs.docs.map(d => ({ id: d.id, ...d.data() })) : [];
  } catch (e) { console.error(e); app.innerHTML = ""; const b = el("div", "k-box"); b.append(el("p", "k-err", "Gagal memuat: " + (e.code || e.message)), el("p", "k-muted", "Cek aturan Firestore di project kota dan login admin.")); app.append(b); return; }
  loaded = true; draw();
}
const draw = () => window.__kotaTab === "galeri" ? drawGaleri() : window.__kotaTab === "sorotan" ? drawSorotan() : drawProgres();

/* ---------- artikel = pengelompokan order PO berbayar menurut nama produk ---------- */
const stripP = n => String(n || "").replace(/^\s*(\([^)]*\)\s*)+/, "").trim();
const toks = n => new Set(slug(n).split("-").filter(w => w.length > 1));
/* cocokkan nama artikel di order dengan produk: persis -> tanpa awalan "(Pre Order)" -> kemiripan kata */
function findProduk(name) {
  const ps = Object.values(produk), k1 = slug(name), k2 = slug(stripP(name));
  let f = ps.find(p => slug(p.name) === k1); if (f) return f;
  f = ps.find(p => slug(p.name) === k2 || slug(stripP(p.name)) === k2 || slug(stripP(p.name)) === k1); if (f) return f;
  const t = toks(stripP(name)); let best = null, bs = 0;
  ps.forEach(p => { const pt = toks(stripP(p.name)); let i = 0; t.forEach(w => { if (pt.has(w)) i++; }); const sc = i / Math.max(t.size, pt.size, 1); if (sc > bs) { bs = sc; best = p; } });
  return bs >= .6 ? best : null;
}
function articles() {
  const m = {};
  orders.filter(o => paid(o) && o.isPO).forEach(o => itemsOf(o).forEach(i => { const k = slug(i.nama); if (!k) return; const a = m[k] = m[k] || { key: k, name: i.nama, orders: new Set(), color: hexOf(i.warna) }; a.orders.add(o.id); }));
  Object.keys(feed).forEach(k => { m[k] = m[k] || { key: k, name: feed[k].name, orders: new Set(), color: feed[k].color }; });
  Object.keys(produk).forEach(k => { if (produk[k].poOpen) m[k] = m[k] || { key: k, name: produk[k].name, orders: new Set(), color: produk[k].color }; });
  if (F.all) Object.keys(produk).forEach(k => { m[k] = m[k] || { key: k, name: produk[k].name, orders: new Set(), color: produk[k].color }; });
  const q = F.q.toLowerCase();
  return Object.values(m).map(a => { const pr = findProduk(a.name); return { ...a, color: (pr && pr.color) || a.color, image: (pr && pr.image) || (feed[a.key] && feed[a.key].image) || "", feed: feed[a.key] || null }; })
    .filter(a => !q || a.name.toLowerCase().includes(q)).sort((a, b) => b.orders.size - a.orders.size || a.name.localeCompare(b.name));
}

/* ---------- tab Progres ---------- */
function drawProgres() {
  app.innerHTML = "";
  const head = el("div"); head.append(el("h2", "", "Progres artikel"), el("p", "k-muted", "Pilih artikel, pilih langkah, kirim. Gambar artikel pindah bangunan di kota, dan timeline semua order PO artikel itu ikut berubah. Kota tidak menampilkan data order atau resi."));
  const filt = el("div", "k-box k-bar");
  const q = el("input", "k-in"); q.placeholder = "Cari artikel"; q.value = F.q; q.oninput = () => { F.q = q.value; list(); };
  const al = el("label", "k-muted"); const cb = el("input"); cb.type = "checkbox"; cb.checked = F.all; cb.onchange = () => { F.all = cb.checked; list(); }; al.append(cb, " Tampilkan semua produk dan aksesoris");
  const all = el("button", "k-btn", "Pilih semua"); all.onclick = () => { articles().forEach(a => sel.add(a.key)); list(); };
  const none = el("button", "k-btn", "Kosongkan"); none.onclick = () => { sel.clear(); list(); };
  filt.append(q, al, all, none);
  const box = el("div", "k-box"); box.id = "kList";
  app.append(head, filt, box, stepsEditor(), actionBar()); list();
}
function list() {
  const box = $("#kList"); if (!box) return; box.innerHTML = ""; const rows = articles();
  if (!rows.length) box.append(el("p", "k-muted", "Belum ada artikel. Centang \"Tampilkan semua produk dan aksesoris\" untuk menambah artikel baru ke kota."));
  rows.forEach(a => {
    const r = el("div", "k-art"), cb = el("input"); cb.type = "checkbox"; cb.checked = sel.has(a.key); cb.onchange = () => { cb.checked ? sel.add(a.key) : sel.delete(a.key); bar(); };
    let pic; if (a.image) { pic = new Image(); pic.src = a.image; pic.loading = "lazy"; pic.alt = ""; pic.referrerPolicy = "no-referrer"; } else pic = el("div", "k-ph", "tanpa gambar");
    const info = el("div"), t = el("b", "", a.name), s = a.feed ? stepOf(a.feed.step) : null;
    t.append(el("span", "k-chip" + (a.feed ? (a.feed.hidden ? " off" : "") : " bad"), a.feed ? (a.feed.hidden ? "disembunyikan" : (s ? s.label : a.feed.step)) : "belum di kota"));
    const pr = findProduk(a.name); info.append(t, el("small", "", a.orders.size + " order PO berbayar" + (pr && pr.poOpen ? " · PO masih dibuka" : "") + (pr && pr.acc ? " · aksesoris" : "") + (a.feed && a.feed.note ? " · " + a.feed.note : "")));
    r.append(cb, pic, info);
    if (a.feed) { const bt = el("div", "k-bar"), hb = el("button", "k-btn", a.feed.hidden ? "Tampilkan" : "Sembunyikan"); hb.onclick = () => toggleHide(a); const db = el("button", "k-btn", "Hapus dari kota"); db.onclick = () => delArt(a); bt.append(hb, db); r.append(bt); }
    box.append(r);
  });
  bar();
}
function actionBar() {
  const w = el("div", "k-act"), c = el("div", "k-bar"); w.append(c);
  const sl = el("select", "k-sel"); sl.id = "kStep"; STEPS.forEach(s => sl.add(new Option(s.label + "  →  " + s.at, s.id)));
  const note = el("input", "k-in"); note.id = "kNote"; note.placeholder = "Catatan (opsional)"; note.maxLength = 120;
  const go = el("button", "k-btn ac", "Kirim update"); go.id = "kGo"; go.onclick = send; c.append(sl, note, go);
  const pv = el("p", "k-muted"); pv.id = "kPrev"; pv.style.margin = "6px 0 0"; w.append(pv); sl.onchange = bar; return w;
}
function bar() { const go = $("#kGo"), pv = $("#kPrev"), sl = $("#kStep"); if (!go) return; go.textContent = "Kirim update (" + sel.size + ")"; go.disabled = !sel.size; const s = stepOf(sl.value); pv.textContent = "Tampil di web: “" + (s ? s.text : "") + "”"; }
function stepsEditor() {
  const d = el("details", "k-box k-steps"); d.append(el("summary", "", "Teks tiap langkah (bisa diedit)"));
  STEPS.forEach(s => { d.append(el("label", "", s.label + " · " + s.at)); const t = el("textarea", "k-in"); t.value = s.text; t.maxLength = 200; t.onchange = () => { s.text = t.value.trim() || s.text; bar(); }; d.append(t); });
  const sv = el("button", "k-btn ac", "Simpan teks"); sv.style.marginTop = "10px";
  sv.onclick = async () => { try { await setDoc(doc(cityDb, "cityConfig", "steps"), { steps: STEPS.map(s => ({ id: s.id, text: s.text })), updatedAt: serverTimestamp() }); toast("Teks langkah disimpan"); } catch (e) { toast("Gagal: " + (e.code || e.message)); } };
  d.append(sv); return d;
}
async function send() {
  const stepId = $("#kStep").value, s = stepOf(stepId), note = $("#kNote").value.trim(), go = $("#kGo");
  const arts = articles().filter(a => sel.has(a.key)); if (!arts.length) return;
  const nOrders = new Set(arts.flatMap(a => [...a.orders])).size;
  if (!confirm("Kirim “" + s.label + "” untuk " + arts.length + " artikel?\nTimeline " + nOrders + " order PO ikut berubah, dan gambar artikel pindah ke " + s.at + " di kota.")) return;
  go.disabled = true; let okA = 0, okO = 0; const bad = [];
  const text = s.text + (note ? " Catatan: " + note + "." : "");
  for (const a of arts) {
    try {
      const ids = [...a.orders].map(id => orders.find(o => o.id === id)).filter(Boolean);
      for (let i = 0; i < ids.length; i += 400) {
        const b = writeBatch(storeDb);
        ids.slice(i, i + 400).forEach(o => b.set(doc(storeDb, "lacak", o.kodePelunasan, "timeline", "city-" + stepId), { kode: o.kodePelunasan, orderId: o.id, text, type: "manual", kind: "city", step: stepId, createdAt: serverTimestamp() }));
        await b.commit(); okO += Math.min(400, ids.length - i);
      }
      const prev = a.feed || {}, old = Array.isArray(prev.timeline) ? prev.timeline : [];
      await setDoc(doc(cityDb, "cityArticles", a.key), { name: a.name, image: a.image, color: a.color, step: stepId, note, hidden: prev.hidden === true ? true : false, timeline: [...old.filter(t => t.step !== stepId), { step: stepId, at: new Date().toISOString() }], updatedAt: serverTimestamp() });
      feed[a.key] = { ...prev, name: a.name, image: a.image, color: a.color, step: stepId, note, hidden: !!prev.hidden, timeline: [...old.filter(t => t.step !== stepId), { step: stepId, at: new Date().toISOString() }] }; okA++;
    } catch (e) { bad.push(a.name + ": " + (e.code || e.message)); }
  }
  toast(okA + " artikel terkirim (" + okO + " order)" + (bad.length ? ", gagal " + bad.length + ": " + bad[0] : "")); if (bad.length) console.warn(bad);
  sel.clear(); go.disabled = false; draw();
}
async function toggleHide(a) { try { await setDoc(doc(cityDb, "cityArticles", a.key), { hidden: !a.feed.hidden }, { merge: true }); feed[a.key].hidden = !a.feed.hidden; list(); toast(feed[a.key].hidden ? "Disembunyikan dari kota" : "Ditampilkan di kota"); } catch (e) { toast("Gagal: " + (e.code || e.message)); } }
async function delArt(a) { if (!confirm("Hapus “" + a.name + "” dari kota? (timeline di web utama tidak berubah)")) return; try { await deleteDoc(doc(cityDb, "cityArticles", a.key)); delete feed[a.key]; list(); toast("Dihapus dari kota"); } catch (e) { toast("Gagal: " + (e.code || e.message)); } }

/* ---------- tab Galeri Kota ---------- */
const ms = v => (v && v.toMillis ? v.toMillis() : 0);
function photoCard(g, pending) {
  const c = el("div", "k-card"), a = el("a"); a.href = g.url; a.target = "_blank"; a.rel = "noopener"; const im = new Image(); im.src = g.thumb || g.url; im.loading = "lazy"; im.alt = g.caption || ""; a.append(im);
  const d = el("div"); d.append(el("b", "", g.ig ? "@" + g.ig : "(tanpa IG)"), el("span", "", "📍 " + (g.cityArea || "")), el("span", "k-muted", g.placeName || (g.lat != null ? g.lat + ", " + g.lng : "tanpa lokasi nyata")));
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
  const h = el("div"); h.append(el("h2", "", "Galeri kota"), el("p", "k-muted", "Foto pengunjung menunggu persetujuan. Foto yang disetujui tampil di atas bangunan yang dipilih."));
  const b1 = el("div", "k-box"); b1.append(el("h2", "", "Antrean (" + pend.length + ")"));
  if (!pend.length) b1.append(el("p", "k-muted", "Tidak ada foto menunggu.")); else { const g = el("div", "k-gal"); pend.forEach(x => g.append(photoCard(x, true))); b1.append(g); }
  const b2 = el("div", "k-box"); b2.append(el("h2", "", "Upload manual"), el("p", "k-muted", "Untuk foto dari IG atau dokumentasi. Langsung tampil tanpa antrean. Gambar peta kota dibuat otomatis dari kota (pertama kali 10–30 detik)."));
  b2.append(buildUploadForm({ cloud: CLOUD, precision: 5, submitLabel: "Upload dan tampilkan", getMap: () => loadCityMap({ base: CITY_SITE, frame: CITY_SITE }), onSubmit: async d => {
    const row = { ...d, status: "approved", device: "admin", createdAt: serverTimestamp() }; const r = await addDoc(collection(cityDb, "cityGallery"), row);
    gallery.push({ id: r.id, ...row, createdAt: null }); toast("Foto ditambahkan ke kota"); setTimeout(draw, 1200); } }));
  const b3 = el("div", "k-box"); b3.append(el("h2", "", "Tampil di kota (" + ok.length + ")"));
  if (!ok.length) b3.append(el("p", "k-muted", "Belum ada.")); else { const g = el("div", "k-gal"); ok.slice(0, 120).forEach(x => g.append(photoCard(x, false))); b3.append(g); }
  app.append(h, b1, b2, b3);
}

/* ---------- tab Sorotan: satu artikel pilihan yang melayang di atas Toko FucktheRules City ---------- */
const LABELS = ["PRE ORDER", "READY STOCK", "NEW DROP", "SEGERA HADIR", "SOLD OUT"];
function labelBg(t) { t = String(t).toUpperCase(); return /READY/.test(t) ? "#5be39a" : /SOLD|HABIS/.test(t) ? "#e7e5ea" : /PRE/.test(t) ? "#ffd51e" : "#e6b3ef"; }
function previewCard(name, image, label) {
  const c = el("div", "sp-prev"), t = el("div", "sp-lab", String(label || "").toUpperCase() || "KETERANGAN"); t.style.background = labelBg(label || "");
  const ph = el("div", "sp-ph"); if (image) { const im = new Image(); im.src = image; im.alt = ""; im.referrerPolicy = "no-referrer"; ph.append(im); } else ph.textContent = "foto";
  c.append(t, ph, el("div", "sp-name", name || "Pilih artikel")); return c;
}
function drawSorotan() {
  app.innerHTML = "";
  const items = Object.entries(produk).map(([key, p]) => ({ key, ...p })).sort((a, b) => a.name.localeCompare(b.name));
  const head = el("div"); head.append(el("h2", "", "Sorotan toko"), el("p", "k-muted", "Satu artikel pilihan yang melayang di atas Toko FucktheRules City: keterangan di atas, foto dari thumbnail web utama, nama artikel di bawah."));
  const now = el("div", "k-box"); now.append(el("b", "", spot ? "Sekarang: " + spot.name + " · " + spot.label + (spot.hidden ? " (disembunyikan)" : "") : "Belum ada sorotan di kota."));
  const pick = el("div", "k-box"); pick.append(el("h2", "", "1 · Pilih artikel"));
  const q = el("input", "k-in"); q.placeholder = "Cari artikel"; pick.append(q);
  const grid = el("div", "sp-grid"); pick.append(grid);
  const lab = el("div", "k-box"); lab.append(el("h2", "", "2 · Keterangan"));
  const chips = el("div", "k-bar"), custom = el("input", "k-in"); custom.placeholder = "atau tulis sendiri (maks 20 huruf)"; custom.maxLength = 20; custom.value = spot && !LABELS.includes(spot.label) ? spot.label : "";
  let label = spot ? spot.label : "";
  const pv = el("div", "k-box"); pv.append(el("h2", "", "3 · Pratinjau")); const pvBox = el("div"); pv.append(pvBox);
  const cur = () => items.find(i => i.key === spotSel);
  const paintPrev = () => { const a = cur(); pvBox.innerHTML = ""; pvBox.append(previewCard(a ? a.name : (spot ? spot.name : ""), a ? a.image : (spot ? spot.image : ""), label)); };
  const paintChips = () => { chips.innerHTML = ""; LABELS.forEach(l => { const b = el("button", "k-btn" + (label === l ? " ac" : ""), l); b.onclick = () => { label = l; custom.value = ""; paintChips(); paintPrev(); }; chips.append(b); }); chips.append(custom); };
  custom.oninput = () => { label = custom.value.trim().toUpperCase(); paintChips.skip = 1; chips.querySelectorAll(".k-btn").forEach(b => b.classList.remove("ac")); paintPrev(); };
  const paintGrid = () => { const s = q.value.toLowerCase(); grid.innerHTML = "";
    items.filter(i => !s || i.name.toLowerCase().includes(s)).forEach(i => { const o = el("button", "sp-opt" + (i.key === spotSel ? " on" : ""));
      if (i.image) { const im = new Image(); im.src = i.image; im.alt = ""; im.loading = "lazy"; im.referrerPolicy = "no-referrer"; o.append(im); } else o.append(el("span", "sp-no", "tanpa foto"));
      o.append(el("b", "", i.name)); if (i.acc) o.append(el("small", "k-muted", "Aksesoris")); o.onclick = () => { spotSel = i.key; if (!label || LABELS.includes(label)) { label = i.badge === "pre" ? "PRE ORDER" : i.badge === "sold" ? "SOLD OUT" : "READY STOCK"; custom.value = ""; paintChips(); } paintGrid(); paintPrev(); }; grid.append(o); });
    if (!items.length) grid.append(el("p", "k-muted", "Produk dari web utama belum terbaca. Muat ulang halaman ini.")); };
  q.oninput = paintGrid; paintChips(); paintGrid(); paintPrev(); lab.append(chips);
  const act = el("div", "k-box k-bar");
  const save = el("button", "k-btn ac", "Tampilkan di kota");
  save.onclick = async () => { const a = cur(); if (!a) return toast("Pilih artikel dulu"); if (!label) return toast("Isi keterangan dulu");
    try { const d = { key: a.key, name: a.name, image: a.image || "", label, hidden: false, updatedAt: serverTimestamp() }; await setDoc(doc(cityDb, "cityConfig", "spotlight"), d); spot = { ...d, updatedAt: null }; toast("Sorotan tampil di atas toko"); draw(); } catch (e) { toast("Gagal: " + (e.code || e.message)); } };
  const hide = el("button", "k-btn", spot && spot.hidden ? "Tampilkan lagi" : "Sembunyikan"); hide.disabled = !spot;
  hide.onclick = async () => { try { await setDoc(doc(cityDb, "cityConfig", "spotlight"), { hidden: !spot.hidden }, { merge: true }); spot.hidden = !spot.hidden; toast(spot.hidden ? "Disembunyikan" : "Ditampilkan"); draw(); } catch (e) { toast("Gagal: " + (e.code || e.message)); } };
  const del = el("button", "k-btn", "Hapus sorotan"); del.disabled = !spot;
  del.onclick = async () => { if (!confirm("Hapus sorotan dari kota?")) return; try { await deleteDoc(doc(cityDb, "cityConfig", "spotlight")); spot = null; spotSel = null; toast("Sorotan dihapus"); draw(); } catch (e) { toast("Gagal: " + (e.code || e.message)); } };
  act.append(save, hide, del);
  app.append(head, now, pick, lab, pv, act);
}
