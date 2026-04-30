import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, increment, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
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
  
  // Anti-Hilang saat Refresh pakai LocalStorage
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('vicky_cart');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('kasir');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isScanningKasir, setIsScanningKasir] = useState(false);
  const [isScanningToko, setIsScanningToko] = useState(false);
  
  const [strukData, setStrukData] = useState(null);
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');
  
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');
  const [reportFilter, setReportFilter] = useState('hari');

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

  // Kamera Scanner
  useEffect(() => {
    let html5QrCode;
    const scannerId = isScanningKasir ? "reader-kasir" : (isScanningToko ? "reader-toko" : null);
    if (scannerId) {
      html5QrCode = new Html5Qrcode(scannerId);
      html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (isScanningKasir) {
            const found = produk.find(p => p.barcode === decodedText);
            if (found) addToCart(found); else alert('Barcode tidak ada!');
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
    } 
    catch (error) { alert('Login Gagal: ' + error.message); } 
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

  const totalAmount = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  const kembalian = paymentAmount !== '' ? Number(paymentAmount) - totalAmount : 0;

  const processPayment = async () => {
    if (cart.length === 0 || Number(paymentAmount) < totalAmount) return alert("Cek uang bayar!");
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
    } catch (err) { alert("Gagal!"); }
  };

  const simpanProduk = async (e) => {
    e.preventDefault();
    // Validasi Barcode sudah ada
    if (barcodeProd && produk.find(p => p.barcode === barcodeProd)) return alert("Barcode sudah digunakan!");
    const bcode = barcodeProd || Math.floor(Date.now()).toString();
    await addDoc(collection(db, "produk"), { 
      nama: namaProd, 
      harga: Number(hargaProd), 
      stok: Number(stokProd), 
      barcode: bcode, 
      userId: user.uid, 
      createdAt: new Date() 
    });
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd('');
    alert("Berhasil disimpan!");
  };

  const simpanProfil = async () => {
    await setDoc(doc(db, "profilToko", user.uid), {
      nama: namaToko,
      alamat: alamat,
      noTelp: noTelp
    });
    setShowProfileModal(false);
    alert("Profil toko berhasil disimpan!");
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>Memuat...</div>;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
          <h1 style={{ textAlign: 'center', color: '#10b981', marginBottom: '30px' }}>POS MODERN</h1>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '12px', border: '1px solid #ddd' }} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '15px', marginBottom: '20px', borderRadius: '12px', border: '1px solid #ddd' }} />
            <button type="submit" style={{ width: '100%', padding: '15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}>{isRegister ? 'DAFTAR' : 'MASUK'}</button>
          </form>
          <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', textAlign: 'center', marginTop: '15px', color: '#3b82f6' }}>{isRegister ? 'Login' : 'Daftar'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: '#f8fafc' }}>
      
      {/* HEADER */}
      <header className="no-print" style={{ 
        background: 'white', 
        padding: '15px 24px', 
        boxShadow: '0 1px 5px rgba(0,0,0,0.1)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        zIndex: 50,
        position: 'sticky',
        top: 0
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', background: 'linear-gradient(to right, #10b981, #059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {namaToko || 'POS MODERN'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button 
            onClick={() => setShowProfileModal(true)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '28px', 
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              transition: 'all 0.2s'
            }}
            title="Profil Toko"
          >
            👤
          </button>
          <button 
            onClick={() => signOut(auth)} 
            style={{ 
              padding: '8px 16px', 
              background: '#fee2e2', 
              color: '#dc2626', 
              border: 'none', 
              borderRadius: '10px', 
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* NAVIGASI TAB */}
      <div className="no-print" style={{ display: 'flex', background: 'white', padding: '10px 20px', gap: '10px', borderBottom: '1px solid #eee', position: 'sticky', top: '70px', zIndex: 40 }}>
        <button 
          onClick={() => setActiveTab('kasir')} 
          style={{ 
            padding: '10px 20px', 
            borderRadius: '10px', 
            border: 'none', 
            background: activeTab === 'kasir' ? '#10b981' : '#f1f5f9', 
            color: activeTab === 'kasir' ? 'white' : '#64748b', 
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          💰 Kasir
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')} 
          style={{ 
            padding: '10px 20px', 
            borderRadius: '10px', 
            border: 'none', 
            background: activeTab === 'dashboard' ? '#10b981' : '#f1f5f9', 
            color: activeTab === 'dashboard' ? 'white' : '#64748b', 
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          📊 Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('toko')} 
          style={{ 
            padding: '10px 20px', 
            borderRadius: '10px', 
            border: 'none', 
            background: activeTab === 'toko' ? '#10b981' : '#f1f5f9', 
            color: activeTab === 'toko' ? 'white' : '#64748b', 
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🏪 Toko
        </button>
      </div>

      <main style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'kasir' && (
          <div style={{ 
            display: 'flex', 
            height: '100%', 
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* KIRI: PRODUK - Fixed */}
            <div style={{ 
              flex: 1, 
              padding: '24px', 
              overflowY: 'auto',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Cari nama atau scan..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  style={{ 
                    flex: 1, 
                    padding: '18px', 
                    borderRadius: '16px', 
                    border: '2px solid #e2e8f0', 
                    outline: 'none',
                    fontSize: '16px'
                  }} 
                />
                <button 
                  onClick={() => setIsScanningKasir(!isScanningKasir)} 
                  style={{ 
                    padding: '0 25px', 
                    background: '#3b82f6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '16px', 
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📸 Kamera
                </button>
              </div>
              {isScanningKasir && (
                <div 
                  id="reader-kasir" 
                  style={{ 
                    marginBottom: '20px', 
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    border: '3px solid #10b981',
                    width: '100%',
                    height: '300px'
                  }}
                ></div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px' }}>
                {produk
                  .filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search))
                  .map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => addToCart(p)} 
                    style={{ 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', 
                      padding: '24px', 
                      borderRadius: '24px', 
                      boxShadow: '0 10px 30px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05)', 
                      cursor: 'pointer', 
                      border: '1px solid rgba(16,185,129,0.1)', 
                      position: 'relative',
                      transition: 'all 0.3s ease',
                      transform: 'translateY(0)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-8px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ 
                      fontSize: '24px', 
                      fontWeight: '900', 
                      background: 'linear-gradient(135deg, #10b981, #059669)', 
                      WebkitBackgroundClip: 'text', 
                      WebkitTextFillColor: 'transparent',
                      marginBottom: '12px'
                    }}>
                      Rp {p.harga.toLocaleString()}
                    </div>
                    <div style={{ 
                      fontWeight: '800', 
                      marginBottom: '12px', 
                      color: '#1e293b',
                      fontSize: '16px',
                      lineHeight: '1.3'
                    }}>
                      {p.nama}
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: 'rgba(16,185,129,0.1)',
                      borderRadius: '12px'
                    }}>
                      <span style={{ fontSize: '14px', color: '#64748b' }}>Stok:</span>
                      <span style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold', 
                        color: p.stok < 5 ? '#ef4444' : '#10b981'
                      }}>
                        {p.stok}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* KANAN: KERANJANG - Fixed */}
            <div style={{ 
              width: '440px', 
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', 
              borderLeft: '1px solid #e2e8f0', 
              display: 'flex', 
              flexDirection: 'column', 
              boxShadow: '-10px 0 30px rgba(0,0,0,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ 
                padding: '28px 24px 20px', 
                borderBottom: '2px solid #f1f5f9', 
                fontWeight: '900', 
                fontSize: '22px', 
                color: '#1e293b',
                background: 'linear-gradient(135deg, #10b981, #059669)'
              }}>
                🛒 Pesanan ({cart.length})
              </div>
              
              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '24px',
                scrollbarWidth: 'thin'
              }}>
                {cart.map(item => (
                  <div key={item.id} style={{ 
                    background: 'rgba(248,250,252,0.8)', 
                    padding: '20px', 
                    borderRadius: '20px', 
                    marginBottom: '16px',
                    border: '1px solid rgba(226,232,240,0.5)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <div style={{ 
                      fontWeight: '800', 
                      marginBottom: '12px',
                      fontSize: '16px',
                      color: '#1e293b'
                    }}>
                      {item.nama}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ 
                        color: '#10b981', 
                        fontWeight: '900', 
                        fontSize: '20px'
                      }}>
                        Rp {(item.harga * item.qty).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      background: 'white', 
                      padding: '12px 16px', 
                      borderRadius: '16px', 
                      border: '2px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}>
                      <button 
                        onClick={() => setQuantity(item.id, item.qty - 1)} 
                        style={{ 
                          width: '40px', 
                          height: '40px', 
                          border: 'none', 
                          background: '#fee2e2', 
                          borderRadius: '12px', 
                          color: '#dc2626', 
                          fontWeight: 'bold',
                          fontSize: '18px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        −
                      </button>
                      <input 
                        type="number" 
                        value={item.qty} 
                        onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)}
                        style={{ 
                          width: '60px', 
                          textAlign: 'center', 
                          border: 'none', 
                          fontWeight: '900',
                          fontSize: '20px',
                          background: 'transparent'
                        }} 
                      />
                      <button 
                        onClick={() => addToCart(item)} 
                        style={{ 
                          width: '40px', 
                          height: '40px', 
                          border: 'none', 
                          background: '#dcfce7', 
                          borderRadius: '12px', 
                          color: '#166534', 
                          fontWeight: 'bold',
                          fontSize: '18px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* PEMBAYARAN */}
              <div style={{ 
                padding: '28px 24px', 
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
                borderTop: '3px solid #10b981'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '20px', 
                  fontWeight: '800', 
                  marginBottom: '20px',
                  color: '#1e293b',
                  paddingBottom: '16px',
                  borderBottom: '2px solid rgba(16,185,129,0.2)'
                }}>
                  <span>Total Pembelian</span>
                  <span style={{ fontSize: '28px', fontWeight: '900', color: '#10b981' }}>
                    Rp {totalAmount.toLocaleString()}
                  </span>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    fontSize: '15px', 
                    fontWeight: '700', 
                    color: '#64748b', 
                    display: 'block', 
                    marginBottom: '12px'
                  }}>
                    💳 Pembayaran Customer (Tunai)
                  </label>
                  <input 
                    type="number" 
                    value={paymentAmount} 
                    onChange={(e) => setPaymentAmount(e.target.value)} 
                    placeholder="0" 
                    style={{ 
                      width: '100%', 
                      padding: '20px', 
                      borderRadius: '16px', 
                      border: paymentAmount !== '' && Number(paymentAmount) < totalAmount ? '3px solid #ef4444' : '3px solid #10b981', 
                      fontSize: '24px', 
                      fontWeight: '900', 
                      outline: 'none',
                      textAlign: 'right',
                      background: 'white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }} 
                  />
                </div>

                {paymentAmount !== '' && (
                  <div style={{ 
                    padding: '20px', 
                    borderRadius: '16px', 
                    background: Number(paymentAmount) >= totalAmount ? '#dcfce7' : '#fee2e2', 
                    color: Number(paymentAmount) >= totalAmount ? '#166534' : '#dc2626', 
                    marginBottom: '24px', 
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontWeight: 'bold'
                  }}>
                    <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                      {Number(paymentAmount) >= totalAmount ? 'Kembalian:' : '⚠️ Uang Kurang:'}
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '900' }}>
                      Rp {Math.abs(kembalian).toLocaleString()}
                    </div>
                  </div>
                )}

                <button 
                  onClick={processPayment} 
                  disabled={cart.length === 0 || (paymentAmount !== '' && Number(paymentAmount) < totalAmount)}
                  style={{ 
                    width: '100%', 
                    padding: '24px', 
                    background: (cart.length === 0 || (paymentAmount !== '' && Number(paymentAmount) < totalAmount)) 
                      ? '#cbd5e1' 
                      : 'linear-gradient(135deg, #10b981, #059669)', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '20px', 
                    fontWeight: '900', 
                    fontSize: '20px', 
                    cursor: (cart.length === 0 || (paymentAmount !== '' && Number(paymentAmount) < totalAmount)) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 8px 25px rgba(16,185,129,0.4)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  BAYAR & CETAK STRUK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB TOKO */}
        {activeTab === 'toko' && (
          <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '32px', fontSize: '28px', fontWeight: '900', color: '#1e293b' }}>
              🏪 Kelola Produk Toko
            </h2>
            <form onSubmit={simpanProduk} style={{ 
              background: 'white', 
              padding: '40px', 
              borderRadius: '28px', 
              boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
            }}>
              <input 
                value={namaProd} 
                onChange={e => setNamaProd(e.target.value)} 
                required 
                placeholder="Nama Produk" 
                style={{ 
                  width: '100%', 
                  padding: '20px', 
                  marginBottom: '20px', 
                  borderRadius: '16px', 
                  border: '2px solid #e2e8f0',
                  fontSize: '16px'
                }} 
              />
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <input 
                  value={hargaProd} 
                  onChange={e => setHargaProd(e.target.value)} 
                  required 
                  type="number" 
                  placeholder="Harga Jual" 
                  style={{ 
                    flex: 1, 
                    padding: '20px', 
                    borderRadius: '16px', 
                    border: '2px solid #e2e8f0',
                    fontSize: '16px'
                  }} 
                />
                <input 
                  value={stokProd} 
                  onChange={e => setStokProd(e.target.value)} 
                  required 
                  type="number" 
                  placeholder="Stok Awal" 
                  style={{ 
                    flex: 1, 
                    padding: '20px', 
                    borderRadius: '16px', 
                    border: '2px solid #e2e8f0',
                    fontSize: '16px'
                  }} 
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <input 
                  value={barcodeProd} 
                  onChange={e => setBarcodeProd(e.target.value)} 
                  placeholder="Barcode Produk" 
                  style={{ 
                    flex: 1, 
                    padding: '20px', 
                    borderRadius: '16px', 
                    border: '2px solid #e2e8f0',
                    fontSize: '16px'
                  }} 
                />
                <button 
                  type="button" 
                  onClick={() => setIsScanningToko(!isScanningToko)} 
                  style={{ 
                    padding: '0 28px', 
                    background: '#3b82f6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '16px', 
                    fontWeight: 'bold',
                    fontSize: '16px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  📸 Scan Barcode
                </button>
              </div>
              {isScanningToko && (
                <div 
                  id="reader-toko" 
                  style={{ 
                    marginBottom: '24px', 
                    borderRadius: '16px', 
                    overflow: 'hidden',
                    border: '3px solid #3b82f6',
                    width: '100%',
                    height: '350px'
                  }}
                ></div>
              )}
              <button 
                type="submit" 
                style={{ 
                  width: '100%', 
                  padding: '24px', 
                  background: 'linear-gradient(135deg, #10b981, #059669)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '20px', 
                  fontWeight: '900', 
                  fontSize: '18px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 25px rgba(16,185,129,0.4)'
                }}
              >
                💾 Simpan Ke Database
              </button>
            </form>
          </div>
        )}

        {/* TAB DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: '#1e293b' }}>
                📈 Statistik Penjualan Real-time
              </h2>
              <select 
                value={reportFilter} 
                onChange={(e) => setReportFilter(e.target.value)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  background: 'white',
                  fontWeight: '600'
                }}
              >
                <option value="hari">Hari Ini</option>
                <option value="minggu">Minggu Ini</option>
                <option value="bulan">Bulan Ini</option>
                <option value="tahun">Tahun Ini</option>
              </select>
            </div>
            
            {/* Statistik Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '40px' }}>
              <div style={{ background: 'white', padding: '32px', borderRadius: '24px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Total Transaksi</div>
                <div style={{ fontSize: '36px', fontWeight: '900', color: '#10b981' }}>{transaksi.length}</div>
              </div>
              <div style={{ background: 'white', padding: '32px', borderRadius: '24px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Total Penjualan</div>
                <div style={{ fontSize: '36px', fontWeight: '900', color: '#3b82f6' }}>
                  Rp {transaksi.reduce((sum, t) => sum + (t.total || 0), 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Grafik Batang */}
            <div style={{ 
              background: 'white', 
              padding: '40px', 
              borderRadius: '24px', 
              boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
              height: '400px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'flex-end', 
                height: '300px', 
                gap: '12px', 
                padding: '20px 0',
                position: 'relative'
              }}>
                {[
                  { value: 25, label: 'Sen' },
                  { value: 80, label: 'Sel' },
                  { value: 45, label: 'Rab' },
                  { value: 95, label: 'Kam' },
                  { value: 60, label: 'Jum' },
                  { value: 120, label: 'Sab' },
                  { value: 75, label: 'Min' }
                ].map((item, i) => (
                  <div key={i} style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center'
                  }}>
                    <div style={{ 
                      width: '40px', 
                      height: `${item.value}%`, 
                      background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)', 
                      borderRadius: '8px 8px 0 0',
                      marginBottom: '8px',
                      position: 'relative',
                      boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '-30px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}>
                        Rp {item.value}K
                      </div>
                    </div>
                    <small style={{ color: '#64748b', fontWeight: '600' }}>{item.label}</small>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', marginTop: '16px' }}>
                📊 Grafik Penjualan {reportFilter === 'hari' ? 'Hari Ini' : reportFilter === 'minggu' ? 'Minggu Ini' : reportFilter === 'bulan' ? 'Bulan Ini' : 'Tahun Ini'}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* MODAL PROFIL TOKO */}
      {showProfileModal && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.6)', 
          zIndex: 1000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ 
            background: 'white', 
            padding: '40px', 
            borderRadius: '28px', 
            width: '450px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
          }}>
            <h3 style={{ 
              marginTop: 0, 
              fontSize: '24px', 
              fontWeight: '900', 
              color: '#1e293b',
              marginBottom: '24px'
            }}>
              ⚙️ Pengaturan Profil Toko
            </h3>
            <input 
              value={namaToko} 
              onChange={e => setNamaToko(e.target.value)} 
              placeholder="Nama Toko" 
              style={{ 
                width: '100%', 
                padding: '18px', 
                marginBottom: '16px', 
                borderRadius: '16px', 
                border: '2px solid #e2e8f0',
                fontSize: '16px'
              }} 
            />
            <input 
              value={alamat} 
              onChange={e => setAlamat(e.target.value)} 
              placeholder="Alamat Lengkap" 
              style={{ 
                width: '100%', 
                padding: '18px', 
                marginBottom: '16px', 
                borderRadius: '16px', 
                border: '2px solid #e2e8f0',
                fontSize: '16px'
              }} 
            />
            <input 
              value={noTelp} 
              onChange={e => setNoTelp(e.target.value)} 
              placeholder="No. WhatsApp" 
              style={{ 
                width: '100%', 
                padding: '18px', 
                marginBottom: '28px', 
                borderRadius: '16px', 
                border: '2px solid #e2e8f0',
                fontSize: '16px'
              }} 
            />
            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                onClick={simpanProfil} 
                style={{ 
                  flex: 1, 
                  padding: '18px', 
                  background: 'linear-gradient(135deg, #10b981, #059669)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '16px', 
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                💾 Simpan Perubahan
              </button>
              <button 
                onClick={() => setShowProfileModal(false)} 
                style={{ 
                  flex: 1, 
                  padding: '18px', 
                  background: '#f1f5f9', 
                  color: '#64748b', 
                  border: 'none', 
                  borderRadius: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ❌ Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL STRUK - Tidak diubah */}
      {strukData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div id="strukArea" style={{ background: '#fff', width: '300px', padding: '25px', textAlign: 'center', fontFamily: 'monospace', color: '#000' }}>
            <h2 style={{ margin: 0 }}>{namaToko}</h2>
            <p style={{ fontSize: '12px' }}>{alamat}<br/>{noTelp}</p>
            <hr style={{ borderTop: '1px dashed #000' }} />
            <div style={{ textAlign: 'left', fontSize: '13px' }}>
              {strukData.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{it.qty}x {it.nama}</span>
                  <span>{(it.harga*it.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <hr style={{ borderTop: '1px dashed #000' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
              <span>TOTAL</span>
              <span>Rp {strukData.total.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>TUNAI</span>
              <span>Rp {strukData.uangTunai.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>KEMBALI</span>
              <span>Rp {strukData.kembalian.toLocaleString()}</span>
            </div>
            <p style={{ marginTop: '20px', fontSize: '12px' }}>*** TERIMA KASIH ***</p>
            <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px' }}>Print</button>
              <button onClick={() => setStrukData(null)} style={{ flex: 1, padding: '10px', background: '#eee', border: 'none', borderRadius: '8px' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #strukArea, #strukArea * { visibility: visible; }
          #strukArea { position: absolute; left: 0; top: 0; width: 100%; border: none; }
        }
        /* Custom Scrollbar */
        div::-webkit-scrollbar { width: 6px; }
        div::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
        div::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        div::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}

export default App;