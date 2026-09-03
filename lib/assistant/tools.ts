import { Type } from '@google/genai'

// Descrizione condivisa del parametro "action" presente su ogni tool: una frase in
// prima persona mostrata in tempo reale all'utente mentre lo strumento lavora.
export const actionParam = {
  type: Type.STRING,
  description:
    'Breve frase in prima persona, in italiano, che descrive in tempo reale all\'utente ' +
    'cosa stai facendo mentre usi questo strumento (es. "Sto visionando lo scontrino della ' +
    'spesa di ieri…" oppure "Sto aggiungendo la bolletta della luce…"). Viene mostrata come ' +
    'stato di caricamento, quindi scrivila sempre, concisa e con i puntini di sospensione finali.',
}

// Dichiarazione del tool: il modello la invoca quando vuole "vedere" uno scontrino.
export const getAttachmentsTool = {
  name: 'get_attachments',
  description:
    'Recupera gli allegati (scontrini/ricevute, immagini o PDF) di una spesa specifica, ' +
    'identificata dal suo id, così da poterne leggere e descrivere il contenuto. ' +
    'Usalo solo quando l\'utente chiede esplicitamente di guardare uno scontrino o un dettaglio ' +
    'che richiede di vedere la ricevuta.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expense_id: {
        type: Type.STRING,
        description: 'L\'id (UUID) della spesa di cui caricare gli allegati.',
      },
      action: actionParam,
    },
    required: ['expense_id'],
  },
}

// Dichiarazione del tool con cui il modello registra una nuova spesa condivisa.
// Da invocare SOLO dopo aver riepilogato la spesa e ottenuto conferma dall'utente.
export const createExpenseTool = {
  name: 'create_expense',
  description:
    'Registra una NUOVA spesa condivisa nel database. Usalo solo quando l\'utente ha confermato ' +
    'esplicitamente di voler aggiungere la spesa e hai tutte le informazioni obbligatorie ' +
    '(importo, descrizione, categoria, chi ha pagato). Se manca qualcosa, chiedila prima; ' +
    'prima di chiamare il tool riepiloga la spesa e attendi un "sì" dell\'utente. ' +
    'category deve essere una tra: affitto, bolletta, spesa_alimentare, abbonamento, manutenzione, viaggi, altro. ' +
    'split_rule (facoltativo) tra: fifty_fifty, sixty_forty, custom; se non lo specifichi viene scelto in automatico ' +
    '(affitto = 50/50, tutto il resto = 60/40). expense_date facoltativo in formato YYYY-MM-DD (default: oggi). ' +
    'paid_by deve essere l\'UUID esatto di una delle persone elencate in PERSONE.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: {
        type: Type.NUMBER,
        description: 'Importo totale della spesa in euro, maggiore di zero.',
      },
      description: {
        type: Type.STRING,
        description: 'Breve descrizione della spesa (es. "Spesa al Lidl").',
      },
      category: {
        type: Type.STRING,
        description:
          'Categoria: affitto | bolletta | spesa_alimentare | abbonamento | manutenzione | viaggi | altro.',
      },
      paid_by: {
        type: Type.STRING,
        description: 'UUID esatto della persona che ha pagato (vedi elenco PERSONE).',
      },
      split_rule: {
        type: Type.STRING,
        description: 'Facoltativo: fifty_fifty | sixty_forty | custom.',
      },
      expense_date: {
        type: Type.STRING,
        description: 'Facoltativo: data in formato YYYY-MM-DD. Default: oggi.',
      },
      custom_other_share: {
        type: Type.NUMBER,
        description:
          'Obbligatorio solo se split_rule = "custom": quota in euro a carico dell\'altra persona (deve essere minore dell\'importo totale).',
      },
      action: actionParam,
    },
    required: ['amount', 'description', 'category', 'paid_by'],
  },
}

// Dichiarazione del tool con cui il modello elimina una spesa esistente NON ancora
// saldata. Da invocare SOLO dopo aver riepilogato quale spesa verrà eliminata e
// ottenuto conferma esplicita dall'utente: l'eliminazione è irreversibile.
export const deleteExpenseTool = {
  name: 'delete_expense',
  description:
    'Elimina definitivamente una spesa ESISTENTE e ancora aperta (non saldata), identificata dal suo id. ' +
    'Usalo solo quando l\'utente ha confermato esplicitamente di voler eliminare quella specifica spesa; ' +
    'prima di chiamare il tool riepiloga quale spesa verrà eliminata (importo, descrizione, data) e attendi ' +
    'un "sì" dell\'utente, perché l\'operazione è irreversibile. ' +
    'Se la spesa risulta "saldata" nell\'elenco spese, non può essere eliminata: dillo all\'utente senza chiamare il tool.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expense_id: {
        type: Type.STRING,
        description: 'L\'id (UUID) esatto della spesa da eliminare, preso dall\'elenco spese.',
      },
      action: actionParam,
    },
    required: ['expense_id'],
  },
}
