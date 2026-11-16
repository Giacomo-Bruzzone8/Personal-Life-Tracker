# Day Activity Editor

## Scopo e accesso

Il componente `DayActivityEditor` permette di aggiungere, modificare ed eliminare le
**attività temporali di un giorno**. Si apre come finestra sopra il calendario:
clic destro su un giorno, poi **Gestisci attività**. Non è una pagina con una
rotta propria e non fa parte del template del dettaglio del giorno.

Il [calendario](../../src/app/ui/calendar/calendar.ts) passa la data tramite
l'input obbligatorio `date`. Quando l'utente chiude la finestra con la X, con
**Esc** o facendo clic sullo sfondo, il componente emette `closed`; il
calendario rimuove quindi la finestra. All'apertura, il focus va al pulsante X.

Il codice del componente è diviso in
[TypeScript](../../src/app/ui/day-activity-editor/day-activity-editor.ts),
[template](../../src/app/ui/day-activity-editor/day-activity-editor.html) e
[stili](../../src/app/ui/day-activity-editor/day-activity-editor.scss).

## Dati gestiti

Il componente legge e aggiorna `DayDetail.timeline` attraverso
[StorageService](../../src/app/services/storage.service.ts). La timeline contiene
oggetti del tipo `TimelineEvent` definito in
[calendar-event.model.ts](../../src/app/models/calendar-event.model.ts):
`Sleep`, `Work`, `Study`, `Reading`, `Sport`, `FreeTime` e `CustomActivity`.

`DayDetail.extra` contiene invece informazioni **senza intervallo temporale**,
come spese, entrate, note e promemoria. Questo editor non le modifica: quando
salva una giornata, conserva il contenuto di `extra`. Queste informazioni non
generano archi nella timeline circolare e richiederanno una gestione dedicata.

Il modulo reattivo contiene i controlli comuni (`type`, `start`, `end`, `note`)
e quelli specifici dei vari tipi. Il template mostra i campi pertinenti alla
scelta corrente. Il tipo `ActivityFormValue` è ricavato dal valore del
`FormGroup`, senza ripetere l'elenco dei campi in un'interfaccia separata.
`toEvent()` trasforma poi i valori del modulo nell'oggetto `TimelineEvent`
previsto dal modello, includendo solo le proprietà del tipo scelto.

| Tipo | Campi specifici | Obbligatori |
| --- | --- | --- |
| Sonno (`Sleep`) | `dream` | Nessuno |
| Lavoro (`Work`) | — | Nessuno |
| Studio (`Study`) | `subject`, `goal` | `subject` |
| Lettura (`Reading`) | `book`, `author` | Entrambi |
| Sport (`Sport`) | `sport`, `workout` | `sport` |
| Tempo libero (`FreeTime`) | `hobby` | Nessuno |
| Attività personalizzata (`CustomActivity`) | `activity`, `category` | `activity` |

`start` ed `end` sono obbligatori per **tutti** questi tipi. I campi
specifici indicati come obbligatori non possono contenere solo spazi.
I colori e i titoli usati nell'elenco provengono da
[event-presentation.ts](../../src/app/models/event-presentation.ts), condiviso
con le altre viste.

## Inserimento, modifica ed eliminazione

Quando la finestra si apre, il modulo è pronto per una nuova attività.
**Salva** legge i valori, li valida, costruisce il `TimelineEvent` e lo aggiunge
alla timeline della giornata. Le attività vengono ordinate per inizio.
**Pulisci modulo** azzera i campi e torna alla modalità di inserimento.

Sotto il modulo compare l'elenco delle attività già registrate. **Modifica**
carica nel modulo l'attività scelta; il salvataggio sostituisce quell'elemento.
**Elimina** mostra prima una conferma: la rimozione avviene soltanto premendo
**Conferma**. La scelta **Annulla** lascia l'attività invariata.

Per modifica ed eliminazione il codice identifica l'elemento originale tramite
il suo riferimento nell'array corrente. Se durante la modifica l'elemento non
è più presente, il salvataggio viene interrotto.

## Regole sugli orari

Il form accetta valori nel formato locale `YYYY-MM-DDTHH:mm`. L'inizio deve
appartenere al giorno selezionato; la fine deve essere successiva all'inizio e
non oltre la mezzanotte del giorno dopo. Una fine alla mezzanotte successiva
viene mostrata nell'elenco come `24:00`.

Prima di salvare, `save()` confronta il nuovo intervallo con le attività già
presenti, escludendo l'attività originale in caso di modifica. Due attività
**non possono condividere tempo**. Gli estremi sono trattati come intervalli
`[inizio, fine)`: un'attività `09:00–10:00` può essere seguita da una
`10:00–11:00`, mentre `09:00–10:00` e `09:59–11:00` si sovrappongono.
Il confronto tra gli orari usa le stringhe nel formato uniforme indicato sopra.

Se la validazione fallisce, il salvataggio si ferma. La sovrapposizione usa
attualmente lo stesso messaggio generico previsto per un intervallo non valido;
il testo dell'interfaccia non distingue ancora le due cause.

## Stato attuale dei dati

`StorageService` condivide i dati in memoria tra calendario, dettaglio del giorno
e altri componenti. Le modifiche sono visibili nelle viste collegate, ma **si
perdono al ricaricamento dell'applicazione**. La persistenza nel browser o in
una base dati è prevista per una fase successiva.

---

## Nota generale: il focus

Il **focus** indica quale elemento della pagina riceve in questo momento i
comandi della tastiera. Se un campo di testo ha il focus, i caratteri digitati
finiscono lì; se lo ha un pulsante, **Invio** o **Spazio** possono attivarlo.
Con **Tab** si passa normalmente all'elemento interattivo successivo. Il focus
può cambiare per un'azione dell'utente oppure tramite il metodo JavaScript
`element.focus()`.

`@ViewChild` **non imposta il focus da solo**: è uno dei modi con cui un
componente Angular può ottenere il riferimento a un elemento del proprio
template. Solo la successiva chiamata a `focus()` sposta il focus. Dare il
focus a un pulsante non equivale a cliccarlo.

## Nota generale: i decoratori Angular

Un *decoratore* `@...` aggiunge informazioni che Angular usa per collegare il
codice della classe alla vista o agli eventi. `@HostListener` si applica a un
**metodo** e riguarda un evento; `@ViewChild` si applica a una **proprietà** e
riguarda un elemento o un componente presente nel template.

### `@HostListener`: reagire a un evento

La struttura generale è un decoratore con il nome dell'evento, seguito dal
metodo che Angular deve eseguire:

```typescript
@HostListener('click', ['$event'])
onClick(event: MouseEvent): void {
  // Usa l'evento per decidere cosa fare.
}
```

Senza un prefisso, l'evento è ascoltato sull'elemento che ospita il componente
o la direttiva. Il parametro facoltativo `['$event']` passa l'evento al metodo.
Si può indicare anche un bersaglio globale, per esempio `document:`, `window:`
o `body:`, e specificare un tasto con un nome come `keydown.escape`.

In **questo componente**, `@HostListener('document:keydown.escape')` chiama
`close()` quando viene premuto **Esc**. `close()` emette `closed` verso il
calendario. Il clic sulla X e quello sullo sfondo chiamano lo stesso metodo
tramite i collegamenti `(click)` nel template, senza usare `@HostListener`.

### `@ViewChild`: ottenere un riferimento dalla vista

Una forma comune usa un nome preceduto da `#` nel template e lo stesso nome
nel decoratore della classe:

```html
<button #actionButton>Conferma</button>
```

```typescript
@ViewChild('actionButton') button?: ElementRef<HTMLButtonElement>;

ngAfterViewInit(): void {
  this.button?.nativeElement.focus();
}
```

Angular cerca nella vista del componente il primo elemento che corrisponde a
`actionButton` e rende disponibile il riferimento nella proprietà `button`.
`ElementRef` permette di raggiungere l'elemento HTML tramite `nativeElement`.
L'esempio usa quel riferimento per dare il focus, ma `@ViewChild` può servire
anche a ottenere un componente figlio o a svolgere altre operazioni sulla
vista. `ngAfterViewInit()` è un punto in cui il risultato della ricerca è
disponibile; `?` e `?.` gestiscono il caso in cui non lo sia.

In **questo componente**, `@ViewChild('closeButton')` trova il pulsante X
contrassegnato con `#closeButton`. Dopo la creazione della vista,
`ngAfterViewInit()` chiama `this.closeButton?.nativeElement.focus()` per
spostare lì il focus. È la chiamata a `focus()`, non il decoratore, a compiere
quell'azione.

Riferimenti ufficiali: [Angular `HostListener`](https://angular.dev/api/core/HostListener)
e [Angular `ViewChild`](https://angular.dev/api/core/ViewChild).
