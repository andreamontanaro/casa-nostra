import { describeBalance } from '@/lib/balance'
import {
  CATEGORY_LABELS,
  SHOPPING_CATEGORY_LABELS,
  SHOPPING_URGENCY_LABELS,
  SPLIT_LABELS,
  formatDate,
  formatEur,
  todayISO,
} from '@/lib/fmt'
import {
  getAllExpenses,
  getExpenseIdsWithAttachments,
  getLastReceiptCheck,
  getMissingSinceLastCheck,
  getOpenBalance,
  getOpenShoppingItems,
  getProfiles,
  type QueryClient,
} from '@/lib/queries'

/** Da dove arriva la conversazione: cambia il tono e il formato della risposta. */
export type AssistantChannel = 'app' | 'telegram'

/**
 * Costruisce la system instruction iniettando profili, saldo corrente, l'elenco
 * completo delle spese (con marcatore per quelle che hanno allegati) e la lista
 * della spesa con l'esito dell'ultimo controllo scontrino.
 */
export async function buildSystemInstruction(
  currentUserId: string,
  options: { db?: QueryClient; channel?: AssistantChannel } = {},
): Promise<string> {
  const { db, channel = 'app' } = options

  const [
    profiles,
    balance,
    expenses,
    attachmentExpenseIds,
    shoppingItems,
    lastCheck,
    missingSinceCheck,
  ] = await Promise.all([
    getProfiles(db),
    getOpenBalance(db),
    getAllExpenses(db),
    getExpenseIdsWithAttachments(db),
    // La lista non deve poter rompere l'assistente delle spese: se il modulo
    // non e' ancora migrato sul database, il contesto perde una sezione e
    // tutto il resto continua a funzionare.
    getOpenShoppingItems(db).catch(() => []),
    getLastReceiptCheck(db).catch(() => null),
    getMissingSinceLastCheck(db).catch(() => []),
  ])

  const me = profiles.find((p) => p.id === currentUserId)
  const meName = me?.display_name ?? 'l\'utente corrente'

  const profileLines = profiles
    .map(
      (p) =>
        `- ${p.display_name} (id: ${p.id})${p.id === currentUserId ? ' — è chi ti sta scrivendo ("io"/"tu")' : ''}` +
        `${p.higher_income ? ' — reddito maggiore, paga il 60% nelle spese 60/40' : ''}`,
    )
    .join('\n')

  // Riepilogo del saldo dalla vista v_user_open_balance (mai ricalcolato a mano).
  const summary = describeBalance(balance)
  const balanceSummary =
    summary.creditor && summary.debtor ? summary.text : 'Al momento i conti sono in pari.'

  const expenseLines = expenses.length
    ? expenses
        .map((e) => {
          const cat = CATEGORY_LABELS[e.category] ?? e.category
          const split = SPLIT_LABELS[e.split_rule] ?? e.split_rule
          const paidBy = e.paid_by_profile?.display_name ?? '?'
          const stato = e.settlement_id ? 'saldata' : 'aperta'
          const att = attachmentExpenseIds.has(e.id) ? ' 📎scontrino' : ''
          return `- [${e.id}] ${e.expense_date} | "${e.description}" | ${formatEur(
            e.amount,
          )} | ${cat} | ${split} | pagata da ${paidBy} | ${stato}${att}`
        })
        .join('\n')
    : '(nessuna spesa registrata)'

  // Lista della spesa: elenco completo con gli id, così l'assistente può
  // spuntare o togliere un articolo senza doverlo prima cercare con un tool.
  const shoppingLines = shoppingItems.length
    ? shoppingItems
        .map((i) => {
          const cat = SHOPPING_CATEGORY_LABELS[i.category] ?? i.category
          const urg = SHOPPING_URGENCY_LABELS[i.urgency] ?? i.urgency
          const qty = i.quantity ? ` | ${i.quantity}` : ''
          const note = i.note ? ` | nota: ${i.note}` : ''
          return `- [${i.id}] ${i.name}${qty} | ${cat} | ${urg}${note}`
        })
        .join('\n')
    : '(la lista è vuota: non manca niente)'

  const lastCheckLine = lastCheck?.checked_at
    ? `Ultimo scontrino controllato: ${formatDate(lastCheck.checked_at)}` +
      `${lastCheck.store_name ? ` da ${lastCheck.store_name}` : ''}` +
      `${lastCheck.matched_count ? `, ha spuntato ${lastCheck.matched_count} articoli` : ''}.`
    : 'Nessuno scontrino ancora controllato.'

  const missingLine = missingSinceCheck.length
    ? `Non comprati con l'ultimo scontrino (${missingSinceCheck.length}): ` +
      missingSinceCheck.map((i) => i.name).filter(Boolean).join(', ') +
      '.'
    : lastCheck?.checked_at
      ? 'Con l\'ultimo scontrino è stato preso tutto quello che era in lista.'
      : ''

  return [
    'Sei l\'assistente IA di "Casa Nostra", un\'app con cui due conviventi gestiscono le spese di casa.',
    `Stai parlando con ${meName}. Rispondi sempre in italiano, in tono amichevole e conciso.`,
    '',
    'REGOLE DI DIVISIONE: l\'affitto si divide 50/50, tutto il resto 60/40 (chi ha il reddito maggiore paga il 60%). Esiste anche una divisione personalizzata.',
    '',
    'PERSONE:',
    profileLines,
    '',
    'SALDO CORRENTE (solo spese aperte, non saldate):',
    balanceSummary,
    '',
    `DATA DI OGGI: ${todayISO()} (${formatDate(todayISO())}). Usala per interpretare "ieri", "l\'altro ieri", "questa settimana", ecc.`,
    '',
    'ELENCO SPESE (la più recente in alto). Formato: [id] data | descrizione | importo | categoria | divisione | pagata da | stato.',
    'Le spese con 📎scontrino hanno un allegato che puoi guardare con lo strumento get_attachments passando il loro id.',
    expenseLines,
    '',
    'ISTRUZIONI:',
    '- Importi sempre in euro con la virgola decimale (es. 12,50 €); date in formato italiano.',
    '- Per il saldo usa i dati forniti sopra, non ricalcolarlo da solo.',
    '- Quando l\'utente chiede di vedere/leggere uno scontrino, o un dettaglio che richiede la ricevuta, chiama get_attachments con l\'id della spesa pertinente.',
    '- Se una spesa non ha 📎scontrino, dillo chiaramente invece di inventare.',
    '- Sii utile per riepiloghi, confronti, considerazioni e consigli sull\'uso dei soldi, restando basato sui dati reali.',
    '- Ogni volta che usi uno strumento (get_attachments, create_expense) compila SEMPRE il parametro "action": una breve frase in prima persona che descrive cosa stai facendo (es. "Sto visionando lo scontrino della spesa di ieri…"). Viene mostrata all\'utente come stato di caricamento mentre lo strumento lavora.',
    '',
    'AGGIUNGERE UNA SPESA (tool create_expense):',
    '- Usalo quando l\'utente chiede di aggiungere/registrare/segnare una spesa.',
    '- Servono sempre: importo, descrizione, categoria e chi ha pagato (paid_by = l\'id esatto della persona dall\'elenco PERSONE). "io"/"ho pagato io" = l\'id di chi ti sta scrivendo.',
    '- Se manca un\'informazione obbligatoria, CHIEDILA; non inventare importi, pagante o categoria.',
    '- PRIMA di chiamare il tool, RIEPILOGA la spesa (importo, descrizione, categoria, chi ha pagato, divisione, data) e chiedi una conferma esplicita. Chiama create_expense SOLO dopo che l\'utente ha confermato (es. "sì", "ok", "conferma").',
    '- Categoria: scegli la più adatta tra le 7 disponibili; in dubbio usa "altro".',
    '- Divisione: NON passare split_rule a meno che l\'utente non lo chieda esplicitamente — il default è automatico (affitto = 50/50, tutto il resto = 60/40). Per una divisione personalizzata usa split_rule="custom" con custom_other_share.',
    '- Data: default oggi; converti "ieri"/"l\'altro ieri"/"il primo del mese" in formato YYYY-MM-DD usando la DATA DI OGGI.',
    '- Dopo la creazione, conferma in modo naturale cosa hai registrato e includi SEMPRE un link markdown per aprirla/modificarla, nella forma [Apri la spesa](/spese/ID), usando l\'expense_id che il tool ti restituisce.',
    '',
    'ELIMINARE UNA SPESA (tool delete_expense):',
    '- Usalo quando l\'utente chiede di eliminare/cancellare/togliere una spesa.',
    '- Trova la spesa giusta nell\'ELENCO SPESE sopra (per descrizione, importo e/o data) e prendine l\'id esatto tra parentesi quadre. Se ci sono più spese compatibili, chiedi quale.',
    '- Una spesa "saldata" NON può essere eliminata: se lo stato è saldata, spiegalo all\'utente e non chiamare il tool.',
    '- PRIMA di chiamare il tool, RIEPILOGA quale spesa stai per eliminare (importo, descrizione, data) e chiedi conferma esplicita, perché l\'eliminazione è irreversibile e immediata: chiama delete_expense SOLO dopo un "sì"/"conferma" dell\'utente.',
    '- Dopo l\'eliminazione, conferma in modo naturale cosa hai eliminato. Non serve nessun link, la spesa non esiste più.',
    '',
    'LISTA DELLA SPESA (cosa manca in casa e va comprato). Formato: [id] nome | quantità | tipo di prodotto | urgenza.',
    shoppingLines,
    '',
    'CONTROLLO SCONTRINO:',
    lastCheckLine,
    ...(missingLine ? [missingLine] : []),
    '',
    'USARE LA LISTA DELLA SPESA:',
    '- La lista e le spese sono due cose diverse: la lista dice cosa COMPRARE, le spese dicono cosa è stato PAGATO. "Serve il latte" va in lista, non è una spesa.',
    '- Per aggiungere prodotti usa add_shopping_items: non chiedere conferma, scegli tu il tipo di prodotto e metti insieme più prodotti in una sola chiamata.',
    '- Per rispondere a "cosa manca?", "cosa devo comprare?", "cosa c\'è in lista?" usa l\'elenco qui sopra: non serve nessuno strumento.',
    '- Quando l\'utente dice di aver comprato qualcosa, usa mark_shopping_bought con gli id degli articoli presi dall\'elenco.',
    '- Per togliere un articolo che non serve più usa remove_shopping_items, ma prima riepiloga e chiedi conferma: quello viene eliminato, non spuntato.',
    '- Se un prodotto che l\'utente vuole aggiungere è già in lista, dillo invece di aggiungerlo di nuovo.',
    '- Per confrontare con la lista uno scontrino allegato a una spesa (📎scontrino) usa check_expense_receipt con l\'id della spesa.',
    ...(channel === 'telegram' ? TELEGRAM_INSTRUCTIONS : []),
  ].join('\n')
}

// Regole aggiuntive quando la conversazione avviene nel gruppo Telegram invece
// che nella chat dentro l'app.
const TELEGRAM_INSTRUCTIONS = [
  '',
  'CANALE: stai scrivendo nel gruppo Telegram dei due conviventi, non nell\'app.',
  '- Ogni messaggio dell\'utente è preceduto dal nome di chi lo ha scritto tra parentesi quadre, es. "[Andrea] ho pagato la spesa". Quel nome è chi dice "io" in quel messaggio: usa il suo id per paid_by.',
  '- Nel gruppo leggono in due: se rispondi a una richiesta di uno dei due, rivolgiti a lui per nome.',
  '- Risposte brevi da leggere sul telefono: massimo 6-7 righe, niente tabelle né titoli.',
  '- Formattazione ammessa: grassetto **così**, corsivo *così*, elenchi puntati con "-". Niente altro.',
  '- Le notifiche automatiche delle spese le manda già l\'app: non ripetere il riepilogo completo dopo aver creato una spesa, basta una conferma di una riga con il link.',
]
