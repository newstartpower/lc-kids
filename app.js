import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚙️ Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB2ghgguwvbX4FN6isuFDXp2K",
  authDomain: "liberty-kids-app-11.firebaseapp.com",
  databaseURL: "https://liberty-kids-app-11-default-rtdb.firebaseio.com",
  projectId: "liberty-kids-app-11",
  storageBucket: "liberty-kids-app-11.appspot.com",
  messagingSenderId: "837727299448",
  appId: "1:837727299448:web:ded1e352c53dceb756ca8d",
  measurementId: "G-TBLJ7JCY3Y"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const studentsRef = collection(db, "students");

// 🌐 i18n ระบบ 2 ภาษา
let currentLang = 'th';
const translations = {
  th: {
    subHeader: "ระบบเช็คชื่อและจัดการข้อมูลเด็ก",
    childName: "ชื่อ - นามสกุล เด็ก",
    parentPhone: "เบอร์โทรผู้ปกครอง",
    classRoom: "ห้องเรียน / กลุ่มอายุ",
    camera: "📷 ถ่ายรูปเด็ก / สแกนใบหน้า",
    btnSave: "ลงทะเบียนเด็กใหม่",
    roleParent: "👨‍👩‍👧 ผู้ปกครอง",
    roleAdmin: "👨‍🏫 แอดมิน/ครู",
    statusIn: "อยู่ในห้องเรียน",
    statusOut: "รับกลับแล้ว",
    btnCheckIn: "เช็คอินเข้าห้อง",
    btnCheckOut: "รับเด็กกลับ",
    btnDelete: "ลบ",
    alertFill: "กรุณากรอกชื่อและเบอร์โทรให้ครบถ้วน"
  },
  en: {
    subHeader: "Children Check-in & Management System",
    childName: "Child's Full Name",
    parentPhone: "Parent's Phone",
    classRoom: "Classroom / Age Group",
    camera: "📷 Child Photo / Face Capture",
    btnSave: "Register New Child",
    roleParent: "👨‍👩‍👧 Parent",
    roleAdmin: "👨‍🏫 Teacher/Admin",
    statusIn: "In Class",
    statusOut: "Checked Out",
    btnCheckIn: "Check-In",
    btnCheckOut: "Check-Out",
    btnDelete: "Delete",
    alertFill: "Please fill in all required fields"
  }
};

function setLanguage(lang) {
  currentLang = lang;
  const t = translations[lang];
  document.getElementById('txtSubHeader').innerText = t.subHeader;
  document.getElementById('lblChildName').innerText = t.childName;
  document.getElementById('lblParentPhone').innerText = t.parentPhone;
  document.getElementById('lblClassRoom').innerText = t.classRoom;
  document.getElementById('lblCamera').innerText = t.camera;
  document.getElementById('btnSave').innerText = t.btnSave;
  document.getElementById('btnRoleParent').innerText = t.roleParent;
  document.getElementById('btnRoleAdmin').innerText = t.roleAdmin;
  
  document.getElementById('btnTH').classList.toggle('active', lang === 'th');
  document.getElementById('btnEN').classList.toggle('active', lang === 'en');
  renderList(cachedData);
}

document.getElementById('btnTH').addEventListener('click', () => setLanguage('th'));
document.getElementById('btnEN').addEventListener('click', () => setLanguage('en'));

// 🔄 สลับบทบาท ผู้ปกครอง <-> แอดมิน
document.getElementById('btnRoleParent').addEventListener('click', () => {
  document.getElementById('pageParent').classList.add('active');
  document.getElementById('pageAdmin').classList.remove('active');
  document.getElementById('btnRoleParent').classList.add('active');
  document.getElementById('btnRoleAdmin').classList.remove('active');
});

document.getElementById('btnRoleAdmin').addEventListener('click', () => {
  document.getElementById('pageAdmin').classList.add('active');
  document.getElementById('pageParent').classList.remove('active');
  document.getElementById('btnRoleAdmin').classList.add('active');
  document.getElementById('btnRoleParent').classList.remove('active');
});

// 📷 ระบบเปิดกล้องและถ่ายรูป
let photoBase64 = "";
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photoPreview');

document.getElementById('btnStartCam').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.style.display = 'block';
    photoPreview.style.display = 'none';
    document.getElementById('btnStartCam').style.display = 'none';
    document.getElementById('btnCapture').style.display = 'inline-block';
  } catch (err) {
    alert("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์ใช้งานกล้อง");
  }
});

document.getElementById('btnCapture').addEventListener('click', () => {
  canvas.width = video.videoWidth || 300;
  canvas.height = video.videoHeight || 225;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  photoBase64 = canvas.toDataURL('image/jpeg', 0.6);
  
  photoPreview.src = photoBase64;
  photoPreview.style.display = 'block';
  video.style.display = 'none';
  
  // ปิดสตรีมกล้อง
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach(track => track.stop());
  
  document.getElementById('btnCapture').style.display = 'none';
  document.getElementById('btnStartCam').style.display = 'inline-block';
});

// 💾 บันทึกข้อมูลเด็กใหม่
document.getElementById('btnSave').addEventListener('click', async () => {
  const name = document.getElementById('studentName').value.trim();
  const phone = document.getElementById('parentPhone').value.trim();
  const room = document.getElementById('classRoom').value;
  const t = translations[currentLang];

  if (!name || !phone) {
    alert(t.alertFill);
    return;
  }

  try {
    await addDoc(studentsRef, {
      name,
      parentPhone: phone,
      classRoom: room,
      photo: photoBase64 || "https://via.placeholder.com/150?text=No+Photo",
      status: "IN", // IN = อยู่ในห้องเรียน, OUT = รับกลับแล้ว
      checkInTime: new Date().toLocaleString(),
      checkOutTime: "-"
    });

    alert("บันทึกข้อมูลเรียบร้อยแล้ว!");
    document.getElementById('studentName').value = '';
    document.getElementById('parentPhone').value = '';
    photoPreview.src = "https://via.placeholder.com/150?text=No+Photo";
    photoBase64 = "";
  } catch (err) {
    console.error("Error saving student:", err);
    alert("เกิดข้อผิดพลาดในการบันทึก");
  }
});

// 📊 ดึงข้อมูลแบบ Realtime & แสดงผลสำหรับแอดมิน
let cachedData = [];
onSnapshot(studentsRef, (snapshot) => {
  cachedData = [];
  snapshot.forEach(docSnap => {
    cachedData.push({ id: docSnap.id, ...docSnap.data() });
  });
  renderList(cachedData);
});

function renderList(data) {
  const listContainer = document.getElementById('studentList');
  const search = document.getElementById('searchBox').value.toLowerCase();
  const t = translations[currentLang];
  
  listContainer.innerHTML = '';
  let inCount = 0;

  const filtered = data.filter(s => s.name.toLowerCase().includes(search) || (s.parentPhone && s.parentPhone.includes(search)));

  filtered.forEach(student => {
    if (student.status === 'IN') inCount++;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${student.photo}" alt="Child">
      <div class="card-info">
        <h4>${student.name} <span class="badge ${student.status === 'IN' ? 'badge-in' : 'badge-out'}">${student.status === 'IN' ? t.statusIn : t.statusOut}</span></h4>
        <p>🏫 ห้อง: ${student.classRoom || '-'}</p>
        <p>📞 โทร: ${student.parentPhone}</p>
        <p style="font-size:10px; color:#888;">เข้า: ${student.checkInTime || '-'} | ออก: ${student.checkOutTime || '-'}</p>
      </div>
      <div class="action-btns">
        ${student.status === 'IN' 
          ? `<button class="btn-sm btn-out btn-checkout-action" data-id="${student.id}">${t.btnCheckOut}</button>`
          : `<button class="btn-sm btn-in btn-checkin-action" data-id="${student.id}">${t.btnCheckIn}</button>`
        }
        <button class="btn-sm btn-del btn-delete-action" data-id="${student.id}">${t.btnDelete}</button>
      </div>
    `;
    listContainer.appendChild(card);
  });

  document.getElementById('totalCount').innerText = data.length;
  document.getElementById('inClassCount').innerText = inCount;

  // ผูกการทำงานปุ่ม
  document.querySelectorAll('.btn-checkout-action').forEach(btn => {
    btn.addEventListener('click', (e) => updateStatus(e.target.dataset.id, 'OUT'));
  });
  document.querySelectorAll('.btn-checkin-action').forEach(btn => {
    btn.addEventListener('click', (e) => updateStatus(e.target.dataset.id, 'IN'));
  });
  document.querySelectorAll('.btn-delete-action').forEach(btn => {
    btn.addEventListener('click', (e) => deleteStudent(e.target.dataset.id));
  });
}

// อัปเดตสถานะ เช็คอิน / เช็คเอาต์
async function updateStatus(id, status) {
  const docRef = doc(db, "students", id);
  const now = new Date().toLocaleString();
  if (status === 'OUT') {
    await updateDoc(docRef, { status: 'OUT', checkOutTime: now });
  } else {
    await updateDoc(docRef, { status: 'IN', checkInTime: now, checkOutTime: '-' });
  }
}

// ลบข้อมูลเด็ก
async function deleteStudent(id) {
  if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?")) {
    await deleteDoc(doc(db, "students", id));
  }
}

document.getElementById('searchBox').addEventListener('input', () => renderList(cachedData));
