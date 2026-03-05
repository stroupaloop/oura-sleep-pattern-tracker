import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadActiveConfig, createConfig, SENSITIVITY_PRESETS } from "@/lib/analysis/config";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await loadActiveConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Config load error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { preset, notes, ...overrides } = body as {
      preset?: keyof typeof SENSITIVITY_PRESETS;
      notes?: string;
    } & Record<string, unknown>;

    let configOverrides: Record<string, unknown> = {};

    if (preset && preset in SENSITIVITY_PRESETS) {
      configOverrides = { ...SENSITIVITY_PRESETS[preset] };
    }

    configOverrides = { ...configOverrides, ...overrides, notes };

    const config = await createConfig(configOverrides);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("Config create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
