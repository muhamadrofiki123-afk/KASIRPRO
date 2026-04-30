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
        alert("Akun Toko Berhasil Dibuat!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '400px', margin: '50px auto', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#16a34a', marginBottom: '20px' }}>{isRegister ? 'Daftar Toko Baru' : 'Login Kasir'}</h2>
      <form onSubmit={handleAuth}>
        <input type="email" placeholder="Email Toko" required onChange={(e) => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '15px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <input type="password" placeholder="Password" required onChange={(e) => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '20px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <button type="submit" style={{ width: '100%', padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
          {isRegister ? 'BUAT AKUN TOKO' : 'MASUK KE KASIR'}
        </button>
      </form>
      <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', color: '#2563eb', marginTop: '20px', fontSize: '14px' }}>
        {isRegister ? 'Sudah punya akun? Login di sini' : 'Belum punya akun? Daftar Toko di sini'}
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
  
  // State Print & Filter
  const [printMode, setPrintMode] = useState(null); // 'struk', 'label_all', 'label_single'
  const [printData, setPrintData] = useState(null);
  const [filterDate, setFilterDate] = useState(''); 
  const [filterMonth, setFilterMonth] = useState('');

  // Form Input
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');
  
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');
  const [scanInput, setScanInput] = useState('');

  const scannerRef = useRef(null);

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

  // --- FUNGSI KERANJANG & STOK ---
  const addToCart = (p) => {
    if (p.stok <= 0) return alert("Maaf, Stok Barang Habis!");
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
        if(newQty > item.stok) { alert("Melebihi stok yang ada!"); return item; }
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
      // Update Stok
      for (const item of cart) {
        await updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) });
      }
      setPrintData(dataTrans);
      setPrintMode('struk');
      setCart([]);
    } catch (err) { alert("Gagal transaksi"); }
  };

  // --- FUNGSI SIMPAN PRODUK ---
  const simpanProduk = async (e) => {
    e.preventDefault();
    const finalBarcode = barcodeProd || Math.floor(100000000000 + Math.random() * 900000000000).toString();
    await addDoc(collection(db, "produk"), { 
      nama: namaProd, harga: Number(hargaProd), stok: Number(stokProd), barcode: finalBarcode, userId: user.uid, createdAt: new Date() 
    });
    alert("Produk Berhasil Disimpan!");
    setNamaProd(''); setHargaProd(''); setStokProd(''); setBarcodeProd('');
  };

  // --- FILTER & EXCEL ---
  const filteredTransaksi = transaksi.filter(t => {
    if (!t.waktu) return false;
    const dateObj = t.waktu.toDate();
    const tglTrans = dateObj.toISOString().split('T')[0]; 
    const blnTrans = tglTrans.substring(0, 7); // YYYY-MM
    
    if (filterDate && tglTrans !== filterDate) return false;
    if (filterMonth && blnTrans !== filterMonth) return false;
    return true;
  });

  const exportToExcel = () => {
    const headers = ["Tanggal,Jam,Item Dibeli,Total Pembayaran"];
    const rows = filteredTransaksi.map(t => {
      const d = t.waktu?.toDate();
      const tgl = d.toLocaleDateString('id-ID');
      const jam = d.toLocaleTimeString('id-ID');
      const items = t.items.map(i => `${i.nama}(${i.qty})`).join(' + ');
      return `${tgl},${jam},"${items}",${t.total}`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Laporan_Kasir_${filterDate || filterMonth || 'Semua'}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', paddingBottom: '70px', background: '#f8f8f8', minHeight: '100vh' }}>
      
      {/* HEADER KLASIK */}
      <div className="no-print" style={{ background: '#16a34a', color: 'white', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{namaToko || 'Kasir Pintar'}</h2>
        <button onClick={() => signOut(auth)} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', fontWeight: 'bold' }}>Logout</button>
      </div>

      <div style={{ padding: '20px' }}>
        
        {/* --- TAB KASIR --- */}
        {tab === 'kasir' && (
          <div>
            <form onSubmit={handleScan} style={{ marginBottom: '15px' }}>
              <input ref={scannerRef} autoFocus value={scanInput} onChange={e => setScanInput(e.target.value)} placeholder="🔍 Scan Barcode / Ketik Kode..." style={{ width: '100%', padding: '12px', borderRadius: '5px', border: '2px solid #16a34a', boxSizing: 'border-box', fontSize: '16px' }} />
            </form>

            <h3 style={{ borderBottom: '2px solid #ddd', paddingBottom: '5px' }}>Daftar Produk</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {produk.map(p => (
                <div key={p.id} onClick={() => addToCart(p)} style={{ padding: '15px', background: p.stok <= 0 ? '#ffcccc' : 'white', borderRadius: '8px', border: '1px solid #ccc', textAlign: 'center', cursor: 'pointer' }}>
                  <strong style={{ fontSize: '16px', display: 'block' }}>{p.nama}</strong>
                  <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Rp {p.harga.toLocaleString()}</span><br/>
                  <small style={{ color: '#666' }}>Barcode: {p.barcode}</small><br/>
                  <small style={{ color: p.stok <= 5 ? 'red' : 'black', fontWeight: 'bold' }}>Stok: {p.stok}</small>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div style={{ marginTop: '20px', background: '#fff', padding: '15px', borderRadius: '8px', border: '2px solid #16a34a' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>Keranjang ({cart.length})</h3>
                {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <strong>{item.nama}</strong>
                      <div style={{ color: '#666' }}>Rp {(item.harga * item.qty).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '5px', overflow: 'hidden' }}>
                      <button onClick={() => updateQty(item.id, -1)} style={{ padding: '8px 12px', background: '#f8f8f8', border: 'none', borderRight: '1px solid #ddd', fontWeight: 'bold', fontSize: '16px', color: 'red' }}>-</button>
                      <span style={{ padding: '0 15px', fontWeight: 'bold' }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} style={{ padding: '8px 12px', background: '#f8f8f8', border: 'none', borderLeft: '1px solid #ddd', fontWeight: 'bold', fontSize: '16px', color: 'green' }}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 'bold', marginTop: '15px' }}>
                  <span>TOTAL</span><span style={{ color: '#16a34a' }}>Rp {cart.reduce((s, i) => s + (i.harga * i.qty), 0).toLocaleString()}</span>
                </div>
                <button onClick={prosesBayar} style={{ width: '100%', marginTop: '15px', padding: '15px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '18px' }}>PROSES PEMBAYARAN</button>
              </div>
            )}
          </div>
        )}

        {/* --- TAB TOKO & PRODUK --- */}
        {tab === 'produk' && (
          <div>
            <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}>
              <h3 style={{ marginTop: 0 }}>Profil Toko</h3>
              <input value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama Toko" style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '5px' }} />
              <input value={alamat} onChange={e => setAlamat(e.target.value)} placeholder="Alamat Toko" style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '5px' }} />
              <input value={noTelp} onChange={e => setNoTelp(e.target.value)} placeholder="Nomor Telepon/WA" style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '5px' }} />
              <button onClick={async () => { await setDoc(doc(db, "profilToko", user.uid), { nama: namaToko, alamat, noTelp }); alert("Profil Disimpan!"); }} style={{ width: '100%', padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Simpan Profil</button>
            </div>

            <form onSubmit={simpanProduk} style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}>
              <h3 style={{ marginTop: 0 }}>Tambah Stok Barang</h3>
              <input value={namaProd} onChange={e => setNamaProd(e.target.value)} required placeholder="Nama Barang" style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '5px' }} />
              <input value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" placeholder="Harga Jual" style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '5px' }} />
              <input value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" placeholder="Jumlah Stok Awal" style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '5px' }} />
              <input value={barcodeProd} onChange={e => setBarcodeProd(e.target.value)} placeholder="Barcode (Kosongkan agar dibuat otomatis)" style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '5px' }} />
              <button type="submit" style={{ width: '100%', padding: '10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Simpan Ke Database</button>
            </form>

            <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>Cetak Label Harga</h3>
                <button onClick={() => { setPrintData(produk); setPrintMode('label_all'); }} style={{ background: '#000', color: '#fff', padding: '8px 15px', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Print Semua</button>
              </div>
              {produk.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', padding: '10px 0' }}>
                  <div>
                    <strong>{p.nama}</strong><br/>
                    <small>Stok: {p.stok} | Barcode: {p.barcode}</small>
                  </div>
                  <button onClick={() => { setPrintData([p]); setPrintMode('label_single'); }} style={{ background: '#e2e8f0', border: '1px solid #ccc', padding: '5px 10px', borderRadius: '5px', fontWeight: 'bold' }}>Print 1</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB LAPORAN --- */}
        {tab === 'laporan' && (
          <div>
            <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}>
              <h3 style={{ marginTop: 0 }}>Filter Laporan</h3>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Per Hari (Tanggal):</label>
              <input type="date" value={filterDate} onChange={e => {setFilterDate(e.target.value); setFilterMonth('');}} style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }} />
              
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Per Bulan:</label>
              <input type="month" value={filterMonth} onChange={e => {setFilterMonth(e.target.value); setFilterDate('');}} style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box' }} />
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={exportToExcel} style={{ flex: 1, padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>📥 Download Excel</button>
                <button onClick={() => {setFilterDate(''); setFilterMonth('');}} style={{ padding: '10px', background: '#ccc', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Reset</button>
              </div>
            </div>

            <div style={{ background: '#16a34a', color: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '14px' }}>Total Pendapatan Terfilter</p>
              <h2 style={{ margin: '5px 0' }}>Rp {filteredTransaksi.reduce((s, t) => s + t.total, 0).toLocaleString()}</h2>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #ddd' }}>
              <thead>
                <tr style={{ background: '#f8f8f8', borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Tanggal</th>
                  <th style={{ padding: '12px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransaksi.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{t.waktu?.toDate().toLocaleDateString('id-ID')}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>Rp {t.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- AREA PRINT (STRUK & LABEL) --- */}
      {printMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 1000, overflowY: 'auto' }}>
          <div className="no-print" style={{ textAlign: 'center', padding: '20px', background: '#333', position: 'sticky', top: 0 }}>
            <button onClick={() => window.print()} style={{ background: '#16a34a', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', fontWeight: 'bold', marginRight: '10px' }}>Cetak Ke Printer</button>
            <button onClick={() => setPrintMode(null)} style={{ background: '#fff', color: '#000', padding: '10px 20px', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Tutup</button>
          </div>

          <div id="print-area" style={{ background: '#fff', width: printMode === 'struk' ? '300px' : '100%', margin: '0 auto', padding: '20px', color: '#000', fontFamily: 'monospace' }}>
            
            {printMode === 'struk' && printData && (
              <div>
                <h3 style={{ textAlign: 'center', margin: 0 }}>{namaToko || 'STRUK TOKO'}</h3>
                <p style={{ textAlign: 'center', fontSize: '12px', margin: '5px 0' }}>{alamat}<br/>WA: {noTelp}</p>
                <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
                <p style={{ fontSize: '12px' }}>Tgl: {printData.waktu.toLocaleString()}</p>
                <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
                {printData.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span>{it.qty}x {it.nama}</span><span>{(it.harga * it.qty).toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
                  <span>TOTAL</span><span>Rp {printData.total.toLocaleString()}</span>
                </div>
                <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
                <p style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>TERIMA KASIH</p>
              </div>
            )}

            {printMode.includes('label') && printData && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center' }}>
                {printData.map((p, i) => (
                  <div key={i} style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', width: '140px', background: '#fff' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{namaToko || 'TOKO'}</div>
                    <div style={{ fontSize: '13px', marginBottom: '5px' }}>{p.nama}</div>
                    <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${p.barcode}&scale=2&height=10&includetext`} alt={p.barcode} style={{ maxWidth: '100%', height: 'auto' }} />
                    <div style={{ fontWeight: 'bold', marginTop: '5px', fontSize: '14px' }}>Rp {p.harga.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* NAVIGASI BAWAH */}
      <div className="no-print" style={{ position: 'fixed', bottom: 0, width: '100%', background: 'white', display: 'flex', borderTop: '1px solid #ccc' }}>
        <button onClick={() => setTab('kasir')} style={{ flex: 1, padding: '15px', border: 'none', background: tab === 'kasir' ? '#e2e8f0' : 'none', color: tab === 'kasir' ? '#16a34a' : '#555', fontWeight: 'bold', fontSize: '16px' }}>🛒 Kasir</button>
        <button onClick={() => setTab('produk')} style={{ flex: 1, padding: '15px', border: 'none', background: tab === 'produk' ? '#e2e8f0' : 'none', color: tab === 'produk' ? '#16a34a' : '#555', fontWeight: 'bold', fontSize: '16px' }}>📦 Toko</button>
        <button onClick={() => setTab('laporan')} style={{ flex: 1, padding: '15px', border: 'none', background: tab === 'laporan' ? '#e2e8f0' : 'none', color: tab === 'laporan' ? '#16a34a' : '#555', fontWeight: 'bold', fontSize: '16px' }}>📊 Laporan</button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
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

  if (loading) return <div style={{ textAlign: 'center', marginTop: '100px', fontSize: '18px', fontWeight: 'bold', color: '#16a34a' }}>Memuat Aplikasi Kasir...</div>;
  return user ? <DashboardKasir user={user} /> : <Login />;
};

export default App;