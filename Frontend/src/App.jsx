import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, increment, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { Html5Qrcode } from 'html5-qrcode';

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
  
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('vicky_cart');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard'); // Default dashboard
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isScanningKasir, setIsScanningKasir] = useState(false);
  const [isScanningToko, setIsScanningToko] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [reportFilter, setReportFilter] = useState('hari');
  
  const [strukData, setStrukData] = useState(null);
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');
  
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).then(() => {
      onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    });
  }, []);

  useEffect(() => { localStorage.setItem('vicky_cart', JSON.stringify(cart)); }, [cart]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "profilToko", user.uid)).then(d => {
      if(d.exists()) { 
        setNamaToko(d.data().nama); 
        setAlamat(d.data().alamat); 
        setNoTelp(d.data().noTelp); 
      }
    });
    onSnapshot(query(collection(db, "produk"), where("userId", "==", user.uid)), (snap) => {
      setProduk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    onSnapshot(query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc")), (snap) => {
      setTransaksi(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [user]);

  // Scanner
  useEffect(() => {
    let html5QrCode;
    const scannerId = isScanningKasir ? "reader-kasir" : (isScanningToko ? "reader-toko" : null);
    if (scannerId) {
      html5QrCode = new Html5Qrcode(scannerId);
      html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (isScanningKasir) {
            const found = produk.find(p => p.barcode === decodedText);
            if (found) addToCart(found); else alert('Produk tidak ditemukan!');
            setIsScanningKasir(false);
          } else {
            setBarcodeProd(decodedText);
            setIsScanningToko(false);
          }
          html5QrCode.stop();
        }).catch(() => {});
    }
    return () => { if (html5QrCode) html5QrCode.stop().catch(() => {}); };
  }, [isScanningKasir, isScanningToko, produk]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try { 
      setLoading(true); 
      if (isRegister) await createUserWithEmailAndPassword(auth, email, password); 
      else await signInWithEmailAndPassword(auth, email, password); 
    } catch (error) { alert('Error: ' + error.message); } 
    finally { setLoading(false); }
  };

  const addToCart = (p) => {
    if (p.stok <= 0) return alert("Stok habis!");
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const setQuantity = (id, newQty) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(0, newQty) } : item).filter(i => i.qty > 0));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  const kembalian = paymentAmount ? Number(paymentAmount) - totalAmount : 0;
  const isPaymentValid = paymentAmount && Number(paymentAmount) >= totalAmount && cart.length > 0;

  const processPayment = async () => {
    if (!isPaymentValid) return alert("Lengkapi pembayaran!");
    const dataTrans = {
      userId: user.uid,
      items: cart.map(i => ({nama: i.nama, harga: i.harga, qty: i.qty})),
      total: totalAmount, 
      uangTunai: Number(paymentAmount), 
      kembalian: kembalian, 
      waktu: new Date()
    };
    try {
      await addDoc(collection(db, "transaksi"), { ...dataTrans, waktu: serverTimestamp() });
      for (const item of cart) { 
        await updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) }); 
      }
      setStrukData(dataTrans);
      setCart([]); 
      setPaymentAmount('');
    } catch (err) { alert("Transaksi gagal!"); }
  };

  const simpanProduk = async (e) => {
    e.preventDefault();
    if (barcodeProd && produk.find(p => p.barcode === barcodeProd && p.id !== editingProduct?.id)) {
      return alert("Barcode sudah digunakan!");
    }
    const bcode = barcodeProd || `PROD${Date.now()}`;
    try {
      if (editingProduct) {
        await updateDoc(doc(db, "produk", editingProduct.id), {
          nama: namaProd,
          harga: Number(hargaProd),
          stok: Number(stokProd),
          barcode: bcode,
          userId: user.uid
        });
        alert("Produk berhasil diupdate!");
      } else {
        await addDoc(collection(db, "produk"), {
          nama: namaProd,
          harga: Number(hargaProd),
          stok: Number(stokProd),
          barcode: bcode,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        alert("Produk berhasil ditambahkan!");
      }
      resetForm();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const editProduct = (product) => {
    setEditingProduct(product);
    setNamaProd(product.nama);
    setHargaProd(product.harga);
    setStokProd(product.stok);
    setBarcodeProd(product.barcode);
  };

  const deleteProduct = async (id) => {
    if (confirm("Hapus produk ini?")) {
      await deleteDoc(doc(db, "produk", id));
    }
  };

  const resetForm = () => {
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd('');
    setEditingProduct(null);
  };

  const simpanProfil = async () => {
    await setDoc(doc(db, "profilToko", user.uid), {
      nama: namaToko, alamat, noTelp
    });
    setShowProfileModal(false);
    alert("Profil disimpan!");
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>POS SMART</h1>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit">{isRegister ? 'DAFTAR' : 'MASUK'}</button>
          </form>
          <p onClick={() => setIsRegister(!isRegister)} className="toggle-auth">
            {isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <h1>{namaToko || 'POS SMART'}</h1>
        </div>
        <div className="header-right">
          <button className="profile-btn" onClick={() => setShowProfileModal(true)} title="Profil Toko">
            👤
          </button>
          <button className="logout-btn" onClick={() => signOut(auth)}>
            Logout
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
          📊 Dashboard
        </button>
        <button className={activeTab === 'kasir' ? 'active' : ''} onClick={() => setActiveTab('kasir')}>
          💰 Kasir
        </button>
        <button className={activeTab === 'produk' ? 'active' : ''} onClick={() => setActiveTab('produk')}>
          📦 Produk
        </button>
        <button className={activeTab === 'laporan' ? 'active' : ''} onClick={() => setActiveTab('laporan')}>
          📋 Laporan
        </button>
      </nav>

      <main>
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div>
                  <h3>Total Produk</h3>
                  <div className="stat-number">{produk.length}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div>
                  <h3>Pendapatan Hari Ini</h3>
                  <div className="stat-number">
                    Rp {transaksi.filter(t => {
                      const today = new Date().toDateString();
                      return new Date(t.waktu?.seconds * 1000).toDateString() === today;
                    }).reduce((sum, t) => sum + (t.total || 0), 0).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div>
                  <h3>Total Transaksi</h3>
                  <div className="stat-number">{transaksi.length}</div>
                </div>
              </div>
            </div>

            <div className="chart-container">
              <h3>Tren Penjualan 7 Hari Terakhir</h3>
              <div className="chart">
                {[120, 200, 150, 280, 220, 300, 250].map((value, i) => (
                  <div key={i} className="bar" style={{height: `${value / 4}%`}}>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kasir' && (
          <div className="kasir-container">
            <div className="products-panel">
              <div className="search-bar">
                <input 
                  placeholder="Cari produk atau scan barcode..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
                <button onClick={() => setIsScanningKasir(true)}>📷 Scan</button>
              </div>
              {isScanningKasir && <div id="reader-kasir" className="scanner"></div>}
              
              <div className="products-grid">
                {produk
                  .filter(p => 
                    p.nama.toLowerCase().includes(search.toLowerCase()) || 
                    p.barcode.includes(search)
                  )
                  .map(p => (
                  <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
                    <div className="price">Rp {p.harga.toLocaleString()}</div>
                    <h4>{p.nama}</h4>
                    <div className={`stock ${p.stok < 5 ? 'low' : ''}`}>
                      Stok: {p.stok}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cart-panel">
              <div className="cart-header">
                <h3>Keranjang ({cart.length})</h3>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="clear-cart">🗑️ Kosongkan</button>
                )}
              </div>

              <div className="cart-items">
                {cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div className="item-info">
                      <h4>{item.nama}</h4>
                      <div className="price">Rp {(item.harga * item.qty).toLocaleString()}</div>
                    </div>
                    <div className="quantity-control">
                      <button onClick={() => setQuantity(item.id, item.qty - 1)}>-</button>
                      <input 
                        type="number" 
                        value={item.qty} 
                        onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)}
                        min="0"
                      />
                      <button onClick={() => addToCart(item)}>+</button>
                      <button onClick={() => removeFromCart(item.id)} className="remove">×</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="payment-section">
                <div className="total-row">
                  <span>Total:</span>
                  <strong>Rp {totalAmount.toLocaleString()}</strong>
                </div>
                
                <div className="payment-input">
                  <label>Uang Pembayaran</label>
                  <input 
                    type="number" 
                    value={paymentAmount} 
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className={`change-row ${kembalian < 0 ? 'negative' : ''}`}>
                  <span>Kembalian:</span>
                  <strong>Rp {Math.abs(kembalian).toLocaleString()}</strong>
                </div>

                <button 
                  onClick={processPayment}
                  disabled={!isPaymentValid}
                  className="pay-button"
                >
                  {isPaymentValid ? '✅ Cetak Struk' : '💳 Bayar Dulu'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'produk' && (
          <div className="produk-page">
            <div className="produk-header">
              <h2>Kelola Produk</h2>
              <div className="filter-search">
                <input placeholder="Cari produk..." />
                <button onClick={() => setIsScanningToko(true)}>📷 Scan</button>
              </div>
            </div>

            {isScanningToko && <div id="reader-toko" className="scanner"></div>}

            <form onSubmit={simpanProduk} className="produk-form">
              <div className="form-row">
                <input 
                  value={namaProd} 
                  onChange={e => setNamaProd(e.target.value)} 
                  placeholder="Nama Produk" 
                  required 
                />
                <input 
                  value={hargaProd} 
                  onChange={e => setHargaProd(e.target.value)} 
                  type="number" 
                  placeholder="Harga" 
                  required 
                />
              </div>
              <div className="form-row">
                <input 
                  value={stokProd} 
                  onChange={e => setStokProd(e.target.value)} 
                  type="number" 
                  placeholder="Stok" 
                  required 
                />
                <input 
                  value={barcodeProd} 
                  onChange={e => setBarcodeProd(e.target.value)} 
                  placeholder="Barcode" 
                />
              </div>
              <div className="form-actions">
                <button type="submit">{editingProduct ? 'Update' : 'Tambah'}</button>
                {editingProduct && <button type="button" onClick={resetForm}>Batal</button>}
              </div>
            </form>

            <div className="produk-table">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Harga</th>
                    <th>Stok</th>
                    <th>Barcode</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {produk.map(p => (
                    <tr key={p.id}>
                      <td>{p.nama}</td>
                      <td>Rp {p.harga.toLocaleString()}</td>
                      <td className={p.stok < 5 ? 'low-stock' : ''}>{p.stok}</td>
                      <td>{p.barcode}</td>
                      <td>
                        <button onClick={() => editProduct(p)} className="edit-btn">✏️</button>
                        <button onClick={() => deleteProduct(p.id)} className="delete-btn">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'laporan' && (
          <div className="laporan-page">
            <div className="laporan-header">
              <h2>Riwayat Transaksi</h2>
              <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)}>
                <option value="hari">Hari Ini</option>
                <option value="minggu">Minggu Ini</option>
                <option value="bulan">Bulan Ini</option>
              </select>
            </div>

            <div className="transaksi-table">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Total</th>
                    <th>Tunai</th>
                    <th>Kembali</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksi.slice(0, 50).map(t => (
                    <tr key={t.id}>
                      <td>{t.waktu ? new Date(t.waktu.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                      <td>Rp {t.total?.toLocaleString()}</td>
                      <td>Rp {t.uangTunai?.toLocaleString()}</td>
                      <td>Rp {t.kembalian?.toLocaleString()}</td>
                      <td>
                        <button className="print-btn" onClick={() => {/* print logic */}}>
                          🖨️ Cetak
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Profil Toko</h3>
            <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama Toko" />
            <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat" />
            <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="No. Telp" />
            <div className="modal-actions">
              <button onClick={simpanProfil}>Simpan</button>
              <button onClick={() => setShowProfileModal(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {strukData && (
        <div className="struk-modal">
          <div id="strukArea" className="struk-content">
            {/* Struk content - sama seperti sebelumnya */}
            <h2>{namaToko}</h2>
            <div>{alamat}</div>
            <div>{noTelp}</div>
            {/* ... rest of struk */}
            <div className="struk-actions">
              <button onClick={() => window.print()}>🖨️ Cetak</button>
              <button onClick={() => setStrukData(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #f8fafc; }
        
        .app { min-height: 100vh; display: flex; flex-direction: column; }
        
        /* Header */
        header { 
          display: flex; justify-content: space-between; align-items: center; 
          padding: 1rem 2rem; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        header h1 { font-size: 1.5rem; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .header-right { display: flex; gap: 1rem; align-items: center; }
        .profile-btn, .logout-btn { 
          padding: 0.5rem 1rem; border: none; border-radius: 8px; cursor: pointer; 
          font-weight: 500; transition: all 0.2s; 
        }
        .profile-btn { background: #f1f5f9; color: #64748b; }
        .profile-btn:hover { background: #e2e8f0; }
        .logout-btn { background: #fee2e2; color: #dc2626; }
        
        /* Navigation */
        .tabs { 
          display: flex; background: white; border-bottom: 1px solid #e2e8f0; 
          padding: 0.5rem 2rem; gap: 0.5rem; 
        }
        .tabs button { 
          padding: 0.75rem 1.5rem; border: none; border-radius: 8px; 
          background: #f1f5f9; color: #64748b; cursor: pointer; font-weight: 500; 
          transition: all 0.2s; 
        }
        .tabs button.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        
        /* Dashboard */
        .dashboard { padding: 2rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .stat-card { 
          display: flex; align-items: center; gap: 1rem; padding: 1.5rem; 
          background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
        }
        .stat-icon { font-size: 2rem; }
        .stat-card h3 { font-size: 0.875rem; color: #64748b; margin-bottom: 0.25rem; }
        .stat-number { font-size: 2rem; font-weight: 700; color: #1e293b; }
        
        .chart-container { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .chart { 
          display: flex; align-items: flex-end; height: 200px; gap: 0.5rem; 
          padding: 1rem 0; position: relative; 
        }
        .bar { 
          flex: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          border-radius: 4px 4px 0 0; position: relative; cursor: pointer; 
          transition: all 0.3s; 
        }
        .bar:hover { transform: scale(1.05); }
        .bar span { 
          position: absolute; top: -25px; left: 50%; transform: translateX(-50%); 
          background: rgba(0,0,0,0.8); color: white; padding: 0.25rem 0.5rem; 
          border-radius: 4px; font-size: 0.75rem; white-space: nowrap; 
        }
        
        /* Kasir Split Screen */
        .kasir-container { display: flex; height: calc(100vh - 140px); }
        .products-panel { flex: 1; padding: 2rem; overflow-y: auto; }
        .cart-panel { 
          width: 420px; background: white; box-shadow: -4px 0 20px rgba(0,0,0,0.1); 
          display: flex; flex-direction: column; 
        }
        
        .search-bar { 
          display: flex; gap: 1rem; margin-bottom: 2rem; 
        }
        .search-bar input { flex: 1; padding: 1rem; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1rem; }
        .search-bar button { padding: 1rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 12px; cursor: pointer; }
        
        .scanner { width: 100%; height: 250px; border: 3px solid #3b82f6; border-radius: 12px; margin-bottom: 1rem; }
        
        .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; }
        .product-card { 
          padding: 1.5rem; background: white; border-radius: 12px; cursor: pointer; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: all 0.2s; 
        }
        .product-card:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0,0,0,0.15); }
        .product-card .price { font-size: 1.25rem; font-weight: 700; color: #10b981; margin-bottom: 0.5rem; }
        .product-card h4 { margin-bottom: 0.75rem; color: #1e293b; }
        .stock { font-size: 0.875rem; color: #64748b; }
        .stock.low { color: #ef4444; font-weight: 600; }
        
        .cart-header { padding: 1.5rem; border-bottom: 2px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .cart-header h3 { margin: 0; }
        .clear-cart { background: #fee2e2; color: #dc2626; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
        
        .cart-items { flex: 1; padding: 1.5rem; overflow-y: auto; }
        .cart-item { 
          display: flex; justify-content: space-between; align-items: center; 
          padding: 1rem; background: #f8fafc; border-radius: 8px; margin-bottom: 1rem; 
        }
        .item-info h4 { margin: 0 0 0.25rem 0; font-size: 1rem; }
        .item-info .price { color: #10b981; font-weight: 600; }
        
        .quantity-control { 
          display: flex; align-items: center; gap: 0.5rem; background: white; 
          padding: 0.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
        }
        .quantity-control button { 
          width: 32px; height: 32px; border: none; border-radius: 6px; 
          font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; 
        }
        .quantity-control button:first-child { background: #fee2e2; color: #dc2626; }
        .quantity-control button:nth-child(3) { background: #dcfce7; color: #166534; }
        .quantity-control input { width: 50px; text-align: center; border: none; font-weight: 600; font-size: 1rem; }
        .remove { background: #fee2e2; color: #dc2626; font-size: 1.2rem; }
        
        .payment-section { padding: 1.5rem; background: #f8fafc; border-top: 3px solid #e2e8f0; }
        .total-row, .change-row { 
          display: flex; justify-content: space-between; margin-bottom: 1rem; 
          font-size: 1.1rem; font-weight: 600; 
        }
        .change-row.negative { color: #ef4444; }
        .change-row.negative strong { color: #ef4444 !important; }
        
        .payment-input { margin-bottom: 1rem; }
        .payment-input label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151; }
        .payment-input input { 
          width: 100%; padding: 1rem; border: 2px solid #10b981; border-radius: 8px; 
          font-size: 1.25rem; font-weight: 600; text-align: right; 
        }
        
        .pay-button { 
          width: 100%; padding: 1rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
          color: white; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 700; 
          cursor: pointer; transition: all 0.2s; 
        }
        .pay-button:disabled { 
          background: #cbd5e1; cursor: not-allowed; opacity: 0.6; 
        }
        .pay-button:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(16,185,129,0.4); }
        
        /* Produk Page */
        .produk-page { padding: 2rem; max-width: 1200px; margin: 0 auto; }
        .produk-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .produk-header h2 { margin: 0; }
        .filter-search { display: flex; gap: 1rem; }
        .filter-search input { padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px; }
        
        .produk-form { 
          background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
          margin-bottom: 2rem; 
        }
        .form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
        .form-row input { flex: 1; padding: 1rem; border: 2px solid #e2e8f0; border-radius: 8px; }
        .form-actions { display: flex; gap: 1rem; }
        .form-actions button { 
          flex: 1; padding: 1rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; 
        }
        .form-actions button:first-child { background: #10b981; color: white; }
        .form-actions button:last-child { background: #f1f5f9; color: #64748b; }
        
        .produk-table table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .produk-table th, .produk-table td { padding: 1rem; text-align: left; border-bottom: 1px solid #f1f5f9; }
        .produk-table th { background: #f8fafc; font-weight: 600; color: #374151; }
        .low-stock { color: #ef4444; font-weight: 600; }
        .edit-btn, .delete-btn { 
          padding: 0.5rem; margin-right: 0.5rem; border: none; border-radius: 6px; 
          cursor: pointer; background: #f1f5f9; color: #64748b; 
        }
        .delete-btn { background: #fee2e2; color: #dc2626; }
        
        /* Laporan */
        .laporan-page { padding: 2rem; max-width: 1200px; margin: 0 auto; }
        .laporan-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .transaksi-table table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .transaksi-table th, .transaksi-table td { padding: 1rem; text-align: left; border-bottom: 1px solid #f1f5f9; }
        .transaksi-table th { background: #f8fafc; font-weight: 600; }
        .print-btn { 
          padding: 0.5rem 1rem; background: #3b82f6; color: white; 
          border: none; border-radius: 6px; cursor: pointer; 
        }
        
        /* Modals */
        .modal-overlay { 
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); 
          display: flex; align-items: center; justify-content: center; z-index: 1000; 
        }
        .modal { 
          background: white; padding: 2rem; border-radius: 12px; max-width: 400px; width: 90%; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.2); 
        }
        .modal h3 { margin-bottom: 1.5rem; }
        .modal input { width: 100%; padding: 1rem; margin-bottom: 1rem; border: 2px solid #e2e8f0; border-radius: 8px; }
        .modal-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
        .modal-actions button { flex: 1; padding: 1rem; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .modal-actions button:first-child { background: #10b981; color: white; }
        
        /* Login */
        .login-page { 
          min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          display: flex; align-items: center; justify-content: center; padding: 2rem; 
        }
        .login-card { 
          background: white; padding: 3rem; border-radius: 20px; width: 100%; max-width: 400px; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.2); text-align: center; 
        }
        .login-card h1 { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; 
          margin-bottom: 2rem; font-size: 2rem; font-weight: 700; 
        }
        .login-card input { 
          width: 100%; padding: 1rem; margin-bottom: 1rem; border: 2px solid #e2e8f0; 
          border-radius: 12px; font-size: 1rem; 
        }
        .login-card button { 
          width: 100%; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 600; 
          cursor: pointer; margin-bottom: 1rem; 
        }
        .toggle-auth { color: #3b82f6; cursor: pointer; font-weight: 500; }
        
        /* Print */
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #strukArea, #strukArea * { visibility: visible; }
          #strukArea { position: absolute; left: 0; top: 0; width: 100%; }
        }
        
        .loading { 
          display: flex; justify-content: center; align-items: center; 
          height: 100vh; font-size: 1.5rem; color: #64748b; 
        }
      `}</style>
    </div>
  );
}

export default App;