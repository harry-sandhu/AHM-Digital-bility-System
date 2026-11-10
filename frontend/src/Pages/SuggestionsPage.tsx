import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import {
  deleteSuggestion,
  getAllSuggestions,
  updateSuggestion,
  type ManagedSuggestion,
  type SuggestionKind,
} from "../api/contactsApi";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../utils/apiError";

const KIND_LABELS: Record<SuggestionKind, string> = {
  consignor: "Consignors",
  consignee: "Consignees",
  packing: "Method of packing",
  delivery: "Delivery addresses",
};

const KINDS = Object.keys(KIND_LABELS) as SuggestionKind[];

type Draft = { address: string; gstin: string };

const SuggestionRow: React.FC<{
  item: ManagedSuggestion;
  onSaved: (updated: ManagedSuggestion) => void;
  onDeleted: (id: string) => void;
}> = ({ item, onSaved, onDeleted }) => {
  const { showSuccess, showError } = useToast();
  const hasGstin = item.kind === "consignor" || item.kind === "consignee";
  const [draft, setDraft] = useState<Draft>({ address: item.address, gstin: item.gstin || "" });
  const [busy, setBusy] = useState(false);

  const isDirty =
    draft.address.trim() !== item.address || (hasGstin && draft.gstin.trim().toUpperCase() !== (item.gstin || ""));

  const handleSave = async () => {
    setBusy(true);
    try {
      const response = await updateSuggestion(item.id, {
        address: draft.address,
        ...(hasGstin ? { gstin: draft.gstin } : {}),
      });
      onSaved({ ...item, address: response.data.address, gstin: response.data.gstin });
      setDraft({ address: response.data.address, gstin: response.data.gstin || "" });
      showSuccess("Suggestion updated. Existing bilties are not changed.");
    } catch (err) {
      showError(getApiErrorMessage(err, "Failed to update suggestion"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this suggestion? Existing bilties are not changed.")) {
      return;
    }

    setBusy(true);
    try {
      await deleteSuggestion(item.id);
      onDeleted(item.id);
      showSuccess("Suggestion deleted.");
    } catch (err) {
      showError(getApiErrorMessage(err, "Failed to delete suggestion"));
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">
          {KIND_LABELS[item.kind]}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
          {item.ownerType === "group" ? "Group" : "User"}: {item.ownerName}
        </span>
      </div>

      <div className={`grid gap-3 ${hasGstin ? "md:grid-cols-[1fr_16rem]" : ""}`}>
        <textarea
          value={draft.address}
          onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
          rows={2}
          aria-label="Value"
          className="input resize-y"
        />
        {hasGstin ? (
          <input
            value={draft.gstin}
            onChange={(event) =>
              setDraft((current) => ({ ...current, gstin: event.target.value.toUpperCase() }))
            }
            placeholder="GSTIN"
            aria-label="GSTIN"
            className="input"
          />
        ) : null}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700 disabled:opacity-50"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !isDirty || !draft.address.trim()}
          className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white disabled:bg-brand-300"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
};

const SuggestionsPage: React.FC = () => {
  const { showError } = useToast();
  const [items, setItems] = useState<ManagedSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<SuggestionKind | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAllSuggestions()
      .then((response) => setItems(response.data))
      .catch((err) => showError(getApiErrorMessage(err, "Failed to load suggestions")))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (kind === "all" || item.kind === kind) &&
        (!query ||
          `${item.address} ${item.gstin || ""} ${item.ownerName}`.toLowerCase().includes(query))
    );
  }, [items, kind, search]);

  return (
    <div className="page-shell">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="card mb-6 p-6">
          <p className="inline-flex rounded-pill bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
            Superadmin
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Saved suggestions</h1>
          <p className="mt-2 text-sm text-slate-600">
            Everything users see in the consignor, consignee, method of packing and delivery address
            dropdowns. Edits here change future suggestions only, never bilties that already used
            the old value.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_16rem]">
            <div className="flex flex-wrap gap-2">
              {(["all", ...KINDS] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKind(option)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    kind === option
                      ? "bg-brand-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {option === "all" ? "All" : KIND_LABELS[option]}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search value, GSTIN, user..."
              className="input"
            />
          </div>
        </div>

        {loading ? <p className="text-slate-500">Loading suggestions...</p> : null}
        {!loading && visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-slate-500">
            No saved suggestions found.
          </div>
        ) : null}

        <div className="grid gap-3">
          {visible.map((item) => (
            <SuggestionRow
              key={item.id}
              item={item}
              onSaved={(updated) =>
                setItems((current) => current.map((row) => (row.id === updated.id ? updated : row)))
              }
              onDeleted={(id) => setItems((current) => current.filter((row) => row.id !== id))}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default SuggestionsPage;
