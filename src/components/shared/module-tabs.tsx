"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A segmented sub-navigation that makes two (or more) related routes read as a
 * single module — e.g. Clients = Companies | Prospects, or Reports & Analytics.
 */
export function ModuleTabs({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export const CLIENT_TABS = [
  { href: "/companies", label: "Companies" },
  { href: "/prospects", label: "Prospects" },
];

export const INSIGHT_TABS = [
  { href: "/reports", label: "Reports" },
  { href: "/analytics", label: "Analytics" },
];
