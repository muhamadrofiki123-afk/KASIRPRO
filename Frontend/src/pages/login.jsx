import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login({ setIsLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault(); // Mencegah browser me-refresh halaman
    
    // Simulasi login (Ganti dengan logika database nanti jika ada)
    if (username === 'admin' && password === 'admin123') {
      setIsLoggedIn(true);
      navigate('/'); // Setelah sukses login, arahkan ke Dashboard
    } else {
      alert("Username atau Password salah!");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-200">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Login KasirPRO</h2>
        <p style={{ color: '#64748b' }}>Selamat Datang di KasirPRO...</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="text" 
            placeholder="Username (isi: admin)" 
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Password (isi: admin123)" 
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-semibold"
          >
            Masuk ke Sistem
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;