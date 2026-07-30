import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function requireApiUser() {
  const session = await auth();
  return session?.user ?? null;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
