import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, increment, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';
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
const db = getFirestore(app);
const auth = getAuth(app);

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(true);

  const [produk, setProduk] = useState([]);
  const [transaksi, setTransaksi] = useState([]);
  const [pengeluaran, setPengeluaran] = useState([]); 
  
  const [cart, setCart] = useState(() => {
    try { const saved = localStorage.getItem('kasirCart'); return saved ? JSON.parse(saved) : []; } 
    catch(e) { return []; }
  });
  
  const [search, setSearch] = useState('');
  const [searchLaporan, setSearchLaporan] = useState(''); // FITUR BARU: Pencarian Laporan
  const [activeTab, setActiveTab] = useState('dashboard');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Pembayaran & Kamera
  const [paymentAmount, setPaymentAmount] = useState('');
  const [metodePembayaran, setMetodePembayaran] = useState('Tunai'); 
  const [isScanningKasir, setIsScanningKasir] = useState(false);
  const [isScanningToko, setIsScanningToko] = useState(false);
  
  // Modal States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showQrisModal, setShowQrisModal] = useState(false);
  
  const [strukData, setStrukData] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [printData, setPrintData] = useState(null);

  // Form Toko & Profil
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');
  const [qrisImage, setQrisImage] = useState(''); 
  
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');
  const [satuanProd, setSatuanProd] = useState('Pcs'); 

  // Form Pengeluaran
  const [namaPengeluaran, setNamaPengeluaran] = useState('');
  const [nominalPengeluaran, setNominalPengeluaran] = useState('');

  const [reportFilter, setReportFilter] = useState('hari');
  const [chartFilter, setChartFilter] = useState('hari'); 
  const [dashboardStats, setDashboardStats] = useState({ todaySales: 0, totalProducts: 0, lowStock: 0, totalPengeluaran: 0, labaBersih: 0 });

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

    const unsubTrans = onSnapshot(query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc")), (snap) => {
      setTransaksi(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubPengeluaran = onSnapshot(query(collection(db, "pengeluaran"), where("userId", "==", user.uid), orderBy("waktu", "desc")), (snap) => {
      setPengeluaran(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProduk(); unsubTrans(); unsubPengeluaran(); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const todayTrans = transaksi.filter(t => t.waktu && t.waktu.toDate().toISOString().split('T')[0] === today);
    const todayPeng = pengeluaran.filter(p => p.waktu && p.waktu.toDate().toISOString().split('T')[0] === today);
    const omzetHariIni = todayTrans.reduce((sum, t) => sum + t.total, 0);
    const pengeluaranHariIni = todayPeng.reduce((sum, p) => sum + p.nominal, 0);

    setDashboardStats({
      totalProducts: produk.length,
      lowStock: produk.filter(p => p.stok < 5).length,
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
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (isScanningKasir) {
            const found = produk.find(p => p.barcode === decodedText);
            if (found) { addToCart(found); setIsScanningKasir(false); } 
            else { alert('❌ Barcode tidak terdaftar di database!'); setIsScanningKasir(false); }
          } else {
            setBarcodeProd(decodedText); setIsScanningToko(false);
          }
          html5QrCode.stop();
        }, (error) => {}
      ).catch(err => {
        alert("Gagal membuka kamera! Pastikan izin kamera browser diizinkan.");
        setIsScanningKasir(false); setIsScanningToko(false);
      });
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
    try { setLoading(true); if (isRegister) await createUserWithEmailAndPassword(auth, email, password); else await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { alert('Gagal: ' + error.message); } finally { setLoading(false); }
  };

  const handleManualScan = (e) => {
    e.preventDefault();
    const found = produk.find(p => p.barcode === barcodeInput || p.barcode === String(barcodeInput));
    if (found) { addToCart(found); setBarcodeInput(''); } 
    else { alert('Barcode tidak ditemukan!'); setBarcodeInput(''); }
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

  const processPayment = async () => {
    if (cart.length === 0) return alert('Keranjang kosong!');
    if (metodePembayaran === 'Tunai' && Number(paymentAmount) < totalAmount) return alert('Uang bayar kurang!');
    
    const finalUangBayar = metodePembayaran === 'Tunai' ? Number(paymentAmount) : totalAmount;

    const dataTrans = {
      userId: user.uid, 
      items: cart.map(i => ({nama: i.nama, harga: i.harga, qty: i.qty, satuan: i.satuan || 'Pcs'})),
      total: totalAmount, uangBayar: finalUangBayar, kembalian: kembalian, metode: metodePembayaran, waktu: new Date()
    };

    try {
      await addDoc(collection(db, "transaksi"), { ...dataTrans, waktu: serverTimestamp() });
      for (const item of cart) { await updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) }); }
      setStrukData(dataTrans); setCart([]); setPaymentAmount(''); setMetodePembayaran('Tunai'); setShowQrisModal(false);
    } catch (err) { alert("Gagal memproses transaksi"); }
  };

  const simpanProduk = async (e) => {
    e.preventDefault();
    const checkDuplicate = produk.find(p => p.barcode === barcodeProd && barcodeProd !== "");
    if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan oleh produk lain!");

    const bcode = barcodeProd || Math.floor(100000000000 + Math.random() * 900000000000).toString();
    await addDoc(collection(db, "produk"), { nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: bcode, satuan: satuanProd, userId: user.uid, createdAt: new Date() });
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd(''); setSatuanProd('Pcs');
    alert("Produk Berhasil Ditambah!");
  };

  const simpanPengeluaran = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "pengeluaran"), { nama: namaPengeluaran, nominal: Number(nominalPengeluaran), userId: user.uid, waktu: serverTimestamp() });
    setNamaPengeluaran(''); setNominalPengeluaran(''); alert("Pengeluaran Berhasil Dicatat!");
  };

  const simpanProfil = async () => {
    await setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp, qrisImage });
    alert("Profil Tersimpan!"); setShowProfileModal(false);
  };

  // FITUR: Logika Laporan yang difilter dengan Kolom Pencarian
  const filteredTransaksi = transaksi.filter(t => {
    if (!t.waktu) return false;
    
    // Pencarian berdasarkan nama barang atau metode bayar
    const cari = searchLaporan.toLowerCase();
    const matchCari = cari === '' || 
      t.items.some(i => i.nama.toLowerCase().includes(cari)) || 
      (t.metode && t.metode.toLowerCase().includes(cari));
      
    if (!matchCari) return false;

    const dateObj = t.waktu.toDate(); const today = new Date();
    if (reportFilter === 'hari') return dateObj.toDateString() === today.toDateString();
    else if (reportFilter === 'minggu') return dateObj >= new Date(today.setDate(today.getDate() - today.getDay()));
    else if (reportFilter === 'bulan') return dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
    return true;
  });

  const exportExcel = () => {
    const headers = ["Tanggal,Jam,Metode Pembayaran,Item,Total,Tunai,Kembali"];
    const rows = filteredTransaksi.map(t => {
      const d = t.waktu?.toDate();
      const items = t.items.map(i => `${i.qty} ${i.satuan || 'Pcs'} ${i.nama}`).join(' + ');
      return `${d.toLocaleDateString('id-ID')},${d.toLocaleTimeString('id-ID')},${t.metode || 'Tunai'},"${items}",${t.total},${t.uangBayar},${t.kembalian}`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + headers.concat(rows).join("\n")));
    link.setAttribute("download", `Laporan_Kasir.csv`);
    document.body.appendChild(link); link.click();
  };

  const getChartData = () => {
    let labels = []; let values = []; const now = new Date();
    if (chartFilter === 'jam') {
      const todayTrans = transaksi.filter(t => t.waktu && t.waktu.toDate().toDateString() === now.toDateString());
      for(let i=8; i<=22; i+=2) {
        labels.push(`${i}:00`); values.push(todayTrans.filter(t => t.waktu.toDate().getHours() >= i && t.waktu.toDate().getHours() < i+2).reduce((s, t) => s + t.total, 0));
      }
    } else if (chartFilter === 'hari') {
      for(let i=6; i>=0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        labels.push(`${d.getDate()}/${d.getMonth()+1}`); values.push(transaksi.filter(t => t.waktu && t.waktu.toDate().toDateString() === d.toDateString()).reduce((s, t) => s + t.total, 0));
      }
    } else if (chartFilter === 'bulan') {
      for(let i=5; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(d.toLocaleString('default', { month: 'short' })); values.push(transaksi.filter(t => t.waktu && t.waktu.toDate().getMonth() === d.getMonth() && t.waktu.toDate().getFullYear() === d.getFullYear()).reduce((s, t) => s + t.total, 0));
      }
    } else if (chartFilter === 'tahun') {
      for(let i=4; i>=0; i--) {
        const year = now.getFullYear() - i;
        labels.push(year); values.push(transaksi.filter(t => t.waktu && t.waktu.toDate().getFullYear() === year).reduce((s, t) => s + t.total, 0));
      }
    }
    const max = Math.max(...values, 1);
    return { data: labels.map((l, i) => ({ label: l, total: values[i] })), max };
  };
  const chartData = getChartData();

  // =========================================================================
  // UI START 
  // =========================================================================

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: "'Inter', sans-serif", color: '#ea580c' }}><strong>Memuat Sistem...</strong></div>;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: 'white', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(234, 88, 12, 0.15)', width: '100%', maxWidth: '420px', zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>Selamat Datang di Aplikasi</div>
            <h1 style={{ fontSize: '30px', fontWeight: '900', color: '#1e293b', margin: 0 }}>POS MODERN PRO</h1>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '8px 0 0 0', fontWeight: '600' }}>Sistem Kasir Bisnis Terpadu</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}><input type="email" placeholder="Alamat Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #fed7aa', borderRadius: '12px', fontSize: '16px', background: '#fffaf5', outline: 'none', boxSizing: 'border-box' }} /></div>
            <div style={{ marginBottom: '32px' }}><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #fed7aa', borderRadius: '12px', fontSize: '16px', background: '#fffaf5', outline: 'none', boxSizing: 'border-box' }} /></div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 10px 15px -3px rgba(234, 88, 12, 0.4)' }}>{isRegister ? 'BUAT AKUN BARU' : 'MASUK KE SISTEM'}</button>
          </form>
          <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', color: '#ea580c', marginTop: '24px', textAlign: 'center', fontSize: '14px', fontWeight: '700' }}>{isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar disini'}</p>
        </div>
        <div style={{ position: 'absolute', bottom: '20px', right: '24px', color: '#94a3b8', fontSize: '12px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>created by : Muhamad Rofiki</div>
      </div>
    );
  }

  // SCRIPT LAYOUT MASTER UTAMA (KUNCI LAYAR PENUH)
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: '#f8fafc', overflow: 'hidden' }}>
      
      {/* HEADER STATIC */}
      <header className="no-print" style={{ flex: 'none', height: '70px', background: 'white', padding: '0 24px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 40, boxSizing: 'border-box' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#ea580c' }}>{namaToko || 'POS MODERN PRO'}</h1>
          <p style={{ margin: '0', color: '#64748b', fontSize: '11px', fontWeight: '600' }}>Akun: {user.email}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setShowProfileModal(true)} style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#ea580c' }}>👤</button>
          <button onClick={() => signOut(auth)} style={{ padding: '8px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>Logout</button>
        </div>
      </header>

      {/* CONTAINER HALAMAN UTAMA (TINGGI TEPAT DI ANTARA HEADER & NAV BAWAH, TIDAK SCROLL FULL) */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          
          {/* --- TAB DASHBOARD --- */}
          {activeTab === 'dashboard' && (
            <div style={{ height: '100%', overflowY: 'auto', padding: '24px', boxSizing: 'border-box' }}>
              <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                {/* 4 Kotak Atas */}
                <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(234, 88, 12, 0.15)' }}>
                    <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px', fontWeight: '600' }}>Omzet Hari Ini</div>
                    <div style={{ fontSize: '26px', fontWeight: '800' }}>Rp {dashboardStats.todaySales.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(185, 28, 28, 0.15)' }}>
                    <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px', fontWeight: '600' }}>Pengeluaran Hari Ini</div>
                    <div style={{ fontSize: '26px', fontWeight: '800' }}>Rp {dashboardStats.totalPengeluaran.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(5, 150, 105, 0.15)' }}>
                    <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px', fontWeight: '600' }}>Laba Bersih Hari Ini</div>
                    <div style={{ fontSize: '26px', fontWeight: '800' }}>Rp {dashboardStats.labaBersih.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(3, 105, 161, 0.15)' }}>
                    <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px', fontWeight: '600' }}>Produk & Stok Tipis</div>
                    <div style={{ fontSize: '26px', fontWeight: '800' }}>{dashboardStats.totalProducts} <span style={{ fontSize: '14px', fontWeight: '500' }}>/ {dashboardStats.lowStock} Tipis</span></div>
                  </div>
                </div>

                {/* Grafik Bawah (Otomatis Mengisi Sisa Tinggi) */}
                <div style={{ flex: 1, background: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px' }}>📈 Grafik Pendapatan</h3>
                    <select value={chartFilter} onChange={(e) => setChartFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #fed7aa', outline: 'none', fontWeight: '700', color: '#ea580c', background: '#fff7ed', fontSize: '13px' }}>
                      <option value="jam">Hari Ini (Per Jam)</option><option value="hari">7 Hari Terakhir</option><option value="bulan">6 Bulan Terakhir</option><option value="tahun">5 Tahun Terakhir</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '15px', paddingTop: '10px' }}>
                    {chartData.data.map((d, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <div style={{ fontSize: '11px', color: '#ea580c', fontWeight: '800', marginBottom: '6px', textAlign: 'center' }}>{d.total > 0 ? `Rp${(d.total/1000)}k` : ''}</div>
                        {/* Batas maksimal lebar bar grafik agar tidak terlalu gemuk */}
                        <div style={{ width: '100%', maxWidth: '50px', background: 'linear-gradient(to top, #fdba74, #ea580c)', borderRadius: '6px 6px 0 0', height: `${(d.total / chartData.max) * 100}%`, minHeight: '8px', transition: '1s ease-out' }}></div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '10px', fontWeight: '700', textAlign: 'center' }}>{d.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB KASIR (FIXED LAYOUT KIRI KANAN) --- */}
          {activeTab === 'kasir' && (
            <div className="desktop-row-mobile-col" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box' }}>
              
              {/* KIRI: PRODUK & PENCARIAN (HANYA INI YANG SCROLL) */}
              <div className="kasir-left-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ flex: 'none', display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <input type="text" placeholder="🔍 Cari nama produk..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: '10px', fontSize: '14px', outline: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} />
                  <form onSubmit={handleManualScan} style={{ flex: 1 }}>
                    <input type="text" placeholder="🔫 Scan Barcode..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} autoFocus style={{ width: '100%', padding: '12px 16px', border: '2px solid #ea580c', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} />
                  </form>
                  <button onClick={() => setIsScanningKasir(!isScanningKasir)} style={{ padding: '12px 16px', background: isScanningKasir ? '#ef4444' : '#1e293b', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                    {isScanningKasir ? 'Tutup Kamera' : '📸 Kamera'}
                  </button>
                </div>

                {isScanningKasir && (
                  <div style={{ flex: 'none', background: '#1e293b', padding: '16px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center' }}>
                    <p style={{ color: 'white', margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '14px' }}>Arahkan Barcode ke Kamera</p>
                    <div id="reader-kasir" style={{ width: '100%', maxWidth: '300px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px', border: '2px solid #ea580c' }}></div>
                  </div>
                )}

                {/* SCROLL AREA PRODUK KIRI */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px' }}>
                  <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                    {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                      <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', border: p.stok === 0 ? '2px solid #fee2e2' : '2px solid transparent', position: 'relative', transition: 'transform 0.1s, border 0.1s' }} onMouseEnter={(e) => {e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.border = '2px solid #ea580c';}} onMouseLeave={(e) => {e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.border = p.stok === 0 ? '2px solid #fee2e2' : '2px solid transparent';}}>
                        {p.stok <= 5 && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px' }}>{p.stok === 0 ? 'HABIS' : 'TIPIS'}</div>}
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: '#1e293b', lineHeight: '1.2' }}>{p.nama}</h3>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#ea580c', marginBottom: '8px' }}>Rp {p.harga.toLocaleString()}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ background: '#fff7ed', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}><span style={{ color: p.stok > 0 ? '#ea580c' : '#ef4444' }}>{p.stok} {p.satuan || 'Pcs'}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* KANAN: KERANJANG (DIPERLEBAR JADI 420px, DIAM, DALAMNYA SAJA YANG SCROLL) */}
              <div className="kasir-right-panel" style={{ flex: '0 0 420px', background: 'white', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={{ flex: 'none', padding: '16px 20px', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffaf5' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>🛒 Keranjang ({cart.length})</h2>
                  {cart.length > 0 && <button onClick={() => { setCart([]); setPaymentAmount(''); setMetodePembayaran('Tunai'); }} style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: '700', cursor: 'pointer', transition: '0.2s', fontSize: '11px' }}>Kosongkan</button>}
                </div>
                
                {/* SCROLL AREA KERANJANG */}
                <div className="cart-list" style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                  {cart.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '30px', fontSize: '13px', fontWeight: '500' }}>Belum ada pesanan...</div> : 
                    cart.map(item => (
                    <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 0', borderBottom: '1px dashed #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#334155' }}>{item.nama} <span style={{fontSize:'11px', color:'#94a3b8'}}>({item.satuan || 'Pcs'})</span></h3>
                        <button onClick={() => updateQuantity(item.id, 0)} style={{ background: '#fee2e2', border: 'none', color: '#dc2626', width: '20px', height: '20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>×</button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: '900', color: '#ea580c' }}>Rp {(item.harga * item.qty).toLocaleString()}</div>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                          <button onClick={() => updateQuantity(item.id, item.qty - 1)} style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#f1f5f9', border: 'none', color: '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>−</button>
                          <input type="number" value={item.qty} onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)} style={{ width: '30px', textAlign: 'center', background: 'transparent', border: 'none', fontSize: '13px', fontWeight: '800', color: '#1e293b', outline: 'none' }} />
                          <button onClick={() => addToCart(item)} style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#ea580c', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AREA PEMBAYARAN BAWAH */}
                <div style={{ flex: 'none', padding: '16px 20px', background: '#fffaf5', borderTop: '2px solid #fed7aa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>Total Pembelian:</span>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b' }}>Rp {totalAmount.toLocaleString()}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                    {['Tunai', 'QRIS', 'Transfer'].map(metode => (
                      <button
                        key={metode}
                        onClick={() => { setMetodePembayaran(metode); if(metode !== 'Tunai') setPaymentAmount(totalAmount); else setPaymentAmount(''); }}
                        style={{
                          flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '12px',
                          background: metodePembayaran === metode ? '#ea580c' : '#f1f5f9', color: metodePembayaran === metode ? 'white' : '#64748b',
                          border: metodePembayaran === metode ? 'none' : '1px solid #cbd5e1', transition: 'all 0.2s'
                        }}
                      >
                        {metode === 'Tunai' ? '💵 Tunai' : metode === 'QRIS' ? '📱 QRIS' : '💳 Transfer'}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    {metodePembayaran === 'Tunai' ? (
                      <>
                        <input type="number" placeholder="Nominal (Rp)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: paymentAmount !== '' && Number(paymentAmount) < totalAmount ? '2px solid #ef4444' : '2px solid #cbd5e1', fontSize: '16px', fontWeight: '800', outline: 'none', background: 'white', color: '#1e293b', boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          <button onClick={() => setPaymentAmount(totalAmount)} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', color: '#475569' }}>Pas</button>
                          <button onClick={() => setPaymentAmount(50000)} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', color: '#475569' }}>50k</button>
                          <button onClick={() => setPaymentAmount(100000)} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', color: '#475569' }}>100k</button>
                        </div>
                      </>
                    ) : metodePembayaran === 'QRIS' ? (
                      <button onClick={() => setShowQrisModal(true)} disabled={!qrisImage} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: !qrisImage ? '#cbd5e1' : '#3b82f6', color: 'white', border: 'none', fontWeight: '800', cursor: !qrisImage ? 'not-allowed' : 'pointer', fontSize: '13px', textTransform: 'uppercase' }}>
                        {qrisImage ? '📱 TAMPILKAN QRIS' : '⚠️ QRIS BELUM DIATUR'}
                      </button>
                    ) : (
                      <div style={{ padding: '10px', background: '#eff6ff', color: '#0369a1', borderRadius: '8px', textAlign: 'center', fontWeight: '700', fontSize: '12px', border: '1px solid #bae6fd' }}>
                        💳 Pastikan transfer masuk sebelum cetak struk.
                      </div>
                    )}
                  </div>

                  {metodePembayaran === 'Tunai' && paymentAmount !== '' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '10px', background: Number(paymentAmount) >= totalAmount ? '#dcfce7' : '#fee2e2', borderRadius: '8px', border: `1px solid ${Number(paymentAmount) >= totalAmount ? '#bbf7d0' : '#fecaca'}` }}>
                      <span style={{ fontWeight: '800', fontSize: '12px', color: Number(paymentAmount) >= totalAmount ? '#166534' : '#dc2626' }}>
                        {Number(paymentAmount) >= totalAmount ? 'Kembalian:' : '⚠️ Uang Kurang:'}
                      </span>
                      <span style={{ fontWeight: '900', fontSize: '16px', color: Number(paymentAmount) >= totalAmount ? '#166534' : '#dc2626' }}>
                        Rp {Math.abs(kembalian).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <button onClick={processPayment} disabled={cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))} style={{ width: '100%', padding: '14px', background: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))) ? '#e2e8f0' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))) ? '#94a3b8' : 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))) ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    BAYAR & CETAK
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB TOKO (FULL LAYOUT KIRI-KANAN) --- */}
          {activeTab === 'toko' && (
            <div className="desktop-row-mobile-col mobile-reverse" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box' }}>
              
              <div className="table-section scrollable-box" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px', fontWeight: '800' }}>📦 Database Produk</h3>
                  <button onClick={() => { setPrintData(produk); setPrintMode('label'); }} style={{ background: '#f59e0b', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                    🖨️ Cetak Semua Barcode
                  </button>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Nama Produk</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Harga</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Stok</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Barcode</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produk.length === 0 ? <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Belum ada produk.</td></tr> : 
                        produk.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>{p.nama}</td>
                          <td style={{ padding: '12px 16px', fontWeight: '800', color: '#ea580c', fontSize: '13px' }}>Rp {p.harga.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px' }}><span style={{ background: p.stok < 5 ? '#fee2e2' : '#fff7ed', color: p.stok < 5 ? '#dc2626' : '#ea580c', padding: '4px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '11px' }}>{p.stok} {p.satuan || 'Pcs'}</span></td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b', fontSize: '12px' }}>{p.barcode}</td>
                          <td style={{ padding: '12px 16px', display: 'flex', gap: '6px' }}>
                            <button onClick={() => { setPrintData([p]); setPrintMode('label'); }} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '6px', color: '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>Cetak</button>
                            <button onClick={async () => { if(window.confirm('Yakin ingin menghapus produk ini?')) await deleteDoc(doc(db, "produk", p.id)); }} style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>Hapus</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="form-section sticky-box" style={{ flex: '0 0 350px', overflowY: 'auto', height: '100%' }}>
                <form onSubmit={simpanProduk} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: '#1e293b', fontSize: '18px', fontWeight: '800' }}>➕ Tambah Produk</h3>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '6px' }}>Nama Produk</label>
                  <input value={namaProd} onChange={e => setNamaProd(e.target.value)} required style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '6px' }}>Harga (Rp)</label>
                      <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '6px' }}>Stok Awal</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" style={{ width: '55%', padding: '12px 6px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                        <select value={satuanProd} onChange={e => setSatuanProd(e.target.value)} style={{ width: '45%', padding: '12px 4px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '11px', fontWeight: 'bold', outline: 'none' }}>
                          <option value="Pcs">Pcs</option><option value="Kg">Kg</option><option value="Gram">Gram</option><option value="Liter">Liter</option><option value="Pack">Pack</option><option value="Box">Box</option><option value="Cup">Cup</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '6px' }}>Barcode Produk</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Kosong = Otomatis" style={{ flex: 1, padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                    <button type="button" onClick={() => setIsScanningToko(!isScanningToko)} style={{ padding: '0 16px', background: '#ea580c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                      📸 Scan
                    </button>
                  </div>
                  {isScanningToko && (
                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center' }}>
                      <p style={{ color: 'white', margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold' }}>Arahkan Barcode ke Kamera</p>
                      <div id="reader-toko" style={{ width: '100%', maxWidth: '300px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px' }}></div>
                    </div>
                  )}
                  <button type="submit" style={{ width: '100%', padding: '14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    SIMPAN PRODUK
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* --- TAB PENGELUARAN (FULL LAYOUT KIRI-KANAN) --- */}
          {activeTab === 'pengeluaran' && (
            <div className="desktop-row-mobile-col mobile-reverse" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box' }}>
              
              <div className="table-section scrollable-box" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <h3 style={{ flex: 'none', margin: '0 0 20px 0', color: '#1e293b', fontSize: '18px', fontWeight: '800' }}>💸 Riwayat Pengeluaran Toko</h3>
                
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Tanggal & Waktu</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Keterangan</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Nominal</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pengeluaran.length === 0 ? <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Belum ada pengeluaran.</td></tr> : 
                        pengeluaran.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '500' }}>{p.waktu?.toDate().toLocaleString('id-ID')}</td>
                          <td style={{ padding: '12px 16px', fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>{p.nama}</td>
                          <td style={{ padding: '12px 16px', fontWeight: '800', color: '#e11d48', fontSize: '14px' }}>- Rp {p.nominal.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <button onClick={async () => { if(window.confirm('Yakin hapus data ini?')) await deleteDoc(doc(db, "pengeluaran", p.id)); }} style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>Hapus</button>
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
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '6px' }}>Keterangan (Contoh: Bayar Listrik, Kulakan)</label>
                  <input value={namaPengeluaran} onChange={e => setNamaPengeluaran(e.target.value)} required style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '6px' }}>Nominal Pengeluaran (Rp)</label>
                  <input value={nominalPengeluaran} onChange={e => setNominalPengeluaran(e.target.value)} required type="number" style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                  <button type="submit" style={{ width: '100%', padding: '14px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>SIMPAN PENGELUARAN</button>
                </form>
              </div>
            </div>
          )}

          {/* --- TAB LAPORAN (COMPACT, FILTER LENGKAP, SCROLL INTERNAL) --- */}
          {activeTab === 'laporan' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', boxSizing: 'border-box', maxWidth: '1000px', margin: '0 auto' }}>
              <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ fontSize: '22px', margin: 0, color: '#1e293b', fontWeight: '800' }}>📋 Laporan Transaksi</h2>
                <button onClick={exportExcel} style={{ padding: '10px 20px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>📥 Download Excel</button>
              </div>
              
              {/* Kolom Pencarian & Filter (FITUR BARU) */}
              <div style={{ flex: 'none', background: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="🔍 Cari transaksi, nama barang, atau metode bayar..." value={searchLaporan} onChange={(e) => setSearchLaporan(e.target.value)} style={{ flex: 2, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', minWidth: '200px' }} />
                <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} style={{ flex: 1, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', fontSize: '13px', fontWeight: '600', color: '#334155', outline: 'none', minWidth: '150px' }}>
                  <option value="hari">📅 Hari Ini</option><option value="minggu">📈 Minggu Ini</option><option value="bulan">📉 Bulan Ini</option><option value="semua">📂 Semua Waktu</option>
                </select>
              </div>

              {/* Data Transaksi yang Diperkecil Barisnya agar muat banyak dan bisa di-scroll */}
              <div style={{ flex: 1, background: 'white', borderRadius: '16px', overflowY: 'auto', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                {filteredTransaksi.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>Belum ada data transaksi sesuai pencarian.</div> : 
                  filteredTransaksi.map(t => (
                  <div key={t.id} style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '13px', marginBottom: '6px' }}>{t.waktu?.toDate().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} - {t.waktu?.toDate().toLocaleTimeString('id-ID')}</div>
                      <div style={{ color: '#475569', fontSize: '12px', background: '#fff7ed', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', fontWeight: '700', marginBottom: '4px' }}>{t.items.map(i => `${i.qty} ${i.satuan||'Pcs'} ${i.nama}`).join(', ')}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>Metode: <span style={{ color: t.metode === 'Tunai' ? '#ea580c' : '#0ea5e9' }}>{t.metode || 'Tunai'}</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '900', color: '#ea580c', fontSize: '16px', marginBottom: '4px' }}>Rp {t.total.toLocaleString()}</div>
                      {t.metode === 'Tunai' && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Tunai: Rp {t.uangBayar?.toLocaleString()} <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span> Kem: Rp {t.kembalian?.toLocaleString()}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* --- MODAL EDIT PROFIL TOKO --- */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', overflowY: 'auto' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '22px', fontWeight: '800' }}>⚙️ Profil Toko & QRIS</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '20px', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}>×</button>
            </div>
            
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'block' }}>Nama Toko / Perusahaan</label>
            <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Contoh: PT Adi Jaya" style={{ width: '100%', padding: '14px', marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} />
            
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'block' }}>Alamat Lengkap</label>
            <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Contoh: Jl. Sudirman No 12..." style={{ width: '100%', padding: '14px', marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} />
            
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'block' }}>Nomor Telepon / WhatsApp</label>
            <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="Contoh: 08123456789" style={{ width: '100%', padding: '14px', marginBottom: '20px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} />
            
            <div style={{ background: '#fffaf5', padding: '16px', borderRadius: '16px', marginBottom: '24px', border: '2px dashed #fed7aa' }}>
              <label style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', marginBottom: '8px', display: 'block' }}>📱 Upload Gambar QRIS Toko</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ fontSize: '12px', marginBottom: '12px', display: qrisImage ? 'none' : 'block' }} />
              {qrisImage && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', margin: '0 0 8px 0' }}>✓ Gambar QRIS Tersimpan</p>
                  <img src={qrisImage} alt="QRIS" style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '12px' }} />
                  <div>
                    <button onClick={() => setQrisImage('')} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                      🗑️ Hapus & Ganti Gambar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button onClick={simpanProfil} style={{ width: '100%', padding: '16px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '15px' }}>SIMPAN PENGATURAN</button>
          </div>
        </div>
      )}

      {/* --- MODAL POP-UP TAMPIL QRIS SAAT BAYAR --- */}
      {showQrisModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '24px', fontWeight: '800' }}>Silakan Scan QRIS</h2>
            <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '14px' }}>Total Tagihan: <strong style={{ color: '#ea580c', fontSize: '18px' }}>Rp {totalAmount.toLocaleString()}</strong></p>
            
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', display: 'inline-block', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <img src={qrisImage} alt="QRIS Toko" style={{ width: '100%', maxWidth: '300px', height: 'auto', borderRadius: '8px' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowQrisModal(false)} style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>TUTUP</button>
              <button onClick={processPayment} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '14px', boxShadow: '0 10px 15px -3px rgba(234, 88, 12, 0.4)' }}>SUDAH DIBAYAR</button>
            </div>
          </div>
        </div>
      )}

      {/* --- STRUK AREA (AUTO PRINT) --- */}
      {strukData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div id="strukArea" style={{ background: '#fff', width: '320px', padding: '24px', textAlign: 'center', color: '#000', fontFamily: 'monospace' }}>
            <h2 style={{ margin: '0' }}>{namaToko || 'STRUK BELANJA'}</h2>
            <p style={{ fontSize: '12px', margin: '5px 0' }}>{alamat}<br/>Telp/WA: {noTelp}</p>
            <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
            <p style={{ fontSize: '12px', textAlign: 'left' }}>Tgl: {strukData.waktu.toLocaleString()}<br/>Metode: {strukData.metode}</p>
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
              <button onClick={() => window.print()} style={{ flex: 1, background: '#ea580c', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Print</button>
              <button onClick={() => setStrukData(null)} style={{ flex: 1, background: '#e2e8f0', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LABEL BARCODE --- */}
      {printMode === 'label' && printData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, overflowY: 'auto' }}>
          <div className="no-print" style={{ textAlign: 'center', padding: '15px', background: '#1e293b', position: 'sticky', top: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
            <button onClick={() => window.print()} style={{ background: '#ea580c', color: 'white', padding: '12px 24px', border: 'none', marginRight: '15px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>🖨️ Print Label</button>
            <button onClick={() => setPrintMode(null)} style={{ background: '#f8fafc', color: '#334155', padding: '12px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>❌ Batal</button>
          </div>
          <div id="print-area" style={{ background: '#fff', width: '100%', minHeight: '100vh', padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', fontFamily: 'monospace' }}>
            {printData.map((p, i) => (
              <div key={i} style={{ border: '2px dashed #000', padding: '16px 20px', textAlign: 'center', width: '260px', height: 'fit-content', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>{namaToko || 'TOKO'}</div>
                <div style={{ fontSize: '15px', marginBottom: '10px', fontWeight: '900', color: '#000', lineHeight: '1.2' }}>{p.nama}</div>
                <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${p.barcode}&scale=2&height=12&includetext`} alt={p.barcode} style={{ width: '100%', height: 'auto', marginBottom: '8px' }} />
                <div style={{ fontWeight: '900', fontSize: '20px', color: '#000' }}>Rp {p.harga.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NAVIGASI BAWAH - WARNA KUNING MUSTARD & TEKS DIKEMBALIKAN */}
      <nav className="no-print" style={{ flex: 'none', height: '60px', background: '#fff9c4', borderTop: '1px solid #ffe082', display: 'flex', padding: '0', boxShadow: '0 -4px 15px rgba(0,0,0,0.05)', zIndex: 10, boxSizing: 'border-box' }}>
        {[ { id: 'dashboard', label: 'Dashboard', icon: '📊' }, { id: 'kasir', label: 'Kasir', icon: '💰' }, { id: 'toko', label: 'Produk', icon: '📦' }, { id: 'pengeluaran', label: 'Arus Kas', icon: '💸' }, { id: 'laporan', label: 'Laporan', icon: '📉' } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '5px', border: 'none', background: 'none', color: activeTab === tab.id ? '#ea580c' : '#94a3b8', fontSize: activeTab === tab.id ? '22px' : '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', position: 'relative', transition: 'all 0.2s', height: '100%' }}>
            <span style={{ transform: activeTab === tab.id ? 'translateY(-2px)' : 'none', transition: '0.2s' }}>{tab.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: activeTab === tab.id ? '800' : '600', textAlign: 'center' }}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* CSS PINTAR untuk ANTI BENTROK HP & PERBAIKAN HP/PC */}
      <style>{`
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
        ::-webkit-scrollbar-thumb:hover { background: #ea580c; }

        /* MENGATASI KELUHAN HP - KERANJANG TEGAK, PRODUK SCROLL KECIL */
        @media (max-width: 768px) {
          .desktop-row-mobile-col { flex-direction: column !important; flex-wrap: nowrap !important; width: 100% !important; max-width: none !important; margin: 0 !important; }
          .mobile-reverse { flex-direction: column-reverse !important; width: 100% !important; max-width: none !important; margin: 0 !important; }
          
          /* KASIR MOBILE: Batasi tinggi daftar produk agar keranjang tidak tenggelam */
          .kasir-left-panel { height: 35vh !important; flex: none !important; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 6px; }
          .kasir-right-panel { height: auto !important; flex: 1 !important; box-shadow: none !important; }
          
          /* Kecilkan Grid Produk HP agar lebih banyak muat */
          .kasir-left-panel .grid-container > div { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)) !important; gap: 8px !important; }
          .kasir-left-panel .grid-container > div > div { padding: 10px !important; border-radius: 8px !important; }
          .kasir-left-panel .grid-container > div > div h3 { font-size: 12px !important; }
          
          /* Tabel Section untuk HP */
          .table-section { max-height: 50vh !important; }
          .form-section { height: auto !important; flex: none !important; }
        }
      `}</style>
    </div>
  );
}

export default App;