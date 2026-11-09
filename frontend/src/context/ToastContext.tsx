import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextType = {
  showToast: (kind: ToastKind, message: string) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const SUCCESS_DISMISS_MS = 4000;
const INFO_DISMISS_MS = 4000;
// Errors matter more to actually read, so they stay up longer than a
// success/info blip before auto-dismissing — on top of the manual close
// button every toast gets regardless of kind.
const ERROR_DISMISS_MS = 8000;

const dismissDelayFor = (kind: ToastKind) => {
  if (kind === "error") return ERROR_DISMISS_MS;
  if (kind === "success") return SUCCESS_DISMISS_MS;
  return INFO_DISMISS_MS;
};

export const ToastContext = createContext<ToastContextType | undefined>(
  undefined
);

const KIND_STYLES: Record<ToastKind, string> = {
  success: "border-success-100 bg-success-50 text-success-700",
  error: "border-danger-100 bg-danger-50 text-danger-600",
  info: "border-brand-100 bg-brand-50 text-brand-700",
};

const KIND_ICON: Record<ToastKind, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

const ToastViewport: React.FC<{
  toasts: Toast[];
  onDismiss: (id: number) => void;
}> = ({ toasts, onDismiss }) => (
  <div
    aria-live="polite"
    aria-atomic="false"
    className="no-print pointer-events-none fixed inset-x-0 top-4 z-[1000] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
  >
    {toasts.map((toast) => (
      <div
        key={toast.id}
        role={toast.kind === "error" ? "alert" : "status"}
        className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-panel-lg ${KIND_STYLES[toast.kind]}`}
      >
        <span className="mt-0.5 shrink-0 font-bold" aria-hidden="true">
          {KIND_ICON[toast.kind]}
        </span>
        <p className="flex-1 leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-full p-1 text-current/70 transition hover:bg-black/5 hover:text-current"
        >
          {"✕"}
        </button>
      </div>
    ))}
  </div>
);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(1);
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const handle = timeoutsRef.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextIdRef.current++;
      setToasts((current) => [...current, { id, kind, message }]);

      const handle = setTimeout(() => dismiss(id), dismissDelayFor(kind));
      timeoutsRef.current.set(id, handle);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      showToast,
      showSuccess: (message: string) => showToast("success", message),
      showError: (message: string) => showToast("error", message),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
};

/**
 * For use outside React components (e.g. the axios response interceptor),
 * where hooks aren't available. Set once by ToastProvider on mount; safe to
 * no-op before that (there's nothing to show a toast on yet, same window
 * where no request could have fired either).
 */
let externalShowError: ((message: string) => void) | null = null;

export const registerExternalToastHandler = (
  handler: (message: string) => void
) => {
  externalShowError = handler;
};

export const showExternalError = (message: string) => {
  externalShowError?.(message);
};
