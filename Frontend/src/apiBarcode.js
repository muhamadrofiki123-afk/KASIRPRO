// --- MESIN PENCARI BARCODE (MULAI) ---
  const [isCariInternet, setIsCariInternet] = useState(false);

  const handleCariBarcode = async (nomorBarcode) => {
    if (!nomorBarcode || nomorBarcode.length < 8) return; 
    setIsCariInternet(true);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${nomorBarcode}.json`);
      const data = await response.json();
      if (data.status === 1 && data.product && data.product.product_name) {
        // Mengisi nama barang otomatis ke form data
        setFormData(prev => ({ ...prev, nama: data.product.product_name })); 
      }
    } catch (error) {
      console.log("Gagal cari barcode", error);
    } finally {
      setIsCariInternet(false);
    }
  };
  // --- MESIN PENCARI BARCODE (SELESAI) ---