import React, { useState, useEffect, forwardRef } from "react";
import { formatNumber, formatInteger } from "../lib/utils";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  className?: string;
  disabled?: boolean;
  title?: string;
  integerOnly?: boolean;
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, min, max, step = "any", decimals = 3, className = "", disabled, title, integerOnly }, ref) => {
    const [displayValue, setDisplayValue] = useState(() => integerOnly ? formatInteger(value) : formatNumber(value));

    useEffect(() => {
      setDisplayValue(integerOnly ? formatInteger(value) : formatNumber(value));
    }, [value, integerOnly]);

    // Parse theo chuẩn vi-VN (app format kiểu này): chấm là nhóm nghìn ("1.000"),
    // phẩy lẻ là thập phân ("38,442" là 38,442). Có cả 2 dấu thì dấu sau cùng là
    // thập phân ("1.000,5" lẫn "1,000.5" đều ra 1000.5).
    const parseInput = (input: string): number | null => {
      if (integerOnly) {
        const cleaned = input.replace(/[^\d-]/g, "");
        if (cleaned === "" || cleaned === "-") return null;
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? null : parsed;
      }
      let s = input.trim();
      if (s === "") return null;
      const sign = s.startsWith("-") ? "-" : "";
      const body = s.replace(/^[+-]/, "");
      const hasComma = body.includes(",");
      const hasDot = body.includes(".");
      let num = body;
      if (hasComma && hasDot) {
        num = body.lastIndexOf(",") > body.lastIndexOf(".")
          ? body.replace(/\./g, "").replace(",", ".")
          : body.replace(/,/g, "");
      } else if (hasComma) {
        // App hiển thị vi-VN nên dấu phẩy lẻ = thập phân ("38,442" là 38,442);
        // chỉ khi nhiều dấu phẩy mới là nhóm nghìn ("1,000,000").
        const commaCount = (body.match(/,/g) || []).length;
        num = commaCount === 1 ? body.replace(",", ".") : body.replace(/,/g, "");
      } else if (hasDot) {
        num = /^\d{1,3}(\.\d{3})+$/.test(body) ? body.replace(/\./g, "") : body;
      }
      const cleaned = (sign + num).replace(/[^0-9.\-]/g, "");
      if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
      // Chỉ giữ dấu chấm thập phân đầu tiên
      const parts = cleaned.split(".");
      const normalized = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
      const parsed = parseFloat(normalized);
      return isNaN(parsed) ? null : parsed;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const parsed = parseInput(raw);
      if (parsed !== null) {
        onChange(parsed);
        setDisplayValue(integerOnly ? formatInteger(parsed) : formatNumber(parsed));
      } else {
        setDisplayValue(raw);
        onChange(0);
      }
    };

    const handleBlur = () => {
      const parsed = parseInput(displayValue);
      if (parsed !== null) {
        onChange(parsed);
        setDisplayValue(integerOnly ? formatInteger(parsed) : formatNumber(parsed));
      } else {
        setDisplayValue(integerOnly ? formatInteger(value) : formatNumber(value));
      }
    };

    const handleFocus = () => {
      setDisplayValue(value.toString());
    };

    return (
      <input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        min={min !== undefined ? min : undefined}
        max={max !== undefined ? max : undefined}
        step={step}
        className={`w-full text-right rounded border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary font-mono ${className}`}
        inputMode={integerOnly ? "numeric" : "decimal"}
        disabled={disabled}
        title={title}
      />
    );
  },
);

NumberInput.displayName = "NumberInput";

export default NumberInput;