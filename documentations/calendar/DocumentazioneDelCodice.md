# Calendar — documentazione del codice

## 1. Il componente in sintesi

Mostra un mese come una griglia di settimane intere, da lunedì a domenica, compresi
i giorni del mese precedente e successivo che completano la prima e l'ultima settimana.
Ogni giorno è un link alla sua pagina di dettaglio, dove se ne gestiscono le attività.
Il mese mostrato è letto dall'indirizzo (`?month=YYYY-MM`): le frecce in alto lo
cambiano, e tornando da un giorno si ritrova lo stesso mese.
Un puntino segnala i giorni con contenuti registrati, comprese le attività iniziate
il giorno prima e proseguite oltre la mezzanotte.
Il calendario legge i dati tramite `StorageService` ma non li modifica mai.
È pensato per essere usabile da tastiera e con screen reader: la griglia occupa una
sola fermata del Tab, ci si sposta con le frecce e ogni giorno ha un nome leggibile.
Compare nella pagina del calendario e nella home.

## 2. Librerie e import

### Angular — `@angular/core`
| Import | A cosa serve qui |
|---|---|
| `Component` | Dichiara la classe come componente Angular (selettore, template, stili). |
| `signal`, `computed` | Stato reattivo del calendario e valori derivati dal mese mostrato (es. `currentDate`, `calendarDays`). |
| `inject` | Ottiene i servizi necessari (`StorageService`, `ActivatedRoute`, `Router`, `Injector`). |
| `Injector` | Serve ad `afterNextRender` quando è chiamato dentro un metodo. |
| `afterNextRender` | Esegue codice dopo che Angular ha aggiornato la pagina (spostamento del focus con le frecce). |

### Angular — `@angular/core/rxjs-interop`
| Import | A cosa serve qui |
|---|---|
| `toSignal` | Trasforma i parametri dell'indirizzo in un signal, così il calendario si aggiorna quando cambia `?month=`. |
| `takeUntilDestroyed` | Interrompe l'ascolto dei cambi di lingua quando il calendario viene rimosso. |

### Angular — `@angular/router`
| Import | A cosa serve qui |
|---|---|
| `ActivatedRoute` | Dà accesso ai parametri dell'indirizzo della pagina in cui si trova il calendario. |
| `Router` | Cambia l'indirizzo quando si cambia mese. |
| `RouterLink` | Trasforma ogni cella in un link alla pagina di dettaglio del giorno. |

### Traduzioni — `@ngx-translate/core`
| Import | A cosa serve qui |
|---|---|
| `TranslateModule` | Rende disponibile nel template il pipe `translate` per i testi in italiano e inglese. |
| `TranslateService` | Fornisce la lingua corrente e ne segnala i cambi. |

### Date — `dayjs`
| Import | A cosa serve qui |
|---|---|
| `dayjs`, `Dayjs` | Calcoli sulle date (primo del mese, giorni da aggiungere, confronti) e loro scrittura come testo; `Dayjs` è il tipo di una data `dayjs`. |
| `dayjs/plugin/localeData` | Aggiunge a `dayjs` i nomi abbreviati dei giorni della settimana nella lingua scelta. |
| `dayjs/locale/it`, `dayjs/locale/en` | Nomi di mesi e giorni in italiano e in inglese. |

### File del progetto
| Import | Da dove | A cosa serve qui |
|---|---|---|
| `formatDate`, `parseDate` | `functions/date-utils` | Trasformano una data nel testo `YYYY-MM-DD` e viceversa, controllando che sia valida. |
| `eventsOnDay` | `functions/day-events` | Restituisce le attività di un giorno, incluse quelle iniziate il giorno prima. |
| `CalendarDay` | `models/calendar-day.model` | Tipo che descrive una cella della griglia (giorno, mese, anno e stati). |
| `StorageService` | `services/storage.service` | Fornisce le giornate salvate, per sapere quali giorni hanno contenuti. |

## 3. Blocchi di codice

### 1.1 — currentDate

```ts
currentDate = computed(() => {
  const month = parseDate(`${this.queryParams().get('month') ?? ''}-01`);
  return month ? dayjs(month) : this.today;
});
```

**Scopo**
Indica il mese mostrato dal calendario, letto dall'indirizzo della pagina.
È il punto di partenza di tutti gli altri calcoli: titolo, griglia e frecce.

**Quando viene chiamato**
È un `computed`: Angular lo ricalcola da solo ogni volta che cambia l'indirizzo
(`queryParams`). Lo leggono `focusDay` (1.2), `headerDescription` (1.3),
`calendarDays` (1.4), le frecce del mese (1.11) e `moveFocus` (1.12).

**Come funziona**
1. `queryParams` è un signal con i parametri dell'indirizzo (la parte dopo `?`),
   ottenuto con `toSignal` da `ActivatedRoute`.
2. `get('month')` legge il mese, per esempio `2027-03`; se manca, `?? ''` usa un testo vuoto.
3. Al mese si aggiunge `-01` per ottenere il primo giorno (`2027-03-01`), e
   `parseDate` controlla che sia una data valida.
4. Se è valida, `currentDate` è quella data in formato `dayjs`; altrimenti è `today`,
   cioè il mese corrente.

**Note**
- Tenere il mese nell'indirizzo fa sì che "indietro" del browser e il link "‹ Calendario"
  della pagina del giorno riportino allo stesso mese.
- Un indirizzo scritto a mano con un mese non valido (es. `?month=pippo`) non causa
  errori: si mostra il mese corrente.
- `currentDate` non si imposta mai direttamente: per cambiare mese si cambia
  l'indirizzo con `showMonth` (1.13).

### 1.2 — focusDay

```ts
focusDay = computed(() => {
  const first = this.currentDate().startOf('month');
  const active = this.activeDay();
  if (active?.startsWith(first.format('YYYY-MM'))) return active;
  return (this.today.isSame(first, 'month') ? this.today : first).format('YYYY-MM-DD');
});
```

**Scopo**
Decide quale giorno della griglia si raggiunge con il tasto Tab. Tutti gli altri
giorni si raggiungono con le frecce, così la griglia occupa una sola fermata del Tab.

**Quando viene chiamato**
È un `computed`: Angular lo ricalcola quando cambia il mese mostrato (`currentDate`, 1.1)
o il giorno raggiunto con le frecce (`activeDay`). Lo legge il template, nel `tabindex`
di ogni cella.

**Come funziona**
1. `first` è il primo giorno del mese mostrato.
2. `active` è l'ultimo giorno raggiunto con le frecce (`activeDay`, aggiornato da
   `moveFocus`, 1.12), oppure `null` se le frecce non sono ancora state usate.
3. Se `active` appartiene al mese mostrato (inizia con lo stesso `YYYY-MM`),
   il Tab porta lì.
4. Altrimenti il Tab porta su oggi, se oggi è nel mese mostrato, oppure sul primo del mese.
5. Il risultato è una data nel formato `YYYY-MM-DD`, la stessa usata da `dayKey` (1.7).

**Note**
- Nel template, la cella con `dayKey(day) === focusDay()` riceve `tabindex="0"`,
  che la rende raggiungibile con il Tab; tutte le altre ricevono `tabindex="-1"`,
  che le toglie dal percorso del Tab ma le lascia cliccabili e raggiungibili con le frecce.
- Dopo un cambio di mese con le frecce in alto, `activeDay` appartiene al mese
  precedente: per questo il controllo del punto 3 fa ricadere il Tab su oggi o sul primo.
- È lo schema consigliato dalle linee guida di accessibilità per le griglie di date.

### 1.3 — headerDescription

```ts
headerDescription = computed(() => {
  const title = this.currentDate().locale(this.currentLang()).format('MMMM YYYY');
  return title.charAt(0).toUpperCase() + title.slice(1);
});
```

**Scopo**
Restituisce il titolo del mese mostrato, nella lingua dell'app (es. "Novembre 2026").

**Quando viene chiamato**
È un `computed`: Angular lo ricalcola quando cambia il mese mostrato (`currentDate`, 1.1)
o la lingua (`currentLang`). Lo legge il template, nel titolo tra le due frecce.

**Come funziona**
1. `locale(this.currentLang())` scrive la data nella lingua corrente.
2. `format('MMMM YYYY')` produce nome del mese e anno (es. "novembre 2026").
3. La prima lettera viene resa maiuscola: in italiano `dayjs` scrive i mesi in minuscolo.

**Note**
- La lingua vale solo per questa data: l'impostazione globale di `dayjs` non viene
  toccata, così il comportamento degli altri componenti non dipende dal calendario.
- Nel template il titolo ha `aria-live="polite"`: quando cambia mese, lo screen reader
  annuncia il nuovo titolo.

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

**Scopo**
Costruisce l'elenco delle celle della griglia: settimane intere da lunedì a domenica,
compresi i giorni del mese precedente e successivo che completano la prima e l'ultima settimana.

**Quando viene chiamato**
È un `computed`: Angular lo ricalcola quando cambia il mese mostrato (`currentDate`, 1.1).
Lo legge il template, nel `@for` che disegna le celle.

**Come funziona**
1. `firstOfMonth` è il primo giorno del mese mostrato.
2. `leadingDays` conta i giorni del mese precedente da mostrare prima del primo.
   `day()` restituisce 0 per la domenica; `(day() + 6) % 7` sposta la numerazione
   in modo che il lunedì valga 0 e la domenica 6.
3. `totalCells` somma quei giorni a quelli del mese e arrotonda alla settimana intera
   successiva (multiplo di 7): la griglia ha 5 o 6 righe.
4. Per ogni cella `i`, `date` si ottiene partendo dal primo del mese e spostandosi di
   `i - leadingDays` giorni: le prime celle vanno indietro nel mese precedente,
   le ultime avanti nel mese successivo.
5. Per ogni giorno si ricavano anno, mese e numero da `date`, e gli stati usati dal template:
   - `currentMonth`: il giorno appartiene al mese mostrato;
   - `previousMonth` / `nextMonth`: il giorno è prima o dopo il mese mostrato;
   - `isToday`: il giorno è oggi, solo se appartiene al mese mostrato.

**Note**
- `dayjs` gestisce da solo i cambi di mese e di anno (es. da dicembre a gennaio):
  non servono calcoli a mano.
- Gli stati guidano lo stile (`[class.previous-month]`, `[class.today]`…) e il nome
  letto dallo screen reader (`dayLabel`, 1.9).
- `isToday` vale solo nel mese mostrato: così oggi appare evidenziato una sola volta,
  anche quando compare tra i giorni di un mese adiacente.

### 1.5 — constructor()

```ts
constructor(private translate: TranslateService) {
  this.updateLanguage(translate.getCurrentLang() || 'en');
  // takeUntilDestroyed interrompe l'ascolto della lingua quando Angular rimuove il calendario.
  translate.onLangChange.pipe(takeUntilDestroyed())
    .subscribe(event => this.updateLanguage(event.lang));
}
```

**Scopo**
Imposta la lingua iniziale del calendario e lo tiene aggiornato quando l'utente
cambia lingua.

**Quando viene chiamato**
Una sola volta, da Angular, quando il calendario viene creato.

**Come funziona**
1. `translate.getCurrentLang()` legge la lingua corrente dell'app; se non è ancora
   impostata, si usa l'inglese. `updateLanguage` (1.6) la applica al calendario.
2. `translate.onLangChange` segnala ogni cambio di lingua: a ogni segnale
   `updateLanguage` aggiorna di nuovo il calendario.
3. `takeUntilDestroyed()` interrompe l'ascolto quando il calendario viene rimosso
   (per esempio aprendo la pagina di un giorno), così non resta attivo in memoria.

**Note**
- `takeUntilDestroyed()` funziona solo dentro il `constructor`, perché è lì che Angular
  sa a quale componente collegarlo.

### 1.6 — updateLanguage(lang)

```ts
private updateLanguage(lang: string): void {
  this.currentLang.set(lang);
  const weekdays = dayjs().locale(lang).localeData().weekdaysShort()
    .map(g => g.charAt(0).toUpperCase() + g.slice(1));
  this.daysOfWeek = [...weekdays.slice(1), weekdays[0]];
}
```

**Scopo**
Applica una lingua al calendario: aggiorna la lingua usata per le date e i nomi
abbreviati dei giorni della settimana nell'intestazione della griglia.

**Quando viene chiamato**
Solo dall'interno del componente (`private`): dal `constructor` (1.5), all'avvio
e a ogni cambio di lingua.

**Come funziona**
1. `currentLang.set(lang)` aggiorna il signal della lingua: titolo del mese (1.3)
   e nomi dei giorni letti dallo screen reader (1.9) si ricalcolano da soli.
2. `localeData().weekdaysShort()` restituisce i nomi abbreviati dei giorni nella lingua
   scelta (es. "dom", "lun"…); ogni nome viene reso maiuscolo alla prima lettera.
3. `dayjs` elenca i giorni partendo dalla domenica: `[...weekdays.slice(1), weekdays[0]]`
   sposta la domenica in fondo, così l'intestazione parte dal lunedì come la griglia.

**Note**
- `localeData()` è disponibile grazie al plugin `dayjs/plugin/localeData`, attivato
  in cima al file con `dayjs.extend(localeData)`.
- `daysOfWeek` è un campo normale, non un signal: il template lo ridisegna insieme
  a `currentLang`, che cambia nello stesso momento.

### 1.7 — dayKey(day)

```ts
dayKey(day: CalendarDay): string {
  return formatDate(new Date(day.year, day.month, day.date));
}
```

**Scopo**
Restituisce la data di una cella nel formato `YYYY-MM-DD` (es. `2026-11-19`):
è la chiave usata per i dati, i link e il focus.

**Quando viene chiamato**
- dal template, negli attributi `data-date` e `tabindex` di ogni cella;
- da `dayLink` (1.8) e `hasContent` (1.10).

**Come funziona**
1. `new Date(day.year, day.month, day.date)` crea la data della cella.
2. `formatDate` la trasforma nel testo `YYYY-MM-DD`.

**Note**
- È lo stesso formato con cui le giornate sono salvate in `StorageService`
  e con cui compaiono nell'indirizzo della pagina del giorno (`/day/2026-11-19`).
- Raccoglie in un solo punto una conversione che serve in più parti del calendario.

### 1.8 — dayLink(day)

```ts
dayLink(day: CalendarDay): string[] {
  return ['/day', this.dayKey(day)];
}
```

**Scopo**
Restituisce l'indirizzo della pagina di dettaglio di un giorno.

**Quando viene chiamato**
Dal template, con `[routerLink]="dayLink(day)"` su ogni cella.

**Come funziona**
Restituisce un elenco con il percorso `/day` e la data della cella (1.7):
`RouterLink` lo trasforma nell'indirizzo `/day/2026-11-19`.

**Note**
- È usato anche da un test esistente (`app.routes.spec.ts`), che verifica le date
  a cavallo d'anno (es. 1 gennaio e 31 dicembre).

### 1.9 — dayLabel(day)

```ts
dayLabel(day: CalendarDay): string {
  return dayjs(new Date(day.year, day.month, day.date)).locale(this.currentLang()).format('dddd D MMMM YYYY');
}
```

**Scopo**
Restituisce la data di una cella scritta per esteso, nella lingua dell'app
(es. "giovedì 19 novembre 2026"). È il nome con cui lo screen reader legge il giorno.

**Quando viene chiamato**
Dal template, nell'`aria-label` di ogni cella.

**Come funziona**
1. Crea la data della cella e la scrive nella lingua corrente (`currentLang`).
2. `format('dddd D MMMM YYYY')` produce giorno della settimana, numero, mese e anno.

**Note**
- Nel template al nome si aggiungono "Oggi" (se `day.isToday`) e "Contenuti registrati"
  (se `hasContent`, 1.10), presi dalle traduzioni della legenda.
- Il giorno della settimana è importante per chi non vede: le celle non sono collegate
  all'intestazione con i nomi dei giorni, quindi non c'è altro modo di saperlo.
- Il nome si aggiorna da solo al cambio di lingua, perché legge il signal `currentLang`.

### 1.10 — hasContent(day)

```ts
hasContent(day: CalendarDay): boolean {
  const dateKey = this.dayKey(day);
  const days = this.storage.days();
  return eventsOnDay(days, dateKey).length > 0 || (days[dateKey]?.extra.length ?? 0) > 0;
}
```

**Scopo**
Indica se un giorno ha contenuti registrati: attività con orario oppure altre
informazioni (note, spese, promemoria…).

**Quando viene chiamato**
Dal template, per ogni cella:
- per mostrare il puntino sotto il numero;
- per aggiungere "Contenuti registrati" al nome letto dallo screen reader.

**Come funziona**
1. `dateKey` è la data della cella (1.7); `days` sono tutte le giornate salvate.
2. `eventsOnDay` restituisce le attività che toccano quel giorno, comprese quelle
   iniziate il giorno prima e proseguite oltre la mezzanotte.
3. `days[dateKey]?.extra` sono le informazioni senza orario salvate in quel giorno;
   `?? 0` copre il giorno senza dati.
4. Il giorno ha contenuti se c'è almeno un'attività o almeno un'informazione.

**Note**
- `storage.days()` è un signal: quando si salva o si elimina un'attività, il puntino
  si aggiorna da solo.
- Il calendario non conosce la regola della mezzanotte: la applica `eventsOnDay`,
  la stessa funzione usata dalla pagina del giorno e dalla finestra delle attività.
- In vista di un database: questa domanda ("il giorno ha contenuti?") potrà diventare
  una sola richiesta per tutto il mese, invece di un controllo per ogni cella.

### 1.11 — previousMonth() / nextMonth()

```ts
previousMonth(): void {
  this.showMonth(this.currentDate().subtract(1, 'month'));
}

nextMonth(): void {
  this.showMonth(this.currentDate().add(1, 'month'));
}
```

**Scopo**
Mostrano il mese precedente o quello successivo.

**Quando viene chiamato**
Dal template, con le due frecce ai lati del titolo del mese (`(click)`).

**Come funziona**
1. Partono dal mese mostrato (`currentDate`, 1.1) e tolgono o aggiungono un mese.
2. `showMonth` (1.13) scrive il nuovo mese nell'indirizzo: il calendario si aggiorna
   leggendolo da lì.

**Note**
- Le frecce hanno un `aria-label` tradotto ("Mese precedente", "Mese successivo"),
  perché il loro simbolo (❮ ❯) non avrebbe un nome per lo screen reader.

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

**Scopo**
Permette di muoversi tra i giorni con le frecce della tastiera: un giorno con
← e →, una settimana con ↑ e ↓. Se il giorno raggiunto è in un altro mese,
il calendario passa a quel mese.
Pensato per l'accessibilità: insieme a `focusDay` (1.2), fa sì che la griglia occupi
una sola fermata del Tab, invece di una per ogni giorno.

**Quando viene chiamato**
Dal template, con `(keydown)="moveFocus($event, day)"`: a ogni tasto premuto mentre
il focus è su una cella.

**Come funziona**
1. `steps` associa ogni freccia allo spostamento in giorni. Se il tasto non è una
   freccia (es. Invio o Tab), il metodo si ferma e il tasto fa il suo lavoro normale:
   Invio apre il giorno.
2. `event.preventDefault()` impedisce che la freccia faccia scorrere la pagina.
3. `target` è il giorno raggiunto; `key` la sua data `YYYY-MM-DD`.
4. `activeDay` ricorda il giorno raggiunto: `focusDay` (1.2) lo rende la cella
   raggiungibile con il Tab.
5. `focus` dà il focus alla cella con `data-date` uguale a `key`. Usa `afterNextRender`,
   che aspetta che Angular abbia aggiornato la griglia.
6. Se il giorno raggiunto è nel mese mostrato, il focus si sposta subito. Altrimenti
   prima si cambia mese con `showMonth` (1.13) e, a navigazione finita (`.then`),
   si sposta il focus.

**Note**
- `injector` serve ad `afterNextRender` perché è chiamato dentro un metodo
  e non nel `constructor`.
- Esempi: da 1 novembre, ← porta a ottobre con il focus sul 31; da 30 novembre,
  ↓ porta a dicembre con il focus sul 7.
- Gli screen reader hanno una propria modalità di lettura con le frecce, in cui leggono
  le celle senza passare da questo metodo: per loro tutti i giorni restano raggiungibili.
  Il beneficio pieno è per chi usa solo la tastiera.

### 1.13 — showMonth(date)

```ts
private showMonth(date: Dayjs): Promise<boolean> {
  return this.router.navigate([], { relativeTo: this.route, queryParams: { month: date.format('YYYY-MM') }, replaceUrl: true });
}
```

**Scopo**
Mostra il mese di una data scrivendolo nell'indirizzo (`?month=YYYY-MM`).
Il calendario non cambia mese direttamente: si aggiorna leggendo l'indirizzo
tramite `currentDate` (1.1).

**Quando viene chiamato**
Solo dall'interno del componente (`private`): dalle frecce del mese (1.11)
e da `moveFocus` (1.12), quando il giorno raggiunto è in un altro mese.

**Come funziona**
1. `router.navigate([], ...)` cambia l'indirizzo restando nella stessa pagina
   (`relativeTo: this.route`): cambia solo il parametro `month`.
2. `replaceUrl: true` sostituisce l'indirizzo invece di aggiungerne uno nuovo alla
   cronologia del browser.
3. Restituisce la `Promise` della navigazione, cioè un valore che si "completa" quando
   il cambio di indirizzo è finito: `moveFocus` la usa per spostare il focus al momento giusto.

**Note**
- Grazie a `replaceUrl`, "indietro" dal calendario porta alla pagina precedente,
  invece di ripercorrere uno per uno i mesi sfogliati.
- Funziona anche nella home: lì l'indirizzo diventa `/?month=2027-03`.
