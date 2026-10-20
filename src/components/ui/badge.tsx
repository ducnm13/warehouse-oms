import React from "react";
import { cn } from "../../lib/utils";

type Tone = "brand" | "gray" | "success" | "warning" | "error" | "info";

const tones: Record<Tone, string> = {
  brand: "bg-[#e9e3ff] text-[#3311db]",
  gray: "bg-[#eef2fb] text-[#707eae]",
  success: "bg-[#ecfdf3] text-[#027a48]",
  warning: "bg-[#fffaeb] text-[#b54708]",
  error: "bg-[#fef3f2] text-[#b42318]",
  info: "bg-[#eff8ff] text-[#175cd3]",
};

export default function Badge({ tone = "gray", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[10.5px] font-bold leading-none", tones[tone], className)}
      {...props}
    />
  );
}
