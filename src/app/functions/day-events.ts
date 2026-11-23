import dayjs from 'dayjs';
import { DayDetail, TimelineEvent } from '../models/calendar-event.model';
import { formatDate } from './date-utils';

// Attività che occupano almeno un minuto del giorno `dateKey` (formato YYYY-MM-DD):
// quelle salvate in quel giorno e quelle del giorno prima che finiscono dopo la sua mezzanotte.
export function eventsOnDay(days: Record<string, DayDetail>, dateKey: string): TimelineEvent[] {
  const previousKey = formatDate(dayjs(dateKey).subtract(1, 'day').toDate());
  const fromPreviousDay = (days[previousKey]?.timeline ?? []).filter(event => event.end > `${dateKey}T00:00`);
  const ownEvents = days[dateKey]?.timeline ?? [];
  return [...fromPreviousDay, ...ownEvents];
}
