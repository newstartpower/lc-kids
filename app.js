import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚙️ เชื่อมต่อ Firebase Firestore ของโปรเจกต์ liberty-kids-app-11
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

(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
var TZ='Asia/Bangkok';
var ADMIN_PW='12341234';

function h(tag,props){
  var e=document.createElement(tag);
  if(props)for(var k in props){var v=props[k];
    if(k==='class')e.className=v;
    else if(k==='text')e.textContent=v;
    else if(k.indexOf('on')===0)e.addEventListener(k.slice(2),v);
    else if(v===true)e.setAttribute(k,'');
    else if(v!==false&&v!=null)e.setAttribute(k,v);}
  for(var i=2;i<arguments.length;i++){var c=arguments[i];
    (Array.isArray(c)?c:[c]).forEach(function(x){if(x==null||x===false)return;e.append(x.nodeType?x:document.createTextNode(String(x)));});}
  return e;
}
function fmtDate(ts){return new Date(ts).toLocaleDateString('th-TH',{timeZone:TZ,day:'numeric',month:'short',year:'numeric'})}
function fmtTime(ts){return new Date(ts).toLocaleTimeString('th-TH',{timeZone:TZ,hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function dayKey(ts){return new Date(ts).toLocaleDateString('en-CA',{timeZone:TZ})}
var toastTimer;
function toast(msg,kind){var t=$('toast');if(!t)return;t.textContent=msg;t.className='show '+(kind||'');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.className=''},4200);}
function errMsg(e){var c=e&&e.code;
  if(c==='invalid_argument')return 'บันทึกไม่สำเร็จ: บัญชีนี้ไม่มีสิทธิ์เขียนข้อมูลในหน้านี้';
  if(c==='quota_exceeded')return 'พื้นที่เก็บข้อมูลเต็ม แจ้งผู้ดูแลระบบ';
  if(c==='resource_exhausted'||c==='unavailable')return 'ระบบไม่ว่างชั่วคราว ลองใหม่อีกครั้ง';
  return 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง';}

/* ---------- รูปภาพ ---------- */
function loadImg(src){return new Promise(function(res,rej){var i=new Image();i.onload=function(){res(i)};i.onerror=rej;i.src=src;});}
function shrink(img,max,q){var s=Math.min(1,max/Math.max(img.width,img.height));var c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',q);}
function readFile(file,max,q){return new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){loadImg(fr.result).then(function(i){res(shrink(i,max,q))},rej)};fr.onerror=rej;fr.readAsDataURL(file);});}
function thumb(url,max,q){return loadImg(url).then(function(i){return shrink(i,max,q)});}

/* ตรวจว่าเป็นรูปถ่ายสดจากกล้อง */
function hasCameraExif(buf){
  try{
    var v=new DataView(buf);
    if(v.getUint16(0)!==0xFFD8)return false;
    var off=2;
    while(off+4<v.byteLength){
      var marker=v.getUint16(off);
      if(marker===0xFFE1){
        if(v.getUint32(off+4)!==0x45786966)return false;
        var t=off+10,le=v.getUint16(t)===0x4949;
        var ifd=t+v.getUint32(t+4,le),n=v.getUint16(ifd,le);
        for(var i=0;i<n;i++){var tag=v.getUint16(ifd+2+i*12,le);if(tag===0x010F||tag===0x0110)return true;}
        return false;
      }
      if((marker&0xFF00)!==0xFF00)return false;
      off+=2+v.getUint16(off+2);
    }
  }catch(e){}
  return false;
}
function liveCheck(file){
  if(!/^image\/jpe?g$/i.test(file.type))return Promise.resolve('ต้องเป็นรูปที่ถ่ายสดจากกล้อง ไม่รับรูปแคปหน้าจอหรือไฟล์ภาพชนิดอื่น');
  if(file.lastModified&&Date.now()-file.lastModified>120000)return Promise.resolve('รูปนี้ถ่ายไว้นานแล้ว ต้องถ่ายใหม่ตอนนี้จากกล้อง');
  return file.slice(0,131072).arrayBuffer().then(function(b){
    return hasCameraExif(b)?null:'ไม่พบข้อมูลกล้องในรูป อาจเป็นรูปแคปหน้าจอหรือรูปจากแกลเลอรี ต้องถ่ายใหม่จากกล้อง';
  }).catch(function(){return 'อ่านรูปไม่ได้ ลองถ่ายใหม่'});
}

/* ---------- เชื่อมต่อ Firebase Firestore ---------- */
function localUid(){
  try{
    var v=localStorage.getItem('fkc.uid');
    if(!v){
      v='user-'+Math.random().toString(36).slice(2,10);
      localStorage.setItem('fkc.uid',v);
    }
    return v;
  }catch(e){ return 'user-default'; }
}

var uid = localUid();

var store = {
  get: async function(col, id) {
    try {
      const docRef = doc(db, col, id);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch(e) { return null; }
  },
  set: async function(col, id, data) {
    const docRef = doc(db, col, id);
    await setDoc(docRef, data);
  },
  update: async function(col, id, patch) {
    const docRef = doc(db, col, id);
    await updateDoc(docRef, patch);
  },
  add: async function(col, data) {
    const colRef = collection(db, col);
    const res = await addDoc(colRef, data);
    return res.id;
  },
  watch: function(col, cb) {
    const colRef = collection(db, col);
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      cb(list);
    }, (error) => {
      console.warn(col, error);
      cb([]);
    });
  }
};

var sessMem=false;
function getSess(){try{return localStorage.getItem('fkc.sess')==='1'}catch(e){return sessMem}}
function setSess(on){sessMem=on;try{on?localStorage.setItem('fkc.sess','1'):localStorage.removeItem('fkc.sess')}catch(e){}}

/* ---------- หน้าบ้าน ---------- */
var me={fam:null,code:null,arrival:null};
var photos={parent:null,child:null};
var pollTimer=null;
var screens=['cover','login','register','wait','face','pass'];
var passTimer=null;

function go(n){
  screens.forEach(function(s){if($('s-'+s)) $('s-'+s).hidden=s!==n});
  clearInterval(pollTimer);pollTimer=null;
  clearInterval(passTimer);passTimer=null;
  if(n==='wait')pollTimer=setInterval(checkWait,20000);
  window.scrollTo(0,0);
}

if($('modeNote')) $('modeNote').textContent = 'เชื่อมต่อฐานข้อมูล Firebase Firestore เรียบร้อย';

if($('btnStart')) {
  $('btnStart').addEventListener('click',function(){
    var b=$('btnStart'),label=b.textContent;b.disabled=true;b.textContent='กำลังเตรียมระบบ...';
    (getSess()?afterLogin():go('login')).catch(function(){go('login')}).then(function(){b.disabled=false;b.textContent=label});
  });
}

function afterLogin(){
  return store.get('families',uid).then(function(fam){
    if(!fam){go('register');return}
    me.fam=fam;
    return store.get('qr',uid).then(function(q){
      me.code=q&&q.code?q.code:null;
      if(!me.code){renderWait();go('wait');return}
      renderFace();go('face');
    });
  }).catch(function(e){toast(errMsg(e),'bad');go('login')});
}

function checkWait(){
  store.get('qr',uid).then(function(q){
    if(q&&q.code){me.code=q.code;renderFace();go('face');}
    else if(!pollTimer)toast('ยังไม่มี QR Code รอเจ้าหน้าที่สักครู่');
  }).catch(function(){});
}

function renderWait(){if($('wait-text')) $('wait-text').textContent='เจ้าหน้าที่กำลังออก QR Code ให้น้อง'+(me.fam?me.fam.nick:'')+' เมื่อพร้อมแล้วระบบจะให้สแกนหน้าเพื่อเปิดแอป';}
function renderFace(){if($('face-title')) $('face-title').textContent='สแกนหน้าผู้ปกครองของน้อง'+(me.fam?me.fam.nick:'');}
function logout(){setSess(false);me={fam:null,code:null,arrival:null};go('login');}

['btnLogoutW','btnLogoutF','btnLogoutP'].forEach(function(id){if($(id)) $(id).addEventListener('click',logout)});
if($('btnRecheck')) $('btnRecheck').addEventListener('click',checkWait);
if($('btnLine')) {
  $('btnLine').addEventListener('click',function(){
    var b=$('btnLine');b.disabled=true;
    setSess(true);
    afterLogin().then(function(){b.disabled=false}).catch(function(){b.disabled=false});
  });
}

/* ลงทะเบียน */
function validReg(){
  var v={
    nick:$('f-nick')?$('f-nick').value.trim():'',
    first:$('f-first')?$('f-first').value.trim():'',
    last:$('f-last')?$('f-last').value.trim():'',
    phone:$('f-phone')?$('f-phone').value.trim():'',
    guardian:$('f-guardian')?$('f-guardian').value.trim():''
  };
  var miss=[];
  if(!v.nick)miss.push('ชื่อเล่นเด็ก');if(!v.first)miss.push('ชื่อจริงเด็ก');if(!v.last)miss.push('นามสกุลเด็ก');
  if(v.phone.replace(/\D/g,'').length<9)miss.push('เบอร์โทรผู้ปกครอง (อย่างน้อย 9 หลัก)');
  if(!v.guardian)miss.push('ชื่อผู้ปกครอง');
  if(!photos.parent)miss.push('รูปผู้ปกครอง');if(!photos.child)miss.push('รูปเด็ก');
  return {v:v,miss:miss};
}

if($('f-pdpa')) {
  $('f-pdpa').addEventListener('change',function(){if($('f-submit')) $('f-submit').disabled=!$('f-pdpa').checked;});
}

var sigs={parent:null,child:null};
function bindPick(inputId,boxId,key,label){
  if(!$(inputId)) return;
  $(inputId).addEventListener('change',function(){
    var inp=this,f=inp.files&&inp.files[0];if(!f)return;
    var other=key==='parent'?'child':'parent',sig=f.size+':'+f.lastModified;
    liveCheck(f).then(function(why){
      if(why){inp.value='';toast(why,'bad');return}
      if(sigs[other]===sig){inp.value='';toast('รูปผู้ปกครองกับรูปเด็กเป็นรูปเดียวกัน ต้องถ่ายแยกกัน','bad');return}
      return readFile(f,480,0.7).then(function(url){
        photos[key]=url;sigs[key]=sig;var box=$(boxId);if(box){box.classList.add('has');
        box.replaceChildren(h('img',{src:url,alt:label}),h('span',{class:'tag',text:label}),inp);}
      });
    }).catch(function(){inp.value='';toast('เปิดรูปไม่ได้ ลองถ่ายใหม่','bad')});
  });
}
bindPick('ph-parent','pk-parent','parent','ผู้ปกครอง');
bindPick('ph-child','pk-child','child','เด็ก');

if($('regForm')) {
  $('regForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var box=$('f-err');
    if($('f-pdpa') && !$('f-pdpa').checked)return;
    var r=validReg();
    if(r.miss.length){if(box){box.textContent='กรุณากรอกให้ครบ: '+r.miss.join(', ');box.hidden=false;}return}
    if(box) box.hidden=true;
    var btn=$('f-submit');if(btn) btn.disabled=true;
    var now=Date.now();
    thumb(photos.child,96,0.7).then(function(childThumb){
      var fam=Object.assign({},r.v,{childThumb:childThumb,createdAt:now,pdpa:{accepted:true,at:now,version:'draft-1'}});
      return store.set('photos',uid,{parent:photos.parent,child:photos.child}).then(function(){return store.set('families',uid,fam)}).then(function(){
        me.fam=fam;renderWait();go('wait');
      });
    }).catch(function(e){if(box){box.textContent=errMsg(e);box.hidden=false;}}).then(function(){if(btn && $('f-pdpa')) btn.disabled=!$('f-pdpa').checked;});
  });
}

/* สแกนหน้า -> QR */
if($('ph-face')) {
  $('ph-face').addEventListener('change',function(){
    var f=this.files&&this.files[0];if(!f)return;
    var input=this;
    liveCheck(f).then(function(why){
      if(why){toast(why,'bad');return}
      return readFile(f,320,0.65).then(function(photo){
        var rec={ts:Date.now(),photo:photo,usedAt:null};
        return store.set('arrivals',uid,rec).then(function(){me.arrival=rec;renderPass();go('pass');});
      });
    }).catch(function(e){toast(errMsg(e),'bad')}).then(function(){input.value=''});
  });
}

if($('btnRescan')) $('btnRescan').addEventListener('click',function(){renderFace();go('face')});

function drawQr(host,text,size){
  host.replaceChildren();
  if(window.QRCode){try{new window.QRCode(host,{text:text,width:size,height:size,colorDark:'#000000',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});return}catch(e){}}
  host.append(h('div',{class:'mono codebig',style:'color:#000',text:text}));
}
var PASS_TTL=10*60*1000;
function tickPass(){
  if(!me.arrival)return;
  var left=me.arrival.ts+PASS_TTL-Date.now();
  if($('passClock')) $('passClock').textContent=fmtTime(Date.now());
  if(left<=0){
    clearInterval(passTimer);passTimer=null;
    if($('qrHost')){ $('qrHost').replaceChildren();$('qrHost').hidden=true; }
    if($('passCode')) $('passCode').hidden=true;
    if($('passExpired')) $('passExpired').hidden=false;
    if($('passLeft')) $('passLeft').textContent='';
    return;
  }
  var m=Math.floor(left/60000),s=Math.floor(left/1000)%60;
  if($('passLeft')) $('passLeft').textContent='ใช้ได้อีก '+m+':'+(s<10?'0':'')+s;
}
function renderPass(){
  if($('qrHost')) $('qrHost').hidden=false;
  if($('passCode')) $('passCode').hidden=false;
  if($('passExpired')) $('passExpired').hidden=true;
  if($('qrHost')) drawQr($('qrHost'),me.code,220);
  if($('passCode')) $('passCode').textContent=me.code;
  clearInterval(passTimer);tickPass();passTimer=setInterval(tickPass,1000);
  if($('passChild')) $('passChild').src=me.fam.childThumb;
  if($('passName')) $('passName').textContent='น้อง'+me.fam.nick+' · '+me.fam.first+' '+me.fam.last;
  if($('passTime')) $('passTime').textContent='สแกนหน้าเมื่อ '+fmtDate(me.arrival.ts)+' '+fmtTime(me.arrival.ts);
  if($('passSelfie')) $('passSelfie').src=me.arrival.photo;
}

/* ---------- ลดการแคปหน้าจอ ---------- */
function veil(on){document.body.classList.toggle('veiled',on)}
document.addEventListener('visibilitychange',function(){veil(document.hidden)});
window.addEventListener('blur',function(){if($('s-pass') && !$('s-pass').hidden)veil(true)});
['focus','pointerdown','touchstart'].forEach(function(ev){window.addEventListener(ev,function(){if(!document.hidden)veil(false)},{passive:true})});
document.addEventListener('keyup',function(e){
  if(e.key==='PrintScreen'){veil(true);try{navigator.clipboard.writeText('').catch(function(){})}catch(x){}setTimeout(function(){veil(false)},2000);}
});
document.addEventListener('contextmenu',function(e){e.preventDefault()});
document.addEventListener('dragstart',function(e){e.preventDefault()});

/* ---------- หลังบ้าน ---------- */
var adminOn=false,adminStarted=false;
var A={fams:[],qrs:[],logs:[]};

function showAdmin(){
  if($('parentView')) $('parentView').hidden=true;
  if($('adminView')) $('adminView').hidden=false;
  if($('adminGate')) $('adminGate').hidden=adminOn;
  if($('adminApp')) $('adminApp').hidden=!adminOn;
  if(adminOn){startAdmin()}else{if($('adminPw')){ $('adminPw').value='';setTimeout(function(){$('adminPw').focus()},0) }}
}
function showParent(){if($('adminView')) $('adminView').hidden=true; if($('parentView')) $('parentView').hidden=false;}

if($('adminLink')) $('adminLink').addEventListener('click',showAdmin);
if($('btnBackP')) $('btnBackP').addEventListener('click',showParent);
if($('btnBackP2')) $('btnBackP2').addEventListener('click',showParent);
if($('btnLock')) $('btnLock').addEventListener('click',function(){adminOn=false;showAdmin();});

if($('gateForm')) {
  $('gateForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    if($('adminPw') && $('adminPw').value===ADMIN_PW){adminOn=true;if($('gateErr')) $('gateErr').hidden=true;showAdmin();}
    else{if($('gateErr')) $('gateErr').hidden=false;if($('adminPw')) $('adminPw').select();}
  });
}

var panels={log:'p-log',scan:'p-scan',fam:'p-fam'};
Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(t){
  t.addEventListener('click',function(){
    var k=t.getAttribute('data-tab');
    Object.keys(panels).forEach(function(n){if($(panels[n])) $(panels[n]).hidden=n!==k;if($('t-'+n)) $('t-'+n).setAttribute('aria-selected',String(n===k));});
    if(k==='scan')setTimeout(function(){if($('scanIn')) $('scanIn').focus()},0);
  });
});

function startAdmin(){
  if(adminStarted)return;adminStarted=true;
  store.watch('families',function(l){A.fams=l;renderStats();if($('famBody') && !$('famBody').contains(document.activeElement))renderFam();renderLog();});
  store.watch('qr',function(l){A.qrs=l;if($('famBody') && !$('famBody').contains(document.activeElement))renderFam();});
  store.watch('logs',function(l){A.logs=l;renderStats();renderLog();});
}

function famOf(id){return A.fams.filter(function(f){return f.id===id})[0]||null}
function qrOf(id){var q=A.qrs.filter(function(x){return x.id===id})[0];return q?q.code:''}

function renderStats(){
  var today=dayKey(Date.now()),latest={},drop=0,pick=0;
  A.logs.forEach(function(l){
    if(dayKey(l.ts)!==today)return;
    if(l.action==='ส่ง')drop++;else pick++;
    if(!latest[l.uid]||latest[l.uid].ts<l.ts)latest[l.uid]=l;
  });
  var inside=Object.keys(latest).filter(function(k){return latest[k].action==='ส่ง'}).length;
  if($('st-in')) $('st-in').textContent=inside;
  if($('st-drop')) $('st-drop').textContent=drop;
  if($('st-pick')) $('st-pick').textContent=pick;
}

function pill(action){return h('span',{class:'pill '+(action==='ส่ง'?'in':'out'),text:action==='ส่ง'?'ส่งเด็ก':'รับเด็ก'})}

function renderLog(){
  var d=$('fl-date')?$('fl-date').value:'',q=$('fl-q')?$('fl-q').value.trim().toLowerCase():'';
  var rows=A.logs.slice().sort(function(a,b){return b.ts-a.ts}).filter(function(l){
    if(d&&dayKey(l.ts)!==d)return false;
    if(q){var s=(l.nick+' '+l.first+' '+l.last+' '+l.guardian).toLowerCase();if(s.indexOf(q)<0)return false;}
    return true;
  });
  var body=$('logBody');if(!body) return; body.replaceChildren();
  if(!rows.length){body.append(h('tr',null,h('td',{colspan:6,class:'empty',text:A.logs.length?'ไม่พบรายการตามตัวกรอง':'ยังไม่มีบันทึก เมื่อเจ้าหน้าที่สแกน QR ของผู้ปกครอง รายการจะขึ้นที่นี่ทันที'})));return}
  rows.slice(0,300).forEach(function(l){
    var tr=h('tr',{class:'click',tabindex:'0',onclick:function(){openDetail(l)},onkeydown:function(e){if(e.key==='Enter')openDetail(l)}},
      h('td',{text:fmtDate(l.ts)}),
      h('td',{class:'num',text:fmtTime(l.ts)}),
      h('td',null,pill(l.action)),
      h('td',null,h('div',{class:'cell'},h('img',{class:'av sm',src:l.childThumb,alt:''}),h('div',{style:'min-width:0'},h('div',{style:'font-weight:700',text:'น้อง'+l.nick}),h('div',{class:'sub',text:l.first+' '+l.last})))),
      h('td',null,h('div',{class:'cell'},h('img',{class:'av sm',src:l.selfie,alt:''}),h('span',{text:l.guardian}))),
      h('td',{class:'num',text:l.phone}));
    body.append(tr);
  });
  if(rows.length>300)body.append(h('tr',null,h('td',{colspan:6,class:'empty',text:'แสดง 300 รายการล่าสุด ใช้ตัวกรองวันที่เพื่อดูรายการเก่า'})));
}

if($('fl-date')) $('fl-date').addEventListener('input',renderLog);
if($('fl-q')) $('fl-q').addEventListener('input',renderLog);
if($('fl-clear')) $('fl-clear').addEventListener('click',function(){if($('fl-date')) $('fl-date').value='';if($('fl-q')) $('fl-q').value='';renderLog();});

/* กล่องรายละเอียด */
function openSheet(nodes){var s=$('sheet');if(!s) return; s.replaceChildren.apply(s,nodes);if($('overlay')) $('overlay').hidden=false;}
function closeSheet(){if($('overlay')) $('overlay').hidden=true;}
if($('overlay')) $('overlay').addEventListener('click',function(e){if(e.target===$('overlay'))closeSheet()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&$('overlay')&&!$('overlay').hidden)closeSheet()});
function closeBtn(){return h('button',{class:'btn ghost',type:'button',onclick:closeSheet,text:'ปิด'})}

function openDetail(l){
  var regParent=h('img',{alt:'รูปผู้ปกครองตอนลงทะเบียน'}),regChild=h('img',{alt:'รูปเด็กตอนลงทะเบียน'});
  store.get('photos',l.uid).then(function(p){if(p){regParent.src=p.parent;regChild.src=p.child}}).catch(function(){});
  openSheet([
    h('div',{class:'bar'},h('h3',{text:'น้อง'+l.nick+' · '+(l.action==='ส่ง'?'ส่งเด็ก':'รับเด็ก')}),pill(l.action)),
    h('div',{class:'faces'},
      h('figure',null,h('img',{src:l.selfie,alt:'รูปหน้าที่สแกน'}),h('figcaption',{text:'รูปหน้าตอนมาถึง'})),
      h('figure',null,regParent,h('figcaption',{text:'รูปผู้ปกครองตอนลงทะเบียน'})),
      h('figure',null,regChild,h('figcaption',{text:'รูปเด็กตอนลงทะเบียน'}))),
    h('dl',{class:'kv'},
      h('dt',{text:'วันที่'}),h('dd',{text:fmtDate(l.ts)}),
      h('dt',{text:'เวลา'}),h('dd',{class:'num',text:fmtTime(l.ts)}),
      h('dt',{text:'เด็ก'}),h('dd',{text:l.first+' '+l.last+' (ชื่อเล่น '+l.nick+')'}),
      h('dt',{text:'ผู้ปกครอง'}),h('dd',{text:l.guardian}),
      h('dt',{text:'เบอร์โทร'}),h('dd',{class:'num',text:l.phone}),
      h('dt',{text:'รหัส QR'}),h('dd',{class:'num',text:l.code||''}),
      h('dt',{text:'สแกนหน้าเมื่อ'}),h('dd',{class:'num',text:l.arrivalTs?fmtDate(l.arrivalTs)+' '+fmtTime(l.arrivalTs):'-'})),
    closeBtn()
  ]);
}

/* สแกน QR */
var MAX_FACE_AGE=10*60*1000;
if($('scanForm')) {
  $('scanForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var code=$('scanIn')?$('scanIn').value.trim().toUpperCase():'';
    var box=$('scanResult');
    if(!code||!box)return;
    var q=A.qrs.filter(function(x){return String(x.code).toUpperCase()===code})[0];
    box.hidden=false;box.replaceChildren();
    if(!q){box.append(h('div',{class:'err',text:'ไม่พบรหัส '+code+' ในระบบ'}));return}
    var fam=famOf(q.id);
    if(!fam){box.append(h('div',{class:'err',text:'พบรหัสแล้วแต่ยังไม่พบข้อมูลครอบครัว'}));return}
    store.get('arrivals',q.id).then(function(arr){
      var latest=A.logs.filter(function(l){return l.uid===q.id&&dayKey(l.ts)===dayKey(Date.now())}).sort(function(a,b){return b.ts-a.ts})[0];
      var inside=latest&&latest.action==='ส่ง';
      var fresh=arr&&!arr.usedAt&&(Date.now()-arr.ts)<=MAX_FACE_AGE;
      var msg=null;
      if(!arr)msg='ผู้ปกครองยังไม่ได้สแกนหน้า';
      else if(arr.usedAt)msg='รูปสแกนหน้านี้ใช้บันทึกไปแล้ว ให้ผู้ปกครองสแกนหน้าใหม่';
      else if(!fresh)msg='รูปสแกนหน้าเก่าเกิน 10 นาที ให้ผู้ปกครองสแกนหน้าใหม่';
      var regParent=h('img',{alt:'รูปผู้ปกครองตอนลงทะเบียน'});
      store.get('photos',q.id).then(function(p){if(p)regParent.src=p.parent}).catch(function(){});
      var save=function(action){
        var btns=box.querySelectorAll('.actions .btn');Array.prototype.forEach.call(btns,function(b){b.disabled=true});
        var now=Date.now();
        var entry={ts:now,uid:q.id,action:action,nick:fam.nick,first:fam.first,last:fam.last,guardian:fam.guardian,phone:fam.phone,childThumb:fam.childThumb,selfie:arr.photo,arrivalTs:arr.ts,code:code};
        store.add('logs',entry).then(function(){return store.update('arrivals',q.id,{usedAt:now})}).then(function(){
          toast('บันทึก'+(action==='ส่ง'?'ส่งเด็ก':'รับเด็ก')+' น้อง'+fam.nick+' เวลา '+fmtTime(now));
          box.hidden=true;box.replaceChildren();if($('scanIn')) { $('scanIn').value='';$('scanIn').focus(); }
        }).catch(function(e){toast(errMsg(e),'bad');Array.prototype.forEach.call(btns,function(b){b.disabled=false});});
      };
      box.replaceChildren(
        h('div',{class:'who'},h('img',{class:'av lg',src:fam.childThumb,alt:''}),h('div',{style:'min-width:0'},
          h('div',{style:'font-family:var(--font-display);font-size:20px;font-weight:700',text:'น้อง'+fam.nick}),
          h('div',{text:fam.first+' '+fam.last}),
          h('div',{class:'note',text:'ผู้ปกครอง '+fam.guardian+' · '+fam.phone}),
          h('div',{style:'margin-top:4px'},h('span',{class:'pill '+(inside?'in':'none'),text:inside?'ตอนนี้อยู่ในโบสถ์':'ยังไม่ได้ส่งวันนี้'})))),
        h('div',{class:'faces'},
          h('figure',null,arr?h('img',{src:arr.photo,alt:'รูปหน้าที่สแกน'}):h('img',{alt:''}),h('figcaption',{text:arr?'รูปหน้าที่สแกนเมื่อ '+fmtTime(arr.ts):'ยังไม่มีรูปสแกนหน้า'})),
          h('figure',null,regParent,h('figcaption',{text:'รูปผู้ปกครองตอนลงทะเบียน'}))),
        msg?h('div',{class:'err',text:msg}):h('p',{class:'note',text:'เทียบใบหน้าสองรูปให้ตรงกันก่อนกดบันทึก'}),
        h('div',{class:'actions'},
          h('button',{class:'btn in',type:'button',disabled:!fresh,onclick:function(){save('ส่ง')},text:'ส่งเด็ก'+(!inside&&fresh?' (แนะนำ)':'')}),
          h('button',{class:'btn out',type:'button',disabled:!fresh,onclick:function(){save('รับ')},text:'รับเด็ก'+(inside&&fresh?' (แนะนำ)':'')}))
      );
    }).catch(function(e){box.replaceChildren(h('div',{class:'err',text:errMsg(e)}))});
  });
}

/* ครอบครัวและ QR */
var ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randCode(){var s='FK-';var a=new Uint32Array(6);(window.crypto||{getRandomValues:function(x){for(var i=0;i<x.length;i++)x[i]=Math.floor(Math.random()*4e9)}}).getRandomValues(a);for(var i=0;i<6;i++)s+=ALPHA[a[i]%ALPHA.length];return s;}

function renderFam(){
  var body=$('famBody');if(!body) return; body.replaceChildren();
  var rows=A.fams.slice().sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0)});
  if(!rows.length){body.append(h('tr',null,h('td',{colspan:5,class:'empty',text:'ยังไม่มีผู้ลงทะเบียน เมื่อผู้ปกครองลงทะเบียนเสร็จ รายชื่อจะขึ้นที่นี่เพื่อให้ใส่ QR'})));return}
  rows.forEach(function(f){
    var cur=qrOf(f.id);
    var inp=h('input',{type:'text',value:cur,placeholder:'ใส่รหัส QR','aria-label':'รหัส QR ของน้อง'+f.nick,maxlength:'24',autocapitalize:'characters',spellcheck:'false'});
    var tr=h('tr',null,
      h('td',null,h('div',{class:'cell'},h('img',{class:'av sm',src:f.childThumb,alt:''}),h('div',{style:'min-width:0'},h('div',{style:'font-weight:700',text:'น้อง'+f.nick}),h('div',{class:'sub',text:f.first+' '+f.last})))),
      h('td',{text:f.guardian}),
      h('td',{class:'num',text:f.phone}),
      h('td',{text:f.createdAt?fmtDate(f.createdAt)+' '+fmtTime(f.createdAt):'-'}),
      h('td',null,h('div',{class:'famcode'},inp,
        h('button',{class:'btn ghost small',type:'button',text:'สุ่ม',onclick:function(){inp.value=randCode()}}),
        h('button',{class:'btn small',type:'button',text:'บันทึก',onclick:function(){saveCode(f,inp)}}),
        cur?h('button',{class:'btn ghost small',type:'button',text:'ดู QR',onclick:function(){showQr(f,cur)}}):null)));
    body.append(tr);
  });
}

function saveCode(f,inp){
  var code=inp.value.trim().toUpperCase();
  if(!/^[A-Z0-9-]{4,24}$/.test(code)){toast('รหัสใช้ได้เฉพาะ A-Z, 0-9 และขีดกลาง 4-24 ตัว','bad');return}
  var clash=A.qrs.filter(function(q){return String(q.code).toUpperCase()===code&&q.id!==f.id})[0];
  if(clash){toast('รหัสนี้ถูกใช้กับครอบครัวอื่นแล้ว','bad');return}
  store.set('qr',f.id,{code:code,at:Date.now()}).then(function(){toast('บันทึก QR ของน้อง'+f.nick+' แล้ว');inp.blur();renderFam();}).catch(function(e){toast(errMsg(e),'bad')});
}

function showQr(f,code){
  var host=h('div',{class:'qrbox'});
  openSheet([h('h3',{text:'QR ของน้อง'+f.nick}),h('div',{style:'display:flex;justify-content:center'},host),h('div',{class:'mono codebig',style:'text-align:center',text:code}),closeBtn()]);
  drawQr(host,code,240);
}

})();
