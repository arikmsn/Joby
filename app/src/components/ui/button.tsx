import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const base =
      "relative inline-flex items-center justify-center rounded-[var(--radius)] font-medium select-none " +
      "transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out " +
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none " +
      "active:scale-[0.97] will-change-transform";

    const variants = {
      primary:
        "bg-primary text-white shadow-sm shadow-primary/20 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/25 hover:-translate-y-[1px] active:translate-y-0 focus-visible:ring-primary",
      secondary:
        "border border-border bg-surface text-foreground shadow-sm hover:bg-background hover:border-foreground-tertiary/40 hover:-translate-y-[1px] active:translate-y-0 focus-visible:ring-primary",
      danger:
        "bg-danger text-white shadow-sm shadow-danger/20 hover:bg-red-700 hover:shadow-md hover:shadow-danger/25 hover:-translate-y-[1px] active:translate-y-0 focus-visible:ring-danger",
      ghost:
        "text-foreground-secondary hover:bg-background hover:text-foreground active:bg-border-light focus-visible:ring-primary",
      success:
        "bg-success text-white shadow-sm shadow-success/20 hover:bg-green-700 hover:shadow-md hover:shadow-success/25 hover:-translate-y-[1px] active:translate-y-0 focus-visible:ring-success",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm gap-1.5",
      md: "px-4 py-2.5 text-sm gap-2",
      lg: "px-6 py-3 text-base gap-2",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        <span
          className={cn(
            "inline-flex items-center justify-center gap-[inherit] transition-opacity duration-150",
            loading && "opacity-0"
          )}
        >
          {children}
        </span>
        {loading && (
          <svg
            className="absolute inset-0 m-auto h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
