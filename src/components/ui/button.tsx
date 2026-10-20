import React from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: "bg-[#422afb] border-[#422afb] text-white hover:bg-[#3311db] hover:border-[#3311db] shadow-[0_8px_20px_rgba(66,42,251,0.25)]",
  outline: "bg-white border-[#e0e5f2] text-[#2b3674] hover:bg-[#f4f7fe] hover:border-[#d0dcfb] shadow-[0_4px_12px_rgba(112,144,176,0.08)]",
  ghost: "bg-transparent border-transparent text-[#a3aed0] hover:bg-[#eef2fb] hover:text-[#2b3674] shadow-none",
  danger: "bg-white border-[#fecdca] text-[#d92d20] hover:bg-[#fef3f2] shadow-[0_4px_12px_rgba(112,144,176,0.08)]",
};

const sizes: Record<Size, string> = {
  sm: "min-h-[32px] px-3 text-[12px] rounded-xl",
  md: "min-h-[38px] px-4 text-[13px] rounded-2xl",
};

export default function Button({ variant = "outline", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 border font-semibold transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
