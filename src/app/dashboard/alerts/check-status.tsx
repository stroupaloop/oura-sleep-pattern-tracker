import { CircleCheck, Clock } from "lucide-react";
import { Callout } from "@/components/ui/callout";
import { isPatternCheckBehind } from "@/lib/episode-pattern";
import { formatNightLabel } from "@/lib/health/format";

/**
 * What the Alerts page says when there is no flag to list: the night the
 * check ran through, or that the check is behind, so a quiet list never
 * reads as all clear when newer nights have not been checked.
 */
export function AlertsCheckStatus({
  latestCheckedDay,
  today,
}: {
  latestCheckedDay: string;
  today: string;
}) {
  const night = formatNightLabel(latestCheckedDay, { weekday: false });

  if (isPatternCheckBehind(latestCheckedDay, today)) {
    return (
      <Callout tone="info" icon={Clock} title="Pattern check is behind">
        {`Last checked: the night of ${night}, with no sustained pattern flags. Newer nights haven't reached the app. Open the Oura app to sync; the check catches up after the next sync.`}
      </Callout>
    );
  }

  return (
    <Callout
      icon={CircleCheck}
      title="No sustained pattern flags from the available data"
    >
      {`Checked through the night of ${night}. This is not a clinical assessment.`}
    </Callout>
  );
}
