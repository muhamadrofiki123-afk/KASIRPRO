import React, { useState, useEffect, useRef } from 'react';
import BarcodeScanner from '../components/BarcodeScanner';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';

function Kasir({ produkTersedia, keranjang, setKeranjang }) {
  const [uangBayar, setUangBayar] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const inputRef = useRef(null);

  // DATA TOKO (Sesuaikan dengan tokomu)
  const dataToko = {
    nama: "TOKO MODERN PINTAR",
    alamat: "Jl. Raya Jember No. 88, Jawa Timur",
    telepon: "0812-XXXX-XXXX"
  };

  // Fokus otomatis ke input barcode
  useEffect(() => {
    if (!isScanning) inputRef.current?.focus();
  }, [isScanning, keranjang]);

  const tambahKeKeranjang = (produk) => {
    setKeranjang((prev) => {
      const itemAda = prev.find((item) => item.id === produk.id);
      if (itemAda) {
        return prev.map((item) =>
          item.id === produk.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...produk, qty: 1 }];
    });
  };

  const handleQtyManual = (id, value) => {
    const newQty = parseInt(value.replace(/[^0-9]/g, '')) || 0;
    setKeranjang((prev) => 
      prev.map((item) => (item.id === id ? { ...item, qty: newQty } : item))
    );
  };

  const kurangiDariKeranjang = (id) => {
    setKeranjang((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item.qty > 1) {
        return prev.map((i) => i.id === id ? { ...i, qty: i.qty - 1 } : i);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleCariBarcode = (e) => {
    e.preventDefault();
    const found = produkTersedia.find((p) => p.barcode === barcodeInput);
    if (found) {
      tambahKeKeranjang(found);
      setBarcodeInput('');
    } else {
      alert("⚠️ Produk dengan barcode tersebut tidak ditemukan!");
      setBarcodeInput('');
    }
  };

  const totalBelanja = keranjang.reduce((t, i) => t + (i.harga * i.qty), 0);
  const kembalian = parseInt(uangBayar) - totalBelanja;

  const handleCetakStruk = async () => {
    if(keranjang.length === 0) return;

    try {
      // 1. Simpan Transaksi ke Firebase
      await addDoc(collection(db, "transaksi"), {
        tanggal: new Date().toISOString().split('T')[0],
        total: totalBelanja,
        items: keranjang.map(i => ({ nama: i.nama, qty: i.qty }))
      });

      // 2. Update Stok di Firebase
      for (const item of keranjang) {
        const produkAsli = produkTersedia.find(p => p.id === item.id);
        if(produkAsli) {
          const produkRef = doc(db, "produk", item.id);
          await updateDoc(produkRef, {
            stok: produkAsli.stok - item.qty
          });
        }
      }

      // 3. Jendela Cetak Struk (Desain Minimalis)
      const win = window.open('', '_blank');
      win.document.write(`
        <html><head><style>
          body { font-family: 'Courier New', monospace; width: 280px; margin: 0 auto; padding: 10px; font-size: 12px; line-height: 1.4; }
          .center { text-align: center; margin-bottom: 10px; }
          .line { border-top: 1px dashed #000; margin: 5px 0; }
          .item { display: flex; justify-content: space-between; }
        </style></head>
        <body>
          <div class="center">
            <b style="font-size:14px;">${dataToko.nama}</b><br>${dataToko.alamat}<br>Telp: ${dataToko.telepon}
          </div>
          <div class="line"></div>
          ${keranjang.map(i => `
            <div class="item"><span>${i.nama} x${i.qty}</span><span>Rp ${(i.qty*i.harga).toLocaleString()}</span></div>
          `).join('')}
          <div class="line"></div>
          <div class="item"><b>TOTAL</b><b>Rp ${totalBelanja.toLocaleString()}</b></div>
          <div class="item"><span>BAYAR</span><span>Rp ${parseInt(uangBayar).toLocaleString()}</span></div>
          <div class="item"><span>KEMBALI</span><span>Rp ${kembalian.toLocaleString()}</span></div>
          <div class="line"></div>
          <div class="center" style="margin-top:10px;">Terima Kasih Atas Kunjungan Anda!</div>
          <script>window.print(); window.close();</script>
        </body></html>
      `);
      
      setKeranjang([]);
      setUangBayar('');
      alert("✅ Transaksi Berhasil!");
    } catch (err) {
      alert("Gagal memproses ke Cloud: " + err.message);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* KIRI: SCANNER & KATALOG */}
      <div className="flex-1 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-50">
          <div className="flex items-center gap-2 mb-4 text-blue-600">
            <span className="text-xl">📷</span>
            <h2 className="font-black uppercase tracking-tight text-sm">Scanner / Input Barcode</h2>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3">
            <form onSubmit={handleCariBarcode} className="flex-1">
              <input 
                ref={inputRef}
                type="text" 
                value={barcodeInput} 
                onChange={(e) => setBarcodeInput(e.target.value.replace(/[^0-9]/g, ''))} 
                placeholder="Scan Barcode Di Sini..." 
                className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-2xl font-mono focus:border-blue-500 focus:bg-white outline-none transition-all"
              />
            </form>
            <button 
              onClick={() => setIsScanning(!isScanning)} 
              className={`px-6 py-4 rounded-2xl font-bold text-white shadow-md transition-all ${isScanning ? 'bg-orange-500' : 'bg-blue-600 active:scale-95'}`}
            >
              {isScanning ? '❌ Tutup' : 'Buka Kamera'}
            </button>
          </div>
          {isScanning && (
            <div className="mt-4 p-4 border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50">
              <BarcodeScanner onDetected={(c) => { const p = produkTersedia.find(x => x.barcode === c); if(p) { tambahKeKeranjang(p); setIsScanning(false); } }} onClose={() => setIsScanning(false)} />
            </div>
          )}
        </div>

        {/* DAFTAR PRODUK CEPAT */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Produk Tersedia ({produkTersedia.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {produkTersedia.map((p) => (
              <button 
                key={p.id} 
                onClick={() => tambahKeKeranjang(p)} 
                className="p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all text-left group"
              >
                <p className="text-sm font-bold text-gray-700 group-hover:text-blue-600 line-clamp-1">{p.nama}</p>
                <p className="text-xs text-gray-400 mt-1">Rp {p.harga.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KANAN: KERANJANG ELEGAN */}
      <div className="w-full lg:w-[400px] bg-white p-8 rounded-[40px] shadow-2xl border-t-8 border-green-500 h-fit sticky top-6">
        <h2 className="text-2xl font-black text-gray-800 mb-6 flex justify-between items-center">
          Checkout <span>🧾</span>
        </h2>
        
        <div className="max-h-[350px] overflow-y-auto mb-8 pr-2 space-y-4">
          {keranjang.length === 0 ? (
            <div className="text-center py-10 opacity-30">
              <p className="text-5xl mb-2">🛒</p>
              <p className="font-bold">Keranjang Kosong</p>
            </div>
          ) : (
            keranjang.map((item) => (
              <div key={item.id} className="flex justify-between items-center group">
                <div className="flex-1">
                  <p className="font-black text-gray-800 text-sm truncate w-40">{item.nama}</p>
                  <div className="flex items-center mt-2 gap-3">
                    {/* TOMBOL PLUS MINUS ELEGAN */}
                    <div className="flex items-center bg-gray-100 rounded-full p-1 border border-gray-200">
                      <button 
                        onClick={() => kurangiDariKeranjang(item.id)}
                        className="w-7 h-7 flex items-center justify-center bg-white rounded-full shadow-sm text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                      >
                        <span className="text-lg font-bold">−</span>
                      </button>
                      <input 
                        type="text" 
                        value={item.qty} 
                        onChange={(e) => handleQtyManual(item.id, e.target.value)}
                        className="w-10 bg-transparent text-center font-black text-sm outline-none"
                      />
                      <button 
                        onClick={() => tambahKeKeranjang(item)}
                        className="w-7 h-7 flex items-center justify-center bg-white rounded-full shadow-sm text-green-500 hover:bg-green-500 hover:text-white transition-all active:scale-90"
                      >
                        <span className="text-lg font-bold">+</span>
                      </button>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400">x {item.harga.toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-blue-600 text-sm">Rp {(item.qty * item.harga).toLocaleString()}</p>
                  <button onClick={() => setKeranjang(keranjang.filter(i => i.id !== item.id))} className="text-[9px] font-black text-red-300 uppercase hover:text-red-600 mt-1">Hapus</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* PEMBAYARAN */}
        <div className="space-y-4 pt-6 border-t border-dashed">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-bold uppercase text-xs">Total Tagihan</span>
            <span className="text-3xl font-black text-gray-900">Rp {totalBelanja.toLocaleString()}</span>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-3xl border-2 border-gray-100 focus-within:border-green-400 transition-all">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Uang Tunai (Rp)</label>
            <input 
              type="text" 
              value={uangBayar} 
              onChange={(e) => setUangBayar(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-transparent text-2xl font-black text-right text-green-600 outline-none" 
              placeholder="0" 
            />
          </div>

          <div className={`flex justify-between p-4 rounded-2xl font-bold ${kembalian >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
            <span className="text-xs uppercase">Kembalian</span>
            <span className="text-lg font-black">{kembalian >= 0 ? `Rp ${kembalian.toLocaleString()}` : 'Uang Kurang'}</span>
          </div>

          <button 
            onClick={handleCetakStruk}
            disabled={keranjang.length === 0 || kembalian < 0}
            className={`w-full py-5 rounded-[25px] font-black text-xl text-white shadow-xl transition-all ${
              keranjang.length > 0 && kembalian >= 0 
              ? 'bg-green-600 hover:bg-green-700 hover:-translate-y-1 active:scale-95' 
              : 'bg-gray-200 cursor-not-allowed shadow-none'
            }`}
          >
            SELESAIKAN & CETAK
          </button>
        </div>
      </div>
    </div>
  );
}

export default Kasir;