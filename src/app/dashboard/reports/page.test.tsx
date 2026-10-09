import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportsPage from "./page";

const generateReport = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard/reports",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/reports/generate", () => ({ generateReport }));
vi.mock("./report-view", () => ({
  ReportView: () => <div>report</div>,
  PrintReportButton: () => <button>Print</button>,
}));

async function render(params: Record<string, string>) {
  return renderToStaticMarkup(
    await ReportsPage({ searchParams: Promise.resolve(params) })
  );
}

describe("Reports page date range", () => {
  beforeEach(() => {
    generateReport.mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T16:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports on the last 30 days unless told otherwise", async () => {
    const html = await render({});
    expect(generateReport).toHaveBeenCalledWith("2026-09-10", "2026-10-09");
    expect(html).toContain("Showing Sep 10 – Oct 9, 2026 · 30 days");
    expect(html).toContain('role="radiogroup"');
  });

  it("still reads the start and end an old link carries", async () => {
    const html = await render({ start: "2026-07-01", end: "2026-07-31" });
    expect(generateReport).toHaveBeenCalledWith("2026-07-01", "2026-07-31");
    expect(html).toContain("Showing Jul 1 – Jul 31, 2026 · 31 days");
  });

  it("takes a preset, or from and to", async () => {
    await render({ range: "7d" });
    expect(generateReport).toHaveBeenLastCalledWith("2026-10-03", "2026-10-09");
    await render({ from: "2026-08-01", to: "2026-08-15" });
    expect(generateReport).toHaveBeenLastCalledWith("2026-08-01", "2026-08-15");
  });

  it("does not report on all time, which it has no preset for", async () => {
    await render({ range: "all" });
    expect(generateReport).toHaveBeenLastCalledWith("2026-09-10", "2026-10-09");
  });

  it("keeps the picker out of the printed report", async () => {
    const html = await render({});
    expect(html).toContain("print:hidden");
  });
});
