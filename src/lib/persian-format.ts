const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "long",
  timeZone: "Asia/Tehran",
});
const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

export function formatPersianNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatPersianDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function formatPersianDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function formatToman(value: number) {
  return `${formatPersianNumber(value)} تومان`;
}
