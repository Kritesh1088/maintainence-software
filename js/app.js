// ═══════════════════════════════════════
// FIREBASE INIT
// ═══════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyC9Gxsiq-rRfX1sl9Xt0ydnGrIEfrAQRzs",
  authDomain: "maintanance-software.firebaseapp.com",
  projectId: "maintanance-software",
  storageBucket: "maintanance-software.firebasestorage.app",
  messagingSenderId: "79767445312",
  appId: "1:79767445312:web:7f37b6e2acd95120cce4a5",
  measurementId: "G-MPVEH2912V"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(err){
  console.warn("Persistence set failed:", err);
});

const FIREBASE_API_KEY = firebaseConfig.apiKey;

// ═══════════════════════════════════════
// SAFE localStorage
// ═══════════════════════════════════════
function safeGet(k,fb){try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb}catch(e){return fb}}
function safeSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){showToast("⚠️ Storage full!","warn")}}

// ═══════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════
let currentUser = null;
let firestoreUsers = [];
let rooms = safeGet("rooms", []);
let bin = safeGet("bin", []);
let myChart = null;
let activeCatFilter = "all";
let activeReportFilter = "all";
let editTarget = null;
let editingUserId = null;
let isDemoMode = false;
let notifications = safeGet("ha_notifs", []);
let activityLogs = safeGet("ha_logs", []);
let activeLogFilter = "all";

function isAdmin() { return currentUser && currentUser.role === "admin" }
function getStaffUsers() { return firestoreUsers.filter(u => u.role === "staff" && u.status !== "inactive") }

// ═══════════════════════════════════════
// LOADING OVERLAY
// ═══════════════════════════════════════
function showLoading(msg){
  document.getElementById("loadingText").textContent = msg || "Loading...";
  document.getElementById("loadingOverlay").style.display = "flex";
}
function hideLoading(){
  document.getElementById("loadingOverlay").style.display = "none";
}

// ═══════════════════════════════════════
// DEMO MODE
// ═══════════════════════════════════════
const DEMO_ROOMS = [
  {number:"101", floor:"Ground Floor", issues:[
    {text:"AC not cooling properly", staff:"Ramesh", assignedUserId:null, type:"Electrical", priority:"High", status:"Pending", date:new Date().toLocaleDateString(), image:null, history:[{status:"Pending",date:new Date().toLocaleDateString(),by:"Demo"}], createdBy:null},
    {text:"Bathroom tap leaking", staff:"Suresh", assignedUserId:null, type:"Plumbing", priority:"Medium", status:"Fixed", date:new Date().toLocaleDateString(), image:null, history:[{status:"Pending",date:new Date().toLocaleDateString(),by:"Demo"},{status:"Fixed",date:new Date().toLocaleDateString(),by:"Demo"}], createdBy:null}
  ]},
  {number:"102", floor:"Ground Floor", issues:[
    {text:"Door lock broken", staff:"-", assignedUserId:null, type:"Civil", priority:"High", status:"Pending", date:new Date().toLocaleDateString(), image:null, history:[{status:"Pending",date:new Date().toLocaleDateString(),by:"Demo"}], createdBy:null}
  ]},
  {number:"201", floor:"First Floor", issues:[
    {text:"Bed frame squeaking", staff:"-", assignedUserId:null, type:"Furniture", priority:"Low", status:"Closed", date:new Date().toLocaleDateString(), image:null, history:[{status:"Pending",date:new Date().toLocaleDateString(),by:"Demo"},{status:"Closed",date:new Date().toLocaleDateString(),by:"Demo"}], createdBy:null},
    {text:"TV remote missing", staff:"-", assignedUserId:null, type:"Missing", priority:"Medium", status:"Pending", date:new Date().toLocaleDateString(), image:null, history:[{status:"Pending",date:new Date().toLocaleDateString(),by:"Demo"}], createdBy:null}
  ]},
  {number:"202", floor:"First Floor", issues:[
    {text:"Light bulb fused", staff:"Ramesh", assignedUserId:null, type:"Electrical", priority:"Low", status:"Fixed", date:new Date().toLocaleDateString(), image:null, history:[{status:"Pending",date:new Date().toLocaleDateString(),by:"Demo"},{status:"Fixed",date:new Date().toLocaleDateString(),by:"Demo"}], createdBy:null}
  ]}
];

function doDemoLogin(){
  isDemoMode = true;
  currentUser = {uid:"demo", name:"Demo User", email:"demo@hotelarya.com", role:"staff", status:"active"};
  rooms = JSON.parse(JSON.stringify(DEMO_ROOMS));
  firestoreUsers = [{uid:"demo", name:"Demo User", email:"demo@hotelarya.com", role:"staff", status:"active"}];
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("mainApp").style.display = "block";
  document.body.classList.add("demo-active");
  initDark();
  updateUserUI();
  applyRolePermissions();
  populateStaffFilter();
  render();
  addLog("login", "Demo login", "Demo User");
  showToast("🎭 Demo Mode — Read Only");
}

function isDemoBlocked(){
  if(isDemoMode){ showToast("🎭 Demo mode — Read only!", "warn"); return true; }
  return false;
}

// ═══════════════════════════════════════
// FIREBASE LOGIN
// ═══════════════════════════════════════
async function doLogin(){
  const email = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value;
  const errEl = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");
  if(!email || !pass){ errEl.textContent = "Email & password daalo!"; return }
  btn.disabled = true;
  btn.textContent = "⏳ Logging in...";
  errEl.textContent = "";
  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    const uid = cred.user.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    if(!userDoc.exists){
      await auth.signOut();
      errEl.textContent = "❌ Access denied! Contact admin.";
      btn.disabled = false; btn.textContent = "🔐 Login"; return;
    }
    const userData = userDoc.data();
    if(userData.status === "inactive"){
      await auth.signOut();
      errEl.textContent = "❌ Your account is inactive! Contact admin.";
      btn.disabled = false; btn.textContent = "🔐 Login"; return;
    }
    currentUser = {uid:uid, name:userData.name||"User", email:userData.email||email, role:userData.role||"staff", status:userData.status||"active"};
    isDemoMode = false;
    document.body.classList.remove("demo-active");
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainApp").style.display = "block";
    addLog("login", "Logged in", currentUser.name);
    await initApp();
  } catch(err) {
    console.error("Login error:", err);
    let msg = "❌ Login failed!";
    if(err.code === "auth/user-not-found") msg = "❌ User not found!";
    else if(err.code === "auth/wrong-password") msg = "❌ Wrong password!";
    else if(err.code === "auth/invalid-email") msg = "❌ Invalid email!";
    else if(err.code === "auth/too-many-requests") msg = "❌ Too many attempts! Try later.";
    else if(err.code === "auth/invalid-credential") msg = "❌ Wrong email or password!";
    else if(err.code === "auth/network-request-failed") msg = "❌ Network error! Check internet.";
    errEl.textContent = msg;
  }
  btn.disabled = false; btn.textContent = "🔐 Login";
}

let authInitDone = false;
auth.onAuthStateChanged(async function(user){
  if(authInitDone) return;
  authInitDone = true;
  if(user){
    try {
      showLoading("Logging in...");
      const userDoc = await db.collection("users").doc(user.uid).get();
      if(userDoc.exists){
        const userData = userDoc.data();
        if(userData.status === "inactive"){ await auth.signOut(); hideLoading(); return; }
        currentUser = {uid:user.uid, name:userData.name||"User", email:userData.email||user.email, role:userData.role||"staff", status:userData.status||"active"};
        isDemoMode = false;
        document.body.classList.remove("demo-active");
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("mainApp").style.display = "block";
        await initApp();
      } else { await auth.signOut(); }
      hideLoading();
    } catch(e) { console.error("Auto-login error:", e); hideLoading(); }
  }
});

async function doLogout(){
  if(!isDemoMode){ try { await auth.signOut(); } catch(e){} }
  addLog("login", "Logged out", currentUser ? currentUser.name : "User");
  currentUser = null; firestoreUsers = []; isDemoMode = false;
  document.body.classList.remove("demo-active");
  document.getElementById("mainApp").style.display = "none";
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
  document.getElementById("loginError").textContent = "";
  document.getElementById("menu").style.left = "-290px";
  document.getElementById("overlay").style.display = "none";
}

// ═══════════════════════════════════════
// INIT APP
// ═══════════════════════════════════════
async function initApp(){
  rooms = safeGet("rooms", []);
  bin = safeGet("bin", []);
  rooms.forEach(r => r.issues.forEach(i => {
    if(!i.history) i.history = [{status:i.status||"Pending", date:i.date||new Date().toLocaleDateString()}];
    if(!i.assignedUserId) i.assignedUserId = null;
    if(!i.createdBy) i.createdBy = null;
  }));
  safeSet("rooms", rooms);
  initDark(); purgeBin(); updateBinBadge(); updateUserUI(); applyRolePermissions();
  await loadRoomsFromFirestore();
  await loadUsersFromFirestore();
  await loadActivityLogsFromFirestore();
  populateStaffFilter(); render();
  // Check first-time tour
  if(!safeGet("ha_tour_done", false)){ setTimeout(startTour, 800); }
}

// ═══════════════════════════════════════
// FIRESTORE: ROOMS
// ═══════════════════════════════════════
async function loadRoomsFromFirestore(){
  try {
    const snap = await db.collection("rooms").get();
    if(!snap.empty){
      const firestoreRooms = [];
      snap.forEach(doc => { firestoreRooms.push(doc.data()); });
      if(firestoreRooms.length > 0){ rooms = firestoreRooms; safeSet("rooms", rooms); }
    }
  } catch(e){ console.warn("Firestore rooms load failed, using localStorage:", e); }
}

async function saveRoomsToFirestore(){
  if(isDemoMode) return;
  try {
    const batch = db.batch();
    const existingSnap = await db.collection("rooms").get();
    existingSnap.forEach(doc => batch.delete(doc.ref));
    rooms.forEach(r => {
      const docRef = db.collection("rooms").doc("room_" + r.number);
      const cleanRoom = JSON.parse(JSON.stringify(r));
      cleanRoom.issues.forEach(i => { if(i.image) i.image = "__LOCAL__" });
      batch.set(docRef, cleanRoom);
    });
    await batch.commit();
  } catch(e){ console.warn("Firestore save failed:", e); }
}

async function saveBinToFirestore(){
  if(isDemoMode) return;
  try {
    const cleanBin = bin.map(item => {
      const c = JSON.parse(JSON.stringify(item));
      if(c.type === "issue" && c.data && c.data.image) c.data.image = "__LOCAL__";
      if(c.type === "room" && c.data && c.data.issues){ c.data.issues.forEach(i => { if(i.image) i.image = "__LOCAL__" }); }
      return c;
    });
    await db.collection("appData").doc("bin").set({items: cleanBin});
  } catch(e){ console.warn("Bin Firestore save failed:", e); }
}

async function loadBinFromFirestore(){
  try {
    const doc = await db.collection("appData").doc("bin").get();
    if(doc.exists && doc.data().items){ bin = doc.data().items; safeSet("bin", bin); }
  } catch(e){ console.warn("Bin Firestore load failed:", e); }
}

// ═══════════════════════════════════════
// FIRESTORE: USERS
// ═══════════════════════════════════════
async function loadUsersFromFirestore(){
  try {
    const snap = await db.collection("users").get();
    firestoreUsers = [];
    snap.forEach(doc => { firestoreUsers.push({uid: doc.id, ...doc.data()}); });
  } catch(e){ console.warn("Users load failed:", e); firestoreUsers = []; }
}

function updateUserUI(){
  if(!currentUser) return;
  const badge = document.getElementById("headerUserBadge");
  const roleCls = currentUser.role === "admin" ? "role-admin" : "role-staff";
  badge.innerHTML = `<span class="role-tag ${roleCls}">${escH(currentUser.role)}</span>${escH(currentUser.name)}`;
  const mi = document.getElementById("menuUserInfo");
  const avCls = currentUser.role === "admin" ? "mu-avatar-admin" : "mu-avatar-staff";
  mi.innerHTML = `<div class="mu-avatar ${avCls}">${escH(currentUser.name.charAt(0).toUpperCase())}</div>
    <div class="menu-user-detail"><div class="menu-user-name">${escH(currentUser.name)}</div><div class="menu-user-role">${escH(currentUser.role)} • ${escH(currentUser.email)}</div></div>`;
}

function applyRolePermissions(){
  const adminEls = document.querySelectorAll(".admin-only, .admin-only-label");
  adminEls.forEach(el => { el.style.display = isAdmin() ? "" : "none" });
}

function populateStaffFilter(){
  const sel = document.getElementById("filterAssigned");
  const val = sel.value;
  sel.innerHTML = '<option value="">All Staff</option>';
  firestoreUsers.forEach(u => {
    const opt = document.createElement("option");
    opt.value = "uid:" + u.uid;
    opt.textContent = u.name;
    sel.appendChild(opt);
  });
  sel.value = val;
}

// ═══════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════
function addNotification(icon, msg){
  const notif = {icon:icon, msg:msg, time:Date.now(), read:false, id:Date.now()+"_"+Math.random()};
  notifications.unshift(notif);
  if(notifications.length > 50) notifications = notifications.slice(0,50);
  safeSet("ha_notifs", notifications);
  renderNotifBadge();
  // Save to Firestore if logged in
  if(!isDemoMode && currentUser){
    db.collection("notifications").add({...notif, userId: currentUser.uid}).catch(()=>{});
  }
}

function renderNotifBadge(){
  const unread = notifications.filter(n => !n.read).length;
  const badge = document.getElementById("notifBadge");
  badge.textContent = unread > 99 ? "99+" : unread;
  badge.style.display = unread > 0 ? "flex" : "none";
}

function toggleNotifPanel(){
  const panel = document.getElementById("notifPanel");
  panel.classList.toggle("open");
  if(panel.classList.contains("open")){ renderNotifList(); markAllRead(); }
}

function renderNotifList(){
  const list = document.getElementById("notifList");
  if(notifications.length === 0){ list.innerHTML = '<div class="notif-empty">No notifications yet 🔕</div>'; return; }
  list.innerHTML = notifications.slice(0,20).map(n => {
    const t = formatTimeAgo(n.time);
    return `<div class="notif-item ${n.read?'':'unread'}">
      <div>${escH(n.icon)} ${escH(n.msg)}</div>
      <div class="notif-time">${t}</div>
    </div>`;
  }).join("");
}

function markAllRead(){
  notifications.forEach(n => n.read = true);
  safeSet("ha_notifs", notifications);
  renderNotifBadge();
}

function clearNotifications(){
  notifications = [];
  safeSet("ha_notifs", notifications);
  renderNotifBadge();
  renderNotifList();
}

function formatTimeAgo(ts){
  const diff = Date.now() - ts;
  const m = Math.floor(diff/60000);
  if(m < 1) return "Just now";
  if(m < 60) return m + "m ago";
  const h = Math.floor(m/60);
  if(h < 24) return h + "h ago";
  return Math.floor(h/24) + "d ago";
}

// Close notif panel on outside click
document.addEventListener("click", function(e){
  const panel = document.getElementById("notifPanel");
  const btn = document.getElementById("notifBtn");
  if(panel && panel.classList.contains("open") && !panel.contains(e.target) && !btn.contains(e.target)){
    panel.classList.remove("open");
  }
});

// ═══════════════════════════════════════
// ACTIVITY LOGS
// ═══════════════════════════════════════
function addLog(type, action, userName, target){
  const log = {
    type: type,
    action: action,
    userName: userName || (currentUser ? currentUser.name : "Unknown"),
    target: target || "",
    timestamp: Date.now()
  };
  activityLogs.unshift(log);
  if(activityLogs.length > 200) activityLogs = activityLogs.slice(0,200);
  safeSet("ha_logs", activityLogs);
  if(!isDemoMode && currentUser){
    db.collection("activity_logs").add({...log, userId: currentUser ? currentUser.uid : null}).catch(()=>{});
  }
}

async function loadActivityLogsFromFirestore(){
  if(isDemoMode) return;
  try {
    const snap = await db.collection("activity_logs").orderBy("timestamp","desc").limit(100).get();
    if(!snap.empty){
      const logs = [];
      snap.forEach(doc => logs.push(doc.data()));
      activityLogs = logs;
      safeSet("ha_logs", activityLogs);
    }
  } catch(e){ console.warn("Activity logs load failed:", e); }
}

function openActivityLogs(){
  if(!isAdmin()) return showToast("Admin only!", "warn");
  renderActivityLogs();
  document.getElementById("activityModal").classList.add("open");
}
function closeActivityLogs(){ document.getElementById("activityModal").classList.remove("open"); }

function setActivityFilter(f){
  activeLogFilter = f;
  document.querySelectorAll(".act-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.af === f));
  renderActivityLogs();
}

function renderActivityLogs(){
  const container = document.getElementById("activityLogsList");
  let logs = activityLogs;
  if(activeLogFilter !== "all") logs = logs.filter(l => l.type === activeLogFilter);
  if(logs.length === 0){ container.innerHTML = '<div class="log-empty">📭 No logs yet</div>'; return; }
  const icons = {created:"✅", updated:"✏️", deleted:"🗑️", login:"🔐"};
  const colors = {created:"log-create", updated:"log-update", deleted:"log-delete", login:"log-login"};
  container.innerHTML = logs.slice(0,100).map(l => {
    const icon = icons[l.type] || "📌";
    const cls = colors[l.type] || "";
    const t = new Date(l.timestamp).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
    return `<div class="log-item ${cls}">
      <div class="log-desc">${icon} ${escH(l.action)}${l.target?" — "+escH(l.target):""}</div>
      <div class="log-meta">👤 ${escH(l.userName)} &bull; 🕐 ${t}</div>
    </div>`;
  }).join("");
}

// ═══════════════════════════════════════
// ABOUT
// ═══════════════════════════════════════
function openAbout(){ document.getElementById("aboutModal").classList.add("open"); }
function closeAbout(){ document.getElementById("aboutModal").classList.remove("open"); }

// ═══════════════════════════════════════
// APP TOUR
// ═══════════════════════════════════════
const TOUR_STEPS = [
  {title:"Welcome to Hotel Arya! 🏨", desc:"Yeh app hotel ke maintenance tasks manage karne ke liye hai. Quick tour shuru karte hain!", target:null},
  {title:"Dashboard 📊", desc:"Yahan dikha rahe hain — total rooms, issues, pending, fixed, aur aaj ke tasks.", target:".dashboard"},
  {title:"Room Add Karo ➕", desc:"'Add Room' button se naya room register karo, floor ke saath.", target:".topbar .btn-sm"},
  {title:"Issue Add Karo 🛠️", desc:"Kisi room mein issue hai? Add Issues button se ek ya zyada issues ek saath add karo.", target:null},
  {title:"Filter & Search 🔍", desc:"Category pills ya smart search se issues jaldi dhundo. 'High pending' type karo try karo!", target:".cat-filter-bar"},
  {title:"Report View 📋", desc:"📋 button se poora report dekho — floor-wise breakdown, print bhi kar sako.", target:null},
];

let tourStep = 0;

function startTour(){
  if(!document.getElementById("tourOverlay")) return;
  tourStep = 0;
  document.getElementById("tourOverlay").classList.add("active");
  showTourStep();
}

function showTourStep(){
  const step = TOUR_STEPS[tourStep];
  if(!step){ endTour(); return; }
  document.getElementById("tourTitle").textContent = step.title;
  document.getElementById("tourDesc").textContent = step.desc;
  document.getElementById("tourStepInd").textContent = (tourStep+1) + " / " + TOUR_STEPS.length;
  const nextBtn = document.getElementById("tourNextBtn");
  nextBtn.textContent = tourStep === TOUR_STEPS.length - 1 ? "Finish ✓" : "Next →";
  // Highlight
  const hl = document.getElementById("tourHighlight");
  if(step.target){
    const el = document.querySelector(step.target);
    if(el){
      const r = el.getBoundingClientRect();
      hl.style.cssText = `top:${r.top-4}px;left:${r.left-4}px;width:${r.width+8}px;height:${r.height+8}px;display:block`;
    } else { hl.style.display = "none"; }
  } else { hl.style.display = "none"; }
  // Position tooltip
  const tt = document.getElementById("tourTooltip");
  tt.style.cssText = "bottom:80px;left:50%;transform:translateX(-50%)";
}

function nextTourStep(){
  tourStep++;
  if(tourStep >= TOUR_STEPS.length){ endTour(); return; }
  showTourStep();
}

function skipTour(){ endTour(); }

function endTour(){
  document.getElementById("tourOverlay").classList.remove("active");
  document.getElementById("tourHighlight").style.display = "none";
  safeSet("ha_tour_done", true);
}

// ═══════════════════════════════════════
// MANAGE USERS
// ═══════════════════════════════════════
async function openManageUsers(){
  if(!isAdmin()) return showToast("Admin only!", "warn");
  showLoading("Loading users...");
  await loadUsersFromFirestore();
  hideLoading();
  renderUserList();
  document.getElementById("manageUsersModal").style.display = "block";
}
function closeManageUsers(){ document.getElementById("manageUsersModal").style.display = "none"; }

function renderUserList(){
  const body = document.getElementById("muBody");
  body.innerHTML = "";
  if(firestoreUsers.length === 0){
    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">No users found.</div>';
    return;
  }
  firestoreUsers.forEach(u => {
    const avCls = u.role === "admin" ? "mu-avatar-admin" : "mu-avatar-staff";
    const isSelf = currentUser && currentUser.uid === u.uid;
    const statusCls = u.status === "inactive" ? "mu-status-inactive" : "mu-status-active";
    const statusLabel = u.status === "inactive" ? "Inactive" : "Active";
    const card = document.createElement("div");
    card.className = "mu-card";
    card.innerHTML = `<div class="mu-avatar ${avCls}">${escH((u.name||"U").charAt(0).toUpperCase())}</div>
      <div class="mu-info">
        <div class="mu-name">${escH(u.name||"Unknown")} ${isSelf ? '<span style="font-size:10px;color:var(--accent)">(You)</span>' : ""}
        <span class="mu-status-chip ${statusCls}">${statusLabel}</span></div>
        <div class="mu-role">${escH(u.role||"staff")}</div>
        <div class="mu-username">📧 ${escH(u.email||"-")}</div>
      </div>
      <div class="mu-actions">
        <button class="btn btn-ghost btn-xs" onclick="editUser('${u.uid}')">✏️</button>
        ${!isSelf ? `<button class="btn btn-ghost btn-xs" style="border-color:${u.status==='inactive'?'#16a34a':'#f59e0b'};color:${u.status==='inactive'?'#16a34a':'#f59e0b'}" onclick="toggleUserStatus('${u.uid}')">${u.status==='inactive'?'✅':'⏸️'}</button>` : ""}
      </div>`;
    body.appendChild(card);
  });
}

function openAddUser(){
  editingUserId = null;
  document.getElementById("addUserTitle").textContent = "➕ Add New User";
  document.getElementById("auName").value = "";
  document.getElementById("auEmail").value = "";
  document.getElementById("auPassword").value = "";
  document.getElementById("auEmail").disabled = false;
  document.getElementById("auPassword").disabled = false;
  document.getElementById("auPasswordLabel").textContent = "Password (min 6 chars)";
  document.getElementById("auRole").value = "staff";
  document.getElementById("auStatus").value = "active";
  document.getElementById("addUserPopup").style.display = "flex";
}

function editUser(uid){
  const u = firestoreUsers.find(x => x.uid === uid);
  if(!u) return;
  editingUserId = uid;
  document.getElementById("addUserTitle").textContent = "✏️ Edit User";
  document.getElementById("auName").value = u.name || "";
  document.getElementById("auEmail").value = u.email || "";
  document.getElementById("auEmail").disabled = true;
  document.getElementById("auPassword").value = "";
  document.getElementById("auPassword").disabled = true;
  document.getElementById("auPasswordLabel").textContent = "Password (cannot change here)";
  document.getElementById("auRole").value = u.role || "staff";
  document.getElementById("auStatus").value = u.status || "active";
  document.getElementById("addUserPopup").style.display = "flex";
}

function closeAddUser(){ document.getElementById("addUserPopup").style.display = "none"; editingUserId = null; }

async function saveUser(){
  const name = document.getElementById("auName").value.trim();
  const email = document.getElementById("auEmail").value.trim().toLowerCase();
  const password = document.getElementById("auPassword").value;
  const role = document.getElementById("auRole").value;
  const status = document.getElementById("auStatus").value;
  if(!name) return showToast("Name daalo!", "warn");
  const saveBtn = document.getElementById("auSaveBtn");
  saveBtn.disabled = true; saveBtn.textContent = "⏳ Saving...";
  if(editingUserId){
    try {
      await db.collection("users").doc(editingUserId).update({name:name, role:role, status:status});
      const idx = firestoreUsers.findIndex(u => u.uid === editingUserId);
      if(idx >= 0){ firestoreUsers[idx].name = name; firestoreUsers[idx].role = role; firestoreUsers[idx].status = status; }
      if(currentUser && currentUser.uid === editingUserId){ currentUser.name = name; currentUser.role = role; updateUserUI(); applyRolePermissions(); }
      addLog("updated", "User updated", currentUser.name, name);
      closeAddUser(); renderUserList(); populateStaffFilter(); showToast("User updated ✅");
    } catch(e){ console.error("User update error:", e); showToast("Update failed! " + e.message, "warn"); }
  } else {
    if(!email) return resetSaveBtn("Email daalo!");
    if(!password || password.length < 6) return resetSaveBtn("Password min 6 chars!");
    if(firestoreUsers.find(u => u.email && u.email.toLowerCase() === email)){ return resetSaveBtn("Email already exists!"); }
    try {
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({email:email, password:password, returnSecureToken:false})
      });
      const data = await response.json();
      if(data.error){ throw new Error(data.error.message || "Auth creation failed"); }
      const newUid = data.localId;
      await db.collection("users").doc(newUid).set({name:name, email:email, role:role, status:status, createdAt:firebase.firestore.FieldValue.serverTimestamp(), createdBy:currentUser.uid});
      firestoreUsers.push({uid:newUid, name:name, email:email, role:role, status:status});
      addLog("created", "New user added", currentUser.name, name);
      addNotification("👤", `New user added: ${name}`);
      closeAddUser(); renderUserList(); populateStaffFilter(); showToast("User created ✅ ("+email+")");
    } catch(e){
      console.error("User creation error:", e);
      let msg = "Creation failed!";
      const errMsg = e.message || "";
      if(errMsg.includes("EMAIL_EXISTS")) msg = "Email already exists in Auth!";
      else if(errMsg.includes("WEAK_PASSWORD")) msg = "Password too weak (min 6 chars)!";
      else if(errMsg.includes("INVALID_EMAIL")) msg = "Invalid email format!";
      else msg = "Error: " + errMsg;
      resetSaveBtn(msg); return;
    }
  }
  saveBtn.disabled = false; saveBtn.textContent = "💾 Save";
  function resetSaveBtn(msg){ showToast(msg,"warn"); saveBtn.disabled=false; saveBtn.textContent="💾 Save"; }
}

async function toggleUserStatus(uid){
  const u = firestoreUsers.find(x => x.uid === uid);
  if(!u) return;
  const newStatus = u.status === "inactive" ? "active" : "inactive";
  const actionLabel = newStatus === "inactive" ? "deactivate" : "activate";
  customConfirm(`${escH(u.name)} ko ${actionLabel} karna hai?`, async function(){
    try {
      showLoading("Updating...");
      await db.collection("users").doc(uid).update({status:newStatus});
      u.status = newStatus;
      addLog("updated", `User ${actionLabel}d`, currentUser.name, u.name);
      renderUserList(); hideLoading(); showToast(`User ${actionLabel}d ✅`);
    } catch(e){ hideLoading(); showToast("Failed! " + e.message, "warn"); }
  });
}

// ═══════════════════════════════════════
// DARK MODE
// ═══════════════════════════════════════
function initDark(){
  if(safeGet("darkMode", false)){ document.body.classList.add("dark"); document.getElementById("modeBtn").textContent = "☀️"; }
}
function toggleDark(){
  document.body.classList.toggle("dark");
  const d = document.body.classList.contains("dark");
  document.getElementById("modeBtn").textContent = d ? "☀️" : "🌙";
  safeSet("darkMode", d);
}

// ═══════════════════════════════════════
// UTILS
// ═══════════════════════════════════════
let _debTimer;
function debounceRender(){ clearTimeout(_debTimer); _debTimer = setTimeout(render, 200); }
function escH(s){ const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }

function showToast(msg, type){
  const t = document.createElement("div");
  t.className = "toast" + (type === "warn" ? " toast-warn" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("toast-show")));
  setTimeout(() => { t.classList.remove("toast-show"); setTimeout(() => t.remove(), 350); }, 2500);
}

let _confirmCb = null;
function customConfirm(msg, cb){ document.getElementById("confirmMsg").textContent = msg; document.getElementById("confirmModal").style.display = "flex"; _confirmCb = cb; }
function confirmYes(){ document.getElementById("confirmModal").style.display = "none"; if(_confirmCb) _confirmCb(); _confirmCb = null; }
function confirmNo(){ document.getElementById("confirmModal").style.display = "none"; _confirmCb = null; }

// ═══════════════════════════════════════
// CATEGORY
// ═══════════════════════════════════════
const CAT = {
  civil:{dot:"r-dot-civil",chip:"cat-civil",label:"Civil",color:"#D85A30"},
  electrical:{dot:"r-dot-electrical",chip:"cat-electrical",label:"Electrical",color:"#C49A0A"},
  furniture:{dot:"r-dot-furniture",chip:"cat-furniture",label:"Furniture",color:"#378ADD"},
  plumbing:{dot:"r-dot-plumbing",chip:"cat-plumbing",label:"Plumbing",color:"#2E9E55"},
  missing:{dot:"r-dot-missing",chip:"cat-missing",label:"Missing",color:"#C44A7A"},
  other:{dot:"r-dot-other",chip:"cat-other",label:"Other",color:"#64748b"}
};
function catKey(t){ return (t||"other").toLowerCase().replace(/[^a-z]/g,"") || "other"; }
function getCat(t){ return CAT[catKey(t)] || CAT.other; }

// ═══════════════════════════════════════
// MENU
// ═══════════════════════════════════════
function toggleMenu(){
  const m = document.getElementById("menu"), o = document.getElementById("overlay");
  const isOpen = m.style.left === "0px";
  m.style.left = isOpen ? "-290px" : "0px";
  o.style.display = isOpen ? "none" : "block";
}
function scrollToChart(){ document.getElementById("chartSection").scrollIntoView({behavior:"smooth"}); }

// ═══════════════════════════════════════
// SAVE
// ═══════════════════════════════════════
function save(){
  if(isDemoMode) return; // No saving in demo
  safeSet("rooms", rooms);
  safeSet("bin", bin);
  updateBinBadge();
  populateStaffFilter();
  saveRoomsToFirestore();
  saveBinToFirestore();
}

// ═══════════════════════════════════════
// BIN
// ═══════════════════════════════════════
function addToBin(type, data, roomNum){
  bin.push({type:type, data:JSON.parse(JSON.stringify(data)), deletedAt:Date.now(), roomNum:roomNum||null, deletedBy:currentUser?currentUser.uid:null});
  save();
}
function purgeBin(){ const TEN=10*24*60*60*1000; const b=bin.length; bin=bin.filter(i=>(Date.now()-i.deletedAt)<TEN); if(bin.length!==b) safeSet("bin",bin); }
function updateBinBadge(){ purgeBin(); const badge=document.getElementById("binBadge"); if(!badge) return; badge.textContent=bin.length; badge.style.display=bin.length>0?"inline":"none"; }
function openBin(){ purgeBin(); renderBin(); document.getElementById("binModal").style.display="block"; }
function closeBin(){ document.getElementById("binModal").style.display="none"; }
function renderBin(){
  const c=document.getElementById("binItemsContainer"); const e=document.getElementById("binEmpty"); c.innerHTML="";
  if(bin.length===0){ e.style.display="block"; return; } e.style.display="none";
  [...bin].reverse().forEach((item,revIdx)=>{
    const realIdx=bin.length-1-revIdx;
    const daysLeft=Math.max(0,Math.ceil((10*24*60*60*1000-(Date.now()-item.deletedAt))/(24*60*60*1000)));
    const cls=daysLeft<=2?"bin-days-danger":daysLeft<=5?"bin-days-warn":"bin-days-ok";
    const div=document.createElement("div"); div.className="bin-item";
    if(item.type==="room"){
      const iCnt=item.data.issues?item.data.issues.length:0;
      div.innerHTML=`<div class="bin-item-info"><div class="bin-item-title">🏠 Room ${escH(item.data.number)} <span style="font-size:10px;color:var(--text3)">Floor: ${escH(item.data.floor)}</span></div><div class="bin-item-meta"><span>📋 ${iCnt} issue(s)</span><span class="bin-days-left ${cls}">${daysLeft}d left</span></div></div>`;
    } else {
      div.innerHTML=`<div class="bin-item-info"><div class="bin-item-title">🛠️ ${escH(item.data.text)}</div><div class="bin-item-meta"><span>🏠 Room ${escH(item.roomNum)}</span><span>📌 ${escH(item.data.type)}</span><span class="bin-days-left ${cls}">${daysLeft}d left</span></div></div>`;
    }
    if(isAdmin()){
      const btn=document.createElement("button"); btn.className="bin-restore-btn"; btn.textContent="↩️ Restore";
      btn.onclick=function(){ restoreBinItem(realIdx); }; div.appendChild(btn);
    }
    c.appendChild(div);
  });
}
function restoreBinItem(idx){
  if(!isAdmin()) return showToast("Admin only!","warn");
  const item=bin[idx]; if(!item) return;
  if(item.type==="room"){
    if(rooms.find(r=>String(r.number)===String(item.data.number))){ showToast("⚠️ Room already exists!","warn"); return; }
    rooms.push(item.data);
  } else {
    const r=rooms.find(r=>String(r.number)===String(item.roomNum));
    if(!r){ showToast("⚠️ Room nahi mila!","warn"); return; }
    r.issues.push(item.data);
  }
  bin.splice(idx,1); save(); render(); renderBin();
  addLog("created", "Item restored from bin", currentUser.name);
  showToast("Restored ✅");
}

// ═══════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════
function viewHistory(ri, ii){
  const issue = rooms[ri] && rooms[ri].issues[ii]; if(!issue) return;
  const h = issue.history || [];
  const body = document.getElementById("historyBody");
  body.innerHTML = h.length === 0 ? '<div style="color:var(--text3);text-align:center;padding:20px">No history</div>'
    : h.map((x,idx) => `<div class="history-item"><span class="history-idx">#${idx+1}</span><span class="history-status">${escH(x.status)}</span><span class="history-date">${escH(x.date)}${x.by?' • '+escH(x.by):''}</span></div>`).join("");
  document.getElementById("historyModal").style.display = "flex";
}
function closeHistory(){ document.getElementById("historyModal").style.display = "none"; }

// ═══════════════════════════════════════
// STATUS CHANGE
// ═══════════════════════════════════════
let _scTarget = null;
function openStatusChange(ri, ii){
  if(isDemoMode) return showToast("🎭 Demo mode — Read only!","warn");
  _scTarget = {ri:ri, ii:ii};
  const cur = rooms[ri].issues[ii].status;
  document.querySelectorAll("#statusBtnGroup .status-opt-btn").forEach(b => {
    b.classList.remove("opt-current");
    if(b.classList.contains("opt-pending") && cur==="Pending") b.classList.add("opt-current");
    if(b.classList.contains("opt-fixed") && cur==="Fixed") b.classList.add("opt-current");
    if(b.classList.contains("opt-closed") && cur==="Closed") b.classList.add("opt-current");
  });
  document.getElementById("statusChangeModal").style.display = "flex";
}
function closeStatusChange(){ document.getElementById("statusChangeModal").style.display = "none"; _scTarget = null; }
function applyStatusChange(ns){
  if(!_scTarget) return;
  const i = rooms[_scTarget.ri].issues[_scTarget.ii];
  if(i.status === ns){ closeStatusChange(); return; }
  const oldStatus = i.status;
  i.status = ns;
  i.history.push({status:ns, date:new Date().toLocaleDateString(), by:currentUser?currentUser.name:"-"});
  save(); closeStatusChange(); render();
  addLog("updated", `Issue status: ${oldStatus} → ${ns}`, currentUser?currentUser.name:"-", i.text);
  const icons = {Pending:"⏳", Fixed:"✅", Closed:"🔒"};
  addNotification(icons[ns]||"🔄", `Issue "${i.text.slice(0,30)}" → ${ns}`);
  if(ns === "Pending" && i.priority === "High") addNotification("🔴", `High priority issue still pending: ${i.text.slice(0,30)}`);
  showToast("Status → "+ns+" ✅");
}

// ═══════════════════════════════════════
// POPUPS
// ═══════════════════════════════════════
function closePop(){ document.querySelectorAll(".popup").forEach(p => p.style.display = "none"); }
function openRoom(){
  if(isDemoBlocked()) return;
  document.getElementById("roomNumber").value = "";
  document.getElementById("roomFloor").value = "";
  document.getElementById("roomPopup").style.display = "flex";
  setTimeout(() => document.getElementById("roomNumber").focus(), 150);
}
function openReport(){ document.getElementById("reportOverlay").style.display = "block"; renderReport(); }
function closeReport(){ document.getElementById("reportOverlay").style.display = "none"; }

// ═══════════════════════════════════════
// ADD ROOM
// ═══════════════════════════════════════
function addRoom(){
  if(isDemoBlocked()) return;
  const num = document.getElementById("roomNumber").value.trim();
  const floor = document.getElementById("roomFloor").value.trim();
  if(!num) return showToast("Room number daalo!", "warn");
  if(rooms.find(r => String(r.number) === num)) return showToast("Room already exists!", "warn");
  rooms.push({number:num, floor:floor||"-", issues:[]});
  save(); closePop(); render();
  addLog("created", "Room added", currentUser?currentUser.name:"-", "Room "+num);
  addNotification("🏠", `New room added: ${num} (${floor||"-"})`);
  showToast("Room added ✅");
}

// ═══════════════════════════════════════
// MULTI-ISSUE ADD
// ═══════════════════════════════════════
let issueRowCount = 0;
function openIssue(){
  if(isDemoBlocked()) return;
  issueRowCount = 0;
  document.getElementById("multiIssueList").innerHTML = "";
  document.getElementById("issueRoom").value = "";
  addIssueRow();
  document.getElementById("issuePopup").style.display = "flex";
}
function buildStaffOptions(){
  const staff = getStaffUsers();
  let html = '<option value="">— None —</option>';
  staff.forEach(u => { html += `<option value="${u.uid}">${escH(u.name)}</option>`; });
  return html;
}
function addIssueRow(){
  issueRowCount++;
  const id = issueRowCount;
  const div = document.createElement("div");
  div.className = "multi-issue-item";
  div.id = "irow_" + id;
  div.innerHTML = `<div class="issue-num">Issue #${id}</div>
    ${id>1?'<button class="multi-remove-btn" onclick="this.parentElement.remove()">✕</button>':""}
    <div class="popup-label">Description</div>
    <input class="mi-text" placeholder="e.g. AC not working">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:5px">
      <div><div class="popup-label">Category</div><select class="mi-type"><option value="Civil">🏗️ Civil</option><option value="Electrical">⚡ Electrical</option><option value="Furniture">🪑 Furniture</option><option value="Plumbing">🚿 Plumbing</option><option value="Missing">❓ Missing</option><option value="Other">📌 Other</option></select></div>
      <div><div class="popup-label">Priority</div><select class="mi-pri"><option>High</option><option selected>Medium</option><option>Low</option></select></div>
    </div>
    <div class="popup-label">Assign to Staff</div>
    <select class="mi-assign">${buildStaffOptions()}</select>
    <div class="popup-label">Photo (optional)</div>
    <input type="file" class="mi-img" accept="image/*" style="font-size:11px">`;
  document.getElementById("multiIssueList").appendChild(div);
  const list = document.getElementById("multiIssueList");
  list.scrollTop = list.scrollHeight;
}
function saveAllIssues(){
  if(isDemoBlocked()) return;
  const roomNum = document.getElementById("issueRoom").value.trim();
  if(!roomNum) return showToast("Room number daalo!", "warn");
  const r = rooms.find(x => String(x.number) === roomNum);
  if(!r) return showToast("Room nahi mila!", "warn");
  const rows = document.querySelectorAll("#multiIssueList .multi-issue-item");
  if(rows.length === 0) return showToast("Add at least 1 issue!", "warn");
  const date = new Date().toLocaleDateString();
  let promises = [];
  rows.forEach(row => {
    const text = (row.querySelector(".mi-text") || {}).value?.trim();
    if(!text) return;
    const type = row.querySelector(".mi-type")?.value || "Other";
    const pri = row.querySelector(".mi-pri")?.value || "Medium";
    const assignId = row.querySelector(".mi-assign")?.value || "";
    const assignUser = assignId ? firestoreUsers.find(u => u.uid === assignId) : null;
    const staff = assignUser ? assignUser.name : "-";
    const fileInput = row.querySelector(".mi-img");
    const file = fileInput && fileInput.files[0];
    const p = new Promise(resolve => {
      function pushIssue(img){
        r.issues.push({text:text, staff:staff, assignedUserId:assignId||null, type:type, priority:pri, status:"Pending", date:date, image:img||null, history:[{status:"Pending",date:date,by:currentUser?currentUser.name:"-"}], createdBy:currentUser?currentUser.uid:null});
        resolve();
      }
      if(file){ const reader=new FileReader(); reader.onload=()=>pushIssue(reader.result); reader.onerror=()=>pushIssue(null); reader.readAsDataURL(file); } else pushIssue(null);
    });
    promises.push(p);
  });
  if(promises.length === 0) return showToast("No valid issues!", "warn");
  Promise.all(promises).then(() => {
    save(); closePop(); render();
    addLog("created", `${promises.length} issue(s) added`, currentUser?currentUser.name:"-", "Room "+roomNum);
    promises.forEach((_, idx) => {
      const row = rows[idx];
      if(row){
        const text = row.querySelector(".mi-text")?.value?.trim();
        const pri = row.querySelector(".mi-pri")?.value;
        if(text){
          addNotification("🛠️", `New issue in Room ${roomNum}: ${text.slice(0,30)}`);
          if(pri === "High") addNotification("🔴", `High priority issue added in Room ${roomNum}`);
        }
      }
    });
    showToast(promises.length + " issue" + (promises.length !== 1 ? "s" : "") + " saved ✅");
  });
}

// ═══════════════════════════════════════
// EDIT ISSUE
// ═══════════════════════════════════════
function openEdit(ri, ii){
  if(isDemoBlocked()) return;
  editTarget = {ri:ri, ii:ii};
  const i = rooms[ri].issues[ii];
  document.getElementById("editText").value = i.text;
  document.getElementById("editType").value = i.type || "Other";
  document.getElementById("editPri").value = i.priority || "Medium";
  const sel = document.getElementById("editAssign");
  sel.innerHTML = buildStaffOptions();
  sel.value = i.assignedUserId || "";
  document.getElementById("editPopup").style.display = "flex";
}
function closeEdit(){ document.getElementById("editPopup").style.display = "none"; editTarget = null; }
function saveEdit(){
  if(!editTarget) return;
  const i = rooms[editTarget.ri].issues[editTarget.ii];
  const text = document.getElementById("editText").value.trim();
  if(!text) return showToast("Description required!", "warn");
  const oldText = i.text;
  i.text = text;
  i.type = document.getElementById("editType").value;
  i.priority = document.getElementById("editPri").value;
  const assignId = document.getElementById("editAssign").value;
  const assignUser = assignId ? firestoreUsers.find(u => u.uid === assignId) : null;
  i.assignedUserId = assignId || null;
  i.staff = assignUser ? assignUser.name : "-";
  if(assignUser) addNotification("👤", `Issue assigned to ${assignUser.name}: ${text.slice(0,30)}`);
  addLog("updated", "Issue updated", currentUser?currentUser.name:"-", text);
  save(); closeEdit(); render(); showToast("Issue updated ✅");
}

// ═══════════════════════════════════════
// VIEW IMAGE
// ═══════════════════════════════════════
function viewImage(ri, ii){
  const img = rooms[ri] && rooms[ri].issues[ii] && rooms[ri].issues[ii].image;
  if(!img || img === "__LOCAL__") return showToast("Image not available", "warn");
  document.getElementById("imgView").src = img;
  document.getElementById("imgPopup").style.display = "flex";
}

// ═══════════════════════════════════════
// DELETE
// ═══════════════════════════════════════
function delIssue(ri, ii){
  if(isDemoBlocked()) return;
  if(!isAdmin()) return showToast("❌ Admin only!", "warn");
  customConfirm("Issue delete karna hai?", function(){
    const txt = rooms[ri].issues[ii].text;
    addToBin("issue", rooms[ri].issues[ii], rooms[ri].number);
    rooms[ri].issues.splice(ii, 1);
    addLog("deleted", "Issue deleted", currentUser?currentUser.name:"-", txt);
    save(); render(); showToast("Issue → Bin 🗑️");
  });
}
function delRoom(ri){
  if(isDemoBlocked()) return;
  if(!isAdmin()) return showToast("❌ Admin only!", "warn");
  customConfirm("Room + all issues delete?", function(){
    const num = rooms[ri].number;
    addToBin("room", rooms[ri], null);
    rooms.splice(ri, 1);
    addLog("deleted", "Room deleted", currentUser?currentUser.name:"-", "Room "+num);
    save(); render(); showToast("Room → Bin 🗑️");
  });
}
function clearData(){
  if(isDemoBlocked()) return;
  if(!isAdmin()) return showToast("❌ Admin only!", "warn");
  customConfirm("Saara data delete?", function(){
    rooms.forEach(r => addToBin("room", r, null));
    rooms = [];
    addLog("deleted", "All data cleared", currentUser?currentUser.name:"-");
    save(); render(); showToast("All data → Bin 🧹");
  });
}

// ═══════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════
function exportData(){
  if(isDemoBlocked()) return;
  if(!isAdmin()) return showToast("Admin only!", "warn");
  const exportObj = {rooms:rooms, exportDate:new Date().toISOString(), version:3, exportedBy:currentUser?currentUser.name:"unknown"};
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "hotel_arya_backup_" + new Date().toISOString().slice(0,10) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  addLog("updated", "Data exported", currentUser?currentUser.name:"-");
  showToast("Exported ✅");
}
function importData(e){
  if(isDemoBlocked()) return;
  if(!isAdmin()) return showToast("Admin only!", "warn");
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = function(){
    try {
      let data = JSON.parse(reader.result);
      let importRooms;
      if(Array.isArray(data)) importRooms = data;
      else if(data.rooms) importRooms = data.rooms;
      else return showToast("Invalid file!", "warn");
      for(const r of importRooms){ if(!r.number || !Array.isArray(r.issues)) return showToast("Invalid structure!", "warn"); }
      customConfirm("Replace current data?", function(){
        rooms = importRooms;
        rooms.forEach(r => r.issues.forEach(i => {
          if(!i.history) i.history = [{status:i.status||"Pending", date:i.date||new Date().toLocaleDateString()}];
          if(!i.assignedUserId) i.assignedUserId = null;
          if(!i.createdBy) i.createdBy = null;
        }));
        addLog("updated", "Data imported", currentUser?currentUser.name:"-");
        save(); render(); showToast("Import successful ✅");
      });
    } catch(err){ showToast("Invalid JSON!", "warn"); }
  };
  reader.readAsText(file);
  e.target.value = "";
}

// ═══════════════════════════════════════
// SMART SEARCH
// ═══════════════════════════════════════
const SMART_KEYWORDS = {
  civil:"cat:civil",electrical:"cat:electrical",furniture:"cat:furniture",plumbing:"cat:plumbing",missing:"cat:missing",other:"cat:other",
  pending:"status:pending",fixed:"status:fixed",closed:"status:closed",
  high:"pri:high",medium:"pri:medium",low:"pri:low"
};
function parseSmartSearch(raw){
  const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
  let cat=null, status=null, pri=null, textTokens=[];
  tokens.forEach(t => {
    const mapped = SMART_KEYWORDS[t];
    if(mapped){
      if(mapped.startsWith("cat:")) cat = mapped.split(":")[1];
      else if(mapped.startsWith("status:")) status = mapped.split(":")[1];
      else if(mapped.startsWith("pri:")) pri = mapped.split(":")[1];
    } else { textTokens.push(t); }
  });
  return {cat:cat, status:status, pri:pri, text:textTokens.join(" ")};
}
function showSmartHints(){ document.getElementById("smartTags").style.display = "flex"; }
function hideSmartHints(){ document.getElementById("smartTags").style.display = "none"; }
function setSmartSearch(val){ document.getElementById("search").value = val; render(); hideSmartHints(); }

// ═══════════════════════════════════════
// FILTERS
// ═══════════════════════════════════════
function setCatFilter(cat){
  activeCatFilter = cat;
  document.querySelectorAll(".cat-pill").forEach(b => b.classList.toggle("active", b.dataset.cat === cat));
  render();
}
function setReportFilter(f){
  activeReportFilter = f;
  document.querySelectorAll(".r-pill").forEach(b => b.classList.toggle("active", b.dataset.rf === f));
  renderReport();
}

// ═══════════════════════════════════════
// SWIPE
// ═══════════════════════════════════════
function initSwipe(el, ri, ii){
  let startX=0, startY=0, dx=0, moved=false, swiping=false;
  const row = el.querySelector(".issue-row");
  if(!row) return;
  row.addEventListener("touchstart", function(e){
    startX=e.touches[0].clientX; startY=e.touches[0].clientY; dx=0; moved=false; swiping=false;
    row.style.transition="none";
  },{passive:true});
  row.addEventListener("touchmove", function(e){
    const cx=e.touches[0].clientX; const cy=e.touches[0].clientY;
    dx=cx-startX; const dy=cy-startY;
    if(!swiping && Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>10) swiping=true;
    if(!swiping) return;
    moved=true;
    const clamped=Math.max(-120,Math.min(120,dx));
    row.style.transform="translateX("+clamped+"px)";
  },{passive:true});
  row.addEventListener("touchend", function(){
    row.style.transition="transform .25s ease";
    if(moved && Math.abs(dx)>70){
      if(dx>70){ row.style.transform="translateX(0)"; openStatusChange(ri,ii); }
      else if(dx<-70){ row.style.transform="translateX(0)"; if(isAdmin()) delIssue(ri,ii); else showToast("Admin only delete!","warn"); }
    } else { row.style.transform="translateX(0)"; }
  },{passive:true});
}

// ═══════════════════════════════════════
// VISIBILITY
// ═══════════════════════════════════════
function canSeeIssue(issue){
  if(isAdmin()) return true;
  if(!currentUser) return false;
  if(!issue.assignedUserId) return true;
  return issue.assignedUserId === currentUser.uid;
}

// ═══════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════
function render(){
  const rawSearch = (document.getElementById("search").value || "");
  const smart = parseSmartSearch(rawSearch);
  const filterSt = document.getElementById("filterStatus").value || (smart.status ? smart.status.charAt(0).toUpperCase() + smart.status.slice(1) : "");
  const filterAssign = document.getElementById("filterAssigned").value;
  const catF = smart.cat || activeCatFilter;
  const searchText = smart.text;
  const smartPri = smart.pri;
  const today = new Date().toLocaleDateString();
  const container = document.getElementById("rooms");
  container.innerHTML = "";

  let gTotal=0, gPend=0, gFixed=0, gClosed=0, gHigh=0, gToday=0;
  rooms.forEach(r => r.issues.forEach(i => {
    if(!canSeeIssue(i)) return;
    gTotal++;
    if(i.status==="Pending") gPend++;
    if(i.status==="Fixed") gFixed++;
    if(i.status==="Closed") gClosed++;
    if(i.priority==="High") gHigh++;
    if(i.date===today) gToday++;
  }));

  if(rooms.length === 0){
    container.innerHTML = `<div class="empty-state"><div style="font-size:44px;margin-bottom:10px">🏨</div><div style="font-size:15px;font-weight:600;color:var(--text2);margin-bottom:5px">No rooms yet</div><div style="font-size:12px;color:var(--text3);margin-bottom:14px">➕ Add first room</div><button class="btn" onclick="openRoom()">➕ Add Room</button></div>`;
    updateDash(0,gTotal,gPend,gFixed,gClosed,gHigh,gToday);
    updateChart(gPend,gFixed,gClosed);
    document.getElementById("filterNote").textContent = "";
    return;
  }

  let filteredTotal = 0;
  rooms.forEach(function(r, ri){
    let issueHTML = ""; let visibleCount = 0;
    r.issues.forEach(function(i, ii){
      if(!canSeeIssue(i)) return;
      const ck = catKey(i.type);
      if(catF !== "all" && ck !== catF) return;
      if(searchText && !i.text.toLowerCase().includes(searchText) && !(i.staff||"").toLowerCase().includes(searchText) && !(i.type||"").toLowerCase().includes(searchText)) return;
      if(filterSt && i.status !== filterSt) return;
      if(smartPri && i.priority.toLowerCase() !== smartPri) return;
      if(filterAssign){ if(filterAssign.startsWith("uid:") && i.assignedUserId !== filterAssign.slice(4)) return; }
      visibleCount++; filteredTotal++;
      const cat = getCat(i.type);
      const priColor = i.priority==="High"?"#dc2626":i.priority==="Medium"?"#f59e0b":"#16a34a";
      const assignedUser = i.assignedUserId ? firestoreUsers.find(u => u.uid === i.assignedUserId) : null;
      const assignLabel = assignedUser ? assignedUser.name : (i.staff && i.staff !== "-" ? i.staff : "");
      issueHTML += `<div class="swipe-container" data-ri="${ri}" data-ii="${ii}">
        <div class="swipe-bg swipe-bg-left"><span class="swipe-label-left">✅ Status</span><span class="swipe-label-right">🗑️ Delete</span></div>
        <div class="issue-row" style="border-left:4px solid ${priColor}">
          <div class="issue-dot" style="background:${cat.color}"></div>
          <div class="issue-main">
            <div class="issue-desc">${escH(i.text)}</div>
            <div class="issue-meta">
              <span class="cat-chip ${cat.chip}">${escH(cat.label)}</span>
              <span class="status-chip chip-${i.status.toLowerCase()}">${escH(i.status)}</span>
              <span class="priority-chip pri-${i.priority.toLowerCase()}">${escH(i.priority)}</span>
              ${assignLabel?`<span class="assigned-chip">👤 ${escH(assignLabel)}</span>`:""}
              <span>📅 ${escH(i.date)}</span>
            </div>
            <div class="issue-actions">
              <button class="btn btn-xs" onclick="openStatusChange(${ri},${ii})">🔄</button>
              <button class="btn btn-ghost btn-xs" onclick="openEdit(${ri},${ii})">✏️</button>
              <button class="btn btn-ghost btn-xs" onclick="viewHistory(${ri},${ii})">📋</button>
              ${isAdmin()?`<button class="btn btn-danger btn-xs" onclick="delIssue(${ri},${ii})">🗑️</button>`:""}
              ${i.image && i.image !== "__LOCAL__"?`<button class="btn btn-xs" style="background:linear-gradient(135deg,#0891b2,#0e7490)" onclick="viewImage(${ri},${ii})">🖼️</button>`:""}
            </div>
          </div>
        </div>
      </div>`;
    });

    const noFilter = !rawSearch && !filterSt && catF === "all" && !filterAssign;
    if(noFilter || visibleCount > 0){
      const badgeClass = visibleCount >= 6 ? "badge-high" : visibleCount >= 3 ? "badge-med" : "badge-low";
      const div = document.createElement("div"); div.className = "room-block";
      div.innerHTML = `<div class="room-header">
        <div class="room-title">🏠 ${escH(r.number)} <span class="room-floor-tag">${escH(r.floor)}</span></div>
        <div style="display:flex;align-items:center;gap:6px">
          ${visibleCount > 0 ? `<span class="issue-count-badge ${badgeClass}">${visibleCount}</span>` : ""}
          ${isAdmin() ? `<button class="btn btn-danger btn-xs" onclick="delRoom(${ri})">🗑️</button>` : ""}
        </div>
      </div>
      <div class="issues-list">${issueHTML || '<div class="no-issues">✅ No issues</div>'}</div>`;
      container.appendChild(div);
    }
  });

  document.querySelectorAll(".swipe-container").forEach(el => {
    const ri = parseInt(el.dataset.ri); const ii = parseInt(el.dataset.ii);
    initSwipe(el, ri, ii);
  });

  updateDash(rooms.length, gTotal, gPend, gFixed, gClosed, gHigh, gToday);
  updateChart(gPend, gFixed, gClosed);

  const noteEl = document.getElementById("filterNote");
  const hasSmartFilter = smart.cat || smart.status || smart.pri;
  if(catF !== "all" || hasSmartFilter){
    const parts = [];
    if(catF !== "all") parts.push((CAT[catF]||CAT.other).label);
    if(smart.status) parts.push(smart.status);
    if(smart.pri) parts.push(smart.pri + " priority");
    noteEl.textContent = `Showing ${filteredTotal} issue${filteredTotal!==1?"s":""} — ${parts.join(" + ")}`;
  } else if(rawSearch || filterSt || filterAssign){
    noteEl.textContent = `Showing ${filteredTotal} filtered issue${filteredTotal!==1?"s":""}`;
  } else { noteEl.textContent = ""; }
}

function updateDash(roomCnt, total, pend, fixed, closed, high, todayCnt){
  document.getElementById("totalRooms").textContent = roomCnt;
  document.getElementById("total").textContent = total;
  document.getElementById("dPending").textContent = pend;
  document.getElementById("dFixed").textContent = fixed;
  document.getElementById("dClosed").textContent = closed;
  document.getElementById("dHigh").textContent = high;
  document.getElementById("dToday").textContent = todayCnt;
}

function updateChart(pend, fixed, closed){
  if(myChart){ myChart.destroy(); myChart = null; }
  const ctx = document.getElementById("myChart").getContext("2d");
  myChart = new Chart(ctx, {type:"doughnut", data:{labels:["Pending","Fixed","Closed"],
    datasets:[{data:[pend,fixed,closed],
      backgroundColor:["rgba(220,38,38,0.85)","rgba(22,163,74,0.85)","rgba(148,163,184,0.85)"],
      borderWidth:0,
      hoverBackgroundColor:["#dc2626","#16a34a","#94a3b8"]
    }]},
    options:{responsive:true, maintainAspectRatio:true,
      plugins:{legend:{position:"bottom",labels:{font:{family:"'DM Sans',sans-serif",size:11},padding:12,usePointStyle:true}},
        tooltip:{callbacks:{label:function(c){ return " "+c.label+": "+c.parsed; }}}},
      cutout:"65%", animation:{duration:600, easing:"easeInOutQuart"}}});
}

// ═══════════════════════════════════════
// REPORT
// ═══════════════════════════════════════
function renderReport(){
  const rf = activeReportFilter;
  const visibleIssues = rooms.flatMap(r => r.issues.filter(i => canSeeIssue(i)));
  const totalI = visibleIssues.length;
  const pendI = visibleIssues.filter(i => i.status==="Pending").length;
  const fixedI = visibleIssues.filter(i => i.status==="Fixed").length;
  const closedI = visibleIssues.filter(i => i.status==="Closed").length;

  document.getElementById("rStatsRow").innerHTML = `
    <div class="report-stat-pill"><span class="rsp-num">${rooms.length}</span><span class="rsp-label">Rooms</span></div>
    <div class="report-stat-pill"><span class="rsp-num">${totalI}</span><span class="rsp-label">Issues</span></div>
    <div class="report-stat-pill"><span class="rsp-num" style="color:#dc2626">${pendI}</span><span class="rsp-label">Pending</span></div>
    <div class="report-stat-pill"><span class="rsp-num" style="color:#16a34a">${fixedI}</span><span class="rsp-label">Fixed</span></div>
    <div class="report-stat-pill"><span class="rsp-num" style="color:#64748b">${closedI}</span><span class="rsp-label">Closed</span></div>
    <div class="report-stat-pill"><span class="rsp-num">${new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span><span class="rsp-label">Date</span></div>
    ${currentUser?`<div class="report-stat-pill"><span class="rsp-num" style="font-size:12px">${escH(currentUser.name)}</span><span class="rsp-label">${escH(currentUser.role)}</span></div>`:""}`;

  const floors = {};
  rooms.forEach(r => { const f = r.floor || "-"; if(!floors[f]) floors[f] = []; floors[f].push(r); });
  const container = document.getElementById("reportRoomsContainer");
  container.innerHTML = "";
  let totalVisible = 0;

  Object.keys(floors).sort().forEach(f => {
    const visible = [];
    floors[f].forEach(r => {
      let fi = r.issues.filter(i => canSeeIssue(i));
      if(rf==="pending") fi = fi.filter(i => i.status==="Pending");
      else if(rf==="closed") fi = fi.filter(i => i.status==="Closed");
      else if(rf!=="all") fi = fi.filter(i => catKey(i.type)===rf);
      if(fi.length > 0) visible.push({number:r.number, floor:r.floor, filteredIssues:fi});
    });
    if(!visible.length) return;
    totalVisible += visible.length;
    const secEl = document.createElement("div");
    secEl.innerHTML = `<div class="report-floor-heading">Floor: ${escH(f)} — ${visible.length} room${visible.length!==1?"s":""}</div>`;
    const grid = document.createElement("div"); grid.className = "report-rooms-grid";
    visible.forEach(rv => {
      const iCount = rv.filteredIssues.length;
      const bc = iCount >= 6 ? "badge-high" : iCount >= 3 ? "badge-med" : "badge-low";
      const issHTML = rv.filteredIssues.map(i => {
        const cat = getCat(i.type);
        const priColor = i.priority==="High"?"#dc2626":i.priority==="Medium"?"#f59e0b":"#16a34a";
        let stBg, stColor;
        if(i.status==="Pending"){stBg="#feecec";stColor="#9b1c1c"} else if(i.status==="Fixed"){stBg="#dcfce7";stColor="#14532d"} else {stBg="#f1f5f9";stColor="#475569"}
        const assignedUser = i.assignedUserId ? firestoreUsers.find(u => u.uid === i.assignedUserId) : null;
        return `<div class="report-issue-row">
          <div class="r-dot ${cat.dot}"></div>
          <span style="flex:1">${escH(i.text)}</span>
          ${assignedUser?`<span style="font-size:9px;color:#7c3aed">👤${escH(assignedUser.name)}</span>`:""}
          <span style="font-size:9px;font-weight:600;padding:2px 5px;border-radius:8px;background:${stBg};color:${stColor};white-space:nowrap">${escH(i.status)}</span>
          <span style="font-size:9px;font-weight:600;color:${priColor};white-space:nowrap">${escH(i.priority)}</span>
        </div>`;
      }).join("");
      const card = document.createElement("div"); card.className = "report-room-card";
      card.innerHTML = `<div class="report-card-header"><span class="report-room-num">Room ${escH(rv.number)}</span><span class="issue-count-badge ${bc}">${iCount}</span></div><div class="report-issues-list">${issHTML}</div>`;
      grid.appendChild(card);
    });
    secEl.appendChild(grid);
    container.appendChild(secEl);
  });
  document.getElementById("reportNoResults").style.display = totalVisible === 0 ? "block" : "none";
}
