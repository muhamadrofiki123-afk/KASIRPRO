import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Navbar({ setIsLoggedIn }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    setIsLoggedIn(false); // Kunci sistem
    navigate('/login', { replace: true }); // Lempar ke halaman form login
  };

  return (
    <nav className="bg-white shadow-md p-4 flex justify-between items-center">
      <div className="font-bold text-xl text-blue-600">
        💰 POS Kasir
      </div>

      <div className="flex space-x-4 items-center">
        <Link to="/" className="text-gray-600 hover:text-blue-600 font-medium">Dashboard</Link>
        <Link to="/kasir" className="text-gray-600 hover:text-blue-600 font-medium">Kasir</Link>
        <Link to="/produk" className="text-gray-600 hover:text-blue-600 font-medium">Produk</Link>
        
        <button 
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition font-medium"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;