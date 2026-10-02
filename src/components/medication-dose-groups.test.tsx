import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MedicationDoseGroups } from "./medication-dose-groups";

const MEDS = [
  { id: 1, name: "Linzess", dosage: "290mcg", frequency: "daily", doseSchedule: '["morning"]' },
  { id: 2, name: "Lithium", dosage: "600mg", frequency: "daily", doseSchedule: '["evening"]' },
];

describe("MedicationDoseGroups inline layout", () => {
  it("puts each time of day on one line with plain checkboxes", () => {
    const html = renderToStaticMarkup(
      <MedicationDoseGroups
        medications={MEDS}
        checks={{ 1: { morning: true } }}
        layout="inline"
        onCheckedChange={() => {}}
      />
    );
    expect(html).toContain("Morning");
    expect(html).toContain("Evening");
    expect(html).toContain("Linzess");
    expect(html).toContain('title="290mcg"');
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });
});

describe("MedicationDoseGroups rows layout", () => {
  it("heads each time of day in plain words", () => {
    const html = renderToStaticMarkup(
      <MedicationDoseGroups
        medications={MEDS}
        checks={{}}
        onCheckedChange={() => {}}
      />
    );
    expect(html).toMatch(/<h3[^>]*>Morning<\/h3>/);
    expect(html).toMatch(/<h3[^>]*>Evening<\/h3>/);
  });
});

describe("MedicationDoseGroups touch targets", () => {
  it("makes every dose row at least 40px tall on phones in both layouts", () => {
    for (const layout of ["rows", "inline"] as const) {
      const html = renderToStaticMarkup(
        <MedicationDoseGroups
          medications={MEDS}
          checks={{}}
          layout={layout}
          onCheckedChange={() => {}}
        />
      );
      expect(html.match(/<label[^>]*class="[^"]*\bmin-h-10\b/g)).toHaveLength(2);
    }
  });
});
