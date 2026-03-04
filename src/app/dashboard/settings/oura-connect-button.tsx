"use client";

import { Button } from "@/components/ui/button";

export function OuraConnectButton({ label }: { label: string }) {
  function handleConnect() {
    window.location.href = "/api/oura/connect";
  }

  return <Button onClick={handleConnect}>{label}</Button>;
}
