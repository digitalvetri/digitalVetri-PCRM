"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, Users, Loader2 } from "lucide-react";
import { cn, enumLabel } from "@/lib/utils";

interface SearchResult {
  type: "company" | "prospect";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  grade?: string | null;
}

/**
 * Global search: companies by name/phone/email/industry/city/state and
 * prospects by status/score. Debounced, keyboard-accessible (Cmd+K).
 */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError(false);
      return;
    }
    setLoading(true);
    // Abort the in-flight request when the query changes so a slow older
    // response can't overwrite a newer one (response race).
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = await res.json();
        setResults(data.results ?? []);
        setError(false);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // superseded by a newer query
        setResults([]);
        setError(true);
        setOpen(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search companies, phone, email, industry, city…"
          aria-label="Search companies and prospects"
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          className="h-9 w-full rounded-lg border bg-muted/50 pl-9 pr-16 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
          ⌘K
        </kbd>
      </div>

      {open && (
        <div
          id="global-search-results"
          className="absolute top-11 z-50 w-full overflow-hidden rounded-lg border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-destructive" role="alert">
              Search failed. Please try again.
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No results for “{query}”</div>
          ) : (
            <ul role="listbox" aria-label="Search results" className="max-h-80 overflow-y-auto py-1">
              {results.map((r) => (
                <li key={`${r.type}-${r.id}`} role="option" aria-selected={false}>
                  <button
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      router.push(r.href);
                    }}
                  >
                    {r.type === "company" ? (
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">
                      <span className="font-medium">{r.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{r.subtitle}</span>
                    </span>
                    {r.grade && (
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-[10px] font-bold",
                          r.grade === "A_PLUS" && "text-emerald-500 border-emerald-500/40",
                          r.grade === "A" && "text-blue-500 border-blue-500/40",
                          r.grade === "B" && "text-amber-500 border-amber-500/40",
                          r.grade === "C" && "text-slate-500 border-slate-500/40"
                        )}
                      >
                        {enumLabel(r.grade)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
