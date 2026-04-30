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
    <div className="space-y-8 bg-gray-50 min-h-screen pb-10">
      
      {/* 1. HEADER DASHBOARD */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-800">Ringkasan Penjualan</h2>
          <p className="text-gray-500">Pantau performa tokomu hari ini</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg shadow-sm border text-sm font-bold text-blue-600">
          📅 {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* 2. KARTU STATISTIK UTAMA (MODERN) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Omzet */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-8 border-green-500 flex flex-col justify-between">
          <span className="text-gray-400 text-xs font-black uppercase tracking-wider">Total Omzet</span>
          <h4 className="text-2xl font-black text-gray-800 mt-1">Rp {totalOmzet.toLocaleString()}</h4>
          <div className="text-green-500 text-xs font-bold mt-2">↑ Pendapatan Akumulasi</div>
        </div>

        {/* Jumlah Transaksi */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-8 border-blue-500 flex flex-col justify-between">
          <span className="text-gray-400 text-xs font-black uppercase tracking-wider">Total Transaksi</span>
          <h4 className="text-2xl font-black text-gray-800 mt-1">{jumlahTransaksi} Transaksi</h4>
          <div className="text-blue-500 text-xs font-bold mt-2">Selesai Diproses</div>
        </div>

        {/* Total Produk */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-8 border-orange-500 flex flex-col justify-between">
          <span className="text-gray-400 text-xs font-black uppercase tracking-wider">Varian Produk</span>
          <h4 className="text-2xl font-black text-gray-800 mt-1">{produkTersedia.length} Varian</h4>
          <div className="text-orange-500 text-xs font-bold mt-2">Tersedia di Katalog</div>
        </div>

        {/* Total Stok */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-8 border-purple-500 flex flex-col justify-between">
          <span className="text-gray-400 text-xs font-black uppercase tracking-wider">Stok Gudang</span>
          <h4 className="text-2xl font-black text-gray-800 mt-1">{totalStok} Unit</h4>
          <div className="text-purple-500 text-xs font-bold mt-2">Total Seluruh Barang</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 3. GRAFIK PENJUALAN MODERN */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-black text-gray-800">Trend Penjualan</h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-xs text-gray-400 font-bold">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span> Omzet Per Hari
              </span>
            </div>
          </div>
          
          <div className="relative flex items-end justify-between h-64 gap-3">
            {/* Garis Bantu Sumbu Y */}
            <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-gray-300 font-bold pointer-events-none">
              <div className="border-t w-full pt-1">Rp {maxNilai.toLocaleString()}</div>
              <div className="border-t w-full pt-1">Rp {(maxNilai/2).toLocaleString()}</div>
              <div className="border-t w-full pt-1">Rp 0</div>
            </div>

            {/* Batang Grafik */}
            {riwayatTransaksi.map((item, index) => {
              const tinggi = (item.total / maxNilai) * 100;
              return (
                <div key={index} className="flex-1 flex flex-col items-center group relative z-10">
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-12 hidden group-hover:block bg-gray-900 text-white text-xs px-3 py-2 rounded-xl shadow-xl whitespace-nowrap">
                    Rp {item.total.toLocaleString()}
                  </div>
                  {/* Bar */}
                  <div 
                    className="w-full max-w-[40px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-xl transition-all duration-700 hover:brightness-110" 
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

        {/* 4. NOTIFIKASI STOK & AKTIVITAS */}
        <div className="space-y-6">
          {/* Stok Hampir Habis */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              ⚠️ Stok Kritis
            </h3>
            <div className="space-y-3">
              {produkTersedia.filter(p => p.stok < 20).length === 0 ? (
                <p className="text-gray-400 text-sm italic">Semua stok aman</p>
              ) : (
                produkTersedia.filter(p => p.stok < 20).map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-red-50 rounded-2xl border border-red-100">
                    <span className="text-sm font-bold text-gray-700">{p.nama}</span>
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black">
                      {p.stok} PCS
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Transaksi Terbaru */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border">
            <h3 className="text-lg font-black text-gray-800 mb-4">Aktivitas Terbaru</h3>
            <div className="space-y-4">
              {transaksiTerakhir.map((t, i) => (
                <div key={i} className="flex items-center gap-3 border-b pb-3 last:border-0">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-gray-800">Transaksi Berhasil</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{t.tanggal}</p>
                  </div>
                  <p className="text-sm font-black text-green-600">
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