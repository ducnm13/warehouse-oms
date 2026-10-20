import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";

export interface SearchableOption {
  value: number;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  value: number;
  options: SearchableOption[];
  onChange: (value: number) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  autoAdvance?: boolean;
}

interface MenuPosition {
  rectTop: number;
  rectBottom: number;
  rectLeft: number;
  width: number;
  placeAbove: boolean;
}

export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Chọn...",
  required = false,
  disabled = false,
  className = "",
  autoAdvance = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const safeOptions = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const selected = useMemo(
    () => safeOptions.find((option) => option.value === value),
    [safeOptions, value],
  );

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return safeOptions;
    return safeOptions.filter((option) =>
      `${option.label} ${option.subLabel ?? ""}`.toLowerCase().includes(normalizedKeyword),
    );
  }, [keyword, safeOptions]);

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < menuHeight + 12 && rect.top > menuHeight + 12;
    // Giữ đúng vị trí nút bấm theo viewport, không cộng scroll nên không nhảy.
    setMenuPosition({
      rectTop: rect.top,
      rectBottom: rect.bottom,
      rectLeft: rect.left,
      width: Math.max(rect.width, 320),
      placeAbove,
    });
  };

  useLayoutEffect(() => {
    if (open) updateMenuPosition();
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      // Chỉ đóng khi click thực sự ra ngoài ô tìm kiếm và menu.
      if (searchRef.current?.contains(target)) return;
      setOpen(false);
      setKeyword("");
    };
    // Khi cuộn trang, đóng dropdown thay vì bám theo để tránh nhảy vị trí.
    // Bỏ qua scroll phát sinh từ chính list trong menu để cuộn chuột tìm kiếm được.
    const handleScrollOrResize = (event: Event) => {
      if (event.type === "resize") {
        updateMenuPosition();
        return;
      }
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      setOpen(false);
      setKeyword("");
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setKeyword("");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open ]);

  useEffect(() => {
    if (open) {
      setKeyword("");
      window.setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open ]);

  const focusNextInput = () => {
    const root = containerRef.current;
    if (!root) return;
    const cell = root.closest("td, th");
    const scope = cell?.parentElement || root.parentElement || document;
    const focusables = Array.from(
      scope.querySelectorAll<HTMLElement>("input, select, textarea, button"),
    ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
    const currentIndex = focusables.indexOf(buttonRef.current as HTMLElement);
    const next = focusables[currentIndex + 1];
    if (next) {
      window.setTimeout(() => {
        next.focus();
        if (next instanceof HTMLInputElement) next.select();
      }, 30);
    }
  };

  const closeMenu = (advance = false) => {
    setOpen(false);
    setKeyword("");
    if (advance && autoAdvance) focusNextInput();
  };

  const chooseFirstResult = () => {
    const first = filtered[0];
    if (!first) return;
    onChange(first.value);
    closeMenu(true);
  };

  return (
    <div ref={containerRef} className={className}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) closeMenu();
          else setOpen(true);
        }}
        className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-[14px] border px-3.5 py-2 text-left text-[13.5px] transition-colors ${
          disabled
            ? "cursor-not-allowed border-[#e0e5f2] bg-[#f4f7fe] text-[#a3aed0]"
            : selected
              ? "border-[#e0e5f2] bg-white text-[#2b3674] hover:border-[#a3aed0]"
              : "border-[#e0e5f2] bg-white text-[#a3aed0] hover:border-[#a3aed0]"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[#a3aed0]">
          {selected && !required && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                onChange(0);
              }}
              className="rounded-md p-0.5 hover:bg-[#e9e3ff] hover:text-[#422afb]"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && !disabled && menuPosition && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPosition.placeAbove ? undefined : menuPosition.rectBottom + 4,
            bottom: menuPosition.placeAbove ? window.innerHeight - menuPosition.rectTop + 4 : undefined,
            left: Math.min(menuPosition.rectLeft, Math.max(8, window.innerWidth - menuPosition.width - 8)),
            width: Math.min(menuPosition.width, window.innerWidth - 16),
            maxHeight: 320,
            zIndex: 9999,
          }}
          className="overflow-hidden rounded-[14px] border border-[#e0e5f2] bg-white shadow-[14px_17px_40px_4px_rgba(112,144,176,0.18)]"
        >
          <div className="flex items-center gap-2 border-b border-[#e9edf7] bg-[#f9fbff] px-3 py-2.5">
            <Search size={14} className="shrink-0 text-[#a3aed0]" />
            <input
              ref={searchRef}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  chooseFirstResult();
                } else if (event.key === "Tab") {
                  event.preventDefault();
                  chooseFirstResult();
                }
              }}
              placeholder="Nhập từ khóa, Enter/Tab để chọn dòng đầu tiên..."
              className="w-full bg-transparent text-[13.5px] text-[#2b3674] outline-none placeholder:text-[#a3aed0]"
            />
          </div>
          <div className="max-h-72 overflow-auto overscroll-contain py-1">
            {!required && (
              <button
                type="button"
                onClick={() => {
                  onChange(0);
                  closeMenu();
                }}
                className="block w-full px-3.5 py-2.5 text-left text-[13.5px] italic text-[#a3aed0] hover:bg-[#f4f7fe]"
              >
                {placeholder}
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-[#a3aed0]">
                Không tìm thấy kết quả phù hợp
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    closeMenu(autoAdvance);
                  }}
                  className={`block w-full px-3.5 py-2.5 text-left text-[13.5px] transition-colors hover:bg-[#f4f7fe] ${
                    option.value === value ? "bg-[#f2efff] font-semibold text-[#422afb]" : "text-[#2b3674]"
                  }`}
                >
                  <div className="truncate">{option.label}</div>
                  {option.subLabel && (
                    <div className="truncate text-xs text-[#a3aed0]">{option.subLabel}</div>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-[#e9edf7] bg-[#f9fbff] px-3.5 py-2 text-[11px] text-[#a3aed0]">
            {filtered.length} kết quả
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
