import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-brand to-brand-hover text-white shadow-[0_1px_2px_rgba(67,56,202,0.3),0_4px_12px_-2px_rgba(67,56,202,0.35)] hover:shadow-[0_1px_2px_rgba(67,56,202,0.3),0_6px_20px_-2px_rgba(67,56,202,0.5)] hover:brightness-105",
  secondary: "bg-white text-ink border border-border hover:border-border-strong hover:bg-canvas",
  ghost: "text-ink-muted hover:text-ink hover:bg-canvas",
  danger: "bg-white text-danger border border-danger/30 hover:bg-danger-tint",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5 rounded-lg gap-1.5",
  md: "text-sm px-4 py-2.5 rounded-lg gap-2",
  lg: "text-base px-5 py-3 rounded-xl gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97]",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
