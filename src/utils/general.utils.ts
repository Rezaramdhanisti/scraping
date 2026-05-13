export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function toStartOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function diffDays(start: Date, end: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor(
    (toStartOfDay(end).getTime() - toStartOfDay(start).getTime()) / msPerDay,
  );
}

/**
 * Check-in harus lebih dari 7 hari dari hari ini: jarak kalender today → check_in minimal 8 hari
 * (hari ini = 0, besok = 1, … hari ke-8 = pertama yang diizinkan).
 * Stay 1–3 malam; check-out ≤ ~1 bulan dari hari ini.
 */
export function pickRandomTiktokStayDatesStressStyle(): {
  check_in: string;
  check_out: string;
} {
  const MIN_DAYS_BEFORE_CHECK_IN = 8;
  const today = toStartOfDay(new Date());
  const oneMonthAhead = toStartOfDay(addMonths(today, 1));
  const maxCheckInDate = addDays(oneMonthAhead, -1);
  const earliestCheckIn = addDays(today, MIN_DAYS_BEFORE_CHECK_IN);
  const checkInSpan = diffDays(earliestCheckIn, maxCheckInDate);
  const checkInDate =
    checkInSpan < 0
      ? toStartOfDay(maxCheckInDate)
      : addDays(earliestCheckIn, randomInt(0, checkInSpan));

  const minCheckOutDate = addDays(checkInDate, 1);
  const maxCheckOutByStay = addDays(checkInDate, 3);
  const maxCheckOutDate =
    maxCheckOutByStay < oneMonthAhead ? maxCheckOutByStay : oneMonthAhead;
  const checkOutRangeDays = Math.max(0, diffDays(minCheckOutDate, maxCheckOutDate));
  let checkOutDate = addDays(
    minCheckOutDate,
    randomInt(0, checkOutRangeDays),
  );

  // Jamin check-out minimal 1 hari setelah check-in (antisipasi edge case kalendar/DST).
  if (diffDays(checkInDate, checkOutDate) < 1) {
    checkOutDate = addDays(toStartOfDay(checkInDate), 1);
  }

  return {
    check_in: formatYmd(checkInDate),
    check_out: formatYmd(checkOutDate),
  };
}
