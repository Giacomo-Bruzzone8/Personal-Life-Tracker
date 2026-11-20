# DayActivityEditor — code documentation

## 1. The component at a glance

Modal window that the calendar opens from the "Manage activities" item in a day's menu.
It lets the user add, edit and delete the time-based activities of that day
(Sleep, Work, Study, Reading, Sport, Free time, Custom activity).
Each activity takes up a time interval (start and end): this interval is what allows
the circular timeline to draw the time taken up during the day.
Before saving, it checks the required fields of the chosen type, that start and end
are different and that the activity does not overlap with others.
An activity can continue past midnight: in that case it ends the next day.
It is saved in the day it starts, but it also appears in the list of the day it
ends and can be edited or deleted from both days.
Data is read and saved through `StorageService`.
It is designed to be usable with the keyboard and with a screen reader.

## 2. Libraries and imports

### Angular — `@angular/core`
| Import | What it is used for here |
|---|---|
| `Component` | Declares the class as an Angular component (selector, template, styles). |
| `input`, `output` | Receive the day from the calendar (`date`) and notify it of the closing (`closed`). |
| `signal`, `computed` | Reactive state of the window and values derived from the date (e.g. `dateKey`, `events`, `startDay`). |
| `effect` | Resets the form every time the day changes. |
| `inject` | Obtains the required services (`StorageService`, `Injector`). |
| `Injector` | Needed by `afterNextRender` when it is called inside a method. |
| `afterNextRender` | Runs code after Angular has updated the page (focus management). |
| `ViewChild`, `ElementRef` | Reach the close button in the template to give it focus. |
| `HostListener` | Closes the window when Esc is pressed. |

### Angular — `@angular/core/rxjs-interop`
| Import | What it is used for here |
|---|---|
| `takeUntilDestroyed` | Stops listening to the form when the window is closed, avoiding wasted memory. |

### Angular — `@angular/forms`
| Import | What it is used for here |
|---|---|
| `FormGroup`, `FormControl` | Build the typed form with all the activity fields. |
| `Validators` | Validation rules (required fields, non-empty text). |
| `ReactiveFormsModule` | Connects the TypeScript form to the HTML fields (`formGroup`, `formControlName`). |

### Translations — `@ngx-translate/core`
| Import | What it is used for here |
|---|---|
| `TranslateModule` | Makes the `translate` pipe available in the template for Italian and English texts. |

### Dates — `dayjs`
| Import | What it is used for here |
|---|---|
| `dayjs` | Reads the current time (`resetForm`) and calculates the dates of the neighbouring days (`shiftDay`). |

### Project files
| Import | From | What it is used for here |
|---|---|---|
| `formatDate` | `functions/date-utils` | Turns a `Date` into the `YYYY-MM-DD` text used as the day key. |
| `TimelineEvent` | `models/calendar-event.model` | Type describing a time-based activity and its 7 types. |
| `EVENT_COLORS`, `eventTitle` | `models/event-presentation` | Colour of each activity type and title to show in the list. |
| `StorageService` | `services/storage.service` | Reads and saves the days with their activities. |

## 3. Code blocks

### 5.1 — constructor()

```ts
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
```

**Purpose**
Sets up the automatic behaviours of the window as soon as it is created:
it reacts to the change of activity type, hides the errors when the user
edits a field and resets the form every time the day changes.

**When it is called**
Only once, by Angular, when the calendar opens the window.

**How it works**
1. **Change of activity type**
   `form.controls.type.valueChanges` emits a value every time the type
   drop-down changes. On each change:
   - `selectedType` is updated, and the template shows the fields of that type;
   - `updateRequiredFields(type)` makes the fields listed in `REQUIRED_BY_TYPE` required.
2. **Change of any field**
   `form.valueChanges` emits on every change of the form. On each change
   `invalidFields` and `invalidInterval` go back to `false` and `savedMessage` goes back to `null`:
   the error messages and the save notice disappear as soon as the user
   edits the form.
3. **Change of day**
   `effect` re-runs its content every time a signal read inside it changes.
   It reads `dateKey()`, so it runs again when the window opens and for every new day passed by the calendar. Then:
   - `resetForm()` clears the form and sets the current time of the chosen day as the start;
   - `pendingDelete` goes back to `null`, closing any open delete confirmation.

**Notes**
- `takeUntilDestroyed()` automatically stops listeners 1 and 2
  when the window is closed, so they do not stay active in memory.
- The required fields of the initial type are set thanks to point 3:
  `resetForm()` sets the type `Work`, this triggers point 1
  and therefore `updateRequiredFields`.

### 5.2 — trapFocus(event)

```ts
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
```

**Purpose**
Keeps the focus inside the window while it is open: Tab on the last element
goes back to the first, Shift+Tab on the first goes to the last.
Designed for accessibility, in particular for blind users: those who use a
screen reader or only the keyboard do not leave the window without noticing.

**When it is called**
From the template, on the `<section role="dialog">`:
`(keydown.tab)` and `(keydown.shift.tab)`. Angular distinguishes the two keys,
which is why both are needed.

**How it works**
1. `event.currentTarget` is the window that received the key.
2. `querySelectorAll('button, input, select, textarea')` collects the elements
   reachable with Tab, in the order they appear on the page.
3. `first` and `last` are the first (× button) and the last element of the list.
4. `shiftKey` tells whether Shift is pressed, that is, whether the user is moving backwards.
5. Moving forward from the last element, the focus goes to the first; moving backwards
   from the first, it goes to the last.
6. `event.preventDefault()` blocks the normal Tab movement,
   which would otherwise take the focus outside the window (onto the calendar).

### 5.3 — @ViewChild closeButton + ngAfterViewInit()

```ts
@ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;
ngAfterViewInit(): void
{
  this.closeButton?.nativeElement.focus();
}
```

**Purpose**
When the window opens, it moves the focus to the close button (×).
This way, keyboard and screen reader users find themselves inside the window straight away,
instead of staying on the calendar underneath.

**When it is called**
`ngAfterViewInit` is called by Angular only once, as soon as the window
template has been rendered.

**How it works**
1. `@ViewChild('closeButton')` looks in the template for the element marked with
   `#closeButton` (the × button) and stores it in the `closeButton` property.
2. `ElementRef<HTMLButtonElement>` is the wrapper Angular uses for the element:
   the actual button is reached with `.nativeElement`.
3. In `ngAfterViewInit` the button is available, so
   `this.closeButton?.nativeElement.focus()` gives it focus.

**Notes**
- `closeButton` is not available in the `constructor`, because the template has not
  been rendered yet: this is why focus is given in `ngAfterViewInit`.
- The `?` avoids an error in the purely theoretical case where the button is not found.
- Together with 5.2 (`trapFocus`) and the focus management in deletion,
  it is part of the keyboard path of the window.

### 5.4 — close()

```ts
@HostListener('document:keydown.escape')
close(): void
{
  this.closed.emit();
}
```

**Purpose**
Asks the calendar to close the window.
The window does not close by itself: it notifies the calendar, which decides to remove it.

**When it is called**
In three ways:
- click on the × button (template, `(click)="close()"` on the button with `#closeButton`);
- click on the semi-transparent background (template, `(click)="close()"` on `.activity-editor-overlay`);
- Esc key, thanks to `@HostListener('document:keydown.escape')`.

**How it works**
1. `@HostListener('document:keydown.escape')` listens for the Esc key on the whole page
   and, when it is pressed, calls `close()`.
2. `this.closed.emit()` sends the `closed` output event to the calendar.
3. The calendar receives it with `(closed)="closeActivityEditor()"`: it sets
   `editorDate` to `null`, so the window is removed, and moves the focus back
   to the selected day.

**Notes**
- A click inside the window does not close it, because the `<section>` stops the click
  with `$event.stopPropagation()` before it reaches the background.

### 5.5 — timeLabel(value)

```ts
timeLabel(value: string): { key: string; time: string }
{
  const time = value.slice(11, 16);
  const day = value.slice(0, 10);
  if (day === this.dateKey()) return { key: 'DayActivityEditor.Time', time };
  return { key: day < this.dateKey() ? 'DayActivityEditor.PreviousDayTime' : 'DayActivityEditor.NextDayTime', time };
}
```

**Purpose**
Prepares an activity's time to be shown in the list: it returns the time
(e.g. `09:30`) and the translation key to use, which tells whether the time falls
in the window's day, in the previous one or in the next one.

**When it is called**
From the template, in the list of recorded activities:
```html
@let start = timeLabel(event.start);
@let end = timeLabel(event.end);
<span>{{ start.key | translate: start }}–{{ end.key | translate: end }}</span>
```
`@let` creates a local variable in the template, so the method is called
only once per time. `translate: start` passes the object as translation
parameters: `time` fills the `{{time}}` placeholder, `key` is ignored.

**How it works**
1. `value` has the format `YYYY-MM-DDTHH:mm`, for example `2026-11-09T09:30`.
2. `time = value.slice(11, 16)` takes the time (`09:30`).
3. `day = value.slice(0, 10)` takes the date part (`2026-11-09`)
   and compares it with `dateKey()`, the window's day.
4. If it is the same day, it returns the key `DayActivityEditor.Time`
   (text: the time only, e.g. `09:30`).
5. If it is an earlier day it returns `DayActivityEditor.PreviousDayTime`
   (e.g. `22:34 (Previous day)`), otherwise `DayActivityEditor.NextDayTime`
   (e.g. `07:00 (Next day)`). Dates are compared as text,
   like times (see 5.9, Notes).

**Notes**
- "Next day" appears on the end of an activity that continues past midnight,
  seen in the day it starts. "Previous day" appears on its start, seen
  in the day it ends (see `events`).
- Midnight appears as `00:00 (Next day)`, consistent with how it is
  entered (end `00:00`).
- The text lives only in the translation files: the method chooses the key, the
  `translate` pipe writes the text and updates it automatically when the language changes.
- The `Time` key contains only `{{time}}`: it lets the template handle
  the three cases in the same way, without an `@if`.
- The translations stay generic ("previous day", not "yesterday"): the reference
  is the day open in the window, which is not necessarily today.
- Accessibility: the screen reader reads a clear text (e.g. "22:34 previous day")
  instead of symbols such as `(-1)`.

### 5.6 — startNew()

```ts
startNew(): void
{
  this.resetForm();
  this.pendingDelete.set(null);
}
```

**Purpose**
Prepares the window to enter a new activity: it clears the form
and closes any open delete confirmation.

**When it is called**
From the template, with the "Clear form" button under the form
(`(click)="startNew()"`, text `DayActivityEditor.ClearForm`).

**How it works**
1. `resetForm()` brings the form back to its initial values and cancels any
   edit in progress (see 5.8).
2. `pendingDelete.set(null)` hides the delete confirmation, if it was open.

**Notes**
- Compared with `resetForm()` it does one more thing: it also closes the delete confirmation.
  This is why the button calls `startNew()` and not `resetForm()` directly.

### 5.7 — edit(event)

```ts
edit(event: TimelineEvent): void
{
  if (!this.events().includes(event)) return;
  this.resetForm();
  this.pendingDelete.set(null);
  this.editingEvent.set(event);
  this.form.patchValue({
    type: event.type,
    start: event.start.slice(11, 16),
    end: event.end.slice(11, 16),
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
```

**Purpose**
Loads the activity chosen from the list into the form, so the user can edit it.
On save, `save()` will replace this activity instead of creating a new one.

**When it is called**
From the template, with the "Edit" button of each activity in the list
(`(click)="edit(event)"`).

**How it works**
1. If the activity is no longer among those of the day (`events()`), the method stops.
2. `resetForm()` clears the values of a previous edit (see 5.8).
3. `pendingDelete.set(null)` closes any open delete confirmation.
4. `editingEvent.set(event)` remembers which activity to replace on save.
   It comes after `resetForm()`, which would otherwise set it back to `null`.
5. The first `patchValue` loads the fields common to all types: type, start, end and note.
   For start and end it loads only the time (`slice(11, 16)`, e.g. `23:00`), because the
   form fields are of type `time`; the date is rebuilt on save (see 5.16).
   If the note is missing (`?? ''`), the field stays empty.
6. The `switch` loads the fields specific to the type (e.g. book and author for `Reading`).
   `Work` has no specific fields.

**Notes**
- Changing the `type` with `patchValue` triggers the listener of 5.1 (point 1):
  the template shows the fields of that type and `updateRequiredFields` makes them required.
- `patchValue` updates only the given fields and leaves the others as they are:
  this is why it can be called twice, first for the common fields and then for those of the type.

### 5.8 — resetForm()

```ts
resetForm(): void
{
  this.editingEvent.set(null);
  this.invalidFields.set(false);
  this.invalidInterval.set(false);
  this.form.reset({ start: dayjs().format('HH:mm') });
}
```

**Purpose**
Brings the window back to the "new activity" state: no edit in progress,
no visible error and the form with its initial values.

**When it is called**
From several points of the component:
- when the window opens and when the day changes (5.1, `effect`);
- from the "Clear form" button (5.6, `startNew`);
- before loading an activity to edit (5.7, `edit`);
- after a successful save (`save`);
- when the user asks to delete an activity (`requestDelete`).

**How it works**
1. `editingEvent.set(null)`: no activity is being edited any more,
   so the next save will create a new activity.
2. `invalidFields` and `invalidInterval` go back to `false`: the error messages disappear.
3. `form.reset({ start: ... })` resets all the fields:
   - `start` becomes the current time (e.g. `15:42`), so the user starts from a sensible time;
   - all the other fields, not listed, go back to the initial value defined
     in the `form` (`Work` for `type`, empty for the others). This happens because the
     controls are `nonNullable`.

**Notes**
- `form.reset` does not change only the values: it also removes the "touched" state of the fields,
  set by `markAllAsTouched()` in `save()` when the form was invalid.
- The reset triggers the listeners of 5.1: the type `Work` updates the required
  fields through `updateRequiredFields`.

### 5.9 — save()

```ts
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

  const day = this.startDay();
  const current = this.storage.getDay(day);
  const timeline = [...(current?.timeline ?? [])];
  const previous = this.storage.getDay(this.shiftDay(day, -1))?.timeline ?? [];
  const next = this.storage.getDay(this.shiftDay(day, 1))?.timeline ?? [];
  const editing = this.editingEvent();
  const event = this.toEvent(value);
  const overlaps = [...previous, ...timeline, ...next].some(existing => existing !== editing
    && event.start < existing.end
    && event.end > existing.start);
  if (overlaps || event.end <= `${this.dateKey()}T00:00`) {
    this.invalidInterval.set(true);
    return;
  }

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
    id: current?.id ?? `day-${day}`,
    date: day,
    timeline: timeline.sort((a, b) => a.start.localeCompare(b.start)),
    extra: current?.extra ?? [],
  });
  this.resetForm();
  this.savedMessage.set(editing ? 'DayActivityEditor.Updated' : 'DayActivityEditor.Added');
  setTimeout(() => this.savedMessage.set(null), 2500);
}
```

**Purpose**
Checks the form data and saves the activity in the day: it creates a new one
or replaces the one being edited.

**When it is called**
From the template, when the form is submitted with the "Save" button (`(ngSubmit)="save()"`).

**How it works**
The method goes through a series of checks: at the first one that fails it shows
the error and stops, without saving anything.

1. **Form fields**
   If the form is invalid (e.g. an empty required field), `markAllAsTouched()`
   marks all the fields as "touched" and `invalidFields` shows the
   "required fields" message.
2. **Times**
   `getRawValue()` reads the form values. `isValidInterval` (see 5.14) checks
   that start and end are different; if not, `invalidInterval` shows the
   invalid interval message.
3. **Overlaps**
   `toEvent` (see 5.15) builds the activity straight away, with start and end including
   the date. `day` is the day in which the activity is (or will be) saved, that is `startDay()`:
   the window's day for a new activity, its start day for one
   being edited. `current` is that saved day; `timeline` is a **copy** of its activities.
   `previous` and `next` are the activities of the previous and next day
   (empty list if the day does not exist): they are needed for activities that continue past
   midnight. The two neighbouring days are enough, because an activity lasts less than 24 hours.
   `overlaps` is true if an existing activity of the three days (other than the one being
   edited) overlaps the new one. The comparison also works across different
   days because start and end are full ISO strings including the date (e.g. `2026-11-18T22:00`).
   In that case the interval message is shown.
   The same message appears if the activity would no longer touch the window's
   day (see Notes).
4. **New or edited**
   - When editing: the position of the original activity is found and it is replaced.
     If it is no longer there, the edit is cancelled without saving.
   - Otherwise: the activity is added at the end.
5. **Saving**
   `storage.saveDay` saves the day `day` with the activities sorted by start time.
   It reuses the `id` and the `extra` of the day, if it already existed, otherwise it creates them.
6. **Restart and notice**
   `resetForm()` (see 5.8) prepares the form for a new activity.
   Right after, `savedMessage` receives the key of the message to show:
   `DayActivityEditor.Updated` if it was an edit, `DayActivityEditor.Added`
   if it was a new activity. `setTimeout` sets it back to `null` after 2.5 seconds
   (2500 milliseconds), so the notice disappears by itself.

**Notes**
- Consecutive activities are allowed: if one ends at `10:00` and the other starts
  at `10:00`, the comparison `event.start < existing.end` is false and there is no overlap.
- Times are compared as text (`<`, `>`, `localeCompare`). This works because
  the format `YYYY-MM-DDTHH:mm` puts the most significant parts first: alphabetical
  order matches chronological order.
- `timeline` is a copy (`[...]`) so as not to modify the storage data
  directly: the day changes only with `saveDay`.
- Save notice: the template contains a `<span class="success" role="status">`
  that is always present but **empty**. It is filled at the exact moment an activity
  is added or edited, because `savedMessage` goes from `null` to the message
  key and `@if` writes the translated text.
  The span always stays on the page because the screen reader reliably announces
  only text changes inside an already existing `role="status"` region.
- When the span is empty, the SCSS rule `.success:empty { padding: 0; }` removes the
  padding: the green box has zero size and is not visible. `display: none` is not used,
  because it would also hide the span from the screen reader.
- `savedMessage` must be set **after** `resetForm()`: the reset triggers
  `form.valueChanges` (5.1, point 2), which would otherwise set it straight back to `null`.
- `day` must be read at the beginning, before `resetForm()`: the reset clears `editingEvent`
  and so `startDay()` would go back to the window's day.
- The form does not allow changing the start day. For this reason an edited
  activity must stay visible in the window's day: if the new end
  does not go past midnight of `dateKey()` (`event.end <= ...T00:00`), the
  interval message is shown. Without this check, when editing from the end day
  an activity started the day before with times that no longer cross
  midnight, the activity would move entirely to the previous day and
  disappear from the window. To move it, simply delete it and create it again.

### 5.10 — cancelDelete(click)

```ts
cancelDelete(click: Event): void
{
  const item = (click.currentTarget as HTMLElement).closest('li');
  this.pendingDelete.set(null);
  afterNextRender(() => item?.querySelector<HTMLElement>('.request-delete')?.focus(), { injector: this.injector });
}
```

**Purpose**
Cancels the delete request: it hides the confirmation without deleting
the activity and moves the focus back to the "Delete" button of the same activity.

**When it is called**
From the template, with the "Cancel" button of the delete confirmation
(`(click)="cancelDelete($event)"`).

**How it works**
1. `click.currentTarget` is the "Cancel" button that was pressed; `closest('li')` goes up
   to the list row that contains it. The row must be remembered straight away,
   because the button is about to disappear.
2. `pendingDelete.set(null)` hides the confirmation: the "Edit" and "Delete"
   buttons reappear in the row.
3. `afterNextRender` waits for Angular to update the page, then looks in the
   row for the button with class `request-delete` ("Delete") and gives it focus.

**Notes**
- Accessibility: without point 3 the "Cancel" button would disappear while focused,
  and keyboard or screen reader users would be taken back to the top of the page.
- `injector` is needed by `afterNextRender` because it is called inside a method
  and not in the `constructor`.
- The `<li>` row stays on the page: only the buttons inside it change.
  This is why `item` is still valid after the update.

### 5.11 — requestDelete(event)

```ts
requestDelete(event: TimelineEvent): void
{
  if (!this.events().includes(event)) return;
  this.resetForm();
  this.pendingDelete.set(event);
  afterNextRender(() => document.querySelector<HTMLElement>('.cancel-delete')?.focus(), { injector: this.injector });
}
```

**Purpose**
First step of the deletion: it deletes nothing, but shows in the activity's row
the confirmation question with the "Confirm" and "Cancel" buttons.

**When it is called**
From the template, with the "Delete" button of each activity in the list
(`(click)="requestDelete(event)"`, class `request-delete`).

**How it works**
1. If the activity is no longer among those of the day (`events()`), the method stops.
2. `resetForm()` closes any edit in progress (see 5.8), so the same activity is not
   edited and deleted at the same time.
3. `pendingDelete.set(event)` remembers the activity to delete: the template shows
   the confirmation in its row, in place of "Edit" and "Delete".
4. `afterNextRender` waits for the confirmation to appear, then gives focus to the button
   with class `cancel-delete` ("Cancel").

**Notes**
- The focus goes to "Cancel" and not to "Confirm" for safety: an Enter pressed
  by mistake deletes nothing.
- In the template "Cancel" has `aria-describedby="confirm-delete-question"`:
  the screen reader reads the button together with the confirmation question.
- Only one confirmation is open at a time, so `document.querySelector`
  always finds the right button.

### 5.12 — confirmDelete(event)

```ts
confirmDelete(event: TimelineEvent): void
{
  if (this.pendingDelete() !== event) return;
  const current = this.storage.getDay(event.start.slice(0, 10));
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
```

**Purpose**
Second step of the deletion: it actually deletes the confirmed activity,
saves the updated day and moves the focus to the list title.

**When it is called**
From the template, with the "Confirm" button of the delete confirmation
(`(click)="confirmDelete(event)"`).

**How it works**
1. If `event` is not the activity awaiting confirmation (`pendingDelete()`),
   the method stops.
2. `current` is the day in which the activity is saved, that is its start day
   (`event.start.slice(0, 10)`): it can be the day before, if the activity
   continues past midnight. `index` is the position of the activity among its
   activities, or `-1` if it is not there (`?? -1` also covers a missing day).
3. If the day and the activity exist, `storage.saveDay` saves the day:
   - `...current` copies all its data (id, date, extra);
   - `timeline` is replaced by a new list without the activity at position `index`.
4. `pendingDelete.set(null)` closes the confirmation.
5. `afterNextRender` waits for the deleted row to disappear, then gives focus
   to the "Recorded activities" title (class `recorded-title`).

**Notes**
- Accessibility: the title has `tabindex="-1"` in the template, which allows giving it
  focus from code without adding it to the Tab path. It also works if
  the list ends up empty.
- `filter` creates a new list instead of modifying the existing one: the storage
  data changes only with `saveDay`, as in `save()` (5.9).
- Looking ahead to a database: today the deletion saves the whole day without the activity.
  With a database it will become a request to delete the single activity
  through its `id`, and points 4 and 5 will have to run after the server responds.

### 5.13 — updateRequiredFields(type)

```ts
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
```

**Purpose**
Makes required only the fields expected for the chosen activity type
and removes the requirement from all the others.

**When it is called**
Only from inside the component (`private`): from 5.1, every time the
type in the form changes (drop-down, `resetForm` or `edit`).

**How it works**
1. `REQUIRED_BY_TYPE[type]` returns the required fields of the type
   (e.g. `['book', 'author']` for `Reading`, `[]` for `Work`).
2. The loop goes through `REQUIRED_FIELDS`, that is all the fields that at least one type
   makes required: `subject`, `book`, `author`, `sport`, `activity`.
3. For each field, `setValidators` sets:
   - if the field is among those of the type: `Validators.required` (not empty)
     and `Validators.pattern(/\S/)` (at least one character that is not a space);
   - otherwise: no validator (`[]`).
4. `updateValueAndValidity` immediately recalculates whether the field is valid with the new rules.

**Notes**
- `Validators.pattern(/\S/)` prevents saving a field that contains only spaces,
  which `Validators.required` alone would accept.
- `{ emitEvent: false }` prevents the recalculation from triggering `form.valueChanges`
  (5.1, point 2), which would hide the errors without the user having changed anything.
- Project convention: the rules live only here and in `REQUIRED_BY_TYPE`.
  In the HTML the required fields only have `aria-required="true"`, which must
  match these validators.

### 5.14 — isValidInterval(start, end)

```ts
private isValidInterval(start: string, end: string): boolean
{
  return start !== end;
}
```

**Purpose**
Checks that the entered interval is valid: start and end must be different.

**When it is called**
Only from inside the component (`private`): from `save()` (5.9, point 2),
after the required fields check.

**How it works**
Returns `true` if `start` and `end` are different.

**Notes**
- The other checks are already done elsewhere: the `HH:mm` format is guaranteed
  by the `type="time"` fields, an empty field is blocked by `Validators.required`.
- Any pair of different times is valid: if the end comes before
  the start, the activity ends the next day (see 5.16).
- The method stays separate for readability and to host any future rules.

### 5.15 — toEvent(value)

```ts
private toEvent(value: ActivityFormValue): TimelineEvent
{
  const note = value.note.trim();
  const interval = { ...this.toDateTimes(value.start, value.end), ...(note ? { note } : {}) };
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
```

**Purpose**
Turns the form values into the activity object expected by the
`TimelineEvent` model, with only the fields of the chosen type.

**When it is called**
Only from inside the component (`private`): from `save()` (5.9, point 3),
before the overlap check.

**How it works**
1. `value` contains all the form fields (`ActivityFormValue`), including those
   of the other types, which are empty.
2. `interval` gathers the common data: start and end including the date, calculated
   by `toDateTimes` (see 5.16), and, if not empty, the note.
3. The `switch` chooses the type and builds the final object:
   - `...interval` copies the common data;
   - `type` indicates the activity type;
   - only the fields of that type are added (e.g. `book` and `author` for `Reading`).
4. All texts go through `trim()`, which removes spaces at the beginning and at the end.

**Notes**
- The form `...(text ? { field: text } : {})` adds an optional field
  only if it has a value: if it is empty, the field does not appear in the object at all
  (instead of appearing as an empty string).
- The required fields (e.g. `subject`, `book`) are always present: the form
  has already guaranteed that they are not empty (5.13).
- The `default` should never be reached: it is a safety net in case
  an unexpected type arrives.
- Looking ahead to a database: the object created is always new. When activities
  have an `id`, an edit will have to keep the `id` of the original activity.

### 5.16 — toDateTimes(start, end)

```ts
private toDateTimes(start: string, end: string): { start: string; end: string }
{
  const day = this.startDay();
  const endDay = end > start ? day : this.shiftDay(day, 1);
  return { start: `${day}T${start}`, end: `${endDay}T${end}` };
}
```

**Purpose**
Turns the two times of the form (e.g. `23:00` and `07:00`) into full dates.
It is the only place where it is decided whether an activity ends the next day.

**When it is called**
Only from inside the component (`private`): from `toEvent()` (5.15).

**How it works**
1. `day` is the start day, `startDay()`: the window's day for
   a new activity, the original start day for one being edited.
2. If the end is after the start (`end > start`), the end is on the same day;
   otherwise it is on the next day, calculated with `shiftDay(day, 1)` (see 5.17).
3. It returns the full start and end, e.g.
   `{ start: '2026-11-15T23:00', end: '2026-11-16T07:00' }`.

**Notes**
- Times are compared as text: this works because `HH:mm` always has
  two digits (`"07:00" > "23:00"` is false).
- An activity is saved in the day it starts. For this reason, when editing from the end
  day an activity started the day before, the form times are read
  relative to the start day (e.g. from the 19th: `22:34` and `09:00` become
  `2026-11-18T22:34` → `2026-11-19T09:00`).
- Maximum duration: less than 24 hours. Equal start and end are rejected by 5.14.
- The `type="time"` fields accept hours from 00 to 23: 24:00 cannot be entered.
  For this reason the window header shows, under the date, the message
  `DayActivityEditor.MidnightHint`: to start an activity at 24:00, open
  the next day and enter it with a start time of 00:00.

### 5.17 — shiftDay(day, days)

```ts
private shiftDay(day: string, days: number): string
{
  return formatDate(dayjs(day).add(days, 'day').toDate());
}
```

**Purpose**
Returns the date shifted by a given number of days,
e.g. `shiftDay('2026-11-19', -1)` → `'2026-11-18'`.

**When it is called**
Only from inside the component (`private`): from `events` (previous day),
from `save()` (5.9, neighbouring days for the overlaps) and from `toDateTimes()`
(5.16, next day).

**How it works**
1. `dayjs(day)` reads the date in the `YYYY-MM-DD` format.
2. `add(days, 'day')` shifts it: a negative `days` goes back, a positive one goes forward.
3. `formatDate` brings it back to the `YYYY-MM-DD` format used as the day key.

**Notes**
- It gathers in one place a formula that was previously repeated in several methods.
- `dayjs` handles month and year changes by itself (e.g. from 1 January to 31 December).
