# Progettazione — Modulo "Gestione casa"

> Stato: **proposta di design**, settembre 2026. Nessuna riga di codice e nessuna
> migrazione applicata. Questo documento serve a decidere *cosa* costruire e
> soprattutto *cosa non* costruire, prima di aprire l'editor.

---

## 1. Perché questo modulo, e la lezione di "Le mie auto"

Casa Nostra rende trasparente una cosa che tra conviventi si misura male: **chi ha
anticipato quanto**. Il modulo "Gestione casa" prova a fare lo stesso con la
seconda cosa che si misura male, e che genera molto più attrito della prima:
**chi fa cosa in casa**.

C'è però un precedente da tenere presente. Il 2 settembre il modulo "Le mie auto"
è stato rimosso del tutto — codice, tabelle, documentazione — perché era
*owner-scoped, invisibile all'altro partner, fuori dallo scope condiviso*
(`docs/dev-log-2026-09-02.md`). La lezione operativa non è "niente moduli nuovi",
è: **un modulo sopravvive solo se è condiviso per natura e si usa tutti i
giorni**. Le faccende domestiche superano entrambi i test meglio delle spese
stesse: sono condivise per definizione e la frequenza di interazione è
giornaliera, non mensile.

Il criterio di successo del modulo è quindi uno solo, mutuato dai requisiti MVP:
**registrare una faccenda fatta deve costare un tap e meno di 5 secondi**. Se
costa di più, nessuno lo farà dopo aver lavato i piatti alle 22:30, i dati
saranno incompleti, e un modulo con dati incompleti è peggio di nessun modulo —
perché il punteggio parziale diventa una fonte di discussione invece che di
chiarezza.

---

## 2. Il rischio: la gamification a due è quasi sempre tossica

Vale la pena essere espliciti sul motivo, perché è tutto il design che segue a
discendere da qui.

La gamification funziona bene su grandi numeri (classifiche con centinaia di
persone, dove il confronto è astratto) e funziona male con **N = 2**. Con due
giocatori:

* ogni classifica è un **confronto diretto e personale**: non esiste "sono
  ventesimo", esiste solo "sto perdendo contro la persona con cui vivo";
* ogni punteggio cumulativo diventa un **debito morale**: 400 XP contro 120 XP
  non è un gioco, è la prova documentale di un'accusa;
* il divario, una volta creato, **non è più recuperabile**, quindi chi è
  indietro smette di giocare e chi è avanti ha in mano un argomento;
* l'app diventa uno **strumento di rinfaccio**: "guarda l'app" è la frase che
  chiude una discussione, non che la apre.

C'è un secondo rischio, più sottile, specifico di quest'app: **Casa Nostra sa già
contare i soldi**. La tentazione di collegare i due moduli ("chi fa meno faccende
paga una quota maggiore") va respinta senza discussione. Nel momento in cui una
faccenda ha un prezzo, l'altro può *comprarsi* il diritto di non farla, e la
collaborazione domestica diventa una transazione. Sarebbe la fine del modulo e,
verosimilmente, un problema che l'app non dovrebbe creare.

Sotto, otto principi che tengono la gamification dal lato utile.

---

## 3. Principi di design

**1. L'obiettivo primario è condiviso, non individuale.**
Il numero grande in cima alla schermata è quello **della casa**, non della
persona: XP della settimana accumulati da entrambi verso un obiettivo comune,
più la *striscia* (streak) di settimane in cui l'obiettivo è stato raggiunto. Si
vince o si perde insieme. Il contributo individuale esiste, ma non è mai l'eroe
della pagina.

**2. Nessun debito di faccende.**
Le spese accumulano un saldo perché quel saldo si chiude con un bonifico. Le
faccende **non hanno un conguaglio**: nessun "mi devi 12 piatti". La conseguenza
tecnica è netta — niente `net_position` delle faccende, niente vista di saldo,
niente RPC di pareggio. È l'unica differenza architetturale importante rispetto
al modulo spese, ed è voluta.

**3. Gli XP si azzerano.**
Il punteggio è **stagionale**: la stagione è la settimana (per l'obiettivo di
casa) e il mese (per i titoli). Il totale storico non viene mai mostrato come
metrica di confronto. Azzerare regolarmente è il meccanismo che impedisce
matematicamente al divario di diventare incolmabile: ogni lunedì si riparte da
zero a zero.

**4. Il peso è nello sforzo, non nel conteggio.**
Ogni faccenda ha un valore in XP fissato *a catalogo*, tarato sui minuti reali
(pulire il bagno ≈ 25, portare fuori la spazzatura ≈ 5). Il conteggio nudo delle
faccende premierebbe chi ne fa dieci da trenta secondi. Il valore è deciso una
volta insieme e modificabile nelle impostazioni del modulo: se uno dei due pensa
che stendere il bucato valga più di 10, si cambia il numero e non se ne parla
più — la discussione avviene sul catalogo, a freddo, non sul singolo evento.

**5. Nessuno assegna niente all'altro.**
Questa è la regola che salva il modulo. Un'app che permette di assegnare "pulisci
il bagno entro domani" al partner è un **proxy per il rimprovero**, con la
aggravante di essere scritto e con notifica. Il modello è invece **backlog +
claim**: c'è una lista condivisa di cose da fare, si prende quello che si fa. Al
massimo l'app *suggerisce* chi tocca, sulla base di chi l'ha fatta l'ultima
volta, e il suggerimento non è vincolante né notificato.

**6. Riconoscere vale quanto fare.**
Su ogni faccenda completata dall'altro si può lasciare un *kudos* (una reazione:
❤️ 🙏 👏 💪). Il kudos accredita XP **all'obiettivo della casa**, non a chi lo
riceve né a chi lo dà. Meccanicamente è il modo di rendere il ringraziamento una
mossa del gioco: l'unico modo di "fare punti" senza pulire è accorgersi di quello
che ha fatto l'altro.

**7. Mai in negativo, mai in rosso.**
Niente penalità, niente XP tolti, niente attività "scadute" in rosso con badge di
allarme. Una faccenda non fatta è semplicemente ancora in lista, con un garbato
"da 4 giorni". L'app non usa mai le parole "in ritardo", "hai fatto meno",
"tocca a te". Il rosso, in questo modulo, non esiste come colore semantico —
esattamente come nel modulo spese il saldo non è mai rosso perché è un saldo di
coppia (`docs/wiki/08-patterns.md`).

**8. La gamification si può spegnere.**
Un interruttore nelle impostazioni nasconde XP, obiettivo, striscia e titoli. Con
l'interruttore spento resta una **lista di faccende condivisa con lo storico di
chi le ha fatte l'ultima volta**, che deve essere utile da sola. Questo è anche
il test di progettazione: se il modulo senza punteggio non serve a niente,
allora il punteggio sta compensando un prodotto debole.

### L'equilibrio, e come si mostra

Il dato "chi ha fatto quanto questa settimana" esiste ed è legittimo: è il motivo
per cui si costruisce il modulo. Il punto è **come** si mostra.

* Una sola barra orizzontale, due segmenti con i colori dei due profili, senza
  numeri sopra.
* **Zona morta ampia**: qualsiasi ripartizione fra **30% e 70%** viene
  etichettata "in equilibrio", senza percentuali e senza evidenziare nessuno dei
  due. Le settimane normali devono quindi apparire *tutte uguali*. La soglia è
  volutamente generosa e vive in una costante di configurazione: vedi la
  simulazione in sezione 5, che la fa scattare da 35–65% a 30–70% prima ancora
  del primo rilascio.
* Le percentuali compaiono solo fuori dalla zona morta, e con un testo neutro e
  orientato al futuro ("questa settimana ha spinto soprattutto Andrea"), mai
  accusatorio verso chi ha fatto meno.
* La barra si riferisce **sempre e solo alla settimana corrente**. Non esiste una
  vista "equilibrio storico degli ultimi 6 mesi": sarebbe l'arma da rinfaccio
  definitiva. Lo storico serve a ricordare *quando* è stata pulita l'ultima
  volta una cosa, non chi è in credito di fatica.

---

## 4. Titoli

I titoli sono la parte più divertente e quella più facile da sbagliare. Regole:

* **Non sono gerarchici.** Niente "Livello 5" contro "Livello 2", niente
  "Campione" contro "Sfidante". Un titolo descrive *cosa fai spesso*, non
  *quanto vali*: "Signore delle Stoviglie", "Custode del Secchio", "Sentinella
  della Lavatrice", "Ammiraglio dei Fornelli", "Giardiniere del Davanzale".
* **Non sono comparativi.** Un titolo si ottiene superando una soglia assoluta
  ("8 volte in un mese"), mai battendo l'altro. È strutturalmente possibile che
  entrambi abbiano lo stesso titolo nello stesso mese, ed è un esito
  desiderabile, non un bug.
* **Premiano la varietà e la costanza, non il volume.** Esempi: *Tuttofare* —
  almeno una faccenda in 5 aree diverse nel mese; *Persona Affidabile* — la
  stessa faccenda ricorrente completata per 4 settimane di fila; *Gentile* — 10
  kudos lasciati in un mese.
* **Sono mensili e si rinnovano.** A inizio mese la bacheca è vuota per
  entrambi. Un titolo perso non è una retrocessione: è una stagione nuova.
* **Ci sono titoli di casa**, che si ottengono insieme e si mostrano su un'unica
  card: "Casa in Ordine" (obiettivo settimanale raggiunto 4 settimane di fila).

Implementazione consigliata: **i titoli non sono una tabella**. Sono predicati
deterministici in `lib/chores/titles.ts` valutati sugli aggregati del mese. Dato
che i log sono di fatto immutabili, ricalcolare il mese scorso dà sempre lo
stesso risultato: niente tabella da mantenere, niente cron di assegnazione a fine
mese, niente stato che può divergere dai dati. Cambiare le soglie è una modifica
di codice, non una migrazione.

---

## 5. Modello di dominio (bozza)

Tre tabelle. Segue le convenzioni dello schema esistente: enum dedicato, RLS via
`public.is_authorized_user()`, commenti sulle tabelle, indici sulle query
frequenti, snapshot dei valori che possono essere ritarati nel tempo.

```sql
-- Aree della casa: servono a raggruppare in UI e alimentano il titolo "Tuttofare".
CREATE TYPE chore_area AS ENUM (
  'cucina', 'bagno', 'pulizie', 'spazzatura', 'bucato', 'spesa', 'manutenzione', 'altro'
);

-- Catalogo delle faccende. Modificabile dai due utenti dalle impostazioni del modulo.
CREATE TABLE public.chore_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(trim(name)) > 0),
  area          chore_area NOT NULL,
  effort_xp     int NOT NULL CHECK (effort_xp BETWEEN 1 AND 100),
  cadence_days  int CHECK (cadence_days > 0),   -- NULL = nessuna ricorrenza attesa
  active        boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Registro dei completamenti. Append-only nell'uso normale.
CREATE TABLE public.chore_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid REFERENCES public.chore_templates(id) ON DELETE SET NULL,
  title        text NOT NULL CHECK (length(trim(title)) > 0),  -- snapshot del nome
  area         chore_area NOT NULL,                            -- snapshot
  xp           int NOT NULL CHECK (xp >= 0),                   -- snapshot
  done_by      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  done_at      timestamptz NOT NULL DEFAULT now(),   -- retrodatabile
  note         text,
  created_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chore_logs_done_at   ON public.chore_logs (done_at DESC);
CREATE INDEX idx_chore_logs_template  ON public.chore_logs (template_id, done_at DESC);
CREATE INDEX idx_chore_logs_done_by   ON public.chore_logs (done_by, done_at DESC);

-- Reazioni sulle faccende dell'altro.
CREATE TABLE public.chore_kudos (
  log_id        uuid NOT NULL REFERENCES public.chore_logs(id) ON DELETE CASCADE,
  from_user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji         text NOT NULL DEFAULT '❤️',
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (log_id, from_user_id)
);
```

Note di modellazione:

* **`title`, `area` e `xp` sono snapshot** sulla riga di log, esattamente come
  `custom_other_share` fotografa la quota al momento della spesa. Se fra sei mesi
  decidete che il bagno vale 30 XP invece di 25, la storia non si riscrive e le
  strisce passate restano quelle che erano.
* **`template_id` è nullable con `ON DELETE SET NULL`**: si può registrare una
  faccenda fuori catalogo ("smontato la tenda del balcone") e si può togliere una
  voce dal catalogo senza perdere lo storico.
* **`done_by` e `created_by` sono distinti.** Di norma coincidono, ma registrare
  una faccenda *per conto dell'altro* ("ha lavato lui i piatti, lo segno io") è un
  gesto gentile e va permesso. La distinzione serve anche a decidere chi può
  correggere una riga (vedi RLS sotto).
* **Nessuna tabella di assegnazioni**, per il principio 5. Non c'è `assigned_to`,
  non c'è `due_date` per persona. La scadenza è derivata dalla cadenza, ed è
  della casa.
* **Il divieto di auto-kudos sta in RLS**, non nel client:

```sql
CREATE POLICY "chore_kudos_insert_other" ON public.chore_kudos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_user()
    AND from_user_id = auth.uid()
    AND (SELECT done_by FROM public.chore_logs WHERE id = log_id) <> auth.uid()
  );
```

### Personalizzazione: il catalogo è interamente modificabile

Requisito esplicito: i due utenti devono poter **creare, modificare ed eliminare**
le faccende ricorrenti, e **registrarne una in qualsiasi momento**, anche fuori
dalla sua cadenza. Nessuna parte del catalogo è cablata nel codice: il seed della
sezione 5 è solo il contenuto iniziale della tabella, non una costante.

**Sul catalogo** (`chore_templates`), da `/casa/catalogo` raggiungibile dal menu
del modulo:

* **Creare** una voce: nome, area, XP, cadenza. La cadenza può essere lasciata
  vuota, e in quel caso la voce nasce come *gesto* (vedi sopra): registrabile ma
  mai attesa.
* **Modificare** qualsiasi campo, cadenza compresa — alzare o abbassare gli XP,
  cambiare area, trasformare una ricorrente in un gesto e viceversa.
* **Eliminare**: **soft delete** con `active = false`, non `DELETE`. Una voce
  disattivata sparisce dalle liste e dai conti futuri ma **lo storico resta
  intatto**, con i suoi XP e le sue strisce. La cancellazione fisica è ammessa
  solo per una voce che non ha mai avuto log — cioè per rimediare a un errore di
  battitura, non per riscrivere il passato. È anche il motivo per cui `title`,
  `area` e `xp` sono snapshot sul log: una voce eliminata continua a raccontare
  correttamente le settimane in cui esisteva.

**Sulla registrazione** (`chore_logs`):

* **Fuori cadenza**: ogni faccenda attiva è registrabile in qualsiasi momento,
  anche se non è "scaduta". La lista "Da fare" ordina per urgenza, ma è un
  suggerimento di ordinamento, non un filtro: sotto c'è sempre il catalogo
  completo, e dal FAB si arriva a qualsiasi voce con una ricerca. Registrare una
  cosa in anticipo non deve costare più di registrarla in ritardo.
* **Retrodatare**: `done_at` è modificabile. "L'ho fatto ieri e mi sono
  dimenticato di segnarlo" è il caso più frequente in assoluto in un'app di
  tracciamento, e se non è previsto il dato si sporca in una settimana.
* **Fuori catalogo**: la faccenda una-tantum dal FAB (nome, area, XP), con
  `template_id` nullo — già deciso al punto 4.
* **Correggere ed eliminare** una registrazione: sempre possibile sulle proprie.

Il permesso di correzione sta in DB, non nel client:

```sql
-- Chiunque dei due puo' registrare (anche per conto dell'altro).
CREATE POLICY "chore_logs_insert" ON public.chore_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user() AND created_by = auth.uid());

-- Ma si corregge o si cancella solo cio' che si e' fatto o che si e' scritto.
CREATE POLICY "chore_logs_modify_own" ON public.chore_logs FOR UPDATE
  TO authenticated
  USING (done_by = auth.uid() OR created_by = auth.uid())
  WITH CHECK (done_by = auth.uid() OR created_by = auth.uid());

CREATE POLICY "chore_logs_delete_own" ON public.chore_logs FOR DELETE
  TO authenticated
  USING (done_by = auth.uid() OR created_by = auth.uid());
```

È l'unico punto in cui questo modulo è **più restrittivo** del modulo spese, dove
entrambi gli utenti possono modificare qualsiasi riga (`expenses_all_authorized`).
La ragione è che una spesa è un fatto contabile condiviso, mentre una riga di
`chore_logs` dice *«questa cosa l'ho fatta io»*: poter cancellare con un tap il
contributo registrato dall'altro è una possibilità che non deve esistere, e non
perché qualcuno la userebbe in malafede — perché il solo fatto che sia possibile
cambia la natura del registro.

### Il rovescio della personalizzazione

Un catalogo pienamente modificabile risolve un problema e ne apre un altro. La
sezione "Chi tara il catalogo" trattava la taratura come una decisione iniziale
da prendere insieme; se i valori sono editabili per sempre da entrambi, **quella
decisione non si chiude mai**. Un punteggio i cui pesi possono cambiare in
silenzio a partita in corso non è una misura di cui ci si fida.

Due contromisure, entrambe economiche:

1. **Gli XP sono snapshot** (già deciso): ritoccare il catalogo non riscrive
   nemmeno un XP dello storico. Chi cambia un valore cambia il futuro, mai il
   passato — il che rende una modifica un atto onesto invece che un sospetto.
2. **Le modifiche al catalogo sono visibili.** Cambiare il valore di una faccenda
   è uno dei pochi eventi che merita la notifica immediata su Telegram ("il
   bagno ora vale 30 XP invece di 25"), insieme a obiettivo raggiunto e nuovo
   titolo. Non è controllo: è che una modifica annunciata è una proposta, mentre
   la stessa modifica fatta in silenzio è una furbizia — e il costo di renderla
   visibile è una riga di codice in un punto in cui la notifica esiste già.

### Viste di calcolo

Come per il saldo, **i conti stanno nel database** — non ricalcolati a mano nel
client, nell'assistente e nel bot Telegram, che divergerebbero al primo refactor.

* `v_chore_status` — per ogni template attivo: ultimo completamento (`done_at`,
  `done_by`) via `LATERAL`, giorni trascorsi, e `due_in_days` derivato da
  `cadence_days`. È la vista che ordina la schermata principale. **Nessuna riga
  viene generata dalla ricorrenza**: lo stato "da fare" è calcolato, non
  materializzato. Niente cron, niente righe fantasma da pulire.
* `v_chore_week` — XP e conteggi per utente per settimana ISO
  (`date_trunc('week', done_at)`), inclusi gli XP da kudos attribuiti alla casa.
  Alimenta obiettivo, barra di equilibrio e striscia.
* `v_chore_month` — gli stessi aggregati per mese, più il conteggio di aree
  distinte e la lunghezza delle serie per template: è l'input dei titoli.

### Catalogo iniziale

Tarato sulla casa reale: **niente lavastoviglie**, niente stiro, niente piante,
balcone, giardino o animali. La spesa si fa sia insieme sia da soli, **la
lavatrice una volta a settimana**, le lenzuola ogni due. XP ≈ minuti di lavoro,
arrotondati.

**Il pranzo non è nel catalogo, il pranzo *dell'altro* sì.** I due non pranzano
quasi mai insieme, quindi il pranzo è una cosa che ognuno fa per sé: non è lavoro
*per la casa* e non entra nei conti. Capita però che il pranzo da portare al
lavoro il giorno dopo lo prepari l'altra persona, e quello è lavoro fatto **per
qualcun altro**, ricorrente e finora invisibile. Da qui la voce "Preparare il
pranzo all'altro", con la regola scritta nel nome: **si registra solo quando lo
prepari per l'altro, mai quando te lo prepari da solo**. Con due sole persone il
nome è già la regola, non serve modellare il destinatario nello schema. La voce si chiama per questo "Cucinare la cena" e non "il pasto
principale" — un nome ambiguo avrebbe reso incerto cosa registrare, e
l'incertezza su cosa vale un punto è il primo modo in cui un punteggio perde
credibilità. Il bucato settimanale ha carichi più grossi di uno ogni tre giorni,
quindi stendere e piegare valgono di più a parità di gesto (15 e 20 invece di
10 e 15).

| Faccenda | Area | XP | Cadenza |
|---|---|---:|---:|
| Cucinare la cena | cucina | 20 | 1 g |
| Preparare il pranzo all'altro | cucina | 8 | — |
| Lavare i piatti a mano | cucina | 20 | 1 g |
| Sparecchiare e riordinare la cucina | cucina | 8 | 1 g |
| Pulire il piano cottura | cucina | 10 | 3 gg |
| Pulire il frigo / buttare l'avanzato | cucina | 10 | 14 gg |
| Fare la spesa | spesa | 30 | 7 gg |
| Giro di riordino (mini task) | pulizie | 5 | 1 g |
| Riordinare il soggiorno | pulizie | 10 | 3 gg |
| Aspirare / spazzare | pulizie | 20 | 4 gg |
| Lavare i pavimenti | pulizie | 25 | 7 gg |
| Spolverare | pulizie | 15 | 14 gg |
| Pulire il bagno a fondo | bagno | 25 | 7 gg |
| Lavandino e specchio | bagno | 8 | 3 gg |
| Fare la lavatrice | bucato | 10 | 7 gg |
| Stendere il bucato | bucato | 15 | 7 gg |
| Ritirare e piegare | bucato | 20 | 7 gg |
| Cambiare le lenzuola | bucato | 15 | 14 gg |
| Cambiare gli asciugamani | bucato | 5 | 7 gg |
| Portare fuori la spazzatura | spazzatura | 5 | 2 gg |
| Vetro / plastica / carta | spazzatura | 8 | 7 gg |
| Rifare il letto | altro | 3 | 1 g |

**Tetto teorico: 668 XP/settimana** sulle 21 voci ricorrenti (il gesto a
cadenza libera non ci entra, vedi sotto). Distribuzione per area:

| Area | XP/settimana | Peso |
|---|---:|---:|
| Cucina | 364 | **55%** |
| Pulizie | 126 | 19% |
| Bucato | 58 | 9% |
| Bagno | 44 | 6% |
| Spesa | 30 | 4% |
| Spazzatura | 26 | 4% |
| Altro (letto) | 21 | 3% |

**Senza lavastoviglie la cucina è metà della casa.** Non è un difetto della
taratura, è la casa: cucinare, lavare a mano e sparecchiare sono tre gesti
quotidiani che insieme valgono 336 XP a settimana, più di tutto il resto messo
insieme. Cucinare pesa il 21% del sistema, piatti + sparecchiare il 29%. Con la
lavatrice settimanale il bucato scende al 9%, e lo sbilanciamento verso la cucina
si accentua ancora.

### I "gesti": registrabili ma mai attesi

"Preparare il pranzo all'altro" ha **cadenza `NULL`**, e non per pigrizia di
taratura. Una faccenda con cadenza finisce nella lista "Da fare" e prima o poi
compare con scritto "da 3 giorni": su un favore, quella riga diventa *«non
prepari il pranzo al tuo compagno da tre giorni»*, cioè il rimprovero
automatizzato che il principio 5 esclude. Un gesto che diventa un'aspettativa
smette di essere un gesto.

Nasce così una seconda classe di voci, che lo schema già supporta senza modifiche
(`cadence_days` è nullable):

* **Faccende ricorrenti** (`cadence_days` valorizzato) — la casa se le aspetta,
  compaiono in "Da fare", contribuiscono al tetto teorico.
* **Gesti** (`cadence_days IS NULL`) — si registrano quando capitano, danno XP
  come tutto il resto, ma **non compaiono mai in "Da fare"** e non hanno uno
  stato "in ritardo". In UI stanno in una sezione a parte del FAB, non nella
  lista principale.

Conseguenza sui conti: i gesti non entrano nel tetto teorico ma entrano negli XP
effettivi, quindi il totale di una settimana reale può superare la somma delle
cadenze. Non è un problema, perché l'obiettivo settimanale si fissa sui dati
raccolti in fase 1 e non sul tetto.

### Obiettivo settimanale

668 è un tetto teorico che nessuna settimana raggiunge davvero: le cadenze sono
il caso ideale, non la vita. Al 70% sarebbero ~475 XP, ma è una stima da carta.
**Il valore iniziale si fissa dopo la fase 1**, sulla mediana delle prime due
settimane reali, arrotondando leggermente al ribasso. Un obiettivo che si manca
sempre demoralizza, uno che si raggiunge il mercoledì non dice niente, e nessuno
dei due si indovina a tavolino.

### Verifica: la zona morta regge?

Vale la pena simulare la divisione dei compiti reale prima di scrivere codice.
Ipotesi: una persona cucina praticamente sempre, l'altra fa piatti, sparecchia,
tiene in ordine, pulisce bagno e pavimenti, il resto si divide a metà.

    252 XP  /  416 XP   →   38% / 62%

Il risultato cade dentro la zona morta, quindi la barra non emette verdetti: due
persone con una divisione dei compiti asimmetrica ma funzionante vedono la stessa
schermata neutra di due persone che fanno tutto a metà. È il comportamento
voluto. **Ma il margine è sottile**: 38% dista 2,7 punti dal bordo dei 35%, e
basta ritoccare il valore della cena per uscirne.

| "Cucinare la cena" | Ripartizione | Zona morta 35–65% (ipotesi iniziale) |
|---|---|---|
| 15 XP | 34% / 66% | **fuori** |
| 20 XP | 38% / 62% | dentro, per 2,7 punti |
| 25 XP | 41% / 59% | dentro |
| 30 XP | 44% / 56% | dentro |

**Raccomandazione: allargare la zona morta a 30–70%.** Il documento aveva già la
regola — se la barra risulta cronicamente sbilanciata, si allarga la zona morta e
non si ritocca la taratura — e la simulazione la fa scattare prima ancora di
scrivere una riga di codice. Il motivo non è indulgenza: in questa casa una delle
due persone lavora fuori tutto il giorno, quindi una ripartizione 62/38 delle
faccende non è uno squilibrio da segnalare, è probabilmente **l'assetto giusto**.
Una zona morta che etichetta come squilibrata una casa che funziona non sta
misurando l'equilibrio, sta misurando la differenza fra le due giornate — che è
esattamente ciò che il modulo non sa e non deve fingere di sapere. Oltre il
70/30 c'è invece qualcosa di cui vale la pena parlare.

Conseguenza pratica: la soglia va tenuta come **una costante di configurazione**
(`lib/chores/config.ts`), non sparsa nel codice della card. Sarà il primo numero
da rivedere dopo un mese d'uso.

### Due limiti strutturali, da dire ad alta voce

**1. Il catalogo sottopesa i mini task.** Un sistema a voci discrete premia le
faccende *enumerabili, rituali e visibili* (cucinare, pulire il bagno) e
sottovaluta il contributo diffuso — rimettere a posto le cose in giro, buttare
una cosa, sistemare al volo — che è lavoro vero ma non ha un momento preciso in
cui "è fatto". La voce "Giro di riordino" (5 XP, quotidiana) e la faccenda fuori
catalogo dal FAB sono cerotti, non soluzioni: chi contribuisce così sarà sempre
misurato per difetto. È un'altra ragione per cui la barra non è un verdetto.

**2. L'app misura i minuti in casa, non le giornate.** Non sa nulla delle ore di
lavoro retribuito, quindi 50/50 sulle faccende fra chi lavora dieci ore e chi ne
lavora quattro non è "giusto", e 40/60 potrebbe esserlo perfettamente. Il modulo
spese affronta la stessa asimmetria in modo esplicito, con `higher_income` e la
regola 60/40; qui la scelta è **non** replicare quel meccanismo. Una "quota
attesa" per persona renderebbe possibile la frase "hai fatto meno del tuo
obiettivo", che è precisamente il verdetto che il modulo esiste per evitare. La
zona morta ampia ottiene il risultato utile senza formalizzare un'aspettativa.
La card dell'equilibrio porta un testo fisso e piccolo che lo dice: *«conta i
minuti in casa, non le giornate»*.

### Chi tara il catalogo

Regola di processo, non tecnica, ma è la più importante del modulo — e vale a
maggior ragione ora che il catalogo è modificabile per sempre da entrambi (vedi
"Il rovescio della personalizzazione"): **i valori XP vanno concordati da
entrambi prima della fase 1**, e non decisi da chi
configura l'app. Chi tocca il catalogo decide chi vince, e un punteggio tarato da
una parte sola non è una misura, è una tesi. Nel dubbio conviene la norma
opposta a quella istintiva: essere generosi con le faccende che fa l'altro e
severi con le proprie. Il catalogo è modificabile in ogni momento dalle
impostazioni, ma **una modifica non riscrive lo storico** (gli XP sono snapshot
sul log): si può ritarare senza sospetto di aver cambiato le carte a partita in
corso.

Nota di modellazione utile: **una faccenda fatta insieme viene registrata da
entrambi** e accredita XP a entrambi — la spesa fatta in due vale 30 + 30. Il
totale di casa sale, l'equilibrio non si muove, e fare le cose insieme diventa
il modo più efficiente di raggiungere l'obiettivo settimanale. È un incentivo
cooperativo che esce gratis dal modello, e va tenuto.

**Antibarare**: nessuno. Con due giocatori e piena visibilità reciproca, ogni
riga inventata è immediatamente visibile all'altro. Costruire controlli
automatici su un'app per due conviventi sarebbe, oltre che inutile, offensivo.

---

## 6. Interfaccia e navigazione

Rotta nuova `/casa`, dentro il gruppo privato `app/(app)/`. Riusa integralmente
il design system esistente: `Card`, `ListRow`, `Chip`, `SegmentedControl`,
`Sheet`, i preset spring di `lib/motion.ts`, l'accento teal e il token
`--positive`. **Nessun nuovo colore e nessuna nuova primitiva** se non un
`ChoreRow` e un `XpBar`, entrambi costruiti sopra quelle esistenti.

**Schermata `/casa`** (dall'alto):

1. **Card "La nostra settimana"** — barra XP verso l'obiettivo con i due
   segmenti profilo, la striscia ("3ª settimana di fila"), e sotto la riga di
   equilibrio con la zona morta descritta sopra. Tono positivo, mai allarme.
2. **"Da fare"** — lista ordinata per urgenza (`due_in_days` crescente), ogni
   riga con icona d'area, nome, sottotitolo "ultima volta 3 giorni fa · Andrea",
   e un pulsante **"Fatto"** a destra, alto almeno 44px. Un tap registra,
   ottimisticamente, con la stessa meccanica di `HomeShell.tsx`: la riga scivola
   in "Fatto di recente" prima che la Server Action risponda. Nessun form, nessun
   dialog di conferma — non è un'azione distruttiva, e la conferma ucciderebbe i
   5 secondi. Annullamento tramite toast "Annulla" per qualche secondo.
3. **"Fatto di recente"** — feed degli ultimi completamenti dei due, con il
   pulsante kudos sulle righe dell'altro.
4. **"Bacheca"** — i titoli del mese dei due profili, affiancati, più i titoli di
   casa. Vuota a inizio mese, con un testo che spiega come si ottengono.

Un **FAB** apre uno `Sheet` con la ricerca su tutto il catalogo — così si
registra anche una faccenda non ancora scaduta, che nella lista "Da fare" starebbe
in fondo — più la faccenda una-tantum fuori catalogo (nome, area, XP) e il campo
data per retrodatare.

**`/casa/catalogo`**, dal menu del modulo: la gestione delle faccende ricorrenti.
Lista per area, tap per modificare (nome, area, XP, cadenza), swipe o menu per
disattivare, FAB per crearne una nuova. Le voci disattivate restano consultabili
in fondo, con la possibilità di riattivarle. Una **card compatta in home** mostra le 2 faccende più urgenti con il
tap "Fatto" diretto: è il percorso che rende davvero realistico il criterio dei 5
secondi, perché la home è la schermata che si apre.

**Navigazione (deciso).** La `BottomNav` resta a **4 voci**: **Home · Spese ·
Casa · Conguaglio**, con **Statistiche spostata nel Sheet "Menu"** dell'header,
accanto a Impostazioni. Le faccende sono l'interazione più frequente dell'app e
il conguaglio la più rara: la barra in basso deve riflettere la frequenza d'uso,
non l'importanza percepita dei moduli. La quinta voce sarebbe stata sostenibile
nei `max-w-lg`, ma con ogni tab sotto i 72px.

---

## 7. Assistente IA e Telegram

Il motore dell'assistente è condiviso (`lib/assistant/`) e serve sia la chat
interna sia il bot: si aggiunge una volta sola lì.

* Tool nuovi: **`complete_chore`** (accetta il nome in linguaggio naturale e lo
  risolve sul catalogo — "ho lavato i piatti" deve funzionare), **`list_chores`**
  (cosa manca), **`get_house_week`** (com'è messa la settimana).
* Il `system instruction` va esteso con **le regole di tono**: l'assistente non
  fa mai confronti fra i due, non sollecita e non risponde a domande del tipo
  "chi ha fatto di più" con una classifica, ma con il quadro della settimana di
  casa. Questa parte del prompt è tanto importante quanto lo schema: è il punto
  in cui la tossicità rientrerebbe dalla finestra.

Su Telegram, la regola è **niente notifica su ogni faccenda**. Un messaggio nel
gruppo a ogni piatto lavato è spam, e soprattutto rende il punteggio l'oggetto
costante della conversazione. Proposta:

* **immediato** solo per gli eventi rari e positivi: obiettivo settimanale
  raggiunto, nuovo titolo, striscia che si allunga — più la **modifica del
  catalogo**, che non è un evento positivo ma va annunciata per la ragione
  spiegata in "Il rovescio della personalizzazione";
* **mai** un messaggio su ciò che *non* è stato fatto. Il bot che scrive "la
  spazzatura è lì da tre giorni" è esattamente il rimprovero automatizzato che il
  principio 5 esclude. Se in futuro si vuole un promemoria, deve essere neutro,
  rivolto al gruppo e non alla persona ("stasera tocca alla spazzatura"), e
  disattivabile;
* un eventuale **digest serale** richiede uno scheduler (Vercel Cron): è infra
  nuova, quindi non prima della fase 3, e comunque opzionale.

Vale la proprietà già stabilita: senza `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`
tutto il percorso Telegram esce subito, e le notifiche restano fuori dal percorso
critico con `after()`.

---

## 8. Fasi di rilascio

Deliberatamente incrementali, perché la lezione del modulo auto è che l'uso reale
si verifica prima di investire.

* **Fase 1 — la lista che serve davvero.** Schema (3 tabelle + viste), catalogo
  seed, rotta `/casa`, completamento in un tap con UI ottimistica, "ultima volta
  / da quanto", card in home, voce di navigazione, **gestione completa del
  catalogo** (creare, modificare, disattivare) e registrazione fuori cadenza,
  retrodatata o fuori catalogo. **XP registrati ma nascosti**:
  l'interfaccia non mostra punteggi. Si usa per due settimane e si guarda se le
  righe di log arrivano davvero.
* **Fase 2 — il gioco.** Obiettivo settimanale, striscia, barra di equilibrio con
  zona morta, kudos, interruttore per spegnere tutto. Ritaratura degli XP e
  dell'obiettivo sui dati raccolti in fase 1.
* **Fase 3 — i titoli e i canali.** Bacheca mensile, tool dell'assistente,
  notifiche Telegram sui soli eventi rari.

Ogni fase è rilasciabile e reversibile: se la fase 2 rende l'atmosfera peggiore
invece che migliore, si torna alla fase 1 spegnendo un interruttore, senza toccare
i dati.

---

## 9. Cose da NON fare in questo modulo

Nello spirito della lista in `AGENTS.md`:

* **Non collegare le faccende ai soldi.** Nessuna conversione XP → euro, nessuna
  quota di spesa che dipende dalle faccende, nessun "conguaglio delle faccende".
* **Non introdurre l'assegnazione di compiti al partner**, con o senza scadenza,
  con o senza notifica.
* **Non mostrare classifiche cumulative** né grafici storici di chi ha fatto di
  più. Lo storico serve alle cose, non alle persone.
* **Non usare il rosso, le penalità, gli XP negativi** o la parola "scaduto".
* **Non materializzare le occorrenze ricorrenti** con un job: lo stato "da fare"
  si deriva dall'ultimo log e dalla cadenza.
* **Non duplicare la logica di aggregazione** fra client, assistente e bot: sta
  nelle viste.
* **Non ricalcolare gli XP storici** quando si ritara il catalogo: sono snapshot.

---

## 10. Decisioni

### Chiuse

1. **Navigazione** — `BottomNav` a 4 voci (Home · Spese · Casa · Conguaglio),
   Statistiche spostata nel Sheet "Menu" dell'header. Vedi sezione 6.
2. **Stagione degli XP** — **settimana** per l'obiettivo di casa e per la barra
   di equilibrio, **mese** per i titoli. Vedi principio 3.
4. **Faccende fuori catalogo** — **ammesse da subito**, via FAB, con `template_id`
   nullo sul log. Il catalogo copre il ricorrente; tutto il resto della vita
   domestica non deve restare fuori dai conti solo perché non era previsto.

### Aperte

3. **Kudos** — dentro dalla fase 2 o si parte senza? È l'unica meccanica che
   chiede un gesto *in più* invece di registrare un gesto già fatto, ed è quindi
   la prima candidata a non essere usata. Da decidere alla luce dei dati della
   fase 1.
5. **Valori XP** — il perimetro del catalogo è chiuso (21 voci, sezione 5: niente
   lavastoviglie, stiro, piante, balcone, giardino o animali), ma **i numeri no**.
   Vanno concordati da entrambi prima della fase 1, per la ragione spiegata in
   "Chi tara il catalogo": chi tocca i valori decide chi vince. Il valore più
   consequenziale è "Cucinare la cena" — a 20 XP la simulazione resta dentro la
   zona morta per soli 2,7 punti, a 15 ne esce. L'obiettivo settimanale
   non è invece una decisione da prendere ora: si fissa **dopo** la fase 1, sui
   dati reali.
