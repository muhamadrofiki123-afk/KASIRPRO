import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
// --- REVISI: IMPORT SISTEM OFFLINE VERSI TERBARU DAN PALING KUAT ---
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

// --- REVISI: MENGGUNAKAN MODE OFFLINE MODERN ---
// Ini menjamin aplikasi bisa dipakai berjualan tanpa internet dengan sangat lancar
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

  // WAKTU & TANGGAL LIVE SEKARANG
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
  
  // STATE BARU UNTUK FITUR BON & LAPORAN
  const [laporanTab, setLaporanTab] = useState('transaksi'); 
  const [showBonModal, setShowBonModal] = useState(false);
  const [namaPelangganBon, setNamaPelangganBon] = useState('');

  // STATE UNTUK FITUR HAPUS DATA TAHUNAN
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
  const [printMode, setPrintMode] = useState(null);
  const [printData, setPrintData] = useState(null);

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

  // PENGATURAN JAM OTOMATIS (LIVE CLOCK)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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
        
        if (nextIndex !== currentIndex && focusableElements[nextIndex]) {
          focusableElements[nextIndex].focus();
        }
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

  // LOGIKA PULL DATA DENGAN BATASAN (LIMIT 500)
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
    const unsubTrans = onSnapshot(qTrans, 
      (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => {
          const timeA = a.waktu?.toMillis ? a.waktu.toMillis() : Date.now();
          const timeB = b.waktu?.toMillis ? b.waktu.toMillis() : Date.now();
          return timeB - timeA;
        });
        setTransaksi(data);
      },
      (error) => {
        console.error("ERROR INDEX TRANSAKSI: ", error.message);
        if(error.message.includes('index')) {
          alert("⚠️ PENTING: Firebase butuh 'Indeks'. Buka Inspect Element (Console) lalu klik Link berwarna biru dari pesan Error Firebase untuk membuat indeks Transaksi!");
        }
      }
    );

    const qPeng = query(collection(db, "pengeluaran"), where("userId", "==", user.uid), orderBy("waktu", "desc"), limit(500));
    const unsubPengeluaran = onSnapshot(qPeng, 
      (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => {
          const timeA = a.waktu?.toMillis ? a.waktu.toMillis() : Date.now();
          const timeB = b.waktu?.toMillis ? b.waktu.toMillis() : Date.now();
          return timeB - timeA;
        });
        setPengeluaran(data);
      },
      (error) => {
        console.error("ERROR INDEX PENGELUARAN: ", error.message);
        if(error.message.includes('index')) {
          alert("⚠️ PENTING: Firebase butuh 'Indeks'. Buka Inspect Element (Console) lalu klik Link berwarna biru dari pesan Error Firebase untuk membuat indeks Pengeluaran!");
        }
      }
    );

    return () => { unsubProduk(); unsubTrans(); unsubPengeluaran(); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const todayTrans = transaksi.filter(t => t.waktu && t.waktu.toDate && t.waktu.toDate().toISOString().split('T')[0] === today);
    const todayPeng = pengeluaran.filter(p => p.waktu && p.waktu.toDate && p.waktu.toDate().toISOString().split('T')[0] === today);
    
    // FITUR BON: Omzet hanya menghitung yang Lunas/Tunai/QRIS/Transfer
    const omzetHariIni = todayTrans.filter(t => t.metode !== 'Bon' || t.statusBon === 'Lunas').reduce((sum, t) => sum + t.total, 0);
    const pengeluaranHariIni = todayPeng.reduce((sum, p) => sum + p.nominal, 0);

    setDashboardStats({
      totalProducts: produk.length,
      lowStock: produk.filter(p => p.stok < 50).length,
      todaySales: omzetHariIni,
      totalPengeluaran: pengeluaranHariIni,
      labaBersih: omzetHariIni - pengeluaranHariIni
    });
  }, [produk, transaksi, pengeluaran, user]);

  useEffect(() => {
    let html5QrCode;
    const scannerId = isScanningKasir ? "reader-kasir" : (isScanningToko ? "reader-toko" : null);
    if (scannerId) {
      html5QrCode = new Html5Qrcode(scannerId);
      html5QrCode.start(
        { facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (isScanningKasir) {
            const found = produk.find(p => p.barcode === decodedText);
            if (found) { addToCart(found); setIsScanningKasir(false); } 
            else { alert('❌ Barcode tidak terdaftar di database!'); setIsScanningKasir(false); }
          } else { setBarcodeProd(decodedText); setIsScanningToko(false); }
          html5QrCode.stop();
        }, (error) => {}
      ).catch(err => { alert("Gagal membuka kamera!"); setIsScanningKasir(false); setIsScanningToko(false); });
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(console.error); };
  }, [isScanningKasir, isScanningToko, produk]);

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
    try { 
      setLoading(true); 
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password); 
      } else {
        await signInWithEmailAndPassword(auth, email, password); 
      }
    } 
    catch (error) { alert('Gagal: ' + error.message); } 
    finally { setLoading(false); }
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
    
    // JIKA METODE BON, MUNCULKAN POP-UP SETELAH KLIK BAYAR & CETAK
    if (metodePembayaran === 'Bon') {
      setShowBonModal(true); 
    } else {
      finalizePayment(metodePembayaran); 
    }
  };

  // --- REVISI: MENGHAPUS 'async/await' AGAR UI TIDAK FREEZE SAAT OFFLINE ---
  const finalizePayment = (metode) => {
    const finalUangBayar = metode === 'Tunai' ? Number(paymentAmount) : totalAmount;
    const dataTrans = {
      userId: user.uid, items: cart.map(i => ({nama: i.nama, harga: i.harga, qty: i.qty, satuan: i.satuan || 'Pcs'})),
      total: totalAmount, uangBayar: finalUangBayar, kembalian: kembalian, metode: metode, 
      waktu: new Date() // REVISI: Pakai new Date() agar tidak hilang saat offline
    };

    if (metode === 'Bon') {
      if (!namaPelangganBon.trim()) return alert("Nama pelanggan wajib diisi!");
      dataTrans.namaPelanggan = namaPelangganBon;
      dataTrans.statusBon = 'Belum Lunas';
    }

    try {
      // Perintah nulis ke database tidak lagi ditunggu (tanpa await). Langsung dieksekusi di background.
      addDoc(collection(db, "transaksi"), dataTrans);
      for (const item of cart) { 
        updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) }); 
      }
      
      // UI Langsung Re-render dengan super cepat!
      setStrukData(dataTrans); setCart([]); setPaymentAmount(''); setMetodePembayaran('Tunai'); 
      setShowQrisModal(false); setShowBonModal(false); setNamaPelangganBon('');
    } catch (err) { alert("Gagal memproses transaksi"); }
  };

  // --- REVISI: MENGHAPUS 'async/await' AGAR UI TIDAK FREEZE SAAT OFFLINE ---
  const simpanProduk = (e) => {
    e.preventDefault();
    if (editingProductId) {
      const checkDuplicate = produk.find(p => p.barcode === barcodeProd && barcodeProd !== "" && p.id !== editingProductId);
      if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan oleh produk lain!");
      
      updateDoc(doc(db, "produk", editingProductId), { 
        nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: barcodeProd, satuan: satuanProd 
      });
      setEditingProductId(null);
    } else {
      const checkDuplicate = produk.find(p => p.barcode === barcodeProd && barcodeProd !== "");
      if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan oleh produk lain!");
      
      const bcode = barcodeProd || Math.floor(100000000000 + Math.random() * 900000000000).toString();
      addDoc(collection(db, "produk"), { nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: bcode, satuan: satuanProd, userId: user.uid, createdAt: new Date() });
    }
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd(''); setSatuanProd('Pcs');
  };

  // --- REVISI: MENGHAPUS 'async/await' AGAR UI TIDAK FREEZE SAAT OFFLINE ---
  const simpanPengeluaran = (e) => {
    e.preventDefault();
    addDoc(collection(db, "pengeluaran"), { nama: namaPengeluaran, nominal: Number(nominalPengeluaran), userId: user.uid, waktu: new Date() });
    setNamaPengeluaran(''); setNominalPengeluaran(''); 
  };

  // --- REVISI: MENGHAPUS 'async/await' AGAR UI TIDAK FREEZE SAAT OFFLINE ---
  const simpanProfil = () => {
    setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp, qrisImage });
    alert("Profil Tersimpan!"); setShowProfileModal(false);
  };

  // LOGIKA MESIN HAPUS DATA TAHUNAN
  const handleResetTahunan = async () => {
    if (!window.confirm(`⚠️ PERINGATAN TERAKHIR: Apakah Anda yakin ingin menghapus SEMUA transaksi pada tahun ${selectedYearReset}? Tindakan ini permanen dan tidak bisa dibatalkan!`)) return;
    
    const startOfYear = new Date(`${selectedYearReset}-01-01T00:00:00`);
    const endOfYear = new Date(`${selectedYearReset}-12-31T23:59:59`);
    
    try {
      const qReset = query(
        collection(db, "transaksi"), 
        where("userId", "==", user.uid), 
        where("waktu", ">=", startOfYear), 
        where("waktu", "<=", endOfYear)
      );
      
      const snapshot = await getDocs(qReset);
      
      if (snapshot.empty) {
        return alert(`Tidak ada data transaksi yang ditemukan di tahun ${selectedYearReset}.`);
      }
      
      let deletedCount = 0;
      for (const document of snapshot.docs) {
        deleteDoc(doc(db, "transaksi", document.id)); // Tanpa await agar cepat
        deletedCount++;
      }
      
      alert(`Berhasil! Sebanyak ${deletedCount} transaksi di tahun ${selectedYearReset} telah dihapus permanen.`);
      setShowResetModal(false);
      
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus data. Pastikan indeks Firebase sudah dibuat. Cek Console (F12) untuk detail error.");
    }
  };

  const filteredTransaksi = transaksi.filter(t => {
    if (!t.waktu) return false;
    const cari = searchLaporan.toLowerCase();
    const matchCari = cari === '' || t.items.some(i => i.nama.toLowerCase().includes(cari)) || (t.metode && t.metode.toLowerCase().includes(cari)) || (t.namaPelanggan && t.namaPelanggan.toLowerCase().includes(cari));
    if (!matchCari) return false;

    const dateObj = t.waktu.toDate ? t.waktu.toDate() : new Date(); const today = new Date();
    if (reportFilter === 'hari') return dateObj.toDateString() === today.toDateString();
    else if (reportFilter === 'minggu') return dateObj >= new Date(today.setDate(today.getDate() - today.getDay()));
    else if (reportFilter === 'bulan') return dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
    return true;
  });

  const displayedLaporan = laporanTab === 'bon' 
    ? filteredTransaksi.filter(t => t.metode === 'Bon' && t.statusBon !== 'Lunas') 
    : filteredTransaksi;

  const exportExcel = () => {
    const headers = ["Tanggal,Jam,Metode Pembayaran,Nama Pelanggan (Bon),Status Bon,Item,Total,Tunai,Kembali"];
    const rows = displayedLaporan.map(t => {
      const d = t.waktu?.toDate ? t.waktu.toDate() : new Date();
      const items = t.items.map(i => `${i.qty} ${i.satuan || 'Pcs'} ${i.nama}`).join(' + ');
      return `${d.toLocaleDateString('id-ID')},${d.toLocaleTimeString('id-ID')},${t.metode || 'Tunai'},"${t.namaPelanggan || '-'}","${t.statusBon || '-'}","${items}",${t.total},${t.uangBayar},${t.kembalian}`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + headers.concat(rows).join("\n")));
    link.setAttribute("download", `Laporan_${laporanTab === 'bon' ? 'Bon' : 'Transaksi'}_Kasir.csv`);
    document.body.appendChild(link); link.click();
  };

  const getChartData = () => {
    let labels = []; let values = []; const now = new Date();
    if (chartFilter === 'jam') {
      const todayTrans = transaksi.filter(t => t.waktu && t.waktu.toDate && t.waktu.toDate().toDateString() === now.toDateString());
      for(let i=8; i<=22; i+=2) {
        labels.push(`${i}:00`); values.push(todayTrans.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu.toDate().getHours() >= i && t.waktu.toDate().getHours() < i+2).reduce((s, t) => s + t.total, 0));
      }
    } else if (chartFilter === 'hari') {
      for(let i=6; i>=0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        labels.push(`${d.getDate()}/${d.getMonth()+1}`); values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().toDateString() === d.toDateString()).reduce((s, t) => s + t.total, 0));
      }
    } else if (chartFilter === 'bulan') {
      for(let i=5; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(d.toLocaleString('default', { month: 'short' })); values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().getMonth() === d.getMonth() && t.waktu.toDate().getFullYear() === d.getFullYear()).reduce((s, t) => s + t.total, 0));
      }
    } else if (chartFilter === 'tahun') {
      for(let i=4; i>=0; i--) {
        const year = now.getFullYear() - i;
        labels.push(year); values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().getFullYear() === year).reduce((s, t) => s + t.total, 0));
      }
    }
    const max = Math.max(...values, 1);
    return { data: labels.map((l, i) => ({ label: l, total: values[i] })), max };
  };
  const chartData = getChartData();
  const isProfit = dashboardStats.labaBersih >= 0;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: "'Inter', sans-serif", color: '#FF7835' }}><strong>Memuat Sistem...</strong></div>;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', background: '#FF7835', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: 'white', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '420px', zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#FF7835', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>Selamat Datang di Aplikasi</div>
            <h1 style={{ fontSize: '30px', fontWeight: '900', color: '#272734', margin: 0 }}>POS MODERN PRO</h1>
            <p style={{ color: '#27274F', fontSize: '14px', margin: '8px 0 0 0', fontWeight: '600' }}>Sistem Kasir Bisnis Terpadu</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}><input type="email" placeholder="Alamat Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} /></div>
            <div style={{ marginBottom: '32px' }}><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} /></div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '18px', background: '#272734', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 10px 15px -3px rgba(39, 39, 52, 0.4)' }}>
              {isRegister ? 'BUAT AKUN BARU' : 'MASUK KE SISTEM'}
            </button>
          </form>
          <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', color: '#FF7835', marginTop: '24px', textAlign: 'center', fontSize: '14px', fontWeight: '700' }}>
            {isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar disini'}
          </p>
        </div>
        <div style={{ position: 'absolute', bottom: '20px', right: '24px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>created by : Muhamad Rofiki</div>
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
          <div className="live-clock" style={{ textAlign: 'right', paddingRight: '16px', borderRight: '2px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="date-text" style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>{currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
            <div className="time-text" style={{ fontSize: '15px', fontWeight: '900', color: '#272734', letterSpacing: '0.5px' }}>{currentTime.toLocaleTimeString('id-ID')}</div>
          </div>
          <button tabIndex="0" onClick={() => setShowProfileModal(true)} style={{ background: '#fff7ed', border: '1px solid #FF7835', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#FF7835' }}>👤</button>
          <button tabIndex="0" onClick={() => signOut(auth)} style={{ padding: '8px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>Logout</button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          
        {/* --- TAB DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '1200px', margin: '0 auto' }}>
              
              <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: '#272734', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(39, 39, 52, 0.15)' }}>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px', fontWeight: '600' }}>Omzet Hari Ini</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#FF7835' }}>Rp {dashboardStats.todaySales.toLocaleString()}</div>
                </div>
                <div style={{ background: '#FF7835', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(255, 120, 53, 0.15)' }}>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px', fontWeight: '600' }}>Pengeluaran Hari Ini</div>
                  <div style={{ fontSize: '26px', fontWeight: '800' }}>Rp {dashboardStats.totalPengeluaran.toLocaleString()}</div>
                </div>
                <div style={{ background: 'white', border: `2px solid ${isProfit ? '#10b981' : '#ef4444'}`, padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px', fontWeight: '700', color: '#64748b' }}>Laba Bersih Hari Ini</div>
                  <div style={{ fontSize: '26px', fontWeight: '900', color: isProfit ? '#10b981' : '#ef4444' }}>
                    {isProfit ? '' : '- '}Rp {Math.abs(dashboardStats.labaBersih).toLocaleString()}
                  </div>
                </div>
                <div style={{ background: '#0ea5e9', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(14, 165, 233, 0.15)' }}>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px', fontWeight: '600' }}>Produk & Stok Tipis</div>
                  <div style={{ fontSize: '26px', fontWeight: '800' }}>{dashboardStats.totalProducts} <span style={{ fontSize: '14px', fontWeight: '500' }}>/ {dashboardStats.lowStock} Tipis</span></div>
                </div>
              </div>

              <div style={{ flex: 1, background: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: '#272734', fontSize: '18px' }}>📈 Grafik Pendapatan</h3>
                  <select tabIndex="0" value={chartFilter} onChange={(e) => setChartFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #FF7835', outline: 'none', fontWeight: '700', color: '#27274F', background: '#fff7ed', fontSize: '13px' }}>
                    <option value="jam">Hari Ini (Per Jam)</option><option value="hari">7 Hari Terakhir</option><option value="bulan">6 Bulan Terakhir</option><option value="tahun">5 Tahun Terakhir</option>
                  </select>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '15px', paddingTop: '10px' }}>
                  {chartData.data.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                      <div style={{ fontSize: '11px', color: '#FF7835', fontWeight: '800', marginBottom: '6px', textAlign: 'center' }}>{d.total > 0 ? `Rp${(d.total/1000)}k` : ''}</div>
                      <div style={{ width: '100%', maxWidth: '50px', background: 'linear-gradient(to top, #fdba74, #FF7835)', borderRadius: '6px 6px 0 0', height: `${(d.total / chartData.max) * 100}%`, minHeight: '8px', transition: '1s ease-out' }}></div>
                      <div style={{ fontSize: '12px', color: '#27274F', marginTop: '10px', fontWeight: '700', textAlign: 'center' }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB KASIR --- */}
        {activeTab === 'kasir' && (
          <div className="desktop-row-mobile-col" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
            
            <div className="kasir-left-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 'none', display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="🔍 Cari nama produk..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', outline: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} />
                <form onSubmit={handleManualScan} style={{ flex: 1 }}>
                  <input type="text" placeholder="🔫 Scan Barcode..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} autoFocus style={{ width: '100%', padding: '12px 16px', border: '2px solid #FF7835', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} />
                </form>
                <button tabIndex="0" onClick={() => setIsScanningKasir(!isScanningKasir)} style={{ padding: '12px 16px', background: isScanningKasir ? '#ef4444' : '#272734', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                  {isScanningKasir ? 'Tutup Kamera' : '📸 Kamera'}
                </button>
              </div>

              {isScanningKasir && (
                <div id="camera-popup-container" style={{ flex: 'none', background: '#272734', padding: '16px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center' }}>
                  <p style={{ color: 'white', margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '14px' }}>Arahkan Barcode ke Kamera</p>
                  <div id="reader-kasir" style={{ width: '100%', maxWidth: '300px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px', border: '2px solid #FF7835' }}></div>
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px' }}>
                <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                    <div key={p.id} 
                         tabIndex="0" 
                         onClick={() => addToCart(p)} 
                         onKeyDown={(e) => { if(e.key === 'Enter') addToCart(p); }} 
                         style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', border: p.stok < 50 ? '2px solid #fee2e2' : '2px solid transparent', position: 'relative', transition: 'transform 0.1s, border 0.1s' }} 
                         onMouseEnter={(e) => {e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.border = '2px solid #FF7835';}} 
                         onMouseLeave={(e) => {e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.border = p.stok < 50 ? '2px solid #fee2e2' : '2px solid transparent';}}>
                      
                      {p.stok < 50 && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px' }}>{p.stok === 0 ? 'HABIS' : 'TIPIS'}</div>}
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: '#272734', lineHeight: '1.2' }}>{p.nama}</h3>
                      <div style={{ fontSize: '18px', fontWeight: '900', color: '#0ea5e9', marginBottom: '8px' }}>Rp {p.harga.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: '#27274F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ background: p.stok < 50 ? '#fee2e2' : '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}><span style={{ color: p.stok < 50 ? '#dc2626' : '#16a34a' }}>{p.stok} {p.satuan || 'Pcs'}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="kasir-right-panel" style={{ flex: '0 0 420px', background: 'white', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ flex: 'none', padding: '16px 20px', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffaf5' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#272734' }}>🛒 Keranjang ({cart.length})</h2>
                {cart.length > 0 && <button tabIndex="0" onClick={() => { setCart([]); setPaymentAmount(''); setMetodePembayaran('Tunai'); }} style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: '700', cursor: 'pointer', transition: '0.2s', fontSize: '11px' }}>Kosongkan</button>}
              </div>
              
              <div className="cart-list" style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                {cart.length === 0 ? <div style={{ textAlign: 'center', color: '#27274F', marginTop: '30px', fontSize: '13px', fontWeight: '500' }}>Belum ada pesanan...</div> : 
                  cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 0', borderBottom: '1px dashed #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#272734' }}>{item.nama} <span style={{fontSize:'11px', color:'#94a3b8'}}>({item.satuan || 'Pcs'})</span></h3>
                      <button tabIndex="0" onClick={() => updateQuantity(item.id, 0)} style={{ background: '#fee2e2', border: 'none', color: '#dc2626', width: '20px', height: '20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>×</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#FF7835' }}>Rp {(item.harga * item.qty).toLocaleString()}</div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                        <button tabIndex="0" onClick={() => updateQuantity(item.id, item.qty - 1)} style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#f1f5f9', border: 'none', color: '#27274F', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>−</button>
                        <input type="number" value={item.qty} onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)} style={{ width: '30px', textAlign: 'center', background: 'transparent', border: 'none', fontSize: '13px', fontWeight: '800', color: '#272734', outline: 'none' }} />
                        <button tabIndex="0" onClick={() => addToCart(item)} style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#FF7835', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ flex: 'none', padding: '16px 20px', background: '#fffaf5', borderTop: '2px solid #fed7aa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#27274F' }}>Total Pembelian:</span>
                  <span style={{ fontSize: '20px', fontWeight: '900', color: '#272734' }}>Rp {totalAmount.toLocaleString()}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                  {['Tunai', 'QRIS', 'Transfer', 'Bon'].map(metode => (
                    <button
                      key={metode} tabIndex="0" className="btn-metode"
                      onClick={() => {
                        if (metode === 'Bon' && cart.length === 0) {
                          alert('Keranjang masih kosong! Silakan tambahkan produk terlebih dahulu.');
                          return; 
                        }
                        setMetodePembayaran(metode);
                        if(metode !== 'Tunai' && metode !== 'Bon') setPaymentAmount(totalAmount);
                        else setPaymentAmount('');
                      }}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '12px',
                        background: metodePembayaran === metode ? '#FF7835' : 'white', color: metodePembayaran === metode ? 'white' : '#27274F',
                        border: metodePembayaran === metode ? 'none' : '1px solid #cbd5e1', transition: 'all 0.2s',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}
                    >
                      {metode === 'Tunai' ? '💵 Tunai' : metode === 'QRIS' ? '📱 QRIS' : metode === 'Transfer' ? '💳 Transfer' : '📝 Bon'}
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  {metodePembayaran === 'Tunai' ? (
                    <input type="number" placeholder="Ketik Nominal Uang (Rp)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: paymentAmount !== '' && Number(paymentAmount) < totalAmount ? '2px solid #ef4444' : '2px solid #cbd5e1', fontSize: '16px', fontWeight: '800', outline: 'none', background: 'white', color: '#272734', boxSizing: 'border-box' }} />
                  ) : metodePembayaran === 'QRIS' ? (
                    <button tabIndex="0" onClick={() => setShowQrisModal(true)} disabled={!qrisImage} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: !qrisImage ? '#cbd5e1' : '#272734', color: 'white', border: 'none', fontWeight: '800', cursor: !qrisImage ? 'not-allowed' : 'pointer', fontSize: '13px', textTransform: 'uppercase' }}>
                      {qrisImage ? '📱 TAMPILKAN QRIS' : '⚠️ QRIS BELUM DIATUR'}
                    </button>
                  ) : metodePembayaran === 'Transfer' ? (
                    <div style={{ padding: '10px', background: '#eff6ff', color: '#0369a1', borderRadius: '8px', textAlign: 'center', fontWeight: '700', fontSize: '12px', border: '1px solid #bae6fd' }}>
                      💳 Pastikan transfer masuk sebelum cetak struk.
                    </div>
                  ) : (
                    <div style={{ padding: '10px', background: '#fff7ed', color: '#ea580c', borderRadius: '8px', textAlign: 'center', fontWeight: '700', fontSize: '12px', border: '1px solid #ffedd5' }}>
                      📝 Klik Bayar & Cetak di bawah untuk mencatat Bon.
                    </div>
                  )}
                </div>

                {metodePembayaran === 'Tunai' && paymentAmount !== '' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '10px', background: Number(paymentAmount) >= totalAmount ? '#dcfce7' : '#fee2e2', borderRadius: '8px', border: `1px solid ${Number(paymentAmount) >= totalAmount ? '#bbf7d0' : '#fecaca'}` }}>
                    <span style={{ fontWeight: '800', fontSize: '12px', color: Number(paymentAmount) >= totalAmount ? '#16a34a' : '#dc2626' }}>
                      {Number(paymentAmount) >= totalAmount ? 'Kembalian:' : '⚠️ Uang Kurang:'}
                    </span>
                    <span style={{ fontWeight: '900', fontSize: '16px', color: Number(paymentAmount) >= totalAmount ? '#16a34a' : '#dc2626' }}>
                      Rp {Math.abs(kembalian).toLocaleString()}
                    </span>
                  </div>
                )}

                <button tabIndex="0" onClick={processPayment} disabled={cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))} style={{ width: '100%', padding: '14px', background: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))) ? '#e2e8f0' : '#FF7835', color: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))) ? '#94a3b8' : 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))) ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  BAYAR & CETAK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB TOKO --- */}
        {activeTab === 'toko' && (
          <div className="desktop-row-mobile-col mobile-reverse" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
            
            <div className="table-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#272734', fontSize: '18px', fontWeight: '800' }}>📦 Database Produk</h3>
                <button tabIndex="0" onClick={() => { setPrintData(produk); setPrintMode('label'); }} style={{ background: '#FF7835', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                  🖨️ Cetak Semua Barcode
                </button>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#fff7ed', color: '#27274F', fontSize: '12px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Nama Produk</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Harga</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Stok</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Barcode</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produk.length === 0 ? <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#27274F' }}>Belum ada produk.</td></tr> : 
                      produk.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#272734', fontSize: '13px' }}>{p.nama}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '800', color: '#0ea5e9', fontSize: '13px' }}>Rp {p.harga.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: p.stok < 50 ? '#fee2e2' : '#dcfce7', color: p.stok < 50 ? '#dc2626' : '#16a34a', padding: '4px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '11px' }}>{p.stok} {p.satuan || 'Pcs'}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#27274F', fontSize: '12px' }}>{p.barcode}</td>
                        <td style={{ padding: '12px 16px', display: 'flex', gap: '6px' }}>
                          <button tabIndex="0" onClick={() => { setNamaProd(p.nama); setHargaProd(p.harga); setStokProd(p.stok); setBarcodeProd(p.barcode); setSatuanProd(p.satuan || 'Pcs'); setEditingProductId(p.id); }} style={{ background: '#272734', border: 'none', padding: '6px 10px', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>Edit</button>
                          <button tabIndex="0" onClick={() => { setPrintData([p]); setPrintMode('label'); }} style={{ background: '#FF7835', border: 'none', padding: '6px 10px', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>Cetak</button>
                          <button tabIndex="0" onClick={() => { if(window.confirm('Yakin ingin menghapus produk ini?')) deleteDoc(doc(db, "produk", p.id)); }} style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>Hapus</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="form-section sticky-box" style={{ flex: '0 0 350px', overflowY: 'auto', height: '100%' }}>
              <form onSubmit={simpanProduk} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#FF7835', fontSize: '18px', fontWeight: '800' }}>{editingProductId ? '✏️ Edit Produk' : '➕ Tambah Produk'}</h3>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Nama Produk</label>
                <input value={namaProd} onChange={e => setNamaProd(e.target.value)} required style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Harga (Rp)</label>
                    <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Stok Awal</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" style={{ width: '55%', padding: '12px 6px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                      <select tabIndex="0" value={satuanProd} onChange={e => setSatuanProd(e.target.value)} style={{ width: '45%', padding: '12px 4px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '11px', fontWeight: 'bold', outline: 'none' }}>
                        <option value="Pcs">Pcs</option><option value="Kg">Kg</option><option value="Gram">Gram</option><option value="Liter">Liter</option><option value="Pack">Pack</option><option value="Box">Box</option><option value="Cup">Cup</option>
                      </select>
                    </div>
                  </div>
                </div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Barcode Produk</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                  <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Kosong = Otomatis" style={{ flex: 1, padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                  <button tabIndex="0" type="button" onClick={() => setIsScanningToko(!isScanningToko)} style={{ padding: '0 16px', background: '#272734', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                    📸 Scan
                  </button>
                </div>
                {isScanningToko && (
                  <div style={{ background: '#272734', padding: '12px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center' }}>
                    <p style={{ color: 'white', margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold' }}>Arahkan Barcode ke Kamera</p>
                    <div id="reader-toko" style={{ width: '100%', maxWidth: '300px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px' }}></div>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button tabIndex="0" type="submit" style={{ flex: 1, padding: '14px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {editingProductId ? 'UPDATE' : 'SIMPAN'}
                  </button>
                  {editingProductId && (
                    <button tabIndex="0" type="button" onClick={() => { setEditingProductId(null); setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd(''); setSatuanProd('Pcs'); }} style={{ flex: 1, padding: '14px', background: '#272734', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      BATAL
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- TAB PENGELUARAN --- */}
        {activeTab === 'pengeluaran' && (
          <div className="desktop-row-mobile-col mobile-reverse" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
            
            <div className="table-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <h3 style={{ flex: 'none', margin: '0 0 10px 0', color: '#272734', fontSize: '18px', fontWeight: '800' }}>💸 Riwayat Pengeluaran Toko</h3>
              
              <div style={{ padding: '8px 12px', background: '#fff7ed', color: '#ea580c', borderRadius: '8px', fontSize: '11px', fontWeight: '600', marginBottom: '16px', border: '1px solid #ffedd5' }}>
                💡 Menampilkan 500 pengeluaran terbaru.
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#27274F', fontSize: '12px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>Tanggal & Waktu</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>Keterangan</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>Nominal</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pengeluaran.length === 0 ? <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#27274F' }}>Belum ada pengeluaran.</td></tr> : 
                      pengeluaran.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', color: '#27274F', fontSize: '12px', fontWeight: '500' }}>{p.waktu ? p.waktu.toDate().toLocaleString('id-ID') : 'Baru saja'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#272734', fontSize: '13px' }}>{p.nama}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '800', color: '#e11d48', fontSize: '14px' }}>- Rp {p.nominal.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <button tabIndex="0" onClick={() => { if(window.confirm('Yakin hapus data ini?')) deleteDoc(doc(db, "pengeluaran", p.id)); }} style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>Hapus</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="form-section sticky-box" style={{ flex: '0 0 350px', overflowY: 'auto', height: '100%' }}>
              <form onSubmit={simpanPengeluaran} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#e11d48', fontSize: '18px', fontWeight: '800' }}>➖ Catat Pengeluaran</h3>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Keterangan (Contoh: Bayar Listrik, Kulakan)</label>
                <input value={namaPengeluaran} onChange={e => setNamaPengeluaran(e.target.value)} required style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Nominal Pengeluaran (Rp)</label>
                <input value={nominalPengeluaran} onChange={e => setNominalPengeluaran(e.target.value)} required type="number" style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                <button tabIndex="0" type="submit" style={{ width: '100%', padding: '14px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>SIMPAN PENGELUARAN</button>
              </form>
            </div>
          </div>
        )}

        {/* --- TAB LAPORAN --- */}
        {activeTab === 'laporan' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', boxSizing: 'border-box', width: '100%' }}>
            
            <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px', width: '100%' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#272734', fontWeight: '800' }}>📋 Laporan Transaksi</h2>
              
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button tabIndex="0" className="tab-laporan-btn" onClick={() => setLaporanTab('transaksi')} style={{ padding: '6px 12px', background: laporanTab === 'transaksi' ? '#272734' : '#f1f5f9', color: laporanTab === 'transaksi' ? 'white' : '#64748b', borderRadius: '6px', fontWeight: '800', border: 'none', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }}>Semua Transaksi</button>
                <button tabIndex="0" className="tab-laporan-btn" onClick={() => setLaporanTab('bon')} style={{ padding: '6px 12px', background: laporanTab === 'bon' ? '#FF7835' : '#f1f5f9', color: laporanTab === 'bon' ? 'white' : '#64748b', borderRadius: '6px', fontWeight: '800', border: 'none', cursor: 'pointer', fontSize: '12px', transition: '0.2s' }}>Buku Bon (Piutang)</button>
                <button tabIndex="0" onClick={exportExcel} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>📥 Download Excel</button>
                <button tabIndex="0" onClick={() => setShowResetModal(true)} style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>🗑️ Hapus Data Lama</button>
              </div>
            </div>

            <div style={{ flex: 'none', background: 'white', padding: '8px 12px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
              <input type="text" placeholder="🔍 Cari nama barang, metode bayar, atau nama pelanggan..." value={searchLaporan} onChange={(e) => setSearchLaporan(e.target.value)} style={{ flex: 2, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', outline: 'none', minWidth: '200px' }} />
              <select tabIndex="0" value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', fontSize: '12px', fontWeight: '600', color: '#27274F', outline: 'none', minWidth: '150px' }}>
                <option value="hari">📅 Hari Ini</option><option value="minggu">📈 Minggu Ini</option><option value="bulan">📉 Bulan Ini</option><option value="semua">📂 Semua Waktu</option>
              </select>
            </div>

            <div style={{ flex: 'none', padding: '6px 10px', background: '#fff7ed', color: '#ea580c', borderRadius: '6px', fontSize: '10px', fontWeight: '600', marginBottom: '8px', border: '1px solid #ffedd5' }}>
              💡 Menampilkan 500 transaksi terbaru agar aplikasi kencang. Gunakan kolom pencarian di atas untuk melihat data lama.
            </div>

            <div style={{ flex: 1, background: 'white', borderRadius: '12px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '100%' }}>
              {displayedLaporan.length === 0 ? <div style={{ padding: '30px', textAlign: 'center', color: '#27274F', fontSize: '13px', fontWeight: '500' }}>Belum ada data di tabel ini.</div> : 
                displayedLaporan.map(t => (
                
                <div key={t.id} style={{ padding: '6px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '800', color: '#272734', fontSize: '11px', marginBottom: '2px' }}>{t.waktu && typeof t.waktu.toDate === 'function' ? t.waktu.toDate().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) : 'Baru saja'} - {t.waktu && typeof t.waktu.toDate === 'function' ? t.waktu.toDate().toLocaleTimeString('id-ID') : ''}</div>
                    
                    {t.metode === 'Bon' && (
                      <div style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '900', color: '#272734' }}>👤 {t.namaPelanggan}</span>
                        <span style={{ padding: '2px 4px', borderRadius: '4px', fontSize: '9px', fontWeight: '900', background: t.statusBon === 'Lunas' ? '#dcfce7' : '#fee2e2', color: t.statusBon === 'Lunas' ? '#16a34a' : '#dc2626' }}>
                          {t.statusBon === 'Lunas' ? '✓ LUNAS' : '⚠️ BELUM LUNAS'}
                        </span>
                      </div>
                    )}

                    <div style={{ color: '#27274F', fontSize: '10px', background: '#fff7ed', padding: '3px 6px', borderRadius: '4px', display: 'inline-block', fontWeight: '700', marginBottom: '2px' }}>{t.items.map(i => `${i.qty} ${i.satuan||'Pcs'} ${i.nama}`).join(', ')}</div>
                    <div style={{ fontSize: '10px', color: '#27274F', fontWeight: '700' }}>Metode: <span style={{ color: t.metode === 'Tunai' ? '#FF7835' : '#0ea5e9' }}>{t.metode || 'Tunai'}</span></div>
                  </div>
                  
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div>
                      <div style={{ fontWeight: '900', color: '#FF7835', fontSize: '14px', marginBottom: '1px' }}>Rp {t.total.toLocaleString()}</div>
                      {t.metode === 'Tunai' && <div style={{ fontSize: '9px', color: '#27274F', fontWeight: '600' }}>Tunai: Rp {t.uangBayar?.toLocaleString()} <span style={{ margin: '0 2px', color: '#cbd5e1' }}>|</span> Kem: Rp {t.kembalian?.toLocaleString()}</div>}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {t.metode === 'Bon' && t.statusBon === 'Belum Lunas' && (
                        <button tabIndex="0" onClick={() => { if(window.confirm(`Tandai tagihan Rp ${t.total.toLocaleString()} atas nama ${t.namaPelanggan} ini sudah LUNAS?`)) updateDoc(doc(db, "transaksi", t.id), { statusBon: 'Lunas', waktuLunas: new Date() }); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', boxShadow: '0 1px 2px rgba(16,185,129,0.3)' }}>✓ LUNAS</button>
                      )}
                      <button tabIndex="0" onClick={() => setStrukData(t)} style={{ background: '#272734', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>🖨️ Cetak</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* --- POP-UP MODAL BON (PIUTANG) MUNCUL SAAT KLIK BAYAR & CETAK --- */}
      {showBonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.85)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', textAlign: 'left', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 8px 0', color: '#272734', fontSize: '22px', fontWeight: '900' }}>📝 Catat Bon Pelanggan</h2>
            <p style={{ margin: '0 0 24px 0', color: '#27274F', fontSize: '14px', fontWeight: '600' }}>Total Tagihan: <strong style={{ color: '#FF7835', fontSize: '20px' }}>Rp {totalAmount.toLocaleString()}</strong></p>
            
            <label style={{ fontSize: '13px', fontWeight: '800', color: '#27274F', marginBottom: '8px', display: 'block' }}>Nama Pelanggan / Nomor WA <span style={{color: '#ef4444'}}>*</span></label>
            <input autoFocus value={namaPelangganBon} onChange={e => setNamaPelangganBon(e.target.value)} placeholder="Contoh: Pak Budi" style={{ width: '100%', padding: '16px', marginBottom: '24px', border: '2px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', fontSize: '15px', fontWeight: '700', outline: 'none' }} />
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button tabIndex="0" onClick={() => { setShowBonModal(false); setMetodePembayaran('Tunai'); }} style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#27274F', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '14px' }}>BATAL</button>
              <button tabIndex="0" onClick={() => finalizePayment('Bon')} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #FF7835 0%, #E5601E 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', fontSize: '14px', boxShadow: '0 10px 15px -3px rgba(255, 120, 53, 0.4)' }}>SIMPAN BON</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT PROFIL TOKO --- */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', overflowY: 'auto' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#272734', fontSize: '22px', fontWeight: '800' }}>⚙️ Profil Toko & QRIS</h3>
              <button tabIndex="0" onClick={() => setShowProfileModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '20px', cursor: 'pointer', color: '#27274F', fontWeight: 'bold' }}>×</button>
            </div>
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#27274F', marginBottom: '6px', display: 'block' }}>Nama Toko / Perusahaan</label>
            <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Contoh: PT Adi Jaya" style={{ width: '100%', padding: '14px', marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} />
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#27274F', marginBottom: '6px', display: 'block' }}>Alamat Lengkap</label>
            <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Contoh: Jl. Sudirman No 12..." style={{ width: '100%', padding: '14px', marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} />
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#27274F', marginBottom: '6px', display: 'block' }}>Nomor Telepon / WhatsApp</label>
            <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="Contoh: 08123456789" style={{ width: '100%', padding: '14px', marginBottom: '20px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} />
            <div style={{ background: '#fffaf5', padding: '16px', borderRadius: '16px', marginBottom: '24px', border: '2px dashed #fed7aa' }}>
              <label style={{ fontSize: '13px', fontWeight: '800', color: '#272734', marginBottom: '8px', display: 'block' }}>📱 Upload Gambar QRIS Toko</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ fontSize: '12px', marginBottom: '12px', display: qrisImage ? 'none' : 'block' }} />
              {qrisImage && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', margin: '0 0 8px 0' }}>✓ Gambar QRIS Tersimpan</p>
                  <img src={qrisImage} alt="QRIS" style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '12px' }} />
                  <div>
                    <button onClick={() => setQrisImage('')} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>🗑️ Hapus & Ganti</button>
                  </div>
                </div>
              )}
            </div>
            <button tabIndex="0" onClick={simpanProfil} style={{ width: '100%', padding: '16px', background: '#272734', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '15px' }}>SIMPAN PENGATURAN</button>
          </div>
        </div>
      )}

      {/* --- MODAL TAMPIL QRIS --- */}
      {showQrisModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.85)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 8px 0', color: '#272734', fontSize: '24px', fontWeight: '800' }}>Silakan Scan QRIS</h2>
            <p style={{ margin: '0 0 24px 0', color: '#27274F', fontSize: '14px' }}>Total Tagihan: <strong style={{ color: '#FF7835', fontSize: '18px' }}>Rp {totalAmount.toLocaleString()}</strong></p>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', display: 'inline-block', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <img src={qrisImage} alt="QRIS Toko" style={{ width: '100%', maxWidth: '300px', height: 'auto', borderRadius: '8px' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button tabIndex="0" onClick={() => setShowQrisModal(false)} style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#27274F', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>TUTUP</button>
              <button tabIndex="0" onClick={() => finalizePayment('QRIS')} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #FF7835 0%, #E5601E 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '14px', boxShadow: '0 10px 15px -3px rgba(255, 120, 53, 0.4)' }}>SUDAH DIBAYAR</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL RESET DATA TAHUNAN --- */}
      {showResetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.85)', zIndex: 9900, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#dc2626', fontSize: '22px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>⚠️ Hapus Data Tahunan</h2>
            
            <div style={{ padding: '12px 16px', background: '#fee2e2', borderRadius: '12px', border: '1px solid #fecaca', marginBottom: '20px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c', fontWeight: '700', lineHeight: '1.5' }}>
                PERINGATAN! Data yang dihapus tidak dapat dikembalikan. Pastikan Anda sudah men-download data (Excel) untuk tahun tersebut sebelum menghapus.
              </p>
            </div>

            <label style={{ fontSize: '13px', fontWeight: '800', color: '#27274F', display: 'block', marginBottom: '8px' }}>Pilih Tahun Transaksi yang Ingin Dihapus:</label>
            <select tabIndex="0" value={selectedYearReset} onChange={e => setSelectedYearReset(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #cbd5e1', marginBottom: '24px', fontSize: '15px', fontWeight: 'bold', color: '#272734', outline: 'none' }}>
              {Array.from({ length: 26 }, (_, i) => 2025 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button tabIndex="0" onClick={() => setShowResetModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#27274F', fontWeight: '800', cursor: 'pointer', fontSize: '14px' }}>BATAL</button>
              <button tabIndex="0" onClick={handleResetTahunan} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: '#dc2626', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)' }}>HAPUS PERMANEN</button>
            </div>
          </div>
        </div>
      )}

      {/* --- STRUK AREA --- */}
      {strukData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div id="strukArea" style={{ background: '#fff', width: '320px', padding: '24px', textAlign: 'center', color: '#000', fontFamily: 'monospace' }}>
            <h2 style={{ margin: '0' }}>{namaToko || 'STRUK BELANJA'}</h2>
            <p style={{ fontSize: '12px', margin: '5px 0' }}>{alamat}<br/>Telp/WA: {noTelp}</p>
            <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
            <p style={{ fontSize: '12px', textAlign: 'left', margin: '2px 0' }}>Tgl: {strukData.waktu && typeof strukData.waktu.toDate === 'function' ? strukData.waktu.toDate().toLocaleString('id-ID') : (strukData.waktu instanceof Date ? strukData.waktu.toLocaleString('id-ID') : new Date().toLocaleString('id-ID'))}</p>
            <p style={{ fontSize: '12px', textAlign: 'left', margin: '2px 0' }}>Metode: {strukData.metode}</p>
            {strukData.metode === 'Bon' && <p style={{ fontSize: '13px', textAlign: 'left', margin: '4px 0', fontWeight: 'bold' }}>PELANGGAN: {strukData.namaPelanggan}</p>}
            <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
            {strukData.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}>
                <span>{it.qty} {it.satuan} {it.nama}</span><span>{(it.harga * it.qty).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}><span>TOTAL</span><span>Rp {strukData.total.toLocaleString()}</span></div>
            {strukData.metode === 'Tunai' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}><span>TUNAI</span><span>Rp {strukData.uangBayar?.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}><span>KEMBALI</span><span>Rp {strukData.kembalian?.toLocaleString()}</span></div>
              </>
            )}
            <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>*** TERIMA KASIH ***</p>
            <div className="no-print" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button tabIndex="0" onClick={() => window.print()} style={{ flex: 1, background: '#FF7835', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Print</button>
              <button tabIndex="0" onClick={() => setStrukData(null)} style={{ flex: 1, background: '#e2e8f0', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#27274F' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LABEL BARCODE --- */}
      {printMode === 'label' && printData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, overflowY: 'auto' }}>
          <div className="no-print" style={{ textAlign: 'center', padding: '15px', background: '#272734', position: 'sticky', top: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
            <button tabIndex="0" onClick={() => window.print()} style={{ background: '#FF7835', color: 'white', padding: '12px 24px', border: 'none', marginRight: '15px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>🖨️ Print Label</button>
            <button tabIndex="0" onClick={() => setPrintMode(null)} style={{ background: '#f8fafc', color: '#27274F', padding: '12px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>❌ Batal</button>
          </div>
          <div id="print-area" style={{ background: '#fff', width: '100%', minHeight: '100vh', padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', fontFamily: 'monospace' }}>
            {printData.map((p, i) => (
              <div key={i} style={{ border: '2px dashed #000', padding: '16px 20px', textAlign: 'center', width: '260px', height: 'fit-content', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', color: '#27274F', textTransform: 'uppercase', letterSpacing: '1px' }}>{namaToko || 'TOKO'}</div>
                <div style={{ fontSize: '15px', marginBottom: '10px', fontWeight: '900', color: '#000', lineHeight: '1.2' }}>{p.nama}</div>
                <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${p.barcode}&scale=2&height=12&includetext`} alt={p.barcode} style={{ width: '100%', height: 'auto', marginBottom: '8px' }} />
                <div style={{ fontWeight: '900', fontSize: '20px', color: '#000' }}>Rp {p.harga.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NAVIGASI BAWAH */}
      <nav className="no-print" style={{ flex: 'none', height: '65px', background: '#fff3e0', borderTop: '2px solid #ffd54f', display: 'flex', padding: '0', boxShadow: '0 -4px 15px rgba(255, 120, 53, 0.1)', zIndex: 10, boxSizing: 'border-box' }}>
        {[ { id: 'dashboard', label: 'Dashboard', icon: '📊' }, { id: 'kasir', label: 'Kasir', icon: '💰' }, { id: 'toko', label: 'Produk', icon: '📦' }, { id: 'pengeluaran', label: 'Arus Kas', icon: '💸' }, { id: 'laporan', label: 'Laporan', icon: '📉' } ].map(tab => (
          <button key={tab.id} tabIndex="0" className="nav-btn" onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '5px', margin: '0', border: 'none', background: 'transparent', color: activeTab === tab.id ? '#FF7835' : '#9ca3af', fontSize: activeTab === tab.id ? '22px' : '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', position: 'relative', transition: 'all 0.2s' }}>
            <span style={{ transform: activeTab === tab.id ? 'translateY(-2px)' : 'none', transition: '0.2s' }}>{tab.icon}</span>
            <span className="nav-text" style={{ fontWeight: activeTab === tab.id ? '800' : '600', textAlign: 'center' }}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* CSS KHUSUS */}
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #strukArea, #strukArea * { visibility: visible; }
          #strukArea { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; padding: 0; margin: 0; }
        }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #fed7aa; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #FF7835; }

        button:focus, [tabindex="0"]:focus { outline: none !important; box-shadow: 0 0 0 4px rgba(255, 120, 53, 0.4) !important; border-radius: inherit; }
        input:focus, select:focus { border-color: #FF7835 !important; outline: none !important; box-shadow: 0 0 0 3px rgba(255, 120, 53, 0.3) !important; }
        
        .nav-btn:active { transform: scale(0.95); opacity: 0.7; }
        .nav-btn:focus { box-shadow: none !important; outline: none !important; }
        .nav-text { font-size: 14px; } 

        @media (max-width: 768px) {
          .nav-text { font-size: 11px !important; } 
          
          .btn-metode { font-size: 10px !important; padding: 8px 2px !important; letter-spacing: -0.2px; }
          .tab-laporan-btn { font-size: 11px !important; padding: 10px !important; }

          #camera-popup-container { padding: 10px !important; margin-bottom: 10px !important; }
          #reader-kasir { height: 150px !important; }
          #reader-kasir video { object-fit: cover !important; height: 150px !important; }

          .header-title { font-size: 15px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
          .header-email { display: none !important; }
          .live-clock { display: none !important; }
          
          .desktop-row-mobile-col { flex-direction: column !important; flex-wrap: nowrap !important; width: 100% !important; max-width: none !important; margin: 0 !important; overflow-y: auto !important; padding-bottom: 30px !important; }
          .mobile-reverse { flex-direction: column-reverse !important; width: 100% !important; max-width: none !important; margin: 0 !important; overflow-y: auto !important; padding-bottom: 30px !important; }
          
          .kasir-left-panel { height: 35vh !important; flex: none !important; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 6px; }
          .kasir-right-panel { height: auto !important; flex: none !important; box-shadow: none !important; }
          
          .kasir-left-panel .grid-container { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)) !important; gap: 8px !important; }
          .kasir-left-panel .grid-container > div { padding: 10px !important; border-radius: 8px !important; }
          .kasir-left-panel .grid-container > div h3 { font-size: 12px !important; }
          
          .table-section { max-height: 50vh !important; flex: none !important; }
          .form-section { height: auto !important; flex: none !important; }
        }
      `}</style>
    </div>
  );
}

export default App;