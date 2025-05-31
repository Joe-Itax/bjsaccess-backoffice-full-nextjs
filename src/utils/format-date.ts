import {
  format,
  isToday,
  isYesterday,
  differenceInDays,
  setDefaultOptions,
} from "date-fns";
import { fr } from "date-fns/locale";

export function formatDate(dateInput: string | Date): string {
  setDefaultOptions({ locale: fr, weekStartsOn: 1 });
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();

  if (isToday(date)) {
    return format(date, "HH:mm");
  }

  if (isYesterday(date)) {
    return "hier";
  }

  const daysDiff = differenceInDays(now, date);
  if (daysDiff < 7) {
    return format(date, "EEEE");
  }

  return format(date, "dd/MM/yyyy");
}
