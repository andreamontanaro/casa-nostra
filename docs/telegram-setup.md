# Integrazione Telegram — guida alla configurazione

Il bot Telegram di Casa Nostra fa due cose:

1. **Notifica** nel gruppo ogni movimento — spesa aggiunta, modificata o eliminata, conguaglio registrato o richiesto — con il saldo aggiornato letto da `v_user_open_balance`.
2. **Risponde** nel gruppo come assistente IA: è lo stesso assistente della chat dentro l'app (stesso contesto, stessi strumenti), quindi può registrare una spesa o fare un recap direttamente da Telegram.

La configurazione richiede una decina di minuti ed è divisa in cinque passi.

---

## 1. Creare il bot

1. Su Telegram apri una chat con [@BotFather](https://t.me/BotFather) e manda `/newbot`.
2. Scegli nome e username (l'username finisce per `bot`, es. `casa_nostra_notify_bot`).
3. BotFather risponde con il **token**: è `TELEGRAM_BOT_TOKEN`, va tenuto segreto.
4. Sempre da BotFather, `/setprivacy` → **Disable** sul tuo bot: senza questo, nei gruppi il bot riceve solo i comandi `/…` e non le menzioni né le risposte ai suoi messaggi.

## 2. Creare il gruppo

1. Crea un gruppo Telegram con te e il partner.
2. Aggiungi il bot al gruppo.
3. Scrivi `/id` nel gruppo: il bot risponde con l'id della chat (un numero negativo, es. `-1002345678901`) e con il tuo id personale.

> Il comando `/id` funziona anche prima di aver collegato gli account: serve proprio a completare la configurazione. Se il bot non risponde, il webhook non è ancora registrato — torna qui dopo il passo 4.

## 3. Migrazione del database

Esegui `docs/migrations/2026-09-03_telegram.sql` nell'editor SQL di Supabase. Aggiunge:

* `profiles.telegram_user_id` — collega un profilo a un account Telegram;
* `public.telegram_messages` — la memoria conversazionale del bot (serve a reggere i dialoghi a più turni, es. la conferma prima di registrare una spesa).

Poi rigenera i tipi, se hai la CLI a portata: `supabase gen types typescript > types/database.ts`.

## 4. Variabili d'ambiente

Da aggiungere in `.env.local` per lo sviluppo e nelle *Environment Variables* di Vercel per la produzione:

| Variabile | Obbligatoria | Cosa contiene |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | sì | Il token di BotFather. |
| `TELEGRAM_CHAT_ID` | sì | L'id del gruppo, dal comando `/id`. |
| `TELEGRAM_WEBHOOK_SECRET` | sì | Stringa casuale a tua scelta (es. `openssl rand -hex 32`): Telegram la rimanda a ogni update ed è l'unico modo che l'app ha di verificare che la richiesta arrivi davvero da Telegram. |
| `TELEGRAM_BOT_USERNAME` | consigliata | L'username del bot senza `@`: serve a riconoscere le menzioni nel gruppo. |
| `SUPABASE_SERVICE_ROLE_KEY` | sì | Chiave *service role* del progetto Supabase (Dashboard → Project Settings → API). Il webhook non ha una sessione utente, quindi legge e scrive con questa chiave. **Mai** esporla al client. |
| `NEXT_PUBLIC_SITE_URL` | consigliata | URL pubblico dell'app (es. `https://casa-nostra.vercel.app`): senza, i messaggi non contengono link cliccabili. |
| `TELEGRAM_REPLY_MODE` | no | `mention` (default) oppure `all` — vedi sotto. |

Senza `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` l'integrazione resta semplicemente spenta: l'app funziona esattamente come prima.

## 5. Registrare il webhook

Con le variabili in ambiente:

```bash
npm run telegram:setup -- set https://casa-nostra.vercel.app
npm run telegram:setup -- info      # verifica: url, secret, errori recenti
npm run telegram:setup -- delete    # rimuove il webhook
```

L'url pubblico deve essere raggiungibile da internet: in sviluppo locale serve un tunnel (es. `ngrok http 3000`) e va rieseguito `set` con l'url del tunnel.

## 6. Collegare i due account

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
| `/saldo` | saldo corrente, senza passare dall'IA |
| `/conguaglio` | manda nel gruppo «X ha richiesto un conguaglio» |
| `/aiuto` | l'elenco dei comandi |

L'assistente chiede **sempre** una conferma esplicita prima di scrivere una spesa nel database: nel gruppo la conferma può darla chiunque dei due, quindi vale la stessa fiducia reciproca che c'è nell'app.

---

## Sicurezza

* Il webhook accetta solo richieste che portano l'header `X-Telegram-Bot-Api-Secret-Token` corrispondente a `TELEGRAM_WEBHOOK_SECRET`; senza secret configurato rifiuta tutto (`500`).
* Risponde solo nella chat di `TELEGRAM_CHAT_ID` e nelle chat private: se qualcuno aggiunge il bot a un altro gruppo, resta muto.
* Opera solo per conto di account Telegram collegati a un profilo, e sempre con l'identità di quel profilo (`created_by`, `paid_by` di default, «io»).
* `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS: vive solo nel processo server del webhook e non è mai inviata al browser.
* `update_id` è UNIQUE su `telegram_messages`: se Telegram riconsegna lo stesso update, il messaggio non viene elaborato (né la spesa registrata) due volte.

## Se qualcosa non funziona

| Sintomo | Da controllare |
|---|---|
| Il bot non risponde a niente | `npm run telegram:setup -- info`: `url` corretto, `last_error_message` vuoto |
| Risponde ai `/comandi` ma non alle menzioni | privacy mode del bot ancora attiva (passo 1.4) |
| «Non ti riconosco» | account non collegato: Impostazioni → Telegram |
| Nessuna notifica, ma il bot risponde | `TELEGRAM_CHAT_ID` sbagliato (dev'essere l'id del gruppo, negativo) |
| `500` sul webhook | manca `TELEGRAM_WEBHOOK_SECRET` o `SUPABASE_SERVICE_ROLE_KEY` in produzione |
