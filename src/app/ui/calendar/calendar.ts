import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import dayjs, { Dayjs } from 'dayjs';
import localeData from 'dayjs/plugin/localeData';
import 'dayjs/locale/it';
import 'dayjs/locale/en';
import { formatDate, parseDate } from '../../functions/date-utils';
import { eventsOnDay } from '../../functions/day-events';
import { CalendarDay } from '../../models/calendar-day.model';
import { StorageService } from '../../services/storage.service';

dayjs.extend(localeData);

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [TranslateModule, RouterLink],
  templateUrl: './calendar.html',
  styleUrls: ['./calendar.scss'],
})

export class CalendarComponent {


  // Dipendenze e valori iniziali usati dal calendario.
  private readonly storage = inject(StorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly today = dayjs();

  // Stato modificabile dalle azioni dell'utente e dal cambio di lingua.
  daysOfWeek: string[] = [];
  // Mese mostrato: letto dall'indirizzo (?month=YYYY-MM), altrimenti il mese corrente.
  currentDate = computed(() => {
    const month = parseDate(`${this.queryParams().get('month') ?? ''}-01`);
    return month ? dayjs(month) : this.today;
  });
  currentLang = signal<string>('');

  // Valori derivati: si aggiornano quando cambiano data, lingua o attività salvate.
  year = computed(() => this.currentDate().year());
  month = computed(() => this.currentDate().month());

  headerDescription = computed(() => {
    const title = this.currentDate().locale(this.currentLang()).format('MMMM YYYY');
    return title.charAt(0).toUpperCase() + title.slice(1);
  });

  // Giorni mostrati nella griglia, inclusi quelli dei mesi adiacenti.
  previousMonthDays = computed<CalendarDay[]>(() => {
    const currentYear = this.year();
    const currentMonth = this.month();

    const daysInPreviousMonth = dayjs().year(currentYear).month(currentMonth).date(0).date(); // Giorno 0: ultimo giorno del mese precedente.
    const firstDayOfMonth = dayjs().year(currentYear).month(currentMonth).date(1); // Primo giorno del mese corrente.
    const firstDayOfWeekIndex = (firstDayOfMonth.day() + 6) % 7; // Lunedì corrisponde a 0.

    return Array.from({ length: firstDayOfWeekIndex }, (_, i) => ({
      date: daysInPreviousMonth - (firstDayOfWeekIndex - 1 - i),
      month: currentMonth === 0 ? 11 : currentMonth - 1,
      year: currentMonth === 0 ? currentYear - 1 : currentYear,

      isToday: false,
      previousMonth: true,
      nextMonth: false
    }));
  });

  currentMonthDays = computed<CalendarDay[]>(() => {
    const currentYear = this.year();
    const currentMonth = this.month();
    const daysInCurrentMonth = dayjs().year(currentYear).month(currentMonth + 1).date(0).date(); // Giorno 0 del mese successivo: ultimo giorno del mese corrente.

    return Array.from({ length: daysInCurrentMonth }, (_, i) => {
      const date = i + 1;
      const isToday =
        date === this.today.date() &&
        currentMonth === this.today.month() &&
        currentYear === this.today.year();

      return {
        year: currentYear,
        month: currentMonth,
        date,
        currentMonth: true,
        isToday
      };
    });
  });

  nextMonthDays = computed<CalendarDay[]>(() => {
    const currentYear = this.year();
    const currentMonth = this.month();

    const previousDays = this.previousMonthDays();
    const currentDays = this.currentMonthDays();

    const totals = [...previousDays, ...currentDays];
    const missingDays = (7 - (totals.length % 7)) % 7;

    return Array.from({ length: missingDays }, (_, i) => ({
      year: currentMonth === 11 ? currentYear + 1 : currentYear,
      month: currentMonth === 11 ? 0 : currentMonth + 1,
      date: i + 1,
      isToday: false,
      previousMonth: false,
      nextMonth: true
    }));
  });

  calendarDays = computed<CalendarDay[]>(() => [
    ...this.previousMonthDays(),
    ...this.currentMonthDays(),
    ...this.nextMonthDays()
  ]);


  /** Imposta la lingua iniziale e ascolta i cambi di lingua dell'applicazione. */
  constructor(private translate: TranslateService) {
    this.updateLanguage(translate.getCurrentLang() || 'en');
    // takeUntilDestroyed interrompe l'ascolto della lingua quando Angular rimuove il calendario.
    translate.onLangChange.pipe(takeUntilDestroyed())
      .subscribe(event => this.updateLanguage(event.lang));
  }

  /** Aggiorna titolo e nomi dei giorni; è chiamato all'avvio e a ogni cambio di lingua. */
  private updateLanguage(lang: string): void {
    this.currentLang.set(lang);
    const weekdays = dayjs().locale(lang).localeData().weekdaysShort()
      .map(g => g.charAt(0).toUpperCase() + g.slice(1));
    this.daysOfWeek = [...weekdays.slice(1), weekdays[0]];
  }

  // Metodi di supporto usati dal template per rappresentare i giorni.

  /** Crea la rotta del dettaglio; è usato dal link del menu e dall'etichetta del giorno. */
  dayLink(day: CalendarDay): string[] {
    return ['/day', formatDate(new Date(day.year, day.month, day.date))];
  }

  /** Data leggibile del giorno (es. "giovedì 19 novembre 2026"); il template la usa come nome per lo screen reader. */
  dayLabel(day: CalendarDay): string {
    return dayjs(new Date(day.year, day.month, day.date)).locale(this.currentLang()).format('dddd D MMMM YYYY');
  }

  /** Indica se il giorno ha contenuti; il template lo usa per mostrare il segnalino. */
  hasContent(day: CalendarDay): boolean {
    const dateKey = this.dayLink(day)[1];
    const days = this.storage.days();
    return eventsOnDay(days, dateKey).length > 0 || (days[dateKey]?.extra.length ?? 0) > 0;
  }

  // Metodi richiamati dalle interazioni con il calendario.

  /** Mostra il mese precedente quando si preme la freccia sinistra. */
  previousMonth(): void {
    this.showMonth(this.currentDate().subtract(1, 'month'));
  }

  /** Mostra il mese successivo quando si preme la freccia destra. */
  nextMonth(): void {
    this.showMonth(this.currentDate().add(1, 'month'));
  }

  /** Scrive il mese nell'indirizzo; il calendario si aggiorna leggendolo da `currentDate`. */
  private showMonth(date: Dayjs): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { month: date.format('YYYY-MM') }, replaceUrl: true });
  }
}
