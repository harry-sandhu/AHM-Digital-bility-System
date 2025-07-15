import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const users = [
    {
      email: "superadmin@gmail.com",
      password: "superadmin123",
      role: "Superadmin",
    },
    { email: "admin@gmail.com", password: "admin123", role: "Admin" },
    { email: "guest@gmail.com", password: "guest123", role: "guest" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const foundUser = users.find(
      (u) => u.email === email && u.password === password
    );

    if (!foundUser) {
      alert("Invalid Credentials");
      return;
    }

    // Dummy token for testing
    login(foundUser.email, foundUser.role, "dummy-token");
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded shadow-md w-[300px]"
      >
        <h1 className="text-2xl font-bold mb-4">Login</h1>

        <label className="block mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          required
        />

        <label className="block mb-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
