/* city-upload.js (v2) — modul bersama kota + admin (salinan identik di kedua repo).
   Form "Upload Fotomu": username IG, foto, pilih BANGUNAN di gambar asli peta FucktheRules (hitbox per bangunan),
   lokasi asli (GPS / cari / ketuk peta nyata), caption. Peta nyata = Leaflet + OpenStreetMap. Foto -> Cloudinary. */
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e;};

/* ---------- peta kota: gambar asli + hitbox (fallback skematik bila gambar belum ada) ---------- */
export const MAP={b:{x1:-148,x2:284,z1:-262,z2:62},
  zones:[{r:[-148,284,-262,-70],c:'#5b7a43'},{r:[-112,258,-70,58],c:'#6f8a5c'},{r:[-148,284,58,62],c:'#d9c58b'}],
  boxes:[{id:'stadium-ot',name:'OLD TRAFFORD',x:-48,z:-47.5,w:42,d:37},{id:'stadium',name:'GELORA BUNG KARNO (GBK)',x:181,z:-42,w:42,d:37},{id:'stadium-maguwo',name:'STADION MAGUWO',x:181,z:23.5,w:42,d:37},{id:'station',name:'STASIUN',x:8,z:-7,w:10,d:8}]};
function fallbackMap(){const f=v=>Math.round(v*10)/10;return {bounds:MAP.b,w:0,h:0,img:null,fallback:true,boxes:MAP.boxes.map(b=>({id:b.id,name:b.name,x1:f(b.x-b.w/2),x2:f(b.x+b.w/2),z1:f(b.z-b.d/2),z2:f(b.z+b.d/2),top:6}))};}
const loadImg=u=>new Promise((ok,no)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>ok(i);i.onerror=()=>no(new Error('gambar peta gagal dimuat'));i.src=u;});
/* base: alamat tempat city-map.json/.jpg berada ('' = folder yang sama). live: fungsi yang merender peta dari kota yang sedang berjalan. */
export async function loadCityMap({base='',live=null}={}){
  try{const r=await fetch(base+'city-map.json',{cache:'no-cache'});if(!r.ok)throw 0;const j=await r.json();const img=await loadImg(base+'city-map.jpg');return {...j,img};}catch{}
  if(live){try{return live();}catch(e){console.warn('peta live gagal',e);}}
  return fallbackMap();}

export function cityPicker(host,{map,onPick}={}){
  const cv=el('canvas','cu-map'),ctx=cv.getContext('2d'),B=map.bounds,boxes=map.boxes.map(b=>({...b,cx:(b.x1+b.x2)/2,cz:(b.z1+b.z2)/2,area:(b.x2-b.x1)*(b.z2-b.z1)}));
  let W=0,H=0,s=1,fit=1,ox=(B.x1+B.x2)/2,oz=(B.z1+B.z2)/2,sel=null;host.append(cv);
  const sx=x=>(x-ox)*s+W/2,sz=z=>(z-oz)*s+H/2,wx=px=>(px-W/2)/s+ox,wz=py=>(py-H/2)/s+oz,ppu=map.img?map.img.width/(B.x2-B.x1):1;
  function size(){const r=cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);W=r.width;H=r.height;if(!W||!H)return;cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0);fit=Math.min(W/(B.x2-B.x1),H/(B.z2-B.z1));if(!size.done||s<fit*.5){s=fit;ox=(B.x1+B.x2)/2;oz=(B.z1+B.z2)/2;size.done=1;}draw();}
  function draw(){ctx.fillStyle='#1d3b52';ctx.fillRect(0,0,W,H);
    if(map.img){ctx.imageSmoothingEnabled=s<ppu*.9;ctx.drawImage(map.img,sx(B.x1),sz(B.z1),(B.x2-B.x1)*s,(B.z2-B.z1)*s);}
    else MAP.zones.forEach(q=>{ctx.fillStyle=q.c;ctx.fillRect(sx(q.r[0]),sz(q.r[2]),(q.r[1]-q.r[0])*s,(q.r[3]-q.r[2])*s);});
    ctx.lineWidth=1.5;ctx.font='800 11px Inter,Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    boxes.forEach(b=>{if(b===sel)return;const x=sx(b.x1),y=sz(b.z1),w=(b.x2-b.x1)*s,h=(b.z2-b.z1)*s;if(x>W||y>H||x+w<0||y+h<0)return;ctx.strokeStyle='rgba(255,255,255,.8)';ctx.setLineDash([4,3]);ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);
      if(w>64){ctx.fillStyle='#fff';ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.fillText(b.name.length>22?b.name.slice(0,21)+'…':b.name,x+w/2,y+h/2);ctx.shadowBlur=0;}});
    if(sel){const x=sx(sel.x1),y=sz(sel.z1),w=(sel.x2-sel.x1)*s,h=(sel.z2-sel.z1)*s;ctx.fillStyle='rgba(255,213,30,.38)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#111';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);ctx.strokeStyle='#ffd51e';ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,h);
      const px=x+w/2,py=y+h/2;ctx.fillStyle='#e5484d';ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(px,py-16,10,0,6.283);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(px-6,py-9);ctx.lineTo(px,py);ctx.lineTo(px+6,py-9);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py-16,3.5,0,6.283);ctx.fill();
      const t=sel.name;ctx.font='800 12px Inter,Arial,sans-serif';const tw=ctx.measureText(t).width+16;ctx.fillStyle='#111';ctx.fillRect(px-tw/2,py-48,tw,20);ctx.fillStyle='#ffd51e';ctx.fillText(t,px,py-38);}}
  function pickAt(px,py){const x=wx(px),z=wz(py),tol=8/s;let best=null,ba=1e12;
    boxes.forEach(b=>{if(x>=b.x1-tol&&x<=b.x2+tol&&z>=b.z1-tol&&z<=b.z2+tol&&b.area<ba){best=b;ba=b.area;}});return best;}
  function areaOf(x,z){let best=null,bd=30;boxes.forEach(b=>{const dx=Math.max(b.x1-x,0,x-b.x2),dz=Math.max(b.z1-z,0,z-b.z2),d=Math.hypot(dx,dz);if(d<bd){bd=d;best=b;}});return best?'Dekat '+best.name:'Jalan kota';}
  function chooseFree(x,z){x=Math.round(x*10)/10;z=Math.round(z*10)/10;const nm=areaOf(x,z);sel={free:true,id:'',name:nm,x1:x,x2:x,z1:z,z2:z,cx:x,cz:z,top:0};draw();onPick&&onPick({id:'',name:nm,x,z,top:0,free:true});}
  function choose(b,fly){sel=b;if(fly){s=Math.min(fit*14,Math.max(s,fit*3.5));ox=b.cx;oz=b.cz;clamp();}draw();onPick&&onPick({id:b.id,name:b.name,x:Math.round(b.cx*10)/10,z:Math.round(b.cz*10)/10,top:b.top});}
  const P=new Map();let moved=0,pd=0;
  const clamp=()=>{ox=Math.max(B.x1,Math.min(B.x2,ox));oz=Math.max(B.z1,Math.min(B.z2,oz));s=Math.max(fit*.9,Math.min(fit*16,s));};
  cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);P.set(e.pointerId,{x:e.offsetX,y:e.offsetY});moved=0;if(P.size===2){const[a,b]=[...P.values()];pd=Math.hypot(a.x-b.x,a.y-b.y);}};
  cv.onpointermove=e=>{const p=P.get(e.pointerId);if(!p)return;const nx=e.offsetX,ny=e.offsetY;
    if(P.size===1){ox-=(nx-p.x)/s;oz-=(ny-p.y)/s;moved+=Math.abs(nx-p.x)+Math.abs(ny-p.y);}
    else if(P.size===2){p.x=nx;p.y=ny;const[a,b]=[...P.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pd)s*=d/pd;pd=d;moved+=20;}
    p.x=nx;p.y=ny;clamp();draw();};
  cv.onpointerup=cv.onpointercancel=e=>{const p=P.get(e.pointerId);P.delete(e.pointerId);pd=0;if(p&&moved<8&&P.size===0){const b=pickAt(e.offsetX,e.offsetY);if(b)choose(b,false);else chooseFree(wx(e.offsetX),wz(e.offsetY));}};
  cv.onwheel=e=>{e.preventDefault();const bx=wx(e.offsetX),bz=wz(e.offsetY);s*=e.deltaY<0?1.2:1/1.2;clamp();ox+=bx-wx(e.offsetX);oz+=bz-wz(e.offsetY);clamp();draw();};
  new ResizeObserver(size).observe(cv);requestAnimationFrame(size);
  const zb=el('div','cu-zoom');[['+',1.4],['−',1/1.4]].forEach(([t,f])=>{const b=el('button','',t);b.type='button';b.onclick=()=>{s*=f;clamp();draw();};zb.append(b);});host.append(zb);
  return {get:()=>sel,select(id){const b=boxes.find(q=>q.id===id);if(b)choose(b,true);},clear(){sel=null;draw();},boxes};}

/* ---------- peta nyata (Leaflet + OpenStreetMap) ---------- */
let LP=null;
export function loadLeaflet(){if(LP)return LP;const V='1.9.4',B='https://cdnjs.cloudflare.com/ajax/libs/leaflet/'+V+'/';
  LP=new Promise((ok,no)=>{if(window.L)return ok(window.L);const c=document.createElement('link');c.rel='stylesheet';c.href=B+'leaflet.css';document.head.append(c);const s=document.createElement('script');s.src=B+'leaflet.js';s.onload=()=>ok(window.L);s.onerror=()=>{LP=null;no(new Error('Peta nyata gagal dimuat'));};document.head.append(s);});return LP;}
/* lapisan dasar: Satelit (citra Esri + nama tempat) atau Peta jalan (OSM). Pilihan diingat per perangkat. */
export function baseLayers(L,map){
  const sat=L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,maxNativeZoom:18,attribution:'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'}),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,maxNativeZoom:18})]);
  const osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,className:'osm-dark',attribution:'&copy; OpenStreetMap contributors'});
  let pick='sat';try{pick=localStorage.getItem('ftr.city.base')||'sat';}catch{}
  (pick==='osm'?osm:sat).addTo(map);
  L.control.layers({'🛰️ Satelit':sat,'🗺️ Peta':osm},null,{position:'topright',collapsed:true}).addTo(map);
  map.on('baselayerchange',e=>{try{localStorage.setItem('ftr.city.base',e.layer===osm?'osm':'sat');}catch{}});}
export async function realMap(host,{onPick,initial,zoom=4}={}){
  const L=await loadLeaflet(),d=el('div','cu-real');host.append(d);
  const m=L.map(d,{worldCopyJump:true,attributionControl:true}).setView(initial||[-2.5,118],initial?15:zoom);
  baseLayers(L,m);
  let mk=null;const put=(lat,lng)=>{if(mk)mk.setLatLng([lat,lng]);else mk=L.marker([lat,lng]).addTo(m);};
  if(initial)put(initial[0],initial[1]);
  m.on('click',e=>{put(e.latlng.lat,e.latlng.lng);onPick&&onPick(e.latlng.lat,e.latlng.lng);});
  setTimeout(()=>m.invalidateSize(),250);
  return {set(lat,lng,z=15){put(lat,lng);m.setView([lat,lng],z);},map:m};}
export async function geoSearch(q){const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=id&q='+encodeURIComponent(q));const j=await r.json();if(!j[0])return null;return {lat:+j[0].lat,lng:+j[0].lon,name:String(j[0].display_name).split(',').slice(0,3).join(',').trim()};}
export async function geoReverse(lat,lng){try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&accept-language=id&lat=${lat}&lon=${lng}`);const j=await r.json();return j&&j.display_name?String(j.display_name).split(',').slice(0,3).join(',').trim():'';}catch{return '';}}

/* ---------- foto: kompres di perangkat, unggah ke Cloudinary ---------- */
export async function compress(file,max=1600,q=.82){
  try{const bm=await createImageBitmap(file,{imageOrientation:'from-image'}),k=Math.min(1,max/Math.max(bm.width,bm.height)),c=document.createElement('canvas');c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',q));return b&&b.size<file.size?b:file;}catch{return file;}}
export async function uploadCloudinary(blob,cfg){const f=new FormData();f.append('file',blob);f.append('upload_preset',cfg.preset);if(cfg.folder)f.append('folder',cfg.folder);f.append('tags','fttr-city');
  const r=await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`,{method:'POST',body:f}),j=await r.json();
  if(!j.secure_url)throw new Error((j.error&&j.error.message)||'Upload gagal');return j.secure_url;}
export const thumbOf=u=>String(u).replace('/upload/','/upload/c_fill,w_200,h_200,q_auto,f_auto/');
export const cleanIg=v=>{v=String(v||'').trim().replace(/^@+/,'');return /^[A-Za-z0-9._]{1,30}$/.test(v)?v:'';};

/* ---------- form lengkap ---------- */
const HINT='Ketuk bangunan (garis putus-putus) untuk menaruh di atasnya, atau ketuk tempat lain (jalan, taman, mana saja) untuk menaruh bebas di titik itu.';
export function buildUploadForm({cloud,getMap,precision=3,submitLabel='Kirim foto',onSubmit}){
  const root=el('div','cu'),lab=t=>el('label','cu-lab',t);let bld=null,real=null,realCtl=null,file=null,picker=null;const rd=v=>Math.round(v*10**precision)/10**precision;
  const ig=el('input','cu-in');ig.placeholder='@username IG (opsional)';ig.maxLength=31;ig.autocapitalize='none';ig.autocomplete='off';
  const ph=el('input','cu-in');ph.type='file';ph.accept='image/*';const prev=el('img','cu-prev');prev.hidden=true;
  ph.onchange=()=>{file=ph.files[0]||null;prev.hidden=!file;if(file)prev.src=URL.createObjectURL(file);};
  const cityHost=el('div','cu-host'),areaTxt=el('p','cu-hint','Memuat peta kota…'),pickSel=el('select','cu-in');pickSel.hidden=true;
  Promise.resolve().then(()=>getMap()).then(map=>{
    picker=cityPicker(cityHost,{map,onPick:b=>{bld=b;areaTxt.textContent=b.free?'📍 Titik bebas · '+b.name:'📍 '+b.name+' · foto tampil di atas bangunan ini';pickSel.value=b.id||'';}});
    areaTxt.textContent=map.fallback?'Gambar peta belum tersedia, memakai peta sederhana. Ketuk di mana saja untuk menaruh titik.':HINT;
    pickSel.add(new Option('— atau pilih bangunan dari daftar —',''));[...picker.boxes].sort((a,b)=>a.name.localeCompare(b.name)).forEach(b=>pickSel.add(new Option(b.name,b.id)));pickSel.hidden=false;
    pickSel.onchange=()=>{if(pickSel.value)picker.select(pickSel.value);};
  }).catch(e=>{areaTxt.textContent='Peta gagal dimuat: '+e.message;});
  const gps=el('button','cu-btn','📡 Pakai GPS');gps.type='button';const q=el('input','cu-in');q.placeholder='Cari tempat, mis. Stamford Bridge, London';const go=el('button','cu-btn','Cari');go.type='button';
  const row=el('div','cu-row');row.append(gps,q,go);const realHost=el('div','cu-host'),place=el('input','cu-in');place.placeholder='Nama lokasi asli (bisa diedit)';place.maxLength=120;const coord=el('p','cu-hint','');
  const setReal=async(lat,lng,name,fly)=>{real={lat:rd(lat),lng:rd(lng)};coord.textContent='Koordinat '+real.lat+', '+real.lng+(precision<5?' (dibulatkan agar tidak menunjuk rumah pribadi)':'');
    if(fly&&realCtl)realCtl.set(lat,lng);if(name!==undefined)place.value=name;else{place.value='';const n=await geoReverse(lat,lng);if(n&&!place.value)place.value=n;}};
  const ensure=async()=>{if(realCtl)return;try{realCtl=await realMap(realHost,{onPick:(a,b)=>setReal(a,b,undefined,false)});}catch(e){realHost.append(el('p','cu-hint',e.message));}};
  ensure();
  gps.onclick=()=>{if(!navigator.geolocation){coord.textContent='GPS tidak tersedia di perangkat ini.';return;}coord.textContent='Mencari lokasi…';navigator.geolocation.getCurrentPosition(async p=>{await ensure();setReal(p.coords.latitude,p.coords.longitude,undefined,true);},()=>{coord.textContent='GPS ditolak. Cari nama tempat atau ketuk peta.';},{enableHighAccuracy:true,timeout:12000});};
  const doSearch=async()=>{const t=q.value.trim();if(!t)return;coord.textContent='Mencari…';try{const r=await geoSearch(t);if(!r){coord.textContent='Tempat tidak ditemukan.';return;}await ensure();setReal(r.lat,r.lng,r.name,true);}catch{coord.textContent='Pencarian gagal. Ketuk peta saja.';}};
  go.onclick=doSearch;q.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();doSearch();}};
  const cap=el('textarea','cu-in');cap.placeholder='Caption (opsional)';cap.maxLength=200;cap.rows=2;
  const st=el('p','cu-hint'),sub=el('button','cu-btn ac',submitLabel);sub.type='button';
  sub.onclick=async()=>{
    const handle=cleanIg(ig.value);if(ig.value.trim()&&!handle){st.textContent='Username IG tidak valid (huruf, angka, titik, garis bawah).';return;}
    if(!file){st.textContent='Pilih foto dulu.';return;}if(!bld){st.textContent='Ketuk peta FucktheRules dulu (bangunan atau titik bebas).';return;}
    sub.disabled=true;try{st.textContent='Mengecilkan foto…';const blob=await compress(file);st.textContent='Mengunggah…';const url=await uploadCloudinary(blob,cloud);
      st.textContent='Menyimpan…';await onSubmit({url,thumb:thumbOf(url),ig:handle,caption:cap.value.trim().slice(0,200),place:bld.id,cityArea:bld.name,cityX:bld.x,cityZ:bld.z,cityY:bld.top,lat:real?real.lat:null,lng:real?real.lng:null,placeName:place.value.trim().slice(0,120)});
      st.textContent='Terkirim ✓';ph.value='';file=null;prev.hidden=true;cap.value='';ig.value='';bld=null;picker&&picker.clear();pickSel.value='';areaTxt.textContent=HINT;
    }catch(e){console.error(e);st.textContent='Gagal: '+(e.message||e.code||'coba lagi');}sub.disabled=false;};
  root.append(lab('Username IG'),ig,lab('Foto'),ph,prev,lab('1 · Taruh di peta FucktheRules'),cityHost,areaTxt,pickSel,lab('2 · Lokasi asli (opsional)'),row,realHost,place,coord,lab('Caption'),cap,sub,st);
  return root;}
