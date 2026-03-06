"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sleep", label: "Sleep" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function MobileNav({ email }: { email?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <nav className="flex flex-col gap-4 mt-8">
          <Link
            href="/dashboard"
            className="font-semibold text-lg"
            onClick={() => setOpen(false)}
          >
            Slothie&apos;s Bipolar Tracker
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
        </nav>
        {email && (
          <p className="text-sm text-muted-foreground mt-8">{email}</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
