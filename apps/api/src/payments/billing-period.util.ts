// Mirrors the periodicity values this app actually sells (see
// BILLING_PERIODICITIES in @sundera/shared) — Subscription.periodicity is
// stored as a raw string, not a Prisma enum, so this stays defensive about
// unrecognized values rather than assuming the shared union is exhaustive.
export function addBillingPeriod(start: Date, periodicity: string): Date {
  const end = new Date(start);
  if (periodicity === 'PERIOD_YEAR') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}
