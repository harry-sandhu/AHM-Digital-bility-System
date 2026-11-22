import React from "react";
import { flushSync } from "react-dom";

type BiltyDownloadButtonsProps = {
  disabled?: boolean;
  size?: "sm" | "md";
  showPrintButton?: boolean;
  /** When set (the bilty has a Duplicate), shows separate Print Original / Print Duplicate / Print Both buttons. */
  copies?: PrintCopies;
  onCopiesChange?: (copies: PrintCopies) => void;
  /** Runs before the print dialog; return false to cancel the print. */
  onBeforePrint?: () => Promise<boolean> | boolean;
  /** Runs once the print dialog closes (printed or cancelled). */
  onAfterPrint?: () => void;
};

export type PrintCopies = "original" | "duplicate" | "both";

const BiltyDownloadButtons: React.FC<BiltyDownloadButtonsProps> = ({
  disabled = false,
  size = "md",
  showPrintButton = false,
  copies,
  onCopiesChange,
  onBeforePrint,
  onAfterPrint,
}) => {
  const buttonSizeClass =
    size === "sm" ? "px-3 py-2 text-xs rounded-xl" : "px-4 py-2 text-sm rounded-2xl";

  // `choice` is which copy this click prints. The page is re-rendered with that copy BEFORE the print dialog
  // opens (flushSync), otherwise the dialog would show the previously chosen copy.
  const handlePrint = async (choice?: PrintCopies) => {
    if (disabled) {
      return;
    }

    if (onBeforePrint && !(await onBeforePrint())) {
      return;
    }

    if (choice && onCopiesChange) {
      flushSync(() => onCopiesChange(choice));
    }

    if (onAfterPrint) {
      const handleAfterPrint = () => {
        window.removeEventListener("afterprint", handleAfterPrint);
        onAfterPrint();
      };
      window.addEventListener("afterprint", handleAfterPrint);
    }

    window.print();
  };

  const buttonClass = `${buttonSizeClass} border border-slate-200 bg-white font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50`;
  const hasDuplicate = Boolean(copies && onCopiesChange);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-3 sm:justify-end">
        {showPrintButton && hasDuplicate ? (
          <>
            <button type="button" onClick={() => handlePrint("original")} disabled={disabled} className={buttonClass}>
              Print Original
            </button>
            <button type="button" onClick={() => handlePrint("duplicate")} disabled={disabled} className={buttonClass}>
              Print Duplicate
            </button>
            <button type="button" onClick={() => handlePrint("both")} disabled={disabled} className={buttonClass}>
              Print Both
            </button>
          </>
        ) : null}
        {showPrintButton && !hasDuplicate ? (
          <button type="button" onClick={() => handlePrint()} disabled={disabled} className={buttonClass}>
            Print Bilty
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default BiltyDownloadButtons;
