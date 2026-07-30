export const dynamic = "force-dynamic";

import { format, subDays } from "date-fns";
import { generateReport } from "@/lib/reports/generate";
import { ReportView } from "./report-view";
import { getTodayET } from "@/lib/date-utils";

interface Props {
  searchParams: Promise<{ start?: string; end?: string }>;
}

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const endDate = params.end ?? getTodayET();
  const startDate =
    params.start ??
    format(subDays(new Date(`${endDate}T12:00:00`), 29), "yyyy-MM-dd");

  const data = await generateReport(startDate, endDate);

  return (
    <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold print:hidden">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1 print:hidden">
          Shareable summary for the selected date range
        </p>
      </div>
      <ReportView data={data} />
    </div>
  );
}
