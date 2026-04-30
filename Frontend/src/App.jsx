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

  // State Data
  const [produk, setProduk] = useState([]);
  const [transaksi, setTransaksi] = useState([]);
  const [cart, setCart] = useState([]);
  
  // State UI
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('kasir');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showCart, setShowCart] = useState(false);
  
  // State Pembayaran & Cetak (FITUR BARU)
  const [uangBayar, setUangBayar] = useState('');
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

  // Filter
  const [filterDate, setFilterDate] = useState('');

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
      setProduk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubTrans = onSnapshot(query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc")), (snap) => {
      setTransaksi(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProduk(); unsubTrans(); };
  }, [user]);

  // --- LOGIKA MESIN KASIR ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Pendaftaran Toko Berhasil!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) { alert('Gagal: ' + error.message); }
  };

  const handleLogout = async () => await signOut(auth);

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
        if(existing.qty >= p.stok) { alert("Melebihi stok!"); return prev; }
        return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const updateQuantity = (id, newQty) => {
    if (newQty <= 0) { setCart(prev => prev.filter(item => item.id !== id)); return; }
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        if(newQty > item.stok) { alert("Melebihi stok!"); return item; }
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  // --- LOGIKA PEMBAYARAN KETAT ---
  const totalBelanja = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  const isUangKurang = uangBayar !== '' && Number(uangBayar) < totalBelanja;
  const kembalian = uangBayar !== '' ? (Number(uangBayar) - totalBelanja) : 0;

  const checkout = async () => {
    if (cart.length === 0) return;
    if (!uangBayar || Number(uangBayar) < totalBelanja) {
      return alert("Uang pembayaran kurang! Transaksi tidak bisa diproses.");
    }

    const dataTrans = {
      userId: user.uid,
      items: cart.map(i => ({nama: i.nama, harga: i.harga, qty: i.qty})),
      total: totalBelanja,
      uangBayar: Number(uangBayar),
      kembalian: kembalian,
      waktu: new Date()
    };

    try {
      await addDoc(collection(db, "transaksi"), { ...dataTrans, waktu: serverTimestamp() });
      for (const item of cart) { await updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) }); }
      setStrukData(dataTrans);
      setShowCart(false);
      setCart([]);
      setUangBayar(''); // Reset form bayar
    } catch (err) { alert("Gagal transaksi"); }
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
    if (filterDate && t.waktu.toDate().toISOString().split('T')[0] !== filterDate) return false;
    return true;
  });

  const exportExcel = () => {
    const headers = ["Tanggal,Jam,Item,Total"];
    const rows = filteredTransaksi.map(t => {
      const d = t.waktu?.toDate();
      const items = t.items.map(i => `${i.nama}(${i.qty})`).join(' + ');
      return `${d.toLocaleDateString('id-ID')},${d.toLocaleTimeString('id-ID')},"${items}",${t.total}`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + headers.concat(rows).join("\n")));
    link.setAttribute("download", `Laporan_${filterDate || 'Semua'}.csv`);
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
        <div style={{ background: 'white', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              POS Modern
            </h1>
            <p style={{ color: '#64748b', fontSize: '16px', margin: '8px 0 0 0' }}>{isRegister ? 'Buat Toko Baru' : 'Masuk untuk memulai'}</p>
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
            <button type="submit" style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)' }}>
              {isRegister ? 'DAFTAR TOKO' : 'MASUK SISTEM'}
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
      <header className="no-print" style={{ background: 'white', padding: '20px 24px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {namaToko || 'POS Modern'}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Halo, Kasir Utama</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '12px 24px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '10px', fontWeight: '500', cursor: 'pointer' }}>Keluar</button>
      </header>

      <main style={{ flex: 1, overflow: 'auto', paddingBottom: '80px' }}>
        
        {/* --- TAB KASIR --- */}
        {activeTab === 'kasir' && (
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <input type="text" placeholder="Cari nama produk atau ketik manual..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '20px 24px', border: '2px solid #e2e8f0', borderRadius: '16px', fontSize: '16px', background: 'white', outline: 'none', boxSizing: 'border-box' }} />
              <form onSubmit={handleScan}>
                <input type="text" placeholder="Scanner barcode otomatis (Arahkan alat scan kesini)..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} autoFocus style={{ width: '100%', padding: '20px 24px', border: '2px solid #e2e8f0', borderRadius: '16px', fontSize: '16px', background: 'white', outline: 'none', marginTop: '16px', boxSizing: 'border-box' }} />
              </form>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', cursor: 'pointer', border: '1px solid #f1f5f9', position: 'relative' }}>
                  {p.stok <= 5 && <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Stok Menipis!</div>}
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>Rp {p.harga.toLocaleString()}</div>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>{p.nama}</h3>
                  <div style={{ color: '#64748b', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.stok > 0 ? '#10b981' : '#ef4444' }} /> Stok: {p.stok}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '12px', fontFamily: 'monospace' }}>Barcode: {p.barcode}</div>
                </div>
              ))}
            </div>

            <div style={{ position: 'fixed', bottom: '100px', right: '24px', zIndex: 30 }}>
              <button onClick={() => setShowCart(true)} style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#10b981', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)' }}>
                {cart.length}
              </button>
            </div>
          </div>
        )}

        {/* --- TAB TOKO --- */}
        {activeTab === 'toko' && (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '24px', color: '#1e293b', marginBottom: '20px' }}>Manajemen Toko</h2>
            
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
              <h3 style={{ marginTop: 0, color: '#10b981' }}>Profil & Alamat (Untuk Struk)</h3>
              <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama Toko" style={{ width: '100%', padding: '16px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat Toko" style={{ width: '100%', padding: '16px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="No Telepon/WA" style={{ width: '100%', padding: '16px', marginBottom: '15px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <button onClick={async () => { await setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp }); alert("Tersimpan!"); }} style={{ width: '100%', padding: '16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan Profil</button>
            </div>

            <form onSubmit={simpanProduk} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
              <h3 style={{ marginTop: 0, color: '#10b981' }}>Tambah Produk & Stok Baru</h3>
              <input value={namaProd} onChange={e => setNamaProd(e.target.value)} required placeholder="Nama Produk" style={{ width: '100%', padding: '16px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" placeholder="Harga" style={{ width: '100%', padding: '16px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <input value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" placeholder="Stok Awal" style={{ width: '100%', padding: '16px', marginBottom: '10px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Barcode (Opsional)" style={{ width: '100%', padding: '16px', marginBottom: '15px', border: '2px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box' }} />
              <button type="submit" style={{ width: '100%', padding: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan ke Database</button>
            </form>

            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#1e293b' }}>Cetak Label Barcode</h3>
                <button onClick={() => { setPrintData(produk); setPrintMode('label'); }} style={{ background: '#f59e0b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Print Semua</button>
              </div>
              {produk.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', padding: '15px 0' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '16px' }}>{p.nama}</div>
                    <div style={{ color: '#64748b', fontSize: '14px' }}>Stok: {p.stok} | Barcode: {p.barcode}</div>
                  </div>
                  <button onClick={() => { setPrintData([p]); setPrintMode('label'); }} style={{ background: '#e2e8f0', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', color: '#475569' }}>Print 1</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB LAPORAN --- */}
        {activeTab === 'laporan' && (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '24px', color: '#1e293b' }}>Laporan Penjualan</h2>
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ flex: 1, padding: '16px', border: '2px solid #e2e8f0', borderRadius: '12px', outline: 'none' }} />
                <button onClick={exportExcel} style={{ padding: '16px 32px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Export Excel</button>
                <button onClick={() => setFilterDate('')} style={{ padding: '16px 32px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Reset</button>
              </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', padding: '24px', borderRadius: '16px', color: 'white', marginBottom: '24px', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)' }}>
              <p style={{ margin: 0, opacity: 0.9 }}>Total Pendapatan Terfilter</p>
              <h2 style={{ fontSize: '36px', margin: '10px 0' }}>Rp {filteredTransaksi.reduce((s, t) => s + t.total, 0).toLocaleString()}</h2>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              {filteredTransaksi.map(t => (
                <div key={t.id} style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{t.waktu?.toDate().toLocaleDateString('id-ID')} - {t.waktu?.toDate().toLocaleTimeString('id-ID')}</div>
                    <div style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>{t.items.map(i => `${i.qty}x ${i.nama}`).join(', ')}</div>
                  </div>
                  <div style={{ fontWeight: 'bold', color: '#10b981', fontSize: '18px', textAlign: 'right' }}>
                    Rp {t.total.toLocaleString()}<br/>
                    <small style={{ fontSize: '12px', color: '#64748b' }}>Tunai: Rp {t.uangBayar?.toLocaleString()}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- CART MODAL (DIPERBARUI DENGAN FITUR PEMBAYARAN KETAT) --- */}
      {showCart && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>Keranjang ({cart.length})</h2>
              <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            
            <div style={{ padding: '16px 32px', overflow: 'auto', flex: 1 }}>
              {cart.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{item.nama}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '6px 12px', borderRadius: '10px' }}>
                        <button onClick={() => updateQuantity(item.id, item.qty - 1)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}>-</button>
                        <span style={{ fontWeight: '600', color: '#1e293b', minWidth: '24px', textAlign: 'center' }}>{item.qty}</span>
                        <button onClick={() => addToCart(item)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#10b981', fontWeight: 'bold' }}>+</button>
                      </div>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>Rp {(item.harga * item.qty).toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => updateQuantity(item.id, 0)} style={{ background: '#fee2e2', border: 'none', width: '36px', height: '36px', borderRadius: '10px', color: '#dc2626', cursor: 'pointer', fontSize: '18px' }}>×</button>
                </div>
              ))}
            </div>

            <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 24px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '22px', fontWeight: '800', color: '#1e293b' }}>
                <span>TOTAL BAYAR:</span>
                <span style={{ color: '#10b981' }}>Rp {totalBelanja.toLocaleString()}</span>
              </div>
              
              {/* FITUR BARU: INPUT UANG & KEMBALIAN */}
              {cart.length > 0 && (
                <div style={{ marginBottom: '20px', padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>Uang Pembeli (Tunai)</label>
                  <input type="number" value={uangBayar} onChange={(e) => setUangBayar(e.target.value)} placeholder="0" style={{ width: '100%', padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }} />
                  
                  {/* Quick Cash Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button onClick={() => setUangBayar(totalBelanja)} style={{ flex: 1, padding: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Uang Pas</button>
                    <button onClick={() => setUangBayar(50000)} style={{ flex: 1, padding: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>50k</button>
                    <button onClick={() => setUangBayar(100000)} style={{ flex: 1, padding: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>100k</button>
                  </div>

                  {/* Validasi Kembalian / Kurang */}
                  {isUangKurang && <div style={{ color: '#ef4444', fontSize: '14px', marginTop: '12px', fontWeight: '700', textAlign: 'center' }}>⚠️ Uang Pembayaran Kurang!</div>}
                  {uangBayar !== '' && Number(uangBayar) >= totalBelanja && (
                    <div style={{ color: '#059669', fontSize: '16px', marginTop: '12px', fontWeight: '800', textAlign: 'center', background: '#d1fae5', padding: '8px', borderRadius: '8px' }}>
                      Kembalian: Rp {kembalian.toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              <button 
                onClick={checkout} 
                disabled={cart.length === 0 || !uangBayar || isUangKurang} 
                style={{ width: '100%', padding: '18px', background: (cart.length === 0 || !uangBayar || isUangKurang) ? '#cbd5e1' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '16px', cursor: (cart.length === 0 || !uangBayar || isUangKurang) ? 'not-allowed' : 'pointer', boxShadow: (cart.length === 0 || !uangBayar || isUangKurang) ? 'none' : '0 10px 25px -5px rgba(16, 185, 129, 0.4)' }}>
                BAYAR & CETAK STRUK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- AREA CETAK STRUK & LABEL --- */}
      {strukData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
              <span>TOTAL</span><span>Rp {strukData.total.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}>
              <span>TUNAI</span><span>Rp {strukData.uangBayar?.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}>
              <span>KEMBALIAN</span><span>Rp {strukData.kembalian?.toLocaleString()}</span>
            </div>
            <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
            
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>*** TERIMA KASIH ***</p>

            <div className="no-print" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, background: '#10b981', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cetak Ke Printer</button>
              <button onClick={() => setStrukData(null)} style={{ flex: 1, background: '#e2e8f0', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}

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
      <nav className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', padding: '12px 0', boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.1)', zIndex: 10 }}>
        {[ { id: 'kasir', label: 'Kasir', icon: '🛒' }, { id: 'toko', label: 'Toko', icon: '🏪' }, { id: 'laporan', label: 'Laporan', icon: '📊' } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '8px', border: 'none', background: 'none', color: activeTab === tab.id ? '#10b981' : '#64748b', fontSize: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontWeight: activeTab === tab.id ? '600' : '400' }}>
            <span>{tab.icon}</span><span style={{ fontSize: '12px' }}>{tab.label}</span>
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