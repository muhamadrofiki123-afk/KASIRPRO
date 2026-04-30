import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';

import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Kasir from './pages/Kasir';
import Produk from './pages/Produk';
import Login from './pages/login';

function App() {
  // Status login dimulai dari FALSE setiap kali refresh (Keamanan sesuai permintaan)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [produkTersedia, setProdukTersedia] = useState([]);
  const [riwayatTransaksi, setRiwayatTransaksi] = useState([]);
  const [keranjang, setKeranjang] = useState([]);

  // Ambil data dari Firebase saat user berhasil Login
  useEffect(() => {
    if (isLoggedIn) {
      // 1. Ambil Produk (Pastikan koleksi di Firebase bernama "produk")
      const unsubProduk = onSnapshot(collection(db, "produk"), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        console.log("Data Produk Diterima:", items); // Cek di console browser
        setProdukTersedia(items);
      }, (error) => {
        console.error("Firebase Error (Produk):", error);
      });

      // 2. Ambil Transaksi
      const unsubTransaksi = onSnapshot(collection(db, "transaksi"), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setRiwayatTransaksi(items);
      });

      return () => { unsubProduk(); unsubTransaksi(); };
    } else {
      // Jika logout, bersihkan data
      setProdukTersedia([]);
      setRiwayatTransaksi([]);
    }
  }, [isLoggedIn]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-slate-900">
        {/* Navbar hanya muncul jika sudah login */}
        {isLoggedIn && <Navbar setIsLoggedIn={setIsLoggedIn} />}
        
        <div className={isLoggedIn ? "container mx-auto px-4 py-8" : ""}>
          <Routes>
            {!isLoggedIn ? (
              // Halaman Login (Tujuan utama saat refresh)
              <Route path="*" element={<Login setIsLoggedIn={setIsLoggedIn} />} />
            ) : (
              <>
                <Route path="/" element={<Dashboard produkTersedia={produkTersedia} riwayatTransaksi={riwayatTransaksi} />} />
                <Route path="/kasir" element={
                  <Kasir 
                    produkTersedia={produkTersedia} 
                    keranjang={keranjang} 
                    setKeranjang={setKeranjang} 
                  />
                } />
                <Route path="/produk" element={<Produk />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;