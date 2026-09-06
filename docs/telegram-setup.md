# Integrazione Telegram — guida alla configurazione

Il bot Telegram di Casa Nostra fa due cose:

1. **Notifica** nel gruppo ogni movimento — spesa aggiunta, modificata o eliminata, conguaglio registrato o richiesto — con il saldo aggiornato letto da `v_user_open_balance`.
2. **Risponde** nel gruppo come assistente IA: è lo stesso assistente della chat dentro l'app (stesso contesto, stessi strumenti), quindi può registrare una spesa o fare un recap direttamente da Telegram.

La configurazione richiede una decina di minuti ed è divisa in sette passi.

---

## 1. Creare il bot

> I passi vanno in quest'ordine: bot → gruppo → id del gruppo → variabili → deploy → webhook. Il bot resta muto fino al passo 6, ed è normale.

1. Su Telegram apri una chat con [@BotFather](https://t.me/BotFather) e manda `/newbot`.
2. Scegli nome e username (l'username finisce per `bot`, es. `casa_nostra_notify_bot`).
3. BotFather risponde con il **token**: è `TELEGRAM_BOT_TOKEN`, va tenuto segreto.
4. Sempre da BotFather, `/setprivacy` → **Disable** sul tuo bot: senza questo, nei gruppi il bot riceve solo i comandi `/…` e non le menzioni né le risposte ai suoi messaggi.

## 2. Creare il gruppo

1. Crea un gruppo Telegram con te e il partner.
2. Aggiungi il bot al gruppo.
3. Scrivi `/id` nel gruppo (anche solo `ciao` va bene): serve a far arrivare a Telegram almeno un messaggio da quella chat.

Il bot **non risponderà ancora**: perché risponda serve l'app online e il webhook registrato (passi 5 e 6). Il messaggio non è sprecato — resta nella coda di Telegram e il passo 4 lo legge da lì.

## 3. Migrazione del database

**Già applicata** al progetto Casa Nostra il 3 settembre 2026. Il file `docs/migrations/2026-09-03_telegram.sql` resta come riferimento e per ricreare lo schema da zero. Aggiunge:

* `profiles.telegram_user_id` — collega un profilo a un account Telegram;
* `public.telegram_messages` — la memoria conversazionale del bot (serve a reggere i dialoghi a più turni, es. la conferma prima di registrare una spesa).

I tipi in `types/database.ts` sono già allineati.

### Migrazione della lista della spesa

**Già applicata** al progetto Casa Nostra il 6 settembre 2026. Il file `docs/migrations/2026-09-06_lista_spesa.sql` resta come riferimento e per ricreare lo schema da zero: aggiunge le tabelle della lista, le viste, la RPC del controllo scontrino e il bucket privato `shopping-receipts`. È ciò che permette al bot di rispondere a `/lista` e di controllare gli scontrini inviati in chat.

## Scorciatoia: lo script guidato (Windows)

`scripts/telegram-setup.ps1` fa da solo i passi 4, 5 e 6 nell'ordine giusto — id del gruppo, secret, variabili da incollare, controllo del deploy, registrazione del webhook — e alla fine dice cosa resta da fare a mano:

```powershell
.\scripts\telegram-setup.ps1 -AppUrl https://casanostra.andreamontanaro.it
```

Se Windows blocca gli script: `powershell -ExecutionPolicy Bypass -File .\scripts\telegram-setup.ps1 -AppUrl https://...`

Altri usi:

```powershell
.\scripts\telegram-setup.ps1 -Info            # stato del webhook e ultimo errore
.\scripts\telegram-setup.ps1 -RemoveWebhook   # lo rimuove
.\scripts\telegram-setup.ps1 -Secret <valore> # se il secret su Vercel esiste gia'
```

Prima di registrare il webhook lo script interroga l'app senza secret: la risposta dice in che stato e' il deploy, e conviene conoscerne la tabella perche' e' la stessa diagnosi che serve leggendo `getWebhookInfo`.

| Risposta | Significato |
|---|---|
| `403` | Tutto a posto: codice online, token e secret configurati |
| `500` | Manca `TELEGRAM_WEBHOOK_SECRET` nell'ambiente del deploy |
| `200` | Il codice c'è ma manca `TELEGRAM_BOT_TOKEN` |
| `404` | Quel deploy non contiene il codice del bot |
| nessuna | Url irraggiungibile o deploy non pronto |

I passi qui sotto sono la stessa cosa fatta a mano, utile su macOS e Linux (dove c'è `npm run telegram:setup`) o quando qualcosa va storto.

---

## 4. Scoprire l'id del gruppo

Ti serve per `TELEGRAM_CHAT_ID`. Con il token già in `.env.local`:

```bash
npm run telegram:setup -- chats
```

Legge gli update in coda su Telegram e stampa le chat che hanno scritto al bot. Quella con **id negativo** è il gruppo:

```
  -1002345678901  Casa Nostra  — gruppo
  123456789       Andrea       — chat privata
```

Se non compare niente, scrivi un altro messaggio nel gruppo e rilancia. Il comando funziona solo finché il webhook non è registrato: le due modalità di consegna si escludono a vicenda, quindi va usato **prima** del passo 6 (o dopo un `delete`).

In alternativa, a webhook già attivo, `/id` nel gruppo dà gli stessi numeri: quel comando risponde anche quando `TELEGRAM_CHAT_ID` non è ancora impostato, proprio perché è il comando con cui lo si scopre.

## 5. Variabili d'ambiente

Da aggiungere in `.env.local` per lo sviluppo e nelle *Environment Variables* di Vercel per la produzione:

| Variabile | Obbligatoria | Cosa contiene |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | sì | Il token di BotFather. |
| `TELEGRAM_CHAT_ID` | sì | L'id del gruppo, dal passo 4. |
| `TELEGRAM_WEBHOOK_SECRET` | sì | Stringa casuale a tua scelta (es. `openssl rand -hex 32`): Telegram la rimanda a ogni update ed è l'unico modo che l'app ha di verificare che la richiesta arrivi davvero da Telegram. |
| `TELEGRAM_BOT_USERNAME` | consigliata | L'username del bot senza `@`: serve a riconoscere le menzioni nel gruppo. |
| `SUPABASE_SERVICE_ROLE_KEY` | sì | Chiave *service role* del progetto Supabase (Dashboard → Project Settings → API). Il webhook non ha una sessione utente, quindi legge e scrive con questa chiave. **Mai** esporla al client. |
| `NEXT_PUBLIC_SITE_URL` | consigliata | URL pubblico dell'app (es. `https://casa-nostra.vercel.app`): senza, i messaggi non contengono link cliccabili. |
| `TELEGRAM_REPLY_MODE` | no | `mention` (default) oppure `all` — vedi sotto. |

Senza `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` l'integrazione resta semplicemente spenta: l'app funziona esattamente come prima.

> **Su Vercel**: le variabili valgono dal deploy successivo, non da subito. Dopo averle aggiunte fai un **Redeploy**, altrimenti il codice online continua a girare senza. Attenzione anche all'ambiente: una variabile impostata solo su *Production* non esiste nei deploy di *Preview* (quelli dei branch), e viceversa.

## 6. Registrare il webhook

L'app dev'essere già online: il webhook è un url che Telegram deve poter chiamare, quindi il deploy va fatto **prima**.

```bash
npm run telegram:setup -- set https://casa-nostra.vercel.app
npm run telegram:setup -- info      # verifica: url, secret, errori recenti
npm run telegram:setup -- delete    # rimuove il webhook
```

Da qui in poi il bot risponde. In sviluppo locale serve un tunnel (es. `ngrok http 3000`) e va rieseguito `set` con l'url del tunnel.

## 7. Collegare i due account

Ognuno dei due, dentro l'app: **Impostazioni → Telegram**, incolla il proprio id (quello dato da `/id`) e salva. Da quel momento il bot sa chi sta scrivendo nel gruppo — è ciò che permette all'assistente di interpretare «ho pagato io».

Un account non collegato riceve una risposta che spiega come collegarsi e nient'altro: il bot non opera mai per conto di estranei.

---

## Come si usa

### Notifiche automatiche

Arrivano nel gruppo senza che nessuno faccia niente:

```
💸 Andrea ha aggiunto una spesa

🛒 45,00 € — Spesa al Lidl
Spesa · 60 / 40 · pagata da Andrea · 3 settembre 2026

📊 Giulia deve 120,50 € ad Andrea
```

Le notifiche partono *dopo* la risposta HTTP (`after()` di Next.js): se Telegram è lento o irraggiungibile, il salvataggio della spesa non ne risente e l'errore finisce solo nei log.

### Parlare con l'assistente

Con `TELEGRAM_REPLY_MODE=mention` (default) il bot interviene solo quando è chiaro che ci si rivolge a lui:

* un comando (`/saldo`, `/recap`…);
* una menzione (`@casa_nostra_bot quanto devo?`);
* una risposta a un suo messaggio;
* qualsiasi messaggio, se gli scrivi in chat privata.

Con `TELEGRAM_REPLY_MODE=all` risponde a ogni messaggio del gruppo: comodo se il gruppo è dedicato solo alle spese, rumoroso (e costoso in chiamate a Gemini) altrimenti.

Esempi:

| Scrivi | Il bot |
|---|---|
| `@bot ho pagato 32€ di spesa al Lidl` | riepiloga la spesa e chiede conferma; su «sì» la registra e la notifica |
| `@bot quanto devo a Giulia?` | risponde con il saldo aggiornato |
| `@bot recap delle spese di questo mese` | riassume categorie e totali |
| `@bot serve il latte e la carta igienica` | li aggiunge alla lista della spesa (senza chiedere conferma) |
| `@bot cosa manca?` | elenca la lista aggiornata |
| `/saldo` | saldo corrente, senza passare dall'IA |
| `/lista` | la lista della spesa, raggruppata per tipo di prodotto |
| `/conguaglio` | manda nel gruppo «X ha richiesto un conguaglio» |
| `/scontrino` | spiega il controllo scontrino; in **risposta a una foto**, la controlla |
| `/aiuto` | l'elenco dei comandi |

L'assistente chiede **sempre** una conferma esplicita prima di scrivere una spesa nel database: nel gruppo la conferma può darla chiunque dei due, quindi vale la stessa fiducia reciproca che c'è nell'app. Per la lista della spesa no: aggiungere un prodotto non muove soldi e si toglie con un tap, quindi il bot lo fa e basta.

### Mandare uno scontrino: spesa registrata e lista aggiornata

Manda nel gruppo la foto dello scontrino (o il PDF). Il bot fa due cose in un colpo solo: **registra la spesa** con le opzioni di default e **confronta lo scontrino con la lista della spesa**, spuntando quello che avete comprato.

```
🧾 Scontrino controllato — Esselunga

Totale letto: 43,20 €

💸 Spesa registrata
🛒 43,20 € — Spesa da Esselunga
Spesa · 60 / 40 · pagata da Andrea · 6 settembre 2026 · 📎 scontrino allegato

📊 Giulia deve 60,00 € ad Andrea

✅ Spuntati 4
• Latte
• Pane
• Detersivo piatti
• Caffè

🛒 Manca ancora 1
• Carta igienica (1 pacco) ❗
```

Le "opzioni di default" della spesa sono quelle che proporrebbe il form dell'app:

| Campo | Valore |
|---|---|
| Importo | il totale letto sullo scontrino |
| Data | la data dello scontrino, o oggi se non si legge |
| Descrizione | «Spesa da \<negozio\>» |
| Categoria | dedotta dallo scontrino (supermercato → Spesa, ferramenta → Manutenzione, altrimenti Altro) |
| Divisione | quella predefinita per la categoria: 50/50 su affitto e viaggi, 60/40 sul resto |
| Pagata da | chi ha mandato la foto |
| Allegato | la foto stessa, così si rivede dal dettaglio della spesa |

Resta tutto modificabile dall'app: il link «Apri la spesa» nel messaggio porta dritto lì.

La spesa **non** viene creata in due casi, e il messaggio lo dice sempre:

* il **totale non si legge** sulla foto — senza importo non c'è spesa da registrare;
* esiste **già una spesa dello stesso importo in quella data** — quasi sempre è lo stesso scontrino mandato due volte, e una spesa doppia falserebbe il saldo. Se erano davvero due spese, aggiungi la seconda dall'app.

Quando il bot guarda la foto dipende dalla stessa regola delle risposte:

* con `TELEGRAM_REPLY_MODE=mention` (default), nel gruppo serve una **didascalia** che lo menzioni (`@casa_nostra_bot`) oppure una risposta `/scontrino` a una foto già inviata — così una foto qualsiasi nel gruppo non fa partire un controllo;
* in **chat privata** con il bot basta mandare la foto;
* con `TELEGRAM_REPLY_MODE=all` basta mandarla anche nel gruppo.

Di ogni foto viene usata la risoluzione più alta che Telegram consegna: su uno scontrino la differenza fra leggere `LT PS 1L` e non leggere niente è tutta lì. La foto viene conservata nel bucket privato `shopping-receipts` come traccia del controllo.

Lo stesso controllo si può fare dall'app (`Lista → Controlla uno scontrino`), ma **lì la spesa non viene creata in automatico**: nell'app il form della spesa è a un tap di distanza, e registrarla di nascosto sarebbe una sorpresa; su Telegram, dove il form non c'è, è quello che serve.

---

## Sicurezza

* Il webhook accetta solo richieste che portano l'header `X-Telegram-Bot-Api-Secret-Token` corrispondente a `TELEGRAM_WEBHOOK_SECRET`; senza secret configurato rifiuta tutto (`500`).
* Risponde solo nella chat di `TELEGRAM_CHAT_ID` e nelle chat private: se qualcuno aggiunge il bot a un altro gruppo, resta muto.
* **Unica eccezione, durante la configurazione**: finché `TELEGRAM_CHAT_ID` non è impostato non esiste un gruppo da riconoscere, quindi il bot risponde ovunque — ma **solo** a `/id`, senza toccare il database, e restituendo due numeri che chi scrive già possiede (l'id della propria chat e del proprio account). Appena la variabile è impostata, il filtro sulle chat torna pieno.
* Opera solo per conto di account Telegram collegati a un profilo, e sempre con l'identità di quel profilo (`created_by`, `paid_by` di default, «io»).
* `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS: vive solo nel processo server del webhook e non è mai inviata al browser.
* `update_id` è UNIQUE su `telegram_messages`: se Telegram riconsegna lo stesso update, il messaggio non viene elaborato (né la spesa registrata) due volte.

## Se qualcosa non funziona

| Sintomo | Da controllare |
|---|---|
| Il bot non risponde a niente | Nell'ordine: l'app con questo codice è online? il webhook è registrato (`npm run telegram:setup -- info`, `url` valorizzato)? `last_error_message` è vuoto? `TELEGRAM_BOT_TOKEN` è presente nell'ambiente del deploy? |
| `info` mostra `url` vuoto | Il `setWebhook` non è mai stato fatto: passo 6. Il deploy da solo non registra niente |
| `last_error_message: Wrong response from the webhook: 404` | L'url punta a un deploy senza questo codice, o manca `/api/telegram/webhook` in fondo |
| Risponde ai `/comandi` ma non alle menzioni | privacy mode del bot ancora attiva (passo 1.4) |
| «Non ti riconosco» | account non collegato: Impostazioni → Telegram |
| Nessuna notifica, ma il bot risponde | `TELEGRAM_CHAT_ID` assente o sbagliato (dev'essere l'id del gruppo, negativo) |
| Manda la foto dello scontrino e non succede niente | Nel gruppo serve la menzione nella didascalia (o una risposta `/scontrino` alla foto): vedi «Mandare uno scontrino» |
| Scontrino letto ma spesa non registrata | Il messaggio ne dà il motivo: totale illeggibile (rifai la foto più nitida) o spesa identica già presente in quella data |
| «Il controllo scontrino non è configurato» | manca `GEMINI_API_KEY` nell'ambiente del deploy |
| «Non trovo la lista» / errori sulla lista | la migrazione `2026-09-06_lista_spesa.sql` non è stata eseguita su Supabase |
| `500` sul webhook | manca `TELEGRAM_WEBHOOK_SECRET` o `SUPABASE_SERVICE_ROLE_KEY` nell'ambiente del deploy |
| Variabili aggiunte su Vercel ma niente cambia | Servono un **Redeploy** e l'ambiente giusto (Production vs Preview) |
