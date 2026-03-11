export function getTodayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

export function getNowET(): Date {
  const etStr = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  return new Date(etStr);
}
