import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { presetsFor, resolveDateRange } from "@/lib/date-range";
import { DateRangeSelector } from "./date-range-selector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard/alerts",
  useSearchParams: () => new URLSearchParams("tab=sleep"),
}));

const TODAY = "2026-10-09";
const PRESETS = presetsFor(["14d", "30d", "90d", "180d", "1y", "all"]);

function render(
  params: Record<string, string>,
  props: { detail?: React.ReactNode; earliest?: string } = {}
) {
  const range = resolveDateRange(params, {
    today: TODAY,
    defaultToken: "90d",
    earliest: props.earliest,
  });
  return renderToStaticMarkup(
    <DateRangeSelector
      range={range}
      presets={PRESETS}
      today={TODAY}
      detail={props.detail}
    />
  );
}

function checkedOptions(html: string): string[] {
  return [...html.matchAll(/role="radio" aria-checked="true"[^>]*>(.*?)<\/button>/g)].map(
    (match) => match[1].replace(/<[^>]+>/g, "")
  );
}

describe("DateRangeSelector", () => {
  it("offers each preset and Custom as one group, with the page's default chosen", () => {
    const html = render({});
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Date range"');
    const labels = [...html.matchAll(/role="radio"[^>]*>(.*?)<\/button>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, "")
    );
    expect(labels).toEqual([
      "14d14 days",
      "30d30 days",
      "90d90 days",
      "180d180 days",
      "1y1 year",
      "AllAll time",
      "Custom",
    ]);
    expect(checkedOptions(html)).toEqual(["90d90 days"]);
  });

  it("says in words what window is in effect, with the page's own detail after it", () => {
    const html = render({}, { detail: "4 flagged nights" });
    expect(html).toContain("Showing Jul 12 – Oct 9, 2026 · 90 days · 4 flagged nights");
  });

  it("chooses the preset the address names, including an old numeric link", () => {
    expect(checkedOptions(render({ range: "30" }))).toEqual(["30d30 days"]);
    expect(checkedOptions(render({ range: "1y" }))).toEqual(["1y1 year"]);
    expect(render({ range: "all" }, { earliest: "2025-03-27" })).toContain(
      "Showing All time · Mar 27, 2025 – Oct 9, 2026 · 562 days"
    );
  });

  it("keeps the date fields closed until Custom is chosen", () => {
    const html = render({});
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain("Apply");
  });

  it("shows Custom with the dates when the address holds dates", () => {
    const html = render({ from: "2026-07-01", to: "2026-07-31" });
    expect(checkedOptions(html)).toEqual(["Custom"]);
    expect(html).toContain('name="from"');
    expect(html).toContain('value="2026-07-01"');
    expect(html).toContain('name="to"');
    expect(html).toContain('value="2026-07-31"');
    expect(html).toContain(`max="${TODAY}"`);
    expect(html).toContain("Apply");
    expect(html).toContain("Showing Jul 1 – Jul 31, 2026 · 31 days");
  });

  it("still shows a range typed into the address that is not a preset as chosen", () => {
    const html = render({ range: "45d" });
    expect(checkedOptions(html)).toEqual(["45d"]);
    expect(html).toContain("45 days");
  });
});
