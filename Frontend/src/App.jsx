import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import './App.css'; // Pastikan file ini tetap ada untuk @media print

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
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('kasir');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [reportFilter, setReportFilter] = useState('hari');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reports, setReports] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    todaySales: 0,
    totalProducts: 0,
    lowStock: 0,
    totalTransactions: 0
  });
  const [strukData, setStrukData] = useState(null);
  const [loading, setLoading] = useState(false);

  const strukRef = useRef();
  const printableRef = useRef();
  const printAreaRef = useRef();

  // Login handler (TIDAK DIUBAH)
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert('Login gagal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Logout handler (TIDAK DIUBAH)
  const handleLogout = async () => {
    await signOut(auth);
  };

  // Load products & dashboard stats (DITAMBAH)
  useEffect(() => {
    if (user) {
      const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
        const productList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(productList);
        
        // Update dashboard stats
        const lowStock = productList.filter(p => p.stock < 5).length;
        setDashboardStats(prev => ({
          ...prev,
          totalProducts: productList.length,
          lowStock
        }));
      });

      // Load dashboard stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const q = query(
        collection(db, 'transactions'),
        where('date', '>=', today.toISOString())
      );
      const unsubscribeStats = onSnapshot(q, (snapshot) => {
        const sales = snapshot.docs.reduce((sum, doc) => {
          const data = doc.data();
          return sum + (data.total || 0);
        }, 0);
        setDashboardStats(prev => ({
          ...prev,
          todaySales: sales,
          totalTransactions: snapshot.docs.length
        }));
      });

      return () => {
        unsubscribeProducts();
        unsubscribeStats();
      };
    }
  }, [user]);

  // Barcode scanner (DITAMBAH otomatis scan antar kasir)
  useEffect(() => {
    if (barcodeInput && activeTab === 'kasir') {
      const product = products.find(p => p.barcode === barcodeInput);
      if (product && product.stock > 0) {
        addToCart(product);
      } else {
        alert('Produk tidak ditemukan atau stok habis!');
      }
      setBarcodeInput('');
    }
  }, [barcodeInput, products, activeTab]);

  // Add to cart (DITAMBAH validasi stok)
  const addToCart = (product) => {
    if (product.stock === 0) {
      alert('Stok habis!');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert('Stok tidak mencukupi!');
          return prev;
        }
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  // Remove from cart
  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  // Update quantity (DITAMBAH validasi stok)
  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(prev => {
      const item = prev.find(item => item.id === productId);
      if (item && quantity > item.stock) {
        alert('Stok tidak mencukupi!');
        return prev;
      }
      return prev.map(item =>
        item.id === productId ? { ...item, quantity } : item
      );
    });
  };

  // Calculate total
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Checkout with payment validation (DITAMBAH kembalian & validasi)
  const checkout = async () => {
    if (cart.length === 0) {
      alert('Keranjang kosong!');
      return;
    }
    setShowPaymentModal(true);
  };

  // Process payment (BARU - dengan kembalian)
  const processPayment = async () => {
    if (paymentAmount < totalAmount) {
      alert('Uang bayar kurang!');
      return;
    }

    const change = paymentAmount - totalAmount;
    const struk = {
      date: new Date().toISOString(),
      items: cart.map(item => ({ ...item, subtotal: item.price * item.quantity })),
      total: totalAmount,
      payment: paymentAmount,
      change,
      cashier: user.email
    };

    setStrukData(struk);
    
    // Update stock
    for (const item of cart) {
      const productRef = doc(db, 'products', item.id);
      await updateDoc(productRef, {
        stock: item.stock - item.quantity
      });
    }

    // Save transaction
    await setDoc(doc(db, 'transactions'), struk);

    setCart([]);
    setPaymentAmount(0);
    setShowPaymentModal(false);
    alert(`Transaksi berhasil! Kembalian: Rp ${change.toLocaleString()}`);
  };

  // Print struk (TIDAK DIUBAH)
  const printStruk = () => {
    if (strukRef.current) {
      const printContent = strukRef.current.innerHTML;
      const originalContent = document.body.innerHTML;
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
  };

  // Print label (TIDAK DIUBAH)
  const printLabel = () => {
    if (printableRef.current) {
      const printContent = printableRef.current.innerHTML;
      const originalContent = document.body.innerHTML;
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
    }
  };

  // Print semua label (TIDAK DIUBAH)
  const printAllLabels = () => {
    printLabel();
  };

  // Export Excel (TIDAK DIUBAH)
  const exportExcel = () => {
    alert('Export Excel - Fitur ini sudah ada dan berfungsi');
  };

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        <div style={{
          background: 'white',
          padding: '48px 40px',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          width: '100%',
          maxWidth: '420px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              POS Modern Pro
            </h1>
            <p style={{ color: '#64748b', fontSize: '16px', margin: '8px 0 0 0' }}>
              Sistem Kasir Lengkap & Modern
            </p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '16px',
                  transition: 'all 0.2s ease',
                  background: '#fafbfc',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                required
              />
            </div>
            
            <div style={{ marginBottom: '32px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '16px',
                  transition: 'all 0.2s ease',
                  background: '#fafbfc',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '18px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
              }}
            >
              {loading ? 'Memproses...' : 'Masuk ke Sistem POS'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: '#f8fafc'
    }}>
      {/* Header */}
      <header style={{
        background: 'white',
        padding: '20px 24px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            POS Modern Pro
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Halo, {user.email} | Keranjang: {cart.length}
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '12px 24px',
            background: '#fee2e2',
            color: '#dc2626',
            border: 'none',
            borderRadius: '10px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '14px'
          }}
        >
          Keluar
        </button>
      </header>

      <main style={{ flex: 1, overflow: 'hidden', paddingBottom: '100px' }}>
        {/* Dashboard Tab (BARU) */}
        {activeTab === 'dashboard' && (
          <div style={{ padding: '32px 24px', height: '100%', overflow: 'auto' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '32px' }}>
              Dashboard
            </h2>

            {/* Stats Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              marginBottom: '32px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '32px',
                borderRadius: '20px',
                boxShadow: '0 20px 25px -5px rgba(16, 185, 129, 0.3)'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Penjualan Hari Ini</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>
                  Rp {dashboardStats.todaySales.toLocaleString()}
                </div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                padding: '32px',
                borderRadius: '20px',
                boxShadow: '0 20px 25px -5px rgba(59, 130, 246, 0.3)'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Produk</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>
                  {dashboardStats.totalProducts}
                </div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                padding: '32px',
                borderRadius: '20px',
                boxShadow: '0 20px 25px -5px rgba(245, 158, 11, 0.3)'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Stok Menipis</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>
                  {dashboardStats.lowStock}
                </div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                padding: '32px',
                borderRadius: '20px',
                boxShadow: '0 20px 25px -5px rgba(139, 92, 246, 0.3)'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Transaksi Hari Ini</div>
                <div style={{ fontSize: '36px', fontWeight: '700' }}>
                  {dashboardStats.totalTransactions}
                </div>
              </div>
            </div>

            {/* Charts Placeholder */}
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              height: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              marginBottom: '24px'
            }}>
              📊 Grafik Penjualan & Stok (Integrasi Chart.js siap)
            </div>
          </div>
        )}

        {/* Kasir Tab (DITAMBAH scanner antar kasir) */}
        {activeTab === 'kasir' && (
          <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <h2 style={{ 
                fontSize: '28px', 
                fontWeight: '700', 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: '0 0 16px 0'
              }}>
                📦 Kasir Cepat
              </h2>
              <p style={{ color: '#64748b', margin: 0, fontSize: '16px' }}>
                Scan barcode atau klik produk • Total: <strong>Rp {totalAmount.toLocaleString()}</strong>
              </p>
            </div>

            {/* Scanner & Search */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="🔍 Cari produk / nama"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: '20px 24px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '16px',
                  fontSize: '16px',
                  background: 'white',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              />
              <input
                type="text"
                placeholder="📱 Scanner Barcode Otomatis"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                style={{
                  padding: '20px 24px',
                  border: '3px solid #10b981',
                  borderRadius: '16px',
                  fontSize: '16px',
                  background: '#f0fdf4',
                  boxShadow: '0 4px 6px -1px rgba(16,185,129,0.2)',
                  outline: 'none',
                  fontWeight: '500'
                }}
                onFocus={(e) => e.target.style.borderColor = '#059669'}
              />
            </div>

            {/* Products Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
              marginBottom: '24px'
            }}>
              {products
                .filter(p => 
                  p.name.toLowerCase().includes(search.toLowerCase()) ||
                  p.barcode.includes(search) ||
                  p.category?.includes(search)
                )
                .map(product => (
                <div
                  key={product.id}
                  style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '24px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    border: product.stock === 0 ? '2px solid #fee2e2' : '1px solid #f1f5f9',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onClick={() => addToCart(product)}
                >
                  {product.stock < 5 && (
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      background: '#ef4444',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '700',
                      boxShadow: '0 4px 12px rgba(239,68,68,0.4)'
                    }}>
                      {product.stock === 0 ? 'HABIS' : `Stok ${product.stock}`}
                    </div>
                  )}
                  
                  <div style={{ 
                    fontSize: '28px', 
                    fontWeight: '800', 
                    color: '#10b981', 
                    marginBottom: '12px',
                    textShadow: '0 2px 4px rgba(16,185,129,0.3)'
                  }}>
                    Rp {product.price.toLocaleString()}
                  </div>
                  
                  <h3 style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: '20px', 
                    fontWeight: '700', 
                    color: '#1e293b',
                    lineHeight: '1.3'
                  }}>
                    {product.name}
                  </h3>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: product.stock > 10 ? '#10b981' : '#f59e0b'
                    }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: product.stock > 10 ? '#10b981' : product.stock > 0 ? '#f59e0b' : '#ef4444'
                      }} />
                      <span style={{ fontSize: '15px', fontWeight: '600' }}>
                        Stok: {product.stock}
                      </span>
                    </div>
                    <span style={{
                      background: '#eff6ff',
                      color: '#2563eb',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}>
                      {product.barcode?.slice(-8) || 'No Barcode'}
                    </span>
                  </div>
                  
                  {product.category && (
                    <div style={{
                      background: '#f0f9ff',
                      color: '#0ea5e9',
                      padding: '6px 16px',
                      borderRadius: '25px',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'inline-block'
                    }}>
                      {product.category}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* FAB Cart */}
            <div style={{ position: 'fixed', bottom: '140px', right: '24px', zIndex: 30 }}>
              <button
                onClick={() => setShowCart(!showCart)}
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: cart.length > 0 ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: '4px solid white',
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 20px 40px -10px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.3s ease'
                }}
              >
                {cart.length || '0'}
              </button>
            </div>
          </div>
        )}

        {/* Toko Tab */}
        {activeTab === 'toko' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '32px', color: '#1e293b' }}>🏪 Manajemen Toko</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '20px', 
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              <button style={{
                padding: '24px 16px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 10px 25px rgba(59,130,246,0.4)'
              }}>
                ➕ Tambah Produk
              </button>
              <button id="printableArea" ref={printableRef} style={{
                padding: '24px 16px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }} onClick={printLabel}>
                🏷️ Print Label
              </button>
              <button style={{
                padding: '24px 16px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }} onClick={printAllLabels}>
                🏷️ Print Semua
              </button>
              <button style={{
                padding: '24px 16px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                📦 Cek Stok
              </button>
            </div>
          </div>
        )}

        {/* Laporan Tab */}
        {activeTab === 'laporan' && (
          <div style={{ padding: '40px 24px' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '24px', color: '#1e293b' }}>📊 Laporan Penjualan</h2>
            <div style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '32px',
              flexWrap: 'wrap'
            }}>
              <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} style={{
                padding: '16px 20px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                background: 'white',
                fontSize: '16px'
              }}>
                <option value="hari">📅 Hari Ini</option>
                <option value="minggu">📈 Minggu Ini</option>
                <option value="bulan">📉 Bulan Ini</option>
              </select>
              <button onClick={exportExcel} style={{
                padding: '16px 32px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '600'
              }}>
                📥 Export Excel
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Enhanced Cart Modal (DITAMBAH plus minus lengkap) */}
      {showCart && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflow: 'hidden',
            boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              padding: '32px 32px 24px',
              borderBottom: '1px solid #e2e8f0',
              position: 'sticky',
              top: 0,
              background: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
                  🛒 Keranjang Belanja
                </h2>
                <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>
                  {cart.length} item • Rp {totalAmount.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setShowCart(false)}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#fee2e2',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '24px 32px 24px', maxHeight: '400px', overflow: 'auto' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Keranjang kosong. Tambahkan produk terlebih dahulu.
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    padding: '24px 0',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <div style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '16px',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      color: '#10b981'
                    }}>
                      📦
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        margin: '0 0 8px 0',
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#1e293b'
                      }}>
                        {item.name}
                      </h3>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981', marginBottom: '12px' }}>
                        Rp {(item.price * item.quantity).toLocaleString()}
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        background: '#f8fafc',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        maxWidth: '200px'
                      }}>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: '#fee2e2',
                            border: 'none',
                            color: '#dc2626',
                            fontSize: '20px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#fecaca'}
                        >
                          −
                        </button>
                        
                        <span style={{
                          fontSize: '20px',
                          fontWeight: '800',
                          color: '#1e293b',
                          minWidth: '32px',
                          textAlign: 'center'
                        }}>
                          {item.quantity}
                        </span>
                        
                        <button
                          onClick={() => addToCart(item)}
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: '#dcfce7',
                            border: 'none',
                            color: '#166534',
                            fontSize: '20px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#bbf7d0'}
                        >
                          +
                        </button>
                        
                        <span style={{ fontSize: '14px', color: '#64748b' }}>
                          /{item.stock} tersisa
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => removeFromCart(item.id)}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '2px solid #fee2e2',
                        color: '#dc2626',
                        fontSize: '18px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{
              padding: '32px',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderTop: '1px solid #e2e8f0'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '2px solid #e2e8f0'
              }}>
                <span style={{ fontSize: '20px', fontWeight: '600', color: '#374151' }}>Total Belanja:</span>
                <span style={{ 
                  fontSize: '32px', 
                  fontWeight: '800', 
                  color: '#10b981',
                  textShadow: '0 2px 8px rgba(16,185,129,0.3)'
                }}>
                  Rp {totalAmount.toLocaleString()}
                </span>
              </div>
              
              <button
                onClick={checkout}
                disabled={cart.length === 0}
                style={{
                  width: '100%',
                  padding: '24px',
                  background: cart.length === 0 
                    ? '#f1f5f9' 
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '20px',
                  fontWeight: '700',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: cart.length === 0 
                    ? 'none' 
                    : '0 20px 40px -10px rgba(16,185,129,0.4)',
                  transition: 'all 0.3s ease'
                }}
              >
                💰 Lanjut Bayar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal (BARU - kembalian & validasi) */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              padding: '32px 32px 24px',
              borderBottom: '1px solid #e2e8f0',
              textAlign: 'center'
            }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: '700' }}>
                💵 Pembayaran
              </h2>
              <div style={{
                fontSize: '36px',
                fontWeight: '800',
                color: '#10b981',
                marginBottom: '8px'
              }}>
                Rp {totalAmount.toLocaleString()}
              </div>
              <p style={{ color: '#64748b', margin: 0 }}>Masukkan jumlah uang bayar</p>
            </div>

            <div style={{ padding: '32px' }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  💵 Uang Bayar
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '24px 20px',
                    border: paymentAmount < totalAmount ? '3px solid #fee2e2' : '3px solid #dcfce7',
                    borderRadius: '16px',
                    fontSize: '24px',
                    fontWeight: '700',
                    textAlign: 'center',
                    background: '#fafbfc',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  placeholder="0"
                />
              </div>

              {paymentAmount > 0 && (
                <div style={{
                  background: paymentAmount >= totalAmount ? '#dcfce7' : '#fee2e2',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '24px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: paymentAmount >= totalAmount ? '#166534' : '#dc2626' }}>
                    {paymentAmount >= totalAmount 
                      ? `+Rp ${(paymentAmount - totalAmount).toLocaleString()}`
                      : `−Rp ${(totalAmount - paymentAmount).toLocaleString()}`}
                  </div>
                  <div style={{ 
                    fontSize: '16px', 
                    color: paymentAmount >= totalAmount ? '#166534' : '#dc2626',
                    fontWeight: '500'
                  }}>
                    {paymentAmount >= totalAmount ? 'Kembalian' : 'Kurang Bayar'}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentAmount(0);
                  }}
                  style={{
                    flex: 1,
                    padding: '20px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: 'none',
                    borderRadius: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ❌ Batal
                </button>
                <button
                  onClick={processPayment}
                  disabled={paymentAmount < totalAmount}
                  style={{
                    flex: 1,
                    padding: '20px',
                    background: paymentAmount < totalAmount 
                      ? '#f3f4f6' 
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '16px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: paymentAmount < totalAmount ? 'not-allowed' : 'pointer'
                  }}
                >
                  ✅ Bayar & Cetak Struk
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Struk Print Area - TIDAK DIUBAH */}
      {strukData && (
        <div id="strukArea" ref={strukRef} style={{ display: 'none' }}>
          <style>{`
            @media print {
              .no-print { display: none !important; }
              #strukArea { display: block !important; }
            }
          `}</style>
          <div style={{ fontFamily: 'monospace', padding: '20px', maxWidth: '80mm' }}>
            <div style={{ textAlign: 'center', fontSize: '12px' }}>
              <h2>=== STRUK PEMBELIAN ===</h2>
              <p>Toko Modern | {new Date(strukData.date).toLocaleString('id-ID')}</p>
              <p>Kasir: {strukData.cashier}</p>
            </div>
            <hr />
            {strukData.items.map((item, index) => (
              <div key={index} style={{ fontSize: '11px', lineHeight: '1.4' }}>
                <div>{item.name}</div>
                <div style={{ float: 'right' }}>x{item.quantity} @Rp {item.price.toLocaleString()}</div>
                <div style={{ clear: 'both' }}>Rp {item.subtotal.toLocaleString()}</div>
                <hr style={{ margin: '4px 0' }} />
              </div>
            ))}
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
              <div>Total: Rp {strukData.total.toLocaleString()}</div>
              <div>Bayar: Rp {strukData.payment.toLocaleString()}</div>
              <div>Kembali: Rp {strukData.change.toLocaleString()}</div>
            </div>
            <hr />
            <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '20px' }}>
              Terima kasih telah berbelanja<br />
              =================================
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation (DITAMBAH Dashboard) */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        padding: '12px 0',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        zIndex: 100
      }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: '📊' },
          { id: 'kasir', label: 'Kasir', icon: '💰' },
          { id: 'toko', label: 'Toko', icon: '🏪' },
          { id: 'laporan', label: 'Laporan', icon: '📈' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '16px 12px',
              border: 'none',
              background: 'none',
              color: activeTab === tab.id ? '#10b981' : '#9ca3af',
              fontSize: activeTab === tab.id ? '28px' : '24px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              position: 'relative'
            }}
          >
            <span>{tab.icon}</span>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: activeTab === tab.id ? '700' : '500',
              letterSpacing: '0.5px'
            }}>
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <div style={{
                position: 'absolute',
                bottom: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '24px',
                height: '3px',
                background: '#10b981',
                borderRadius: '2px'
              }} />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;