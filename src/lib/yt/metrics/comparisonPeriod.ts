import { Period } from "@prisma/client";
import { db } from "@/lib/yt/db";

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const TOLERANCE_DAYS = 20;

/**
 * Finds the sibling Period (same channel) that best matches the implied
 * comparison range. "Período anterior" / "año anterior" are resolved
 * against other Periods the team has already created and loaded data
 * for — this app never synthesizes comparison numbers out of thin air.
 */
export async function resolveComparisonPeriod(period: Period): Promise<Period | null> {
  if (period.comparisonMode === "NONE") return null;

  if (period.comparisonMode === "CUSTOM") {
    if (!period.comparePeriodId) return null;
    return db.period.findUnique({ where: { id: period.comparePeriodId } });
  }

  const lengthDays = daysBetween(period.startDate, period.endDate) + 1;
  let targetStart: Date;
  let targetEnd: Date;

  if (period.comparisonMode === "YEAR_OVER_YEAR") {
    targetStart = new Date(period.startDate);
    targetStart.setUTCFullYear(targetStart.getUTCFullYear() - 1);
    targetEnd = new Date(period.endDate);
    targetEnd.setUTCFullYear(targetEnd.getUTCFullYear() - 1);
  } else {
    // PREVIOUS_PERIOD: same length, ending the day before this period starts.
    targetEnd = new Date(period.startDate);
    targetEnd.setUTCDate(targetEnd.getUTCDate() - 1);
    targetStart = new Date(targetEnd);
    targetStart.setUTCDate(targetStart.getUTCDate() - (lengthDays - 1));
  }

  const siblings = await db.period.findMany({ where: { channelId: period.channelId, id: { not: period.id } } });

  let best: Period | null = null;
  let bestScore = Infinity;
  for (const sibling of siblings) {
    const score = Math.abs(daysBetween(targetStart, sibling.startDate)) + Math.abs(daysBetween(targetEnd, sibling.endDate));
    if (score < bestScore) {
      bestScore = score;
      best = sibling;
    }
  }

  return best && bestScore <= TOLERANCE_DAYS ? best : null;
}
