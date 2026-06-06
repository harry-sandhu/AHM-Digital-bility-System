import React, { useRef, useState } from "react";
import BiltyDocument from "./BiltyDocument";
import TermsDocument from "./TermsDocument";
import type { BiltyFormState } from "../types/biltyForm";
import {
  downloadBiltyImages,
  downloadBiltyPdf,
} from "../utils/biltyDownload";

type BiltyDownloadButtonsProps = {
  biltyNumber: string;
  formData: BiltyFormState;
  disabled?: boolean;
  size?: "sm" | "md";
  showPrintButton?: boolean;
};

const BiltyDownloadButtons: React.FC<BiltyDownloadButtonsProps> = ({
  biltyNumber,
  formData,
  disabled = false,
  size = "md",
  showPrintButton = false,
}) => {
  const biltyPageRef = useRef<HTMLDivElement>(null);
  const termsPageRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingImages, setIsExportingImages] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  const buttonSizeClass =
    size === "sm" ? "px-3 py-2 text-xs rounded-xl" : "px-4 py-2 text-sm rounded-2xl";

  const handlePdfDownload = async () => {
    if (!biltyPageRef.current || !termsPageRef.current || disabled) {
      return;
    }

    setFeedback("");
    setIsExportingPdf(true);

    try {
      await downloadBiltyPdf({
        biltyElement: biltyPageRef.current,
        termsElement: termsPageRef.current,
        fileName: biltyNumber || "bilty",
      });
      setFeedbackTone("success");
      setFeedback("2-page PDF downloaded successfully.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedback("Failed to download PDF. Please try again.");
      console.error(error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleImageDownload = async () => {
    if (!biltyPageRef.current || !termsPageRef.current || disabled) {
      return;
    }

    setFeedback("");
    setIsExportingImages(true);

    try {
      await downloadBiltyImages({
        biltyElement: biltyPageRef.current,
        termsElement: termsPageRef.current,
        fileName: biltyNumber || "bilty",
      });
      setFeedbackTone("success");
      setFeedback("2 PNG pages downloaded successfully.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedback("Failed to download images. Please try again.");
      console.error(error);
    } finally {
      setIsExportingImages(false);
    }
  };

  const handlePrint = () => {
    if (disabled) {
      return;
    }

    window.print();
  };

  const buttonsDisabled = disabled || isExportingPdf || isExportingImages;

  return (
    <>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="flex flex-wrap gap-3 sm:justify-end">
          <button
            type="button"
            onClick={handlePdfDownload}
            disabled={buttonsDisabled}
            className={`${buttonSizeClass} bg-blue-600 font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400`}
          >
            {isExportingPdf ? "Preparing PDF..." : "Download PDF (2 Pages)"}
          </button>
          <button
            type="button"
            onClick={handleImageDownload}
            disabled={buttonsDisabled}
            className={`${buttonSizeClass} border border-slate-200 bg-white font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isExportingImages ? "Preparing Images..." : "Download Images (PNG)"}
          </button>
          {showPrintButton ? (
            <button
              type="button"
              onClick={handlePrint}
              disabled={buttonsDisabled}
              className={`${buttonSizeClass} border border-slate-200 bg-white font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Print 2 Pages
            </button>
          ) : null}
        </div>

        {feedback ? (
          <p
            className={`text-xs ${
              feedbackTone === "success" ? "text-green-700" : "text-red-600"
            }`}
          >
            {feedback}
          </p>
        ) : null}
      </div>

      <div className="no-print fixed left-[-10000px] top-0 z-0 overflow-hidden bg-white pointer-events-none">
        <div ref={biltyPageRef} className="w-[794px] bg-white p-0">
          <BiltyDocument
            formData={formData}
            className="shadow-none"
            fontSize="12px"
          />
        </div>
        <div ref={termsPageRef} className="mt-8 w-[794px] bg-white p-0">
          <TermsDocument printable className="rounded-none shadow-none" />
        </div>
      </div>
    </>
  );
};

export default BiltyDownloadButtons;
