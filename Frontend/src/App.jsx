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
  
  // FITUR ANTI HILANG SAAT REFRESH
  const [cart, setCart] = useState(() => {
    try { const saved = localStorage.getItem('kasirCart'); return saved ? JSON.parse(saved) : []; } 
    catch(e) { return []; }
  });
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard'); // Default langsung ke Dashboard
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Pembayaran & Kamera
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isScanningKasir, setIsScanningKasir] = useState(false);
  const [isScanningToko, setIsScanningToko] = useState(false);
  
  // Profil Modal (Garis Tiga)
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [strukData, setStrukData] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [printData, setPrintData] = useState(null);

  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');

  const [reportFilter, setReportFilter] = useState('hari');
  const [dashboardStats, setDashboardStats] = useState({ todaySales: 0, totalProducts: 0, lowStock: 0, totalTransactions: 0 });

  // --- EFEK & DATABASE ---
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).then(() => {
      onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    });
  }, []);

  // Simpan Keranjang ke Memori Tiap Ada Perubahan
  useEffect(() => {
    localStorage.setItem('kasirCart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "profilToko", user.uid)).then(d => {
      if(d.exists()) { setNamaToko(d.data().nama); setAlamat(d.data().alamat); setNoTelp(d.data().noTelp); }
    });

    const unsubProduk = onSnapshot(query(collection(db, "produk"), where("userId", "==", user.uid)), (snap) => {
      setProduk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubTrans = onSnapshot(query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc")), (snap) => {
      setTransaksi(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProduk(); unsubTrans(); };
  }, [user]);

  // Statistik Dashboard
  useEffect(() => {
    if (!produk.length && !transaksi.length) return;
    const today = new Date().toISOString().split('T')[0];
    const todayTrans = transaksi.filter(t => t.waktu && t.waktu.toDate().toISOString().split('T')[0] === today);
    setDashboardStats({
      totalProducts: produk.length,
      lowStock: produk.filter(p => p.stok < 5).length,
      todaySales: todayTrans.reduce((sum, t) => sum + t.total, 0),
      totalTransactions: todayTrans.length
    });
  }, [produk, transaksi]);

  // --- EFEK KAMERA ---
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
            if (found) {
              addToCart(found);
              setIsScanningKasir(false);
            } else {
              alert('❌ Barcode tidak terdaftar di database!');
              setIsScanningKasir(false);
            }
          } else {
            // Untuk form Toko
            setBarcodeProd(decodedText);
            setIsScanningToko(false);
          }
          html5QrCode.stop();
        },
        (error) => { /* abaikan error per frame */ }
      ).catch(err => {
        alert("Gagal membuka kamera! Pastikan izin kamera browser diizinkan.");
        setIsScanningKasir(false);
        setIsScanningToko(false);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [isScanningKasir, isScanningToko, produk]);

  // Auto Print
  useEffect(() => {
    if (strukData) { setTimeout(() => { window.print(); }, 800); }
  }, [strukData]);

  // --- LOGIKA MESIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (isRegister) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (error) { alert('Gagal: ' + error.message); } 
    finally { setLoading(false); }
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
  const kembalian = paymentAmount !== '' ? Number(paymentAmount) - totalAmount : 0;

  const processPayment = async () => {
    if (cart.length === 0 || Number(paymentAmount) < totalAmount) return alert('Uang bayar kurang atau keranjang kosong!');
    
    const dataTrans = {
      userId: user.uid,
      items: cart.map(i => ({nama: i.nama, harga: i.harga, qty: i.qty})),
      total: totalAmount,
      uangBayar: Number(paymentAmount),
      kembalian: kembalian,
      waktu: new Date()
    };

    try {
      await addDoc(collection(db, "transaksi"), { ...dataTrans, waktu: serverTimestamp() });
      for (const item of cart) { await updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) }); }
      setStrukData(dataTrans);
      setCart([]);
      setPaymentAmount('');
    } catch (err) { alert("Gagal memproses transaksi"); }
  };

  const simpanProduk = async (e) => {
    e.preventDefault();
    // Validasi Duplicate Barcode
    const checkDuplicate = produk.find(p => p.barcode === barcodeProd && barcodeProd !== "");
    if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan oleh produk lain!");

    const bcode = barcodeProd || Math.floor(100000000000 + Math.random() * 900000000000).toString();
    await addDoc(collection(db, "produk"), { nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: bcode, userId: user.uid, createdAt: new Date() });
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd('');
    alert("Produk Berhasil Ditambah!");
  };

  const simpanProfil = async () => {
    await setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp });
    alert("Profil Tersimpan!");
    setShowProfileModal(false);
  };

  const filteredTransaksi = transaksi.filter(t => {
    if (!t.waktu) return false;
    const dateObj = t.waktu.toDate();
    const today = new Date();
    if (reportFilter === 'hari') return dateObj.toDateString() === today.toDateString();
    else if (reportFilter === 'minggu') return dateObj >= new Date(today.setDate(today.getDate() - today.getDay()));
    else if (reportFilter === 'bulan') return dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
    return true;
  });

  const exportExcel = () => {
    const headers = ["Tanggal,Jam,Item,Total,Tunai,Kembali"];
    const rows = filteredTransaksi.map(t => {
      const d = t.waktu?.toDate();
      const items = t.items.map(i => `${i.qty}x ${i.nama}`).join(' + ');
      return `${d.toLocaleDateString('id-ID')},${d.toLocaleTimeString('id-ID')},"${items}",${t.total},${t.uangBayar},${t.kembalian}`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + headers.concat(rows).join("\n")));
    link.setAttribute("download", `Laporan_Kasir.csv`);
    document.body.appendChild(link);
    link.click();
  };

  // Logika Grafik 7 Hari
  const getLast7DaysData = () => {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
    
    let max = 1;
    const data = days.map(date => {
      const dayTrans = transaksi.filter(t => t.waktu && t.waktu.toDate().toISOString().split('T')[0] === date);
      const total = dayTrans.reduce((sum, t) => sum + t.total, 0);
      if(total > max) max = total;
      return { date: date.slice(-2), total }; 
    });
    return { data, max };
  };
  const chartData = getLast7DaysData();

  // =========================================================================
  // UI START
  // =========================================================================

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: "'Inter', sans-serif", color: '#10b981' }}><strong>Memuat Sistem...</strong></div>;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: 'white', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '800', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              POS MODERN PRO
            </h1>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '8px 0 0 0', fontWeight: '500' }}>Sistem Kasir Profesional</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <input type="email" placeholder="Alamat Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {isRegister ? 'BUAT AKUN BARU' : 'MASUK KE SISTEM'}
            </button>
          </form>
          <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', color: '#3b82f6', marginTop: '24px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>
            {isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar disini'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: '#f1f5f9' }}>
      
      {/* HEADER ELEGANT DENGAN ICON PROFIL */}
      <header className="no-print" style={{ background: 'white', padding: '16px 24px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {namaToko || 'POS MODERN PRO'}
          </h1>
          <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px', fontWeight: '500' }}>Akun: {user.email}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => setShowProfileModal(true)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', color: '#334155' }}>
            👤
          </button>
          <button onClick={() => signOut(auth)} style={{ padding: '10px 20px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'auto', paddingBottom: '100px' }}>
        
        {/* --- TAB DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', marginBottom: '24px' }}>📊 Dashboard</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: '15px', opacity: 0.9, marginBottom: '8px', fontWeight: '500' }}>Penjualan Hari Ini</div>
                <div style={{ fontSize: '36px', fontWeight: '800' }}>Rp {dashboardStats.todaySales.toLocaleString()}</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)' }}>
                <div style={{ fontSize: '15px', opacity: 0.9, marginBottom: '8px', fontWeight: '500' }}>Total Produk di Sistem</div>
                <div style={{ fontSize: '36px', fontWeight: '800' }}>{dashboardStats.totalProducts} <span style={{ fontSize: '18px', fontWeight: '500' }}>Item</span></div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3)' }}>
                <div style={{ fontSize: '15px', opacity: 0.9, marginBottom: '8px', fontWeight: '500' }}>Peringatan Stok Menipis (&lt;5)</div>
                <div style={{ fontSize: '36px', fontWeight: '800' }}>{dashboardStats.lowStock} <span style={{ fontSize: '18px', fontWeight: '500' }}>Item</span></div>
              </div>
            </div>

            <div style={{ background: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 24px 0', color: '#1e293b', fontSize: '20px' }}>📈 Grafik Penjualan 7 Hari Terakhir</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', height: '250px', gap: '15px', paddingTop: '20px' }}>
                {chartData.data.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '800', marginBottom: '8px' }}>{d.total > 0 ? `Rp${(d.total/1000)}k` : ''}</div>
                    <div style={{ width: '100%', background: 'linear-gradient(to top, #10b981, #34d399)', borderRadius: '6px 6px 0 0', height: `${(d.total / chartData.max) * 100}%`, minHeight: '8px', transition: '1s ease-out' }}></div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '12px', fontWeight: '600' }}>Tgl {d.date}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB KASIR (SPLIT SCREEN YANG SEMPURNA) --- */}
        {activeTab === 'kasir' && (
          <div style={{ padding: '24px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
            
            {/* KIRI: AREA PRODUK */}
            <div style={{ flex: '1 1 55%', minWidth: '320px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="🔍 Cari nama produk..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, padding: '16px 20px', border: 'none', borderRadius: '12px', fontSize: '16px', outline: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }} />
                <form onSubmit={handleManualScan} style={{ flex: 1 }}>
                  <input type="text" placeholder="🔫 Scan Alat Barcode..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} autoFocus style={{ width: '100%', padding: '16px 20px', border: '2px solid #10b981', borderRadius: '12px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }} />
                </form>
                <button onClick={() => setIsScanningKasir(!isScanningKasir)} style={{ padding: '16px 24px', background: isScanningKasir ? '#ef4444' : '#1e293b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                  {isScanningKasir ? 'Tutup Kamera' : '📸 Buka Kamera'}
                </button>
              </div>

              {isScanningKasir && (
                <div style={{ background: '#1e293b', padding: '20px', borderRadius: '16px', marginBottom: '24px', textAlign: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>
                  <p style={{ color: 'white', margin: '0 0 15px 0', fontWeight: 'bold', fontSize: '18px' }}>Arahkan Barcode ke Kamera</p>
                  <div id="reader-kasir" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: '12px', border: '3px solid #10b981' }}></div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                  <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', cursor: 'pointer', border: p.stok === 0 ? '2px solid #fee2e2' : '2px solid transparent', position: 'relative', transition: 'transform 0.2s, border 0.2s' }} onMouseEnter={(e) => {e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.border = '2px solid #10b981';}} onMouseLeave={(e) => {e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.border = p.stok === 0 ? '2px solid #fee2e2' : '2px solid transparent';}}>
                    {p.stok <= 5 && <div style={{ position: 'absolute', top: '12px', right: '12px', background: '#ef4444', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px' }}>{p.stok === 0 ? 'HABIS' : 'STOK TIPIS'}</div>}
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: '700', color: '#1e293b' }}>{p.nama}</h3>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: '#10b981', marginBottom: '12px' }}>Rp {p.harga.toLocaleString()}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontWeight: '600' }}>Stok: <span style={{ color: p.stok > 0 ? '#10b981' : '#ef4444' }}>{p.stok}</span></span>
                      <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{p.barcode || '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* KANAN: KERANJANG SIAP BAYAR */}
            <div style={{ flex: '1 1 350px', position: 'sticky', top: '90px', background: 'white', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '600px', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>🛒 Keranjang ({cart.length})</h2>
                {cart.length > 0 && <button onClick={() => { setCart([]); setPaymentAmount(''); }} style={{ background: '#fee2e2', border: 'none', padding: '8px 16px', borderRadius: '8px', color: '#dc2626', fontWeight: '700', cursor: 'pointer', transition: '0.2s' }}>Kosongkan</button>}
              </div>
              
              <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
                {cart.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '60px', fontSize: '16px', fontWeight: '500' }}>Belum ada pesanan...<br/>Pilih menu di sebelah kiri.</div> : 
                  cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 0', borderBottom: '1px dashed #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#334155' }}>{item.nama}</h3>
                      <button onClick={() => updateQuantity(item.id, 0)} style={{ background: '#fee2e2', border: 'none', color: '#dc2626', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#10b981' }}>Rp {(item.harga * item.qty).toLocaleString()}</div>
                      
                      {/* INPUT MANUAL QUANTITY DI KERANJANG */}
                      <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '4px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <button onClick={() => updateQuantity(item.id, item.qty - 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#f1f5f9', border: 'none', color: '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px' }}>−</button>
                        <input type="number" value={item.qty} onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)} style={{ width: '40px', textAlign: 'center', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: '800', color: '#1e293b', outline: 'none' }} />
                        <button onClick={() => addToCart(item)} style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#10b981', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px' }}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* AREA PEMBAYARAN KONSUMEN (TIDAK POP-UP) */}
              <div style={{ padding: '24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#475569' }}>Total Pembelian:</span>
                  <span style={{ fontSize: '26px', fontWeight: '900', color: '#10b981' }}>Rp {totalAmount.toLocaleString()}</span>
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '10px' }}>💵 Pembayaran Customer (Tunai):</label>
                  <input type="number" placeholder="Ketik Nominal Uang..." value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: paymentAmount !== '' && Number(paymentAmount) < totalAmount ? '2px solid #ef4444' : '2px solid #cbd5e1', fontSize: '20px', fontWeight: '800', outline: 'none', boxSizing: 'border-box', background: 'white', color: '#1e293b' }} />
                  
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button onClick={() => setPaymentAmount(totalAmount)} style={{ flex: 1, padding: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#475569' }}>Uang Pas</button>
                    <button onClick={() => setPaymentAmount(50000)} style={{ flex: 1, padding: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#475569' }}>50.000</button>
                    <button onClick={() => setPaymentAmount(100000)} style={{ flex: 1, padding: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#475569' }}>100.000</button>
                  </div>
                </div>

                {/* LOGIKA MERAH/HIJAU KEMBALIAN */}
                {paymentAmount !== '' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '16px', background: Number(paymentAmount) >= totalAmount ? '#dcfce7' : '#fee2e2', borderRadius: '12px', border: `1px solid ${Number(paymentAmount) >= totalAmount ? '#bbf7d0' : '#fecaca'}` }}>
                    <span style={{ fontWeight: '800', fontSize: '15px', color: Number(paymentAmount) >= totalAmount ? '#166534' : '#dc2626' }}>
                      {Number(paymentAmount) >= totalAmount ? 'Kembalian:' : '⚠️ Uang Kurang:'}
                    </span>
                    <span style={{ fontWeight: '900', fontSize: '20px', color: Number(paymentAmount) >= totalAmount ? '#166534' : '#dc2626' }}>
                      Rp {Math.abs(kembalian).toLocaleString()}
                    </span>
                  </div>
                )}

                <button onClick={processPayment} disabled={cart.length === 0 || paymentAmount === '' || Number(paymentAmount) < totalAmount} style={{ width: '100%', padding: '18px', background: (cart.length === 0 || paymentAmount === '' || Number(paymentAmount) < totalAmount) ? '#e2e8f0' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: (cart.length === 0 || paymentAmount === '' || Number(paymentAmount) < totalAmount) ? '#94a3b8' : 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: '800', cursor: (cart.length === 0 || paymentAmount === '' || Number(paymentAmount) < totalAmount) ? 'not-allowed' : 'pointer', boxShadow: (cart.length === 0 || paymentAmount === '' || Number(paymentAmount) < totalAmount) ? 'none' : '0 10px 20px -5px rgba(16, 185, 129, 0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  BAYAR & CETAK STRUK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB TOKO --- */}
        {activeTab === 'toko' && (
          <div style={{ padding: '32px 24px', maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', color: '#1e293b', marginBottom: '32px', fontWeight: '800' }}>🏪 Manajemen Toko & Produk</h2>
            
            <form onSubmit={simpanProduk} style={{ background: 'white', padding: '32px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', marginBottom: '32px' }}>
              <h3 style={{ marginTop: 0, color: '#10b981', fontSize: '20px', marginBottom: '24px' }}>➕ Tambah Produk Baru</h3>
              <input value={namaProd} onChange={e => setNamaProd(e.target.value)} required placeholder="Nama Produk" style={{ width: '100%', padding: '16px', marginBottom: '16px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', fontSize: '16px', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" placeholder="Harga Jual (Rp)" style={{ flex: 1, minWidth: '200px', padding: '16px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', fontSize: '16px', outline: 'none' }} />
                <input value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" placeholder="Stok Awal" style={{ flex: 1, minWidth: '200px', padding: '16px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', fontSize: '16px', outline: 'none' }} />
              </div>
              
              {/* INPUT BARCODE DENGAN TOMBOL KAMERA */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Barcode (Boleh kosong agar otomatis)" style={{ flex: 1, padding: '16px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', fontSize: '16px', outline: 'none' }} />
                <button type="button" onClick={() => setIsScanningToko(!isScanningToko)} style={{ padding: '0 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)' }}>
                  📸 Scan Label
                </button>
              </div>

              {isScanningToko && (
                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '16px', marginBottom: '24px', textAlign: 'center' }}>
                  <p style={{ color: 'white', margin: '0 0 10px 0', fontWeight: 'bold' }}>Scan Barcode Kemasan Produk</p>
                  <div id="reader-toko" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px' }}></div>
                </div>
              )}

              <button type="submit" style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '16px', boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.3)' }}>
                💾 SIMPAN PRODUK KE DATABASE
              </button>
            </form>

            {/* TABEL DATABASE PRODUK */}
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '20px' }}>📦 Tabel Database Produk</h3>
                <button onClick={() => { setPrintData(produk); setPrintMode('label'); }} style={{ background: '#f59e0b', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(245, 158, 11, 0.2)' }}>
                  🖨️ Cetak Semua Barcode
                </button>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '14px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '16px', borderBottom: '2px solid #e2e8f0' }}>Nama Produk</th>
                      <th style={{ padding: '16px', borderBottom: '2px solid #e2e8f0' }}>Harga</th>
                      <th style={{ padding: '16px', borderBottom: '2px solid #e2e8f0' }}>Stok</th>
                      <th style={{ padding: '16px', borderBottom: '2px solid #e2e8f0' }}>Barcode</th>
                      <th style={{ padding: '16px', borderBottom: '2px solid #e2e8f0' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produk.length === 0 ? <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Belum ada produk terdaftar.</td></tr> : 
                      produk.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={(e)=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding: '16px', fontWeight: '700', color: '#1e293b' }}>{p.nama}</td>
                        <td style={{ padding: '16px', fontWeight: '700', color: '#10b981' }}>Rp {p.harga.toLocaleString()}</td>
                        <td style={{ padding: '16px' }}><span style={{ background: p.stok < 5 ? '#fee2e2' : '#dcfce7', color: p.stok < 5 ? '#dc2626' : '#166534', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px' }}>{p.stok}</span></td>
                        <td style={{ padding: '16px', fontFamily: 'monospace', color: '#64748b' }}>{p.barcode}</td>
                        
                        {/* BAGIAN TOMBOL CETAK & HAPUS YANG DITAMBAHKAN */}
                        <td style={{ padding: '16px', display: 'flex', gap: '8px' }}>
                          <button onClick={() => { setPrintData([p]); setPrintMode('label'); }} style={{ background: '#3b82f6', border: 'none', padding: '8px 16px', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Cetak</button>
                          <button onClick={async () => { if(window.confirm('Yakin ingin menghapus produk ini?')) await deleteDoc(doc(db, "produk", p.id)); }} style={{ background: '#fee2e2', border: 'none', padding: '8px 16px', borderRadius: '8px', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Hapus</button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB LAPORAN --- */}
        {activeTab === 'laporan' && (
          <div style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '32px', color: '#1e293b', fontWeight: '800' }}>📋 Laporan Transaksi</h2>
            <div style={{ background: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} style={{ padding: '16px 24px', border: '2px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', fontSize: '16px', fontWeight: '600', color: '#334155', outline: 'none' }}>
                <option value="hari">📅 Rekap Hari Ini</option><option value="minggu">📈 Rekap Minggu Ini</option><option value="bulan">📉 Rekap Bulan Ini</option><option value="semua">📂 Semua Waktu</option>
              </select>
              <button onClick={exportExcel} style={{ padding: '16px 32px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }}>📥 Export / Download Excel</button>
            </div>

            <div style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
              {filteredTransaksi.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '16px', fontWeight: '500' }}>Belum ada transaksi di periode ini.</div> : 
                filteredTransaksi.map(t => (
                <div key={t.id} style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' }} onMouseEnter={(e)=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}>
                  <div>
                    <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '16px', marginBottom: '8px' }}>{t.waktu?.toDate().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {t.waktu?.toDate().toLocaleTimeString('id-ID')}</div>
                    <div style={{ color: '#475569', fontSize: '14px', background: '#f1f5f9', padding: '8px 16px', borderRadius: '8px', display: 'inline-block' }}>{t.items.map(i => `${i.qty}x ${i.nama}`).join(', ')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '900', color: '#10b981', fontSize: '22px', marginBottom: '4px' }}>Rp {t.total.toLocaleString()}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Tunai: Rp {t.uangBayar?.toLocaleString()} <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span> Kembali: Rp {t.kembalian?.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- MODAL EDIT PROFIL TOKO (DARI ICON GARIS TIGA/ORANG) --- */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'white', padding: '40px', borderRadius: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '22px', fontWeight: '800' }}>⚙️ Profil Toko (Struk)</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '20px', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}>×</button>
            </div>
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'block' }}>Nama Toko / Perusahaan</label>
            <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Contoh: PT Adi Jaya" style={{ width: '100%', padding: '16px', marginBottom: '16px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', fontSize: '16px', outline: 'none' }} />
            
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'block' }}>Alamat Lengkap</label>
            <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Contoh: Jl. Sudirman No 12..." style={{ width: '100%', padding: '16px', marginBottom: '16px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', fontSize: '16px', outline: 'none' }} />
            
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'block' }}>Nomor Telepon / WhatsApp</label>
            <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="Contoh: 08123456789" style={{ width: '100%', padding: '16px', marginBottom: '32px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', fontSize: '16px', outline: 'none' }} />
            
            <button onClick={simpanProfil} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '16px', boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.4)' }}>SIMPAN PENGATURAN</button>
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
            <p style={{ fontSize: '12px', textAlign: 'left' }}>Tgl: {strukData.waktu.toLocaleString()}</p>
            <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
            
            {strukData.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}>
                <span>{it.qty}x {it.nama}</span><span>{(it.harga * it.qty).toLocaleString()}</span>
              </div>
            ))}
            
            <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}><span>TOTAL</span><span>Rp {strukData.total.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}><span>TUNAI</span><span>Rp {strukData.uangBayar?.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}><span>KEMBALI</span><span>Rp {strukData.kembalian?.toLocaleString()}</span></div>
            <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>*** TERIMA KASIH ***</p>

            <div className="no-print" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, background: '#10b981', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Print</button>
              <button onClick={() => setStrukData(null)} style={{ flex: 1, background: '#e2e8f0', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LABEL BARCODE --- */}
      {printMode === 'label' && printData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, overflowY: 'auto' }}>
          <div className="no-print" style={{ textAlign: 'center', padding: '15px', background: '#1e293b', position: 'sticky', top: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
            <button onClick={() => window.print()} style={{ background: '#10b981', color: 'white', padding: '12px 24px', border: 'none', marginRight: '15px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>🖨️ Print Label</button>
            <button onClick={() => setPrintMode(null)} style={{ background: '#f8fafc', color: '#334155', padding: '12px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>❌ Batal</button>
          </div>
          <div id="print-area" style={{ background: '#fff', width: '100%', minHeight: '100vh', padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', fontFamily: 'monospace' }}>
            {printData.map((p, i) => (
              <div key={i} style={{ border: '2px solid #000', padding: '15px', textAlign: 'center', width: '150px', height: 'fit-content', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>{namaToko || 'TOKO'}</div>
                <div style={{ fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase' }}>{p.nama}</div>
                <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${p.barcode}&scale=2&height=10&includetext`} alt={p.barcode} style={{ maxWidth: '100%', height: 'auto' }} />
                <div style={{ fontWeight: 'bold', marginTop: '8px', fontSize: '16px' }}>Rp {p.harga.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NAVIGASI BAWAH */}
      <nav className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid #e2e8f0', display: 'flex', padding: '12px 0', boxShadow: '0 -10px 25px rgba(0,0,0,0.05)', zIndex: 10 }}>
        {[ { id: 'dashboard', label: 'Dashboard', icon: '📊' }, { id: 'kasir', label: 'Kasir', icon: '💰' }, { id: 'toko', label: 'Produk', icon: '📦' }, { id: 'laporan', label: 'Laporan', icon: '📉' } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '8px', border: 'none', background: 'none', color: activeTab === tab.id ? '#10b981' : '#94a3b8', fontSize: activeTab === tab.id ? '26px' : '22px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', position: 'relative', transition: 'all 0.2s' }}>
            <span style={{ transform: activeTab === tab.id ? 'translateY(-2px)' : 'none', transition: '0.2s' }}>{tab.icon}</span>
            <span style={{ fontSize: '12px', fontWeight: activeTab === tab.id ? '800' : '600' }}>{tab.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #strukArea, #strukArea * { visibility: visible; }
          #strukArea { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; padding: 0; margin: 0; }
        }
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}

export default App;