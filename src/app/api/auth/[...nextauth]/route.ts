import { handlers } from "@/lib/auth";

export const dynamic = "force-dynamic";

function authErrorResponse(method: "GET" | "POST", error: unknown) {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    console.error(`[AUTH ${method} ERROR] Authentication request failed`);
  } else {
    console.error(`[AUTH ${method} ERROR]`, error);
  }

  return new Response(
    JSON.stringify(
      isProduction
        ? { error: "Authentication request failed" }
        : {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          }
    ),
    {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function GET(...args: Parameters<typeof handlers.GET>) {
  try {
    return await handlers.GET(...args);
  } catch (error) {
    return authErrorResponse("GET", error);
  }
}

export async function POST(...args: Parameters<typeof handlers.POST>) {
  try {
    return await handlers.POST(...args);
  } catch (error) {
    return authErrorResponse("POST", error);
  }
}
