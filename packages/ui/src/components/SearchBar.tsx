"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  filters?: Array<{ value: string; label: string }>;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  onClear?: () => void;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  filters,
  activeFilter,
  onFilterChange,
  onClear,
  className = "",
  autoFocus = false,
}: SearchBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClear = useCallback(() => {
    onChange("");
    onClear?.();
    inputRef.current?.focus();
  }, [onChange, onClear]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!showFilters) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showFilters]);

  const activeFilterLabel = filters?.find((f) => f.value === activeFilter)?.label;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 flex items-center gap-2 bg-linear-bg-overlay border border-linear-border-subtle rounded-md px-3 py-2 focus-within:border-linear-accent transition-colors">
        <Search className="w-4 h-4 text-linear-text-tertiary flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent font-mono text-sm text-linear-text focus:outline-none placeholder:text-linear-text-disabled"
          data-testid="search-bar-input"
        />
        {value && (
          <button
            onClick={handleClear}
            className="text-linear-text-tertiary hover:text-linear-text transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-linear-border-subtle font-mono text-[10px] text-linear-text-disabled">
          ⌘K
        </kbd>
      </div>

      {filters && filters.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md border font-mono text-sm transition-colors ${
              activeFilter
                ? "bg-linear-accent/10 border-linear-accent/40 text-linear-accent"
                : "bg-linear-bg-overlay border-linear-border-subtle text-linear-text-tertiary hover:text-linear-text-secondary"
            }`}
            data-testid="search-bar-filter"
          >
            {activeFilterLabel ?? "Filter"}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilters && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-linear-bg-elevated border border-linear-border-subtle rounded-md shadow-lg z-50 py-1">
              <button
                onClick={() => {
                  onFilterChange?.("");
                  setShowFilters(false);
                }}
                className={`w-full text-left px-3 py-1.5 font-mono text-sm transition-colors ${
                  !activeFilter ? "text-linear-accent bg-linear-accent/10" : "text-linear-text-secondary hover:bg-linear-bg-overlay"
                }`}
              >
                All
              </button>
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    onFilterChange?.(f.value);
                    setShowFilters(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 font-mono text-sm transition-colors ${
                    activeFilter === f.value ? "text-linear-accent bg-linear-accent/10" : "text-linear-text-secondary hover:bg-linear-bg-overlay"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
