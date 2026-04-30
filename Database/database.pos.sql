-- Buat database
CREATE DATABASE IF NOT EXISTS pos_kasir;
USE pos_kasir;

-- Tabel Users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'kasir') DEFAULT 'kasir',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Products
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    harga DECIMAL(10,2) NOT NULL,
    stok INT DEFAULT 0,
    barcode VARCHAR(50) UNIQUE,
    gambar VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Transactions
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    total DECIMAL(10,2) NOT NULL,
    pembayaran DECIMAL(10,2) NOT NULL,
    kembalian DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabel Transaction Details
CREATE TABLE transaction_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT,
    product_id INT,
    qty INT NOT NULL,
    harga DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insert data users default
INSERT INTO users (username, password, role) VALUES 
('admin', MD5('admin123'), 'admin'),
('kasir', MD5('kasir123'), 'kasir');

-- Insert data produk sample
INSERT INTO products (nama, harga, stok, barcode) VALUES 
('Kopi Hitam', 15000, 50, '8991234567890'),
('Teh Tarik', 12000, 30, '8991234567891'),
('Roti Bakar', 8000, 40, '8991234567892'),
('Nasi Goreng', 25000, 25, '8991234567893'),
('Es Teh', 7000, 60, '8991234567894');