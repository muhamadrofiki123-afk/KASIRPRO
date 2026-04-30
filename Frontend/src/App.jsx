import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, increment, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { Html5Qrcode } from 'html5-qrcode';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('vicky_cart') || '[]'));
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isScanningKasir, setIsScanningKasir] = useState(false);
  const [isScanningToko, setIsScanningToko] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [reportFilter, setReportFilter] = useState('hari');
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  
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

  // Scanner logic (sama seperti sebelumnya)
  useEffect(() => {
    let html5QrCode;
    const scannerId = isScanningKasir ? "reader-kasir" : (isScanningToko ? "reader-toko" : null);
    if (scannerId) {
      html5QrCode = new Html5Qrcode(scannerId);
      html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
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
        }
      ).catch(() => {});
    }
    return () => { if (html5QrCode) html5QrCode.stop().catch(() => {}); };
  }, [isScanningKasir, isScanningToko, produk]);

  const addToCart = (p) => {
    if (p.stok <= 0) return alert("Stok habis!");
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const setQuantity = (id, newQty) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(0, newQty) } : item).filter(i => i.qty > 0));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const totalAmount = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  const kembalian = paymentAmount ? Number(paymentAmount) - totalAmount : 0;
  const isPaymentValid = paymentAmount && Number(paymentAmount) >= totalAmount && cart.length > 0;

  // ... (sama seperti kode sebelumnya untuk fungsi lainnya)

  const printBarcode = () => {
    const doc = new jsPDF();
    selectedProducts.forEach((product, index) => {
      if (index > 0) doc.addPage();
      doc.setFontSize(20);
      doc.text(namaToko || 'TOKO', 105, 30, { align: 'center' });
      doc.setFontSize(12);
      doc.text(alamat || '', 105, 45, { align: 'center' });
      doc.text(noTelp || '', 105, 55, { align: 'center' });
      
      // Barcode simulation
      doc.setFontSize(16);
      doc.text(product.nama, 105, 90, { align: 'center' });
      doc.setFontSize(24);
      doc.text(`Rp ${product.harga.toLocaleString()}`, 105, 115, { align: 'center' });
      doc.setFontSize(20);
      doc.text(product.barcode, 105, 140, { align: 'center' });
      
      // Barcode line simulation
      doc.setLineWidth(0.5);
      for (let i = 0; i < 20; i++) {
        doc.line(20 + i * 8, 155, 20 + i * 8, 165);
      }
    });
    doc.save('barcode-labels.pdf');
    setShowBarcodeModal(false);
  };

  const exportExcel = () => {
    const data = transaksi.map(t => ({
      Tanggal: t.waktu ? new Date(t.waktu.seconds * 1000).toLocaleDateString() : 'N/A',
      Total: `Rp ${t.total?.toLocaleString()}`,
      Tunai: `Rp ${t.uangTunai?.toLocaleString()}`,
      Kembali: `Rp ${t.kembalian?.toLocaleString()}`
    }));
    
    const csv = [
      ['Tanggal', 'Total', 'Tunai', 'Kembali'],
      ...data.map(row => row)
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-transaksi-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Render JSX sama seperti sebelumnya tapi dengan styling baru
  if (loading) return <div className="loading">Loading...</div>;

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-glass">
          <div className="login-header">
            <div className="logo">
              <div className="logo-icon">💰</div>
              <h1>POS SMART</h1>
            </div>
            <p>Kasir Modern & Elegan</p>
          </div>
          
          <form className="login-form" onSubmit={handleLogin}>
            <div className="input-group">
              <input 
                type="email" 
                placeholder="Email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
              <span className="input-icon">📧</span>
            </div>
            <div className="input-group">
              <input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
              <span className="input-icon">🔒</span>
            </div>
            <button type="submit" className="login-btn">
              {isRegister ? '📝 Daftar Akun' : '🚀 Masuk Sekarang'}
            </button>
          </form>
          
          <div className="login-footer">
            <span 
              className="toggle-link"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
            </span>
          </div>
        </div>
        
        <div className="login-particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header sama seperti sebelumnya */}
      
      <nav className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={activeTab === 'kasir' ? 'active' : ''} onClick={() => setActiveTab('kasir')}>💰 Kasir</button>
        <button className={activeTab === 'produk' ? 'active' : ''} onClick={() => setActiveTab('produk')}>📦 Produk</button>
        <button className={activeTab === 'barcode' ? 'active' : ''} onClick={() => setShowBarcodeModal(true)}>🏷️ Cetak Barcode</button>
        <button className={activeTab === 'laporan' ? 'active' : ''} onClick={() => setActiveTab('laporan')}>📋 Laporan</button>
      </nav>

      <main>
        {/* Kasir dengan redesign keranjang yang lebih rapi */}
        {activeTab === 'kasir' && (
          <div className="kasir-container">
            <div className="products-panel">
              {/* Search & scanner sama */}
              <div className="search-section">
                <div className="modern-input">
                  <input 
                    placeholder="🔍 Cari produk atau scan barcode" 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                  />
                </div>
                <button className="scan-btn" onClick={() => setIsScanningKasir(true)}>
                  📷 Scan Barcode
                </button>
              </div>
              
              {isScanningKasir && <div id="reader-kasir" className="qr-scanner"></div>}
              
              <div className="products-grid">
                {/* Product cards sama */}
              </div>
            </div>

            {/* KERANJANG REDESIGN - LEBIH RAPI & ELEGANT */}
            <div className="cart-panel-modern">
              <div className="cart-header-modern">
                <div>
                  <h3>🛒 Keranjang Belanja</h3>
                  <span className="cart-count">{cart.length} item</span>
                </div>
                {cart.length > 0 && (
                  <button className="clear-btn" onClick={() => setCart([])}>
                    🗑️ Kosongkan
                  </button>
                )}
              </div>

              <div className="cart-list-modern">
                {cart.map((item, index) => (
                  <div key={item.id} className="cart-item-modern">
                    <div className="item-image-placeholder"></div>
                    <div className="item-details">
                      <h4>{item.nama}</h4>
                      <div className="item-price">Rp {(item.harga * item.qty).toLocaleString()}</div>
                      <div className="item-stock">Stok: {item.stok}</div>
                    </div>
                    <div className="quantity-section">
                      <button className="qty-btn minus" onClick={() => setQuantity(item.id, item.qty - 1)}>-</button>
                      <div className="qty-display">{item.qty}</div>
                      <button className="qty-btn plus" onClick={() => addToCart(item)}>+</button>
                    </div>
                    <button className="remove-item" onClick={() => removeFromCart(item.id)}>×</button>
                  </div>
                ))}
              </div>

              {/* Pembayaran Section - Lebih Compact */}
              <div className="payment-section-modern">
                <div className="total-display">
                  <span>Total Belanja</span>
                  <div className="total-amount">Rp {totalAmount.toLocaleString()}</div>
                </div>
                
                <div className="payment-input-modern">
                  <label>💳 Uang Tunai</label>
                  <div className="input-with-icon">
                    <span>Rp</span>
                    <input 
                      type="number" 
                      value={paymentAmount} 
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className={kembalian < 0 ? 'error' : ''}
                    />
                  </div>
                </div>

                <div className={`kembalian-display ${kembalian < 0 ? 'error' : ''}`}>
                  <span>Kembalian</span>
                  <div className="kembalian-amount">
                    {kembalian < 0 ? '💸 Kurang' : '💰 Kembali'}
                    <strong>Rp {Math.abs(kembalian).toLocaleString()}</strong>
                  </div>
                </div>

                <button 
                  className={`pay-btn ${isPaymentValid ? 'success' : 'disabled'}`}
                  onClick={processPayment}
                  disabled={!isPaymentValid}
                >
                  {isPaymentValid ? '✅ BAYAR & CETAK' : '⚠️ Uang Kurang'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Halaman Produk - Ukurannya Dikecilkan */}
        {activeTab === 'produk' && (
          <div className="produk-container">
            <div className="produk-header-compact">
              <h2>📦 Kelola Produk</h2>
              <div className="produk-actions">
                <button className="scan-compact" onClick={() => setIsScanningToko(true)}>📷 Scan</button>
              </div>
            </div>

            {/* Form lebih compact */}
            <form className="produk-form-compact" onSubmit={simpanProduk}>
              <div className="form-grid-2">
                <input value={namaProd} onChange={e => setNamaProd(e.target.value)} placeholder="Nama Produk" required />
                <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} type="number" placeholder="Harga" required />
              </div>
              <div className="form-grid-2">
                <input value={stokProd} onChange={e => setStokProd(e.target.value)} type="number" placeholder="Stok" required />
                <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Barcode" />
              </div>
              <div className="form-buttons-compact">
                <button type="submit">{editingProduct ? '✏️ Update' : '➕ Tambah'}</button>
                {editingProduct && <button type="button" onClick={resetForm}>❌ Batal</button>}
              </div>
            </form>

            {/* Tabel sama */}
          </div>
        )}

        {/* MODAL CETAK BARCODE */}
        {showBarcodeModal && (
          <div className="modal-overlay">
            <div className="modal-large">
              <div className="modal-header">
                <h3>🏷️ Cetak Barcode & Label</h3>
                <button className="close-modal" onClick={() => setShowBarcodeModal(false)}>×</button>
              </div>
              
              <div className="barcode-selector">
                <div className="selector-header">
                  <h4>Pilih Produk untuk Dicetak:</h4>
                  <div className="selector-controls">
                    <button onClick={() => setSelectedProducts([])}>Clear All</button>
                    <span>{selectedProducts.length} dipilih</span>
                  </div>
                </div>
                
                <div className="products-list">
                  {produk.map(product => (
                    <div key={product.id} className="product-checkbox">
                      <label>
                        <input 
                          type="checkbox" 
                          checked={selectedProducts.some(p => p.id === product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProducts([...selectedProducts, product]);
                            } else {
                              setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
                            }
                          }}
                        />
                        <span className="checkmark"></span>
                        <div>
                          <strong>{product.nama}</strong> - Rp {product.harga.toLocaleString()}
                          <div>{product.barcode}</div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="barcode-actions">
                <button 
                  className="print-barcode-btn" 
                  onClick={printBarcode}
                  disabled={selectedProducts.length === 0}
                >
                  🖨️ Cetak {selectedProducts.length} Label
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Laporan dengan tombol Excel */}
        {activeTab === 'laporan' && (
          <div className="laporan-container">
            <div className="laporan-header">
              <h2>📋 Laporan Transaksi</h2>
              <div className="laporan-controls">
                <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)}>
                  <option value="hari">Hari Ini</option>
                  <option value="minggu">Minggu Ini</option>
                  <option value="bulan">Bulan Ini</option>
                </select>
                <button className="excel-btn" onClick={exportExcel}>
                  📊 Export Excel
                </button>
              </div>
            </div>
            {/* Tabel sama dengan tombol Excel */}
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); min-height: 100vh; }
        
        /* LOGIN - PREMIUM MODERN */
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          position: relative;
          overflow: hidden;
        }
        
        .login-glass {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 24px;
          padding: 3rem 2.5rem;
          width: 100%;
          max-width: 420px;
          box-shadow: 
            0 25px 50px rgba(0,0,0,0.25),
            inset 0 1px 0 rgba(255,255,255,0.3);
          position: relative;
          animation: float 6s ease-in-out infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        .logo {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        
        .logo-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          margin: 0 auto 1rem;
          box-shadow: 0 20px 40px rgba(59, 130, 246, 0.3);
        }
        
        .login-glass h1 {
          font-size: 2.2rem;
          font-weight: 800;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.5rem;
        }
        
        .login-glass p {
          color: rgba(255,255,255,0.8);
          font-size: 1rem;
          margin-bottom: 2.5rem;
        }
        
        .input-group {
          position: relative;
          margin-bottom: 1.5rem;
        }
        
        .input-group input {
          width: 100%;
          padding: 1.2rem 1.2rem 1.2rem 3.5rem;
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 16px;
          font-size: 1rem;
          color: white;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }
        
        .input-group input::placeholder {
          color: rgba(255,255,255,0.6);
        }
        
        .input-group input:focus {
          outline: none;
          border-color: rgba(255,255,255,0.4);
          box-shadow: 0 0 0 4px rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.2);
        }
        
        .input-icon {
          position: absolute;
          left: 1.2rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.7);
          font-size: 1.2rem;
        }
        
        .login-btn {
          width: 100%;
          padding: 1.2rem;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          color: white;
          border: none;
          border-radius: 16px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 40px rgba(59, 130, 246, 0.5);
        }
        
        .login-footer {
          text-align: center;
          margin-top: 1.5rem;
        }
        
        .toggle-link {
          color: rgba(255,255,255,0.8);
          cursor: pointer;
          font-weight: 500;
          transition: color 0.3s ease;
        }
        
        .toggle-link:hover {
          color: white;
        }
        
        .login-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        
        .particle {
          position: absolute;
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
          animation: floatParticle 20s infinite linear;
        }
        
        .particle:nth-child(1) { width: 60px; height: 60px; top: 20%; left: 10%; animation-delay: 0s; }
        .particle:nth-child(2) { width: 40px; height: 40px; top: 60%; right: 20%; animation-delay: 5s; }
        .particle:nth-child(3) { width: 80px; height: 80px; bottom: 20%; left: 20%; animation-delay: 10s; }
        .particle:nth-child(4) { width: 30px; height: 30px; top: 40%; right: 10%; animation-delay: 15s; }
        
        @keyframes floatParticle {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
        }
        
        /* KERANJANG MODERN - LEBIH RAPI */
        .cart-panel-modern {
          width: 400px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          box-shadow: -8px 0 40px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .cart-header-modern {
          padding: 1.5rem 1.25rem;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .cart-header-modern h3 {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 700;
        }
        
        .cart-count {
          background: rgba(255,255,255,0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 500;
        }
        
        .clear-btn {
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .clear-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        
        .cart-list-modern {
          flex: 1;
          padding: 1.25rem;
          overflow-y: auto;
          gap: 1rem;
          display: flex;
          flex-direction: column;
        }
        
        .cart-item-modern {
          display: grid;
          grid-template-columns: 50px 1fr auto;
          gap: 1rem;
          align-items: center;
          padding: 1rem;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transition: all 0.2s;
        }
        
        .cart-item-modern:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        
        .item-image-placeholder {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
          border-radius: 12px;
        }
        
        .item-details h4 {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 0.25rem 0;
        }
        
        .item-price {
          font-size: 1.1rem;
          font-weight: 700;
          color: #10b981;
        }
        
        .item-stock {
          font-size: 0.8rem;
          color: #64748b;
        }
        
        .quantity-section {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f8fafc;
          padding: 0.5rem;
          border-radius: 12px;
        }
        
        .qty-btn {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          font-size: 1.1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .qty-btn.minus {
          background: #fee2e2;
          color: #dc2626;
        }
        
        .qty-btn.plus {
          background: #dcfce7;
          color: #166534;
        }
        
        .qty-btn:hover {
          transform: scale(1.05);
        }
        
        .qty-display {
          min-width: 40px;
          text-align: center;
          font-weight: 700;
          font-size: 1.1rem;
          color: #1e293b;
        }
        
        .remove-item {
          width: 32px;
          height: 32px;
          border: none;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 8px;
          font-size: 1.2rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        /* Payment Section Modern */
        .payment-section-modern {
          padding: 1.5rem;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          border-top: 4px solid #10b981;
        }
        
        .total-display {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid rgba(16, 185, 129, 0.2);
        }
        
        .total-amount {
          font-size: 1.5rem;
          font-weight: 800;
          color: #10b981;
        }
        
        .payment-input-modern {
          margin-bottom: 1.25rem;
        }
        
        .payment-input-modern label {
          display: block;
          margin-bottom: 0.75rem;
          font-weight: 600;
          color: #374151;
          font-size: 0.95rem;
        }
        
        .input-with-icon {
          display: flex;
          align-items: center;
          background: white;
          border-radius: 12px;
          padding: 0.75rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        
        .input-with-icon span {
          color: #64748b;
          font-weight: 600;
          margin-right: 0.75rem;
        }
        
        .input-with-icon input {
          flex: 1;
          border: none;
          font-size: 1.25rem;
          font-weight: 700;
          text-align: right;
          background: transparent;
        }
        
        .input-with-icon input.error {
          color: #ef4444;
        }
        
        .kembalian-display {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 12px;
          margin-bottom: 1.5rem;
          transition: all 0.2s;
        }
        
        .kembalian-display.error {
          background: rgba(239, 68, 68, 0.1);
        }
        
        .kembalian-amount {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }
        
        .kembalian-amount strong {
          font-size: 1.3rem;
          font-weight: 800;
          color: #10b981;
        }
        
        .kembalian-display.error .kembalian-amount strong {
          color: #ef4444;
        }
        
        .pay-btn {
          width: 100%;
          padding: 1.25rem;
          border: none;
          border-radius: 16px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .pay-btn.success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        }
        
        .pay-btn.success:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 12px 35px rgba(16, 185, 129, 0.5);
        }
        
        .pay-btn.disabled {
          background: #cbd5e1;
          color: #94a3b8;
          cursor: not-allowed;
        }
        
        /* Form Produk Compact */
        .produk-form-compact {
          background: white;
          padding: 1.5rem;
          border-radius: 16px;
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
          margin-bottom: 1.5rem;
        }
        
        .form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .form-buttons-compact {
          display: flex;
          gap: 1rem;
        }
        
        .form-buttons-compact button {
          flex: 1;
          padding: 0.875rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        
        /* Modal Barcode Large */
        .modal-large {
          width: 90%;
          max-width: 800px;
          max-height: 80vh;
          overflow-y: auto;
        }
        
        .barcode-selector {
          margin: 1.5rem 0;
        }
        
        .product-checkbox {
          margin-bottom: 1rem;
        }
        
        .product-checkbox label {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #f8fafc;
          border-radius: 12px;
          cursor: pointer;
        }
        
        .checkmark {
          width: 20px;
          height: 20px;
          border: 2px solid #d1d5db;
          border-radius: 4px;
          position: relative;
          margin-right: 1rem;
        }
        
        .checkmark:after {
          content: '';
          position: absolute;
          display: none;
        }
        
        input[type="checkbox"]:checked + .checkmark {
          background: #10b981;
          border-color: #10b981;
        }
        
        input[type="checkbox"]:checked + .checkmark:after {
          display: block;
          left: 6px;
          top: 2px;
          width: 4px;
          height: 8px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        
        /* Excel Button */
        .excel-btn {
          background: linear-gradient(135deg, #059669, #10b981);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .kasir-container {
            flex-direction: column;
          }
          
          .cart-panel-modern {
            width: 100%;
            max-height: 50vh;
          }
        }
      `}</style>
    </div>
  );
}

export default App;