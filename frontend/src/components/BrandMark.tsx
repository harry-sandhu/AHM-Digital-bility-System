import React from "react";

type BrandMarkProps = {
  compact?: boolean;
  dark?: boolean;
};

const BrandMark: React.FC<BrandMarkProps> = ({ compact = false, dark = false }) => {
  return (
    <div className={`flex items-center ${compact ? "gap-3" : "gap-4"}`}>
      <img
        src="/logo.png"
        alt="AHM Transport Service"
        className={compact ? "h-11 w-11 rounded-xl object-contain bg-white p-1 shadow-sm" : "h-16 w-16 rounded-2xl bg-white p-2 shadow-lg"}
      />
      <div>
        <p className={`font-bold tracking-wide ${compact ? "text-base" : "text-2xl"} ${dark ? "text-slate-900" : "text-white"}`}>
          AHM Bilty System
        </p>
        <p className={`${compact ? "text-xs" : "text-sm"} ${dark ? "text-slate-500" : "text-white/80"}`}>
          AHM Transport Service
        </p>
      </div>
    </div>
  );
};

export default BrandMark;
