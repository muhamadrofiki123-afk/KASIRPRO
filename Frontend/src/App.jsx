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
  
  // FIX: Anti-Hilang saat Refresh pakai LocalStorage
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
      if(d.exists()) { setNamaToko(d.data().nama); setAlamat(d.data().alamat); setNoTelp(d.data().noTelp); }
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
  }, [isScanningKasir, isScanningToko]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try { setLoading(true); if (isRegister) await createUserWithEmailAndPassword(auth, email, password); else await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { alert('Login Gagal: ' + error.message); } finally { setLoading(false); }
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
    if (produk.find(p => p.barcode === barcodeProd && barcodeProd !== "")) return alert("Barcode sudah ada!");
    const bcode = barcodeProd || Math.floor(Date.now()).toString();
    await addDoc(collection(db, "produk"), { nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: bcode, userId: user.uid, createdAt: new Date() });
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd('');
    alert("Berhasil!");
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
      
      <header className="no-print" style={{ background: 'white', padding: '15px 24px', boxShadow: '0 1px 5px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
        <div><h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', background: 'linear-gradient(to right, #10b981, #059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{namaToko || 'POS MODERN'}</h1></div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button onClick={() => setShowProfileModal(true)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>☰</button>
          <button onClick={() => signOut(auth)} style={{ padding: '8px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>Logout</button>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* NAVIGASI TAB */}
        <div className="no-print" style={{ display: 'flex', background: 'white', padding: '10px 20px', gap: '10px', borderBottom: '1px solid #eee' }}>
          <button onClick={() => setActiveTab('kasir')} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === 'kasir' ? '#10b981' : '#f1f5f9', color: activeTab === 'kasir' ? 'white' : '#64748b', fontWeight: 'bold' }}>💰 Kasir</button>
          <button onClick={() => setActiveTab('dashboard')} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === 'dashboard' ? '#10b981' : '#f1f5f9', color: activeTab === 'dashboard' ? 'white' : '#64748b', fontWeight: 'bold' }}>📊 Dashboard</button>
          <button onClick={() => setActiveTab('toko')} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === 'toko' ? '#10b981' : '#f1f5f9', color: activeTab === 'toko' ? 'white' : '#64748b', fontWeight: 'bold' }}>🏪 Toko</button>
        </div>

        {activeTab === 'kasir' && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* KIRI: PRODUK */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <input type="text" placeholder="🔍 Cari nama atau scan..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, padding: '18px', borderRadius: '16px', border: '2px solid #e2e8f0', outline: 'none' }} />
                <button onClick={() => setIsScanningKasir(!isScanningKasir)} style={{ padding: '0 25px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold' }}>📸 Kamera</button>
              </div>
              {isScanningKasir && <div id="reader-kasir" style={{ marginBottom: '20px', borderRadius: '16px', overflow: 'hidden', border: '3px solid #10b981' }}></div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                  <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', cursor: 'pointer', border: '1px solid #f1f5f9', position: 'relative' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981' }}>Rp {p.harga.toLocaleString()}</div>
                    <div style={{ fontWeight: '700', marginTop: '10px', color: '#1e293b' }}>{p.nama}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '10px' }}>Stok: <span style={{ color: p.stok < 5 ? 'red' : 'green', fontWeight: 'bold' }}>{p.stok}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {/* KANAN: KERANJANG MEWAH */}
            <div style={{ width: '420px', background: 'white', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', boxShadow: '-5px 0 15px rgba(0,0,0,0.02)' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', fontWeight: '800', fontSize: '20px', color: '#1e293b' }}>🛒 Pesanan ({cart.length})</div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', marginBottom: '12px' }}>
                    <div style={{ fontWeight: '700', marginBottom: '8px' }}>{item.nama}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>Rp {(item.harga * item.qty).toLocaleString()}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '5px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <button onClick={() => setQuantity(item.id, item.qty - 1)} style={{ width: '30px', height: '30px', border: 'none', background: '#fee2e2', borderRadius: '8px', color: '#dc2626', fontWeight: 'bold' }}>-</button>
                        <input type="number" value={item.qty} onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)} style={{ width: '40px', textAlign: 'center', border: 'none', fontWeight: '800' }} />
                        <button onClick={() => addToCart(item)} style={{ width: '30px', height: '30px', border: 'none', background: '#dcfce7', borderRadius: '8px', color: '#166534', fontWeight: 'bold' }}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* BAGIAN PEMBAYARAN KONSUMEN */}
              <div style={{ padding: '24px', background: '#f8fafc', borderTop: '2px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>
                  <span>Total Pembelian:</span>
                  <span style={{ fontSize: '24px', fontWeight: '900', color: '#10b981' }}>Rp {totalAmount.toLocaleString()}</span>
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '8px' }}>💳 Pembayaran Customer (Tunai):</label>
                  <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" style={{ width: '100%', padding: '15px', borderRadius: '12px', border: paymentAmount !== '' && Number(paymentAmount) < totalAmount ? '3px solid #ef4444' : '2px solid #10b981', fontSize: '20px', fontWeight: 'bold', outline: 'none' }} />
                </div>

                {paymentAmount !== '' && (
                  <div style={{ padding: '15px', borderRadius: '12px', background: Number(paymentAmount) >= totalAmount ? '#dcfce7' : '#fee2e2', color: Number(paymentAmount) >= totalAmount ? '#166534' : '#dc2626', marginBottom: '15px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold' }}>{Number(paymentAmount) >= totalAmount ? 'Kembalian:' : '⚠️ Uang Kurang:'}</div>
                    <div style={{ fontSize: '22px', fontWeight: '900' }}>Rp {Math.abs(kembalian).toLocaleString()}</div>
                  </div>
                )}

                <button onClick={processPayment} disabled={cart.length === 0 || Number(paymentAmount) < totalAmount} style={{ width: '100%', padding: '20px', background: (cart.length === 0 || Number(paymentAmount) < totalAmount) ? '#cbd5e1' : 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' }}>BAYAR & CETAK STRUK</button>
              </div>
            </div>
          </div>
        )}

        {/* TAB TOKO */}
        {activeTab === 'toko' && (
          <div style={{ padding: '32px', maxWidth: '800px' }}>
            <h2 style={{ marginBottom: '24px' }}>🏪 Kelola Produk</h2>
            <form onSubmit={simpanProduk} style={{ background: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
              <input value={namaProd} onChange={e => setNamaProd(e.target.value)} required placeholder="Nama Produk" style={{ width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '12px', border: '1px solid #ddd' }} />
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" placeholder="Harga Jual" style={{ flex: 1, padding: '15px', borderRadius: '12px', border: '1px solid #ddd' }} />
                <input value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" placeholder="Stok Awal" style={{ flex: 1, padding: '15px', borderRadius: '12px', border: '1px solid #ddd' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Barcode Produk" style={{ flex: 1, padding: '15px', borderRadius: '12px', border: '1px solid #ddd' }} />
                <button type="button" onClick={() => setIsScanningToko(!isScanningToko)} style={{ padding: '0 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}>📸 Scan</button>
              </div>
              {isScanningToko && <div id="reader-toko" style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden' }}></div>}
              <button type="submit" style={{ width: '100%', padding: '18px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px' }}>Simpan Ke Database</button>
            </form>
          </div>
        )}

        {/* TAB DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div style={{ padding: '32px' }}>
            <h2 style={{ marginBottom: '24px' }}>📈 Statistik Penjualan</h2>
            <div style={{ background: 'white', padding: '30px', borderRadius: '24px', height: '300px', display: 'flex', alignItems: 'flex-end', gap: '15px' }}>
              {[15, 45, 30, 80, 55, 90, 65].map((h, i) => (
                <div key={i} style={{ flex: 1, background: '#10b981', height: `${h}%`, borderRadius: '8px 8px 0 0', position: 'relative' }}>
                  <small style={{ position: 'absolute', top: '-25px', width: '100%', textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{h}k</small>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', color: '#64748b', marginTop: '15px' }}>Grafik Aktivitas Penjualan Minggu Ini</p>
          </div>
        )}
      </main>

      {/* MODAL PROFIL */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '380px' }}>
            <h3 style={{ marginTop: 0 }}>⚙️ Pengaturan Toko</h3>
            <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama Toko" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd' }} />
            <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #ddd' }} />
            <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="WhatsApp" style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '10px', border: '1px solid #ddd' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={simpanProfil} style={{ flex: 1, padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>Simpan</button>
              <button onClick={() => setShowProfileModal(false)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL STRUK */}
      {strukData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div id="strukArea" style={{ background: '#fff', width: '300px', padding: '25px', textAlign: 'center', fontFamily: 'monospace', color: '#000' }}>
            <h2 style={{ margin: 0 }}>{namaToko}</h2>
            <p style={{ fontSize: '12px' }}>{alamat}<br/>{noTelp}</p>
            <hr style={{ borderTop: '1px dashed #000' }} />
            <div style={{ textAlign: 'left', fontSize: '13px' }}>
              {strukData.items.map((it, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{it.qty}x {it.nama}</span><span>{(it.harga*it.qty).toLocaleString()}</span></div>)}
            </div>
            <hr style={{ borderTop: '1px dashed #000' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}><span>TOTAL</span><span>Rp {strukData.total.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span>TUNAI</span><span>Rp {strukData.uangTunai.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span>KEMBALI</span><span>Rp {strukData.kembalian.toLocaleString()}</span></div>
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
      `}</style>
    </div>
  );
}

export default App;