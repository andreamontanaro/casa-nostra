-- ============================================================
-- Casa Nostra - Faccende: azioni create da voi
-- ------------------------------------------------------------
-- Le azioni pronte da toccare nel pannello "Ho fatto una faccenda"
-- sono di due tipi: quelle predefinite, scritte nel codice
-- (lib/chores/presets.ts), e quelle che aggiungete voi, qui.
-- Un'azione e' solo una scorciatoia per il nome: la faccenda fatta
-- resta una riga di chore_entries con il nome in testo libero, e
-- eliminare un'azione non tocca le faccende gia' segnate.
--
-- Da eseguire nell'editor SQL di Supabase. Replicata nella
-- sezione 14 di docs/casa_nostra_schema.sql.
-- ============================================================

CREATE TABLE public.chore_presets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  -- Gli ambiti di lib/chores/presets.ts (CHORE_PRESET_GROUPS): la
  -- corrispondenza la controlla tests/chores.test.mjs.
  group_id    text NOT NULL CHECK (group_id IN (
                'cucina', 'pulizie', 'bagno', 'bucato', 'rifiuti', 'spesa', 'manutenzione'
              )),
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chore_presets IS
  'Azioni delle faccende aggiunte dai due utenti, accanto a quelle predefinite nel codice. Solo una scorciatoia per il nome: eliminarle non tocca chore_entries.';

-- "Pulisco la cappa" e " pulisco la cappa" sono la stessa azione.
CREATE UNIQUE INDEX chore_presets_unique_name
  ON public.chore_presets (lower(trim(name)));

-- Come la lista della spesa: le azioni sono di casa, entrambi le
-- aggiungono e le tolgono.
ALTER TABLE public.chore_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chore_presets_select_authorized"
  ON public.chore_presets FOR SELECT
  TO authenticated
  USING (public.is_authorized_user());

CREATE POLICY "chore_presets_insert_authorized"
  ON public.chore_presets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user() AND created_by = auth.uid());

CREATE POLICY "chore_presets_delete_authorized"
  ON public.chore_presets FOR DELETE
  TO authenticated
  USING (public.is_authorized_user());
