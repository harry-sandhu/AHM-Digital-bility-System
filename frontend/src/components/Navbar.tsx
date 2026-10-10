import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BILTY_TERMS_ACCEPTED_KEY } from "../constants/terms";
import { clearBiltyDraft } from "../utils/biltyDraft";
import BrandMark from "./BrandMark";

const Navbar: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleStartBiltyFlow = () => {
    sessionStorage.removeItem(BILTY_TERMS_ACCEPTED_KEY);
    clearBiltyDraft(user?.id);
    navigate("/bilty/terms");
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <button onClick={() => navigate("/")} className="text-left">
          <BrandMark compact dark />
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">{user?.name}</p>
            <p className="capitalize">{user?.role}</p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            Home
          </button>
          <button
            onClick={handleStartBiltyFlow}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-200 transition hover:bg-brand-700"
          >
            Create Bilty
          </button>
          {(user?.role === "admin" || user?.role === "superadmin") && (
            <button
              onClick={() => navigate("/users")}
              className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Users
            </button>
          )}
          {user?.role === "superadmin" && (
            <>
              <button
                onClick={() => navigate("/admins/new")}
                className="rounded-full border border-accent-200 bg-accent-50 px-4 py-2 text-sm font-medium text-accent-700 transition hover:bg-accent-100"
              >
                Create Admin
              </button>
              <button
                onClick={() => navigate("/superadmin")}
                className="rounded-full border border-accent-200 bg-accent-50 px-4 py-2 text-sm font-medium text-accent-700 transition hover:bg-accent-100"
              >
                Number Ranges
              </button>
            </>
          )}
          <button
            onClick={handleLogout}
            className="rounded-full border border-danger-100 bg-danger-50 px-4 py-2 text-sm font-medium text-danger-700 transition hover:bg-danger-100"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
