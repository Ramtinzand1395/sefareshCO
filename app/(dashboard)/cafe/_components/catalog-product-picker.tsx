"use client";

import { IconCheck, IconPackage, IconSearch } from "@tabler/icons-react";
import { useId, useMemo, useState } from "react";

export type CatalogProductOption = {
  id: string;
  name: string;
  brand?: string;
  unit: string;
};

export function CatalogProductPicker({
  products,
  value,
  onChange,
  disabled = false,
  label = "جستجو و انتخاب کالا",
  emptyMessage =
    "در حال حاضر کالای قابل انتخابی در کاتالوگ نیست؛ از گزینه کالای سفارشی استفاده کنید.",
}: {
  products: CatalogProductOption[];
  value: string;
  onChange: (productId: string) => void;
  disabled?: boolean;
  label?: string;
  emptyMessage?: string;
}) {
  const inputId = useId();
  const listboxId = useId();
  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("fa-IR");
    if (!normalizedSearch) return products;

    return products.filter((product) =>
      [product.name, product.brand, product.unit]
        .filter(Boolean)
        .some((part) =>
          part!.toLocaleLowerCase("fa-IR").includes(normalizedSearch),
        ),
    );
  }, [products, search]);

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-xs font-bold text-ink-muted"
      >
        {label}
      </label>
      <div className="relative">
        <IconSearch
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={disabled || products.length === 0}
          aria-controls={listboxId}
          placeholder="نام، برند یا واحد کالا"
          className="h-11 w-full rounded-control border border-line bg-surface ps-10 pe-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"
        />
      </div>

      <div
        id={listboxId}
        className="mt-2 max-h-52 space-y-1.5 overflow-y-auto overscroll-contain rounded-control border border-line bg-surface p-2"
        role="listbox"
        aria-label="کالاهای کاتالوگ"
      >
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => {
            const selected = value === product.id;
            return (
              <button
                key={product.id}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                onClick={() => onChange(product.id)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start transition disabled:opacity-60 ${
                  selected
                    ? "bg-primary-soft text-primary"
                    : "hover:bg-surface-subtle"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black">
                    {product.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                    {[product.brand, product.unit].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {selected ? (
                  <IconCheck className="size-4 shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            );
          })
        ) : (
          <div className="flex flex-col items-center px-4 py-5 text-center text-xs leading-6 text-ink-muted">
            <IconPackage className="mb-2 size-5" aria-hidden="true" />
            {products.length === 0
              ? emptyMessage
              : "کالایی با این عبارت پیدا نشد."}
          </div>
        )}
      </div>
    </div>
  );
}
