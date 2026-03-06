import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="max-w-2xl text-center space-y-8">
        <span className="text-7xl">🦥</span>
        <h1 className="text-4xl font-bold tracking-tight">
          Slothie&apos;s Bipolar Tracker
        </h1>
        <p className="text-lg text-muted-foreground">
          Monitor sleep patterns using Oura Ring data. Track trends in sleep
          duration, timing, and quality to identify meaningful changes early.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          This tool tracks sleep patterns for personal awareness. It is not a
          medical device and does not provide diagnoses. Discuss concerns with
          your healthcare provider.
        </p>
      </main>
      <footer className="mt-16 text-xs text-muted-foreground space-x-4">
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
