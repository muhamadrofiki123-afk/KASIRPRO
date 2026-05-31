import React from 'react';

function Dashboard({ produkTersedia, riwayatTransaksi }) {
  // --- LOGIKA PERHITUNGAN DATA ---
  const totalStok = produkTersedia.reduce((acc, curr) => acc + curr.stok, 0);
  const totalOmzet = riwayatTransaksi.reduce((acc, curr) => acc + curr.total, 0);
  const jumlahTransaksi = riwayatTransaksi.length;
  
  // Mencari nilai tertinggi untuk skala grafik
  const maxNilai = Math.max(...riwayatTransaksi.map(t => t.total), 100000);
  
  // Ambil 5 transaksi terakhir untuk tabel
  const transaksiTerakhir = [...riwayatTransaksi].reverse().slice(0, 5);

  return (
    <div className="space-y-6 bg-orange-50 min-h-screen p-4 md:p-8 pb-10">
      
      {/* 1. HEADER DASHBOARD */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-orange-900">Ringkasan Penjualan</h2>
          <p className="text-orange-700">Pantau performa tokomu hari ini</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-orange-200 text-sm font-bold text-orange-600 hidden md:block">
          📅 {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* 2. HERO CARD (OMSET) */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 p-8 md:p-10 rounded-[2rem] shadow-xl text-white flex flex-col justify-center items-start relative overflow-hidden">
        {/* Dekorasi Card */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 rounded-full bg-white opacity-10 blur-2xl"></div>
        <div className="absolute bottom-0 right-10 -mb-10 w-32 h-32 rounded-full bg-white opacity-10 blur-xl"></div>
        
        <div className="relative z-10 w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <span className="text-orange-50 text-sm font-bold uppercase tracking-widest">Total Omset</span>
          </div>
          <h3 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">Rp {totalOmzet.toLocaleString()}</h3>
          <p className="text-orange-50 text-sm font-medium bg-orange-600/40 inline-block px-4 py-1.5 rounded-full backdrop-blur-md">
            Pendapatan Akumulasi Hari Ini
          </p>
        </div>
      </div>

      {/* 3. GRID CARD STATISTIK (2x2) */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Laba Bersih */}
        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-orange-100 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-orange-50 text-orange-500 rounded-xl group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            </div>
          </div>
          <div>
            <span className="text-gray-400 text-xs font-black uppercase tracking-wider">Laba Bersih</span>
            <h4 className="text-xl md:text-2xl font-black text-gray-800 mt-1">Rp {totalOmzet.toLocaleString()}</h4>
            <div className="mt-2 flex items-center gap-1.5">
               <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-md text-[10px] font-bold">+12%</span>
               <span className="text-gray-400 text-[10px] font-bold">vs kemarin</span>
            </div>
          </div>
        </div>

        {/* Stok Tipis */}
        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-orange-100 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-red-50 text-red-500 rounded-xl group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
          </div>
          <div>
            <span className="text-gray-400 text-xs font-black uppercase tracking-wider">Stok Tipis</span>
            <h4 className="text-xl md:text-2xl font-black text-gray-800 mt-1">{produkTersedia.filter(p => p.stok < 20).length} Item</h4>
            <div className="mt-2 flex items-center gap-1.5">
               <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-md text-[10px] font-bold">Perhatian</span>
               <span className="text-gray-400 text-[10px] font-bold">Segera restock</span>
            </div>
          </div>
        </div>

        {/* Pengeluaran */}
        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-orange-100 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-orange-50 text-orange-500 rounded-xl group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          <div>
            <span className="text-gray-400 text-xs font-black uppercase tracking-wider">Pengeluaran</span>
            <h4 className="text-xl md:text-2xl font-black text-gray-800 mt-1">Rp 0</h4>
            <div className="mt-2 flex items-center gap-1.5">
               <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[10px] font-bold">0%</span>
               <span className="text-gray-400 text-[10px] font-bold">Bulan ini</span>
            </div>
          </div>
        </div>

        {/* Total Produk */}
        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-orange-100 flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-orange-50 text-orange-500 rounded-xl group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
            </div>
          </div>
          <div>
            <span className="text-gray-400 text-xs font-black uppercase tracking-wider">Total Produk</span>
            <h4 className="text-xl md:text-2xl font-black text-gray-800 mt-1">{produkTersedia.length} Varian</h4>
            <div className="mt-2 flex items-center gap-1.5">
               <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-md text-[10px] font-bold">Katalog</span>
               <span className="text-gray-400 text-[10px] font-bold">Aktif dijual</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mt-2">
        
        {/* 4. GRAFIK PENJUALAN MODERN */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-orange-100">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-black text-gray-800">Trend Penjualan</h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-xs text-gray-400 font-bold">
                <span className="w-3 h-3 bg-orange-500 rounded-full"></span> Omzet Per Hari
              </span>
            </div>
          </div>
          
          <div className="relative flex items-end justify-between h-64 gap-3">
            {/* Garis Bantu Sumbu Y */}
            <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-gray-300 font-bold pointer-events-none">
              <div className="border-t border-dashed border-orange-100 w-full pt-1">Rp {maxNilai.toLocaleString()}</div>
              <div className="border-t border-dashed border-orange-100 w-full pt-1">Rp {(maxNilai/2).toLocaleString()}</div>
              <div className="border-t border-dashed border-orange-100 w-full pt-1">Rp 0</div>
            </div>

            {/* Batang Grafik */}
            {riwayatTransaksi.map((item, index) => {
              const tinggi = (item.total / maxNilai) * 100;
              return (
                <div key={index} className="flex-1 flex flex-col items-center group relative z-10">
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-12 hidden group-hover:block bg-orange-900 text-white text-xs px-3 py-2 rounded-xl shadow-xl whitespace-nowrap">
                    Rp {item.total.toLocaleString()}
                  </div>
                  {/* Bar */}
                  <div 
                    className="w-full max-w-[40px] bg-gradient-to-t from-orange-500 to-orange-300 rounded-xl transition-all duration-700 hover:brightness-110" 
                    style={{ height: `${tinggi}%` }}
                  ></div>
                  {/* Label Tanggal */}
                  <p className="text-[10px] font-black text-gray-400 mt-4 uppercase">
                    {item.tanggal.split('-')[2]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. NOTIFIKASI STOK & AKTIVITAS */}
        <div className="space-y-6">
          {/* Stok Hampir Habis */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-orange-100">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <span className="p-1.5 bg-red-50 text-red-500 rounded-lg">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </span>
              Stok Kritis
            </h3>
            <div className="space-y-3">
              {produkTersedia.filter(p => p.stok < 20).length === 0 ? (
                <p className="text-gray-400 text-sm italic">Semua stok aman</p>
              ) : (
                produkTersedia.filter(p => p.stok < 20).map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-red-50/50 rounded-2xl border border-red-100">
                    <span className="text-sm font-bold text-gray-700 truncate mr-2">{p.nama}</span>
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap">
                      {p.stok} PCS
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Transaksi Terbaru */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-orange-100">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <span className="p-1.5 bg-orange-50 text-orange-500 rounded-lg">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </span>
              Aktivitas Terbaru
            </h3>
            <div className="space-y-4">
              {transaksiTerakhir.map((t, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-orange-50 pb-3 last:border-0">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold shrink-0">
                    ✓
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-800 truncate">Transaksi Berhasil</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{t.tanggal}</p>
                  </div>
                  <p className="text-sm font-black text-orange-600 whitespace-nowrap">
                    +Rp {t.total.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;