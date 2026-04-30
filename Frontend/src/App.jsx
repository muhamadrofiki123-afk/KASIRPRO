import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, signOut, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, setPersistence, browserLocalPersistence 
} from 'firebase/auth';
import { 
  collection, addDoc, onSnapshot, query, where, orderBy, 
  serverTimestamp, doc, setDoc, getDoc, updateDoc, increment 
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

// --- DASHBOARD KASIR ---
const DashboardKasir = ({ user }) => {
  const [tab, setTab] = useState('kasir');
  const [produk, setProduk] = useState([]);
  const [transaksi, setTransaksi] = useState([]);
  const [cart, setCart] = useState([]);
  
  const [showStruk, setShowStruk] = useState(false);
  const [lastTransaksi, setLastTransaksi] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [printData, setPrintData] = useState(null);

  // Filter
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Data Profil Toko
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');

  // Form Tambah Produk
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');
  const [scanInput, setScanInput] = useState('');

  const scannerRef = useRef(null);

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
    alert("Profil toko diperbarui!");
  };

  // --- FUNGSI KERANJANG & STOK ---
  const addToCart = (p) => {
    if (p.stok <= 0) return alert("Stok habis!");
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        if(existing.qty >= p.stok) { alert("Melebihi stok yang ada!"); return prev; }
        return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...p, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        if(newQty > item.stok) { alert("Melebihi stok!"); return item; }
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const handleScan = (e) => {
    e.preventDefault();
    const found = produk.find(p => p.barcode === scanInput || p.barcode === String(scanInput));
    if (found) { addToCart(found); setScanInput(''); } 
    else { alert('Barcode tidak ditemukan!'); setScanInput(''); }
  };

  // --- FUNGSI BAYAR ---
  const prosesBayar = async () => {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
    const dataTrans = {
      userId: user.uid,
      items: cart.map(i => ({nama: i.nama, harga: i.harga, qty: i.qty})),
      total: total,
      waktu: new Date()
    };

    try {
      await addDoc(collection(db, "transaksi"), { ...dataTrans, waktu: serverTimestamp() });
      for (const item of cart) {
        await updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) });
      }
      setLastTransaksi(dataTrans);
      setShowStruk(true);
      setCart([]);
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

  // --- FILTER & EXCEL ---
  const filteredTransaksi = transaksi.filter(t => {
    if (!t.waktu) return false;
    const tglTrans = t.waktu.toDate().toISOString().split('T')[0]; 
    const blnTrans = tglTrans.substring(0, 7);
    if (filterDate && tglTrans !== filterDate) return false;
    if (filterMonth && blnTrans !== filterMonth) return false;
    return true;
  });

  const exportToExcel = () => {
    const headers = ["Tanggal,Jam,Item,Total"];
    const rows = filteredTransaksi.map(t => {
      const d = t.waktu?.toDate();
      const items = t.items.map(i => `${i.nama}(${i.qty})`).join(' + ');
      return `${d.toLocaleDateString('id-ID')},${d.toLocaleTimeString('id-ID')},"${items}",${t.total}`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + headers.concat(rows).join("\n")));
    link.setAttribute("download", `Laporan_${filterDate || filterMonth || 'Semua'}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div style={{ fontFamily: 'monospace', paddingBottom: '80px', background: '#f4f4f4', minHeight: '100vh' }}>

      {/* Header Klasik Asli */}
      <div className="no-print" style={{ background: '#16a34a', color: 'white', padding: '15px', display: 'flex', justifyContent: 'space-between' }}>
        <strong>{namaToko || 'KASIR PINTAR'}</strong>
        <button onClick={() => signOut(auth)} style={{ background: 'none', color: 'white', border: 'none' }}>Keluar</button>
      </div>

      <div style={{ padding: '15px' }}>
        {tab === 'kasir' && (
          <div>
            <form onSubmit={handleScan} style={{ marginBottom: '15px' }}>
              <input ref={scannerRef} autoFocus value={scanInput} onChange={e => setScanInput(e.target.value)} placeholder="[SCAN BARCODE / KETIK KODE]" style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #16a34a', boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </form>

            <h3>Menu</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {produk.map(p => (
                <div key={p.id} onClick={() => addToCart(p)} style={{ padding: '15px', background: p.stok <= 0 ? '#ffcccc' : 'white', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', cursor: 'pointer' }}>
                  <strong>{p.nama}</strong><br/>Rp {p.harga.toLocaleString()}<br/>
                  <small style={{ color: p.stok <= 5 ? 'red' : 'black' }}>Stok: {p.stok}</small><br/>
                  <small style={{ color: '#888', fontSize: '10px' }}>{p.barcode}</small>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div style={{ marginTop: '20px', background: '#fff', padding: '15px', border: '2px solid #16a34a' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Keranjang Belanja</h4>
                {cart.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '5px' }}>
                    <div style={{ flex: 1 }}>{item.nama}</div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button onClick={() => updateQty(item.id, -1)} style={{ padding: '2px 8px', background: '#eee', border: '1px solid #ccc' }}>-</button>
                      <span style={{ padding: '0 10px' }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} style={{ padding: '2px 8px', background: '#eee', border: '1px solid #ccc' }}>+</button>
                    </div>
                    <div style={{ width: '70px', textAlign: 'right' }}>{(item.harga * item.qty).toLocaleString()}</div>
                  </div>
                ))}
                <div style={{ borderTop: '1px dashed #000', marginTop: '10px', paddingTop: '10px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                  <span>TOTAL</span><span>Rp {cart.reduce((s, i) => s + (i.harga * i.qty), 0).toLocaleString()}</span>
                </div>
                <button onClick={prosesBayar} style={{ width: '100%', marginTop: '10px', padding: '12px', background: '#16a34a', color: 'white', border: 'none', fontWeight: 'bold' }}>BAYAR & CETAK STRUK</button>
              </div>
            )}
          </div>
        )}

        {tab === 'produk' && (
          <div>
            <h3>Pengaturan Toko & Produk</h3>
            <div style={{ background: 'white', padding: '15px', marginBottom: '20px', border: '1px solid #ddd' }}>
              <h4>Identitas Toko (Untuk Struk)</h4>
              <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama Toko" style={{ width: '100%', padding: '8px', marginBottom: '5px', boxSizing: 'border-box' }} />
              <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat Lengkap" style={{ width: '100%', padding: '8px', marginBottom: '5px', boxSizing: 'border-box' }} />
              <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="Nomor Telepon/WA" style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }} />
              <button onClick={simpanProfil} style={{ width: '100%', padding: '8px', background: '#2563eb', color: 'white', border: 'none' }}>Simpan Profil</button>
            </div>

            <form onSubmit={simpanProduk} style={{ background: 'white', padding: '15px', marginBottom: '20px', border: '1px solid #ddd' }}>
              <h4>Tambah Produk</h4>
              <input value={namaProd} onChange={e => setNamaProd(e.target.value)} required placeholder="Nama Barang" style={{ width: '100%', padding: '8px', marginBottom: '5px', boxSizing: 'border-box' }} />
              <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" placeholder="Harga Jual" style={{ width: '100%', padding: '8px', marginBottom: '5px', boxSizing: 'border-box' }} />
              <input value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" placeholder="Stok Awal" style={{ width: '100%', padding: '8px', marginBottom: '5px', boxSizing: 'border-box' }} />
              <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Barcode (Kosong = Otomatis)" style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }} />
              <button type="submit" style={{ width: '100%', padding: '8px', background: '#16a34a', color: 'white', border: 'none' }}>Tambah Ke Database</button>
            </form>

            <div style={{ background: 'white', padding: '15px', border: '1px solid #ddd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h4 style={{ margin: 0 }}>Cetak Label Barcode</h4>
                <button onClick={() => { setPrintData(produk); setPrintMode('label'); }} style={{ background: '#000', color: '#fff', padding: '5px 10px', border: 'none' }}>Print Semua</button>
              </div>
              {produk.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', padding: '5px 0' }}>
                  <div style={{ fontSize: '12px' }}><strong>{p.nama}</strong> | Stok: {p.stok}<br/>{p.barcode}</div>
                  <button onClick={() => { setPrintData([p]); setPrintMode('label'); }} style={{ background: '#ddd', border: '1px solid #999', padding: '2px 5px' }}>Print 1</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'laporan' && (
          <div id="printableArea">
            <h3>Laporan Penjualan</h3>
            <div className="no-print" style={{ background: 'white', padding: '15px', marginBottom: '15px', border: '1px solid #ddd' }}>
              <label>Filter Tanggal:</label>
              <input type="date" value={filterDate} onChange={e => {setFilterDate(e.target.value); setFilterMonth('');}} style={{ width: '100%', padding: '5px', margin: '5px 0', boxSizing: 'border-box' }} />
              <label>Filter Bulan:</label>
              <input type="month" value={filterMonth} onChange={e => {setFilterMonth(e.target.value); setFilterDate('');}} style={{ width: '100%', padding: '5px', margin: '5px 0', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                <button onClick={exportToExcel} style={{ flex: 1, padding: '5px', background: '#15803d', color: '#fff', border: 'none' }}>Export Excel</button>
                <button onClick={() => {setFilterDate(''); setFilterMonth('');}} style={{ padding: '5px', background: '#ccc', border: 'none' }}>Reset</button>
              </div>
            </div>

            <div style={{ background: '#fff', padding: '15px', marginBottom: '10px', border: '1px solid #ddd' }}>
              <strong>Total Pendapatan: Rp {filteredTransaksi.reduce((s, t) => s + t.total, 0).toLocaleString()}</strong>
            </div>

            <table style={{ width: '100%', background: 'white', fontSize: '12px', border: '1px solid #ddd', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#eee' }}><th style={{ border: '1px solid #ddd', padding: '5px' }}>Tgl</th><th style={{ border: '1px solid #ddd', padding: '5px' }}>Total</th></tr></thead>
              <tbody>
                {filteredTransaksi.map(t => (
                  <tr key={t.id}>
                    <td style={{ border: '1px solid #ddd', padding: '5px' }}>{t.waktu?.toDate().toLocaleDateString('id-ID')}</td>
                    <td style={{ border: '1px solid #ddd', padding: '5px' }}>{t.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => window.print()} className="no-print" style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', marginTop: '10px', border: 'none' }}>Print Laporan</button>
          </div>
        )}
      </div>

      {/* MODAL STRUK ASLI */}
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
                <span>{it.qty}x {it.nama}</span><span>{(it.harga * it.qty).toLocaleString()}</span>
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

      {/* MODAL PRINT LABEL BARCODE */}
      {printMode === 'label' && printData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 1000, overflowY: 'auto' }}>
          <div className="no-print" style={{ textAlign: 'center', padding: '15px', background: '#333', position: 'sticky', top: 0 }}>
            <button onClick={() => window.print()} style={{ background: '#16a34a', color: 'white', padding: '10px 20px', border: 'none', marginRight: '10px' }}>Print Label</button>
            <button onClick={() => setPrintMode(null)} style={{ background: '#fff', padding: '10px 20px', border: 'none' }}>Tutup</button>
          </div>
          <div id="print-area" style={{ background: '#fff', width: '100%', minHeight: '100vh', margin: '0 auto', padding: '20px', color: '#000', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            {printData.map((p, i) => (
              <div key={i} style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', width: '140px', height: 'fit-content' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '5px' }}>{namaToko || 'TOKO'}</div>
                <div style={{ fontSize: '11px', marginBottom: '5px' }}>{p.nama}</div>
                <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${p.barcode}&scale=2&height=10&includetext`} alt={p.barcode} style={{ maxWidth: '100%' }} />
                <div style={{ fontWeight: 'bold', marginTop: '5px', fontSize: '12px' }}>Rp {p.harga.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigasi Asli */}
      <div className="no-print" style={{ position: 'fixed', bottom: 0, width: '100%', background: 'white', display: 'flex', borderTop: '1px solid #ddd' }}>
        <button onClick={() => setTab('kasir')} style={{ flex: 1, padding: '15px', border: 'none', background: 'none', color: tab === 'kasir' ? '#16a34a' : '#666', fontWeight: tab === 'kasir' ? 'bold' : 'normal' }}>🛒 Kasir</button>
        <button onClick={() => setTab('produk')} style={{ flex: 1, padding: '15px', border: 'none', background: 'none', color: tab === 'produk' ? '#16a34a' : '#666', fontWeight: tab === 'produk' ? 'bold' : 'normal' }}>⚙️ Toko</button>
        <button onClick={() => setTab('laporan')} style={{ flex: 1, padding: '15px', border: 'none', background: 'none', color: tab === 'laporan' ? '#16a34a' : '#666', fontWeight: tab === 'laporan' ? 'bold' : 'normal' }}>📊 Laporan</button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #strukArea, #strukArea * { visibility: visible; }
          #strukArea { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
          #printableArea, #printableArea * { visibility: visible; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; padding: 0; margin: 0; }
        }
      `}</style>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // FITUR ANTI LOGOUT
    setPersistence(auth, browserLocalPersistence).then(() => {
      onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'monospace' }}>Memuat...</div>;
  return user ? <DashboardKasir user={user} /> : <Login />;
};

export default App;