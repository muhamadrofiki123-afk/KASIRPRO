import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';

// --- KOMPONEN LOGIN DENGAN UI KEREN ---
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Pendaftaran Berhasil!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      alert("Gagal: " + error.message);
    }
  };

  return (
    <div style={{ 
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' 
    }}>
      <div style={{ 
        width: '100%', maxWidth: '400px', padding: '40px', background: '#fff', 
        borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', textAlign: 'center' 
      }}>
        <h1 style={{ color: '#16a34a', marginBottom: '10px', fontSize: '28px' }}>KASIR PINTAR</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>{isRegister ? 'Buat akun toko Anda gratis' : 'Silakan masuk ke sistem kasir'}</p>
        
        <form onSubmit={handleAuth}>
          <input 
            type="email" placeholder="Email Toko" required 
            onChange={(e) => setEmail(e.target.value)} 
            style={{ 
              width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '10px', 
              border: '1px solid #ddd', boxSizing: 'border-box', outline: 'none' 
            }} 
          />
          <input 
            type="password" placeholder="Password" required 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ 
              width: '100%', padding: '12px', marginBottom: '25px', borderRadius: '10px', 
              border: '1px solid #ddd', boxSizing: 'border-box', outline: 'none' 
            }} 
          />
          <button type="submit" style={{ 
            width: '100%', padding: '12px', background: '#16a34a', color: 'white', 
            border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' 
          }}>
            {isRegister ? 'DAFTARKAN SEKARANG' : 'LOGIN MASUK'}
          </button>
        </form>
        
        <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', color: '#2563eb', marginTop: '25px', fontSize: '14px' }}>
          {isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar di sini'}
        </p>
      </div>
    </div>
  );
};

// --- DASHBOARD UTAMA ---
const DashboardKasir = ({ user }) => {
  const [tab, setTab] = useState('kasir');
  const [produk, setProduk] = useState([]);
  const [transaksi, setTransaksi] = useState([]);
  const [cart, setCart] = useState([]);
  const [showStruk, setShowStruk] = useState(false);
  const [lastTransaksi, setLastTransaksi] = useState(null);

  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');

  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');

  useEffect(() => {
    if (!user) return;
    
    getDoc(doc(db, "profilToko", user.uid)).then(d => {
      if(d.exists()) {
        setNamaToko(d.data().nama);
        setAlamat(d.data().alamat);
        setNoTelp(d.data().noTelp);
      }
    });

    const unsubProduk = onSnapshot(query(collection(db, "produk"), where("userId", "==", user.uid)), (snap) => {
      setProduk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubTrans = onSnapshot(query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc")), (snap) => {
      setTransaksi(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProduk(); unsubTrans(); };
  }, [user]);

  const simpanProfil = async () => {
    await setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp });
    alert("Profil Toko Berhasil Disimpan!");
  };

  const prosesBayar = async () => {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + item.harga, 0);
    const dataTrans = {
      userId: user.uid,
      items: cart.map(i => ({nama: i.nama, harga: i.harga})),
      total: total,
      waktu: new Date()
    };
    try {
      await addDoc(collection(db, "transaksi"), { ...dataTrans, waktu: serverTimestamp() });
      setLastTransaksi(dataTrans);
      setShowStruk(true);
      setCart([]);
    } catch (err) { alert("Gagal transaksi"); }
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'sans-serif' }}>
      
      {/* Header Baru Lebih Mewah */}
      <div className="no-print" style={{ 
        background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', 
        padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 100
      }}>
        <div>
          <span style={{ fontSize: '12px', opacity: 0.9, display: 'block' }}>Toko: {namaToko || 'Default'}</span>
          <strong style={{ fontSize: '20px', letterSpacing: '1px' }}>KASIR PINTAR</strong>
        </div>
        <button onClick={() => signOut(auth)} style={{ 
          background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid white', 
          padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' 
        }}>Keluar</button>
      </div>

      <div style={{ padding: '20px' }}>
        {tab === 'kasir' && (
          <div>
            <h3 style={{ color: '#334155' }}>Daftar Menu</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {produk.map(p => (
                <div key={p.id} onClick={() => setCart([...cart, p])} style={{ 
                  padding: '20px', background: 'white', borderRadius: '15px', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center', cursor: 'pointer', border: '1px solid #f1f5f9'
                }}>
                  <strong style={{ display: 'block', marginBottom: '5px', color: '#1e293b' }}>{p.nama}</strong>
                  <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Rp {p.harga.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div style={{ marginTop: '30px', background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #16a34a' }}>
                <h4 style={{ margin: '0 0 15px 0' }}>📦 Keranjang Belanja</h4>
                {cart.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#475569' }}>
                    <span>{item.nama}</span>
                    <span>{item.harga.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #eee', marginTop: '15px', paddingTop: '15px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
                  <span>TOTAL</span>
                  <span style={{ color: '#16a34a' }}>Rp {cart.reduce((s, i) => s + i.harga, 0).toLocaleString()}</span>
                </div>
                <button onClick={prosesBayar} style={{ 
                  width: '100%', marginTop: '20px', padding: '15px', background: '#16a34a', 
                  color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' 
                }}>PROSES BAYAR & STRUK</button>
              </div>
            )}
          </div>
        )}

        {tab === 'produk' && (
          <div>
            <h3 style={{ color: '#334155' }}>Pengaturan & Produk</h3>
            
            <div style={{ background: 'white', padding: '20px', borderRadius: '15px', marginBottom: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h4 style={{ marginTop: 0 }}>🆔 Profil Toko</h4>
              <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama Toko" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat Toko" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="Nomor Telepon/WA" style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <button onClick={simpanProfil} style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Update Profil Toko</button>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <h4 style={{ marginTop: 0 }}>➕ Tambah Menu Baru</h4>
              <input value={namaProd} onChange={e => setNamaProd(e.target.value)} placeholder="Nama Barang" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} type="number" placeholder="Harga Jual" style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              <button onClick={async () => { 
                await addDoc(collection(db, "produk"), { nama: namaProd, harga: Number(hargaProd), userId: user.uid, createdAt: new Date() }); 
                setNamaProd(''); setHargaProd('');
                alert("Menu Berhasil Ditambah!");
              }} style={{ width: '100%', padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Simpan Produk</button>
            </div>
          </div>
        )}

        {tab === 'laporan' && (
          <div>
            <h3 style={{ color: '#334155' }}>Laporan Keuangan</h3>
            <div style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)', padding: '25px', borderRadius: '15px', color: 'white', marginBottom: '25px' }}>
              <p style={{ margin: 0, opacity: 0.8 }}>Total Pendapatan</p>
              <h2 style={{ margin: '5px 0', fontSize: '32px' }}>Rp {transaksi.reduce((s, t) => s + t.total, 0).toLocaleString()}</h2>
              <small>Dari {transaksi.length} total transaksi</small>
            </div>
            
            <div style={{ background: 'white', borderRadius: '15px', padding: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: '#64748b', fontSize: '14px', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '15px' }}>Tanggal</th>
                    <th style={{ padding: '15px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksi.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '15px', fontSize: '14px' }}>{t.waktu?.toDate().toLocaleDateString('id-ID')}</td>
                      <td style={{ padding: '15px', fontWeight: 'bold', color: '#1e293b' }}>Rp {t.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL STRUK MODERN */}
      {showStruk && lastTransaksi && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div id="strukArea" style={{ background: '#fff', width: '320px', padding: '30px', borderRadius: '5px', textAlign: 'center', color: '#000', fontFamily: 'monospace' }}>
            <h2 style={{ margin: '0' }}>{namaToko || 'STRUK TOKO'}</h2>
            <p style={{ fontSize: '12px', margin: '5px 0' }}>{alamat}<br/>WA: {noTelp}</p>
            <div style={{ borderTop: '1px dashed #000', margin: '15px 0' }}></div>
            <p style={{ fontSize: '12px', textAlign: 'left' }}>{lastTransaksi.waktu.toLocaleString()}</p>
            <div style={{ borderTop: '1px dashed #000', margin: '15px 0' }}></div>
            {lastTransaksi.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                <span>{it.nama}</span><span>{it.harga.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #000', margin: '15px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
              <span>TOTAL</span><span>Rp {lastTransaksi.total.toLocaleString()}</span>
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '15px 0' }}></div>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>TERIMA KASIH</p>
            <p style={{ fontSize: '11px' }}>Senyum Anda Kebahagiaan Kami</p>
            
            <div className="no-print" style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, background: '#16a34a', color: '#fff', padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Print</button>
              <button onClick={() => setShowStruk(false)} style={{ flex: 1, background: '#cbd5e1', padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Navigasi Bawah Modern */}
      <div className="no-print" style={{ 
        position: 'fixed', bottom: 0, width: '100%', background: 'white', 
        display: 'flex', borderTop: '1px solid #e2e8f0', padding: '10px 0', boxShadow: '0 -4px 10px rgba(0,0,0,0.03)' 
      }}>
        <button onClick={() => setTab('kasir')} style={{ flex: 1, border: 'none', background: 'none', color: tab === 'kasir' ? '#16a34a' : '#94a3b8', fontWeight: 'bold' }}>
          <div style={{ fontSize: '20px' }}>🛒</div>
          <span style={{ fontSize: '12px' }}>Kasir</span>
        </button>
        <button onClick={() => setTab('produk')} style={{ flex: 1, border: 'none', background: 'none', color: tab === 'produk' ? '#16a34a' : '#94a3b8', fontWeight: 'bold' }}>
          <div style={{ fontSize: '20px' }}>⚙️</div>
          <span style={{ fontSize: '12px' }}>Toko</span>
        </button>
        <button onClick={() => setTab('laporan')} style={{ flex: 1, border: 'none', background: 'none', color: tab === 'laporan' ? '#16a34a' : '#94a3b8', fontWeight: 'bold' }}>
          <div style={{ fontSize: '20px' }}>📊</div>
          <span style={{ fontSize: '12px' }}>Laporan</span>
        </button>
      </div>

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
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsub();
  }, []);
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#16a34a' }}><strong>Memuat Sistem Kasir...</strong></div>;
  return user ? <DashboardKasir user={user} /> : <Login />;
};

export default App;