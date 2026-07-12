"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rocket,
  Bot,
  Building2,
  CalendarClock,
  FileText,
  Mail,
  MessageCircle,
  BellRing,
  CheckSquare,
  Calendar,
  BarChart3,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { ScrollArea } from "@/components/ui/misc";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/command-center", label: "Command Center", icon: Rocket },
  { href: "/company", label: "AI Company", icon: Bot },
  { href: "/companies", label: "Clients", icon: Building2 },
  { href: "/meetings", label: "Discovery Meetings", icon: CalendarClock },
  { href: "/proposals", label: "Proposal Generator", icon: FileText },
  { href: "/email-generator", label: "Email Generator", icon: Mail },
  { href: "/whatsapp-generator", label: "WhatsApp Generator", icon: MessageCircle },
  { href: "/follow-ups", label: "Follow-up Manager", icon: BellRing },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const drawerRef = React.useRef<HTMLElement>(null);

  // Focus trap for the mobile drawer: move focus in on open, loop Tab within
  // the drawer, close on Escape, and restore focus to the trigger on close.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [mobileOpen, onClose]);

  const nav = (
    <nav className="flex flex-col gap-0.5 px-3 pb-6">
      {NAV_ITEMS.map((item) => {
        // Match on segment boundaries so "/company" doesn't also light up for
        // "/companies" (and vice-versa).
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border/60 px-5">
          <Link href="/" className="flex items-center text-white transition-opacity hover:opacity-90">
            <Logo tileSize={34} subtitle="Sales Intelligence" />
          </Link>
        </div>
        <ScrollArea className="flex-1">{nav}</ScrollArea>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar animate-in slide-in-from-left duration-200"
          >
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border/60 px-5 text-white">
              <Logo tileSize={32} />
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="rounded-md p-1 text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScrollArea className="flex-1">{nav}</ScrollArea>
          </aside>
        </div>
      )}
    </>
  );
}
