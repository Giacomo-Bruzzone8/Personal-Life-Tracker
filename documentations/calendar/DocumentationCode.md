# Calendar — code documentation

## 1. The component at a glance

Shows a month as a grid of whole weeks, from Monday to Sunday, including
the days of the previous and next month that complete the first and last week.
Each day is a link to its detail page, where its activities are managed.
The shown month is read from the address (`?month=YYYY-MM`): the arrows in the
header change it, and going back from a day returns to the same month.
A dot marks the days with recorded content, including activities started
the day before that continue past midnight.
The calendar reads the data through `StorageService` but never changes it.
It is designed to be usable with the keyboard and with a screen reader: the grid
takes a single Tab stop, the arrow keys move between days and every day has a readable name.
It appears on the calendar page and on the home page.

## 2. Libraries and imports

### Angular — `@angular/core`
| Import | What it is used for here |
|---|---|
| `Component` | Declares the class as an Angular component (selector, template, styles). |
| `signal`, `computed` | Reactive state of the calendar and values derived from the shown month (e.g. `currentDate`, `calendarDays`). |
| `inject` | Obtains the required services (`StorageService`, `ActivatedRoute`, `Router`, `Injector`). |
| `Injector` | Needed by `afterNextRender` when it is called inside a method. |
| `afterNextRender` | Runs code after Angular has updated the page (moving the focus with the arrow keys). |

### Angular — `@angular/core/rxjs-interop`
| Import | What it is used for here |
|---|---|
| `toSignal` | Turns the address parameters into a signal, so the calendar updates when `?month=` changes. |
| `takeUntilDestroyed` | Stops listening to language changes when the calendar is removed. |

### Angular — `@angular/router`
| Import | What it is used for here |
|---|---|
| `ActivatedRoute` | Gives access to the address parameters of the page that contains the calendar. |
| `Router` | Changes the address when the month changes. |
| `RouterLink` | Turns each cell into a link to the day detail page. |

### Translations — `@ngx-translate/core`
| Import | What it is used for here |
|---|---|
| `TranslateModule` | Makes the `translate` pipe available in the template for Italian and English texts. |
| `TranslateService` | Provides the current language and signals its changes. |

### Dates — `dayjs`
| Import | What it is used for here |
|---|---|
| `dayjs`, `Dayjs` | Date calculations (first of the month, days to add, comparisons) and writing dates as text; `Dayjs` is the type of a `dayjs` date. |
| `dayjs/plugin/localeData` | Adds to `dayjs` the short names of the weekdays in the chosen language. |
| `dayjs/locale/it`, `dayjs/locale/en` | Month and day names in Italian and English. |

### Project files
| Import | From | What it is used for here |
|---|---|---|
| `formatDate`, `parseDate` | `functions/date-utils` | Turn a date into the `YYYY-MM-DD` text and back, checking that it is valid. |
| `eventsOnDay` | `functions/day-events` | Returns the activities of a day, including those started the day before. |
| `CalendarDay` | `models/calendar-day.model` | Type describing a grid cell (day, month, year and states). |
| `StorageService` | `services/storage.service` | Provides the saved days, to know which days have content. |

## 3. Code blocks

### 1.1 — currentDate

```ts
currentDate = computed(() => {
  const month = parseDate(`${this.queryParams().get('month') ?? ''}-01`);
  return month ? dayjs(month) : this.today;
});
```

**Purpose**
Gives the month shown by the calendar, read from the page address.
It is the starting point of all the other calculations: title, grid and arrows.

**When it is called**
It is a `computed`: Angular recalculates it by itself every time the address changes
(`queryParams`). It is read by `focusDay` (1.2), `headerDescription` (1.3),
`calendarDays` (1.4), the month arrows (1.11) and `moveFocus` (1.12).

**How it works**
1. `queryParams` is a signal with the address parameters (the part after `?`),
   obtained with `toSignal` from `ActivatedRoute`.
2. `get('month')` reads the month, for example `2027-03`; if it is missing, `?? ''` uses an empty text.
3. `-01` is appended to the month to get the first day (`2027-03-01`), and
   `parseDate` checks that it is a valid date.
4. If it is valid, `currentDate` is that date as a `dayjs` date; otherwise it is `today`,
   that is, the current month.

**Notes**
- Keeping the month in the address means that the browser's "back" button and the
  "‹ Calendar" link of the day page return to the same month.
- An address typed by hand with an invalid month (e.g. `?month=foo`) causes no
  error: the current month is shown.
- `currentDate` is never set directly: to change month, the address is changed
  with `showMonth` (1.13).

### 1.2 — focusDay

```ts
focusDay = computed(() => {
  const first = this.currentDate().startOf('month');
  const active = this.activeDay();
  if (active?.startsWith(first.format('YYYY-MM'))) return active;
  return (this.today.isSame(first, 'month') ? this.today : first).format('YYYY-MM-DD');
});
```

**Purpose**
Decides which day of the grid is reached with the Tab key. All the other days
are reached with the arrow keys, so the grid takes a single Tab stop.

**When it is called**
It is a `computed`: Angular recalculates it when the shown month (`currentDate`, 1.1)
or the day reached with the arrow keys (`activeDay`) changes. It is read by the template,
in the `tabindex` of each cell.

**How it works**
1. `first` is the first day of the shown month.
2. `active` is the last day reached with the arrow keys (`activeDay`, updated by
   `moveFocus`, 1.12), or `null` if the arrow keys have not been used yet.
3. If `active` belongs to the shown month (it starts with the same `YYYY-MM`),
   Tab goes there.
4. Otherwise Tab goes to today, if today is in the shown month, or to the first of the month.
5. The result is a date in the `YYYY-MM-DD` format, the same used by `dayKey` (1.7).

**Notes**
- In the template, the cell with `dayKey(day) === focusDay()` gets `tabindex="0"`,
  which makes it reachable with Tab; all the others get `tabindex="-1"`,
  which removes them from the Tab path but keeps them clickable and reachable with the arrow keys.
- After a month change with the header arrows, `activeDay` belongs to the previous
  month: this is why the check in point 3 makes Tab fall back to today or to the first.
- It is the pattern recommended by the accessibility guidelines for date grids.

### 1.3 — headerDescription

```ts
headerDescription = computed(() => {
  const title = this.currentDate().locale(this.currentLang()).format('MMMM YYYY');
  return title.charAt(0).toUpperCase() + title.slice(1);
});
```

**Purpose**
Returns the title of the shown month, in the app language (e.g. "November 2026").

**When it is called**
It is a `computed`: Angular recalculates it when the shown month (`currentDate`, 1.1)
or the language (`currentLang`) changes. It is read by the template, in the title between the two arrows.

**How it works**
1. `locale(this.currentLang())` writes the date in the current language.
2. `format('MMMM YYYY')` produces the month name and the year (e.g. "novembre 2026").
3. The first letter is capitalised: in Italian `dayjs` writes months in lower case.

**Notes**
- The language applies only to this date: the global `dayjs` setting is not
  touched, so the behaviour of the other components does not depend on the calendar.
- In the template the title has `aria-live="polite"`: when the month changes, the screen reader
  announces the new title.

### 1.4 — calendarDays

```ts
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
```

**Purpose**
Builds the list of the grid cells: whole weeks from Monday to Sunday,
including the days of the previous and next month that complete the first and last week.

**When it is called**
It is a `computed`: Angular recalculates it when the shown month (`currentDate`, 1.1) changes.
It is read by the template, in the `@for` that draws the cells.

**How it works**
1. `firstOfMonth` is the first day of the shown month.
2. `leadingDays` counts the days of the previous month to show before the first.
   `day()` returns 0 for Sunday; `(day() + 6) % 7` shifts the numbering
   so that Monday is 0 and Sunday is 6.
3. `totalCells` adds those days to the days of the month and rounds up to the next
   whole week (a multiple of 7): the grid has 5 or 6 rows.
4. For each cell `i`, `date` is obtained by starting from the first of the month and moving
   `i - leadingDays` days: the first cells go back into the previous month,
   the last ones forward into the next month.
5. For each day, year, month and number are taken from `date`, together with the states used by the template:
   - `currentMonth`: the day belongs to the shown month;
   - `previousMonth` / `nextMonth`: the day is before or after the shown month;
   - `isToday`: the day is today, only if it belongs to the shown month.

**Notes**
- `dayjs` handles month and year changes by itself (e.g. from December to January):
  no manual calculations are needed.
- The states drive the style (`[class.previous-month]`, `[class.today]`…) and the name
  read by the screen reader (`dayLabel`, 1.9).
- `isToday` applies only to the shown month: this way today is highlighted only once,
  even when it appears among the days of an adjacent month.

### 1.5 — constructor()

```ts
constructor(private translate: TranslateService) {
  this.updateLanguage(translate.getCurrentLang() || 'en');
  // takeUntilDestroyed interrompe l'ascolto della lingua quando Angular rimuove il calendario.
  translate.onLangChange.pipe(takeUntilDestroyed())
    .subscribe(event => this.updateLanguage(event.lang));
}
```

**Purpose**
Sets the initial language of the calendar and keeps it updated when the user
changes language.

**When it is called**
Only once, by Angular, when the calendar is created.

**How it works**
1. `translate.getCurrentLang()` reads the current language of the app; if it is not set yet,
   English is used. `updateLanguage` (1.6) applies it to the calendar.
2. `translate.onLangChange` signals every language change: on each signal
   `updateLanguage` updates the calendar again.
3. `takeUntilDestroyed()` stops listening when the calendar is removed
   (for example when a day page is opened), so it does not stay active in memory.

**Notes**
- `takeUntilDestroyed()` only works inside the `constructor`, because that is where Angular
  knows which component to attach it to.

### 1.6 — updateLanguage(lang)

```ts
private updateLanguage(lang: string): void {
  this.currentLang.set(lang);
  const weekdays = dayjs().locale(lang).localeData().weekdaysShort()
    .map(g => g.charAt(0).toUpperCase() + g.slice(1));
  this.daysOfWeek = [...weekdays.slice(1), weekdays[0]];
}
```

**Purpose**
Applies a language to the calendar: it updates the language used for dates and the short
names of the weekdays in the grid header.

**When it is called**
Only from inside the component (`private`): from the `constructor` (1.5), at startup
and on every language change.

**How it works**
1. `currentLang.set(lang)` updates the language signal: the month title (1.3)
   and the day names read by the screen reader (1.9) are recalculated by themselves.
2. `localeData().weekdaysShort()` returns the short names of the days in the chosen
   language (e.g. "Sun", "Mon"…); each name is capitalised.
3. `dayjs` lists the days starting from Sunday: `[...weekdays.slice(1), weekdays[0]]`
   moves Sunday to the end, so the header starts on Monday like the grid.

**Notes**
- `localeData()` is available thanks to the `dayjs/plugin/localeData` plugin, enabled
  at the top of the file with `dayjs.extend(localeData)`.
- `daysOfWeek` is a plain field, not a signal: the template redraws it together
  with `currentLang`, which changes at the same moment.

### 1.7 — dayKey(day)

```ts
dayKey(day: CalendarDay): string {
  return formatDate(new Date(day.year, day.month, day.date));
}
```

**Purpose**
Returns the date of a cell in the `YYYY-MM-DD` format (e.g. `2026-11-19`):
it is the key used for data, links and focus.

**When it is called**
- from the template, in the `data-date` and `tabindex` attributes of each cell;
- from `dayLink` (1.8) and `hasContent` (1.10).

**How it works**
1. `new Date(day.year, day.month, day.date)` creates the date of the cell.
2. `formatDate` turns it into the `YYYY-MM-DD` text.

**Notes**
- It is the same format in which the days are saved in `StorageService`
  and in which they appear in the address of the day page (`/day/2026-11-19`).
- It gathers in one place a conversion needed in several parts of the calendar.

### 1.8 — dayLink(day)

```ts
dayLink(day: CalendarDay): string[] {
  return ['/day', this.dayKey(day)];
}
```

**Purpose**
Returns the address of the detail page of a day.

**When it is called**
From the template, with `[routerLink]="dayLink(day)"` on each cell.

**How it works**
Returns a list with the `/day` path and the date of the cell (1.7):
`RouterLink` turns it into the address `/day/2026-11-19`.

**Notes**
- It is also used by an existing test (`app.routes.spec.ts`), which checks dates
  across the turn of the year (e.g. 1 January and 31 December).

### 1.9 — dayLabel(day)

```ts
dayLabel(day: CalendarDay): string {
  return dayjs(new Date(day.year, day.month, day.date)).locale(this.currentLang()).format('dddd D MMMM YYYY');
}
```

**Purpose**
Returns the date of a cell written in full, in the app language
(e.g. "Thursday 19 November 2026"). It is the name the screen reader reads for the day.

**When it is called**
From the template, in the `aria-label` of each cell.

**How it works**
1. Creates the date of the cell and writes it in the current language (`currentLang`).
2. `format('dddd D MMMM YYYY')` produces weekday, number, month and year.

**Notes**
- In the template "Today" (if `day.isToday`) and "Recorded content"
  (if `hasContent`, 1.10) are added to the name, taken from the legend translations.
- The weekday matters for blind users: the cells are not linked to the header
  with the weekday names, so there is no other way to know it.
- The name updates by itself when the language changes, because it reads the `currentLang` signal.

### 1.10 — hasContent(day)

```ts
hasContent(day: CalendarDay): boolean {
  const dateKey = this.dayKey(day);
  const days = this.storage.days();
  return eventsOnDay(days, dateKey).length > 0 || (days[dateKey]?.extra.length ?? 0) > 0;
}
```

**Purpose**
Tells whether a day has recorded content: timed activities or other
information (notes, expenses, reminders…).

**When it is called**
From the template, for each cell:
- to show the dot under the number;
- to add "Recorded content" to the name read by the screen reader.

**How it works**
1. `dateKey` is the date of the cell (1.7); `days` are all the saved days.
2. `eventsOnDay` returns the activities that touch that day, including those
   started the day before that continue past midnight.
3. `days[dateKey]?.extra` is the information without a time saved on that day;
   `?? 0` covers a day without data.
4. The day has content if there is at least one activity or at least one piece of information.

**Notes**
- `storage.days()` is a signal: when an activity is saved or deleted, the dot
  updates by itself.
- The calendar does not know the midnight rule: it is applied by `eventsOnDay`,
  the same function used by the day page and by the activity window.
- Looking ahead to a database: this question ("does the day have content?") could become
  a single request for the whole month, instead of a check for each cell.

### 1.11 — previousMonth() / nextMonth()

```ts
previousMonth(): void {
  this.showMonth(this.currentDate().subtract(1, 'month'));
}

nextMonth(): void {
  this.showMonth(this.currentDate().add(1, 'month'));
}
```

**Purpose**
Show the previous or the next month.

**When it is called**
From the template, with the two arrows on the sides of the month title (`(click)`).

**How it works**
1. They start from the shown month (`currentDate`, 1.1) and subtract or add one month.
2. `showMonth` (1.13) writes the new month in the address: the calendar updates
   by reading it from there.

**Notes**
- The arrows have a translated `aria-label` ("Previous month", "Next month"),
  because their symbol (❮ ❯) would have no name for the screen reader.

### 1.12 — moveFocus(event, day)

```ts
moveFocus(event: KeyboardEvent, day: CalendarDay): void {
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  const step = steps[event.key];
  if (!step) return;
  event.preventDefault();

  const target = dayjs(new Date(day.year, day.month, day.date)).add(step, 'day');
  const key = target.format('YYYY-MM-DD');
  this.activeDay.set(key);
  // Dopo l'aggiornamento della griglia, dà il focus alla cella del giorno raggiunto.
  const focus = () => afterNextRender(() => document.querySelector<HTMLElement>(`.calendar-cell[data-date="${key}"]`)?.focus(), { injector: this.injector });
  if (target.isSame(this.currentDate(), 'month')) focus();
  else this.showMonth(target).then(focus);
}
```

**Purpose**
Lets the user move between days with the arrow keys: one day with
← and →, one week with ↑ and ↓. If the day reached is in another month,
the calendar switches to that month.
Designed for accessibility: together with `focusDay` (1.2), it makes the grid take
a single Tab stop, instead of one for each day.

**When it is called**
From the template, with `(keydown)="moveFocus($event, day)"`: on every key pressed while
the focus is on a cell.

**How it works**
1. `steps` maps each arrow key to the movement in days. If the key is not an
   arrow (e.g. Enter or Tab), the method stops and the key does its normal job:
   Enter opens the day.
2. `event.preventDefault()` prevents the arrow key from scrolling the page.
3. `target` is the day reached; `key` is its `YYYY-MM-DD` date.
4. `activeDay` remembers the day reached: `focusDay` (1.2) makes it the cell
   reachable with Tab.
5. `focus` gives focus to the cell whose `data-date` equals `key`. It uses `afterNextRender`,
   which waits for Angular to update the grid.
6. If the day reached is in the shown month, the focus moves straight away. Otherwise
   the month is changed first with `showMonth` (1.13) and, once the navigation is done (`.then`),
   the focus is moved.

**Notes**
- `injector` is needed by `afterNextRender` because it is called inside a method
  and not in the `constructor`.
- Examples: from 1 November, ← goes to October with the focus on the 31st; from 30 November,
  ↓ goes to December with the focus on the 7th.
- Screen readers have their own reading mode with the arrow keys, in which they read
  the cells without going through this method: for them all the days stay reachable.
  The full benefit is for keyboard-only users.

### 1.13 — showMonth(date)

```ts
private showMonth(date: Dayjs): Promise<boolean> {
  return this.router.navigate([], { relativeTo: this.route, queryParams: { month: date.format('YYYY-MM') }, replaceUrl: true });
}
```

**Purpose**
Shows the month of a date by writing it in the address (`?month=YYYY-MM`).
The calendar does not change month directly: it updates by reading the address
through `currentDate` (1.1).

**When it is called**
Only from inside the component (`private`): from the month arrows (1.11)
and from `moveFocus` (1.12), when the day reached is in another month.

**How it works**
1. `router.navigate([], ...)` changes the address while staying on the same page
   (`relativeTo: this.route`): only the `month` parameter changes.
2. `replaceUrl: true` replaces the address instead of adding a new one to the
   browser history.
3. It returns the navigation `Promise`, that is, a value that "completes" when
   the address change is finished: `moveFocus` uses it to move the focus at the right moment.

**Notes**
- Thanks to `replaceUrl`, "back" from the calendar goes to the previous page,
  instead of going through the browsed months one by one.
- It also works on the home page: there the address becomes `/?month=2027-03`.
