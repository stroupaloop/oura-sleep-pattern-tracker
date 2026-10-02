import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Atkinson_Hyperlegible_Next: () => ({
    className: "atkinson-class",
    variable: "atkinson-variable",
    style: { fontFamily: "Atkinson Hyperlegible Next" },
  }),
}));

describe("RootLayout", () => {
  it("defines the font variable on <html>, where Tailwind sets the page font", () => {
    const html = renderToStaticMarkup(<RootLayout>page</RootLayout>);

    expect(html).toMatch(/<html[^>]*class="[^"]*\batkinson-variable\b/);
    expect(html).not.toMatch(/<body[^>]*atkinson-variable/);
  });
});
