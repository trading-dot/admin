/* city-upload.js (v1) — modul bersama kota + admin (salinan identik di kedua repo).
   Form "Upload Fotomu": username IG, foto, TEKAN titik di peta FucktheRules, lokasi asli (GPS / cari / tekan peta nyata), caption.
   Peta nyata = Leaflet (dimuat saat dibutuhkan) + tile OpenStreetMap. Foto diunggah ke Cloudinary (preset galeri Gloriam, folder fttr-city). */
export const MAP={b:{x1:-136,x2:276,z1:-196,z2:84},
  zones:[{n:'Wilayah Tani',r:[-112,258,-196,-70],c:'#5b7a43'},{n:'Northside',r:[-112,-22,-70,58],c:'#6f8a5c'},{n:'Central City',r:[-22,22,-70,58],c:'#8b9079'},{n:'Eastbank',r:[22,140,-70,58],c:'#6a855a'},{n:'Distrik Stadion',r:[140,258,-70,58],c:'#5f7f55'},{n:'Pantai',r:[-136,276,58,66],c:'#d9c58b'},{n:'Laut',r:[-136,276,66,84],c:'#2f6f9f'}],
  marks:[{n:'Old Trafford',x:-48,z:-47.5,s:1},{n:'GBK',x:181,z:-42,s:1},{n:'Stadion Maguwo',x:181,z:23.5,s:1},{n:'Danau',x:132,z:-19},{n:'Stasiun',x:8,z:-7},{n:'Wilayah Tani',x:8,z:-91}],
  lake:{x:132,z:-19,rx:15,rz:9.5}};
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e;};
export function areaName(x,z,extra=[]){
  const zone=MAP.zones.find(q=>x>=q.r[0]&&x<=q.r[1]&&z>=q.r[2]&&z<=q.r[3]);let best=null,bd=26;
  [...MAP.marks,...extra].forEach(m=>{const d=Math.hypot(m.x-x,m.z-z);if(d<bd){bd=d;best=m;}});
  return (zone?zone.n:'Kota')+(best&&(!zone||best.n!==zone.n)?' · dekat '+best.n:'');}

/* ---------- peta kota (kanvas 2D): geser, zoom, TEKAN langsung untuk menaruh pin ---------- */
export function cityPicker(host,{extra=[],onPick,initial}={}){
  const cv=el('canvas','cu-map'),ctx=cv.getContext('2d'),B=MAP.b;let W=0,H=0,s=1,fit=1,ox=(B.x1+B.x2)/2,oz=(B.z1+B.z2)/2,pin=initial||null;host.append(cv);
  const sx=x=>(x-ox)*s+W/2,sz=z=>(z-oz)*s+H/2,wx=px=>(px-W/2)/s+ox,wz=py=>(py-H/2)/s+oz;
  function size(){const r=cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);W=r.width;H=r.height;cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0);fit=Math.min(W/(B.x2-B.x1),H/(B.z2-B.z1));if(!s||s<fit*.5||!size.done){s=fit;ox=(B.x1+B.x2)/2;oz=(B.z1+B.z2)/2;size.done=1;}draw();}
  function draw(){ctx.fillStyle='#1d3b52';ctx.fillRect(0,0,W,H);
    MAP.zones.forEach(q=>{ctx.fillStyle=q.c;ctx.fillRect(sx(q.r[0]),sz(q.r[2]),(q.r[1]-q.r[0])*s,(q.r[3]-q.r[2])*s);});
    ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=1;MAP.zones.forEach(q=>ctx.strokeRect(sx(q.r[0]),sz(q.r[2]),(q.r[1]-q.r[0])*s,(q.r[3]-q.r[2])*s));
    const L=MAP.lake;ctx.fillStyle='#3d86b8';ctx.beginPath();ctx.ellipse(sx(L.x),sz(L.z),L.rx*s,L.rz*s,0,0,6.283);ctx.fill();
    ctx.font='700 '+Math.max(10,Math.min(15,s*9))+'px Inter,Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    MAP.zones.forEach(q=>{if(q.n==='Laut'||q.n==='Pantai'){}ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillText(q.n.toUpperCase(),sx((q.r[0]+q.r[1])/2),sz((q.r[2]+q.r[3])/2));});
    const all=[...MAP.marks,...(s>fit*3?extra:[])];ctx.font='700 11px Inter,Arial,sans-serif';
    all.forEach(m=>{const x=sx(m.x),y=sz(m.z);if(x<-20||y<-20||x>W+20||y>H+20)return;ctx.fillStyle=m.s?'#d7ff3f':'#171914';ctx.beginPath();ctx.arc(x,y,m.s?5:3.2,0,6.283);ctx.fill();ctx.strokeStyle='#171914';ctx.lineWidth=m.s?1.5:0;ctx.stroke();ctx.fillStyle='#fff';ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.fillText(m.n,x,y-10);ctx.shadowBlur=0;});
    if(pin){const x=sx(pin.x),y=sz(pin.z);ctx.fillStyle='#e0392d';ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y-12,9,0,6.283);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x-5,y-6);ctx.lineTo(x,y);ctx.lineTo(x+5,y-6);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y-12,3,0,6.283);ctx.fill();}}
  const P=new Map();let moved=0,pd=0;
  const clamp=()=>{ox=Math.max(B.x1,Math.min(B.x2,ox));oz=Math.max(B.z1,Math.min(B.z2,oz));s=Math.max(fit*.9,Math.min(fit*16,s));};
  cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);P.set(e.pointerId,{x:e.offsetX,y:e.offsetY});moved=0;if(P.size===2){const[a,b]=[...P.values()];pd=Math.hypot(a.x-b.x,a.y-b.y);}};
  cv.onpointermove=e=>{const p=P.get(e.pointerId);if(!p)return;const nx=e.offsetX,ny=e.offsetY;
    if(P.size===1){ox-=(nx-p.x)/s;oz-=(ny-p.y)/s;moved+=Math.abs(nx-p.x)+Math.abs(ny-p.y);}
    else if(P.size===2){p.x=nx;p.y=ny;const[a,b]=[...P.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pd){s*=d/pd;}pd=d;moved+=20;}
    p.x=nx;p.y=ny;clamp();draw();};
  cv.onpointerup=cv.onpointercancel=e=>{const p=P.get(e.pointerId);P.delete(e.pointerId);pd=0;if(p&&moved<8&&P.size===0){pin={x:Math.round(wx(e.offsetX)*10)/10,z:Math.round(wz(e.offsetY)*10)/10};draw();onPick&&onPick(pin.x,pin.z,areaName(pin.x,pin.z,extra));}};
  cv.onwheel=e=>{e.preventDefault();const bx=wx(e.offsetX),bz=wz(e.offsetY);s*=e.deltaY<0?1.2:1/1.2;clamp();ox+=bx-wx(e.offsetX);oz+=bz-wz(e.offsetY);clamp();draw();};
  new ResizeObserver(size).observe(cv);requestAnimationFrame(size);
  const bz=el('div','cu-zoom');[['+',1.4],['−',1/1.4]].forEach(([t,f])=>{const b=el('button','',t);b.type='button';b.onclick=()=>{s*=f;clamp();draw();};bz.append(b);});host.append(bz);
  return {get:()=>pin,clear(){pin=null;draw();}};}

/* ---------- peta nyata (Leaflet + OpenStreetMap) ---------- */
let LP=null;
export function loadLeaflet(){if(LP)return LP;const V='1.9.4',B='https://cdnjs.cloudflare.com/ajax/libs/leaflet/'+V+'/';
  LP=new Promise((ok,no)=>{if(window.L)return ok(window.L);const c=document.createElement('link');c.rel='stylesheet';c.href=B+'leaflet.css';document.head.append(c);const s=document.createElement('script');s.src=B+'leaflet.js';s.onload=()=>ok(window.L);s.onerror=()=>{LP=null;no(new Error('Peta nyata gagal dimuat'));};document.head.append(s);});return LP;}
export async function realMap(host,{onPick,initial,zoom=4,dark=true}={}){
  const L=await loadLeaflet(),d=el('div','cu-real'+(dark?' dark':''));host.append(d);
  const m=L.map(d,{worldCopyJump:true,attributionControl:true}).setView(initial||[-2.5,118],initial?15:zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(m);
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
export function buildUploadForm({cloud,extra=[],precision=3,submitLabel='Kirim foto',onSubmit}){
  const root=el('div','cu'),lab=(t)=>el('label','cu-lab',t);let city=null,real=null,realCtl=null,file=null;const rd=v=>Math.round(v*10**precision)/10**precision;
  const ig=el('input','cu-in');ig.placeholder='@username IG (opsional)';ig.maxLength=31;ig.autocapitalize='none';ig.autocomplete='off';
  const ph=el('input','cu-in');ph.type='file';ph.accept='image/*';const prev=el('img','cu-prev');prev.hidden=true;
  ph.onchange=()=>{file=ph.files[0]||null;prev.hidden=!file;if(file)prev.src=URL.createObjectURL(file);};
  const cityHost=el('div','cu-host'),areaTxt=el('p','cu-hint','Belum ada titik. Ketuk peta untuk menaruh pin.');
  const picker=cityPicker(cityHost,{extra,onPick:(x,z,n)=>{city={x,z,area:n};areaTxt.textContent='📍 '+n;}});
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
    if(!file){st.textContent='Pilih foto dulu.';return;}if(!city){st.textContent='Ketuk peta FucktheRules untuk menaruh pin.';return;}
    sub.disabled=true;try{st.textContent='Mengecilkan foto…';const blob=await compress(file);st.textContent='Mengunggah…';const url=await uploadCloudinary(blob,cloud);
      st.textContent='Menyimpan…';await onSubmit({url,thumb:thumbOf(url),ig:handle,caption:cap.value.trim().slice(0,200),cityX:city.x,cityZ:city.z,cityArea:city.area,lat:real?real.lat:null,lng:real?real.lng:null,placeName:place.value.trim().slice(0,120)});
      st.textContent='Terkirim ✓';ph.value='';file=null;prev.hidden=true;cap.value='';ig.value='';city=null;picker.clear();areaTxt.textContent='Belum ada titik. Ketuk peta untuk menaruh pin.';
    }catch(e){console.error(e);st.textContent='Gagal: '+(e.message||e.code||'coba lagi');}sub.disabled=false;};
  root.append(lab('Username IG'),ig,lab('Foto'),ph,prev,lab('1 · Taruh di peta FucktheRules'),cityHost,areaTxt,lab('2 · Lokasi asli (opsional)'),row,realHost,place,coord,lab('Caption'),cap,sub,st);
  return root;}
