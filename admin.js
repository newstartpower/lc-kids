import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, onValue, query, limitToLast, get, update, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

export function createAdmin(c) {
  const { $, h, fmtDate, fmtTime, dayKey, toast, errMsg, readFile, thumb, drawQr, avatarFor, firebaseConfig, ADMIN_EMAIL, configMissing } = c;
  const MAX_FACE_AGE = 10 * 60 * 1000;
  const A = { fams: {}, qrs: {}, logs: [] };
  let auth = null;
  let db = null;
  let inited = false;
  let signedIn = false;
  let visible = false;
  let offset = 0;
  let unsubs = [];
  const now = () => Date.now() + offset;

  /* ---------- เริ่มระบบหลังบ้าน (แยกบัญชีออกจากผู้ปกครอง) ---------- */
  function init() {
    if (inited) return true;
    if (configMissing) { toast("ยังไม่ได้ใส่ค่า Firebase ในไฟล์ firebase-config.js", "bad"); return false; }
    const app = initializeApp(firebaseConfig, "staff");
    auth = getAuth(app);
    db = getDatabase(app);
    onValue(ref(db, ".info/serverTimeOffset"), (s) => { offset = s.val() || 0; });
    onAuthStateChanged(auth, (u) => {
      signedIn = !!u && u.email === ADMIN_EMAIL;
      if (signedIn) start(); else stop();
      paint();
    });
    inited = true;
    return true;
  }
  function paint() {
    if (!visible) return;
    $("adminGate").hidden = signedIn;
    $("adminApp").hidden = !signedIn;
  }
  function show() {
    if (!init()) return;
    visible = true;
    $("parentView").hidden = true;
    $("adminView").hidden = false;
    paint();
    if (!signedIn) setTimeout(() => $("adminPw").focus(), 0);
  }
  function hide() {
    visible = false;
    $("adminView").hidden = true;
    $("parentView").hidden = false;
  }
  $("btnBackP").addEventListener("click", hide);
  $("btnBackP2").addEventListener("click", hide);
  $("btnLock").addEventListener("click", () => { if (auth) signOut(auth); });
  $("gateForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const box = $("gateErr");
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, $("adminPw").value);
      box.hidden = true;
      $("adminPw").value = "";
    } catch (e) {
      const code = (e && e.code) || "";
      box.textContent =
        code === "auth/operation-not-allowed" ? "ยังไม่ได้เปิด Email/Password ใน Firebase Authentication"
        : code === "auth/network-request-failed" ? "เชื่อมต่ออินเทอร์เน็ตไม่ได้"
        : code === "auth/too-many-requests" ? "ลองผิดหลายครั้ง รอสักครู่แล้วลองใหม่"
        : "รหัสไม่ถูกต้อง";
      box.hidden = false;
      $("adminPw").select();
    }
  });

  const panels = { log: "p-log", scan: "p-scan", fam: "p-fam" };
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      const k = t.getAttribute("data-tab");
      Object.keys(panels).forEach((n) => {
        $(panels[n]).hidden = n !== k;
        $("t-" + n).setAttribute("aria-selected", String(n === k));
      });
      if (k === "scan") setTimeout(() => $("scanIn").focus(), 0);
    });
  });

  /* ---------- ข้อมูลแบบเรียลไทม์ ---------- */
  function start() {
    stop();
    const bad = () => toast("อ่านข้อมูลไม่ได้ ตรวจ Rules ใน Firebase และบัญชีเจ้าหน้าที่", "bad");
    unsubs = [
      onValue(ref(db, "families"), (s) => { A.fams = s.val() || {}; renderStats(); renderFam(); renderLog(); }, bad),
      onValue(ref(db, "qr"), (s) => { A.qrs = s.val() || {}; renderFam(); }, bad),
      onValue(query(ref(db, "logs"), limitToLast(300)), (s) => {
        const o = s.val() || {};
        A.logs = Object.entries(o).map(([id, v]) => ({ id, ...v }));
        renderStats();
        renderLog();
      }, bad),
    ];
  }
  function stop() {
    unsubs.forEach((f) => f());
    unsubs = [];
    A.fams = {};
    A.qrs = {};
    A.logs = [];
  }

  const qrOf = (id) => (A.qrs[id] && A.qrs[id].code) || "";
  const pill = (action) => h("span", { class: "pill " + (action === "ส่ง" ? "in" : "out"), text: action === "ส่ง" ? "ส่งเด็ก" : "รับเด็ก" });

  function renderStats() {
    const today = dayKey(now());
    const latest = {};
    let drop = 0;
    let pick = 0;
    A.logs.forEach((l) => {
      if (dayKey(l.ts) !== today) return;
      if (l.action === "ส่ง") drop++; else pick++;
      if (!latest[l.fid] || latest[l.fid].ts < l.ts) latest[l.fid] = l;
    });
    $("st-in").textContent = Object.values(latest).filter((l) => l.action === "ส่ง").length;
    $("st-drop").textContent = drop;
    $("st-pick").textContent = pick;
  }

  /* ---------- บันทึกรับ-ส่ง ---------- */
  function renderLog() {
    const d = $("fl-date").value;
    const q = $("fl-q").value.trim().toLowerCase();
    const rows = A.logs.slice().sort((a, b) => b.ts - a.ts).filter((l) => {
      if (d && dayKey(l.ts) !== d) return false;
      if (q && (l.nick + " " + l.first + " " + l.last + " " + l.guardian).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    const body = $("logBody");
    body.replaceChildren();
    if (!rows.length) {
      body.append(h("tr", null, h("td", { colspan: 6, class: "empty", text: A.logs.length ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีบันทึก เมื่อเจ้าหน้าที่สแกน QR ของผู้ปกครอง รายการจะขึ้นที่นี่ทันที" })));
      return;
    }
    rows.forEach((l) => {
      body.append(h("tr", { class: "click", tabindex: "0", onclick: () => openDetail(l), onkeydown: (e) => { if (e.key === "Enter") openDetail(l); } },
        h("td", { text: fmtDate(l.ts) }),
        h("td", { class: "num", text: fmtTime(l.ts) }),
        h("td", null, pill(l.action)),
        h("td", null, h("div", { class: "cell" }, h("img", { class: "av sm", src: l.childThumb, alt: "" }), h("div", { style: "min-width:0" }, h("div", { style: "font-weight:700", text: "น้อง" + l.nick }), h("div", { class: "sub", text: l.first + " " + l.last })))),
        h("td", null, h("div", { class: "cell" }, h("img", { class: "av sm", src: l.selfieThumb, alt: "" }), h("span", { text: l.guardian }))),
        h("td", { class: "num", text: l.phone })));
    });
  }
  $("fl-date").addEventListener("input", renderLog);
  $("fl-q").addEventListener("input", renderLog);
  $("fl-clear").addEventListener("click", () => { $("fl-date").value = ""; $("fl-q").value = ""; renderLog(); });

  /* ---------- กล่องรายละเอียด ---------- */
  function openSheet(nodes) { const s = $("sheet"); s.replaceChildren(...nodes); $("overlay").hidden = false; }
  function closeSheet() { $("overlay").hidden = true; }
  $("overlay").addEventListener("click", (e) => { if (e.target === $("overlay")) closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("overlay").hidden) closeSheet(); });
  const closeBtn = () => h("button", { class: "btn ghost", type: "button", onclick: closeSheet, text: "ปิด" });

  async function openDetail(l) {
    const selfie = h("img", { src: l.selfieThumb, alt: "รูปหน้าที่สแกน" });
    const regParent = h("img", { alt: "รูปผู้ปกครองตอนลงทะเบียน" });
    const regChild = h("img", { alt: "รูปเด็กตอนลงทะเบียน" });
    openSheet([
      h("div", { class: "bar" }, h("h3", { text: "น้อง" + l.nick + " · " + (l.action === "ส่ง" ? "ส่งเด็ก" : "รับเด็ก") }), pill(l.action)),
      h("div", { class: "faces" },
        h("figure", null, selfie, h("figcaption", { text: l.desk ? "รูปหน้า (ถ่ายที่เคาน์เตอร์)" : "รูปหน้าตอนมาถึง" })),
        h("figure", null, regParent, h("figcaption", { text: "รูปผู้ปกครองตอนลงทะเบียน" })),
        h("figure", null, regChild, h("figcaption", { text: "รูปเด็กตอนลงทะเบียน" }))),
      h("dl", { class: "kv" },
        h("dt", { text: "วันที่" }), h("dd", { text: fmtDate(l.ts) }),
        h("dt", { text: "เวลา" }), h("dd", { class: "num", text: fmtTime(l.ts) }),
        h("dt", { text: "เด็ก" }), h("dd", { text: l.first + " " + l.last + " (ชื่อเล่น " + l.nick + ")" }),
        h("dt", { text: "ผู้ปกครอง" }), h("dd", { text: l.guardian }),
        h("dt", { text: "เบอร์โทร" }), h("dd", { class: "num", text: l.phone }),
        h("dt", { text: "รหัส QR" }), h("dd", { class: "num", text: l.code || "" }),
        h("dt", { text: "สแกนหน้าเมื่อ" }), h("dd", { class: "num", text: l.arrivalTs ? fmtDate(l.arrivalTs) + " " + fmtTime(l.arrivalTs) : "-" })),
      closeBtn(),
    ]);
    try {
      const [lp, ph] = await Promise.all([get(ref(db, "logPhotos/" + l.id)), get(ref(db, "photos/" + l.fid))]);
      if (lp.exists()) selfie.src = lp.val().selfie;
      if (ph.exists()) { regParent.src = ph.val().parent || ""; regChild.src = ph.val().child || ""; }
    } catch (e) { /* รูปเต็มโหลดไม่ได้ ยังเห็นรูปย่อ */ }
  }

  /* ---------- สแกน QR ---------- */
  async function lookup(codeRaw) {
    const code = String(codeRaw).trim().toUpperCase();
    const box = $("scanResult");
    if (!code) return;
    box.hidden = false;
    box.replaceChildren();
    const hit = Object.entries(A.qrs).find(([, q]) => String(q.code).toUpperCase() === code);
    if (!hit) { box.append(h("div", { class: "err", text: "ไม่พบรหัส " + code + " ในระบบ" })); return; }
    const id = hit[0];
    const fam = A.fams[id];
    if (!fam) { box.append(h("div", { class: "err", text: "พบรหัสแล้วแต่ยังไม่พบข้อมูลครอบครัว" })); return; }
    try {
      const [arrSnap, phSnap] = await Promise.all([get(ref(db, "arrivals/" + id)), get(ref(db, "photos/" + id))]);
      const arr = arrSnap.exists() ? arrSnap.val() : null;
      const regPhoto = phSnap.exists() ? phSnap.val().parent : "";
      const today = dayKey(now());
      const latest = A.logs.filter((l) => l.fid === id && dayKey(l.ts) === today).sort((a, b) => b.ts - a.ts)[0];
      const inside = !!latest && latest.action === "ส่ง";
      const fresh = !!arr && !arr.usedAt && now() - arr.ts <= MAX_FACE_AGE;
      let msg = null;
      if (!arr) msg = "ผู้ปกครองยังไม่ได้สแกนหน้า";
      else if (arr.usedAt) msg = "รูปสแกนหน้านี้ใช้บันทึกไปแล้ว ให้ผู้ปกครองสแกนหน้าใหม่";
      else if (!fresh) msg = "รูปสแกนหน้าเก่าเกิน 10 นาที ให้ผู้ปกครองสแกนหน้าใหม่";

      const save = async (action, btns) => {
        btns.forEach((b) => { b.disabled = true; });
        try {
          const key = push(ref(db, "logs")).key;
          const up = {};
          up["logs/" + key] = {
            ts: serverTimestamp(), fid: id, action,
            nick: fam.nick, first: fam.first, last: fam.last, guardian: fam.guardian, phone: fam.phone,
            childThumb: fam.childThumb, selfieThumb: await thumb(arr.photo, 80, 0.6),
            arrivalTs: arr.ts, code, desk: !!arr.desk,
          };
          up["logPhotos/" + key] = { selfie: arr.photo };
          up["arrivals/" + id + "/usedAt"] = serverTimestamp();
          await update(ref(db), up);
          toast("บันทึก" + (action === "ส่ง" ? "ส่งเด็ก" : "รับเด็ก") + " น้อง" + fam.nick + " เวลา " + fmtTime(now()));
          box.hidden = true;
          box.replaceChildren();
          $("scanIn").value = "";
          $("scanIn").focus();
        } catch (e) {
          toast(errMsg(e), "bad");
          btns.forEach((b) => { b.disabled = false; });
        }
      };

      const btnIn = h("button", { class: "btn in", type: "button", disabled: !fresh, text: "ส่งเด็ก" + (!inside && fresh ? " (แนะนำ)" : "") });
      const btnOut = h("button", { class: "btn out", type: "button", disabled: !fresh, text: "รับเด็ก" + (inside && fresh ? " (แนะนำ)" : "") });
      btnIn.addEventListener("click", () => save("ส่ง", [btnIn, btnOut]));
      btnOut.addEventListener("click", () => save("รับ", [btnIn, btnOut]));

      const deskInput = h("input", { type: "file", accept: "image/*", capture: "user", id: "deskPhoto" });
      deskInput.addEventListener("change", async () => {
        const f = deskInput.files && deskInput.files[0];
        if (!f) return;
        try {
          const photo = await readFile(f, 320, 0.65);
          await update(ref(db), { ["arrivals/" + id]: { ts: serverTimestamp(), photo, desk: true } });
          lookup(code);
        } catch (e) { toast(errMsg(e), "bad"); }
      });

      box.replaceChildren(
        h("div", { class: "who" }, h("img", { class: "av lg", src: fam.childThumb, alt: "" }), h("div", { style: "min-width:0" },
          h("div", { style: "font-family:var(--font-display);font-size:20px;font-weight:700", text: "น้อง" + fam.nick }),
          h("div", { text: fam.first + " " + fam.last }),
          h("div", { class: "note", text: "ผู้ปกครอง " + fam.guardian + " · " + fam.phone }),
          h("div", { style: "margin-top:4px" }, h("span", { class: "pill " + (inside ? "in" : "none"), text: inside ? "ตอนนี้อยู่ในโบสถ์" : "ยังไม่ได้ส่งวันนี้" })))),
        h("div", { class: "faces" },
          h("figure", null, h("img", { src: arr ? arr.photo : "", alt: "รูปหน้าที่สแกน" }), h("figcaption", { text: arr ? "รูปหน้าที่สแกนเมื่อ " + fmtTime(arr.ts) + (arr.desk ? " (เคาน์เตอร์)" : "") : "ยังไม่มีรูปสแกนหน้า" })),
          h("figure", null, h("img", { src: regPhoto || "", alt: "รูปผู้ปกครองตอนลงทะเบียน" }), h("figcaption", { text: "รูปผู้ปกครองตอนลงทะเบียน" }))),
        msg ? h("div", { class: "err", text: msg }) : h("p", { class: "note", text: "เทียบใบหน้าสองรูปให้ตรงกันก่อนกดบันทึก" }),
        h("div", { class: "actions" }, btnIn, btnOut),
        fresh ? null : h("label", { class: "filebtn", for: "deskPhoto" }, "ผู้ปกครองสแกนเองไม่ได้ ถ่ายรูปหน้าที่เคาน์เตอร์แทน", deskInput));
    } catch (e) {
      box.replaceChildren(h("div", { class: "err", text: errMsg(e) }));
    }
  }
  $("scanForm").addEventListener("submit", (ev) => { ev.preventDefault(); lookup($("scanIn").value); });

  /* ---------- ครอบครัวและ QR ---------- */
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function randCode() {
    const a = new Uint32Array(6);
    crypto.getRandomValues(a);
    let s = "FK-";
    for (let i = 0; i < 6; i++) s += ALPHA[a[i] % ALPHA.length];
    return s;
  }
  const codeTaken = (code, exceptId) => Object.entries(A.qrs).some(([id, q]) => id !== exceptId && String(q.code).toUpperCase() === code);
  const codeOk = (code) => /^[A-Z0-9-]{4,24}$/.test(code);

  function renderFam() {
    const body = $("famBody");
    if (body.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    body.replaceChildren();
    const rows = Object.entries(A.fams).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
    $("famCount").textContent = rows.length ? "ทั้งหมด " + rows.length + " ครอบครัว" : "";
    if (!rows.length) {
      body.append(h("tr", null, h("td", { colspan: 5, class: "empty", text: "ยังไม่มีผู้ลงทะเบียน กด + เพิ่มคน หรือรอผู้ปกครองลงทะเบียนเอง" })));
      return;
    }
    rows.forEach(([id, f]) => {
      const cur = qrOf(id);
      const inp = h("input", { type: "text", value: cur, placeholder: "ใส่รหัส QR", "aria-label": "รหัส QR ของน้อง" + f.nick, maxlength: "24", autocapitalize: "characters", spellcheck: "false" });
      body.append(h("tr", null,
        h("td", null, h("div", { class: "cell" }, h("img", { class: "av sm", src: f.childThumb, alt: "" }), h("div", { style: "min-width:0" }, h("div", { style: "font-weight:700", text: "น้อง" + f.nick }), h("div", { class: "sub", text: f.first + " " + f.last })))),
        h("td", { text: f.guardian }),
        h("td", { class: "num", text: f.phone }),
        h("td", { text: f.createdAt ? fmtDate(f.createdAt) + " " + fmtTime(f.createdAt) : "-" }),
        h("td", null, h("div", { class: "famcode" }, inp,
          h("button", { class: "btn ghost small", type: "button", text: "สุ่ม", onclick: () => { inp.value = randCode(); } }),
          h("button", { class: "btn small", type: "button", text: "บันทึก", onclick: () => saveCode(id, f, inp) }),
          cur ? h("button", { class: "btn ghost small", type: "button", text: "ดู QR", onclick: () => showQr(f, cur) }) : null,
          h("button", { class: "btn ghost danger small", type: "button", text: "ลบ", onclick: () => confirmDelete(id, f) })))));
    });
  }
  async function saveCode(id, f, inp) {
    const code = inp.value.trim().toUpperCase();
    if (!codeOk(code)) { toast("รหัสใช้ได้เฉพาะ A-Z, 0-9 และขีดกลาง 4-24 ตัว", "bad"); return; }
    if (codeTaken(code, id)) { toast("รหัสนี้ถูกใช้กับครอบครัวอื่นแล้ว", "bad"); return; }
    try {
      await update(ref(db), { ["qr/" + id]: { code, at: serverTimestamp() } });
      toast("บันทึก QR ของน้อง" + f.nick + " แล้ว");
      inp.blur();
      renderFam();
    } catch (e) { toast(errMsg(e), "bad"); }
  }
  function showQr(f, code) {
    const host = h("div", { class: "qrbox" });
    openSheet([h("h3", { text: "QR ของน้อง" + f.nick }), h("div", { style: "display:flex;justify-content:center" }, host), h("div", { class: "mono codebig", style: "text-align:center", text: code }), closeBtn()]);
    drawQr(host, code, 240);
  }

  /* ลบคน: ลบข้อมูลลงทะเบียน รูป QR และรูปสแกน แต่เก็บบันทึกรับ-ส่งไว้ */
  function confirmDelete(id, f) {
    const yes = h("button", { class: "btn danger", type: "button", text: "ลบออกจากระบบ" });
    yes.addEventListener("click", async () => {
      yes.disabled = true;
      try {
        await update(ref(db), { ["families/" + id]: null, ["photos/" + id]: null, ["qr/" + id]: null, ["arrivals/" + id]: null });
        closeSheet();
        toast("ลบน้อง" + f.nick + " แล้ว");
      } catch (e) { toast(errMsg(e), "bad"); yes.disabled = false; }
    });
    openSheet([
      h("h3", { text: "ลบน้อง" + f.nick + " ออกจากระบบ?" }),
      h("p", { text: "จะลบข้อมูลลงทะเบียน รูปถ่าย และ QR ของน้อง" + f.nick + " (" + f.first + " " + f.last + ") ผู้ปกครองต้องลงทะเบียนใหม่หากจะกลับมาใช้ บันทึกรับ-ส่งที่ผ่านมาจะยังอยู่" }),
      h("div", { class: "actions" }, h("button", { class: "btn ghost", type: "button", text: "ยกเลิก", onclick: closeSheet }), yes),
    ]);
  }

  /* เพิ่มคน: เจ้าหน้าที่กรอกข้อมูลให้ผู้ปกครองที่ลงทะเบียนเองไม่ได้ */
  function openAdd() {
    const f = (id, label, attrs) => h("div", { class: "field" }, h("label", { for: id, text: label }), h("input", { id, type: "text", autocomplete: "off", ...attrs }));
    const nick = f("ad-nick", "ชื่อเล่นเด็ก", { maxlength: "40" });
    const first = f("ad-first", "ชื่อจริงเด็ก", { maxlength: "60" });
    const last = f("ad-last", "นามสกุลเด็ก", { maxlength: "60" });
    const phone = f("ad-phone", "เบอร์โทรผู้ปกครอง", { type: "tel", inputmode: "tel", maxlength: "20" });
    const guardian = f("ad-guardian", "ชื่อผู้ปกครอง", { maxlength: "80" });
    const code = f("ad-code", "รหัส QR", { maxlength: "24", autocapitalize: "characters", spellcheck: "false" });
    code.querySelector("input").value = randCode();
    const pChild = h("input", { type: "file", accept: "image/*", id: "ad-pchild" });
    const pParent = h("input", { type: "file", accept: "image/*", id: "ad-pparent" });
    const consent = h("input", { type: "checkbox", id: "ad-consent" });
    const err = h("div", { class: "err", role: "alert", hidden: true });
    const save = h("button", { class: "btn", type: "button", text: "เพิ่มคน" });
    const val = (n) => n.querySelector("input").value.trim();

    save.addEventListener("click", async () => {
      const v = { nick: val(nick), first: val(first), last: val(last), phone: val(phone), guardian: val(guardian) };
      const cd = val(code).toUpperCase();
      const miss = [];
      if (!v.nick) miss.push("ชื่อเล่นเด็ก");
      if (!v.first) miss.push("ชื่อจริงเด็ก");
      if (!v.last) miss.push("นามสกุลเด็ก");
      if (v.phone.replace(/\D/g, "").length < 9) miss.push("เบอร์โทร (อย่างน้อย 9 หลัก)");
      if (!v.guardian) miss.push("ชื่อผู้ปกครอง");
      if (!codeOk(cd)) miss.push("รหัส QR (A-Z, 0-9, ขีดกลาง 4-24 ตัว)");
      else if (codeTaken(cd, null)) miss.push("รหัส QR นี้ถูกใช้แล้ว");
      if (!consent.checked) miss.push("ยืนยันว่าได้รับความยินยอม PDPA แล้ว");
      if (miss.length) { err.textContent = "กรุณาตรวจสอบ: " + miss.join(", "); err.hidden = false; return; }
      err.hidden = true;
      save.disabled = true;
      try {
        const id = push(ref(db, "families")).key;
        const cf = pChild.files && pChild.files[0];
        const pf = pParent.files && pParent.files[0];
        const childFull = cf ? await readFile(cf, 480, 0.7) : "";
        const parentFull = pf ? await readFile(pf, 480, 0.7) : "";
        const childThumb = childFull ? await thumb(childFull, 96, 0.7) : avatarFor(v.nick);
        const up = {};
        up["families/" + id] = { ...v, childThumb, createdAt: serverTimestamp(), pdpa: { accepted: true, by: "staff", at: serverTimestamp(), version: "draft-1" } };
        if (childFull || parentFull) up["photos/" + id] = { child: childFull, parent: parentFull };
        up["qr/" + id] = { code: cd, at: serverTimestamp() };
        await update(ref(db), up);
        closeSheet();
        toast("เพิ่มน้อง" + v.nick + " แล้ว");
      } catch (e) {
        err.textContent = errMsg(e);
        err.hidden = false;
        save.disabled = false;
      }
    });

    openSheet([
      h("h3", { text: "เพิ่มคน" }),
      h("div", { class: "formgrid" }, nick, phone, first, last),
      guardian,
      h("div", { class: "formgrid" },
        h("label", { class: "filebtn", for: "ad-pchild" }, "รูปเด็ก (ไม่บังคับ)", pChild),
        h("label", { class: "filebtn", for: "ad-pparent" }, "รูปผู้ปกครอง (ไม่บังคับ)", pParent)),
      h("div", { class: "famcode" }, code, h("button", { class: "btn ghost small", type: "button", text: "สุ่ม", onclick: () => { code.querySelector("input").value = randCode(); } })),
      h("label", { class: "check", for: "ad-consent" }, consent, h("span", { text: "ได้รับความยินยอม PDPA จากผู้ปกครองเป็นลายลักษณ์อักษรแล้ว" })),
      err,
      h("div", { class: "actions" }, h("button", { class: "btn ghost", type: "button", text: "ยกเลิก", onclick: closeSheet }), save),
    ]);
  }
  $("btnAdd").addEventListener("click", openAdd);

  return { show, hide };
}
