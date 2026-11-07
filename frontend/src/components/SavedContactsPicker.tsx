import React, { useState } from "react";
import { getConsigneeContacts, getConsignorContacts } from "../api/contactsApi";
import type { SavedContact } from "../api/contactsApi";

type SavedContactsPickerProps = {
  kind: "consignor" | "consignee";
  onSelect: (address: string, gstin: string) => void;
};

/// Small overlay button + dropdown, absolutely positioned so it never
/// affects the surrounding box's layout/sizing. Only rendered in editable
/// mode (never in the static print/PDF render).
const SavedContactsPicker: React.FC<SavedContactsPickerProps> = ({ kind, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [error, setError] = useState("");

  const handleToggle = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    setIsLoading(true);
    setError("");

    try {
      const response =
        kind === "consignor" ? await getConsignorContacts() : await getConsigneeContacts();
      setContacts(response.data);
    } catch {
      setError("Failed to load saved list");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="no-print absolute right-[0.3em] top-[0.3em] z-10">
      <button
        type="button"
        onClick={handleToggle}
        className="rounded border border-slate-300 bg-white px-[0.4em] py-[0.1em] text-[0.7em] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        title={`Pick a saved ${kind}`}
      >
        Saved ▾
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full mt-1 max-h-64 w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white text-left text-[0.85em] shadow-lg">
          {isLoading ? (
            <p className="px-3 py-2 text-slate-500">Loading…</p>
          ) : error ? (
            <p className="px-3 py-2 text-danger-600">{error}</p>
          ) : contacts.length === 0 ? (
            <p className="px-3 py-2 text-slate-500">
              No saved {kind}s yet — save one by filling it in and saving the bilty.
            </p>
          ) : (
            contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => {
                  onSelect(contact.address, contact.gstin || "");
                  setIsOpen(false);
                }}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left leading-snug last:border-b-0 hover:bg-brand-50"
              >
                <span className="block font-medium text-slate-800">{contact.address}</span>
                {contact.gstin ? (
                  <span className="block text-xs text-slate-500">{contact.gstin}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};

export default SavedContactsPicker;
