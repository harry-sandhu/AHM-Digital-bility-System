import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import TermsDocument from "../components/TermsDocument";
import { BILTY_TERMS_ACCEPTED_KEY } from "../constants/terms";

const BiltyTermsPage: React.FC = () => {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);

  const handleContinue = () => {
    if (!accepted) {
      return;
    }

    sessionStorage.setItem(BILTY_TERMS_ACCEPTED_KEY, "true");
    navigate("/bilty");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,white_45%,#e0f2fe_100%)]">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card p-6">
            <p className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
              Bilty Consent Step
            </p>
            <h1 className="mt-4 text-3xl font-bold text-slate-900">
              Review and accept the transport terms before bilty generation.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              Every bilty generated from this system should carry the attached terms & conditions. Please review them once, then continue to the bilty form.
            </p>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold text-slate-900">Before you continue</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>• Bilty number will be generated only after acceptance.</li>
              <li>• Downloaded PDF / PNG or printed bilty will include page 2 with terms & conditions.</li>
              <li>• Please ensure shipment details are correct before saving the bilty.</li>
            </ul>

            <label className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>
                I have read and agree to the bilty terms & conditions, and I understand that they will be attached to the generated bilty.
              </span>
            </label>

            <button
              onClick={handleContinue}
              disabled={!accepted}
              className="mt-6 w-full rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Agree & Continue to Bilty
            </button>
          </div>
        </div>

        <TermsDocument />
      </div>
    </div>
  );
};

export default BiltyTermsPage;
