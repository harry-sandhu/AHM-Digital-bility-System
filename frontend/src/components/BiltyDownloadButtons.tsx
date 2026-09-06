import React from "react";

type BiltyDownloadButtonsProps = {
  disabled?: boolean;
  size?: "sm" | "md";
  showPrintButton?: boolean;
};

const BiltyDownloadButtons: React.FC<BiltyDownloadButtonsProps> = ({
  disabled = false,
  size = "md",
  showPrintButton = false,
}) => {
  const buttonSizeClass =
    size === "sm" ? "px-3 py-2 text-xs rounded-xl" : "px-4 py-2 text-sm rounded-2xl";

  const handlePrint = () => {
    if (disabled) {
      return;
    }

    window.print();
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-3 sm:justify-end">
        {showPrintButton ? (
          <button
            type="button"
            onClick={handlePrint}
            disabled={disabled}
            className={`${buttonSizeClass} border border-slate-200 bg-white font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Print Bilty
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default BiltyDownloadButtons;
