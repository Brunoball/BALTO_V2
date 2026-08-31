import React, { useEffect, useMemo, useRef, useState } from "react";

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

export default function BuscadorSelector({
  options = [],
  value = "",
  onChange,
  getValue = (row) => row?.id,
  getLabel = (row) => row?.nombre || "",
  placeholder = "SELECCIONAR",
  searchPlaceholder = "BUSCAR...",
  emptyText = "NO SE ENCONTRARON RESULTADOS",
  disabled = false,
}) {
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((row) => String(getValue(row)) === String(value)) || null,
    [options, value, getValue]
  );

  const filtered = useMemo(() => {
    const q = normalize(query).trim();
    if (!q) return options;
    return options.filter((row) => normalize(getLabel(row)).includes(q));
  }, [options, query, getLabel]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const choose = (row) => {
    onChange?.(String(getValue(row)));
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={`servicios-searchable-select ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="servicios-searchable-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        <span>{selected ? getLabel(selected) : placeholder}</span>
        <span className="servicios-searchable-select__chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="servicios-searchable-select__menu">
          <div className="servicios-searchable-select__search-wrap">
            <input
              ref={searchRef}
              type="search"
              maxLength={120}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>

          <div className="servicios-searchable-select__options" role="listbox">
            {filtered.length === 0 ? (
              <div className="servicios-searchable-select__empty">{emptyText}</div>
            ) : (
              filtered.map((row) => {
                const optionValue = String(getValue(row));
                const active = String(value) === optionValue;
                return (
                  <button
                    key={optionValue}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={active ? "is-selected" : ""}
                    onClick={() => choose(row)}
                  >
                    {getLabel(row)}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
