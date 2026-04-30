import React, { useState, useEffect } from 'react';
import BarcodeScanner from '../components/BarcodeScanner';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

function Produk() {
  const [daftarProduk, setDaftarProduk] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ barcode: '', nama: '', kategori: '', harga: '', stok: '' });

  // 1. AMBIL DATA DARI FIREBASE (REAL-TIME)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "produk"), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDaftarProduk(items);
    });
    return () => unsub();
  }, []);

  const produkDifilter = daftarProduk.filter((p) =>
    p.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode.includes(searchTerm)
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (['barcode', 'harga', 'stok'].includes(name)) {
      setFormData({ ...formData, [name]: value.replace(/[^0-9]/g, '') });
    } else setFormData({ ...formData, [name]: value });
  };

  // 2. SIMPAN/UPDATE KE FIREBASE DENGAN VALIDASI UNIK
  const handleSimpanProduk = async (e) => {
    e.preventDefault();

    const barcodeSudahAda = daftarProduk.find(
      (p) => p.barcode === formData.barcode && p.id !== editId
    );

    if (barcodeSudahAda && formData.barcode !== "" && formData.barcode !== "TIDAK-ADA") {
      alert(`⚠️ GAGAL SIMPAN!\n\nKode Barcode [${formData.barcode}] sudah digunakan oleh produk: ${barcodeSudahAda.nama}.`);
      return;
    }

    const dataProduk = {
      barcode: formData.barcode || "TIDAK-ADA",
      nama: formData.nama,
      kategori: formData.kategori,
      harga: parseInt(formData.harga) || 0,
      stok: parseInt(formData.stok) || 0,
    };

    try {
      if (editId) {
        // Mode Update
        await updateDoc(doc(db, "produk", editId), dataProduk);
      } else {
        // Mode Tambah Baru
        await addDoc(collection(db, "produk"), dataProduk);
      }
      tutupModal();
    } catch (err) {
      alert("Error saving: " + err.message);
    }
  };

  // 3. HAPUS DARI FIREBASE
  const handleHapusProduk = async (id) => {
    if(window.confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
      await deleteDoc(doc(db, "produk", id));
    }
  };

  // --- FUNSI CETAK (UI TIDAK BERUBAH) ---
  const handlePrintSemuaLabel = () => {
    if (produkDifilter.length === 0) return alert("Tidak ada data!");
    const windowPrint = window.open('', '_blank');
    windowPrint.document.write(`
      <html>
        <head><title>Print Labels</title><style>
          body { font-family: 'Courier New', monospace; padding: 20px; }
          .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
          .label-box { border: 1px dashed #333; padding: 10px; text-align: center; page-break-inside: avoid; }
          .nama { font-size: 14px; font-weight: bold; text-transform: uppercase; }
          .harga { font-size: 18px; font-weight: bold; }
          @media print { .no-print { display: none; } }
        </style></head>
        <body>
          <h2 class="no-print">Pratinjau Label (Tekan Ctrl+P)</h2>
          <div class="grid-container">
            ${produkDifilter.map(p => `
              <div class="label-box">
                <div class="nama">${p.nama}</div>
                <div class="harga">Rp ${p.harga.toLocaleString()}</div>
                <div style="font-size:24px; margin:5px 0;">||||||||||||</div>
                <div style="font-size:10px;">${p.barcode}</div>
              </div>
            `).join('')}
          </div>
          <script>setTimeout(() => { window.print(); }, 500);</script>
        </body>
      </html>
    `);
  };

  const handlePrintSatuan = (p) => {
    const windowPrint = window.open('', '_blank');
    windowPrint.document.write(`
      <html><head><style>
          body { display: flex; justify-content: center; padding: 50px; font-family: sans-serif;}
          .label { border: 2px solid black; padding: 20px; text-align: center; width: 250px; }
          .nama { font-size: 20px; font-weight: bold; }
          .harga { font-size: 24px; font-weight: bold; margin: 10px 0; }
        </style></head>
        <body>
          <div class="label">
            <div class="nama">${p.nama}</div>
            <div class="harga">Rp ${p.harga.toLocaleString()}</div>
            <div style="font-size:30px;">||||||||||||</div>
            <div>${p.barcode}</div>
          </div>
          <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body></html>
    `);
  };

  const tutupModal = () => {
    setIsModalOpen(false); setIsScanning(false); setEditId(null);
    setFormData({ barcode: '', nama: '', kategori: '', harga: '', stok: '' });
  };

  // --- TAMPILAN UI (100% SAMA SEPERTI VERSI BAGUS SEBELUMNYA) ---
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Produk</h2>
        
        <div className="flex flex-wrap w-full md:w-auto gap-2 justify-center">
          <input 
            type="text" 
            placeholder="Cari Nama / Kode..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="p-2 border-2 border-blue-100 rounded-lg focus:border-blue-500 outline-none w-full md:w-56"
          />
          <button onClick={handlePrintSemuaLabel} className="bg-gray-700 text-white px-4 py-2 rounded font-medium hover:bg-gray-800">🖨️ Cetak Semua</button>
          <button onClick={() => setIsModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded font-medium hover:bg-green-700">+ Tambah</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b-2">
            <tr>
              <th className="p-3 text-sm font-semibold text-gray-600">Barcode</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Nama Produk</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Harga</th>
              <th className="p-3 text-center text-sm font-semibold text-gray-600">Stok</th>
              <th className="p-3 text-center text-sm font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {produkDifilter.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50 transition">
                <td className="p-3 font-mono text-gray-400 text-sm">{p.barcode}</td>
                <td className="p-3 font-bold text-gray-700">{p.nama}</td>
                <td className="p-3 text-blue-700 font-semibold">Rp {p.harga.toLocaleString()}</td>
                <td className="p-3 text-center">
                   <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.stok < 20 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {p.stok}
                   </span>
                </td>
                <td className="p-3 text-center space-x-2">
                  <button onClick={() => handlePrintSatuan(p)} className="p-1 hover:bg-gray-200 rounded" title="Cetak Satuan">🏷️</button>
                  <button onClick={() => { setEditId(p.id); setFormData({ ...p, harga: p.harga.toString(), stok: p.stok.toString() }); setIsModalOpen(true); }} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleHapusProduk(p.id)} className="text-red-600 hover:underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {produkDifilter.length === 0 && <p className="text-center py-10 text-gray-400">Produk tidak ditemukan...</p>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 relative">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl relative">
             <button onClick={tutupModal} className="absolute top-2 right-4 text-2xl text-gray-400 hover:text-gray-600">×</button>
            <h3 className="text-xl font-bold mb-4">{editId ? "Update Data" : "Tambah Produk"}</h3>
            <form onSubmit={handleSimpanProduk} className="space-y-4">
              <div className="flex gap-2">
                <input name="barcode" value={formData.barcode} onChange={handleChange} className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-400 outline-none" placeholder="Barcode (Wajib Unik)" />
                <button type="button" onClick={() => setIsScanning(!isScanning)} className="bg-blue-600 text-white px-4 rounded">📷 Scan</button>
              </div>
              {isScanning && <BarcodeScanner onDetected={(c) => { setFormData({...formData, barcode: c}); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="nama" value={formData.nama} onChange={handleChange} required className="w-full p-2 border rounded outline-none" placeholder="Nama Produk" />
                <input name="kategori" value={formData.kategori} onChange={handleChange} className="w-full p-2 border rounded outline-none" placeholder="Kategori" />
                <input name="harga" value={formData.harga} onChange={handleChange} required className="w-full p-2 border rounded outline-none" placeholder="Harga Jual" />
                <input name="stok" value={formData.stok} onChange={handleChange} required className="w-full p-2 border rounded outline-none" placeholder="Stok" />
              </div>
              
              <div className="flex justify-end gap-2 border-t pt-4 mt-4">
                <button type="button" onClick={tutupModal} className="px-4 py-2 bg-gray-200 rounded">Batal</button>
                <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700">Simpan Produk</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Produk;