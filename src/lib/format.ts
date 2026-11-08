// UTC formatting keeps server and browser output identical (no hydration drift).
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const shortFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatShort = (iso: string) => shortFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => `${timeFmt.format(new Date(iso))} UTC`;
export const formatMonthYear = (iso: string) => monthYear.format(new Date(iso));
