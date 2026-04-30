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

// --- KOMPONEN LOGIN ---
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Akun berhasil dibuat!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      alert("Gagal: " + error.message);
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '400px', margin: '60px auto', background: '#fff', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#16a34a' }}>KASIR PINTAR</h1>
      <form onSubmit={handleAuth}>
        <input type="email" placeholder="Email Toko" required onChange={(e) => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '15px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <input type="password" placeholder="Password" required onChange={(e) => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '20px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <button type="submit" style={{ width: '100%', padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          {isRegister ? 'DAFTAR TOKO' : 'MASUK'}
        </button>
      </form>
      <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', color: '#2563eb', marginTop: '20px' }}>
        {isRegister ? 'Sudah punya akun? Login' : 'Buka Toko Baru? Daftar'}
      </p>
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

  // Data Profil Toko
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');

  // Form Tambah Produk
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');

  useEffect(() => {
    if (!user) return;
    
    // Ambil Profil Toko
    getDoc(doc(db, "profilToko", user.uid)).then(d => {
      if(d.exists()) {
        setNamaToko(d.data().nama);
        setAlamat(d.data().alamat);
        setNoTelp(d.data().noTelp);
      }
    });

    // Ambil Produk
    const unsubProduk = onSnapshot(query(collection(db, "produk"), where("userId", "==", user.uid)), (snap) => {
      setProduk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Ambil Transaksi
    const unsubTrans = onSnapshot(query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc")), (snap) => {
      setTransaksi(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProduk(); unsubTrans(); };
  }, [user]);

  const simpanProfil = async () => {
    await setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp });
    alert("Profil toko diperbarui!");
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
    } catch (err) { alert("Gagal bayar"); }
  };

  return (
    <div style={{ fontFamily: 'monospace', paddingBottom: '80px', background: '#f4f4f4', minHeight: '100vh' }}>
      
      {/* Header */}
      <div className="no-print" style={{ background: '#16a34a', color: 'white', padding: '15px', display: 'flex', justifyContent: 'space-between' }}>
        <strong>{namaToko || 'KASIR PINTAR'}</strong>
        <button onClick={() => signOut(auth)} style={{ background: 'none', color: 'white', border: 'none' }}>Keluar</button>
      </div>

      <div style={{ padding: '15px' }}>
        {tab === 'kasir' && (
          <div>
            <h3>Menu</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {produk.map(p => (
                <div key={p.id} onClick={() => setCart([...cart, p])} style={{ padding: '15px', background: 'white', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                  <strong>{p.nama}</strong><br/>{p.harga.toLocaleString()}
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div style={{ marginTop: '20px', background: '#fff', padding: '15px', border: '2px solid #16a34a' }}>
                {cart.map((item, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{item.nama}</span><span>{item.harga.toLocaleString()}</span></div>)}
                <div style={{ borderTop: '1px dashed #000', marginTop: '10px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                  <span>TOTAL</span><span>Rp {cart.reduce((s, i) => s + i.harga, 0).toLocaleString()}</span>
                </div>
                <button onClick={prosesBayar} style={{ width: '100%', marginTop: '10px', padding: '12px', background: '#16a34a', color: 'white', border: 'none', fontWeight: 'bold' }}>BAYAR & CETAK STRUK</button>
              </div>
            )}
          </div>
        )}

        {tab === 'produk' && (
          <div>
            <h3>Pengaturan Toko & Produk</h3>
            <div style={{ background: 'white', padding: '15px', marginBottom: '20px' }}>
              <h4>Identitas Toko (Untuk Struk)</h4>
              <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama Toko" style={{ width: '100%', padding: '8px', marginBottom: '5px' }} />
              <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat Lengkap" style={{ width: '100%', padding: '8px', marginBottom: '5px' }} />
              <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="Nomor Telepon/WA" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <button onClick={simpanProfil} style={{ width: '100%', padding: '8px', background: '#2563eb', color: 'white', border: 'none' }}>Simpan Profil</button>
            </div>
            <div style={{ background: 'white', padding: '15px' }}>
              <h4>Tambah Produk</h4>
              <input value={namaProd} onChange={e => setNamaProd(e.target.value)} placeholder="Nama Barang" style={{ width: '100%', padding: '8px', marginBottom: '5px' }} />
              <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} type="number" placeholder="Harga Jual" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <button onClick={async () => { await addDoc(collection(db, "produk"), { nama: namaProd, harga: Number(hargaProd), userId: user.uid, createdAt: new Date() }); setNamaProd(''); setHargaProd(''); }} style={{ width: '100%', padding: '8px', background: '#16a34a', color: 'white', border: 'none' }}>Tambah Produk</button>
            </div>
          </div>
        )}

        {tab === 'laporan' && (
          <div id="printableArea">
            <h3>Laporan Penjualan</h3>
            <div style={{ background: '#fff', padding: '15px', marginBottom: '10px' }}>
              <strong>Total Pendapatan: Rp {transaksi.reduce((s, t) => s + t.total, 0).toLocaleString()}</strong>
            </div>
            <button onClick={() => window.print()} className="no-print" style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', marginBottom: '10px' }}>Print Laporan</button>
            <table style={{ width: '100%', background: 'white', fontSize: '12px' }}>
              <thead><tr style={{ background: '#eee' }}><th>Tgl</th><th>Total</th></tr></thead>
              <tbody>
                {transaksi.map(t => (
                  <tr key={t.id}><td>{t.waktu?.toDate().toLocaleDateString()}</td><td>{t.total.toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL STRUK PEMBAYARAN */}
      {showStruk && lastTransaksi && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div id="strukArea" style={{ background: '#fff', width: '300px', padding: '20px', textAlign: 'center', color: '#000' }}>
            <h3 style={{ margin: '0' }}>{namaToko || 'STRUK BELANJA'}</h3>
            <p style={{ fontSize: '10px', margin: '5px 0' }}>{alamat}<br/>Telp: {noTelp}</p>
            <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
            <p style={{ fontSize: '10px', textAlign: 'left' }}>Tgl: {lastTransaksi.waktu.toLocaleString()}</p>
            <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
            {lastTransaksi.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>{it.nama}</span><span>{it.harga.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>TOTAL</span><span>Rp {lastTransaksi.total.toLocaleString()}</span>
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
            <p style={{ fontSize: '11px', fontWeight: 'bold' }}>*** TERIMA KASIH ***</p>
            <p style={{ fontSize: '9px' }}>Barang yang sudah dibeli<br/>tidak dapat ditukar/dikembalikan</p>
            
            <div className="no-print" style={{ marginTop: '20px' }}>
              <button onClick={() => window.print()} style={{ background: '#16a34a', color: '#fff', padding: '8px 15px', border: 'none', marginRight: '10px' }}>Print</button>
              <button onClick={() => setShowStruk(false)} style={{ background: '#eee', padding: '8px 15px', border: 'none' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Navigasi */}
      <div className="no-print" style={{ position: 'fixed', bottom: 0, width: '100%', background: 'white', display: 'flex', borderTop: '1px solid #ddd' }}>
        <button onClick={() => setTab('kasir')} style={{ flex: 1, padding: '15px', border: 'none', background: 'none', color: tab === 'kasir' ? '#16a34a' : '#666' }}>🛒 Kasir</button>
        <button onClick={() => setTab('produk')} style={{ flex: 1, padding: '15px', border: 'none', background: 'none', color: tab === 'produk' ? '#16a34a' : '#666' }}>⚙️ Toko</button>
        <button onClick={() => setTab('laporan')} style={{ flex: 1, padding: '15px', border: 'none', background: 'none', color: tab === 'laporan' ? '#16a34a' : '#666' }}>📊 Laporan</button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #strukArea, #strukArea * { visibility: visible; }
          #strukArea { position: absolute; left: 0; top: 0; width: 100%; }
          #printableArea, #printableArea * { visibility: visible; }
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
  if (loading) return <div style={{ textAlign: 'center', marginTop: '100px' }}>Memuat...</div>;
  return user ? <DashboardKasir user={user} /> : <Login />;
};

export default App;