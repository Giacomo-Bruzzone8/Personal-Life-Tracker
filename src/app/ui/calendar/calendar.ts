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
  headerDescription = computed(() => {
    const title = this.currentDate().locale(this.currentLang()).format('MMMM YYYY');
    return title.charAt(0).toUpperCase() + title.slice(1);
  });

  // Giorni mostrati nella griglia: settimane intere da lunedì a domenica, inclusi i giorni dei mesi adiacenti.
  calendarDays = computed<CalendarDay[]>(() => {
    const firstOfMonth = this.currentDate().startOf('month');
    const leadingDays = (firstOfMonth.day() + 6) % 7; // Giorni del mese precedente prima del primo: lunedì corrisponde a 0.
    const totalCells = Math.ceil((leadingDays + firstOfMonth.daysInMonth()) / 7) * 7; // Settimane intere.

    return Array.from({ length: totalCells }, (_, i) => {
      const date = firstOfMonth.add(i - leadingDays, 'day');
      const currentMonth = date.month() === firstOfMonth.month();
      return {
        year: date.year(),
        month: date.month(),
        date: date.date(),
        previousMonth: !currentMonth && i < leadingDays,
        currentMonth,
        nextMonth: !currentMonth && i >= leadingDays,
        isToday: currentMonth && date.isSame(this.today, 'day'),
      };
    });
  });


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
    const dateKey = formatDate(new Date(day.year, day.month, day.date));
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
