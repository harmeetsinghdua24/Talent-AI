"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import clsx from "clsx";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{ show: (message: string, tone?: ToastTone) => void } | undefined>(undefined);

const iconFor: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-success" />,
  error: <XCircle size={18} className="text-danger" />,
  info: <Info size={18} className="text-info" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "flex items-center gap-2.5 rounded-xl border bg-white px-4 py-3 shadow-lg text-sm font-medium min-w-[260px]",
              t.tone === "success" && "border-success/20",
              t.tone === "error" && "border-danger/20",
              t.tone === "info" && "border-info/20"
            )}
          >
            {iconFor[t.tone]}
            <span className="text-ink">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
