# Calendar

## English

### What it does
`Calendar` shows a month as a grid of whole weeks, from Monday to Sunday,
including the days of the previous and next month that complete the first
and last week. Selecting a day opens its detail page, where its activities
are managed. The arrows in the header move between months, and the shown
month is kept in the address, so going back from a day returns to the same month.
The calendar can be used entirely with the keyboard and with a screen reader:
Tab enters the grid on a single day, the arrow keys move by a day or a week
(changing month when needed), and Enter opens the day. Each day is read
with its full date, and also says whether it is today or has recorded content.

### What each day shows
- **Days of the previous and next month**: shown in a different colour.
- **Today**: highlighted.
- **Recorded content**: a dot under the number. It also appears on the day
  where an activity started the day before ends after midnight.

### Data
The calendar only reads the days kept in memory by `StorageService`, which are
lost when the app is reloaded; it never changes them. They will be saved in a
database in the future.

Code details: [DocumentationCode.md](DocumentationCode.md)

---

## Italiano

### Cosa fa
`Calendar` mostra un mese come una griglia di settimane intere, da lunedì a
domenica, compresi i giorni del mese precedente e successivo che completano
la prima e l'ultima settimana. Selezionando un giorno si apre la sua pagina
di dettaglio, dove se ne gestiscono le attività. Le frecce in alto cambiano
mese, e il mese mostrato resta nell'indirizzo: tornando da un giorno si
ritrova lo stesso mese.
Il calendario è utilizzabile interamente da tastiera e con screen reader:
il Tab entra nella griglia su un solo giorno, le frecce si spostano di un
giorno o di una settimana (cambiando mese se serve) e Invio apre il giorno.
Ogni giorno viene letto con la data completa, e dice anche se è oggi o se ha
contenuti registrati.

### Cosa mostra ogni giorno
- **Giorni del mese precedente e successivo**: hanno un colore diverso.
- **Oggi**: è evidenziato.
- **Contenuti registrati**: un puntino sotto il numero. Compare anche nel
  giorno in cui finisce un'attività iniziata il giorno prima e proseguita
  oltre la mezzanotte.

### Dati
Il calendario legge soltanto le giornate conservate in memoria da
`StorageService`, che si perdono al ricaricamento dell'app; non le modifica
mai. In futuro verranno salvate in un database.

Dettagli del codice: [DocumentazioneDelCodice.md](DocumentazioneDelCodice.md)
