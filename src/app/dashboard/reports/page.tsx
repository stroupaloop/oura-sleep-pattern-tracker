export const dynamic = "force-dynamic";

import { generateReport } from "@/lib/reports/generate";
import { PrintReportButton, ReportView } from "./report-view";
import { getTodayET } from "@/lib/date-utils";
import {
  presetsFor,
  resolveDateRange,
  type RangeParams,
} from "@/lib/date-range";
import { PageHeader } from "@/components/page-header";
import { DateRangeSelector } from "@/components/ui/date-range-selector";

interface Props {
  searchParams: Promise<RangeParams>;
}

const RANGE_PRESETS = presetsFor(["7d", "14d", "30d", "90d", "180d", "1y"]);

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const today = getTodayET();
  // Reports have always read ?start= and ?end=; those still work.
  const range = resolveDateRange(params, {
    today,
    defaultToken: "30d",
    allowAll: false,
  });

  const data = await generateReport(range.start ?? range.end, range.end);

  return (
    <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
      <PageHeader
        title="Reports"
        description="Shareable summary for the selected date range"
        actions={<PrintReportButton />}
        className="print:hidden"
      />
      <DateRangeSelector
        range={range}
        presets={RANGE_PRESETS}
        today={today}
        className="print:hidden"
      />
      <ReportView data={data} />
    </div>
  );
}
