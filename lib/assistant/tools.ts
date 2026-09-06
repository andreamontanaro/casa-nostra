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

// ------------------------------------------------------------
// Lista della spesa
// ------------------------------------------------------------

// Aggiungere alla lista non muove soldi e si annulla con un tap: a differenza
// di create_expense non serve un giro di conferma, sarebbe solo un ostacolo
// fra "serve il latte" e il latte in lista.
export const addShoppingItemsTool = {
  name: 'add_shopping_items',
  description:
    'Aggiunge uno o più prodotti alla LISTA DELLA SPESA (le cose che mancano in casa e vanno comprate). ' +
    'Usalo quando l\'utente dice che manca qualcosa o chiede di segnare/aggiungere prodotti da comprare. ' +
    'Non serve chiedere conferma: aggiungere alla lista è un\'azione leggera e reversibile. ' +
    'Se l\'utente elenca più prodotti in un messaggio, aggiungili tutti con una sola chiamata. ' +
    'category deve essere una tra: cibo, bevande, cura_casa, igiene_persona, farmacia, casalinghi, altro ' +
    '(scegli tu la più adatta al tipo di prodotto, in dubbio "altro"). ' +
    'urgency tra: bassa, media, alta — usa "alta" solo se l\'utente fa capire che serve subito, ' +
    '"bassa" se dice che non c\'è fretta, altrimenti "media".',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'I prodotti da aggiungere alla lista.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'Nome del prodotto (es. "Latte parzialmente scremato").',
            },
            category: {
              type: Type.STRING,
              description:
                'Tipo di prodotto: cibo | bevande | cura_casa | igiene_persona | farmacia | casalinghi | altro.',
            },
            quantity: {
              type: Type.STRING,
              description: 'Facoltativo: quantità in testo libero (es. "2 confezioni", "1 kg").',
            },
            urgency: {
              type: Type.STRING,
              description: 'Facoltativo: bassa | media | alta. Default: media.',
            },
            note: {
              type: Type.STRING,
              description: 'Facoltativo: nota breve (es. "quella senza lattosio").',
            },
          },
          required: ['name', 'category'],
        },
      },
      action: actionParam,
    },
    required: ['items'],
  },
}

export const markShoppingBoughtTool = {
  name: 'mark_shopping_bought',
  description:
    'Segna come GIÀ COMPRATI uno o più articoli della lista della spesa, identificati dal loro id ' +
    'preso dall\'elenco LISTA DELLA SPESA. Usalo quando l\'utente dice di aver comprato qualcosa. ' +
    'Gli articoli spuntati escono dalla lista e finiscono nello storico: l\'operazione si annulla dall\'app, ' +
    'quindi non serve una conferma esplicita.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      item_ids: {
        type: Type.ARRAY,
        description: 'Gli id (UUID) esatti degli articoli comprati.',
        items: { type: Type.STRING },
      },
      action: actionParam,
    },
    required: ['item_ids'],
  },
}

export const removeShoppingItemsTool = {
  name: 'remove_shopping_items',
  description:
    'Toglie definitivamente uno o più articoli dalla lista della spesa SENZA segnarli come comprati ' +
    '(es. "non serve più", "l\'ho messo per sbaglio"). Prima di chiamarlo riepiloga cosa stai per ' +
    'togliere e attendi una conferma esplicita: l\'articolo viene eliminato, non spostato nello storico.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      item_ids: {
        type: Type.ARRAY,
        description: 'Gli id (UUID) esatti degli articoli da togliere dalla lista.',
        items: { type: Type.STRING },
      },
      action: actionParam,
    },
    required: ['item_ids'],
  },
}

export const checkExpenseReceiptTool = {
  name: 'check_expense_receipt',
  description:
    'Confronta lo scontrino allegato a una SPESA con la lista della spesa: spunta in automatico gli ' +
    'articoli che risultano comprati e riporta quelli che restano da comprare. ' +
    'Usalo quando l\'utente chiede di controllare uno scontrino già allegato a una spesa ' +
    '(es. "controlla lo scontrino della spesa di ieri contro la lista"). ' +
    'Funziona solo su spese che nell\'ELENCO SPESE hanno il marcatore 📎scontrino. ' +
    'Per sapere invece cosa manca dall\'ultimo scontrino già controllato non serve nessun tool: ' +
    'quel dato è già nel contesto.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expense_id: {
        type: Type.STRING,
        description: 'L\'id (UUID) della spesa il cui scontrino va confrontato con la lista.',
      },
      action: actionParam,
    },
    required: ['expense_id'],
  },
}
