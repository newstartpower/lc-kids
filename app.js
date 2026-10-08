// นำเข้าโมดูล Firebase Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚙️ ค่า Config จาก Firebase ของคุณครู
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

// เริ่มต้นใช้งาน Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const studentsRef = collection(db, "students");

// 🌐 ระบบคลังคำศัพท์ 2 ภาษา (i18n)
let currentLang = 'th';

const translations = {
  th: {
    subHeader: "ระบบเช็คชื่อและจัดการข้อมูลเด็ก",
    namePlaceholder: "ชื่อ - นามสกุล เด็ก",
    phonePlaceholder: "เบอร์โทรผู้ปกครอง",
    btnSave: "ลงทะเบียน / บันทึกข้อมูล",
    listHeader: "รายชื่อน้องๆ ในระบบ",
    loading: "กำลังโหลดข้อมูล...",
    noData: "ยังไม่มีข้อมูลเด็ก",
    alertNoName: "กรุณากรอกชื่อเด็กด้วยครับ",
    alertSuccess: "บันทึกข้อมูลเรียบร้อยแล้ว!",
    alertError: "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
    phoneLabel: "โทร:"
  },
  en: {
    subHeader: "Children Check-in & Management System",
    namePlaceholder: "Child's Full Name",
    phonePlaceholder: "Parent's Phone Number",
    btnSave: "Register / Save Data",
    listHeader: "Children List",
    loading: "Loading data...",
    noData: "No children records yet",
    alertNoName: "Please enter child's name",
    alertSuccess: "Registration saved successfully!",
    alertError: "An error occurred while saving",
    phoneLabel: "Tel:"
  }
};

// ฟังก์ชันสำหรับเปลี่ยนภาษาหน้าแอป
function setLanguage(lang) {
  currentLang = lang;
  const t = translations[lang];

  document.getElementById('txtSubHeader').innerText = t.subHeader;
  document.getElementById('studentName').placeholder = t.namePlaceholder;
  document.getElementById('parentPhone').placeholder = t.phonePlaceholder;
  document.getElementById('btnSave').innerText = t.btnSave;
  document.getElementById('txtListHeader').innerText = t.listHeader;

  // เปลี่ยนสถานะปุ่มภาษา
  document.getElementById('btnTH').classList.toggle('active', lang === 'th');
  document.getElementById('btnEN').classList.toggle('active', lang === 'en');
}

// ปุ่มกดสลับภาษา
document.getElementById('btnTH').addEventListener('click', () => setLanguage('th'));
document.getElementById('btnEN').addEventListener('click', () => setLanguage('en'));

// 1. ฟังก์ชันบันทึกข้อมูลเด็กใหม่ลง Firebase
document.getElementById('btnSave').addEventListener('click', async () => {
  const nameInput = document.getElementById('studentName').value.trim();
  const phoneInput = document.getElementById('parentPhone').value.trim();
  const t = translations[currentLang];

  if (!nameInput) {
    alert(t.alertNoName);
    return;
  }

  try {
    await addDoc(studentsRef, {
      name: nameInput,
      parentPhone: phoneInput,
      createdAt: new Date()
    });
    alert(t.alertSuccess);
    document.getElementById('studentName').value = '';
    document.getElementById('parentPhone').value = '';
  } catch (error) {
    console.error("Error adding document: ", error);
    alert(t.alertError);
  }
});

// 2. ฟังก์ชันดึงและอัปเดตรายชื่อเด็กแบบ Realtime
onSnapshot(studentsRef, (snapshot) => {
  const listContainer = document.getElementById('studentList');
  listContainer.innerHTML = '';
  const t = translations[currentLang];

  if (snapshot.empty) {
    listContainer.innerHTML = `<p style="text-align:center; color:#888;">${t.noData}</p>`;
    return;
  }

  snapshot.forEach((doc) => {
    const data = doc.data();
    const item = document.createElement('div');
    item.className = 'student-item';
    item.innerHTML = `<strong>${data.name}</strong> <br><small>${t.phoneLabel} ${data.parentPhone || '-'}</small>`;
    listContainer.appendChild(item);
  });
});
