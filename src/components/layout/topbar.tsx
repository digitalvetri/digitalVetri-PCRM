"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { GlobalSearch } from "@/components/layout/global-search";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>

      <Link href="/" className="lg:hidden" aria-label="DigitalVetri home">
        <Logo tileSize={30} wordmark={false} />
      </Link>

      <div className="flex-1 max-w-xl">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
