# DayActivityEditor — documentazione del codice

## 1. Il componente in sintesi

Finestra modale che il calendario apre dalla voce "Gestisci attività" del menu di un giorno.
Permette di aggiungere, modificare ed eliminare le attività legate al tempo di quel giorno
(Sonno, Lavoro, Studio, Lettura, Sport, Tempo libero, Attività personalizzata).
Ogni attività occupa un intervallo orario (inizio e fine): è questo intervallo che permette
di disegnare sulla timeline circolare il tempo occupato nella giornata.
Prima di salvare controlla i campi obbligatori del tipo scelto, che inizio e fine
siano diversi e che l'attività non si sovrapponga ad altre.
Un'attività può proseguire oltre la mezzanotte: in quel caso finisce il giorno dopo.
Si salva nel giorno in cui inizia, ma compare anche nell'elenco del giorno in cui
finisce e si può modificare o eliminare da entrambi i giorni.
I dati vengono letti e salvati tramite `StorageService`.
È pensata per essere usabile anche da tastiera e con screen reader.

## 2. Librerie e import

### Angular — `@angular/core`
| Import | A cosa serve qui |
|---|---|
| `Component` | Dichiara la classe come componente Angular (selettore, template, stili). |
| `input`, `output` | Ricevono il giorno dal calendario (`date`) e gli segnalano la chiusura (`closed`). |
| `signal`, `computed` | Stato reattivo della finestra e valori derivati dalla data (es. `dateKey`, `events`, `startDay`). |
| `effect` | Ripristina il form ogni volta che cambia il giorno. |
| `inject` | Ottiene i servizi necessari (`StorageService`, `Injector`). |
| `Injector` | Serve ad `afterNextRender` quando è chiamato dentro un metodo. |
| `afterNextRender` | Esegue codice dopo che Angular ha aggiornato la pagina (gestione del focus). |
| `ViewChild`, `ElementRef` | Raggiungono il pulsante di chiusura nel template per dargli il focus. |
| `HostListener` | Chiude la finestra quando si preme Esc. |

### Angular — `@angular/core/rxjs-interop`
| Import | A cosa serve qui |
|---|---|
| `takeUntilDestroyed` | Interrompe gli ascolti del form quando la finestra viene chiusa, evitando sprechi di memoria. |

### Angular — `@angular/forms`
| Import | A cosa serve qui |
|---|---|
| `FormGroup`, `FormControl` | Costruiscono il form tipizzato con tutti i campi delle attività. |
| `Validators` | Regole di validazione (campi obbligatori, testo non vuoto). |
| `ReactiveFormsModule` | Collega il form del TypeScript ai campi dell'HTML (`formGroup`, `formControlName`). |

### Traduzioni — `@ngx-translate/core`
| Import | A cosa serve qui |
|---|---|
| `TranslateModule` | Rende disponibile nel template il pipe `translate` per i testi in italiano e inglese. |

### Date — `dayjs`
| Import | A cosa serve qui |
|---|---|
| `dayjs` | Legge l'ora attuale (`resetForm`) e calcola le date dei giorni vicini (`shiftDay`). |

### File del progetto
| Import | Da dove | A cosa serve qui |
|---|---|---|
| `formatDate` | `functions/date-utils` | Trasforma una `Date` nel testo `YYYY-MM-DD` usato come chiave del giorno. |
| `eventsOnDay` | `functions/day-events` | Restituisce le attività del giorno, incluse quelle iniziate il giorno prima (`events`). |
| `TimelineEvent` | `models/calendar-event.model` | Tipo che descrive un'attività legata al tempo e i suoi 7 tipi. |
| `EVENT_COLORS`, `eventTitle` | `models/event-presentation` | Colore di ogni tipo di attività e titolo da mostrare nell'elenco. |
| `StorageService` | `services/storage.service` | Legge e salva le giornate con le loro attività. |

## 3. Blocchi di codice

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

**Scopo**
Prepara i comportamenti automatici della finestra appena viene creata:
reagisce al cambio del tipo di attività, nasconde gli errori quando l'utente
modifica un campo e ripristina il form ogni volta che cambia il giorno.

**Quando viene chiamato**
Una sola volta, da Angular, quando il calendario apre la finestra.

**Come funziona**
1. **Cambio del tipo di attività**
   `form.controls.type.valueChanges` emette un valore ogni volta che cambia
   la tendina del tipo. A ogni cambio:
   - `selectedType` viene aggiornato, e il template mostra i campi di quel tipo;
   - `updateRequiredFields(type)` rende obbligatori i campi previsti da `REQUIRED_BY_TYPE`.
2. **Modifica di un qualsiasi campo**
   `form.valueChanges` emette a ogni modifica del form. A ogni modifica
   `invalidFields` e `invalidInterval` tornano a `false` e `savedMessage` torna a `null`:
   i messaggi di errore e l'avviso di salvataggio spariscono appena l'utente
   modifica il form.
3. **Cambio del giorno**
   `effect` riesegue il suo contenuto ogni volta che cambia un signal letto al suo interno.
   Legge `dateKey()`, quindi si riattiva all'apertura e a ogni nuovo giorno passato dal calendario. Allora:
   - `resetForm()` svuota il form e imposta come inizio l'ora attuale del giorno scelto;
   - `pendingDelete` torna a `null`, chiudendo un'eventuale conferma di eliminazione.

**Note**
- `takeUntilDestroyed()` interrompe automaticamente gli ascolti 1 e 2
  quando la finestra viene chiusa, così non restano attivi in memoria.
- I campi obbligatori del tipo iniziale vengono impostati grazie al punto 3:
  `resetForm()` imposta il tipo `Work`, questo fa scattare il punto 1
  e quindi `updateRequiredFields`.

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

**Scopo**
Tiene il focus dentro la finestra mentre è aperta: Tab sull'ultimo elemento
torna al primo, Shift+Tab sul primo va all'ultimo.
Pensato per l'accessibilità, in particolare per i non vedenti: chi usa uno
screen reader o solo la tastiera non esce dalla finestra senza accorgersene.

**Quando viene chiamato**
Dal template, sulla `<section role="dialog">`:
`(keydown.tab)` e `(keydown.shift.tab)`. Angular distingue i due tasti,
per questo servono entrambi.

**Come funziona**
1. `event.currentTarget` è la finestra che ha ricevuto il tasto.
2. `querySelectorAll('button, input, select, textarea')` raccoglie gli elementi
   raggiungibili con Tab, nell'ordine in cui compaiono nella pagina.
3. `first` e `last` sono il primo (pulsante ×) e l'ultimo elemento dell'elenco.
4. `shiftKey` indica se è premuto Shift, cioè se si sta andando all'indietro.
5. Se si va avanti dall'ultimo, il focus passa al primo; se si va indietro
   dal primo, passa all'ultimo.
6. `event.preventDefault()` blocca lo spostamento normale del Tab,
   che altrimenti porterebbe il focus fuori dalla finestra (sul calendario).

### 5.3 — @ViewChild closeButton + ngAfterViewInit()

```ts
@ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;
ngAfterViewInit(): void
{
  this.closeButton?.nativeElement.focus();
}
```

**Scopo**
All'apertura della finestra porta il focus sul pulsante di chiusura (×).
Così chi usa la tastiera o uno screen reader si trova subito dentro la finestra,
invece di restare sul calendario sottostante.

**Quando viene chiamato**
`ngAfterViewInit` è chiamato da Angular una sola volta, appena il template
della finestra è stato disegnato.

**Come funziona**
1. `@ViewChild('closeButton')` cerca nel template l'elemento segnato con
   `#closeButton` (il pulsante ×) e lo salva nella proprietà `closeButton`.
2. `ElementRef<HTMLButtonElement>` è il contenitore che Angular usa per l'elemento:
   il pulsante vero si raggiunge con `.nativeElement`.
3. In `ngAfterViewInit` il pulsante è ormai disponibile, quindi
   `this.closeButton?.nativeElement.focus()` gli dà il focus.

**Note**
- `closeButton` non è disponibile nel `constructor`, perché il template non è
  ancora stato disegnato: per questo il focus viene dato in `ngAfterViewInit`.
- Il `?` evita un errore nel caso, solo teorico, in cui il pulsante non venga trovato.
- Insieme a 5.2 (`trapFocus`) e alla gestione del focus nell'eliminazione,
  fa parte del percorso tastiera della finestra.

### 5.4 — close()

```ts
@HostListener('document:keydown.escape')
close(): void
{
  this.closed.emit();
}
```

**Scopo**
Chiede al calendario di chiudere la finestra.
La finestra non si chiude da sola: avvisa il calendario, che decide di rimuoverla.

**Quando viene chiamato**
In tre modi:
- clic sul pulsante × (template, `(click)="close()"` sul pulsante con `#closeButton`);
- clic sullo sfondo semitrasparente (template, `(click)="close()"` su `.activity-editor-overlay`);
- tasto Esc, grazie a `@HostListener('document:keydown.escape')`.

**Come funziona**
1. `@HostListener('document:keydown.escape')` ascolta il tasto Esc su tutta la pagina
   e, quando viene premuto, chiama `close()`.
2. `this.closed.emit()` invia l'evento di output `closed` al calendario.
3. Il calendario lo riceve con `(closed)="closeActivityEditor()"`: imposta
   `editorDate` a `null`, così la finestra viene rimossa, e riporta il focus
   sul giorno selezionato.

**Note**
- Un clic dentro la finestra non la chiude, perché la `<section>` blocca il clic
  con `$event.stopPropagation()` prima che arrivi allo sfondo.

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

**Scopo**
Prepara l'orario di un'attività da mostrare nell'elenco: restituisce l'ora
(es. `09:30`) e la chiave di traduzione da usare, che indica se l'orario cade
nel giorno della finestra, in quello precedente o in quello successivo.

**Quando viene chiamato**
Dal template, nell'elenco delle attività registrate:
```html
@let start = timeLabel(event.start);
@let end = timeLabel(event.end);
<span>{{ start.key | translate: start }}–{{ end.key | translate: end }}</span>
```
`@let` crea una variabile locale nel template, così il metodo viene chiamato
una sola volta per orario. `translate: start` passa l'oggetto come parametri
della traduzione: `time` riempie il segnaposto `{{time}}`, `key` viene ignorata.

**Come funziona**
1. `value` ha il formato `YYYY-MM-DDTHH:mm`, ad esempio `2026-11-09T09:30`.
2. `time = value.slice(11, 16)` prende l'ora (`09:30`).
3. `day = value.slice(0, 10)` prende la parte della data (`2026-11-09`)
   e la confronta con `dateKey()`, il giorno della finestra.
4. Se è lo stesso giorno, restituisce la chiave `DayActivityEditor.Time`
   (testo: solo l'ora, es. `09:30`).
5. Se è un giorno precedente restituisce `DayActivityEditor.PreviousDayTime`
   (es. `22:34 (Giorno precedente)`), altrimenti `DayActivityEditor.NextDayTime`
   (es. `07:00 (Giorno successivo)`). Le date si confrontano come testi,
   come gli orari (vedi 5.9, Note).

**Note**
- "Giorno successivo" compare sulla fine di un'attività che oltrepassa la mezzanotte,
  vista nel giorno in cui inizia. "Giorno precedente" compare sul suo inizio, vista
  nel giorno in cui finisce (vedi `events`).
- La mezzanotte appare come `00:00 (Giorno successivo)`, coerente con come si
  inserisce (fine `00:00`).
- Il testo sta solo nei file di traduzione: il metodo sceglie la chiave, il pipe
  `translate` scrive il testo e lo aggiorna da solo al cambio di lingua.
- La chiave `Time` contiene solo `{{time}}`: serve perché il template tratti
  i tre casi allo stesso modo, senza un `@if`.
- Le traduzioni restano generiche ("giorno precedente", non "ieri"): il riferimento
  è il giorno aperto nella finestra, che non è necessariamente oggi.
- Accessibilità: lo screen reader legge un testo chiaro (es. "22:34 giorno precedente")
  invece di simboli come `(-1)`.

### 5.6 — startNew()

```ts
startNew(): void
{
  this.resetForm();
  this.pendingDelete.set(null);
}
```

**Scopo**
Prepara la finestra per inserire una nuova attività: svuota il form
e chiude un'eventuale conferma di eliminazione aperta.

**Quando viene chiamato**
Dal template, con il pulsante "Pulisci modulo" sotto il form
(`(click)="startNew()"`, testo `DayActivityEditor.ClearForm`).

**Come funziona**
1. `resetForm()` riporta il form ai valori iniziali e annulla un'eventuale
   modifica in corso (vedi 5.8).
2. `pendingDelete.set(null)` nasconde la conferma di eliminazione, se era aperta.

**Note**
- Rispetto a `resetForm()` fa una cosa in più: chiude anche la conferma di eliminazione.
  Per questo il pulsante chiama `startNew()` e non direttamente `resetForm()`.

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

**Scopo**
Carica nel form l'attività scelta dall'elenco, così l'utente può modificarla.
Al salvataggio, `save()` sostituirà questa attività invece di crearne una nuova.

**Quando viene chiamato**
Dal template, con il pulsante "Modifica" di ogni attività dell'elenco
(`(click)="edit(event)"`).

**Come funziona**
1. Se l'attività non è più tra quelle del giorno (`events()`), il metodo si ferma.
2. `resetForm()` cancella i valori di una modifica precedente (vedi 5.8).
3. `pendingDelete.set(null)` chiude un'eventuale conferma di eliminazione.
4. `editingEvent.set(event)` ricorda quale attività sostituire al salvataggio.
   Viene dopo `resetForm()`, che altrimenti lo riporterebbe a `null`.
5. Il primo `patchValue` carica i campi comuni a tutti i tipi: tipo, inizio, fine e nota.
   Di inizio e fine carica solo l'ora (`slice(11, 16)`, es. `23:00`), perché i campi
   del form sono di tipo `time`; la data viene ricostruita al salvataggio (vedi 5.16).
   Se la nota manca (`?? ''`), il campo resta vuoto.
6. Lo `switch` carica i campi specifici del tipo (es. libro e autore per `Reading`).
   `Work` non ha campi specifici.

**Note**
- Cambiare il `type` con `patchValue` fa scattare l'ascolto del 5.1 (punto 1):
  il template mostra i campi di quel tipo e `updateRequiredFields` li rende obbligatori.
- `patchValue` aggiorna solo i campi indicati e lascia gli altri come sono:
  per questo può essere chiamato due volte, prima per i campi comuni e poi per quelli del tipo.

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

**Scopo**
Riporta la finestra allo stato "nuova attività": nessuna modifica in corso,
nessun errore visibile e form con i valori iniziali.

**Quando viene chiamato**
Da diversi punti del componente:
- all'apertura e al cambio del giorno (5.1, `effect`);
- dal pulsante "Pulisci modulo" (5.6, `startNew`);
- prima di caricare un'attività da modificare (5.7, `edit`);
- dopo un salvataggio riuscito (`save`);
- quando si chiede di eliminare un'attività (`requestDelete`).

**Come funziona**
1. `editingEvent.set(null)`: nessuna attività è più in modifica,
   quindi il prossimo salvataggio creerà un'attività nuova.
2. `invalidFields` e `invalidInterval` tornano a `false`: i messaggi di errore spariscono.
3. `form.reset({ start: ... })` reimposta tutti i campi:
   - `start` diventa l'ora attuale (es. `15:42`), così l'utente parte da un orario sensato;
   - tutti gli altri campi, non indicati, tornano al valore iniziale definito
     nel `form` (`Work` per `type`, vuoto per gli altri). Succede perché i
     controlli sono `nonNullable`.

**Note**
- `form.reset` non cambia solo i valori: toglie anche lo stato "toccato" dei campi,
  impostato da `markAllAsTouched()` in `save()` quando il form era invalido.
- Il reset fa scattare gli ascolti del 5.1: il tipo `Work` aggiorna i campi
  obbligatori tramite `updateRequiredFields`.

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

**Scopo**
Controlla i dati del form e salva l'attività nel giorno: ne crea una nuova
oppure sostituisce quella in modifica.

**Quando viene chiamato**
Dal template, all'invio del form con il pulsante "Salva" (`(ngSubmit)="save()"`).

**Come funziona**
Il metodo procede per controlli successivi: al primo che fallisce mostra
l'errore e si ferma, senza salvare nulla.

1. **Campi del form**
   Se il form è invalido (es. un campo obbligatorio vuoto), `markAllAsTouched()`
   segna tutti i campi come "toccati" e `invalidFields` mostra il messaggio
   "campi obbligatori".
2. **Orari**
   `getRawValue()` legge i valori del form. `isValidInterval` (vedi 5.14) controlla
   che inizio e fine siano diversi; se no, `invalidInterval` mostra il messaggio
   di intervallo non valido.
3. **Sovrapposizioni**
   `toEvent` (vedi 5.15) costruisce subito l'attività, con inizio e fine completi
   di data. `day` è il giorno in cui l'attività è (o sarà) salvata, cioè `startDay()`:
   il giorno della finestra per un'attività nuova, il suo giorno di inizio per una
   in modifica. `current` è quel giorno salvato; `timeline` è una **copia** delle sue attività.
   `previous` e `next` sono le attività del giorno precedente e di quello successivo
   (lista vuota se il giorno non esiste): servono per le attività che oltrepassano
   la mezzanotte. Bastano i due giorni vicini, perché un'attività dura meno di 24 ore.
   `overlaps` è vero se un'attività esistente dei tre giorni (diversa da quella in
   modifica) si sovrappone a quella nuova. Il confronto funziona anche tra giorni
   diversi perché inizio e fine sono stringhe ISO complete di data (es. `2026-11-18T22:00`).
   In quel caso si mostra il messaggio di intervallo.
   Lo stesso messaggio compare se l'attività non toccherebbe più il giorno della
   finestra (vedi Note).
4. **Nuova o modificata**
   - In modifica: si cerca la posizione dell'attività originale e la si sostituisce.
     Se non c'è più, si annulla la modifica senza salvare.
   - Altrimenti: l'attività viene aggiunta in fondo.
5. **Salvataggio**
   `storage.saveDay` salva il giorno `day` con le attività ordinate per orario di inizio.
   Riusa l'`id` e gli `extra` del giorno, se esisteva già, altrimenti li crea.
6. **Ripartenza e avviso**
   `resetForm()` (vedi 5.8) prepara il form per una nuova attività.
   Subito dopo, `savedMessage` riceve la chiave del messaggio da mostrare:
   `DayActivityEditor.Updated` se era una modifica, `DayActivityEditor.Added`
   se era una nuova attività. `setTimeout` lo riporta a `null` dopo 2,5 secondi
   (2500 millisecondi), così l'avviso sparisce da solo.

**Note**
- Attività consecutive sono ammesse: se una finisce alle `10:00` e l'altra inizia
  alle `10:00`, il confronto `event.start < existing.end` è falso e non c'è sovrapposizione.
- Gli orari si confrontano come testi (`<`, `>`, `localeCompare`). Funziona perché
  il formato `YYYY-MM-DDTHH:mm` mette prima le parti più importanti: l'ordine
  alfabetico coincide con l'ordine nel tempo.
- `timeline` è una copia (`[...]`) per non modificare direttamente i dati dello
  storage: il giorno cambia solo con `saveDay`.
- Avviso di salvataggio: nel template c'è uno `<span class="success" role="status">`
  sempre presente ma **vuoto**. Si valorizza nel momento esatto in cui un'attività
  viene aggiunta o modificata, perché `savedMessage` passa da `null` alla chiave
  del messaggio e `@if` scrive il testo tradotto.
  Lo span resta sempre nella pagina perché lo screen reader annuncia in modo
  affidabile solo i cambi di testo dentro una zona `role="status"` già esistente.
- Quando lo span è vuoto, la regola SCSS `.success:empty { padding: 0; }` toglie il
  padding: il riquadro verde ha dimensione zero e non si vede. Non si usa
  `display: none`, che toglierebbe lo span anche allo screen reader.
- `savedMessage` va impostato **dopo** `resetForm()`: il reset fa scattare
  `form.valueChanges` (5.1, punto 2), che altrimenti lo riporterebbe subito a `null`.
- `day` va letto all'inizio, prima di `resetForm()`: il reset azzera `editingEvent`
  e quindi `startDay()` tornerebbe al giorno della finestra.
- Il form non permette di cambiare il giorno di inizio. Per questo un'attività
  modificata deve restare visibile nel giorno della finestra: se la nuova fine
  non supera la mezzanotte di `dateKey()` (`event.end <= ...T00:00`), si mostra
  il messaggio di intervallo. Senza questo controllo, modificando dal giorno di
  fine un'attività iniziata il giorno prima con orari che non oltrepassano più
  la mezzanotte, l'attività si sposterebbe tutta nel giorno precedente e
  sparirebbe dalla finestra. Per spostarla basta eliminarla e ricrearla.

### 5.10 — cancelDelete(click)

```ts
cancelDelete(click: Event): void
{
  const item = (click.currentTarget as HTMLElement).closest('li');
  this.pendingDelete.set(null);
  afterNextRender(() => item?.querySelector<HTMLElement>('.request-delete')?.focus(), { injector: this.injector });
}
```

**Scopo**
Annulla la richiesta di eliminazione: nasconde la conferma senza eliminare
l'attività e riporta il focus sul pulsante "Elimina" della stessa attività.

**Quando viene chiamato**
Dal template, con il pulsante "Annulla" della conferma di eliminazione
(`(click)="cancelDelete($event)"`).

**Come funziona**
1. `click.currentTarget` è il pulsante "Annulla" premuto; `closest('li')` risale
   alla riga dell'elenco che lo contiene. La riga va ricordata subito,
   perché il pulsante sta per sparire.
2. `pendingDelete.set(null)` nasconde la conferma: nella riga ricompaiono
   i pulsanti "Modifica" ed "Elimina".
3. `afterNextRender` aspetta che Angular abbia aggiornato la pagina, poi cerca nella
   riga il pulsante con classe `request-delete` ("Elimina") e gli dà il focus.

**Note**
- Accessibilità: senza il punto 3 il pulsante "Annulla" sparirebbe con il focus sopra,
  e chi usa tastiera o screen reader verrebbe riportato all'inizio della pagina.
- `injector` serve ad `afterNextRender` perché è chiamato dentro un metodo
  e non nel `constructor`.
- La riga `<li>` resta nella pagina: cambiano solo i pulsanti al suo interno.
  Per questo `item` è ancora valido dopo l'aggiornamento.

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

**Scopo**
Primo passo dell'eliminazione: non elimina nulla, ma mostra nella riga
dell'attività la domanda di conferma con i pulsanti "Conferma" e "Annulla".

**Quando viene chiamato**
Dal template, con il pulsante "Elimina" di ogni attività dell'elenco
(`(click)="requestDelete(event)"`, classe `request-delete`).

**Come funziona**
1. Se l'attività non è più tra quelle del giorno (`events()`), il metodo si ferma.
2. `resetForm()` chiude un'eventuale modifica in corso (vedi 5.8), così non si
   modifica e si elimina la stessa attività nello stesso momento.
3. `pendingDelete.set(event)` ricorda l'attività da eliminare: il template mostra
   la conferma nella sua riga, al posto di "Modifica" ed "Elimina".
4. `afterNextRender` aspetta che la conferma compaia, poi dà il focus al pulsante
   con classe `cancel-delete` ("Annulla").

**Note**
- Il focus va su "Annulla" e non su "Conferma" per sicurezza: un Invio premuto
  per sbaglio non cancella nulla.
- Nel template "Annulla" ha `aria-describedby="confirm-delete-question"`:
  lo screen reader legge il pulsante insieme alla domanda di conferma.
- C'è una sola conferma aperta alla volta, quindi `document.querySelector`
  trova sempre il pulsante giusto.

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

**Scopo**
Secondo passo dell'eliminazione: elimina davvero l'attività confermata,
salva il giorno aggiornato e porta il focus sul titolo dell'elenco.

**Quando viene chiamato**
Dal template, con il pulsante "Conferma" della conferma di eliminazione
(`(click)="confirmDelete(event)"`).

**Come funziona**
1. Se `event` non è l'attività in attesa di conferma (`pendingDelete()`),
   il metodo si ferma.
2. `current` è il giorno in cui l'attività è salvata, cioè il suo giorno di inizio
   (`event.start.slice(0, 10)`): può essere il giorno prima, se l'attività
   oltrepassa la mezzanotte. `index` è la posizione dell'attività nelle sue
   attività, oppure `-1` se non c'è (`?? -1` copre anche il caso di giorno assente).
3. Se giorno e attività esistono, `storage.saveDay` salva il giorno:
   - `...current` copia tutti i suoi dati (id, data, extra);
   - `timeline` viene sostituita da una nuova lista senza l'attività in posizione `index`.
4. `pendingDelete.set(null)` chiude la conferma.
5. `afterNextRender` aspetta che la riga eliminata sparisca, poi dà il focus
   al titolo "Attività registrate" (classe `recorded-title`).

**Note**
- Accessibilità: il titolo ha `tabindex="-1"` nel template, che permette di dargli
  il focus dal codice senza aggiungerlo al percorso del Tab. Funziona anche se
  l'elenco resta vuoto.
- `filter` crea una nuova lista invece di modificare quella esistente: i dati
  dello storage cambiano solo con `saveDay`, come in `save()` (5.9).
- In vista di un database: oggi l'eliminazione salva l'intero giorno senza l'attività.
  Con un database diventerà una richiesta di eliminazione della singola attività
  tramite il suo `id`, e i punti 4 e 5 andranno eseguiti dopo la risposta del server.

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

**Scopo**
Rende obbligatori solo i campi previsti per il tipo di attività scelto
e toglie l'obbligo a tutti gli altri.

**Quando viene chiamato**
Solo dall'interno del componente (`private`): dal 5.1, ogni volta che cambia
il tipo nel form (tendina, `resetForm` o `edit`).

**Come funziona**
1. `REQUIRED_BY_TYPE[type]` restituisce i campi obbligatori del tipo
   (es. `['book', 'author']` per `Reading`, `[]` per `Work`).
2. Il ciclo scorre `REQUIRED_FIELDS`, cioè tutti i campi che almeno un tipo
   rende obbligatori: `subject`, `book`, `author`, `sport`, `activity`.
3. Per ogni campo, `setValidators` imposta:
   - se il campo è tra quelli del tipo: `Validators.required` (non vuoto)
     e `Validators.pattern(/\S/)` (almeno un carattere che non sia uno spazio);
   - altrimenti: nessun validatore (`[]`).
4. `updateValueAndValidity` ricalcola subito se il campo è valido con le nuove regole.

**Note**
- `Validators.pattern(/\S/)` impedisce di salvare un campo che contiene solo spazi,
  che `Validators.required` da solo accetterebbe.
- `{ emitEvent: false }` evita che il ricalcolo faccia scattare `form.valueChanges`
  (5.1, punto 2), che nasconderebbe gli errori senza che l'utente abbia modificato nulla.
- Convenzione del progetto: le regole stanno solo qui e in `REQUIRED_BY_TYPE`.
  Nell'HTML i campi obbligatori hanno solo `aria-required="true"`, che deve
  corrispondere a questi validatori.

### 5.14 — isValidInterval(start, end)

```ts
private isValidInterval(start: string, end: string): boolean
{
  return start !== end;
}
```

**Scopo**
Controlla che l'intervallo inserito sia valido: inizio e fine devono essere diversi.

**Quando viene chiamato**
Solo dall'interno del componente (`private`): da `save()` (5.9, punto 2),
dopo il controllo dei campi obbligatori.

**Come funziona**
Restituisce `true` se `start` ed `end` sono diversi.

**Note**
- Gli altri controlli li fanno già altri: il formato `HH:mm` è garantito
  dai campi `type="time"`, un campo vuoto è bloccato da `Validators.required`.
- Qualsiasi coppia di orari diversi è valida: se la fine viene prima
  dell'inizio, l'attività finisce il giorno dopo (vedi 5.16).
- Il metodo resta separato per leggibilità e per ospitare eventuali regole future.

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

**Scopo**
Trasforma i valori del form nell'oggetto attività previsto dal modello
`TimelineEvent`, con solo i campi del tipo scelto.

**Quando viene chiamato**
Solo dall'interno del componente (`private`): da `save()` (5.9, punto 3),
prima del controllo delle sovrapposizioni.

**Come funziona**
1. `value` contiene tutti i campi del form (`ActivityFormValue`), anche quelli
   degli altri tipi, che sono vuoti.
2. `interval` raccoglie i dati comuni: inizio e fine completi di data, calcolati
   da `toDateTimes` (vedi 5.16), e, se non vuota, la nota.
3. Lo `switch` sceglie il tipo e costruisce l'oggetto finale:
   - `...interval` copia i dati comuni;
   - `type` indica il tipo di attività;
   - si aggiungono solo i campi di quel tipo (es. `book` e `author` per `Reading`).
4. Tutti i testi passano da `trim()`, che toglie gli spazi all'inizio e alla fine.

**Note**
- La forma `...(testo ? { campo: testo } : {})` aggiunge un campo facoltativo
  solo se ha un valore: se è vuoto, il campo non compare affatto nell'oggetto
  (invece di comparire come stringa vuota).
- I campi obbligatori (es. `subject`, `book`) sono sempre presenti: il form
  ha già garantito che non siano vuoti (5.13).
- Il `default` non dovrebbe mai scattare: è una rete di sicurezza nel caso
  arrivi un tipo non previsto.
- In vista di un database: l'oggetto creato è sempre nuovo. Quando le attività
  avranno un `id`, in modifica bisognerà conservare l'`id` dell'attività originale.

### 5.16 — toDateTimes(start, end)

```ts
private toDateTimes(start: string, end: string): { start: string; end: string }
{
  const day = this.startDay();
  const endDay = end > start ? day : this.shiftDay(day, 1);
  return { start: `${day}T${start}`, end: `${endDay}T${end}` };
}
```

**Scopo**
Trasforma i due orari del form (es. `23:00` e `07:00`) in date complete.
È l'unico punto in cui si decide se un'attività finisce il giorno dopo.

**Quando viene chiamato**
Solo dall'interno del componente (`private`): da `toEvent()` (5.15).

**Come funziona**
1. `day` è il giorno di inizio, `startDay()`: il giorno della finestra per
   un'attività nuova, il giorno di inizio originale per una in modifica.
2. Se la fine è dopo l'inizio (`end > start`), la fine è nello stesso giorno;
   altrimenti è nel giorno dopo, calcolato con `shiftDay(day, 1)` (vedi 5.17).
3. Restituisce inizio e fine completi, es.
   `{ start: '2026-11-15T23:00', end: '2026-11-16T07:00' }`.

**Note**
- Gli orari si confrontano come testi: funziona perché `HH:mm` ha sempre
  due cifre (`"07:00" > "23:00"` è falso).
- Un'attività si salva nel giorno in cui inizia. Per questo, modificando dal giorno
  di fine un'attività iniziata il giorno prima, gli orari del form si leggono
  rispetto al giorno di inizio (es. dal 19: `22:34` e `09:00` diventano
  `2026-11-18T22:34` → `2026-11-19T09:00`).
- Durata massima: meno di 24 ore. Inizio e fine uguali sono rifiutati da 5.14.
- I campi `type="time"` accettano ore da 00 a 23: non si può scrivere 24:00.
  Per questo l'intestazione della finestra mostra, sotto la data, il messaggio
  `DayActivityEditor.MidnightHint`: per iniziare un'attività alle 24:00 si apre
  il giorno successivo e la si inserisce con inizio alle 00:00.

### 5.17 — shiftDay(day, days)

```ts
private shiftDay(day: string, days: number): string
{
  return formatDate(dayjs(day).add(days, 'day').toDate());
}
```

**Scopo**
Restituisce la data spostata di un certo numero di giorni,
es. `shiftDay('2026-11-19', -1)` → `'2026-11-18'`.

**Quando viene chiamato**
Solo dall'interno del componente (`private`): da `save()` (5.9, giorni vicini
per le sovrapposizioni) e da `toDateTimes()` (5.16, giorno successivo).

**Come funziona**
1. `dayjs(day)` legge la data nel formato `YYYY-MM-DD`.
2. `add(days, 'day')` la sposta: `days` negativo va indietro, positivo in avanti.
3. `formatDate` la riporta al formato `YYYY-MM-DD` usato come chiave del giorno.

**Note**
- Raccoglie in un solo punto una formula che prima era ripetuta in più metodi.
- `dayjs` gestisce da solo i cambi di mese e di anno (es. dal 1 gennaio al 31 dicembre).
