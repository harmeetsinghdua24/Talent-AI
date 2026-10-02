import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

const fieldBase =
  "w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-colors";

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string }>(
  ({ label, className, id, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input ref={ref} id={id} className={clsx(fieldBase, className)} {...props} />
    </div>
  )
);
TextField.displayName = "TextField";

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }
>(({ label, className, id, ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
    )}
    <textarea ref={ref} id={id} className={clsx(fieldBase, "min-h-[140px] resize-y", className)} {...props} />
  </div>
));
TextArea.displayName = "TextArea";
