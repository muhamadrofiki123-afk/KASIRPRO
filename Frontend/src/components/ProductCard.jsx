const ProductCard = ({ product, onAddToCart, isKasir = false }) => {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-shadow">
      <div className="flex items-center space-x-4">
        <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
          <span className="text-2xl">📦</span>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-800">{product.nama}</h3>
          <p className="text-sm text-gray-500 mt-1">Barcode: {product.barcode}</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            Rp {product.harga.toLocaleString('id-ID')}
          </p>
          {isKasir ? (
            <p className="text-sm text-yellow-600 bg-yellow-100 px-2 py-1 rounded mt-2 inline-block">
              Stok: {product.stok}
            </p>
          ) : (
            <p className="text-sm text-gray-600">Stok: {product.stok}</p>
          )}
        </div>
        <button
          onClick={() => onAddToCart(product)}
          className={`${
            isKasir ? 'btn-success' : 'btn-primary'
          } text-sm`}
          disabled={product.stok === 0}
        >
          {isKasir ? 'Tambah' : 'Edit'}
        </button>
      </div>
    </div>
  )
}

export default ProductCard