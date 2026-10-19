import React from "react";
import { cn } from "../../lib/utils";

type Tone = "brand" | "gray" | "success" | "warning" | "error" | "info";

const tones: Record<Tone, string> = {
  brand: "bg-[#ecf3ff] text-[#3641f4]",
  gray: "bg-[#f2f4f7] text-[#475467]",
  success: "bg-[#ecfdf3] text-[#027a48]",
  warning: "bg-[#fffaeb] text-[#b54708]",
  error: "bg-[#fef3f2] text-[#b42318]",
  info: "bg-[#eff8ff] text-[#175cd3]",
};

export default function Badge({ tone = "gray", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium leading-none", tones[tone], className)}
      {...props}
    />
  );
}
