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

  it("let a reader react, show their own reaction as removable, and hide which pings were automatic", () => {
    const html = renderToStaticMarkup(
      <ThoughtTimeline
        entries={[
          {
            id: 9,
            note: null,
            link: null,
            createdAt: 1790600000,
            isAuto: true,
            reactions: [
              { email: "reader@example.com", emoji: "🥰" },
              { email: "other@example.com", emoji: "😂" },
            ],
          },
        ]}
        viewerEmail="Reader@example.com"
        recents={["❤️", "🥰", "😂", "🥺", "🙏"]}
      />
    );
    expect(html).toContain('aria-label="Add a reaction"');
    expect(html).toContain('aria-label="Remove your 🥰 reaction"');
    expect(html).toContain('title="other@example.com"');
    expect(html.toLowerCase()).not.toContain("auto");
  });

  it("offer no reactions when they could not be loaded or nobody is signed in", () => {
    const withoutReactions = renderToStaticMarkup(
      <ThoughtTimeline entries={ENTRIES} viewerEmail="reader@example.com" />
    );
    const signedOut = renderToStaticMarkup(
      <ThoughtTimeline entries={[{ ...ENTRIES[0], reactions: [] }]} />
    );
    expect(withoutReactions).not.toContain("Add a reaction");
    expect(signedOut).not.toContain("Add a reaction");
  });

  it("show authors the reactions and mark automatic pings", () => {
    const html = renderToStaticMarkup(
      <EditableThoughtTimeline
        entries={[
          {
            id: 9,
            note: null,
            link: null,
            createdAt: 1790600000,
            isAuto: true,
            reactions: [{ email: "reader@example.com", emoji: "🥰" }],
          },
        ]}
      />
    );
    expect(html).toContain(">auto<");
    expect(html).toContain("🥰");
    expect(html).not.toContain("Add a reaction");
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
