import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
// MENGGUNAKAN MODE OFFLINE MODERN
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

// DATABASE DENGAN CACHE OFFLINE (AGAR DATA TIDAK HILANG SAAT INTERNET MATI)
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

  // STATE UNTUK STATUS INTERNET (ONLINE/OFFLINE)
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);

  const [currentTime, setCurrentTime] = useState(new Date());
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
  const [showQrisModal, setShowQrisModal] = useState(false);
  
  const [strukData, setStrukData] = useState(null);
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');
  const [qrisImage, setQrisImage] = useState(''); 
  
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');
  const [satuanProd, setSatuanProd] = useState('Pcs'); 
  const [editingProductId, setEditingProductId] = useState(null);

  const [namaPengeluaran, setNamaPengeluaran] = useState('');
  const [nominalPengeluaran, setNominalPengeluaran] = useState('');

  const [reportFilter, setReportFilter] = useState('hari');
  const [chartFilter, setChartFilter] = useState('hari'); 
  const [dashboardStats, setDashboardStats] = useState({ todaySales: 0, totalProducts: 0, lowStock: 0, totalPengeluaran: 0, labaBersih: 0 });

  // MONITORING STATUS INTERNET SECARA REAL-TIME
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(timer);
    };
  }, []);

  // NAVIGASI KEYBOARD
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
        if (nextIndex !== currentIndex && focusableElements[nextIndex]) focusableElements[nextIndex].focus();
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
      }
    });
    const unsubProduk = onSnapshot(query(collection(db, "produk"), where("userId", "==", user.uid)), (snap) => {
      setProduk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const qTrans = query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc"), limit(500));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.waktu?.toMillis ? b.waktu.toMillis() : Date.now()) - (a.waktu?.toMillis ? a.waktu.toMillis() : Date.now()));
      setTransaksi(data);
    });
    const qPeng = query(collection(db, "pengeluaran"), where("userId", "==", user.uid), orderBy("waktu", "desc"), limit(500));
    const unsubPengeluaran = onSnapshot(qPeng, (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.waktu?.toMillis ? b.waktu.toMillis() : Date.now()) - (a.waktu?.toMillis ? a.waktu.toMillis() : Date.now()));
      setPengeluaran(data);
    });
    return () => { unsubProduk(); unsubTrans(); unsubPengeluaran(); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const todayTrans = transaksi.filter(t => {
        if(!t.waktu) return false;
        const d = t.waktu.toDate ? t.waktu.toDate() : new Date(t.waktu);
        return d.toISOString().split('T')[0] === today;
    });
    const todayPeng = pengeluaran.filter(p => {
        if(!p.waktu) return false;
        const d = p.waktu.toDate ? p.waktu.toDate() : new Date(p.waktu);
        return d.toISOString().split('T')[0] === today;
    });
    const omzetHariIni = todayTrans.filter(t => t.metode !== 'Bon' || t.statusBon === 'Lunas').reduce((sum, t) => sum + t.total, 0);
    const pengeluaranHariIni = todayPeng.reduce((sum, p) => sum + p.nominal, 0);
    setDashboardStats({ totalProducts: produk.length, lowStock: produk.filter(p => p.stok < 50).length, todaySales: omzetHariIni, totalPengeluaran: pengeluaranHariIni, labaBersih: omzetHariIni - pengeluaranHariIni });
  }, [produk, transaksi, pengeluaran, user]);

  useEffect(() => {
    let html5QrCode;
    const scannerId = isScanningKasir ? "reader-kasir" : (isScanningToko ? "reader-toko" : null);
    if (scannerId) {
      html5QrCode = new Html5Qrcode(scannerId);
      html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (decodedText) => {
          if (isScanningKasir) {
            const found = produk.find(p => p.barcode === decodedText);
            if (found) { addToCart(found); setIsScanningKasir(false); } 
            else { alert('❌ Barcode tidak terdaftar!'); setIsScanningKasir(false); }
          } else { setBarcodeProd(decodedText); setIsScanningToko(false); }
          html5QrCode.stop();
        }, () => {}
      ).catch(() => { setIsScanningKasir(false); setIsScanningToko(false); });
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(console.error); };
  }, [isScanningKasir, isScanningToko, produk]);

  useEffect(() => { if (strukData) setTimeout(() => { window.print(); }, 800); }, [strukData]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setQrisImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try { setLoading(true); if (isRegister) await createUserWithEmailAndPassword(auth, email, password); else await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { alert('Gagal: ' + err.message); } finally { setLoading(false); }
  };

  const handleManualScan = (e) => {
    e.preventDefault();
    const found = produk.find(p => p.barcode === barcodeInput || p.barcode === String(barcodeInput));
    if (found) { addToCart(found); setBarcodeInput(''); } else { alert('Barcode tidak ditemukan!'); setBarcodeInput(''); }
  };

  const addToCart = (p) => {
    if (p.stok <= 0) return alert("Stok habis!");
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        if(existing.qty >= p.stok) { alert("Stok tidak mencukupi!"); return prev; }
        return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const updateQuantity = (id, newQty) => {
    if (newQty <= 0) { setCart(prev => prev.filter(item => item.id !== id)); return; }
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        if(newQty > item.stok) { alert(`Stok sisa ${item.stok}!`); return { ...item, qty: item.stok }; }
        return { ...item, qty: newQty };
      }
      return item;
    }));
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
      userId: user.uid, items: cart.map(i => ({nama: i.nama, harga: i.harga, qty: i.qty, satuan: i.satuan || 'Pcs'})),
      total: totalAmount, uangBayar: finalUangBayar, kembalian: kembalian, metode: metode, waktu: new Date()
    };
    if (metode === 'Bon') {
      if (!namaPelangganBon.trim()) return alert("Nama pelanggan wajib diisi!");
      dataTrans.namaPelanggan = namaPelangganBon; dataTrans.statusBon = 'Belum Lunas';
    }
    try {
      addDoc(collection(db, "transaksi"), dataTrans);
      for (const item of cart) updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) });
      setStrukData(dataTrans); setCart([]); setPaymentAmount(''); setMetodePembayaran('Tunai'); 
      setShowQrisModal(false); setShowBonModal(false); setNamaPelangganBon('');
    } catch (err) { alert("Gagal transaksi"); }
  };

  const simpanProduk = (e) => {
    e.preventDefault();
    if (editingProductId) {
      updateDoc(doc(db, "produk", editingProductId), { nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: barcodeProd, satuan: satuanProd });
      setEditingProductId(null);
    } else {
      const bcode = barcodeProd || Math.floor(100000000000 + Math.random() * 900000000000).toString();
      addDoc(collection(db, "produk"), { nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: bcode, satuan: satuanProd, userId: user.uid, createdAt: new Date() });
    }
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd(''); setSatuanProd('Pcs');
  };

  const simpanPengeluaran = (e) => {
    e.preventDefault();
    addDoc(collection(db, "pengeluaran"), { nama: namaPengeluaran, nominal: Number(nominalPengeluaran), userId: user.uid, waktu: new Date() });
    setNamaPengeluaran(''); setNominalPengeluaran(''); 
  };

  const simpanProfil = () => {
    setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp, qrisImage });
    alert("Profil Tersimpan!"); setShowProfileModal(false);
  };

  const handleResetTahunan = async () => {
    if (!window.confirm(`⚠️ Yakin ingin menghapus SEMUA transaksi tahun ${selectedYearReset}?`)) return;
    const start = new Date(`${selectedYearReset}-01-01T00:00:00`);
    const end = new Date(`${selectedYearReset}-12-31T23:59:59`);
    try {
      const qReset = query(collection(db, "transaksi"), where("userId", "==", user.uid), where("waktu", ">=", start), where("waktu", "<=", end));
      const snap = await getDocs(qReset);
      if (snap.empty) return alert(`Tidak ada data di tahun ${selectedYearReset}.`);
      for (const d of snap.docs) deleteDoc(doc(db, "transaksi", d.id));
      alert(`Berhasil menghapus data tahun ${selectedYearReset}.`);
      setShowResetModal(false);
    } catch (e) { alert("Gagal menghapus data."); }
  };

  const filteredTransaksi = transaksi.filter(t => {
    if (!t.waktu) return false;
    const cari = searchLaporan.toLowerCase();
    const matchCari = cari === '' || t.items.some(i => i.nama.toLowerCase().includes(cari)) || (t.metode && t.metode.toLowerCase().includes(cari)) || (t.namaPelanggan && t.namaPelanggan.toLowerCase().includes(cari));
    if (!matchCari) return false;
    const dateObj = t.waktu.toDate ? t.waktu.toDate() : new Date(t.waktu); const today = new Date();
    if (reportFilter === 'hari') return dateObj.toDateString() === today.toDateString();
    else if (reportFilter === 'minggu') return dateObj >= new Date(today.setDate(today.getDate() - today.getDay()));
    else if (reportFilter === 'bulan') return dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
    return true;
  });

  const displayedLaporan = laporanTab === 'bon' ? filteredTransaksi.filter(t => t.metode === 'Bon' && t.statusBon !== 'Lunas') : filteredTransaksi;

  const exportExcel = () => {
    const headers = ["Tanggal,Jam,Metode Pembayaran,Nama Pelanggan (Bon),Status Bon,Item,Total,Tunai,Kembali"];
    const rows = displayedLaporan.map(t => {
      const d = t.waktu?.toDate ? t.waktu.toDate() : new Date(t.waktu);
      const items = t.items.map(i => `${i.qty} ${i.satuan || 'Pcs'} ${i.nama}`).join(' + ');
      return `${d.toLocaleDateString('id-ID')},${d.toLocaleTimeString('id-ID')},${t.metode || 'Tunai'},"${t.namaPelanggan || '-'}","${t.statusBon || '-'}","${items}",${t.total},${t.uangBayar},${t.kembalian}`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + headers.concat(rows).join("\n")));
    link.setAttribute("download", `Laporan_Kasir.csv`);
    document.body.appendChild(link); link.click();
  };

  const getChartData = () => {
    let labels = []; let values = []; const now = new Date();
    for(let i=6; i>=0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      labels.push(`${d.getDate()}/${d.getMonth()+1}`); 
      values.push(transaksi.filter(t => {
          const dt = t.waktu?.toDate ? t.waktu.toDate() : new Date(t.waktu);
          return (t.metode !== 'Bon' || t.statusBon === 'Lunas') && dt.toDateString() === d.toDateString();
      }).reduce((s, t) => s + t.total, 0));
    }
    const max = Math.max(...values, 1);
    return { data: labels.map((l, i) => ({ label: l, total: values[i] })), max };
  };
  const chartData = getChartData();

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#FF7835' }}><strong>Memuat Sistem...</strong></div>;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#FF7835', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '24px', width: '100%', maxWidth: '400px' }}>
          <h1 style={{ textAlign: 'center', color: '#272734', margin: '0 0 30px 0' }}>POS MODERN PRO</h1>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '14px', marginBottom: '15px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '14px', marginBottom: '25px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
            <button type="submit" style={{ width: '100%', padding: '16px', background: '#272734', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{isRegister ? 'DAFTAR' : 'MASUK'}</button>
          </form>
          <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', color: '#FF7835', marginTop: '20px', textAlign: 'center', fontSize: '14px' }}>{isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: '#f8fafc', overflow: 'hidden' }}>
      
      {/* HEADER DINAMIS (RESPONSIVE HP & DESKTOP) */}
      <header className="no-print main-header">
        
        {/* SISI KIRI: INFO TOKO & KONEKSI */}
        <div className="header-left">
          <h1 className="store-name">{namaToko || 'POS MODERN PRO'}</h1>
          
          {/* HANYA MUNCUL DI HP: TANGGAL & STATUS KONEKSI */}
          <div className="mobile-only-info">
            <div className="date-subtitle">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
              <span className="led-blink"></span>
              {isOnline ? 'Sistem Terhubung' : 'Mode Offline (Lokal)'}
            </div>
          </div>

          {/* HANYA MUNCUL DI DESKTOP: STATUS KONEKSI ELEGAN */}
          <div className="desktop-status-pill">
            <div className={`status-pill-small ${isOnline ? 'online' : 'offline'}`}>
              <span className="led-blink"></span>
              {isOnline ? 'Terhubung' : 'Offline'}
            </div>
          </div>
        </div>

        {/* SISI KANAN: WAKTU (DESKTOP) & AKSI */}
        <div className="header-right">
          <div className="desktop-only-clock">
            <div className="date-text-top">{currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            <div className="time-text-top">{currentTime.toLocaleTimeString('id-ID')}</div>
          </div>
          <button onClick={() => setShowProfileModal(true)} className="profile-btn">👤</button>
          <button onClick={() => signOut(auth)} className="logout-btn">Logout</button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {activeTab === 'dashboard' && (
          <div style={{ padding: '20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div style={{ background: '#272734', color: 'white', padding: '20px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '5px' }}>Omzet Lunas Hari Ini</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF7835' }}>Rp {dashboardStats.todaySales.toLocaleString()}</div>
              </div>
              <div style={{ background: '#FF7835', color: 'white', padding: '20px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '5px' }}>Pengeluaran Hari Ini</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Rp {dashboardStats.totalPengeluaran.toLocaleString()}</div>
              </div>
              <div style={{ background: 'white', border: `2px solid ${dashboardStats.labaBersih >= 0 ? '#10b981' : '#ef4444'}`, padding: '20px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '5px' }}>Laba Bersih Hari Ini</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: dashboardStats.labaBersih >= 0 ? '#10b981' : '#ef4444' }}>Rp {Math.abs(dashboardStats.labaBersih).toLocaleString()}</div>
              </div>
            </div>
            <div style={{ background: 'white', padding: '25px', borderRadius: '20px', height: '320px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px' }}>📈 Grafik 7 Hari Terakhir</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', height: '220px', gap: '12px' }}>
                {chartData.data.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', background: 'linear-gradient(to top, #fdba74, #FF7835)', height: `${(d.total / chartData.max) * 100}%`, borderRadius: '6px 6px 0 0', minHeight: '5px' }}></div>
                    <div style={{ fontSize: '10px', marginTop: '8px', fontWeight: 'bold' }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kasir' && (
          <div style={{ display: 'flex', height: '100%', padding: '15px', gap: '15px', boxSizing: 'border-box' }} className="desktop-row-mobile-col">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <input placeholder="Cari barang..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
                <form onSubmit={handleManualScan} style={{ flex: 1 }}><input placeholder="Scan Barcode..." value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #FF7835' }} /></form>
                <button onClick={() => setIsScanningKasir(!isScanningKasir)} style={{ padding: '0 15px', background: '#272734', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>📸</button>
              </div>
              {isScanningKasir && <div id="reader-kasir" style={{ width: '100%', maxWidth: '300px', margin: '0 auto 15px', borderRadius: '10px', overflow: 'hidden' }}></div>}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                  {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                    <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', padding: '15px', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: p.stok < 50 ? '1px solid #fee2e2' : '1px solid transparent' }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#272734' }}>{p.nama}</div>
                      <div style={{ color: '#FF7835', fontWeight: '900', fontSize: '16px', margin: '5px 0' }}>Rp {p.harga.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: p.stok < 50 ? '#ef4444' : '#10b981', fontWeight: '800' }}>{p.stok} {p.satuan}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ flex: '0 0 380px', background: 'white', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '15px 20px', background: '#f8fafc', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>🛒 Keranjang ({cart.length})</div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '15px 20px' }}>
                {cart.map(i => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px dashed #eee', paddingBottom: '12px' }}>
                    <div><div style={{ fontSize: '13px', fontWeight: 'bold' }}>{i.nama}</div><div style={{ fontSize: '12px', color: '#FF7835', fontWeight: '700' }}>{i.qty} x {i.harga.toLocaleString()}</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => updateQuantity(i.id, i.qty - 1)} style={{ width: '28px', height: '28px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}>-</button>
                      <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{i.qty}</span>
                      <button onClick={() => addToCart(i)} style={{ width: '28px', height: '28px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '20px', background: '#fffaf5', borderTop: '2px solid #fed7aa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: '900', marginBottom: '15px' }}><span>Total:</span><span>Rp {totalAmount.toLocaleString()}</span></div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '15px' }}>
                  {['Tunai', 'QRIS', 'Transfer', 'Bon'].map(m => (
                    <button key={m} onClick={() => { setMetodePembayaran(m); setPaymentAmount(m === 'Tunai' ? '' : totalAmount); }} style={{ flex: 1, padding: '10px 0', fontSize: '11px', borderRadius: '8px', border: metodePembayaran === m ? 'none' : '1px solid #ddd', background: metodePembayaran === m ? '#FF7835' : 'white', color: metodePembayaran === m ? 'white' : '#272734', fontWeight: 'bold', cursor: 'pointer' }}>{m}</button>
                  ))}
                </div>
                {metodePembayaran === 'Tunai' && <input type="number" placeholder="Nominal Bayar" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #ddd', marginBottom: '15px', boxSizing: 'border-box', fontSize: '16px', fontWeight: 'bold' }} />}
                <button onClick={processPayment} style={{ width: '100%', padding: '16px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '900', cursor: 'pointer', fontSize: '15px' }}>BAYAR & CETAK</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'laporan' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '15px', boxSizing: 'border-box' }}>
            <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#272734' }}>📋 Laporan</h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setLaporanTab('transaksi')} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: laporanTab === 'transaksi' ? '#272734' : '#f1f5f9', color: laporanTab === 'transaksi' ? 'white' : '#64748b', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Semua</button>
                <button onClick={() => setLaporanTab('bon')} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: laporanTab === 'bon' ? '#FF7835' : '#f1f5f9', color: laporanTab === 'bon' ? 'white' : '#64748b', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Buku Bon</button>
                <button onClick={exportExcel} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>📥 Excel</button>
                <button onClick={() => setShowResetModal(true)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>🗑️ Reset</button>
              </div>
            </div>
            <div style={{ flex: 'none', display: 'flex', gap: '10px', marginBottom: '8px' }}>
              <input placeholder="Cari laporan..." value={searchLaporan} onChange={e => setSearchLaporan(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px' }} />
              <select value={reportFilter} onChange={e => setReportFilter(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px', fontWeight: 'bold' }}>
                <option value="hari">Hari Ini</option><option value="minggu">Minggu Ini</option><option value="bulan">Bulan Ini</option><option value="semua">Semua</option>
              </select>
            </div>
            <div style={{ padding: '6px 12px', background: '#fff7ed', color: '#ea580c', borderRadius: '6px', fontSize: '10px', fontWeight: '600', marginBottom: '8px', border: '1px solid #ffedd5' }}>
              💡 Menampilkan 500 data terbaru. Gunakan pencarian untuk data lama.
            </div>
            <div style={{ flex: 1, background: 'white', borderRadius: '16px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              {displayedLaporan.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Tidak ada data.</div> : 
                displayedLaporan.map(t => (
                <div key={t.id} style={{ padding: '8px 15px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>{t.waktu?.toDate ? t.waktu.toDate().toLocaleString('id-ID') : new Date(t.waktu).toLocaleString('id-ID')}</div>
                    {t.metode === 'Bon' && <div style={{ fontSize: '13px', fontWeight: '900', color: '#272734' }}>👤 {t.namaPelanggan} <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: t.statusBon === 'Lunas' ? '#dcfce7' : '#fee2e2', color: t.statusBon === 'Lunas' ? '#16a34a' : '#dc2626' }}>{t.statusBon}</span></div>}
                    <div style={{ fontSize: '10px', color: '#64748b', margin: '2px 0', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>{t.items.map(i => `${i.qty} ${i.nama}`).join(', ')}</div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: t.metode === 'Tunai' ? '#FF7835' : '#0ea5e9' }}>Metode: {t.metode}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: '#FF7835' }}>Rp {t.total.toLocaleString()}</div>
                    <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                      {t.metode === 'Bon' && t.statusBon === 'Belum Lunas' && <button onClick={() => { if(window.confirm('Tandai Lunas?')) updateDoc(doc(db, "transaksi", t.id), { statusBon: 'Lunas', waktuLunas: new Date() }); }} style={{ padding: '4px 10px', borderRadius: '6px', background: '#10b981', color: 'white', border: 'none', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}>LUNAS</button>}
                      <button onClick={() => setStrukData(t)} style={{ padding: '4px 10px', borderRadius: '6px', background: '#272734', color: 'white', border: 'none', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}>CETAK</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'toko' && (
          <div style={{ padding: '20px', display: 'flex', gap: '20px', height: '100%', boxSizing: 'border-box' }} className="desktop-row-mobile-col">
            <div style={{ flex: 1, background: 'white', padding: '25px', borderRadius: '20px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px 0' }}>📦 Daftar Produk Toko</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <tr><th style={{ padding: '12px' }}>Nama</th><th style={{ padding: '12px' }}>Harga</th><th style={{ padding: '12px' }}>Stok</th><th style={{ padding: '12px' }}>Aksi</th></tr>
                </thead>
                <tbody>
                  {produk.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.nama}</td>
                      <td style={{ padding: '12px', color: '#0ea5e9', fontWeight: 'bold' }}>Rp {p.harga.toLocaleString()}</td>
                      <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '6px', background: p.stok < 50 ? '#fee2e2' : '#dcfce7', color: p.stok < 50 ? '#dc2626' : '#16a34a', fontWeight: 'bold', fontSize: '11px' }}>{p.stok} {p.satuan}</span></td>
                      <td style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setEditingProductId(p.id); setNamaProd(p.nama); setHargaProd(p.harga); setStokProd(p.stok); setBarcodeProd(p.barcode); setSatuanProd(p.satuan); }} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#272734', color: 'white', cursor: 'pointer', fontSize: '11px' }}>Edit</button>
                        <button onClick={() => { if(window.confirm('Hapus produk?')) deleteDoc(doc(db, "produk", p.id)); }} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: '11px' }}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ flex: '0 0 340px' }}>
              <form onSubmit={simpanProduk} style={{ background: 'white', padding: '25px', borderRadius: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#FF7835' }}>{editingProductId ? '✏️ Edit' : '➕ Tambah'} Produk</h3>
                <input placeholder="Nama Produk" value={namaProd} onChange={e => setNamaProd(e.target.value)} required style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <input placeholder="Harga (Rp)" type="number" value={hargaProd} onChange={e => setHargaProd(e.target.value)} required style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
                  <input placeholder="Stok" type="number" value={stokProd} onChange={e => setStokProd(e.target.value)} required style={{ width: '80px', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
                </div>
                <input placeholder="Barcode (Opsional)" value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
                <button type="submit" style={{ width: '100%', padding: '14px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>SIMPAN PRODUK</button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'pengeluaran' && (
          <div style={{ padding: '20px', display: 'flex', gap: '20px', height: '100%', boxSizing: 'border-box' }} className="desktop-row-mobile-col">
            <div style={{ flex: 1, background: 'white', padding: '25px', borderRadius: '20px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px 0' }}>💸 Riwayat Pengeluaran</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <tr><th style={{ padding: '12px' }}>Waktu</th><th style={{ padding: '12px' }}>Keterangan</th><th style={{ padding: '12px' }}>Nominal</th><th style={{ padding: '12px' }}>Aksi</th></tr>
                </thead>
                <tbody>
                  {pengeluaran.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px' }}>{p.waktu?.toDate ? p.waktu.toDate().toLocaleString('id-ID') : new Date(p.waktu).toLocaleString('id-ID')}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.nama}</td>
                      <td style={{ padding: '12px', color: '#ef4444', fontWeight: 'bold' }}>- Rp {p.nominal.toLocaleString()}</td>
                      <td style={{ padding: '12px' }}><button onClick={() => { if(window.confirm('Hapus?')) deleteDoc(doc(db, "pengeluaran", p.id)); }} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: '11px' }}>Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ flex: '0 0 340px' }}>
              <form onSubmit={simpanPengeluaran} style={{ background: 'white', padding: '25px', borderRadius: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#ef4444' }}>➖ Catat Pengeluaran</h3>
                <input placeholder="Keterangan (Contoh: Listrik)" value={namaPengeluaran} onChange={e => setNamaPengeluaran(e.target.value)} required style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
                <input placeholder="Nominal (Rp)" type="number" value={nominalPengeluaran} onChange={e => setNominalPengeluaran(e.target.value)} required style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
                <button type="submit" style={{ width: '100%', padding: '14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>SIMPAN PENGELUARAN</button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* --- MODAL RESET TAHUNAN --- */}
      {showResetModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ color: '#ef4444' }}>⚠️ Hapus Data Tahunan</h3>
            <p className="warning-text">Data yang dihapus tidak dapat dikembalikan. Pastikan Anda sudah men-download Excel tahun tersebut.</p>
            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', margin: '15px 0 5px' }}>Pilih Tahun:</label>
            <select value={selectedYearReset} onChange={e => setSelectedYearReset(e.target.value)} className="modal-select">
              {Array.from({ length: 26 }, (_, i) => 2025 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowResetModal(false)} className="btn-cancel">BATAL</button>
              <button onClick={handleResetTahunan} className="btn-confirm">HAPUS PERMANEN</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL BON --- */}
      {showBonModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>📝 Catat Bon</h3>
            <p>Total Tagihan: <strong>Rp {totalAmount.toLocaleString()}</strong></p>
            <input autoFocus placeholder="Nama Pelanggan" value={namaPelangganBon} onChange={e => setNamaPelangganBon(e.target.value)} className="modal-input" />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowBonModal(false); setMetodePembayaran('Tunai'); }} className="btn-cancel">BATAL</button>
              <button onClick={() => finalizePayment('Bon')} className="btn-save">SIMPAN BON</button>
            </div>
          </div>
        </div>
      )}

      {/* --- STRUK AREA --- */}
      {strukData && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div id="strukArea" className="struk-paper">
            <h2>{namaToko || 'STRUK BELANJA'}</h2><p>{alamat}</p><div className="dashed-line"></div>
            <p style={{ textAlign: 'left', fontSize: '12px' }}>Tgl: {strukData.waktu instanceof Date ? strukData.waktu.toLocaleString('id-ID') : new Date(strukData.waktu).toLocaleString('id-ID')}</p>
            <p style={{ textAlign: 'left', fontSize: '12px' }}>Metode: {strukData.metode}</p>
            {strukData.metode === 'Bon' && <p style={{ textAlign: 'left', fontWeight: 'bold' }}>Plgn: {strukData.namaPelanggan}</p>}
            <div className="dashed-line"></div>
            {strukData.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                <span>{it.qty} {it.nama}</span><span>{(it.harga * it.qty).toLocaleString()}</span>
              </div>
            ))}
            <div className="dashed-line"></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}><span>TOTAL</span><span>Rp {strukData.total.toLocaleString()}</span></div>
            <div className="dashed-line"></div><p style={{ fontWeight: 'bold', marginTop: '10px' }}>*** TERIMA KASIH ***</p>
            <div className="no-print" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button onClick={() => window.print()} className="btn-print">Print</button>
              <button onClick={() => setStrukData(null)} className="btn-close">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT PROFIL --- */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3>⚙️ Pengaturan Toko</h3>
            <input placeholder="Nama Toko" value={namaToko} onChange={e => setNamaToko(e.target.value)} className="modal-input" />
            <input placeholder="Alamat Toko" value={alamat} onChange={e => setAlamat(e.target.value)} className="modal-input" />
            <input placeholder="WhatsApp Toko" value={noTelp} onChange={e => setNoTelp(e.target.value)} className="modal-input" />
            <div className="qris-upload">
              <label>Upload Gambar QRIS:</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ marginTop: '10px' }} />
              {qrisImage && <img src={qrisImage} alt="QRIS" className="qris-preview" />}
            </div>
            <button onClick={simpanProfil} className="btn-save-full">SIMPAN PENGATURAN</button>
            <button onClick={() => setShowProfileModal(false)} className="btn-close-text">TUTUP</button>
          </div>
        </div>
      )}

      {/* NAVIGASI BAWAH */}
      <nav className="no-print bottom-nav">
        {[ {id:'dashboard', icon:'📊', label:'Beranda'}, {id:'kasir', icon:'💰', label:'Kasir'}, {id:'toko', icon:'📦', label:'Produk'}, {id:'pengeluaran', icon:'💸', label:'Arus Kas'}, {id:'laporan', icon:'📉', label:'Laporan'} ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`nav-item ${activeTab === t.id ? 'active' : ''}`}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* CSS STYLING */}
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        
        /* HEADER STYLES */
        .main-header { flex: none; height: 75px; background: white; padding: 0 20px; display: flex; justify-content: space-between; alignItems: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); z-index: 50; }
        .header-left { display: flex; flexDirection: column; justifyContent: center; }
        .store-name { margin: 0; color: #FF7835; font-weight: 900; font-size: 20px; letter-spacing: -0.5px; }
        .header-right { display: flex; alignItems: center; gap: 10px; }
        
        /* STATUS PILL & ANIMATION */
        .status-pill { display: flex; alignItems: center; gap: 6px; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 20px; margin-top: 3px; width: fit-content; }
        .status-pill.online { background: #dcfce7; color: #16a34a; }
        .status-pill.offline { background: #fff7ed; color: #ea580c; }
        
        .status-pill-small { display: flex; alignItems: center; gap: 5px; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 10px; border: 1px solid #eee; }
        .status-pill-small.online { color: #16a34a; }
        .status-pill-small.offline { color: #ea580c; }

        .led-blink { width: 6px; height: 6px; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite; }
        .online .led-blink { background: #16a34a; box-shadow: 0 0 5px #16a34a; }
        .offline .led-blink { background: #ea580c; box-shadow: 0 0 5px #ea580c; }

        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

        /* RESPONSIVE HEADER */
        .mobile-only-info { display: none; }
        .desktop-status-pill { margin-top: 2px; }
        .date-subtitle { font-size: 11px; color: #64748b; font-weight: 600; }
        .date-text-top { font-size: 10px; color: #94a3b8; font-weight: 700; text-align: right; }
        .time-text-top { font-size: 16px; color: #272734; font-weight: 900; text-align: right; }

        @media (max-width: 768px) {
          .main-header { height: 95px; padding: 0 15px; }
          .store-name { font-size: 22px; line-height: 1; margin-bottom: 2px; }
          .mobile-only-info { display: block; }
          .desktop-only-clock, .desktop-status-pill { display: none; }
          .header-right { flex-direction: column-reverse; gap: 5px; align-items: flex-end; }
          .logout-btn { padding: 4px 8px !important; font-size: 10px !important; }
          .profile-btn { width: 32px !important; height: 32px !important; font-size: 14px !important; }
        }

        /* BTN STYLES */
        .profile-btn { background: #fff7ed; border: 1px solid #FF7835; border-radius: 50%; width: 38px; height: 38px; cursor: pointer; color: #FF7835; font-size: 18px; }
        .logout-btn { padding: 8px 12px; background: #fee2e2; color: #dc2626; border: none; borderRadius: 8px; font-weight: 800; cursor: pointer; font-size: 11px; }

        /* MODAL & OTHERS */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9000; display: flex; alignItems: center; justifyContent: center; padding: 20px; backdrop-filter: blur(5px); }
        .modal-content { background: white; padding: 30px; borderRadius: 20px; maxWidth: 400px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
        .modal-input { width: 100%; padding: 14px; margin-bottom: 15px; borderRadius: 12px; border: 1px solid #ddd; box-sizing: border-box; font-weight: bold; }
        .modal-select { width: 100%; padding: 14px; borderRadius: 12px; border: 2px solid #eee; margin-bottom: 20px; font-weight: bold; }
        .warning-text { font-size: 12px; color: #ef4444; background: #fee2e2; padding: 10px; borderRadius: 8px; font-weight: bold; }
        
        .btn-confirm { flex: 1; padding: 14px; borderRadius: 12px; border: none; background: #ef4444; color: white; font-weight: 900; cursor: pointer; }
        .btn-cancel { flex: 1; padding: 14px; borderRadius: 12px; border: none; background: #f1f5f9; color: #64748b; font-weight: 900; cursor: pointer; }
        .btn-save { flex: 1; padding: 14px; borderRadius: 12px; border: none; background: #FF7835; color: white; font-weight: 900; cursor: pointer; }
        .btn-save-full { width: 100%; padding: 15px; background: #272734; color: white; border: none; borderRadius: 12px; font-weight: 900; cursor: pointer; margin-top: 10px; }
        .btn-close-text { width: 100%; background: none; border: none; color: #94a3b8; font-weight: bold; margin-top: 15px; cursor: pointer; }

        /* STRUK */
        .struk-paper { background: white; width: 300px; padding: 25px; font-family: monospace; text-align: center; color: black; }
        .dashed-line { border-top: 1px dashed black; margin: 10px 0; }
        .btn-print { flex: 1; padding: 12px; background: #FF7835; color: white; border: none; borderRadius: 8px; font-weight: bold; }
        .btn-close { flex: 1; padding: 12px; background: #eee; border: none; borderRadius: 8px; font-weight: bold; }
        .qris-preview { max-width: 100%; height: auto; border-radius: 12px; margin-top: 15px; border: 1px solid #eee; }

        /* BOTTOM NAV */
        .bottom-nav { height: 70px; background: #fff3e0; border-top: 2px solid #ffd54f; display: flex; padding: 0 5px; }
        .nav-item { flex: 1; border: none; background: none; display: flex; flexDirection: column; alignItems: center; justifyContent: center; cursor: pointer; color: #94a3b8; gap: 4px; }
        .nav-item.active { color: #FF7835; }
        .nav-icon { fontSize: 20px; }
        .nav-label { fontSize: 10px; fontWeight: 800; }

        @media print { .no-print { display: none !important; } body * { visibility: hidden; } #strukArea, #strukArea * { visibility: visible; } #strukArea { position: absolute; left: 0; top: 0; width: 100%; } }
        @media (max-width: 768px) { .desktop-row-mobile-col { flex-direction: column !important; overflow-y: auto; } }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #FF7835; borderRadius: 10px; }
      `}</style>
    </div>
  );
}

export default App;