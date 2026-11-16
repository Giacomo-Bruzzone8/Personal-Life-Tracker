import { Component, ElementRef, HostListener, Injector, ViewChild, afterNextRender, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import dayjs from 'dayjs';
import { formatDate } from '../../functions/date-utils';
import { TimelineEvent } from '../../models/calendar-event.model';
import { EVENT_COLORS, eventTitle } from '../../models/event-presentation';
import { StorageService } from '../../services/storage.service';

type ActivityFormValue = ReturnType<DayActivityEditor['form']['getRawValue']>;

// Campi del form che alcuni tipi di attività rendono obbligatori.
type RequiredField = 'subject' | 'book' | 'author' | 'sport' | 'activity';

// Campi obbligatori per ciascun tipo di attività: unica fonte di verità per la validazione.
const REQUIRED_BY_TYPE: Record<TimelineEvent['type'], readonly RequiredField[]> = {
  Sleep: [],
  Work: [],
  Study: ['subject'],
  Reading: ['book', 'author'],
  Sport: ['sport'],
  FreeTime: [],
  CustomActivity: ['activity'],
};

// Tutti i campi che almeno un tipo rende obbligatori, ricavati da `REQUIRED_BY_TYPE`.
const REQUIRED_FIELDS = Object.values(REQUIRED_BY_TYPE).flat();

@Component({
  selector: 'app-day-activity-editor',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './day-activity-editor.html',
  styleUrl: './day-activity-editor.scss',
})
export class DayActivityEditor {
  private readonly storage = inject(StorageService);
  private readonly injector = inject(Injector);

  readonly date = input.required<Date>();
  readonly closed = output<void>();

  readonly dateKey = computed(() => formatDate(this.date()));// indicizza la data di input del calendario con il metodo `formatDate`
  readonly events = computed(() => this.storage.getDay(this.dateKey())?.timeline ?? []);// restituisce l'array di attività del giorno indicizzato
  readonly dayStart = computed(() => `${this.dateKey()}T00:00`);// mezzanotte iniziale del giorno scelto
  readonly dayEnd = computed(() => `${formatDate(dayjs(this.date()).add(1, 'day').toDate())}T00:00`);// mezzanotte del giorno successivo

  readonly types = Object.keys(EVENT_COLORS) as TimelineEvent['type'][];// ricava i tipi di attività legate al tempo
  readonly eventTitle = eventTitle; // ricava il titolo dell'attività
  readonly eventColors = EVENT_COLORS;// ricava i colori dei tipi di attività

  readonly form = new FormGroup(
  {
    type: new FormControl<TimelineEvent['type']>('Work', { nonNullable: true }),
    start: new FormControl('', { nonNullable: true, validators: Validators.required }),
    end: new FormControl('', { nonNullable: true, validators: Validators.required }),
    note: new FormControl('', { nonNullable: true }),
    dream: new FormControl('', { nonNullable: true }),
    subject: new FormControl('', { nonNullable: true }),
    goal: new FormControl('', { nonNullable: true }),
    book: new FormControl('', { nonNullable: true }),
    author: new FormControl('', { nonNullable: true }),
    sport: new FormControl('', { nonNullable: true }),
    workout: new FormControl('', { nonNullable: true }),
    hobby: new FormControl('', { nonNullable: true }),
    activity: new FormControl('', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
  });

  readonly selectedType = signal<TimelineEvent['type']>('Work');
  readonly editingEvent = signal<TimelineEvent | null>(null);
  readonly pendingDelete = signal<TimelineEvent | null>(null);
  readonly invalidFields = signal(false);
  readonly invalidInterval = signal(false);
  readonly savedMessage = signal<string | null>(null);

  // 5.1
  constructor()
  {
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe(type => {
      this.selectedType.set(type);
      this.updateRequiredFields(type);
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.invalidFields.set(false);
      this.invalidInterval.set(false);
      this.savedMessage.set(null);
    });
    effect(() => {
      this.dateKey();
      this.resetForm();
      this.pendingDelete.set(null);
    });
  }

  // 5.2
  trapFocus(event: Event): void
  {
    const window = event.currentTarget as HTMLElement;
    const focusable = window.querySelectorAll<HTMLElement>('button, input, select, textarea');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const shift = (event as KeyboardEvent).shiftKey;
    if (!shift && document.activeElement === last) { first.focus(); event.preventDefault(); }
    if (shift && document.activeElement === first) { last.focus(); event.preventDefault(); }
  }

  // 5.3
  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;
  ngAfterViewInit(): void
  {
    this.closeButton?.nativeElement.focus();
  }

  // 5.4
  @HostListener('document:keydown.escape')
  close(): void
  {
    this.closed.emit();
  }

  // 5.5
  timeLabel(value: string): string
  {
    return value.slice(0, 10) === this.dateKey() ? value.slice(11, 16) : '24:00';
  }

  // 5.6
  startNew(): void
  {
    this.resetForm();
    this.pendingDelete.set(null);
  }

  // 5.7
  edit(event: TimelineEvent): void
  {
    if (!this.events().includes(event)) return;
    this.resetForm();
    this.pendingDelete.set(null);
    this.editingEvent.set(event);
    this.form.patchValue({
      type: event.type,
      start: event.start,
      end: event.end,
      note: event.note ?? '',
    });

    switch (event.type) {
      case 'Sleep': 
        this.form.patchValue({ dream: event.dream ?? '' }); break;
      case 'Work': break; 
      case 'Study': 
        this.form.patchValue({ subject: event.subject, goal: event.goal ?? '' }); break;
      case 'Reading': 
        this.form.patchValue({ book: event.book, author: event.author }); break;
      case 'Sport': 
        this.form.patchValue({ sport: event.sport, workout: event.workout ?? '' }); break;
      case 'FreeTime': 
        this.form.patchValue({ hobby: event.hobby ?? '' }); break;
      case 'CustomActivity': 
        this.form.patchValue({ activity: event.activity, category: event.category ?? '' }); break;
    }
  }

  // 5.8
  resetForm(): void
  {
    this.editingEvent.set(null);
    this.invalidFields.set(false);
    this.invalidInterval.set(false);
    this.form.reset({ start: `${this.dateKey()}T${dayjs().format('HH:mm')}` });
  }

  // 5.9
  save(): void
  {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.invalidFields.set(true);
      return;
    }

    const value = this.form.getRawValue();
    if (!this.isValidInterval(value.start, value.end)) {
      this.invalidInterval.set(true);
      return;
    }

    const current = this.storage.getDay(this.dateKey());
    const timeline = [...(current?.timeline ?? [])];
    const editing = this.editingEvent();
    const overlaps = timeline.some(existing => existing !== editing
      && value.start < existing.end
      && value.end > existing.start);
    if (overlaps) {
      this.invalidInterval.set(true);
      return;
    }

    const event = this.toEvent(value);
    if (editing) {
      const index = timeline.indexOf(editing);
      if (index < 0) {
        this.resetForm();
        return;
      }
      timeline[index] = event;
    } else {
      timeline.push(event);
    }

    this.storage.saveDay({
      id: current?.id ?? `day-${this.dateKey()}`,
      date: this.dateKey(),
      timeline: timeline.sort((a, b) => a.start.localeCompare(b.start)),
      extra: current?.extra ?? [],
    });
    this.resetForm();
    this.savedMessage.set(editing ? 'DayActivityEditor.Updated' : 'DayActivityEditor.Added');
    setTimeout(() => this.savedMessage.set(null), 5000);
  }

  // 5.10
  cancelDelete(click: Event): void
  {
    const item = (click.currentTarget as HTMLElement).closest('li');
    this.pendingDelete.set(null);
    afterNextRender(() => item?.querySelector<HTMLElement>('.request-delete')?.focus(), { injector: this.injector });
  }

  // 5.11
  requestDelete(event: TimelineEvent): void
  {
    if (!this.events().includes(event)) return;
    this.resetForm();
    this.pendingDelete.set(event);
    afterNextRender(() => document.querySelector<HTMLElement>('.cancel-delete')?.focus(), { injector: this.injector });
  }

  // 5.12
  confirmDelete(event: TimelineEvent): void
  {
    if (this.pendingDelete() !== event) return;
    const current = this.storage.getDay(this.dateKey());
    const index = current?.timeline.indexOf(event) ?? -1;
    if (current && index >= 0) {
      this.storage.saveDay({
        ...current,
        timeline: current.timeline.filter((_, eventIndex) => eventIndex !== index),
      });
    }
    this.pendingDelete.set(null);
    afterNextRender(() => document.querySelector<HTMLElement>('.recorded-title')?.focus(), { injector: this.injector });
  }

  // 5.13
  private updateRequiredFields(type: TimelineEvent['type']): void
  {
    const required = REQUIRED_BY_TYPE[type];

    for (const field of REQUIRED_FIELDS)
    {
      const control = this.form.controls[field];
      control.setValidators(required.includes(field) ? [Validators.required, Validators.pattern(/\S/)] : []);
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  // 5.14
  private isValidInterval(start: string, end: string): boolean
  {
    const format = 'YYYY-MM-DDTHH:mm';
    const startTime = dayjs(start);
    const endTime = dayjs(end);
    return startTime.isValid() && endTime.isValid()
      && startTime.format(format) === start && endTime.format(format) === end
      && !startTime.isBefore(this.dayStart()) && !endTime.isAfter(this.dayEnd())
      && endTime.isAfter(startTime);
  }

  // 5.15
  private toEvent(value: ActivityFormValue): TimelineEvent
  {
    const note = value.note.trim();
    const interval = { start: value.start, end: value.end, ...(note ? { note } : {}) };
    switch (value.type) {
      case 'Sleep': return { ...interval, type: 'Sleep', ...(value.dream.trim() ? { dream: value.dream.trim() } : {}) };
      case 'Work': return { ...interval, type: 'Work' };
      case 'Study': return { ...interval, type: 'Study', subject: value.subject.trim(), ...(value.goal.trim() ? { goal: value.goal.trim() } : {}) };
      case 'Reading': return { ...interval, type: 'Reading', book: value.book.trim(), author: value.author.trim() };
      case 'Sport': return { ...interval, type: 'Sport', sport: value.sport.trim(), ...(value.workout.trim() ? { workout: value.workout.trim() } : {}) };
      case 'FreeTime': return { ...interval, type: 'FreeTime', ...(value.hobby.trim() ? { hobby: value.hobby.trim() } : {}) };
      case 'CustomActivity': return { ...interval, type: 'CustomActivity', activity: value.activity.trim(), ...(value.category.trim() ? { category: value.category.trim() } : {}) };
      default: throw new Error('Unsupported activity type');
    }
  }
}
