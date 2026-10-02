"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/dashboard", label: "Thoughts" },
  { href: "/dashboard/health", label: "Health" },
  { href: "/dashboard/sleep", label: "Sleep" },
  { href: "/dashboard/insights", label: "Insights" },
  { href: "/dashboard/lifechart", label: "Life Chart" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/checkin", label: "Check-in" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/methodology", label: "Methodology" },
  { href: "/dashboard/visits", label: "Visits" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/", label: "Public page" },
];

export function isCurrentPath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return href !== "/" && href !== "/dashboard" && pathname.startsWith(`${href}/`);
}

const linkClass =
  "flex min-h-10 items-center rounded-md px-2 transition-colors hover:bg-accent hover:text-foreground";

export function MobileNav({ email, isSensitive }: { email?: string | null; isSensitive?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = isSensitive
    ? [...navLinks, { href: "/dashboard/private", label: "Private" }]
    : navLinks;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <nav className="flex flex-col gap-0.5 mt-8 px-2">
          <Link
            href="/dashboard"
            className="mb-3 flex min-h-10 items-center gap-1.5 px-2 font-semibold text-lg"
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">🦥</span>
            Slothie&apos;s Bipolar Tracker
          </Link>
          {links.map((link) => {
            const current = isCurrentPath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  linkClass,
                  current ? "font-medium text-foreground" : "text-muted-foreground"
                )}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        {email && (
          <div className="mt-8 px-2 space-y-1 border-t pt-4">
            <p className="px-2 text-sm text-muted-foreground">{email}</p>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full justify-start px-2 has-[>svg]:px-2 font-normal text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
