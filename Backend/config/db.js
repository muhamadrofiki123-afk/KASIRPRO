const mysql = require('mysql2/promise')

const dbConfig = {
  host: 'localhost',
  user: 'root', // GANTI DENGAN USER MYSQL ANDA
  password: '',  // GANTI DENGAN PASSWORD MYSQL ANDA
  database: 'pos_kasir'
}

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

module.exports = pool