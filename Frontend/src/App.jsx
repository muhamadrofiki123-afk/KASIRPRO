import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, increment, query, where, orderBy, onSnapshot, serverTimestamp, getDocs } from 'firebase/firestore';
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
  
  // Anti Hilang saat Refresh
  const [cart, setCart] = useState(() => {
    try { const saved = localStorage.getItem('kasirCart'); return saved ? JSON.parse(saved) : []; } 
    catch(e) { return []; }
  });
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('kasir');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Scanner States
  const [isScanningKasir, setIsScanningKasir] = useState(false);
  const [isScanningToko, setIsScanningToko] = useState(false);
  
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
  const [dashboardStats, setDashboardStats] = useState({ todaySales: 0, totalProducts: 0, lowStock: 0 });

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).then(() => {
      onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    });
  }, []);

  useEffect(() => { localStorage.setItem('kasirCart', JSON.stringify(cart)); }, [cart]);

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
        }).catch(() => {});
    }
    return () => { if (html5QrCode) html5QrCode.stop().catch(() => {}); };
  }, [isScanningKasir, isScanningToko]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (isRegister) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (error) { alert('Gagal: ' + error.message); } finally { setLoading(false); }
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
    if (cart.length === 0 || Number(paymentAmount) < totalAmount) return alert("Periksa keranjang atau uang bayar!");
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
      setCart([]); setPaymentAmount('');
    } catch (err) { alert("Gagal transaksi"); }
  };

  const simpanProduk = async (e) => {
    e.preventDefault();
    // Validasi Kode Unik
    const checkDuplicate = produk.find(p => p.barcode === barcodeProd && barcodeProd !== "");
    if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan oleh produk lain!");

    const bcode = barcodeProd || Math.floor(Date.now()).toString();
    await addDoc(collection(db, "produk"), { nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: bcode, userId: user.uid, createdAt: new Date() });
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd('');
    alert("Produk Berhasil Disimpan!");
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#10b981' }}><strong>Memuat Sistem...</strong></div>;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '24px', width: '100%', maxWidth: '400px' }}>
          <h1 style={{ textAlign: 'center', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>POS Pro</h1>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '15px', marginBottom: '20px', borderRadius: '12px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
            <button type="submit" style={{ width: '100%', padding: '15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{isRegister ? 'DAFTAR' : 'MASUK'}</button>
          </form>
          <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', textAlign: 'center', marginTop: '15px', color: '#3b82f6', fontSize: '14px' }}>{isRegister ? 'Sudah punya akun? Login' : 'Daftar Toko Baru'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: '#f8fafc' }}>
      
      <header className="no-print" style={{ background: 'white', padding: '15px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
        <div><h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#10b981' }}>{namaToko || 'POS Modern'}</h1></div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={() => setShowProfileModal(true)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>☰</button>
          <button onClick={() => signOut(auth)} style={{ padding: '8px 15px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Logout</button>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'auto', paddingBottom: '80px' }}>
        {activeTab === 'dashboard' && (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div style={{ background: '#10b981', color: 'white', padding: '25px', borderRadius: '15px' }}>
                <small>Penjualan Hari Ini</small>
                <h2>Rp {dashboardStats.todaySales.toLocaleString()}</h2>
              </div>
              <div style={{ background: '#3b82f6', color: 'white', padding: '25px', borderRadius: '15px' }}>
                <small>Total Produk</small>
                <h2>{dashboardStats.totalProducts} Item</h2>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kasir' && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* KIRI: PRODUK */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input type="text" placeholder="🔍 Cari nama atau scan..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, padding: '15px', borderRadius: '12px', border: '1px solid #ddd', outline: 'none' }} />
                <button onClick={() => setIsScanningKasir(!isScanningKasir)} style={{ padding: '0 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>📸</button>
              </div>
              {isScanningKasir && <div id="reader-kasir" style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden' }}></div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                  <div key={p.id} onClick={() => addToCart(p)} style={{ background: 'white', padding: '15px', borderRadius: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', cursor: 'pointer', border: p.stok === 0 ? '1px solid red' : '1px solid transparent' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{p.nama}</div>
                    <div style={{ color: '#10b981', fontWeight: 'bold', margin: '5px 0' }}>Rp {p.harga.toLocaleString()}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Stok: {p.stok}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* KANAN: KERANJANG TERBELAH */}
            <div style={{ width: '380px', background: 'white', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold', fontSize: '18px' }}>🛒 Keranjang ({cart.length})</div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ marginBottom: '15px', borderBottom: '1px solid #f8fafc', paddingBottom: '10px' }}>
                    <div style={{ fontWeight: '600' }}>{item.name || item.nama}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                      <span style={{ color: '#10b981', fontSize: '14px' }}>Rp {(item.harga * item.qty).toLocaleString()}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                        <button onClick={() => setQuantity(item.id, item.qty - 1)} style={{ width: '25px', height: '25px', border: 'none', background: 'white', borderRadius: '5px', cursor: 'pointer' }}>-</button>
                        <input type="number" value={item.qty} onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)} style={{ width: '35px', textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 'bold' }} />
                        <button onClick={() => addToCart(item)} style={{ width: '25px', height: '25px', border: 'none', background: '#10b981', color: 'white', borderRadius: '5px', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '20px', background: '#f8fafc', borderTop: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Total Tagihan:</span><span style={{ fontWeight: 'bold', color: '#10b981' }}>Rp {totalAmount.toLocaleString()}</span>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', color: '#666' }}>Pembayaran Customer:</label>
                  <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: paymentAmount !== '' && Number(paymentAmount) < totalAmount ? '2px solid #ef4444' : '1px solid #ddd', outline: 'none' }} placeholder="Masukkan uang..." />
                </div>
                {paymentAmount !== '' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: Number(paymentAmount) < totalAmount ? '#dc2626' : '#16a34a', marginBottom: '15px', fontWeight: 'bold' }}>
                    <span>{Number(paymentAmount) < totalAmount ? '⚠️ Kurang:' : 'Kembalian:'}</span>
                    <span>Rp {Math.abs(kembalian).toLocaleString()}</span>
                  </div>
                )}
                <button onClick={processPayment} disabled={cart.length === 0 || Number(paymentAmount) < totalAmount} style={{ width: '100%', padding: '15px', background: (cart.length === 0 || Number(paymentAmount) < totalAmount) ? '#cbd5e1' : '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>BAYAR & CETAK STRUK</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'toko' && (
          <div style={{ padding: '24px' }}>
            <h2 style={{ marginBottom: '20px' }}>Manajemen Produk</h2>
            <form onSubmit={simpanProduk} style={{ background: 'white', padding: '25px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', maxWidth: '600px' }}>
              <input value={namaProd} onChange={e => setNamaProd(e.target.value)} required placeholder="Nama Produk" style={{ width: '100%', padding: '12px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '8px' }} />
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" placeholder="Harga Jual" style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }} />
                <input value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" placeholder="Stok Awal" style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Barcode Produk" style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }} />
                <button type="button" onClick={() => setIsScanningToko(!isScanningToko)} style={{ padding: '0 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>📸 Scan</button>
              </div>
              {isScanningToko && <div id="reader-toko" style={{ marginBottom: '15px' }}></div>}
              <button type="submit" style={{ width: '100%', padding: '15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Simpan Produk</button>
            </form>
            
            <div style={{ marginTop: '20px' }}>
               <button onClick={() => { setPrintData(produk); setPrintMode('label'); }} style={{ padding: '10px 20px', background: '#000', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Print Label Semua Barcode</button>
            </div>
          </div>
        )}
      </main>

      <nav className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #e5e7eb', display: 'flex', padding: '10px 0', zIndex: 100 }}>
        {[{id:'dashboard', icon:'📊'}, {id:'kasir', icon:'💰'}, {id:'toko', icon:'🏪'}, {id:'laporan', icon:'📈'}].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: 1, background: 'none', border: 'none', fontSize: '24px', color: activeTab === t.id ? '#10b981' : '#9ca3af', cursor: 'pointer' }}>{t.icon}</button>
        ))}
      </nav>

      {/* MODAL PROFIL */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '20px', width: '350px' }}>
            <h3 style={{ marginTop: 0 }}>Profil Toko</h3>
            <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama Toko" style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
            <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat" style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
            <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="WhatsApp" style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ddd' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={simpanProfil} style={{ flex: 1, padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px' }}>Simpan</button>
              <button onClick={() => setShowProfileModal(false)} style={{ flex: 1, padding: '10px', background: '#eee', border: 'none', borderRadius: '8px' }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* AREA STRUK */}
      {strukData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div id="strukArea" style={{ background: '#fff', width: '300px', padding: '20px', textAlign: 'center', fontFamily: 'monospace' }}>
            <h2 style={{ margin: 0 }}>{namaToko}</h2>
            <p style={{ fontSize: '12px' }}>{alamat}<br/>{noTelp}</p>
            <hr style={{ borderTop: '1px dashed #000' }} />
            <div style={{ textAlign: 'left', fontSize: '12px' }}>
              {strukData.items.map((it, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{it.qty}x {it.nama}</span><span>{(it.harga*it.qty).toLocaleString()}</span></div>)}
            </div>
            <hr style={{ borderTop: '1px dashed #000' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>TOTAL</span><span>Rp {strukData.total.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>TUNAI</span><span>Rp {strukData.uangBayar.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>KEMBALI</span><span>Rp {strukData.kembalian.toLocaleString()}</span></div>
            <p style={{ marginTop: '15px' }}>TERIMA KASIH</p>
            <button className="no-print" onClick={() => setStrukData(null)} style={{ marginTop: '20px', padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px' }}>Tutup & Lanjut</button>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #strukArea, #strukArea * { visibility: visible; }
          #strukArea { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
        }
      `}</style>
    </div>
  );
}

export default App;