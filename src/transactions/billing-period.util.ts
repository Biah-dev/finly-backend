function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function closeDateForMonth(
  year: number,
  month: number,
  billingCycleDay: number,
): Date {
  const day = Math.min(billingCycleDay, daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

// The statement a transaction belongs to closes on the first occurrence of
// `billingCycleDay` on or after the transaction's date.
export function billPeriodEnd(
  transactionDate: Date,
  billingCycleDay: number,
): Date {
  const year = transactionDate.getUTCFullYear();
  const month = transactionDate.getUTCMonth();
  const closeThisMonth = closeDateForMonth(year, month, billingCycleDay);

  if (transactionDate.getUTCDate() <= closeThisMonth.getUTCDate()) {
    return closeThisMonth;
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;
  return closeDateForMonth(nextMonthYear, nextMonth, billingCycleDay);
}

export function billPeriodStart(
  periodEnd: Date,
  billingCycleDay: number,
): Date {
  const month = periodEnd.getUTCMonth();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear =
    month === 0 ? periodEnd.getUTCFullYear() - 1 : periodEnd.getUTCFullYear();
  const prevClose = closeDateForMonth(
    prevMonthYear,
    prevMonth,
    billingCycleDay,
  );

  const start = new Date(prevClose);
  start.setUTCDate(start.getUTCDate() + 1);
  return start;
}
