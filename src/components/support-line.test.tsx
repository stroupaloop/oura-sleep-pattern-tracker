import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportLine, SupportNote } from "./support-line";

describe.each([
  ["SupportLine", SupportLine],
  ["SupportNote", SupportNote],
])("%s", (_name, Component) => {
  const html = renderToStaticMarkup(<Component />);

  it("offers calling, texting and chatting with 988", () => {
    expect(html).toContain('href="tel:988"');
    expect(html).toContain('href="sms:988"');
    expect(html).toContain('href="https://988lifeline.org/chat/"');
    expect(html).toContain("Call 988");
    expect(html).toContain("Text 988");
  });

  it("mentions 911 for an emergency", () => {
    expect(html).toContain("911");
  });

  it("opens the chat link safely in a new tab", () => {
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("does not diagnose or name an episode", () => {
    expect(html.toLowerCase()).not.toMatch(/manic|depress|episode|diagnos/);
  });
});
