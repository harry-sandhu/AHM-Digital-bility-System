import React from "react";
import BrandMark from "./BrandMark";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

const AuthShell: React.FC<AuthShellProps> = ({ title, subtitle, children }) => {
  return (
    <div className="page-shell px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-card border border-slate-200/80 bg-white shadow-panel-lg lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden bg-brand-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,114,15,0.25),transparent_40%)]" />
          <div className="relative z-10">
            <BrandMark />
            <div className="mt-12 max-w-md">
              <h1 className="font-display text-display-lg text-white">{title}</h1>
              <p className="mt-4 text-base leading-7 text-brand-100">{subtitle}</p>
            </div>
          </div>
          <div className="relative z-10 grid gap-4 text-sm text-brand-100">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Secure role-based access for super admin, admin, and users.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Generate, manage, print, and download bilty documents with terms & conditions.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-5 sm:p-8 lg:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <BrandMark compact dark />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
