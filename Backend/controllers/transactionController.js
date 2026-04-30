const db = require('../config/db')

// Create transaction
const createTransaction = async (req, res) => {
  const connection = await db.getConnection()
  
  try {
    await connection.beginTransaction()
    
    const { items, total, pembayaran, kembalian } = req.body
    const user_id = 2 // Default kasir user (id=2)
    
    // Insert transaction header
    const [transactionResult] = await connection.execute(
      'INSERT INTO transactions (user_id, total, pembayaran, kembalian) VALUES (?, ?, ?, ?)',
      [user_id, total, pembayaran, kembalian]
    )
    
    const transactionId = transactionResult.insertId
    
    // Insert transaction details
    const detailPromises = items.map(item =>
      connection.execute(
        'INSERT INTO transaction_details (transaction_id, product_id, qty, harga, subtotal) VALUES (?, ?, ?, ?, ?)',
        [transactionId, item.id, item.qty, item.harga, item.harga * item.qty]
      )
    )
    
    await Promise.all(detailPromises)
    
    // Update stock
    const stockUpdatePromises = items.map(item =>
      connection.execute(
        'UPDATE products SET stok = stok - ? WHERE id = ?',
        [item.qty, item.id]
      )
    )
    
    await Promise.all(stockUpdatePromises)
    
    await connection.commit()
    
    res.status(201).json({
      message: 'Transaction created successfully',
      transactionId,
      total,
      pembayaran,
      kembalian
    })
  } catch (error) {
    await connection.rollback()
    console.error('Error creating transaction:', error)
    res.status(500).json({ error: 'Internal server error' })
  } finally {
    connection.release()
  }
}

// Get transactions
const getTransactions = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        t.id, t.total, t.pembayaran, t.kembalian, t.created_at,
        u.username,
        COUNT(td.id) as item_count,
        SUM(td.subtotal) as total_items
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN transaction_details td ON t.id = td.transaction_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT 50
    `)
    
    res.json(rows)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  createTransaction,
  getTransactions
}