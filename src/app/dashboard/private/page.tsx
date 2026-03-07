export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth, isSensitiveUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  dailyCardiovascularAge,
  vo2Max,
  sleepTime,
  personalInfo,
  enhancedTags,
  restModePeriods,
  cyclePredictions,
  sleepPeriods,
} from "@/lib/db/schema";
import { desc, gte, eq, and } from "drizzle-orm";
import { format, subDays } from "date-fns";
import { PrivateTabs } from "./private-tabs";

export default async function PrivatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isSensitiveUser(session.user.email)) redirect("/dashboard");

  const cutoff = format(subDays(new Date(), 90), "yyyy-MM-dd");

  const [
    cvAgeData,
    vo2Data,
    sleepTimeData,
    personalInfoData,
    tagData,
    restModeData,
    cycleData,
    tempData,
  ] = await Promise.all([
    db
      .select()
      .from(dailyCardiovascularAge)
      .where(gte(dailyCardiovascularAge.day, cutoff))
      .orderBy(dailyCardiovascularAge.day),
    db
      .select()
      .from(vo2Max)
      .where(gte(vo2Max.day, cutoff))
      .orderBy(vo2Max.day),
    db
      .select()
      .from(sleepTime)
      .where(gte(sleepTime.day, cutoff))
      .orderBy(sleepTime.day),
    db.select().from(personalInfo).limit(1),
    db
      .select()
      .from(enhancedTags)
      .where(gte(enhancedTags.day, cutoff))
      .orderBy(desc(enhancedTags.day)),
    db
      .select()
      .from(restModePeriods)
      .where(gte(restModePeriods.startDay, cutoff))
      .orderBy(desc(restModePeriods.startDay)),
    db
      .select()
      .from(cyclePredictions)
      .orderBy(desc(cyclePredictions.cycleNumber))
      .limit(12),
    db
      .select({
        day: sleepPeriods.day,
        temperatureDelta: sleepPeriods.temperatureDelta,
        bedtimeStart: sleepPeriods.bedtimeStart,
      })
      .from(sleepPeriods)
      .where(and(gte(sleepPeriods.day, cutoff), eq(sleepPeriods.type, "long_sleep")))
      .orderBy(sleepPeriods.day),
  ]);

  const person = personalInfoData[0] ?? null;

  const bedtimeData = tempData.map((t) => {
    const st = sleepTimeData.find((s) => s.day === t.day);
    let actualMinutes: number | null = null;
    if (t.bedtimeStart) {
      const d = new Date(t.bedtimeStart);
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(d);
      const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
      const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
      let mins = h * 60 + m;
      if (mins < 720) mins += 1440;
      actualMinutes = mins;
    }
    return {
      day: t.day,
      actualBedtime: actualMinutes,
      optimalStart: st?.optimalBedtimeStart ? Number(st.optimalBedtimeStart) / 60 : null,
      optimalEnd: st?.optimalBedtimeEnd ? Number(st.optimalBedtimeEnd) / 60 : null,
    };
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Private Data</h1>
      <PrivateTabs
        cvAgeData={cvAgeData.map((c) => ({ day: c.day, vascularAge: c.vascularAge }))}
        vo2Data={vo2Data.map((v) => ({ day: v.day, vo2Max: v.vo2Max }))}
        personalInfo={person ? { age: person.age, height: person.height, weight: person.weight, biologicalSex: person.biologicalSex } : null}
        tagData={tagData.map((t) => ({ day: t.day, tagTypeCode: t.tagTypeCode, comment: t.comment, startTime: t.startTime, endTime: t.endTime }))}
        restPeriods={restModeData.map((r) => ({ startDay: r.startDay ?? "", endDay: r.endDay ?? "" }))}
        cycleData={cycleData.map((c) => ({ cycleNumber: c.cycleNumber, periodStartDay: c.periodStartDay, ovulationDay: c.ovulationDay, nextPeriodDay: c.nextPeriodDay, cycleLength: c.cycleLength, confidence: c.confidence }))}
        temperatureData={tempData.map((t) => ({ day: t.day, temperatureDelta: t.temperatureDelta }))}
        bedtimeData={bedtimeData}
      />
    </div>
  );
}
