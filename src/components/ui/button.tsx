import React from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: "bg-[#465fff] border-[#465fff] text-white hover:bg-[#3641f4] hover:border-[#3641f4] shadow-sm",
  outline: "bg-white border-[#d0d5dd] text-[#344054] hover:bg-[#f9fafb] shadow-sm",
  ghost: "bg-transparent border-transparent text-[#667085] hover:bg-[#f2f4f7] hover:text-[#344054] shadow-none",
  danger: "bg-white border-[#fecdca] text-[#d92d20] hover:bg-[#fef3f2] shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "min-h-[32px] px-3 text-[12.5px]",
  md: "min-h-[36px] px-3.5 text-[13px]",
};

export default function Button({ variant = "outline", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
