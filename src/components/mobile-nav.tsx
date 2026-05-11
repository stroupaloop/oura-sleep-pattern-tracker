"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sleep", label: "Sleep" },
  { href: "/dashboard/insights", label: "Insights" },
  { href: "/dashboard/lifechart", label: "Life Chart" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/checkin", label: "Check-in" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/methodology", label: "Methodology" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function MobileNav({ email, isSensitive }: { email?: string | null; isSensitive?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <nav className="flex flex-col gap-4 mt-8 px-4">
          <Link
            href="/dashboard"
            className="font-semibold text-lg"
            onClick={() => setOpen(false)}
          >
            🦥 Slothie&apos;s Bipolar Tracker
          </Link>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {isSensitive && (
            <Link
              href="/dashboard/private"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              Private
            </Link>
          )}
        </nav>
        {email && (
          <div className="mt-8 px-4 space-y-2 border-t pt-4">
            <p className="text-sm text-muted-foreground">{email}</p>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
