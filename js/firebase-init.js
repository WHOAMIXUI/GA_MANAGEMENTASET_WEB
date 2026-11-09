const V = "10.8.0";
const firebaseConfig = {
    apiKey: "AIzaSyC11ILYEak30-AKe55aPWMacdWKmm9it9g",
    authDomain: "assetreqpro-a67d7.firebaseapp.com",
    projectId: "assetreqpro-a67d7",
    storageBucket: "assetreqpro-a67d7.firebasestorage.app",
    messagingSenderId: "319679123678",
    appId: "1:319679123678:web:a0fcedfa4178ade4e8b24f"
};

try {
    const [appMod, fs, au] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`)
    ]);
    const app = appMod.initializeApp(firebaseConfig);

    let db;
    try {
        db = fs.initializeFirestore(app, {
            experimentalAutoDetectLongPolling: true,
            localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
        });
    } catch (e) {
        console.warn("Fallback ke getFirestore:", e);
        db = fs.getFirestore(app);
    }

    window.db = db;
    window.fbDeps = {
        collection: fs.collection, getDocs: fs.getDocs, addDoc: fs.addDoc, setDoc: fs.setDoc,
        doc: fs.doc, deleteDoc: fs.deleteDoc, getDoc: fs.getDoc, onSnapshot: fs.onSnapshot,
        query: fs.query, where: fs.where
    };

    const auth = au.getAuth(app);
    window.auth = auth;
    window.authDeps = {
        onAuthStateChanged: au.onAuthStateChanged,
        signInWithEmailAndPassword: au.signInWithEmailAndPassword,
        signOut: au.signOut,
        updatePassword: au.updatePassword,
        reauthenticateWithCredential: au.reauthenticateWithCredential,
        EmailAuthProvider: au.EmailAuthProvider
    };

    // Membuat akun untuk orang lain TANPA mengeluarkan admin yang sedang login:
    // pakai instance Firebase kedua (secondary) khusus untuk pembuatan akun.
    window.createAuthUser = async (email, password) => {
        const sec = appMod.getApps().find(a => a.name === 'secondary') || appMod.initializeApp(firebaseConfig, 'secondary');
        const secAuth = au.getAuth(sec);
        try {
            const cred = await au.createUserWithEmailAndPassword(secAuth, email, password);
            return cred.user.uid;
        } finally {
            try { await au.signOut(secAuth); } catch (_) {}
        }
    };

    window.dispatchEvent(new Event('firebase-ready'));
} catch (err) {
    console.error("Gagal Inisialisasi Firebase:", err);
    window.__fbInitError = err;
    window.dispatchEvent(new Event('firebase-failed'));
}
