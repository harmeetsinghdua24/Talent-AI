import { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from "react";
import clsx from "clsx";

export function DataTable({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={clsx("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={clsx(
        "px-5 py-3.5 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide bg-canvas/60",
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx("px-5 py-4", className)} {...props} />;
}
