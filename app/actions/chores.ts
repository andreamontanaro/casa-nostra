'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenAI, Type } from '@google/genai'
import { WEEKLY_GOAL_XP, KUDOS_XP } from '@/lib/chores/config'
import { computeFilledNotches } from '@/lib/chores/weekly'
import { MODEL } from '@/lib/assistant/run'
import { isTelegramConfigured } from '@/lib/telegram/config'
import { choreNotchFilledMessage, notifyTelegram } from '@/lib/telegram/notify'
import { Constants } from '@/types/database'
import type { Database } from '@/types/database'

type ChoreArea = Database['public']['Enums']['chore_area']
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

const CHORE_AREAS = Constants.public.Enums.chore_area

function revalidateChores() {
  revalidatePath('/casa')
  revalidatePath('/casa/catalogo')
  revalidatePath('/')
}

/** XP di casa della settimana corrente: stesso dato di `v_chore_week` + `v_chore_kudos_week`
 *  che alimenta obiettivo, striscia e bottiglia — non attribuito a nessun utente. */
async function currentWeekHouseholdXp(supabase: SupabaseServerClient): Promise<number> {
  const { data: weekStart, error: weekError } = await supabase.rpc('current_chore_week_start')
  if (weekError || !weekStart) return 0

  const [choreRes, kudosRes] = await Promise.all([
    supabase.from('v_chore_week').select('xp').eq('week_start', weekStart),
    supabase.from('v_chore_kudos_week').select('kudos_count').eq('week_start', weekStart),
  ])

  const choreXp = (choreRes.data ?? []).reduce((sum, r) => sum + (r.xp ?? 0), 0)
  const kudosXp = (kudosRes.data ?? []).reduce((sum, r) => sum + (r.kudos_count ?? 0), 0) * KUDOS_XP
  return choreXp + kudosXp
}

/**
 * Avvisa il gruppo Telegram quando un'azione fa scattare una nuova tacca
 * della bottiglia settimanale. Mai un confronto tra i due (solo il numero di
 * tacche di casa), e mai sulle tacche che si svuotano: si notifica solo
 * quando se ne riempie una in più. Non solleva mai: una notifica persa non
 * deve far fallire il salvataggio.
 */
async function notifyChoreNotchProgress(supabase: SupabaseServerClient, beforeXp: number) {
  if (!isTelegramConfigured()) return

  try {
    const afterXp = await currentWeekHouseholdXp(supabase)
    const filledBefore = computeFilledNotches(beforeXp, WEEKLY_GOAL_XP)
    const filledAfter = computeFilledNotches(afterXp, WEEKLY_GOAL_XP)
    if (filledAfter <= filledBefore) return

    notifyTelegram(choreNotchFilledMessage(filledAfter, 5, filledAfter >= 5))
  } catch (e) {
    console.error('[telegram] notifica bottiglia non preparata:', e)
  }
}

export type ActionState = { error?: string; ok?: boolean }

/**
 * Registra il completamento di una faccenda del catalogo. title/area/xp sono
 * fotografati dal template al momento della chiamata: ritarare il catalogo in
 * seguito non altera questa riga (vedi docs/design-modulo-gestione-casa.md).
 */
export async function completeChore(
  templateId: string,
  doneAt?: string,
  doneBy?: string,
): Promise<{ error?: string; logId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const telegramOn = isTelegramConfigured()
  const beforeXp = telegramOn ? await currentWeekHouseholdXp(supabase) : 0

  const { data: template, error: templateError } = await supabase
    .from('chore_templates')
    .select('name, area, effort_xp')
    .eq('id', templateId)
    .single()

  if (templateError || !template) return { error: 'Faccenda non trovata.' }

  const { data: inserted, error } = await supabase
    .from('chore_logs')
    .insert({
      template_id: templateId,
      title: template.name,
      area: template.area,
      xp: template.effort_xp,
      done_by: doneBy ?? user.id,
      done_at: doneAt ?? new Date().toISOString(),
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidateChores()
  if (telegramOn) await notifyChoreNotchProgress(supabase, beforeXp)
  return { logId: inserted.id }
}

/** Faccenda fuori catalogo: una-tantum, senza template. */
export async function completeOneOffChore(params: {
  name: string
  area: ChoreArea
  xp: number
  doneAt?: string
}): Promise<{ error?: string; logId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const name = params.name.trim()
  if (!name) return { error: 'Il nome della faccenda è obbligatorio.' }
  if (!Number.isFinite(params.xp) || params.xp < 1 || params.xp > 100) {
    return { error: 'XP non valido.' }
  }

  const telegramOn = isTelegramConfigured()
  const beforeXp = telegramOn ? await currentWeekHouseholdXp(supabase) : 0

  const { data: inserted, error } = await supabase
    .from('chore_logs')
    .insert({
      template_id: null,
      title: name,
      area: params.area,
      xp: Math.round(params.xp),
      done_by: user.id,
      done_at: params.doneAt ?? new Date().toISOString(),
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidateChores()
  if (telegramOn) await notifyChoreNotchProgress(supabase, beforeXp)
  return { logId: inserted.id }
}

/**
 * Elimina una registrazione: usata sia dal bottone "Annulla" del toast
 * subito dopo un "Fatto" sia, dal feed "Fatto di recente", per correggere
 * una voce aggiunta per errore in qualsiasi momento successivo. RLS
 * consente la cancellazione solo su righe proprie (done_by o created_by).
 */
export async function undoChoreLog(logId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('chore_logs').delete().eq('id', logId)
  if (error) return { error: 'Impossibile eliminare.' }

  revalidateChores()
  return { ok: true }
}

/**
 * Lascia o aggiorna un kudos su una faccenda dell'altro. Al massimo uno per
 * utente per log (PK composita `chore_kudos`): scegliere un'altra emoji
 * aggiorna la reazione invece di aggiungerne una seconda. Il divieto di
 * auto-kudos è imposto da RLS, non da questo controllo lato server.
 */
export async function setChoreKudos(logId: string, emoji: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const telegramOn = isTelegramConfigured()
  const beforeXp = telegramOn ? await currentWeekHouseholdXp(supabase) : 0

  const { error } = await supabase
    .from('chore_kudos')
    .upsert({ log_id: logId, from_user_id: user.id, emoji }, { onConflict: 'log_id,from_user_id' })

  if (error) return { error: 'Errore durante il salvataggio.' }

  revalidateChores()
  if (telegramOn) await notifyChoreNotchProgress(supabase, beforeXp)
  return { ok: true }
}

/** Ritira il proprio kudos da una faccenda (tap sulla stessa emoji già scelta). */
export async function removeChoreKudos(logId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const { error } = await supabase
    .from('chore_kudos')
    .delete()
    .eq('log_id', logId)
    .eq('from_user_id', user.id)

  if (error) return { error: 'Errore durante la rimozione.' }

  revalidateChores()
  return { ok: true }
}

export async function createChoreTemplate(params: {
  name: string
  area: ChoreArea
  effortXp: number
  cadenceDays: number | null
}): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const name = params.name.trim()
  if (!name) return { error: 'Il nome è obbligatorio.' }
  if (!Number.isFinite(params.effortXp) || params.effortXp < 1 || params.effortXp > 100) {
    return { error: 'XP non valido: da 1 a 100.' }
  }
  if (params.cadenceDays !== null && (!Number.isFinite(params.cadenceDays) || params.cadenceDays < 1)) {
    return { error: 'Cadenza non valida.' }
  }

  const { error } = await supabase.from('chore_templates').insert({
    name,
    area: params.area,
    effort_xp: Math.round(params.effortXp),
    cadence_days: params.cadenceDays,
  })

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidateChores()
  return { ok: true }
}

export async function updateChoreTemplate(
  id: string,
  params: {
    name: string
    area: ChoreArea
    effortXp: number
    cadenceDays: number | null
  },
): Promise<ActionState> {
  const supabase = await createClient()

  const name = params.name.trim()
  if (!name) return { error: 'Il nome è obbligatorio.' }
  if (!Number.isFinite(params.effortXp) || params.effortXp < 1 || params.effortXp > 100) {
    return { error: 'XP non valido: da 1 a 100.' }
  }
  if (params.cadenceDays !== null && (!Number.isFinite(params.cadenceDays) || params.cadenceDays < 1)) {
    return { error: 'Cadenza non valida.' }
  }

  const { error } = await supabase
    .from('chore_templates')
    .update({
      name,
      area: params.area,
      effort_xp: Math.round(params.effortXp),
      cadence_days: params.cadenceDays,
    })
    .eq('id', id)

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidateChores()
  return { ok: true }
}

/**
 * Eliminazione logica: la voce sparisce dalle liste ma lo storico dei
 * completamenti resta intatto (docs/design-modulo-gestione-casa.md § 5).
 */
export async function setChoreTemplateActive(id: string, active: boolean): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('chore_templates')
    .update({ active })
    .eq('id', id)

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidateChores()
  return { ok: true }
}

/**
 * Cancellazione fisica, ammessa solo per una voce senza log: rimedia a un
 * errore di battitura, non riscrive il passato. Altrimenti si disattiva.
 */
export async function deleteChoreTemplate(id: string): Promise<ActionState> {
  const supabase = await createClient()

  const { count, error: countError } = await supabase
    .from('chore_logs')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id)

  if (countError) return { error: 'Errore durante il controllo. Riprova.' }
  if ((count ?? 0) > 0) {
    return { error: 'Questa faccenda ha già uno storico: disattivala invece di eliminarla.' }
  }

  const { error } = await supabase.from('chore_templates').delete().eq('id', id)
  if (error) return { error: 'Errore durante l\'eliminazione. Riprova.' }

  revalidateChores()
  return { ok: true }
}

export type ChoreXpEstimate = { ok: true; area: ChoreArea; xp: number } | { ok: false; error: string }

/**
 * Stima area e XP di una faccenda fuori catalogo a partire dalla sola
 * descrizione libera, tarando la risposta sul catalogo esistente invece che
 * su una scala arbitraria. Non scrive nulla: la stima resta un suggerimento
 * modificabile nel form (stesso principio del default 50/50 sull'affitto),
 * mai un valore imposto.
 */
export async function estimateChoreXp(description: string): Promise<ChoreXpEstimate> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autenticato.' }

  const trimmed = description.trim()
  if (!trimmed) return { ok: false, error: 'Descrivi cosa hai fatto prima di chiedere una stima.' }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { ok: false, error: 'Stima non disponibile: manca la chiave API di Gemini.' }

  const { data: templates, error: templatesError } = await supabase
    .from('chore_templates')
    .select('name, area, effort_xp')
    .eq('active', true)
    .order('effort_xp', { ascending: true })

  if (templatesError) return { ok: false, error: 'Errore nel leggere il catalogo di riferimento.' }
  if (!templates || templates.length === 0) {
    return { ok: false, error: 'Il catalogo è vuoto: non c\'è nulla a cui tarare la stima.' }
  }

  const reference = templates.map((t) => `${t.name} — ${t.area} — ${t.effort_xp} XP`).join('\n')

  const ai = new GoogleGenAI({ apiKey })

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'Stimi il "peso" in XP di una faccenda domestica per un\'app che tiene traccia dei ' +
                'lavori di casa di una coppia. La regola di taratura del catalogo esistente è: XP ≈ ' +
                'minuti di lavoro effettivo, arrotondati, su una scala da 1 a 100.\n\n' +
                'Faccende già in catalogo, come riferimento (nome — area — XP):\n' +
                reference +
                '\n\nStima ora, con lo stesso criterio, la faccenda descritta dall\'utente qui sotto. ' +
                `Aree valide: ${CHORE_AREAS.join(', ')}. Rispondi solo con l'oggetto richiesto.\n\n` +
                `Faccenda da stimare: "${trimmed}"`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            area: { type: Type.STRING, enum: [...CHORE_AREAS] },
            xp: { type: Type.INTEGER },
          },
          required: ['area', 'xp'],
        },
      },
    })

    const text = result.text
    if (!text) return { ok: false, error: 'Nessuna risposta dalla stima. Riprova o inserisci i valori a mano.' }

    const parsed = JSON.parse(text) as { area?: string; xp?: number }
    const area = CHORE_AREAS.find((a) => a === parsed.area)
    const xp = Number.isFinite(parsed.xp) ? Math.min(100, Math.max(1, Math.round(parsed.xp as number))) : null

    if (!area || !xp) {
      return { ok: false, error: 'Stima non valida. Riprova o inserisci i valori a mano.' }
    }

    return { ok: true, area, xp }
  } catch (e) {
    console.error('[assistant] stima XP fallita:', e)
    return { ok: false, error: 'Errore durante la stima. Riprova o inserisci i valori a mano.' }
  }
}
