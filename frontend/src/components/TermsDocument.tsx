import React from "react";
import BrandMark from "./BrandMark";
import { TERMS_INTRO, TERMS_SECTIONS } from "../constants/terms";

type TermsDocumentProps = {
  printable?: boolean;
  className?: string;
};

const TermsDocument: React.FC<TermsDocumentProps> = ({
  printable = false,
  className = "",
}) => {
  return (
    <section
      className={`rounded-[28px] border border-slate-200 bg-white ${
        printable ? "p-10 shadow-none" : "p-6 shadow-xl shadow-slate-200/70"
      } ${className}`}
    >
      <div className="mb-6 flex items-start justify-between gap-6 border-b border-slate-200 pb-5">
        <div>
          <BrandMark compact dark />
          <h2 className="mt-5 text-2xl font-bold text-slate-900">
            Terms & Conditions
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {TERMS_INTRO}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right text-xs font-medium text-slate-500">
          <p>Attachment with Bilty</p>
          <p>Page 2 of 2</p>
        </div>
      </div>

      <div className="space-y-6">
        {TERMS_SECTIONS.map((section) => (
          <div key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-base font-semibold text-slate-900">
              {section.title}
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
        <div className="rounded-2xl border border-dashed border-slate-300 p-4">
          <p className="font-semibold text-slate-900">Customer Acknowledgement</p>
          <p className="mt-2 leading-6">
            By proceeding with bilty generation, the consignor / user confirms that the details entered are correct and the above terms are accepted.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300 p-4">
          <p className="font-semibold text-slate-900">Transporter Note</p>
          <p className="mt-2 leading-6">
            This document should be preserved with the bilty copy for record, billing, and delivery reference.
          </p>
        </div>
      </div>
    </section>
  );
};

export default TermsDocument;
