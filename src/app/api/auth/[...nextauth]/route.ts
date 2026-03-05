import { handlers } from "@/lib/auth";

export async function GET(...args: Parameters<typeof handlers.GET>) {
  try {
    return await handlers.GET(...args);
  } catch (e) {
    console.error("[AUTH GET ERROR]", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(...args: Parameters<typeof handlers.POST>) {
  try {
    return await handlers.POST(...args);
  } catch (e) {
    console.error("[AUTH POST ERROR]", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
