"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const isVerify = searchParams.get("verify") === "1";
  const isError = searchParams.get("error");

  if (isError) {
    const errorMessages: Record<string, string> = {
      Verification: "Your sign-in link has expired or is invalid.",
      Configuration: "There's a server configuration issue. Please contact support.",
      AccessDenied: "This email is not authorized to sign in.",
    };
    const message = errorMessages[isError] ?? `Something went wrong (${isError}).`;

    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in error</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => window.location.assign("/login")} className="w-full">
            Send a new link
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Tip: Click the link directly from your email app. Copy/pasting into some browsers may not work.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (sentTo || isVerify) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            A sign-in link has been sent to{sentTo ? <> <strong>{sentTo}</strong></> : " your email address"}. Click the link
            to log in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Tip: Click the link directly from your email app. Copy/pasting into some browsers (like Brave) may not work.
          </p>
          {sentTo && (
            <button
              type="button"
              onClick={() => { setSentTo(null); setError(null); }}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Use a different email
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await signIn("resend", { email, redirect: false, callbackUrl: "/dashboard" });
      if (result?.error) {
        setError(result.error);
      } else {
        setSentTo(email);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Enter your email to receive a magic link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send magic link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
