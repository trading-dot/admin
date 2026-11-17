import { onSession, loginEmail, loginGoogle, logoutAll, email } from "./auth.js";

// ====== Struktur menu: kategori -> sub tab (label sama persis dengan panel aslinya) ======
const NAV = [
  { id: "web", label: "Web Utama", icon: "fa-store", src: "web.html", tabs: [
      { g: "Transaksi" }, ["order", "Order"], ["rekap", "Rekap Pesanan"], ["kirim", "Pengiriman"], ["lacak", "Artikel PO"],
      { g: "Toko" }, ["produk", "Produk"], ["aksesoris", "Aksesoris"], ["tata", "Tata Letak"], ["stok", "Stok"], ["voucher", "Voucher"],
      { g: "Tampilan Web" }, ["galeri", "Galeri"], ["banner", "Banner"],
      { g: "Pelanggan" }, ["pelanggan", "Member"] ] },
  { id: "jurnal", label: "Jurnal", icon: "fa-newspaper", src: "jurnal.html", tabs: [
      ["overview", "Overview"], ["review", "AI review"], ["articles", "Articles"], ["discussion", "Discussion"], ["settings", "Settings"] ] },
  { id: "keuangan", label: "Keuangan", icon: "fa-wallet", src: "keuangan.html", tabs: [
      ["dash", "Dasbor"], ["masuk", "Pemasukan"], ["keluar", "Pengeluaran"], ["kaos", "Rekap Kaos"], ["ongkir", "Ongkir"] ] },
  { id: "kota", label: "Kota", icon: "fa-city", src: "kota.html", tabs: [
      ["progres", "Progres"], ["galeri", "Galeri Kota"] ] },
  { id: "ai", label: "AI Office", icon: "fa-robot", href: "https://ai.fucktherules.my.id" },
];

const $ = s => document.querySelector(s);
const toast = (t) => { const e = $("#toast"); e.textContent = t; e.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("show"), 3500); };
const cats = NAV.filter(c => c.tabs);
let cur = null;                        // {cat, tab}
const frames = {};                     // cat.id -> iframe

// ====== Login ======
const showErr = m => { const e = $("#loginErr"); e.textContent = m; e.style.display = m ? "block" : "none"; };
const busy = (b) => { $("#loginBtn").disabled = b; $("#googleBtn").disabled = b; $("#loginBtn").textContent = b ? "MASUK..." : "MASUK"; };
async function run(fn) {
  showErr(""); busy(true);
  try { const bad = await fn(); if (bad.length) setWarn(bad); }
  catch (e) { console.error(e); showErr(e.code === "auth/popup-closed-by-user" ? "" : "Email atau password salah."); }
  busy(false);
}
$("#loginBtn").onclick = () => run(() => loginEmail($("#adminEmail").value.trim(), $("#adminPass").value));
$("#adminPass").onkeydown = e => { if (e.key === "Enter") $("#loginBtn").click(); };
$("#googleBtn").onclick = () => run(loginGoogle);
$("#logoutBtn").onclick = async () => { await logoutAll(); };

function setWarn(bad) {
  const w = $("#warn");
  w.hidden = !bad.length;
  w.title = bad.length ? "Belum tersambung: " + bad.join(", ") + ". Cek apakah email/password sama di project itu." : "";
  if (bad.length) toast("Belum tersambung: " + bad.join(", "));
}
$("#warn").onclick = () => toast($("#warn").title);

onSession(u => {
  $("#loginPage").style.display = u ? "none" : "flex";
  $("#shell").hidden = !u;
  if (!u) {                                       // keluar: buang semua iframe supaya tidak ada data tersisa
    Object.values(frames).forEach(f => f.remove());
    for (const k in frames) delete frames[k];
    cur = null; closeDrawer(); return;
  }
  $("#who").textContent = email() || "";
  const [c, t] = location.hash.replace(/^#/, "").split("/");
  go(c, t, true);
});

// ====== Drawer / hamburger ======
const drawer = $("#drawer"), backdrop = $("#backdrop"), burger = $("#burger");
function openDrawer() { drawer.classList.add("open"); backdrop.classList.add("show"); burger.setAttribute("aria-expanded", "true"); }
function closeDrawer() { drawer.classList.remove("open"); backdrop.classList.remove("show"); burger.setAttribute("aria-expanded", "false"); }
burger.onclick = () => drawer.classList.contains("open") ? closeDrawer() : openDrawer();
backdrop.onclick = closeDrawer; $("#drawerClose").onclick = closeDrawer;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });

// Kategori diklik -> sub tab muncul di bawahnya (satu kategori terbuka sekali waktu)
function renderNav() {
  const nav = $("#nav"); nav.innerHTML = "";
  NAV.forEach(c => {
    if (c.href) {                                  // AI: hanya tautan, tanpa sub tab
      const a = document.createElement("a");
      a.className = "cat link"; a.href = c.href; a.target = "_blank"; a.rel = "noopener";
      a.innerHTML = `<i class="fas ${c.icon}"></i><span>${c.label}</span><i class="fas fa-arrow-up-right-from-square ext"></i>`;
      nav.append(a); return;
    }
    const b = document.createElement("button");
    b.className = "cat"; b.dataset.cat = c.id; b.setAttribute("aria-expanded", "false");
    b.innerHTML = `<i class="fas ${c.icon}"></i><span>${c.label}</span><i class="fas fa-chevron-down chev"></i>`;
    const sub = document.createElement("div"); sub.className = "sub"; sub.dataset.sub = c.id;
    c.tabs.forEach(t => {
      if (t.g) { const g = document.createElement("div"); g.className = "sub-g"; g.textContent = t.g; sub.append(g); return; }
      const s = document.createElement("button");
      s.className = "sub-item"; s.dataset.cat = c.id; s.dataset.tab = t[0]; s.textContent = t[1];
      s.onclick = () => { go(c.id, t[0]); closeDrawer(); };
      sub.append(s);
    });
    b.onclick = () => toggleCat(c.id);
    nav.append(b, sub);
  });
}
function toggleCat(id, force) {
  document.querySelectorAll(".cat[data-cat]").forEach(b => {
    const open = b.dataset.cat === id && (force ?? b.getAttribute("aria-expanded") !== "true");
    b.setAttribute("aria-expanded", open);
    document.querySelector(`.sub[data-sub="${b.dataset.cat}"]`).classList.toggle("open", open);
  });
}

// ====== Navigasi ke panel ======
function go(catId, tab, fromLoad) {
  const c = cats.find(x => x.id === catId) || cats[0];
  const first = c.tabs.find(t => Array.isArray(t));
  const t = c.tabs.find(x => Array.isArray(x) && x[0] === tab) || first;

  let f = frames[c.id];
  if (!f) {                                        // buat iframe saat pertama dibuka, lalu dibiarkan hidup (state tidak hilang)
    f = document.createElement("iframe");
    f.title = c.label; f.dataset.cat = c.id;
    f.src = c.src + "#" + t[0];
    f.onload = () => f.contentWindow.postMessage({ fvck: "tab", tab: f.dataset.tab }, location.origin);
    $("#frames").append(f); frames[c.id] = f;
  } else {
    f.contentWindow.postMessage({ fvck: "tab", tab: t[0] }, location.origin);
  }
  f.dataset.tab = t[0];
  Object.values(frames).forEach(x => x.classList.toggle("on", x === f));

  cur = { cat: c.id, tab: t[0] };
  $("#crumbCat").textContent = c.label; $("#crumbTab").textContent = t[1];
  document.title = t[1] + " · " + c.label + " | Admin FvcktheRules";
  document.querySelectorAll(".sub-item").forEach(b => b.classList.toggle("on", b.dataset.cat === c.id && b.dataset.tab === t[0]));
  toggleCat(c.id, true);
  history.replaceState(null, "", "#" + c.id + "/" + t[0]);
}
window.addEventListener("hashchange", () => {
  const [c, t] = location.hash.replace(/^#/, "").split("/");
  if (!$("#shell").hidden && (!cur || c !== cur.cat || t !== cur.tab)) go(c, t);
});

renderNav();
