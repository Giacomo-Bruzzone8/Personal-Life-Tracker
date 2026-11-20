# Day Activity Editor

## English

### What it does
`DayActivityEditor` connects the selected calendar day to its timeline: it lets you
add, edit and delete the timed activities of that day. It opens from the calendar
(right-click on a day → "Manage activities").
An activity can continue past midnight: it is saved in the day it starts and is
shown, and can be edited, in both days.
The window can be used entirely with the keyboard and with a screen reader.

### Activity types
Every activity has a start, an end and an optional note. Fields marked * are required.
- **Sleep**: dream
- **Work**
- **Study**: subject*, goal
- **Reading**: book*, author*
- **Sport**: sport*, workout
- **Free time**: hobby
- **Custom activity**: activity*, category

### Data
Activities are kept in memory by `StorageService` and are lost when the app is
reloaded. They will be saved in a database in the future.

Code details: [DocumentationCode.md](DocumentationCode.md)

---

## Italiano

### Cosa fa
`DayActivityEditor` fa da tramite tra il giorno selezionato nel calendario e la sua
timeline: permette di aggiungere, modificare ed eliminare le attività con orario di
quel giorno. Si apre dal calendario (clic destro su un giorno → "Gestisci attività").
Un'attività può proseguire oltre la mezzanotte: si salva nel giorno in cui inizia ed è
visibile, e modificabile, in entrambi i giorni.
La finestra è utilizzabile interamente da tastiera e con screen reader.

### Tipi di attività
Ogni attività ha un inizio, una fine e una nota facoltativa. I campi con * sono obbligatori.
- **Sonno**: sogno
- **Lavoro**
- **Studio**: materia*, obiettivo
- **Lettura**: libro*, autore*
- **Sport**: sport*, allenamento
- **Tempo libero**: passatempo
- **Attività personalizzata**: attività*, categoria

### Dati
Le attività sono conservate in memoria da `StorageService` e si perdono al
ricaricamento dell'app. In futuro verranno salvate in un database.

Dettagli del codice: [DocumentazioneDelCodice.md](DocumentazioneDelCodice.md)
