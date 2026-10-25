/**
 * StudySphere QuickQuiz 2.0 - Firebase Cloud Sync & Authentication Module
 * Built for GitHub Pages (Vanilla JS / Browser ES Modules)
 * Handles Google Sign-in and seamless Firestore backup / restore.
 */

// Firebase Configuration Provided by User
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBmfNSxEHXL02TzeUz7fPs0b_HMp1d9pYE",
  authDomain: "quickquizmpsc.firebaseapp.com",
  databaseURL: "https://quickquizmpsc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "quickquizmpsc",
  storageBucket: "quickquizmpsc.firebasestorage.app",
  messagingSenderId: "208947332745",
  appId: "1:208947332745:web:589570654dcf4f13232858",
  measurementId: "G-2S4MMLX2RK"
};

const AppFirebase = (() => {
  let app = null;
  let auth = null;
  let db = null;
  let currentUser = null;
  let isInitialized = false;

  async function init() {
    if (isInitialized) return true;
    try {
      // Dynamically load Firebase SDK via CDN (compatible with pure static GitHub Pages)
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      const { getFirestore, doc, setDoc, getDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

      app = initializeApp(FIREBASE_CONFIG);
      auth = getAuth(app);
      db = getFirestore(app);

      // Listen for persistent auth state
      onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateCloudSyncUI(user);
      });

      isInitialized = true;
      return true;
    } catch (err) {
      console.warn("[Firebase] SDK loading skipped or network unavailable:", err);
      return false;
    }
  }

  async function signInWithGoogle() {
    if (!isInitialized) {
      const ready = await init();
      if (!ready) throw new Error("Firebase लोड होऊ शकले नाही. कृपया इंटरनेट तपासा.");
    }
    const { GoogleAuthProvider, signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    updateCloudSyncUI(currentUser);
    return currentUser;
  }

  async function logOut() {
    if (auth) {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await signOut(auth);
      currentUser = null;
      updateCloudSyncUI(null);
    }
  }

  async function backupUserDataToCloud() {
    if (!currentUser || !db) throw new Error("कृपया आधी Google लॉगिन करा.");
    const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const vault = AppStorage.getVault();
    const history = AppStorage.getSessionHistory();
    const target = AppStorage.getExamTarget();
    const streak = AppStorage.getStreak();

    const userRef = doc(db, "users", currentUser.uid);
    await setDoc(userRef, {
      profile: {
        displayName: currentUser.displayName,
        email: currentUser.email,
        photoURL: currentUser.photoURL
      },
      vault: vault || {},
      history: history || [],
      target: target || {},
      streak: streak || 0,
      lastSyncedAt: serverTimestamp()
    }, { merge: true });

    return true;
  }

  async function restoreUserDataFromCloud() {
    if (!currentUser || !db) throw new Error("कृपया आधी Google लॉगिन करा.");
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const cloudData = snap.data();
      if (cloudData.vault) {
        AppStorage.writeJSON(AppStorage.KEYS.VAULT, cloudData.vault);
      }
      if (cloudData.target) {
        AppStorage.setExamTarget(cloudData.target);
      }
      return cloudData;
    }
    return null;
  }

  function updateCloudSyncUI(user) {
    const cloudBtnText = document.getElementById('cloudSyncBtnText');
    const cloudUserMeta = document.getElementById('cloudUserMeta');
    const cloudUserImg = document.getElementById('cloudUserImg');
    const cloudUserName = document.getElementById('cloudUserName');

    if (user) {
      if (cloudBtnText) cloudBtnText.textContent = "डेटा क्लाउडवर सिंक करा ☁️";
      if (cloudUserMeta) cloudUserMeta.classList.remove('hidden');
      if (cloudUserImg) cloudUserImg.src = user.photoURL || 'icon.svg';
      if (cloudUserName) cloudUserName.textContent = user.displayName || user.email;
    } else {
      if (cloudBtnText) cloudBtnText.textContent = "Google लॉगिन व क्लाउड सिंक ☁️";
      if (cloudUserMeta) cloudUserMeta.classList.add('hidden');
    }
  }

  function getUser() {
    return currentUser;
  }

  return {
    init,
    signInWithGoogle,
    logOut,
    backupUserDataToCloud,
    restoreUserDataFromCloud,
    getUser
  };
})();

// Expose globally so dashboard.js can invoke it directly without module-boundary errors
window.AppFirebase = AppFirebase;

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  AppFirebase.init();
});