import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleCreateBilty = () => {
    navigate("/bilty");
  };

  const handleHome = () => {
    navigate("/");
  };

  return (
    <nav className="flex justify-between items-center bg-gray-800 text-white p-4">
      <span className="font-bold">AHM Bilty System</span>
      <div className="flex gap-4">
        <button onClick={handleHome} className="bg-green-500 px-4 py-2 rounded">
          Home
        </button>
        <button
          onClick={handleCreateBilty}
          className="bg-blue-500 px-4 py-2 rounded"
        >
          Create Bilty
        </button>
        <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
