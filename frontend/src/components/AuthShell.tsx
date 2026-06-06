import React from "react";
import BrandMark from "./BrandMark";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

const AuthShell: React.FC<AuthShellProps> = ({ title, subtitle, children }) => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,white_45%,#e0f2fe_100%)] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-2xl backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.25),transparent_30%)]" />
          <div className="relative z-10">
            <BrandMark />
            <div className="mt-12 max-w-md">
              <h1 className="text-4xl font-bold leading-tight">{title}</h1>
              <p className="mt-4 text-base leading-7 text-slate-200">{subtitle}</p>
            </div>
          </div>
          <div className="relative z-10 grid gap-4 text-sm text-slate-200">
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
