import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, increment, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { Html5Qrcode } from 'html5-qrcode'; // Kita pakai yang langsung auto-start

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
  const [cart, setCart] = useState([]);
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('kasir');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // State Pembayaran & Kamera
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
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

  // --- EFEK FIREBASE ---
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).then(() => {
      onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    });
  }, []);

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

  // --- EFEK SCANNER KAMERA (AUTO-START) ---
  useEffect(() => {
    let html5QrCode;
    if (isScanning && activeTab === 'kasir') {
      html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const found = produk.find(p => p.barcode === decodedText);
          if (found) {
            addToCart(found);
            setIsScanning(false);
            html5QrCode.stop();
          } else {
            alert('❌ Barcode tidak terdaftar!');
            setIsScanning(false);
            html5QrCode.stop();
          }
        },
        (error) => { /* abaikan error per frame */ }
      ).catch(err => {
        alert("Gagal membuka kamera! Pastikan izin kamera browser sudah diaktifkan.");
        setIsScanning(false);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [isScanning, produk, activeTab]);

  // --- AUTO PRINT SAAT STRUK MUNCUL ---
  useEffect(() => {
    if (strukData) {
      setTimeout(() => { window.print(); }, 800); // Otomatis print 0.8 detik setelah bayar
    }
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

  // UBAH ANGKA MANUAL
  const setQuantity = (id, newQty) => {
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

  const processPayment = async () => {
    if (Number(paymentAmount) < totalAmount) return alert('Uang bayar kurang!');
    const kembalian = Number(paymentAmount) - totalAmount;
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
      setShowPaymentModal(false);
    } catch (err) { alert("Gagal memproses transaksi"); }
  };

  const simpanProduk = async (e) => {
    e.preventDefault();
    const bcode = barcodeProd || Math.floor(100000000000 + Math.random() * 900000000000).toString();
    await addDoc(collection(db, "produk"), { nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: bcode, userId: user.uid, createdAt: new Date() });
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd('');
    alert("Produk Berhasil Ditambah!");
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

  // Logika Grafik 7 Hari (CSS Sederhana)
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
      return { date: date.slice(-2), total }; // ambil tanggal saja
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
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: 'white', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>POS Modern Pro</h1>
            <p style={{ color: '#64748b', margin: '8px 0 0 0' }}>Sistem Kasir Lengkap & Modern</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#fafbfc', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#fafbfc', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)' }}>
              {isRegister ? 'DAFTAR TOKO' : 'MASUK KE SISTEM'}
            </button>
          </form>
          <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', color: '#3b82f6', marginTop: '20px', textAlign: 'center', fontSize: '14px', fontWeight: '500' }}>
            {isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar disini'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: '#f8fafc' }}>
      
      {/* Header */}
      <header className="no-print" style={{ background: 'white', padding: '15px 24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {namaToko || 'POS Modern Pro'}
          </h1>
          <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px' }}>Akun: {user.email}</p>
        </div>
        <button onClick={() => signOut(auth)} style={{ padding: '10px 20px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Logout</button>
      </header>

      <main style={{ flex: 1, overflow: 'auto', paddingBottom: '100px' }}>
        
        {/* --- TAB DASHBOARD (DENGAN GRAFIK 7 HARI) --- */}
        {activeTab === 'dashboard' && (
          <div style={{ padding: '32px 24px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '24px' }}>📊 Dashboard</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Penjualan Hari Ini</div>
                <div style={{ fontSize: '32px', fontWeight: '700' }}>Rp {dashboardStats.todaySales.toLocaleString()}</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)' }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Produk & Stok Tipis</div>
                <div style={{ fontSize: '32px', fontWeight: '700' }}>{dashboardStats.totalProducts} <span style={{ fontSize: '16px' }}>/ {dashboardStats.lowStock} tipis</span></div>
              </div>
            </div>

            {/* GRAFIK PENJUALAN MINGGU INI */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#1e293b' }}>📈 Grafik Penjualan 7 Hari Terakhir</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', height: '200px', gap: '10px', paddingTop: '20px' }}>
                {chartData.data.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 'bold', marginBottom: '5px' }}>{d.total > 0 ? `Rp${(d.total/1000)}k` : ''}</div>
                    <div style={{ width: '100%', background: 'linear-gradient(to top, #10b981, #34d399)', borderRadius: '4px 4px 0 0', height: `${(d.total / chartData.max) * 100}%`, minHeight: '5px', transition: '1s' }}></div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '10px' }}>Tgl {d.date}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB KASIR SPLIT SCREEN --- */}
        {activeTab === 'kasir' && (
          <div style={{ padding: '24px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
            
            {/* BAGIAN KIRI: DAFTAR PRODUK & SCANNER */}
            <div style={{ flex: '1 1 55%', minWidth: '320px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="🔍 Cari nama produk..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', outline: 'none' }} />
                <form onSubmit={handleManualScan} style={{ flex: 1 }}>
                  <input type="text" placeholder="🔫 Scan Alat Barcode..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} autoFocus style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
                </form>
                <button onClick={() => setIsScanning(!isScanning)} style={{ padding: '16px 24px', background: isScanning ? '#ef4444' : '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                  {isScanning ? 'Tutup Kamera' : '📸 Buka Kamera'}
                </button>
              </div>

              {/* TAMPILAN KAMERA LANGSUNG */}
              {isScanning && (
                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '16px', marginBottom: '24px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  <p style={{ color: 'white', margin: '0 0 10px 0', fontWeight: 'bold' }}>Arahkan Barcode ke Kamera</p>
                  <div id="reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px' }}></div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                  <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer', border: p.stok === 0 ? '2px solid #fee2e2' : '2px solid transparent', position: 'relative', transition: '0.2s' }} onMouseEnter={(e) => e.currentTarget.style.border = '2px solid #10b981'} onMouseLeave={(e) => e.currentTarget.style.border = p.stok === 0 ? '2px solid #fee2e2' : '2px solid transparent'}>
                    {p.stok <= 5 && <div style={{ position: 'absolute', top: '12px', right: '12px', background: '#ef4444', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '700' }}>{p.stok === 0 ? 'HABIS' : 'STOK TIPIS'}</div>}
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{p.nama}</h3>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', marginBottom: '12px' }}>Rp {p.harga.toLocaleString()}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Stok: <strong style={{ color: p.stok > 0 ? '#10b981' : '#ef4444' }}>{p.stok}</strong></span>
                      <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{p.barcode || '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BAGIAN KANAN: KERANJANG SELALU TAMPIL */}
            <div style={{ flex: '1 1 350px', position: 'sticky', top: '90px', background: 'white', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: '500px' }}>
              <div style={{ padding: '20px 24px', borderBottom: '2px solid #f1f5f9' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>🛒 Keranjang ({cart.length})</h2>
              </div>
              
              <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
                {cart.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px' }}>Belum ada pesanan...</div> : 
                  cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{item.nama}</h3>
                      <button onClick={() => updateQuantity(item.id, 0)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '18px', cursor: 'pointer' }}>🗑️</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#10b981' }}>Rp {(item.harga * item.qty).toLocaleString()}</div>
                      
                      {/* BISA KETIK ANGKA MANUAL DISINI */}
                      <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <button onClick={() => updateQuantity(item.id, item.qty - 1)} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'white', border: 'none', color: '#1e293b', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>−</button>
                        
                        <input 
                          type="number" 
                          value={item.qty} 
                          onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)} 
                          style={{ width: '35px', textAlign: 'center', background: 'transparent', border: 'none', fontSize: '15px', fontWeight: '700', color: '#1e293b', outline: 'none' }} 
                        />
                        
                        <button onClick={() => addToCart(item)} style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#10b981', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '0 0 24px 24px', borderTop: '2px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '600', color: '#64748b' }}>Total Tagihan</span>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>Rp {totalAmount.toLocaleString()}</span>
                </div>
                <button onClick={() => { setShowPaymentModal(true); setPaymentAmount(''); }} disabled={cart.length === 0} style={{ width: '100%', padding: '16px', background: cart.length === 0 ? '#cbd5e1' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', boxShadow: cart.length === 0 ? 'none' : '0 10px 15px -3px rgba(16, 185, 129, 0.4)' }}>
                  BAYAR SEKARANG
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB TOKO & LAPORAN --- */}
        {activeTab === 'toko' && (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '28px', color: '#1e293b', marginBottom: '24px' }}>🏪 Manajemen Toko</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
              <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginTop: 0, color: '#10b981' }}>Identitas Struk</h3>
                <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama Toko" style={{ width: '100%', padding: '14px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '10px', boxSizing: 'border-box' }} />
                <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat Toko" style={{ width: '100%', padding: '14px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '10px', boxSizing: 'border-box' }} />
                <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="No WA" style={{ width: '100%', padding: '14px', marginBottom: '15px', border: '2px solid #e2e8f0', borderRadius: '10px', boxSizing: 'border-box' }} />
                <button onClick={async () => { await setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp }); alert("Tersimpan!"); }} style={{ width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan Profil</button>
              </div>

              <form onSubmit={simpanProduk} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginTop: 0, color: '#10b981' }}>Tambah Produk Baru</h3>
                <input value={namaProd} onChange={e => setNamaProd(e.target.value)} required placeholder="Nama Produk" style={{ width: '100%', padding: '14px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '10px', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" placeholder="Harga Jual" style={{ flex: 1, padding: '14px', border: '2px solid #e2e8f0', borderRadius: '10px', boxSizing: 'border-box' }} />
                  <input value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" placeholder="Stok Awal" style={{ flex: 1, padding: '14px', border: '2px solid #e2e8f0', borderRadius: '10px', boxSizing: 'border-box' }} />
                </div>
                <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Barcode (Kosong = Otomatis)" style={{ width: '100%', padding: '14px', marginBottom: '15px', border: '2px solid #e2e8f0', borderRadius: '10px', boxSizing: 'border-box' }} />
                <button type="submit" style={{ width: '100%', padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan Ke Database</button>
              </form>
            </div>
            
            <div style={{ marginTop: '24px', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>Cetak Label Barcode</h3>
                <button onClick={() => { setPrintData(produk); setPrintMode('label'); }} style={{ background: '#f59e0b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Print Semua Label</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {produk.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9', padding: '12px', borderRadius: '12px' }}>
                    <div><div style={{ fontWeight: 'bold' }}>{p.nama}</div><div style={{ fontSize: '12px', color: '#64748b' }}>Stok: {p.stok} | Barcode: {p.barcode}</div></div>
                    <button onClick={() => { setPrintData([p]); setPrintMode('label'); }} style={{ background: '#e2e8f0', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Print 1</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'laporan' && (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '24px', color: '#1e293b' }}>📊 Laporan Penjualan</h2>
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} style={{ padding: '14px', border: '2px solid #e2e8f0', borderRadius: '12px', background: 'white', fontSize: '16px', outline: 'none' }}>
                <option value="hari">📅 Hari Ini</option><option value="minggu">📈 Minggu Ini</option><option value="bulan">📉 Bulan Ini</option><option value="semua">📂 Semua Waktu</option>
              </select>
              <button onClick={exportExcel} style={{ padding: '14px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📥 Download Excel</button>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              {filteredTransaksi.length === 0 ? <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Belum ada transaksi di periode ini.</div> : 
                filteredTransaksi.map(t => (
                <div key={t.id} style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{t.waktu?.toDate().toLocaleDateString('id-ID')} - {t.waktu?.toDate().toLocaleTimeString('id-ID')}</div>
                    <div style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>{t.items.map(i => `${i.qty}x ${i.nama}`).join(', ')}</div>
                  </div>
                  <div style={{ fontWeight: 'bold', color: '#10b981', fontSize: '18px', textAlign: 'right' }}>
                    Rp {t.total.toLocaleString()}<br/>
                    <small style={{ fontSize: '12px', color: '#64748b' }}>Tunai: Rp {t.uangBayar?.toLocaleString()} | Kembali: Rp {t.kembalian?.toLocaleString()}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- PAYMENT MODAL (VALIDASI MERAH JIKA KURANG) --- */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#64748b' }}>Total Tagihan</h2>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981' }}>Rp {totalAmount.toLocaleString()}</div>
            </div>

            <div style={{ padding: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Uang Pembeli (Tunai)</label>
              <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" autoFocus style={{ width: '100%', padding: '16px 20px', border: Number(paymentAmount) < totalAmount && paymentAmount !== '' ? '3px solid #ef4444' : '3px solid #e2e8f0', borderRadius: '12px', fontSize: '24px', fontWeight: '700', textAlign: 'center', background: '#fafbfc', outline: 'none', boxSizing: 'border-box' }} />
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '24px' }}>
                  <button onClick={() => setPaymentAmount(totalAmount)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#1e293b' }}>Uang Pas</button>
                  <button onClick={() => setPaymentAmount(50000)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#1e293b' }}>50.000</button>
                  <button onClick={() => setPaymentAmount(100000)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#1e293b' }}>100.000</button>
              </div>

              {/* LOGIKA MERAH JIKA UANG KURANG */}
              {paymentAmount !== '' && (
                <div style={{ background: Number(paymentAmount) >= totalAmount ? '#dcfce7' : '#fee2e2', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: Number(paymentAmount) >= totalAmount ? '#166534' : '#dc2626' }}>
                    {Number(paymentAmount) >= totalAmount ? `Kembali Rp ${(Number(paymentAmount) - totalAmount).toLocaleString()}` : `Kurang Rp ${(totalAmount - Number(paymentAmount)).toLocaleString()}`}
                  </div>
                  <div style={{ fontSize: '14px', color: Number(paymentAmount) >= totalAmount ? '#166534' : '#dc2626', fontWeight: '600', marginTop: '5px' }}>
                    {Number(paymentAmount) >= totalAmount ? 'Kembalian Pembeli' : '⚠️ Uang Tidak Cukup!'}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowPaymentModal(false)} style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>❌ Batal</button>
                <button onClick={processPayment} disabled={Number(paymentAmount) < totalAmount || paymentAmount === ''} style={{ flex: 2, padding: '16px', background: (Number(paymentAmount) < totalAmount || paymentAmount === '') ? '#cbd5e1' : '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: (Number(paymentAmount) < totalAmount || paymentAmount === '') ? 'not-allowed' : 'pointer', boxShadow: (Number(paymentAmount) < totalAmount || paymentAmount === '') ? 'none' : '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}>✅ Bayar & Cetak</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- STRUK AREA (AUTO PRINT) --- */}
      {strukData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
              <button onClick={() => window.print()} style={{ flex: 1, background: '#10b981', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Print Ulang</button>
              <button onClick={() => setStrukData(null)} style={{ flex: 1, background: '#e2e8f0', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LABEL BARCODE --- */}
      {printMode === 'label' && printData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 1000, overflowY: 'auto' }}>
          <div className="no-print" style={{ textAlign: 'center', padding: '15px', background: '#333', position: 'sticky', top: 0 }}>
            <button onClick={() => window.print()} style={{ background: '#10b981', color: 'white', padding: '10px 20px', border: 'none', marginRight: '10px', borderRadius: '8px', cursor: 'pointer' }}>Print Label</button>
            <button onClick={() => setPrintMode(null)} style={{ background: '#fff', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Tutup</button>
          </div>
          <div id="print-area" style={{ background: '#fff', width: '100%', minHeight: '100vh', padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', fontFamily: 'monospace' }}>
            {printData.map((p, i) => (
              <div key={i} style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', width: '140px', height: 'fit-content' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '5px' }}>{namaToko || 'TOKO'}</div>
                <div style={{ fontSize: '12px', marginBottom: '5px' }}>{p.nama}</div>
                <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${p.barcode}&scale=2&height=10&includetext`} alt={p.barcode} style={{ maxWidth: '100%' }} />
                <div style={{ fontWeight: 'bold', marginTop: '5px' }}>Rp {p.harga.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <nav className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid #e5e7eb', display: 'flex', padding: '8px 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 10 }}>
        {[ { id: 'dashboard', label: 'Dashboard', icon: '📊' }, { id: 'kasir', label: 'Kasir', icon: '💰' }, { id: 'toko', label: 'Toko', icon: '🏪' }, { id: 'laporan', label: 'Laporan', icon: '📈' } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '8px', border: 'none', background: 'none', color: activeTab === tab.id ? '#10b981' : '#9ca3af', fontSize: activeTab === tab.id ? '24px' : '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}>
            <span>{tab.icon}</span><span style={{ fontSize: '11px', fontWeight: activeTab === tab.id ? '700' : '500' }}>{tab.label}</span>
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
      `}</style>
    </div>
  );
}

export default App;