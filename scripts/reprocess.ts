import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { loadActiveConfig } = await import("@/lib/analysis/config");
  const { reprocessAll } = await import("@/lib/analysis/reprocess");

  const cfg = await loadActiveConfig();
  console.log("Config version:", cfg.version);
  console.log("Has absoluteThresholds:", !!cfg.absoluteThresholds);
  console.log("Running reprocess...");

  const result = await reprocessAll(cfg);
  console.log("Done!", JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
