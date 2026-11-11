import React from "react";
import { TERMS, TERMS_SUBTITLE, TERMS_TITLE } from "../constants/terms";

/** The terms as the last printed page of a bilty (once per print, not once per copy). */
const TermsPrintPage: React.FC = () => (
  <div
    className="box-border h-full w-full bg-white text-black"
    style={{ padding: "16mm 18mm", fontFamily: "inherit" }}
  >
    <div style={{ border: "1.5px solid #000", padding: "9mm 10mm", height: "100%", boxSizing: "border-box" }}>
      <h2 style={{ textAlign: "center", fontSize: "13pt", fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase" }}>
        {TERMS_TITLE}
      </h2>
      <p style={{ textAlign: "center", fontSize: "11pt", fontWeight: 700, textDecoration: "underline", marginBottom: "5mm" }}>
        {TERMS_SUBTITLE}
      </p>
      <ol style={{ listStyle: "decimal", paddingLeft: "7mm", fontSize: "9.6pt", lineHeight: 1.38 }}>
        {TERMS.map((term) => (
          <li key={term} style={{ marginBottom: "2.6mm", paddingLeft: "1mm", textAlign: "justify" }}>
            {term}
          </li>
        ))}
      </ol>
    </div>
  </div>
);

export default TermsPrintPage;
