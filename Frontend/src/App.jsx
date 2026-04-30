import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, increment, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { Html5Qrcode } from 'html5-qrcode';

// --- CONFIG FIREBASE ASLI VICKY ---
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
  
  // Anti-Refresh: Ambil data dari memori browser
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('vicky_cart_v2');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Scanner States
  const [isScanningKasir, setIsScanningKasir] = useState(false);
  const [isScanningToko, setIsScanningToko] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState(null);
  const [strukData, setStrukData] = useState(null);
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');
  
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');
  const [reportFilter, setReportFilter] = useState('hari');

  // Persistence & Auth
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).then(() => {
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
    });
  }, []);

  // Simpan keranjang otomatis
  useEffect(() => {
    localStorage.setItem('vicky_cart_v2', JSON.stringify(cart));
  }, [cart]);

  // Sync Database
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "profilToko", user.uid)).then(d => {
      if(d.exists()) { 
        setNamaToko(d.data().nama); setAlamat(d.data().alamat); setNoTelp(d.data().noTelp); 
      }
    });
    const unsubProd = onSnapshot(query(collection(db, "produk"), where("userId", "==", user.uid)), (snap) => {
      setProduk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubTrans = onSnapshot(query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc")), (snap) => {
      setTransaksi(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubProd(); unsubTrans(); };
  }, [user]);

  // Scanner Logic
  useEffect(() => {
    let html5QrCode;
    const scannerId = isScanningKasir ? "reader-kasir" : (isScanningToko ? "reader-toko" : null);
    if (scannerId) {
      html5QrCode = new Html5Qrcode(scannerId);
      html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (isScanningKasir) {
            const found = produk.find(p => p.barcode === decodedText);
            if (found) addToCart(found); else alert('Barcode tidak terdaftar!');
            setIsScanningKasir(false);
          } else {
            setBarcodeProd(decodedText);
            setIsScanningToko(false);
          }
          html5QrCode.stop();
        }
      ).catch(() => {});
    }
    return () => { if (html5QrCode) html5QrCode.stop().catch(() => {}); };
  }, [isScanningKasir, isScanningToko, produk]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (isRegister) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert('Akses Ditolak: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (p) => {
    if (p.stok <= 0) return alert("Stok habis!");
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const updateQtyManual = (id, val) => {
    const n = parseInt(val) || 0;
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: n } : item).filter(i => i.qty > 0));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  const kembalian = paymentAmount ? Number(paymentAmount) - totalAmount : 0;

  const processPayment = async () => {
    const dataTrans = {
      userId: user.uid,
      items: cart.map(i => ({nama: i.nama, harga: i.harga, qty: i.qty})),
      total: totalAmount, uangTunai: Number(paymentAmount), kembalian: kembalian, waktu: new Date()
    };
    try {
      await addDoc(collection(db, "transaksi"), { ...dataTrans, waktu: serverTimestamp() });
      for (const item of cart) { await updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) }); }
      setStrukData(dataTrans);
      setCart([]); setPaymentAmount('');
    } catch (err) { alert("Transaksi Gagal!"); }
  };

  const simpanProduk = async (e) => {
    e.preventDefault();
    const duplicate = produk.find(p => p.barcode === barcodeProd && p.id !== editingProduct?.id);
    if (duplicate && barcodeProd !== "") return alert("Barcode sudah dipakai produk lain!");

    const pData = { nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: barcodeProd || Date.now().toString(), userId: user.uid };
    if (editingProduct) {
      await updateDoc(doc(db, "produk", editingProduct.id), pData);
      setEditingProduct(null);
    } else {
      await addDoc(collection(db, "produk"), { ...pData, createdAt: new Date() });
    }
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd('');
    alert("Data Disimpan!");
  };

  const todaySales = transaksi.filter(t => t.waktu?.toDate().toDateString() === new Date().toDateString()).reduce((s, t) => s + t.total, 0);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: '#10b981' }}>
      <div className="spinner"></div>
      <p style={{ marginTop: '20px', fontWeight: 'bold', letterSpacing: '2px' }}>MENYIAPKAN SISTEM...</p>
    </div>
  );

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="icon-box">💰</div>
            <h1>POS SMART PRO</h1>
            <p>Sistem Kasir Agribisnis Modern</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vicky@example.com" required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn-primary">
              {isRegister ? 'BUAT AKUN TOKO' : 'MASUK KE DASHBOARD'}
            </button>
          </form>
          <p className="toggle-auth" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Sudah punya akun? Login di sini' : 'Belum punya akun? Daftar sekarang'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header Elegan */}
      <header className="no-print app-header">
        <div className="header-info">
          <h2>{namaToko || 'TOKO VICKY'}</h2>
          <span className="user-badge">● {user.email}</span>
        </div>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => setShowProfileModal(true)}>👤</button>
          <button className="btn-logout" onClick={() => signOut(auth)}>Keluar</button>
        </div>
      </header>

      {/* Navigasi Utama */}
      <nav className="no-print side-nav">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={activeTab === 'kasir' ? 'active' : ''} onClick={() => setActiveTab('kasir')}>🛒 Kasir</button>
        <button className={activeTab === 'produk' ? 'active' : ''} onClick={() => setActiveTab('produk')}>📦 Produk</button>
        <button className={activeTab === 'laporan' ? 'active' : ''} onClick={() => setActiveTab('laporan')}>📋 Laporan</button>
      </nav>

      <main className="content-area">
        {activeTab === 'dashboard' && (
          <div className="dashboard-view">
            <div className="stats-row">
              <div className="card-stat sales">
                <small>OMZET HARI INI</small>
                <h3>Rp {todaySales.toLocaleString()}</h3>
              </div>
              <div className="card-stat items">
                <small>TOTAL PRODUK</small>
                <h3>{produk.length} SKU</h3>
              </div>
              <div className="card-stat warning">
                <small>STOK KRITIS (&lt;5)</small>
                <h3>{produk.filter(p => p.stok < 5).length} Produk</h3>
              </div>
            </div>
            
            <div className="chart-box">
              <h4>📈 Tren Penjualan 7 Hari Terakhir</h4>
              <div className="bar-chart">
                {[30, 60, 45, 90, 100, 70, 85].map((h, i) => (
                  <div key={i} className="bar-col">
                    <div className="bar-fill" style={{ height: `${h}%` }}></div>
                    <span>Tgl {i+1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kasir' && (
          <div className="kasir-layout">
            <div className="products-side">
              <div className="search-box">
                <input placeholder="Cari nama barang / scan barcode..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <button onClick={() => setIsScanningKasir(!isScanningKasir)}>📸 Scan</button>
              </div>
              {isScanningKasir && <div id="reader-kasir" className="scanner-frame"></div>}
              <div className="grid-items">
                {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                  <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
                    <div className="p-price">Rp {p.harga.toLocaleString()}</div>
                    <div className="p-name">{p.nama}</div>
                    <div className="p-stock">Tersedia: {p.stok}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cart-side">
              <div className="cart-header">🛒 Daftar Pesanan</div>
              <div className="cart-list">
                {cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div className="item-info">
                      <strong>{item.nama}</strong>
                      <span>Rp {(item.harga * item.qty).toLocaleString()}</span>
                    </div>
                    <div className="item-qty">
                      <button onClick={() => updateQtyManual(item.id, item.qty - 1)}>-</button>
                      <input type="number" value={item.qty} onChange={(e) => updateQtyManual(item.id, e.target.value)} />
                      <button onClick={() => addToCart(item)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="cart-checkout">
                <div className="summary-row total">
                  <span>Total Tagihan</span>
                  <strong>Rp {totalAmount.toLocaleString()}</strong>
                </div>
                <div className="summary-row input">
                  <span>Uang Tunai</span>
                  <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Rp 0" />
                </div>
                <div className={`summary-row change ${kembalian < 0 ? 'minus' : 'plus'}`}>
                  <span>{kembalian < 0 ? 'Uang Kurang' : 'Kembalian'}</span>
                  <strong>Rp {Math.abs(kembalian).toLocaleString()}</strong>
                </div>
                <button className="btn-pay" disabled={!paymentAmount || kembalian < 0 || cart.length === 0} onClick={processPayment}>
                  PROSES & CETAK STRUK
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'produk' && (
          <div className="inventory-view">
            <form className="inventory-form" onSubmit={simpanProduk}>
              <h4>{editingProduct ? '📝 Edit Produk' : '➕ Tambah Stok Baru'}</h4>
              <div className="form-grid">
                <input placeholder="Nama Barang" value={namaProd} onChange={e => setNamaProd(e.target.value)} required />
                <input placeholder="Harga Jual (Rp)" type="number" value={hargaProd} onChange={e => setHargaProd(e.target.value)} required />
                <input placeholder="Jumlah Stok" type="number" value={stokProd} onChange={e => setStokProd(e.target.value)} required />
                <div className="input-scan">
                  <input placeholder="Kode Barcode" value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} />
                  <button type="button" onClick={() => setIsScanningToko(!isScanningToko)}>📸</button>
                </div>
              </div>
              {isScanningToko && <div id="reader-toko" className="scanner-frame"></div>}
              <button type="submit" className="btn-save">Simpan Data</button>
            </form>

            <table className="inventory-table">
              <thead>
                <tr><th>Nama</th><th>Harga</th><th>Stok</th><th>Barcode</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {produk.map(p => (
                  <tr key={p.id}>
                    <td>{p.nama}</td>
                    <td>Rp {p.harga.toLocaleString()}</td>
                    <td style={{ color: p.stok < 5 ? 'red' : 'inherit', fontWeight: 'bold' }}>{p.stok}</td>
                    <td><code>{p.barcode}</code></td>
                    <td>
                      <button className="btn-edit" onClick={() => { setEditingProduct(p); setNamaProd(p.nama); setHargaProd(p.harga); setStokProd(p.stok); setBarcodeProd(p.barcode); }}>✏️</button>
                      <button className="btn-delete" onClick={() => { if(window.confirm("Hapus?")) deleteDoc(doc(db, "produk", p.id)); }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Profil Toko Modal */}
      {showProfileModal && (
        <div className="overlay">
          <div className="modal">
            <h3>⚙️ PENGATURAN TOKO</h3>
            <div className="input-group">
              <label>Nama Toko (Akan muncul di struk)</label>
              <input value={namaToko} onChange={e => setNamaToko(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Alamat Lengkap</label>
              <input value={alamat} onChange={e => setAlamat(e.target.value)} />
            </div>
            <div className="input-group">
              <label>No. WhatsApp</label>
              <input value={noTelp} onChange={e => setNoTelp(e.target.value)} />
            </div>
            <div className="modal-btns">
              <button className="save" onClick={async () => { await setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp }); setShowProfileModal(false); }}>SIMPAN</button>
              <button className="close" onClick={() => setShowProfileModal(false)}>BATAL</button>
            </div>
          </div>
        </div>
      )}

      {/* Struk Print Area */}
      {strukData && (
        <div className="struk-overlay">
          <div className="struk-paper" id="struk-area">
            <h2 style={{ textAlign: 'center' }}>{namaToko}</h2>
            <p style={{ textAlign: 'center', fontSize: '12px' }}>{alamat}<br/>{noTelp}</p>
            <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
            {strukData.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}>
                <span>{it.qty}x {it.nama}</span>
                <span>{(it.harga * it.qty).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>TOTAL</span><span>Rp {strukData.total.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>BAYAR</span><span>Rp {strukData.uangTunai.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>KEMBALI</span><span>Rp {strukData.kembalian.toLocaleString()}</span>
            </div>
            <p style={{ textAlign: 'center', marginTop: '20px' }}>TERIMA KASIH TELAH BERBELANJA</p>
            <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '5px' }}>CETAK</button>
              <button onClick={() => setStrukData(null)} style={{ flex: 1, padding: '10px', background: '#64748b', color: 'white', border: 'none', borderRadius: '5px' }}>TUTUP</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        
        * { box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; margin: 0; background: #f8fafc; }
        
        /* LOGIN GLASSMORPHISM */
        .login-page { 
          min-height: 100vh; 
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .login-card { 
          background: rgba(255, 255, 255, 0.05); 
          backdrop-filter: blur(10px); 
          border: 1px solid rgba(255, 255, 255, 0.1); 
          padding: 40px; border-radius: 24px; width: 100%; maxWidth: 420px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
          color: white;
        }
        .icon-box { font-size: 50px; text-align: center; margin-bottom: 10px; }
        .login-header h1 { text-align: center; margin: 0; font-size: 24px; letter-spacing: 1px; color: #10b981; }
        .login-header p { text-align: center; opacity: 0.6; font-size: 14px; margin-bottom: 30px; }
        .input-group { margin-bottom: 20px; }
        .input-group label { display: block; font-size: 12px; margin-bottom: 8px; font-weight: 600; color: #10b981; }
        .input-group input { 
          width: 100%; padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); 
          background: rgba(255,255,255,0.05); color: white; outline: none;
        }
        .btn-primary { 
          width: 100%; padding: 16px; border-radius: 12px; border: none; 
          background: #10b981; color: white; font-weight: 800; cursor: pointer; transition: 0.3s;
        }
        .btn-primary:hover { background: #059669; transform: translateY(-2px); }
        .toggle-auth { text-align: center; font-size: 13px; margin-top: 20px; cursor: pointer; opacity: 0.7; }

        /* LOADING SPINNER */
        .spinner { border: 4px solid rgba(16, 185, 129, 0.1); border-left-color: #10b981; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* MAIN LAYOUT */
        .app-container { display: grid; grid-template-columns: 240px 1fr; grid-template-rows: 70px 1fr; height: 100vh; }
        .app-header { grid-column: 1 / 3; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; padding: 0 30px; align-items: center; }
        .side-nav { background: #1e293b; color: white; padding: 20px 10px; display: flex; flexDirection: column; gap: 10px; }
        .side-nav button { padding: 12px 20px; border: none; background: none; color: #94a3b8; text-align: left; cursor: pointer; font-weight: 600; border-radius: 8px; }
        .side-nav button.active { background: #10b981; color: white; }
        .content-area { overflow-y: auto; padding: 30px; }

        /* KASIR LAYOUT */
        .kasir-layout { display: flex; gap: 20px; height: 100%; }
        .products-side { flex: 1; display: flex; flexDirection: column; }
        .cart-side { width: 380px; background: white; border-radius: 20px; border: 1px solid #e2e8f0; display: flex; flexDirection: column; overflow: hidden; }
        .cart-header { background: #1e293b; color: white; padding: 20px; font-weight: bold; }
        .cart-list { flex: 1; overflow-y: auto; padding: 15px; }
        .cart-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .item-qty { display: flex; align-items: center; gap: 5px; }
        .item-qty input { width: 40px; text-align: center; border: 1px solid #ddd; }
        .cart-checkout { padding: 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .summary-row.change.minus { color: red; }
        .summary-row.change.plus { color: green; }
        .btn-pay { width: 100%; padding: 15px; border-radius: 12px; background: #10b981; color: white; border: none; font-weight: bold; cursor: pointer; }
        .btn-pay:disabled { background: #cbd5e1; }

        /* DASHBOARD STATS */
        .stats-row { display: flex; gap: 20px; margin-bottom: 30px; }
        .card-stat { flex: 1; padding: 25px; border-radius: 20px; color: white; }
        .card-stat.sales { background: linear-gradient(135deg, #10b981, #059669); }
        .card-stat.items { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
        .card-stat.warning { background: linear-gradient(135deg, #ef4444, #b91c1c); }

        /* INVENTORY TABLE */
        .inventory-table { width: 100%; border-collapse: collapse; background: white; border-radius: 15px; overflow: hidden; }
        .inventory-table th, .inventory-table td { padding: 15px; text-align: left; border-bottom: 1px solid #f1f5f9; }
        .inventory-table th { background: #f8fafc; color: #64748b; font-size: 13px; }

        /* MODAL */
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { background: white; padding: 30px; border-radius: 20px; width: 400px; }
        .modal input { width: 100%; padding: 12px; margin: 10px 0 20px; border-radius: 10px; border: 1px solid #ddd; }
        
        /* STRUK */
        .struk-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .struk-paper { background: white; padding: 30px; width: 320px; font-family: monospace; }

        @media print { .no-print { display: none !important; } .struk-overlay { position: absolute; background: white; } }
      `}</style>
    </div>
  );
}

export default App;