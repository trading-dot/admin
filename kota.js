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

let storeDb, cityDb, orders = [], produk = {}, feed = {}, gallery = [], loaded = false, sel = new Set();
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
    const [os, ps, fs, cs, gs] = await Promise.all([
      getDocs(query(collection(storeDb, "orders"), orderBy("createdAt", "desc"))),
      getDocs(collection(storeDb, "produk")).catch(() => null),
      getDocs(collection(cityDb, "cityArticles")),
      getDoc(doc(cityDb, "cityConfig", "steps")).catch(() => null),
      getDocs(collection(cityDb, "cityGallery")).catch(() => null)
    ]);
    orders = os.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.kodePelunasan);
    produk = {}; if (ps) ps.docs.forEach(d => { const p = d.data(), n = p.nama || p.name; if (n) produk[slug(n)] = { name: String(n), image: absUrl(p.thumbnail), color: hexOf((p.warna || "").split("/")[0]), po: !!p.status && /po|pre/i.test(String(p.status)) }; });
    feed = {}; fs.docs.forEach(d => feed[d.id] = d.data());
    if (cs && cs.exists()) (cs.data().steps || []).forEach(x => { const s = stepOf(x.id); if (s && x.text) s.text = String(x.text).slice(0, 200); });
    gallery = gs ? gs.docs.map(d => ({ id: d.id, ...d.data() })) : [];
  } catch (e) { console.error(e); app.innerHTML = ""; const b = el("div", "k-box"); b.append(el("p", "k-err", "Gagal memuat: " + (e.code || e.message)), el("p", "k-muted", "Cek aturan Firestore di project kota dan login admin.")); app.append(b); return; }
  loaded = true; draw();
}
const draw = () => window.__kotaTab === "galeri" ? drawGaleri() : drawProgres();

/* ---------- artikel = pengelompokan order PO berbayar menurut nama produk ---------- */
function articles() {
  const m = {};
  orders.filter(o => paid(o) && o.isPO).forEach(o => itemsOf(o).forEach(i => { const k = slug(i.nama); if (!k) return; const a = m[k] = m[k] || { key: k, name: i.nama, orders: new Set(), color: hexOf(i.warna) }; a.orders.add(o.id); }));
  Object.keys(feed).forEach(k => { m[k] = m[k] || { key: k, name: feed[k].name, orders: new Set(), color: feed[k].color }; });
  if (F.all) Object.keys(produk).forEach(k => { m[k] = m[k] || { key: k, name: produk[k].name, orders: new Set(), color: produk[k].color }; });
  const q = F.q.toLowerCase();
  return Object.values(m).map(a => ({ ...a, image: (produk[a.key] && produk[a.key].image) || (feed[a.key] && feed[a.key].image) || "", feed: feed[a.key] || null }))
    .filter(a => !q || a.name.toLowerCase().includes(q)).sort((a, b) => b.orders.size - a.orders.size || a.name.localeCompare(b.name));
}

/* ---------- tab Progres ---------- */
function drawProgres() {
  app.innerHTML = "";
  const head = el("div"); head.append(el("h2", "", "Progres artikel"), el("p", "k-muted", "Pilih artikel, pilih langkah, kirim. Gambar artikel pindah bangunan di kota, dan timeline semua order PO artikel itu ikut berubah. Kota tidak menampilkan data order atau resi."));
  const filt = el("div", "k-box k-bar");
  const q = el("input", "k-in"); q.placeholder = "Cari artikel"; q.value = F.q; q.oninput = () => { F.q = q.value; list(); };
  const al = el("label", "k-muted"); const cb = el("input"); cb.type = "checkbox"; cb.checked = F.all; cb.onchange = () => { F.all = cb.checked; list(); }; al.append(cb, " Tampilkan semua produk");
  const all = el("button", "k-btn", "Pilih semua"); all.onclick = () => { articles().forEach(a => sel.add(a.key)); list(); };
  const none = el("button", "k-btn", "Kosongkan"); none.onclick = () => { sel.clear(); list(); };
  filt.append(q, al, all, none);
  const box = el("div", "k-box"); box.id = "kList";
  app.append(head, filt, box, stepsEditor(), actionBar()); list();
}
function list() {
  const box = $("#kList"); if (!box) return; box.innerHTML = ""; const rows = articles();
  if (!rows.length) box.append(el("p", "k-muted", "Belum ada artikel. Centang \"Tampilkan semua produk\" untuk menambah artikel baru ke kota."));
  rows.forEach(a => {
    const r = el("div", "k-art"), cb = el("input"); cb.type = "checkbox"; cb.checked = sel.has(a.key); cb.onchange = () => { cb.checked ? sel.add(a.key) : sel.delete(a.key); bar(); };
    let pic; if (a.image) { pic = new Image(); pic.src = a.image; pic.loading = "lazy"; pic.alt = ""; pic.referrerPolicy = "no-referrer"; } else pic = el("div", "k-ph", "tanpa gambar");
    const info = el("div"), t = el("b", "", a.name), s = a.feed ? stepOf(a.feed.step) : null;
    t.append(el("span", "k-chip" + (a.feed ? (a.feed.hidden ? " off" : "") : " bad"), a.feed ? (a.feed.hidden ? "disembunyikan" : (s ? s.label : a.feed.step)) : "belum di kota"));
    info.append(t, el("small", "", a.orders.size + " order PO berbayar" + (a.feed && a.feed.note ? " · " + a.feed.note : "")));
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
  const b2 = el("div", "k-box"); b2.append(el("h2", "", "Upload manual"), el("p", "k-muted", "Untuk foto dari IG atau dokumentasi. Langsung tampil tanpa antrean. Gambar peta diambil dari " + CITY_SITE + "city-map.jpg."));
  b2.append(buildUploadForm({ cloud: CLOUD, precision: 5, submitLabel: "Upload dan tampilkan", getMap: () => loadCityMap({ base: CITY_SITE }), onSubmit: async d => {
    const row = { ...d, status: "approved", device: "admin", createdAt: serverTimestamp() }; const r = await addDoc(collection(cityDb, "cityGallery"), row);
    gallery.push({ id: r.id, ...row, createdAt: null }); toast("Foto ditambahkan ke kota"); setTimeout(draw, 1200); } }));
  const b3 = el("div", "k-box"); b3.append(el("h2", "", "Tampil di kota (" + ok.length + ")"));
  if (!ok.length) b3.append(el("p", "k-muted", "Belum ada.")); else { const g = el("div", "k-gal"); ok.slice(0, 120).forEach(x => g.append(photoCard(x, false))); b3.append(g); }
  app.append(h, b1, b2, b3);
}
