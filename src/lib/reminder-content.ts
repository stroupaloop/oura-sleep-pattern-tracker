import type { DoseSlot } from "@/lib/medication-schedule";

const SLOT_DUE_HOUR: Record<DoseSlot, number> = {
  morning: 0,
  afternoon: 12,
  evening: 17,
  night: 21,
};

/** Slots whose dose time has arrived by this ET hour, so a morning reminder never nags about the night dose. */
export function dueSlotsAt(etHour: number): Set<string> {
  return new Set(
    (Object.keys(SLOT_DUE_HOUR) as DoseSlot[]).filter(
      (slot) => etHour >= SLOT_DUE_HOUR[slot]
    )
  );
}

export interface Reminder {
  subject: string;
  html: string;
  text: string;
  sms: string;
}

/** The reminder to send, or null when the due doses are all logged and the day has a check-in. */
export function buildReminder(
  missingDoses: readonly string[],
  moodLogged: boolean,
  url: string
): Reminder | null {
  if (missingDoses.length === 0 && moodLogged) return null;

  const subject =
    missingDoses.length > 0
      ? "Time to take and log today's meds"
      : "Time for today's daily log";
  const lines: string[] = [];
  if (missingDoses.length > 0) {
    lines.push(`Not logged yet today: ${missingDoses.join(", ")}.`);
  }
  if (!moodLogged) lines.push("Today's check-in hasn't been filled in yet.");
  lines.push("It only takes a minute.");

  return {
    subject,
    html: `${lines.map((l) => `<p>${l}</p>`).join("")}<p><a href="${url}">Open the daily log</a></p>`,
    text: `${lines.join(" ")}\n\n${url}`,
    sms: `${missingDoses.length > 0 ? `Meds not logged: ${missingDoses.join(", ")}. ` : ""}${!moodLogged ? "Check-in not filled in. " : ""}${url}`,
  };
}
