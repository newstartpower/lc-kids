import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, get, set, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";
import { createAdmin } from "./admin.js";

const $ = (id) => document.getElementById(id);
const TZ = "Asia/Bangkok";

/* ---------- ตัวช่วยทั่วไป ---------- */
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.indexOf("on") === 0) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
  }
  kids.flat().forEach((x) => {
    if (x == null || x === false) return;
    e.append(x.nodeType ? x : document.createTextNode(String(x)));
  });
  return e;
}
const fmtDate = (ts) => new Date(ts).toLocaleDateString("th-TH", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const fmtTime = (ts) => new Date(ts).toLocaleTimeString("th-TH", { timeZone: TZ, hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dayKey = (ts) => new Date(ts).toLocaleDateString("en-CA", { timeZone: TZ });

let toastTimer;
function toast(msg, kind) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "show " + (kind || "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ""; }, 4200);
}
function errMsg(e) {
  const m = String((e && (e.code || e.message)) || "");
  if (/permission_denied/i.test(m)) return "ไม่มีสิทธิ์บันทึกข้อมูล ตรวจ Rules ใน Firebase";
  if (/network/i.test(m)) return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง";
  return "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง";
}

/* ---------- รูปภาพ ---------- */
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
function shrink(img, max, q) {
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * s));
  c.height = Math.max(1, Math.round(img.height * s));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
}
const readFile = (file, max, q) => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => loadImg(fr.result).then((i) => res(shrink(i, max, q)), rej);
  fr.onerror = rej;
  fr.readAsDataURL(file);
});
const thumb = (url, max, q) => loadImg(url).then((i) => shrink(i, max, q));
function avatarFor(name) {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d");
  let hue = 0;
  for (const ch of String(name)) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  g.fillStyle = `hsl(${hue},55%,45%)`;
  g.fillRect(0, 0, 96, 96);
  g.fillStyle = "#fff";
  g.font = "bold 48px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(name).trim().charAt(0).toUpperCase() || "?", 48, 52);
  return c.toDataURL("image/jpeg", 0.8);
}

/* รับเฉพาะรูปถ่ายสดจากกล้อง: JPEG, ถ่ายภายใน 2 นาที, มีข้อมูลยี่ห้อ/รุ่นกล้องใน EXIF (รูปแคปหน้าจอไม่มี) */
function hasCameraExif(buf) {
  try {
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return false;
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off);
      if (marker === 0xffe1) {
        if (v.getUint32(off + 4) !== 0x45786966) return false;
        const t = off + 10;
        const le = v.getUint16(t) === 0x4949;
        const ifd = t + v.getUint32(t + 4, le);
        const n = v.getUint16(ifd, le);
        for (let i = 0; i < n; i++) {
          const tag = v.getUint16(ifd + 2 + i * 12, le);
          if (tag === 0x010f || tag === 0x0110) return true;
        }
        return false;
      }
      if ((marker & 0xff00) !== 0xff00) return false;
      off += 2 + v.getUint16(off + 2);
    }
  } catch (e) { /* ignore */ }
  return false;
}
/* สำรอง (เมื่อเปิดกล้องในหน้าเว็บไม่ได้): ผ่อนเกณฑ์ ไม่บังคับ EXIF/ชนิดไฟล์ เพราะ iPad/iPhone มักตัดข้อมูลนี้ออก */
async function liveCheck(file) {
  if (!/^image\//i.test(file.type)) return "ต้องเป็นรูปที่ถ่ายจากกล้องเท่านั้น";
  if (file.lastModified && Date.now() - file.lastModified > 300000) return "รูปนี้ถ่ายไว้นานแล้ว ต้องถ่ายใหม่ตอนนี้จากกล้อง";
  return null;
}

/* กล้องสดในหน้าเว็บ (getUserMedia): ถ่ายได้จากกล้องเท่านั้น ไม่มีทางเลือกรูปจากแกลเลอรี/แคปหน้าจอ */
const hasLiveCam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
function liveCapture(facing, title, maxW, q) {
  return new Promise((resolve, reject) => {
    let stream = null;
    const video = h("video", { autoplay: "", playsinline: "", muted: "" });
    video.muted = true;
    const close = (val, err) => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      wrap.remove();
      err ? reject(err) : resolve(val);
    };
    const shot = h("button", { class: "btn", type: "button", text: "ถ่ายรูป" });
    const cancel = h("button", { class: "btn ghost", type: "button", text: "ยกเลิก" });
    const wrap = h("div", { style: "position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:12px" },
      h("div", { style: "color:#fff;font-weight:600", text: title }),
      video,
      h("div", { style: "display:flex;gap:10px" }, cancel, shot));
    video.style.cssText = "max-width:100%;max-height:68vh;border-radius:14px;background:#111" + (facing === "user" ? ";transform:scaleX(-1)" : "");
    document.body.append(wrap);
    cancel.onclick = () => close(null);
    shot.onclick = () => {
      if (!video.videoWidth) return;
      const sc = Math.min(1, maxW / video.videoWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(video.videoWidth * sc);
      c.height = Math.round(video.videoHeight * sc);
      c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
      close(c.toDataURL("image/jpeg", q));
    };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
      .then((s) => { stream = s; video.srcObject = s; return video.play(); })
      .catch((e) => close(null, e));
  });
}
/* คืนค่า: dataURL | null (ยกเลิก) | "fallback" (เปิดกล้องในหน้าไม่ได้ ให้ใช้ช่องไฟล์สำรอง) */
async function tryLive(facing, title, maxW, q) {
  if (!hasLiveCam) return "fallback";
  try { return await liveCapture(facing, title, maxW, q); } catch (e) { toast("เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง แล้วลองใหม่", "bad"); return "fallback"; }
}

function drawQr(host, text, size) {
  host.replaceChildren();
  if (window.QRCode) {
    try {
      new window.QRCode(host, { text, width: size, height: size, colorDark: "#000000", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M });
      return;
    } catch (e) { /* fall through */ }
  }
  host.append(h("div", { class: "mono codebig", style: "color:#000", text }));
}

/* ---------- เริ่มต้น Firebase ---------- */
const configMissing = Object.values(firebaseConfig).some((v) => String(v).includes("PASTE"));
let auth = null;
let db = null;
let offset = 0;
const now = () => Date.now() + offset;
if (configMissing) {
  $("setupWarn").hidden = false;
  $("btnStart").disabled = true;
  $("modeNote").textContent = "ยังไม่ได้ตั้งค่า Firebase";
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
  onValue(ref(db, ".info/serverTimeOffset"), (s) => { offset = s.val() || 0; });
  $("modeNote").textContent = "เชื่อมต่อ Firebase แล้ว";
}
const authReady = configMissing
  ? Promise.resolve(null)
  : new Promise((res) => { const off = onAuthStateChanged(auth, (u) => { off(); res(u); }); });

const SESS = "fkc.sess";
const getSess = () => { try { return localStorage.getItem(SESS) === "1"; } catch (e) { return false; } };
const setSess = (on) => { try { on ? localStorage.setItem(SESS, "1") : localStorage.removeItem(SESS); } catch (e) { /* ignore */ } };

/* ---------- หน้าบ้าน (ผู้ปกครอง) ---------- */
const screens = ["cover", "login", "register", "wait", "face", "pass"];
let cur = "cover";
let uid = null;
const me = { fam: null, code: null, arrival: null };
const photos = { parent: null, child: null };
const sigs = { parent: null, child: null };
let passTimer = null;
let offs = [];
const st = { fam: undefined, code: undefined };

function go(n) {
  cur = n;
  screens.forEach((s) => { $("s-" + s).hidden = s !== n; });
  clearInterval(passTimer);
  passTimer = null;
  window.scrollTo(0, 0);
}
function stopWatch() {
  offs.forEach((f) => f());
  offs = [];
  st.fam = undefined;
  st.code = undefined;
}
function startWatch() {
  stopWatch();
  const bad = (e) => { toast(errMsg(e), "bad"); go("login"); };
  offs.push(onValue(ref(db, "families/" + uid), (s) => { st.fam = s.exists() ? s.val() : null; route(); }, bad));
  offs.push(onValue(ref(db, "qr/" + uid), (s) => { const v = s.val(); st.code = v && v.code ? v.code : null; route(); }, bad));
}
function route() {
  if (st.fam === undefined || st.code === undefined) return;
  me.fam = st.fam;
  me.code = st.code;
  if (!st.fam) { if (cur !== "register") go("register"); return; }
  if (!st.code) { renderWait(); if (cur !== "wait") go("wait"); return; }
  if (["cover", "login", "register", "wait"].includes(cur)) { renderFace(); go("face"); }
  else if (cur === "face") renderFace();
  else if (cur === "pass") renderPass();
}
const renderWait = () => { $("wait-text").textContent = "เจ้าหน้าที่กำลังออก QR Code ให้น้อง" + (me.fam ? me.fam.nick : "") + " เมื่อพร้อมแล้วระบบจะให้สแกนหน้าเพื่อเปิดแอปโดยอัตโนมัติ"; };
const renderFace = () => { $("face-title").textContent = "สแกนหน้าผู้ปกครองของน้อง" + (me.fam ? me.fam.nick : ""); };

$("btnStart").addEventListener("click", async () => {
  const b = $("btnStart");
  const label = b.textContent;
  b.disabled = true;
  b.textContent = "กำลังเตรียมระบบ...";
  try {
    const u = getSess() ? await authReady : null;
    if (u) { uid = u.uid; startWatch(); } else go("login");
  } catch (e) { go("login"); }
  b.disabled = false;
  b.textContent = label;
});
$("btnLine").addEventListener("click", async () => {
  const b = $("btnLine");
  b.disabled = true;
  try {
    const u = auth.currentUser || (await signInAnonymously(auth)).user;
    uid = u.uid;
    setSess(true);
    startWatch();
  } catch (e) {
    toast(e && e.code === "auth/operation-not-allowed" ? "ยังไม่ได้เปิด Anonymous ใน Firebase Authentication" : errMsg(e), "bad");
  }
  b.disabled = false;
});
function logout() {
  setSess(false);
  stopWatch();
  me.fam = me.code = me.arrival = null;
  go("login");
}
["btnLogoutW", "btnLogoutF", "btnLogoutP"].forEach((id) => $(id).addEventListener("click", logout));
$("btnRecheck").addEventListener("click", () => toast("ยังไม่มี QR Code รอเจ้าหน้าที่สักครู่"));

/* ลงทะเบียน */
function validReg() {
  const v = {
    nick: $("f-nick").value.trim(),
    first: $("f-first").value.trim(),
    last: $("f-last").value.trim(),
    phone: $("f-phone").value.trim(),
    guardian: $("f-guardian").value.trim(),
  };
  const miss = [];
  if (!v.nick) miss.push("ชื่อเล่นเด็ก");
  if (!v.first) miss.push("ชื่อจริงเด็ก");
  if (!v.last) miss.push("นามสกุลเด็ก");
  if (v.phone.replace(/\D/g, "").length < 9) miss.push("เบอร์โทรผู้ปกครอง (อย่างน้อย 9 หลัก)");
  if (!v.guardian) miss.push("ชื่อผู้ปกครอง");
  if (!photos.parent) miss.push("รูปผู้ปกครอง");
  if (!photos.child) miss.push("รูปเด็ก");
  return { v, miss };
}
$("f-pdpa").addEventListener("change", () => { $("f-submit").disabled = !$("f-pdpa").checked; });
function bindPick(inputId, boxId, key, label) {
  const inp = $(inputId);
  const apply = (url, sig) => {
    photos[key] = url;
    sigs[key] = sig;
    const box = $(boxId);
    box.classList.add("has");
    box.replaceChildren(h("img", { src: url, alt: label }), h("span", { class: "tag", text: label }), inp);
  };
  inp.addEventListener("click", async (ev) => {
    if (!hasLiveCam || inp.dataset.fb) { delete inp.dataset.fb; return; }
    ev.preventDefault();
    const url = await tryLive(key === "parent" ? "user" : "environment", "ถ่ายรูป" + label, 480, 0.7);
    if (url === "fallback") { inp.dataset.fb = "1"; inp.click(); return; }
    if (!url) return;
    apply(url, "live:" + Date.now());
  });
  inp.addEventListener("change", async function () {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const other = key === "parent" ? "child" : "parent";
    const sig = f.size + ":" + f.lastModified;
    try {
      const why = await liveCheck(f);
      if (why) { inp.value = ""; toast(why, "bad"); return; }
      if (sigs[other] === sig) { inp.value = ""; toast("รูปผู้ปกครองกับรูปเด็กเป็นรูปเดียวกัน ต้องถ่ายแยกกัน", "bad"); return; }
      apply(await readFile(f, 480, 0.7), sig);
    } catch (e) {
      inp.value = "";
      toast("เปิดรูปไม่ได้ ลองถ่ายใหม่", "bad");
    }
  });
}
bindPick("ph-parent", "pk-parent", "parent", "ผู้ปกครอง");
bindPick("ph-child", "pk-child", "child", "เด็ก");

$("regForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const box = $("f-err");
  if (!$("f-pdpa").checked) return;
  const r = validReg();
  if (r.miss.length) { box.textContent = "กรุณากรอกให้ครบ: " + r.miss.join(", "); box.hidden = false; return; }
  box.hidden = true;
  const btn = $("f-submit");
  btn.disabled = true;
  try {
    const childThumb = await thumb(photos.child, 96, 0.7);
    await set(ref(db, "photos/" + uid), { parent: photos.parent, child: photos.child });
    await set(ref(db, "families/" + uid), {
      ...r.v,
      childThumb,
      createdAt: serverTimestamp(),
      pdpa: { accepted: true, at: serverTimestamp(), version: "draft-1" },
    });
  } catch (e) {
    box.textContent = errMsg(e);
    box.hidden = false;
  }
  btn.disabled = !$("f-pdpa").checked;
});

/* สแกนหน้า -> QR */
async function submitFace(photo) {
  const aref = ref(db, "arrivals/" + uid);
  await set(aref, { ts: serverTimestamp(), photo });
  me.arrival = (await get(aref)).val();
  renderPass();
  go("pass");
}
$("ph-face").addEventListener("click", async (ev) => {
  const fi = $("ph-face");
  if (!hasLiveCam || fi.dataset.fb) { delete fi.dataset.fb; return; }
  ev.preventDefault();
  const photo = await tryLive("user", "สแกนหน้าผู้ปกครอง", 320, 0.65);
  if (photo === "fallback") { fi.dataset.fb = "1"; fi.click(); return; }
  if (!photo) return;
  try { await submitFace(photo); } catch (e) { toast(errMsg(e), "bad"); }
});
$("ph-face").addEventListener("change", async function () {
  const input = this;
  const f = input.files && input.files[0];
  if (!f) return;
  try {
    const why = await liveCheck(f);
    if (why) { toast(why, "bad"); return; }
    await submitFace(await readFile(f, 320, 0.65));
  } catch (e) {
    toast(errMsg(e), "bad");
  }
  input.value = "";
});
$("btnRescan").addEventListener("click", () => { renderFace(); go("face"); });

const PASS_TTL = 10 * 60 * 1000;
function tickPass() {
  if (!me.arrival) return;
  const left = me.arrival.ts + PASS_TTL - now();
  $("passClock").textContent = fmtTime(now());
  if (left <= 0) {
    clearInterval(passTimer);
    passTimer = null;
    $("qrHost").replaceChildren();
    $("qrHost").hidden = true;
    $("passCode").hidden = true;
    $("passExpired").hidden = false;
    $("passLeft").textContent = "";
    return;
  }
  const m = Math.floor(left / 60000);
  const s = Math.floor(left / 1000) % 60;
  $("passLeft").textContent = "ใช้ได้อีก " + m + ":" + (s < 10 ? "0" : "") + s;
}
function renderPass() {
  $("qrHost").hidden = false;
  $("passCode").hidden = false;
  $("passExpired").hidden = true;
  drawQr($("qrHost"), me.code, 220);
  $("passCode").textContent = me.code;
  clearInterval(passTimer);
  tickPass();
  passTimer = setInterval(tickPass, 1000);
  $("passChild").src = me.fam.childThumb;
  $("passName").textContent = "น้อง" + me.fam.nick + " · " + me.fam.first + " " + me.fam.last;
  $("passTime").textContent = "สแกนหน้าเมื่อ " + fmtDate(me.arrival.ts) + " " + fmtTime(me.arrival.ts);
  $("passSelfie").src = me.arrival.photo;
}

/* ---------- ลดการแคปหน้าจอ (เว็บบล็อกการแคปจริงไม่ได้ ทำได้แค่ลดความเสี่ยง) ---------- */
const veil = (on) => document.body.classList.toggle("veiled", on);
document.addEventListener("visibilitychange", () => veil(document.hidden));
window.addEventListener("blur", () => { if (!$("s-pass").hidden) veil(true); });
["focus", "pointerdown", "touchstart"].forEach((ev) => window.addEventListener(ev, () => { if (!document.hidden) veil(false); }, { passive: true }));
document.addEventListener("keyup", (e) => {
  if (e.key === "PrintScreen") {
    veil(true);
    try { navigator.clipboard.writeText("").catch(() => {}); } catch (x) { /* ignore */ }
    setTimeout(() => veil(false), 2000);
  }
});
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("dragstart", (e) => e.preventDefault());

/* ---------- หลังบ้าน ---------- */
const admin = createAdmin({ $, h, fmtDate, fmtTime, dayKey, toast, errMsg, readFile, thumb, drawQr, avatarFor, firebaseConfig, ADMIN_EMAIL, configMissing });
$("adminLink").addEventListener("click", () => admin.show());
