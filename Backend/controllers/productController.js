const db = require('../config/db')

// Get all products
const getProducts = async (req, res) => {
  try {
    const { barcode } = req.query
    let query = 'SELECT * FROM products'
    let params = []

    if (barcode) {
      query += ' WHERE barcode = ?'
      params = [barcode]
    }

    query += ' ORDER BY nama ASC'

    const [rows] = await db.execute(query, params)
    res.json(rows)
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Get single product
const getProductById = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' })
    }
    res.json(rows[0])
  } catch (error) {
    console.error('Error fetching product:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Create product
const createProduct = async (req, res) => {
  try {
    const { nama, harga, stok, barcode } = req.body
    
    const [result] = await db.execute(
      'INSERT INTO products (nama, harga, stok, barcode) VALUES (?, ?, ?, ?)',
      [nama, parseFloat(harga), parseInt(stok), barcode || null]
    )
    
    res.status(201).json({
      message: 'Product created successfully',
      id: result.insertId
    })
  } catch (error) {
    console.error('Error creating product:', error)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Barcode sudah digunakan!' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Update product
const updateProduct = async (req, res) => {
  try {
    const { nama, harga, stok, barcode } = req.body
    
    await db.execute(
      'UPDATE products SET nama = ?, harga = ?, stok = ?, barcode = ? WHERE id = ?',
      [nama, parseFloat(harga), parseInt(stok), barcode || null, req.params.id]
    )
    
    res.json({ message: 'Product updated successfully' })
  } catch (error) {
    console.error('Error updating product:', error)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Barcode sudah digunakan!' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const [result] = await db.execute(
      'DELETE FROM products WHERE id = ?',
      [req.params.id]
    )
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    res.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
}