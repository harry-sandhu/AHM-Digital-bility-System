import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BiltyForm from "../components/BiltyForm";
import { BILTY_TERMS_ACCEPTED_KEY } from "../constants/terms";

const BiltyPage: React.FC = () => {
  const navigate = useNavigate();
  const hasAcceptedTerms = sessionStorage.getItem(BILTY_TERMS_ACCEPTED_KEY) === "true";

  if (!hasAcceptedTerms) {
    return <Navigate to="/bilty/terms" replace />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,white_45%,#e2e8f0_100%)]">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="card no-print mb-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
                Bilty Workspace
              </p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Create and save your bilty</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                The bilty layout remains the same as your physical format. After saving, you can print / download a 2-page copy with the bilty on page 1 and terms & conditions on page 2.
              </p>
            </div>
            <button
              onClick={() => navigate("/bilty/terms")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Review Terms Again
            </button>
          </div>
        </div>
        <BiltyForm />
      </div>
    </div>
  );
};

export default BiltyPage;
