// ค่าจาก Firebase Console > Project settings > Your apps > SDK setup and configuration > Config
// แทนที่ข้อความ PASTE_... ด้วยค่าจริง (ในภาพหน้าจอ apiKey และ databaseURL ถูกตัดไม่ครบ)
export const firebaseConfig = {
  apiKey: "AIzaSyB2ghgguwvbX4FN6isuFDXp2KdCiYT6QYs",
  authDomain: "liberty-kids-app-11.firebaseapp.com",
  databaseURL: "https://liberty-kids-app-11-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "liberty-kids-app-11",
  storageBucket: "liberty-kids-app-11.firebasestorage.app",
  messagingSenderId: "837727299448",
  appId: "1:837727299448:web:ded1e352c53dceb756ca8d",
  measurementId: "G-TBLJ7JCY3Y",
};

// อีเมลของบัญชีเจ้าหน้าที่ (สร้างใน Authentication > Users ด้วยรหัสผ่าน 12341234)
// ต้องตรงกับอีเมลในกฎของ Realtime Database
export const ADMIN_EMAIL = "admin@libertykids.app";
