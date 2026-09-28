import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ThoughtTimeline, type TimelineEntry } from "./thought-timeline";
import { EditableThoughtTimeline } from "./editable-thought-timeline";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const ENTRIES: TimelineEntry[] = [
  {
    id: 7,
    note: "for you",
    link: "https://example.com/song",
    createdAt: 1790600000,
    linkClicks: 2,
  },
  {
    id: 8,
    note: null,
    link: "https://example.com/other",
    createdAt: 1790500000,
    linkClicks: 0,
  },
];

describe("thought links", () => {
  it("send readers through the click counter and never show counts", () => {
    const html = renderToStaticMarkup(<ThoughtTimeline entries={ENTRIES} />);
    expect(html).toContain('href="/api/thoughts/7/link"');
    expect(html).not.toContain("https://example.com/song");
    expect(html).not.toContain("Opened");
  });

  it("link authors straight through and show how often each was opened", () => {
    const html = renderToStaticMarkup(
      <EditableThoughtTimeline entries={ENTRIES} />
    );
    expect(html).toContain('href="https://example.com/song"');
    expect(html).toContain("Opened 2 times");
    expect(html).toContain("Not opened yet");
  });

  it("show no count when it could not be loaded", () => {
    const html = renderToStaticMarkup(
      <EditableThoughtTimeline
        entries={[{ ...ENTRIES[0], linkClicks: undefined }]}
      />
    );
    expect(html).not.toContain("Opened");
    expect(html).not.toContain("Not opened");
  });
});
