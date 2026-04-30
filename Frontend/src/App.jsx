import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, increment, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';

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

  // State Data (Bahasa Indonesia sesuai DB asli)
  const [produk, setProduk] = useState([]);
  const [transaksi, setTransaksi] = useState([]);
  const [cart, setCart] = useState([]);
  
  // State UI
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard'); // Default ke Dashboard
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showCart, setShowCart] = useState(false);
  
  // State Pembayaran
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // State Cetak
  const [strukData, setStrukData] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [printData, setPrintData] = useState(null);

  // Form Toko
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');

  // Filter & Stats
  const [reportFilter, setReportFilter] = useState('hari');
  const [dashboardStats, setDashboardStats] = useState({ todaySales: 0, totalProducts: 0, lowStock: 0, totalTransactions: 0 });

  // --- EFEK & DATABASE ---
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
      const productList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProduk(productList);
    });

    const unsubTrans = onSnapshot(query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc")), (snap) => {
      const transList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransaksi(transList);
    });

    return () => { unsubProduk(); unsubTrans(); };
  }, [user]);

  // Hitung Statistik Dashboard
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

  const handleScan = (e) => {
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
        if(newQty > item.stok) { alert("Stok tidak mencukupi!"); return item; }
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);

  const openPaymentModal = () => {
    if (cart.length === 0) return alert('Keranjang kosong!');
    setShowPaymentModal(true);
    setPaymentAmount('');
  };

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
      setShowCart(false);
    } catch (err) { alert("Gagal memproses transaksi"); }
  };

  const simpanProduk = async (e) => {
    e.preventDefault();
    const bcode = barcodeProd || Math.floor(100000000000 + Math.random() * 900000000000).toString();
    await addDoc(collection(db, "produk"), { 
      nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: bcode, userId: user.uid, createdAt: new Date() 
    });
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd('');
    alert("Produk Berhasil Ditambah!");
  };

  const filteredTransaksi = transaksi.filter(t => {
    if (!t.waktu) return false;
    const dateObj = t.waktu.toDate();
    const today = new Date();
    
    if (reportFilter === 'hari') {
      return dateObj.toDateString() === today.toDateString();
    } else if (reportFilter === 'minggu') {
      const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
      return dateObj >= firstDay;
    } else if (reportFilter === 'bulan') {
      return dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
    }
    return true;
  });

  const exportExcel = () => {
    const headers = ["Tanggal,Jam,Item,Total"];
    const rows = filteredTransaksi.map(t => {
      const d = t.waktu?.toDate();
      const items = t.items.map(i => `${i.qty}x ${i.nama}`).join(' + ');
      return `${d.toLocaleDateString('id-ID')},${d.toLocaleTimeString('id-ID')},"${items}",${t.total}`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + headers.concat(rows).join("\n")));
    link.setAttribute("download", `Laporan_Kasir.csv`);
    document.body.appendChild(link);
    link.click();
  };

  // =========================================================================
  // UI START
  // =========================================================================

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: "'Inter', sans-serif", color: '#10b981' }}><strong>Memuat Sistem...</strong></div>;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div style={{ background: 'white', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)', width: '100%', maxWidth: '420px', backdropFilter: 'blur(10px)' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              POS Modern Pro
            </h1>
            <p style={{ color: '#64748b', fontSize: '16px', margin: '8px 0 0 0' }}>Sistem Kasir Lengkap & Modern</p>
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: '#f8fafc' }}>
      
      {/* Header */}
      <header className="no-print" style={{ background: 'white', padding: '20px 24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {namaToko || 'POS Modern Pro'}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Halo, {user.email} | Keranjang: {cart.length}</p>
        </div>
        <button onClick={() => signOut(auth)} style={{ padding: '12px 24px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '10px', fontWeight: '500', cursor: 'pointer' }}>Keluar</button>
      </header>

      <main style={{ flex: 1, overflow: 'auto', paddingBottom: '100px' }}>
        
        {/* --- TAB DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div style={{ padding: '32px 24px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '32px' }}>Dashboard (Hari Ini)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              
              <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '32px', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Penjualan Hari Ini</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>Rp {dashboardStats.todaySales.toLocaleString()}</div>
              </div>
              
              <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: 'white', padding: '32px', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(59, 130, 246, 0.3)' }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Produk</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>{dashboardStats.totalProducts} item</div>
              </div>
              
              <div style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', padding: '32px', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(245, 158, 11, 0.3)' }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Stok Menipis (&lt;5)</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>{dashboardStats.lowStock} item</div>
              </div>
              
              <div style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: 'white', padding: '32px', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(139, 92, 246, 0.3)' }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Jumlah Transaksi</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>{dashboardStats.totalTransactions} nota</div>
              </div>

            </div>
          </div>
        )}

        {/* --- TAB KASIR --- */}
        {activeTab === 'kasir' && (
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '700', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 16px 0' }}>📦 Kasir Cepat</h2>
              <p style={{ color: '#64748b', margin: 0, fontSize: '16px' }}>Scan barcode atau klik produk • Total: <strong>Rp {totalAmount.toLocaleString()}</strong></p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <input type="text" placeholder="🔍 Cari nama produk..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '20px 24px', border: '2px solid #e2e8f0', borderRadius: '16px', fontSize: '16px', background: 'white', outline: 'none' }} />
              <form onSubmit={handleScan}>
                <input type="text" placeholder="📱 Arahkan Scanner Barcode kesini..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} autoFocus style={{ width: '100%', padding: '20px 24px', border: '3px solid #10b981', borderRadius: '16px', fontSize: '16px', background: '#f0fdf4', outline: 'none', boxSizing: 'border-box' }} />
              </form>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', cursor: 'pointer', border: p.stok === 0 ? '2px solid #fee2e2' : '1px solid #f1f5f9', position: 'relative' }}>
                  {p.stok <= 5 && <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#ef4444', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{p.stok === 0 ? 'HABIS' : 'STOK TIPIS'}</div>}
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981', marginBottom: '12px' }}>Rp {p.harga.toLocaleString()}</div>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>{p.nama}</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '15px', fontWeight: '600', color: p.stok > 10 ? '#10b981' : '#ef4444' }}>Stok: {p.stok}</span>
                    <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>{p.barcode}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ position: 'fixed', bottom: '120px', right: '24px', zIndex: 30 }}>
              <button onClick={() => setShowCart(true)} style={{ width: '72px', height: '72px', borderRadius: '50%', background: cart.length > 0 ? '#ef4444' : '#10b981', border: '4px solid white', color: 'white', fontSize: '24px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.4)' }}>
                {cart.length || '0'}
              </button>
            </div>
          </div>
        )}

        {/* --- TAB TOKO --- */}
        {activeTab === 'toko' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '32px', color: '#1e293b' }}>🏪 Manajemen Toko</h2>
            
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '20px', textAlign: 'left' }}>
              <h3 style={{ marginTop: 0, color: '#10b981' }}>Profil & Alamat (Untuk Struk)</h3>
              <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama Toko" style={{ width: '100%', padding: '16px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat Toko" style={{ width: '100%', padding: '16px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="No Telepon/WA" style={{ width: '100%', padding: '16px', marginBottom: '15px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <button onClick={async () => { await setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp }); alert("Tersimpan!"); }} style={{ width: '100%', padding: '16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan Profil</button>
            </div>

            <form onSubmit={simpanProduk} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '20px', textAlign: 'left' }}>
              <h3 style={{ marginTop: 0, color: '#10b981' }}>Tambah Produk & Stok Baru</h3>
              <input value={namaProd} onChange={e => setNamaProd(e.target.value)} required placeholder="Nama Produk" style={{ width: '100%', padding: '16px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" placeholder="Harga Jual" style={{ width: '100%', padding: '16px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <input value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" placeholder="Stok Awal" style={{ width: '100%', padding: '16px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Barcode (Kosongkan agar dibuat otomatis)" style={{ width: '100%', padding: '16px', marginBottom: '15px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <button type="submit" style={{ width: '100%', padding: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan ke Database</button>
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <button onClick={() => { setPrintData(produk); setPrintMode('label'); }} style={{ padding: '24px 16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>🏷️ Print Semua Label Barcode</button>
            </div>
          </div>
        )}

        {/* --- TAB LAPORAN --- */}
        {activeTab === 'laporan' && (
          <div style={{ padding: '40px 24px' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '24px', color: '#1e293b' }}>📊 Laporan Penjualan</h2>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
              <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} style={{ padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', background: 'white', fontSize: '16px', outline: 'none' }}>
                <option value="hari">📅 Hari Ini</option>
                <option value="minggu">📈 Minggu Ini</option>
                <option value="bulan">📉 Bulan Ini</option>
                <option value="semua">📂 Semua Waktu</option>
              </select>
              <button onClick={exportExcel} style={{ padding: '16px 32px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}>📥 Export Excel Asli</button>
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

      {/* --- CART MODAL UI BLACKBOX --- */}
      {showCart && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>🛒 Keranjang Belanja</h2>
                <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>{cart.length} item</p>
              </div>
              <button onClick={() => setShowCart(false)} style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fee2e2', border: 'none', color: '#dc2626', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '16px 32px', overflow: 'auto', flex: 1 }}>
              {cart.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Keranjang kosong.</div> : 
                cart.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{item.nama}</h3>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginBottom: '12px' }}>Rp {(item.harga * item.qty).toLocaleString()}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '8px 16px', borderRadius: '12px', width: 'fit-content' }}>
                      <button onClick={() => updateQuantity(item.id, item.qty - 1)} style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#fee2e2', border: 'none', color: '#dc2626', fontSize: '20px', fontWeight: '700', cursor: 'pointer' }}>−</button>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', minWidth: '24px', textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => addToCart(item)} style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#dcfce7', border: 'none', color: '#166534', fontSize: '20px', fontWeight: '700', cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                  <button onClick={() => updateQuantity(item.id, 0)} style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '2px solid #fee2e2', color: '#dc2626', fontSize: '18px', cursor: 'pointer' }}>🗑️</button>
                </div>
              ))}
            </div>

            <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '20px', fontWeight: '700' }}>
                <span style={{ color: '#374151' }}>Total Tagihan:</span>
                <span style={{ fontSize: '28px', color: '#10b981' }}>Rp {totalAmount.toLocaleString()}</span>
              </div>
              <button onClick={openPaymentModal} disabled={cart.length === 0} style={{ width: '100%', padding: '20px', background: cart.length === 0 ? '#f1f5f9' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '18px', fontWeight: '700', cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}>
                💰 LANJUT PEMBAYARAN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PAYMENT MODAL UI BLACKBOX (DENGAN VALIDASI ASLI) --- */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '32px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: '700' }}>💵 Total Pembayaran</h2>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981' }}>Rp {totalAmount.toLocaleString()}</div>
            </div>

            <div style={{ padding: '32px' }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>Uang Tunai dari Pembeli</label>
                <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" style={{ width: '100%', padding: '24px 20px', border: Number(paymentAmount) < totalAmount && paymentAmount !== '' ? '3px solid #fee2e2' : '3px solid #dcfce7', borderRadius: '16px', fontSize: '24px', fontWeight: '700', textAlign: 'center', background: '#fafbfc', outline: 'none', boxSizing: 'border-box' }} />
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={() => setPaymentAmount(totalAmount)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Uang Pas</button>
                    <button onClick={() => setPaymentAmount(50000)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>50.000</button>
                    <button onClick={() => setPaymentAmount(100000)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>100.000</button>
                </div>
              </div>

              {paymentAmount !== '' && (
                <div style={{ background: Number(paymentAmount) >= totalAmount ? '#dcfce7' : '#fee2e2', borderRadius: '16px', padding: '20px', marginBottom: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: Number(paymentAmount) >= totalAmount ? '#166534' : '#dc2626' }}>
                    {Number(paymentAmount) >= totalAmount ? `Rp ${(Number(paymentAmount) - totalAmount).toLocaleString()}` : `Kurang Rp ${(totalAmount - Number(paymentAmount)).toLocaleString()}`}
                  </div>
                  <div style={{ fontSize: '16px', color: Number(paymentAmount) >= totalAmount ? '#166534' : '#dc2626', fontWeight: '500' }}>
                    {Number(paymentAmount) >= totalAmount ? 'Kembalian' : 'Uang Belum Cukup'}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowPaymentModal(false)} style={{ flex: 1, padding: '20px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>❌ Batal</button>
                <button onClick={processPayment} disabled={Number(paymentAmount) < totalAmount || paymentAmount === ''} style={{ flex: 1, padding: '20px', background: (Number(paymentAmount) < totalAmount || paymentAmount === '') ? '#f3f4f6' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '700', cursor: (Number(paymentAmount) < totalAmount || paymentAmount === '') ? 'not-allowed' : 'pointer' }}>✅ Bayar & Cetak</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- STRUK AREA --- */}
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
              <button onClick={() => window.print()} style={{ flex: 1, background: '#10b981', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cetak Ke Printer</button>
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

      {/* Navigasi Bawah */}
      <nav className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid #e5e7eb', display: 'flex', padding: '12px 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 10 }}>
        {[ { id: 'dashboard', label: 'Dashboard', icon: '📊' }, { id: 'kasir', label: 'Kasir', icon: '💰' }, { id: 'toko', label: 'Toko', icon: '🏪' }, { id: 'laporan', label: 'Laporan', icon: '📈' } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '10px', border: 'none', background: 'none', color: activeTab === tab.id ? '#10b981' : '#9ca3af', fontSize: activeTab === tab.id ? '28px' : '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}>
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