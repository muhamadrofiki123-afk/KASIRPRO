export const cariNamaBarangDiInternet = async (nomorBarcode) => {
  if (!nomorBarcode || nomorBarcode.length < 8) return null;
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${nomorBarcode}.json`);
    const data = await response.json();
    if (data.status === 1 && data.product && data.product.product_name) {
      return data.product.product_name;
    }
    return null;
  } catch (error) {
    console.log("Gagal cari barcode", error);
    return null;
  }
};