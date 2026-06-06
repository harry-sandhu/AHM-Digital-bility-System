import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BiltyList from "../components/BiltyList";
import { useAuth } from "../context/AuthContext";
import { BILTY_TERMS_ACCEPTED_KEY } from "../constants/terms";

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStartBiltyFlow = () => {
    sessionStorage.removeItem(BILTY_TERMS_ACCEPTED_KEY);
    navigate("/bilty/terms");
  };

  const cards = [
    {
      title: "Role",
      value: user?.role ? user.role.toUpperCase() : "—",
      description: "Your access level in the AHM Bilty System.",
    },
    {
      title: "Workflow",
      value: "2 Pages",
      description: "Generated bilty includes an attached terms & conditions page.",
    },
    {
      title: "Mode",
      value: "Digital + Download",
      description: "Create digitally and download as PDF or PNG whenever needed.",
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,white_45%,#e2e8f0_100%)]">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="card overflow-hidden p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
                Dashboard
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Welcome back, {user?.name}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                {user?.role === "superadmin" &&
                  "Create admin accounts, monitor users, disable normal users when required, and oversee all bilty activity from one place."}
                {user?.role === "admin" &&
                  "Review all users and bilty records, and support transport operations with a faster digital workflow."}
                {user?.role === "user" &&
                  "Create your bilty after accepting the terms & conditions, save it digitally, and download the final 2-page PDF or PNG copy anytime."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handleStartBiltyFlow}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
                >
                  Start New Bilty
                </button>
                {(user?.role === "admin" || user?.role === "superadmin") && (
                  <button
                    onClick={() => navigate("/users")}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    View Users
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {cards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                    {card.title}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-8">
          <BiltyList />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
