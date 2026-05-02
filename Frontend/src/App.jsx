import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, doc, setDoc, getDoc, updateDoc, increment, query, where, orderBy, onSnapshot, deleteDoc, limit, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { Html5Qrcode } from 'html5-qrcode';

// --- CONFIG FIREBASE ASLI MILIK VICKY ---
const firebaseConfig = {
  apiKey: "AIzaSyBq9lMekzm_aq-2Buvub7E7f7dx1V5kTiA",
  authDomain: "kasir-pintar-93e03.firebaseapp.com",
  projectId: "kasir-pintar-93e03",
  storageBucket: "kasir-pintar-93e03.appspot.com",
  messagingSenderId: "166529415845",
  appId: "1:166529415845:web:1a876202c5de0fb6b62b4c",
  measurementId: "G-P0PNQ3B54B"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const auth = getAuth(app);

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [showOfflineWarning, setShowOfflineWarning] = useState(!window.navigator.onLine);

  const [produk, setProduk] = useState([]);
  const [transaksi, setTransaksi] = useState([]);
  const [pengeluaran, setPengeluaran] = useState([]); 
  const [cart, setCart] = useState(() => {
    try { const saved = localStorage.getItem('kasirCart'); return saved ? JSON.parse(saved) : []; } 
    catch(e) { return []; }
  });
  
  const [search, setSearch] = useState('');
  const [searchLaporan, setSearchLaporan] = useState(''); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [laporanTab, setLaporanTab] = useState('transaksi'); 
  const [showBonModal, setShowBonModal] = useState(false);
  const [namaPelangganBon, setNamaPelangganBon] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedYearReset, setSelectedYearReset] = useState('2025');

  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [metodePembayaran, setMetodePembayaran] = useState('Tunai'); 
  const [isScanningKasir, setIsScanningKasir] = useState(false);
  const [isScanningToko, setIsScanningToko] = useState(false);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false); // --- REVISI: MODAL BANTUAN ---
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [strukData, setStrukData] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [printData, setPrintData] = useState(null);

  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');
  const [qrisImage, setQrisImage] = useState(''); 

  // --- REVISI: SETTING LABEL KUSTOM (SEKAT, SKALA, KOLOM) ---
  const [labelWidth, setLabelWidth] = useState(185);
  const [labelHeight, setLabelHeight] = useState(95);
  const [labelScale, setLabelScale] = useState(100);
  const [labelGap, setLabelGap] = useState(5);
  const [labelCols, setLabelColumns] = useState(4);
  
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [hargaPromoProd, setHargaPromoProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');
  const [satuanProd, setSatuanProd] = useState('Pcs'); 
  const [editingProductId, setEditingProductId] = useState(null);

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [sortOrder, setSortOrder] = useState('terbaru');
  const [chartVisualType, setChartVisualType] = useState('bar');

  const [namaPengeluaran, setNamaPengeluaran] = useState('');
  const [nominalPengeluaran, setNominalPengeluaran] = useState('');

  const [reportFilter, setReportFilter] = useState('hari');
  const [chartFilter, setChartFilter] = useState('hari'); 
  const [dashboardStats, setDashboardStats] = useState({ todaySales: 0, totalProducts: 0, lowStock: 0, totalPengeluaran: 0, labaBersih: 0 });

  const produkRef = useRef(produk);
  useEffect(() => { produkRef.current = produk; }, [produk]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => { setIsOnline(false); setShowOfflineWarning(true); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT');
      if (isInput && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; 
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if(e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
        const focusableElements = Array.from(document.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]'))
          .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        const currentIndex = focusableElements.indexOf(activeElement);
        let nextIndex = currentIndex;
        if (e.key === 'ArrowDown' || (!isInput && e.key === 'ArrowRight')) {
          nextIndex = currentIndex + 1 < focusableElements.length ? currentIndex + 1 : 0;
        } else if (e.key === 'ArrowUp' || (!isInput && e.key === 'ArrowLeft')) {
          nextIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : focusableElements.length - 1;
        }
        if (nextIndex !== currentIndex && focusableElements[nextIndex]) { focusableElements[nextIndex].focus(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).then(() => {
      onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    });
  }, []);

  useEffect(() => { localStorage.setItem('kasirCart', JSON.stringify(cart)); }, [cart]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "profilToko", user.uid)).then(d => {
      if(d.exists()) { 
        setNamaToko(d.data().nama || ''); setAlamat(d.data().alamat || ''); 
        setNoTelp(d.data().noTelp || ''); setQrisImage(d.data().qrisImage || '');
        setLabelWidth(d.data().labelWidth || 185); setLabelHeight(d.data().labelHeight || 95);
        setLabelScale(d.data().labelScale || 100); setLabelGap(d.data().labelGap || 5);
        setLabelColumns(d.data().labelCols || 4);
      }
    });
    const unsubProduk = onSnapshot(query(collection(db, "produk"), where("userId", "==", user.uid)), (snap) => {
      setProduk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubTrans = onSnapshot(query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc"), limit(500)), (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTransaksi(data);
    });
    const unsubPengeluaran = onSnapshot(query(collection(db, "pengeluaran"), where("userId", "==", user.uid), orderBy("waktu", "desc"), limit(500)), (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPengeluaran(data);
    });
    return () => { unsubProduk(); unsubTrans(); unsubPengeluaran(); };
  }, [user]);

  const addToCartRef = useRef();
  useEffect(() => { addToCartRef.current = addToCart; }, [cart]);

  useEffect(() => {
    let html5QrCode;
    let isComponentMounted = true; 
    const startScanner = async () => {
      const scannerId = isScanningKasir ? "reader-kasir" : (isScanningToko ? "reader-toko" : null);
      if (!scannerId) return;
      html5QrCode = new Html5Qrcode(scannerId);
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, 
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (isScanningKasir) {
              const found = produkRef.current.find(p => p.barcode === decodedText);
              if (found) { addToCartRef.current(found); setIsScanningKasir(false); } 
              else { alert('❌ Barcode tidak terdaftar!'); setIsScanningKasir(false); }
            } else { setBarcodeProd(decodedText); setIsScanningToko(false); }
          }, undefined
        );
      } catch (err) { console.error(err); }
    };
    if (isScanningKasir || isScanningToko) { startScanner(); }
    return () => {
      isComponentMounted = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      }
    };
  }, [isScanningKasir, isScanningToko]);

  useEffect(() => { if (strukData) setTimeout(() => { window.print(); }, 800); }, [strukData]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setQrisImage(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try { setLoading(true); if (isRegister) await createUserWithEmailAndPassword(auth, email, password); else await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { alert('Gagal: ' + error.message); } finally { setLoading(false); }
  };

  const handleManualScan = (e) => {
    e.preventDefault();
    const found = produk.find(p => p.barcode === barcodeInput || p.barcode === String(barcodeInput));
    if (found) { addToCart(found); setBarcodeInput(''); } else { alert('Barcode tidak ditemukan!'); setBarcodeInput(''); }
  };

  const addToCart = (p) => {
    if (p.stok <= 0) return alert("Stok habis!");
    const hargaAktif = p.hargaPromo ? Number(p.hargaPromo) : Number(p.harga);
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        if(existing.qty >= p.stok) { alert("Stok tidak mencukupi!"); return prev; }
        return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...p, harga: hargaAktif, hargaAsli: p.harga, qty: 1 }];
    });
  };

  const updateQuantity = (id, newQty) => {
    if (newQty <= 0) { setCart(prev => prev.filter(item => item.id !== id)); return; }
    setCart(prev => prev.map(item => item.id === id ? (newQty > item.stok ? { ...item, qty: item.stok } : { ...item, qty: newQty }) : item));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  const kembalian = (metodePembayaran === 'Tunai' && paymentAmount !== '') ? Number(paymentAmount) - totalAmount : 0;

  const processPayment = () => {
    if (cart.length === 0) return alert('Keranjang kosong!');
    if (metodePembayaran === 'Tunai' && Number(paymentAmount) < totalAmount) return alert('Uang bayar kurang!');
    if (metodePembayaran === 'Bon') setShowBonModal(true); else finalizePayment(metodePembayaran); 
  };

  const finalizePayment = (metode) => {
    const finalUangBayar = metode === 'Tunai' ? Number(paymentAmount) : totalAmount;
    const dataTrans = {
      userId: user.uid, items: cart.map(i => ({nama: i.nama, harga: i.harga, hargaAsli: i.hargaAsli, qty: i.qty, satuan: i.satuan || 'Pcs'})),
      total: totalAmount, uangBayar: finalUangBayar, kembalian: kembalian, metode: metode, waktu: new Date() 
    };
    if (metode === 'Bon') { if (!namaPelangganBon.trim()) return alert("Nama pelanggan wajib diisi!"); dataTrans.namaPelanggan = namaPelangganBon; dataTrans.statusBon = 'Belum Lunas'; }
    try {
      addDoc(collection(db, "transaksi"), dataTrans);
      for (const item of cart) { updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) }); }
      setStrukData(dataTrans); setCart([]); setPaymentAmount(''); setMetodePembayaran('Tunai'); setShowQrisModal(false); setShowBonModal(false); setNamaPelangganBon('');
    } catch (err) { alert("Gagal memproses transaksi"); }
  };

  const simpanProduk = (e) => {
    e.preventDefault();
    const promoVal = hargaPromoProd ? Number(hargaPromoProd) : null;
    if (editingProductId) {
      const checkDuplicate = produk.find(p => p.barcode === barcodeProd && barcodeProd !== "" && p.id !== editingProductId);
      if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan!");
      updateDoc(doc(db, "produk", editingProductId), { nama: namaProd, harga: Number(hargaProd), hargaPromo: promoVal, stok: Number(stokProd), barcode: barcodeProd, satuan: satuanProd });
      setEditingProductId(null);
    } else {
      const checkDuplicate = produk.find(p => p.barcode === barcodeProd && barcodeProd !== "");
      if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan!");
      const bcode = barcodeProd || Math.floor(100000000000 + Math.random() * 900000000000).toString();
      addDoc(collection(db, "produk"), { nama: namaProd, harga: Number(hargaProd), hargaPromo: promoVal, stok: Number(stokProd), barcode: bcode, satuan: satuanProd, userId: user.uid, createdAt: new Date() });
    }
    setNamaProd(''); setHargaProd(''); setHargaPromoProd(''); setStokProd(''); setBarcodeProd(''); setSatuanProd('Pcs');
  };

  const simpanPengeluaran = (e) => {
    e.preventDefault();
    addDoc(collection(db, "pengeluaran"), { nama: namaPengeluaran, nominal: Number(nominalPengeluaran), userId: user.uid, waktu: new Date() });
    setNamaPengeluaran(''); setNominalPengeluaran(''); 
  };

  const simpanProfil = () => {
    setDoc(doc(db, "profilToko", user.uid), { 
      nama: namaToko, alamat, noTelp, qrisImage, 
      labelWidth: Number(labelWidth), labelHeight: Number(labelHeight),
      labelScale: Number(labelScale), labelGap: Number(labelGap), labelCols: Number(labelCols)
    });
    alert("Profil Tersimpan!"); setShowProfileModal(false);
  };

  const handleResetTahunan = async () => {
    if (!window.confirm(`⚠️ Hapus data tahun ${selectedYearReset}?`)) return;
    const startOfYear = new Date(`${selectedYearReset}-01-01T00:00:00`);
    const endOfYear = new Date(`${selectedYearReset}-12-31T23:59:59`);
    try {
      const snapshot = await getDocs(query(collection(db, "transaksi"), where("userId", "==", user.uid), where("waktu", ">=", startOfYear), where("waktu", "<=", endOfYear)));
      for (const d of snapshot.docs) { deleteDoc(doc(db, "transaksi", d.id)); }
      alert(`Berhasil dihapus.`); setShowResetModal(false);
    } catch (error) { console.error(error); }
  };

  const sortedProduk = [...produk].sort((a, b) => sortOrder === 'terbaru' ? (b.createdAt?.toMillis || 0) - (a.createdAt?.toMillis || 0) : a.nama.localeCompare(b.nama));
  const toggleSelectProduct = (id) => setSelectedProducts(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);

  const isProfit = dashboardStats.labaBersih >= 0;

  const getChartData = () => {
    let labels = []; let values = []; const now = new Date();
    if (chartFilter === 'jam') {
      const todayTrans = transaksi.filter(t => t.waktu && t.waktu.toDate && t.waktu.toDate().toDateString() === now.toDateString());
      for(let i=8; i<=22; i+=2) { labels.push(`${i}:00`); values.push(todayTrans.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu.toDate().getHours() >= i && t.waktu.toDate().getHours() < i+2).reduce((s, t) => s + t.total, 0)); }
    } else if (chartFilter === 'hari') {
      for(let i=6; i>=0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); labels.push(`${d.getDate()}/${d.getMonth()+1}`); values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().toDateString() === d.toDateString()).reduce((s, t) => s + t.total, 0)); }
    } else if (chartFilter === 'bulan') {
      for(let i=5; i>=0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); labels.push(d.toLocaleString('default', { month: 'short' })); values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().getMonth() === d.getMonth() && t.waktu.toDate().getFullYear() === d.getFullYear()).reduce((s, t) => s + t.total, 0)); }
    } else if (chartFilter === 'tahun') {
      for(let i=4; i>=0; i--) { const year = now.getFullYear() - i; labels.push(year); values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().getFullYear() === year).reduce((s, t) => s + t.total, 0)); }
    }
    const max = Math.max(...values, 1);
    return { data: labels.map((l, i) => ({ label: l, total: values[i] })), max };
  };
  const chartData = getChartData();

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: "'Inter', sans-serif", color: '#FF7835' }}><strong>Memuat Sistem...</strong></div>;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', background: '#FF7835', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: 'white', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '30px', fontWeight: '900', color: '#272734', margin: 0 }}>POS MODERN PRO</h1>
            <p style={{ color: '#27274F', fontSize: '14px', margin: '8px 0 0 0', fontWeight: '600' }}>Sistem Kasir Bisnis Terpadu</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} /></div>
            <div style={{ marginBottom: '32px' }}><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} /></div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '18px', background: '#272734', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase' }}>{isRegister ? 'BUAT AKUN' : 'MASUK'}</button>
          </form>
          <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', color: '#FF7835', marginTop: '24px', textAlign: 'center', fontSize: '14px', fontWeight: '700' }}>{isRegister ? 'Punya akun? Login' : 'Daftar disini'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: '#f8fafc', overflow: 'hidden' }}>
      
      {/* HEADER */}
      <header className="no-print" style={{ flex: 'none', height: '70px', background: 'white', padding: '0 24px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 40, boxSizing: 'border-box' }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: '10px' }}>
          <h1 className="header-title" style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#FF7835', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{namaToko || 'POS MODERN PRO'}</h1>
          <p className="header-email" style={{ margin: '0', color: '#27274F', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Akun: {user.email}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 'none' }}>
          <div className="live-clock" style={{ textAlign: 'right', paddingRight: '16px', borderRight: '2px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
            <div style={{ fontSize: '15px', fontWeight: '900', color: '#272734' }}>{currentTime.toLocaleTimeString('id-ID')}</div>
          </div>
          <button tabIndex="0" onClick={() => setShowProfileModal(true)} style={{ background: '#fff7ed', border: '1px solid #FF7835', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#FF7835' }}>👤</button>
          <button tabIndex="0" onClick={() => { if(!isOnline) return alert("Sistem tidak bisa logout saat Offline!"); signOut(auth); }} disabled={!isOnline} style={{ padding: '8px 16px', background: isOnline ? '#fee2e2' : '#e2e8f0', color: isOnline ? '#dc2626' : '#94a3b8', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: isOnline ? 'pointer' : 'not-allowed', fontSize: '12px' }}>Logout</button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          
        {/* --- TAB DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '1200px', margin: '0 auto' }}>
              <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'linear-gradient(135deg, #4F46E5, #3B82F6)', color: 'white', padding: '20px', borderRadius: '16px' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800' }}>Rp {dashboardStats.todaySales.toLocaleString()}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700' }}>Omzet Hari Ini</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)', color: 'white', padding: '20px', borderRadius: '16px' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800' }}>Rp {dashboardStats.totalPengeluaran.toLocaleString()}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700' }}>Pengeluaran Hari Ini</div>
                </div>
                <div style={{ background: 'white', border: `2px solid ${isProfit ? '#10b981' : '#ef4444'}`, padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '26px', fontWeight: '900', color: isProfit ? '#10b981' : '#ef4444' }}>{isProfit ? '' : '- '}Rp {Math.abs(dashboardStats.labaBersih).toLocaleString()}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Laba Bersih Hari Ini</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #EA580C, #F59E0B)', color: 'white', padding: '20px', borderRadius: '16px' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800' }}>{dashboardStats.totalProducts} <span style={{ fontSize: '14px' }}>/ {dashboardStats.lowStock} Tipis</span></div>
                  <div style={{ fontSize: '12px', fontWeight: '700' }}>Produk & Stok Tipis</div>
                </div>
              </div>

              <div style={{ flex: 1, background: 'white', padding: '24px', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: '#272734', fontSize: '18px', fontWeight: '800' }}>📈 Grafik Pendapatan</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '4px', display: 'flex', gap: '4px' }}>
                       <button onClick={() => setChartVisualType('bar')} style={{ border: 'none', padding: '6px 12px', borderRadius: '6px', background: chartVisualType === 'bar' ? 'white' : 'transparent', color: chartVisualType === 'bar' ? '#2563eb' : '#64748b', fontWeight: 'bold', fontSize: '12px' }}>📊 Balok</button>
                       <button onClick={() => setChartVisualType('line')} style={{ border: 'none', padding: '6px 12px', borderRadius: '6px', background: chartVisualType === 'line' ? 'white' : 'transparent', color: chartVisualType === 'line' ? '#2563eb' : '#64748b', fontWeight: 'bold', fontSize: '12px' }}>📈 Kurva</button>
                    </div>
                    <select value={chartFilter} onChange={(e) => setChartFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                      <option value="jam">Hari Ini</option><option value="hari">7 Hari</option><option value="bulan">6 Bulan</option><option value="tahun">5 Tahun</option>
                    </select>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', position: 'relative', alignItems: 'flex-end', gap: '15px', paddingTop: '20px' }}>
                  {chartVisualType === 'line' && (
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'calc(100% - 20px)', zIndex: 1 }}>
                      <polyline points={chartData.data.map((d, i) => `${(i / (chartData.data.length - 1 || 1)) * 100},${100 - ((d.total / (chartData.max || 1)) * 100)}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {chartData.data.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative', zIndex: 2 }}>
                      <div style={{ fontSize: '10px', color: '#FF7835', fontWeight: '800' }}>{d.total > 0 ? d.total.toLocaleString() : ''}</div>
                      {chartVisualType === 'bar' ? (
                        <div style={{ width: '100%', maxWidth: '40px', background: 'linear-gradient(to top, #60a5fa, #2563eb)', borderRadius: '4px 4px 0 0', height: `${(d.total / (chartData.max || 1)) * 100}%`, minHeight: '8px' }}></div>
                      ) : (
                        <div style={{ width: '10px', height: '10px', background: 'white', border: '3px solid #2563eb', borderRadius: '50%', marginBottom: `calc(${(d.total / (chartData.max || 1)) * 100}% - 5px)` }}></div>
                      )}
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px', fontWeight: '700' }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB KASIR --- */}
        {activeTab === 'kasir' && (
          <div className="desktop-row-mobile-col" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box' }}>
            <div className="kasir-left-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="kasir-tools" style={{ flex: 'none', display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'nowrap' }}>
                <input type="text" placeholder="🔍 Cari..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '13px' }} />
                <form onSubmit={handleManualScan} style={{ flex: 1, minWidth: 0 }}><input type="text" placeholder="🔫 Scan..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} style={{ width: '100%', padding: '10px', border: '2px solid #FF7835', borderRadius: '10px', fontSize: '13px' }} /></form>
                <button tabIndex="0" onClick={() => setIsScanningKasir(!isScanningKasir)} style={{ padding: '10px', background: isScanningKasir ? '#ef4444' : '#272734', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px' }}>{isScanningKasir ? 'Tutup' : '📸 Kamera'}</button>
              </div>
              <div id="camera-popup-container" style={{ flex: 'none', background: '#272734', padding: '16px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center', display: isScanningKasir ? 'block' : 'none' }}>
                <div id="reader-kasir"></div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                  {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                    <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', border: p.stok < 50 ? '2px solid #fee2e2' : '2px solid transparent' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700' }}>{p.nama}</h3>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: p.hargaPromo ? '#e11d48' : '#0ea5e9' }}>
                        {p.hargaPromo && <span style={{textDecoration: 'line-through', fontSize: '10px', color: '#94a3b8', marginRight: '4px'}}>Rp{p.harga.toLocaleString()}</span>}
                        Rp {(p.hargaPromo || p.harga).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Stok: {p.stok} {p.satuan}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="kasir-right-panel" style={{ flex: '0 0 380px', background: 'white', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 20px', borderBottom: '2px solid #f1f5f9', background: '#fffaf5' }}><h2>🛒 Keranjang ({cart.length})</h2></div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ borderBottom: '1px dashed #e2e8f0', padding: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{fontWeight: 'bold', fontSize: '13px'}}>{item.nama}</span>
                      <button onClick={() => updateQuantity(item.id, 0)} style={{background: 'none', border: 'none', color: 'red'}}>×</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{color: '#FF7835', fontWeight: '900'}}>Rp {(item.harga * item.qty).toLocaleString()}</span>
                      <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                        <button onClick={() => updateQuantity(item.id, item.qty - 1)} style={{padding: '4px 8px', border: 'none'}}>-</button>
                        <span style={{padding: '4px 10px', fontWeight: 'bold'}}>{item.qty}</span>
                        <button onClick={() => addToCart(item)} style={{padding: '4px 8px', border: 'none', background: '#FF7835', color: 'white'}}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px 20px', background: '#fffaf5', borderTop: '2px solid #fed7aa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Total:</span><span style={{ fontSize: '20px', fontWeight: '900' }}>Rp {totalAmount.toLocaleString()}</span></div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>{['Tunai', 'QRIS', 'Transfer', 'Bon'].map(m => <button key={m} onClick={() => { setMetodePembayaran(m); if(m!=='Tunai' && m!=='Bon') setPaymentAmount(totalAmount); else setPaymentAmount(''); }} style={{ flex: 1, padding: '8px 2px', borderRadius: '8px', background: metodePembayaran === m ? '#FF7835' : 'white', color: metodePembayaran === m ? 'white' : '#27274F', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 'bold' }}>{m}</button>)}</div>
                {metodePembayaran === 'Tunai' && <input type="number" placeholder="Nominal Uang (Rp)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '16px', fontWeight: 'bold' }} />}
                <button onClick={processPayment} style={{ width: '100%', padding: '14px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', marginTop: '10px' }}>BAYAR & CETAK</button>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB PRODUK --- */}
        {activeTab === 'toko' && (
          <div className="desktop-row-mobile-col mobile-reverse" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px' }}>
            <div className="table-section" style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '16px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3>📦 Produk</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ padding: '8px', borderRadius: '8px' }}><option value="terbaru">Baru</option><option value="az">A-Z</option></select>
                  {selectedProducts.length > 0 && <button onClick={() => { setPrintData(produk.filter(p => selectedProducts.includes(p.id))); setPrintMode('label'); }} style={{ background: '#0ea5e9', color: 'white', padding: '8px', borderRadius: '8px' }}>Cetak ({selectedProducts.length})</button>}
                  <button onClick={() => { setPrintData(produk); setPrintMode('label'); }} style={{ background: '#FF7835', color: 'white', padding: '8px', borderRadius: '8px' }}>Cetak Semua</button>
                </div>
              </div>
              <table style={{ width: '100%', textAlign: 'left', fontSize: '13px' }}>
                <thead><tr style={{ background: '#fff7ed' }}><th>☑️</th><th>Nama</th><th>Harga</th><th>Stok</th><th>Aksi</th></tr></thead>
                <tbody>{sortedProduk.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td><input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={() => toggleSelectProduct(p.id)} /></td>
                    <td style={{fontWeight: 'bold'}}>{p.nama}</td>
                    <td>{p.hargaPromo ? <span><del style={{fontSize: '10px'}}>Rp{p.harga}</del> <br/><b>Rp{p.hargaPromo}</b></span> : `Rp${p.harga}`}</td>
                    <td>{p.stok} {p.satuan}</td>
                    <td><button onClick={() => { setNamaProd(p.nama); setHargaProd(p.harga); setHargaPromoProd(p.hargaPromo || ''); setStokProd(p.stok); setBarcodeProd(p.barcode); setSatuanProd(p.satuan || 'Pcs'); setEditingProductId(p.id); }} style={{background:'#272734', color:'white', border:'none', padding:'4px 8px', borderRadius:'4px', marginRight:'4px'}}>Edit</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="form-section sticky-box" style={{ flex: '0 0 320px', background: 'white', padding: '20px', borderRadius: '16px', overflowY: 'auto' }}>
              <form onSubmit={simpanProduk}>
                <h3>{editingProductId ? '✏️ Edit' : '➕ Tambah'} Produk</h3>
                <label>Nama Produk</label><input value={namaProd} onChange={e => setNamaProd(e.target.value)} required />
                <div style={{display:'flex', gap:'8px'}}><div style={{flex:1}}><label>Normal (Rp)</label><input type="number" value={hargaProd} onChange={e => setHargaProd(e.target.value)} required /></div><div style={{flex:1}}><label>Promo (Rp)</label><input type="number" value={hargaPromoProd} onChange={e => setHargaPromoProd(e.target.value)} placeholder="Opsional" style={{background:'#fef08a'}} /></div></div>
                <label>Stok Awal</label><div style={{display:'flex', gap:'4px'}}><input type="number" value={stokProd} onChange={e => setStokProd(e.target.value)} required style={{width:'60%'}} /><select value={satuanProd} onChange={e => setSatuanProd(e.target.value)} style={{width:'40%'}}><option value="Pcs">Pcs</option><option value="Kg">Kg</option><option value="Liter">Liter</option><option value="Box">Box</option></select></div>
                <label>Barcode</label><div style={{display:'flex', gap:'4px'}}><input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Otomatis" style={{flex:1}} /><button type="button" onClick={() => setIsScanningToko(!isScanningToko)} style={{background: isScanningToko ? 'red' : '#272734', color:'white', border:'none', borderRadius:'8px', padding:'0 10px'}}>{isScanningToko ? 'X' : '📸'}</button></div>
                <div id="reader-toko" style={{display: isScanningToko ? 'block' : 'none', marginTop: '10px'}}></div>
                <button type="submit" style={{ width: '100%', padding: '12px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '20px' }}>SIMPAN</button>
              </form>
            </div>
          </div>
        )}

        {/* TAB LAIN (PENGELUARAN & LAPORAN) TETAP SAMA SEPERTI VERSI SEBELUMNYA */}
        {activeTab === 'pengeluaran' && (
           <div className="desktop-row-mobile-col mobile-reverse" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px' }}>
           <div className="table-section" style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '16px', overflowY: 'auto' }}>
             <h3>💸 Riwayat Pengeluaran</h3>
             <table style={{ width: '100%', textAlign: 'left', fontSize: '13px', marginTop: '10px' }}>
               <thead><tr style={{ background: '#f8fafc' }}><th>Waktu</th><th>Keterangan</th><th>Nominal</th><th>Aksi</th></tr></thead>
               <tbody>{pengeluaran.map(p => (
                 <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                   <td>{p.waktu?.toDate ? p.waktu.toDate().toLocaleString('id-ID') : '-'}</td>
                   <td style={{fontWeight: 'bold'}}>{p.nama}</td>
                   <td style={{color: 'red'}}>- Rp {p.nominal.toLocaleString()}</td>
                   <td><button onClick={() => deleteDoc(doc(db, "pengeluaran", p.id))} style={{background: '#fee2e2', border: 'none', color: 'red', borderRadius: '4px', padding: '4px 8px'}}>Hapus</button></td>
                 </tr>
               ))}</tbody>
             </table>
           </div>
           <div className="form-section sticky-box" style={{ flex: '0 0 320px', background: 'white', padding: '20px', borderRadius: '16px' }}>
             <form onSubmit={simpanPengeluaran}>
               <h3 style={{color: '#e11d48'}}>➖ Catat Pengeluaran</h3>
               <label>Keterangan</label><input value={namaPengeluaran} onChange={e => setNamaPengeluaran(e.target.value)} required />
               <label>Nominal (Rp)</label><input type="number" value={nominalPengeluaran} onChange={e => setNominalPengeluaran(e.target.value)} required />
               <button type="submit" style={{ width: '100%', padding: '14px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '10px' }}>SIMPAN</button>
             </form>
           </div>
         </div>
        )}

        {activeTab === 'laporan' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap' }}>
              <h2>📋 Laporan</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setLaporanTab('transaksi')} style={{ padding: '8px 16px', background: laporanTab === 'transaksi' ? '#272734' : '#f1f5f9', color: laporanTab === 'transaksi' ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Transaksi</button>
                <button onClick={() => setLaporanTab('bon')} style={{ padding: '8px 16px', background: laporanTab === 'bon' ? '#FF7835' : '#f1f5f9', color: laporanTab === 'bon' ? 'white' : '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Buku Bon</button>
                <button onClick={exportExcel} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px' }}>📥 Excel</button>
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: '16px', flex: 1, overflowY: 'auto' }}>
              {displayedLaporan.map(t => (
                <div key={t.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{fontSize: '11px', color: '#64748b'}}>{t.waktu?.toDate ? t.waktu.toDate().toLocaleString('id-ID') : '-'}</div>
                    {t.metode === 'Bon' && <div style={{fontWeight: '900'}}>👤 {t.namaPelanggan} <span style={{fontSize: '10px', padding: '2px 6px', background: t.statusBon === 'Lunas' ? '#dcfce7' : '#fee2e2', color: t.statusBon === 'Lunas' ? 'green' : 'red', borderRadius: '4px'}}>{t.statusBon}</span></div>}
                    <div style={{fontSize: '13px', fontWeight: 'bold'}}>{t.items.map(i => `${i.qty} ${i.nama}`).join(', ')}</div>
                  </div>
                  <div style={{textAlign: 'right'}}>
                    <div style={{color: '#FF7835', fontWeight: '900', fontSize: '16px'}}>Rp {t.total.toLocaleString()}</div>
                    <div style={{display: 'flex', gap: '4px', justifyContent: 'flex-end'}}>
                      {t.metode === 'Bon' && t.statusBon !== 'Lunas' && <button onClick={() => updateDoc(doc(db, "transaksi", t.id), { statusBon: 'Lunas' })} style={{background: '#10b981', border: 'none', color: 'white', borderRadius: '4px', fontSize: '10px', padding: '4px 8px'}}>LUNAS</button>}
                      <button onClick={() => setStrukData(t)} style={{background: '#272734', border: 'none', color: 'white', borderRadius: '4px', fontSize: '10px', padding: '4px 8px'}}>PRINT</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* --- MODAL EDIT PROFIL TOKO & UKURAN LABEL --- */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '450px', maxHeight: '95vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>⚙️ Profil & Label</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                {/* --- REVISI: TOMBOL BANTUAN (?) --- */}
                <button onClick={() => setShowHelpModal(true)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>?</button>
                <button onClick={() => setShowProfileModal(false)} style={{ background: '#fee2e2', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: 'red' }}>×</button>
              </div>
            </div>
            
            <label>Nama Toko</label><input value={namaToko} onChange={e => setNamaToko(e.target.value)} />
            <label>Alamat</label><input value={alamat} onChange={e => setAlamat(e.target.value)} />
            <label>WhatsApp</label><input value={noTelp} onChange={e => setNoTelp(e.target.value)} />
            
            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <p style={{fontWeight: 'bold', fontSize: '13px', marginBottom: '10px'}}>📏 Pengaturan Kertas Label (mm/px)</p>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                <div><label style={{fontSize: '11px'}}>Lebar</label><input type="number" value={labelWidth} onChange={e => setLabelWidth(e.target.value)} style={{marginBottom: 0}} /></div>
                <div><label style={{fontSize: '11px'}}>Tinggi</label><input type="number" value={labelHeight} onChange={e => setLabelHeight(e.target.value)} style={{marginBottom: 0}} /></div>
                <div><label style={{fontSize: '11px'}}>Sekat/Gap</label><input type="number" value={labelGap} onChange={e => setLabelGap(e.target.value)} style={{marginBottom: 0}} /></div>
                <div><label style={{fontSize: '11px'}}>Jumlah Kolom</label><input type="number" value={labelCols} onChange={e => setLabelColumns(e.target.value)} style={{marginBottom: 0}} /></div>
              </div>
              <div style={{marginTop:'15px'}}><label style={{fontSize: '11px'}}>Skala Isi Label (%)</label><input type="number" value={labelScale} onChange={e => setLabelScale(e.target.value)} style={{marginBottom: 0}} /></div>
            </div>

            <button onClick={simpanProfil} style={{ width: '100%', padding: '14px', background: '#272734', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', marginTop: '20px' }}>SIMPAN PERUBAHAN</button>
          </div>
        </div>
      )}

      {/* --- REVISI: MODAL PUSAT BANTUAN (FAQ ACCORDION) --- */}
      {showHelpModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '20px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>📖 Pusat Bantuan</h3>
              <button onClick={() => setShowHelpModal(false)} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <details style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <summary style={{ fontWeight: 'bold', cursor: 'pointer' }}>1. Cara Transaksi & Kasir</summary>
              <p style={{ fontSize: '13px', color: '#444', marginTop: '5px' }}>Gunakan tombol kamera atau scan manual barcode. Ubah jumlah barang di keranjang. Klik "Bayar" lalu pilih metode bayar. Untuk struk otomatis, pastikan printer thermal sudah tersambung.</p>
            </details>
            
            <details style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <summary style={{ fontWeight: 'bold', cursor: 'pointer' }}>2. Cara Tambah Produk & Promo</summary>
              <p style={{ fontSize: '13px', color: '#444', marginTop: '5px' }}>Isi nama, harga normal, dan stok. Harga promo bersifat opsional. Jika diisi, kasir akan otomatis menggunakan harga promo dan label barcode akan berubah warna kuning.</p>
            </details>
            
            <details style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <summary style={{ fontWeight: 'bold', cursor: 'pointer' }}>3. Panduan Cetak Label (PENTING)</summary>
              <p style={{ fontSize: '13px', color: '#444', marginTop: '5px' }}>
                - **Kertas A4 Biasa:** Biarkan settingan 185x95, kolom 4, sekat 5.<br/>
                - **Stiker Thermal Roll:** Masukkan ukuran stiker asli. Jika konten meluber, turunkan **"Skala Isi Label"** (misal 70%).<br/>
                - **Sekat/Gap:** Beri angka (px) untuk memberi jarak antar stiker agar tidak mepet potongan kertas.
              </p>
            </details>

            <details style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <summary style={{ fontWeight: 'bold', cursor: 'pointer' }}>4. Laporan & Buku Bon</summary>
              <p style={{ fontSize: '13px', color: '#444', marginTop: '5px' }}>Semua transaksi tersimpan di Laporan. Khusus pembayaran "Bon", akan masuk ke Buku Bon. Klik tombol "Lunas" di laporan jika pelanggan sudah membayar tagihan.</p>
            </details>

            <button onClick={() => setShowHelpModal(false)} style={{ width: '100%', padding: '12px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '10px', marginTop: '10px', fontWeight: 'bold' }}>SAYA MENGERTI</button>
          </div>
        </div>
      )}

      {/* --- STRUK AREA & MODAL LAIN --- */}
      {showBonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.85)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
            <h2>📝 Catat Bon</h2>
            <label>Nama Pelanggan / WA</label>
            <input autoFocus value={namaPelangganBon} onChange={e => setNamaPelangganBon(e.target.value)} placeholder="Contoh: Pak Budi" style={{width: '100%', padding: '15px', borderRadius: '12px', border: '2px solid #cbd5e1', fontSize: '16px'}} />
            <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
               <button onClick={() => {setShowBonModal(false); setMetodePembayaran('Tunai');}} style={{flex:1, padding:'15px', borderRadius:'12px', background:'#f1f5f9', border:'none'}}>BATAL</button>
               <button onClick={() => finalizePayment('Bon')} style={{flex:2, padding:'15px', borderRadius:'12px', background:'#FF7835', color:'white', border:'none', fontWeight:'bold'}}>SIMPAN BON</button>
            </div>
          </div>
        </div>
      )}

      {strukData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div id="strukArea" style={{ background: '#fff', width: '320px', padding: '24px', textAlign: 'center', color: '#000', fontFamily: 'monospace' }}>
            <h2 style={{ margin: '0' }}>{namaToko || 'STRUK'}</h2>
            <p style={{ fontSize: '11px' }}>{alamat}<br/>WA: {noTelp}</p>
            <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
            {strukData.items.map((it, i) => (
              <div key={i} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>{it.qty} {it.nama}</span>
                  <span>{(it.harga * it.qty).toLocaleString()}</span>
                </div>
                {it.hargaAsli > it.harga && (
                  <div style={{ fontSize: '10px', textAlign: 'left', color: '#666' }}>
                    <del>Rp{it.hargaAsli.toLocaleString()}</del> (Harga Promo)
                  </div>
                )}
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}><span>TOTAL</span><span>Rp {strukData.total.toLocaleString()}</span></div>
            <div style={{ marginTop: '15px', fontSize: '12px' }}>*** TERIMA KASIH ***</div>
            <button className="no-print" onClick={() => setStrukData(null)} style={{ marginTop: '20px', padding: '10px 20px', background:'#f1f5f9', border:'none', borderRadius:'8px' }}>TUTUP</button>
          </div>
        </div>
      )}

      {/* --- REVISI CETAK LABEL: LAYOUT GRID DENGAN SEKAT & SKALA KUSTOM --- */}
      {printMode === 'label' && printData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 9999, overflowY: 'auto' }}>
          <div className="no-print" style={{ textAlign: 'center', padding: '15px', background: '#272734', position: 'sticky', top: 0 }}>
            <button onClick={() => window.print()} style={{ background: '#FF7835', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>🖨️ PRINT LABEL</button>
            <button onClick={() => setPrintMode(null)} style={{ background: 'white', padding: '12px 24px', border: 'none', borderRadius: '10px', marginLeft: '10px' }}>TUTUP</button>
          </div>
          
          <div id="print-area" style={{ 
              background: '#fff', 
              padding: '10px', 
              display: 'grid', 
              gridTemplateColumns: `repeat(${labelCols}, auto)`, 
              gap: `${labelGap}px`, 
              justifyContent: 'center'
          }}>
            {printData.map((p, i) => (
              <div key={i} style={{ 
                border: '1px dashed #000', 
                width: `${labelWidth}px`, 
                height: `${labelHeight}px`, 
                display: 'flex', 
                background: p.hargaPromo ? '#fef08a' : '#fff', 
                boxSizing: 'border-box', 
                overflow: 'hidden',
                position: 'relative'
              }}>
                {/* --- CONTAINER SKALA (ZOOM) --- */}
                <div style={{ 
                    display: 'flex', 
                    width: '100%', 
                    height: '100%', 
                    transform: `scale(${labelScale / 100})`, 
                    transformOrigin: 'center center' 
                }}>
                  <div style={{ width: '25px', borderRight: '1px dashed #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', textAlign:'center', maxHeight:'100%' }}>{namaToko || 'TOKO'}</div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '3px', justifyContent: 'space-between' }}>
                    <div style={{ height: '30px', fontSize: '10px', fontWeight: 'bold', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{p.nama}</div>
                    <div style={{ flex: 1, textAlign: 'center', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                      <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${p.barcode}&scale=1&height=6`} style={{ width: '90%', height: '25px', margin:'0 auto' }} />
                      <div style={{ fontSize: '8px', fontFamily: 'monospace' }}>{p.barcode}</div>
                    </div>
                    <div style={{ height: '28px', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      {p.hargaPromo && <span style={{ fontSize: '8px', textDecoration: 'line-through' }}>Rp{p.harga.toLocaleString()}</span>}
                      <div style={{ fontSize: '15px', fontWeight: '900' }}>Rp{(p.hargaPromo || p.harga).toLocaleString()}/<span style={{fontSize:'9px'}}>{p.satuan}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NAVIGASI BAWAH */}
      <nav className="no-print" style={{ flex: 'none', height: '65px', background: '#fff3e0', borderTop: '2px solid #ffd54f', display: 'flex', padding: '0', zIndex: 10 }}>
        {[ { id: 'dashboard', label: 'Dashboard', icon: '📊' }, { id: 'kasir', label: 'Kasir', icon: '💰' }, { id: 'toko', label: 'Produk', icon: '📦' }, { id: 'pengeluaran', label: 'Arus Kas', icon: '💸' }, { id: 'laporan', label: 'Laporan', icon: '📉' } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, border: 'none', background: 'transparent', color: activeTab === tab.id ? '#FF7835' : '#9ca3af', fontSize: activeTab === tab.id ? '13px' : '11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{fontSize: '20px'}}>{tab.icon}</span><span style={{fontWeight: 'bold'}}>{tab.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        @media print { .no-print { display: none !important; } body * { visibility: hidden; } #strukArea, #strukArea * { visibility: visible; } #strukArea { position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 100%; } #print-area, #print-area * { visibility: visible; } #print-area { position: absolute; left: 0; top: 0; width: 100%; display: grid !important; } }
        input, select { width: 100%; padding: 10px; border: 1px solid #cbd5e1; borderRadius: 8px; margin-bottom: 12px; outline: none; font-family: inherit; }
        label { font-size: 11px; font-weight: bold; color: #475569; display: block; margin-bottom: 3px; }
        
        @media (max-width: 768px) {
          .header-title { font-size: 16px !important; }
          .live-clock { display: none !important; }
          .desktop-row-mobile-col { flex-direction: column !important; overflow-y: auto !important; padding-bottom: 80px !important; }
          .mobile-reverse { flex-direction: column-reverse !important; justify-content: flex-end !important; }
          .kasir-left-panel { height: 35vh !important; flex: none !important; border-bottom: 2px solid #e2e8f0; }
          .kasir-right-panel { height: auto !important; flex: none !important; }
          .table-section { min-height: 40vh !important; flex: 1 !important; }
          .form-section { max-height: 42vh !important; overflow-y: auto !important; flex: none !important; }
          
          #reader-kasir, #reader-toko { 
            width: 100% !important; 
            height: 200px !important; 
            border-radius: 8px !important; 
            overflow: hidden !important; 
            border: 2px solid #FF7835 !important; 
            position: relative !important;
            background: black !important;
          }
          #reader-kasir video, #reader-toko video { 
            object-fit: cover !important; 
            width: 100% !important; 
            height: 100% !important; 
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default App;