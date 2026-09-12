import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { purchaseBiltyAccess } from "../api/biltyApi";
import { getApiErrorMessage } from "../utils/apiError";
import { BILTY_TERMS_ACCEPTED_KEY } from "../constants/terms";
import { getBiltyAccessAmount } from "../utils/biltyPricing";

const formatDeadline = (deadline?: string | null) => {
  if (!deadline) {
    return "today's midnight";
  }

  return new Date(deadline).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const BiltyPaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [freightAmount, setFreightAmount] = useState("");
  const paymentDeadline = user?.biltyAccessExpiresAt
    ? new Date(user.biltyAccessExpiresAt)
    : null;
  const hasActivePayment = Boolean(
    paymentDeadline && paymentDeadline.getTime() >= Date.now()
  );
  const parsedFreightAmount = Number(freightAmount);
  const hasValidFreightAmount = Number.isFinite(parsedFreightAmount) && parsedFreightAmount > 0;
  const amount = hasValidFreightAmount
    ? getBiltyAccessAmount(parsedFreightAmount)
    : 200;

  if (sessionStorage.getItem(BILTY_TERMS_ACCEPTED_KEY) !== "true") {
    return <Navigate to="/bilty/terms" replace />;
  }

  const handleContinue = async () => {
    setError("");

    if (hasActivePayment) {
      navigate("/bilty");
      return;
    }

    if (!hasValidFreightAmount) {
      setError("Enter a valid freight amount greater than zero.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await purchaseBiltyAccess(parsedFreightAmount);
      updateUser(response.data.user);
      navigate("/bilty");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to activate bilty access"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,white_45%,#e0f2fe_100%)]">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card p-6">
            <p className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
              Bilty Payment Step
            </p>
            <h1 className="mt-4 text-3xl font-bold text-slate-900">
              Pay before bilty generation.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              Complete the payment first, then the system will reserve your bilty number. After that, you must fill and save the bilty before midnight.
            </p>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold text-slate-900">Payment summary</h2>
            <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <label className="text-sm font-semibold text-slate-700" htmlFor="freight-amount">
                Freight amount
              </label>
              <input
                id="freight-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={freightAmount}
                onChange={(event) => setFreightAmount(event.target.value)}
                placeholder="Enter freight amount"
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Bilty charge
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">₹{amount}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This payment unlocks bilty generation for today.
              </p>
              <p className="mt-3 text-sm font-medium text-amber-700">
                Deadline: {formatDeadline(user?.biltyAccessExpiresAt)}
              </p>
            </div>

            {error ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <button
              onClick={handleContinue}
              disabled={isSubmitting}
              className="mt-6 w-full rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSubmitting
                ? "Activating payment..."
                : hasActivePayment
                  ? "Continue to Bilty"
                  : "Pay & Continue"}
            </button>

            <button
              onClick={() => navigate("/bilty/terms")}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Review Terms Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiltyPaymentPage;
