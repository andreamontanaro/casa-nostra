"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createExpense, type ExpenseFormState } from "@/app/actions/expenses";
import { uploadAttachments } from "@/lib/attachments";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { ExpenseFormFields } from "@/components/expense/ExpenseFormFields";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { DEFAULT_SPLIT, todayISO } from "@/lib/fmt";
import { Tables, Constants } from "@/types/database";
import { cn } from "@/lib/utils";

type Profile = Tables<"profiles">;
type Category = (typeof Constants.public.Enums.expense_category)[number];
type SplitRule = (typeof Constants.public.Enums.split_rule)[number];

export interface OptimisticExpense {
  id: string;
  amount: number;
  description: string;
  category: Category;
  split_rule: SplitRule;
  paid_by: string;
  expense_date: string;
  settlement_id: null;
  created_by: string;
  custom_other_share: number | null;
  created_at: string;
  updated_at: string;
  paid_by_profile: { display_name: string } | null;
  __optimistic: true;
}

interface ExpenseFormProps {
  profiles: Profile[];
  currentUserId: string;
  suggestions?: string[];
  onOptimisticInsert?: (e: OptimisticExpense) => void;
  // Path interno dove tornare dopo il salvataggio: se impostato la Server Action
  // fa redirect (form a schermo intero); se assente resta in pagina (bottom-sheet).
  redirectTo?: string;
  // Callback a salvataggio riuscito nel flusso in-page (es. chiudere il sheet).
  onSuccess?: () => void;
}

export function ExpenseForm({
  profiles,
  currentUserId,
  suggestions = [],
  onOptimisticInsert,
  redirectTo,
  onSuccess,
}: ExpenseFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ExpenseFormState, FormData>(
    createExpense,
    {},
  );
  const [attachFiles, setAttachFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<Category>("spesa_alimentare");
  const [splitRule, setSplitRule] = useState<SplitRule>("sixty_forty");
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [rawAmount, setRawAmount] = useState("");
  const [description, setDescription] = useState("");
  const [customOtherShare, setCustomOtherShare] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayISO());

  // Nel flusso bottom-sheet (senza redirect) il Salva è una barra sticky in
  // fondo; a schermo intero (con redirect) resta in coda allo scroll.
  const isSheet = !redirectTo;

  // Quando createExpense torna un expenseId (caso con allegati) entriamo nella
  // fase di finalizzazione: upload dei file e poi navigazione.
  const finalizing = Boolean(state.expenseId);

  function resetForm() {
    setRawAmount("");
    setDescription("");
    setCategory("spesa_alimentare");
    setSplitRule("sixty_forty");
    setPaidBy(currentUserId);
    setCustomOtherShare("");
    setExpenseDate(todayISO());
    setAttachFiles([]);
  }

  // Salvataggio riuscito nel flusso in-page (bottom-sheet): un solo toast,
  // reset del form, chiusura del sheet e revalidazione della rotta corrente.
  function finalizeSuccess() {
    toast.success("Spesa salvata.");
    resetForm();
    onSuccess?.();
    router.refresh();
  }

  // Con allegati createExpense non fa redirect ma torna expenseId: carichiamo
  // i file e poi finalizziamo (redirect a schermo intero o feedback in-page).
  useEffect(() => {
    if (!state.expenseId) return;
    let cancelled = false;
    (async () => {
      if (attachFiles.length > 0) {
        const results = await uploadAttachments(
          state.expenseId!,
          attachFiles,
          currentUserId,
        );
        const failCount = results.filter((r) => !r.ok).length;
        if (failCount > 0) {
          toast.error("Spesa salvata, alcuni allegati non sono stati caricati.");
        }
      }
      if (cancelled) return;
      if (redirectTo) {
        router.push(`${redirectTo}?ok=expense-created`);
        router.refresh();
      } else {
        finalizeSuccess();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.expenseId]);

  // Salvataggio senza allegati e senza redirect (flusso nel bottom-sheet): la
  // Server Action torna { ok: true }; reagiamo al risultato dell'azione per dare
  // feedback e chiudere il sheet (setState deliberato in risposta all'evento).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.ok && !state.expenseId) finalizeSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!onOptimisticInsert) return;

    const amt = parseFloat(rawAmount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) return;
    const desc = description.trim();
    if (!desc) return;
    if (!expenseDate) return;

    const payer = profiles.find((p) => p.id === paidBy);
    const customShareValue =
      splitRule === "custom"
        ? parseFloat(customOtherShare.replace(",", "."))
        : null;

    const now = new Date().toISOString();
    onOptimisticInsert({
      id: `optimistic-${Date.now()}`,
      amount: amt,
      description: desc,
      category,
      split_rule: splitRule,
      paid_by: paidBy,
      expense_date: expenseDate,
      settlement_id: null,
      created_by: currentUserId,
      custom_other_share:
        customShareValue && !isNaN(customShareValue) && customShareValue > 0
          ? customShareValue
          : null,
      created_at: now,
      updated_at: now,
      paid_by_profile: payer ? { display_name: payer.display_name } : null,
      __optimistic: true,
    });
  }

  function handleCategoryChange(cat: Category) {
    // Adegua la divisione al default della nuova categoria SOLO se l'utente non
    // l'ha personalizzata (cioè coincide ancora col default di quella precedente),
    // così una scelta manuale non viene mai sovrascritta.
    if (splitRule === DEFAULT_SPLIT[category]) {
      setSplitRule(DEFAULT_SPLIT[cat]);
    }
    setCategory(cat);
    // Pre-compilazione affitto: solo se i campi sono ancora vuoti, senza mai
    // sovrascrivere importo o descrizione già digitati.
    if (cat === "affitto") {
      if (rawAmount.trim() === "") setRawAmount("530,00");
      if (description.trim() === "") {
        const today = new Date();
        setDescription(
          `Affitto ${today.toLocaleString("it-IT", { month: "long", year: "numeric" })}`,
        );
      }
    }
  }

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className={cn("flex flex-col px-4 pt-4", isSheet ? "pb-0" : "pb-6")}
    >
      <ExpenseFormFields
        profiles={profiles}
        currentUserId={currentUserId}
        disabled={pending}
        fieldErrors={state.fieldErrors}
        suggestions={suggestions}
        amountFocusOnOpen={isSheet}
        amount={rawAmount}
        onAmountChange={setRawAmount}
        description={description}
        onDescriptionChange={setDescription}
        category={category}
        onCategoryChange={handleCategoryChange}
        splitRule={splitRule}
        onSplitRuleChange={setSplitRule}
        customOtherShare={customOtherShare}
        onCustomOtherShareChange={setCustomOtherShare}
        paidBy={paidBy}
        onPaidByChange={setPaidBy}
        expenseDate={expenseDate}
        onExpenseDateChange={setExpenseDate}
        attachmentsSlot={
          <div className="flex flex-col gap-2">
            <span className="text-label font-medium text-muted">
              Allegati (facoltativi)
            </span>
            <AttachmentUploader
              mode="deferred"
              files={attachFiles}
              onFilesChange={setAttachFiles}
              disabled={pending || finalizing}
            />
          </div>
        }
      />

      <input
        type="hidden"
        name="has_attachments"
        value={attachFiles.length > 0 ? "1" : "0"}
      />
      <input type="hidden" name="redirect_to" value={redirectTo ?? ""} />

      {state.error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div
        className={cn(
          "mt-5",
          isSheet &&
            "sticky bottom-0 z-10 -mx-4 mt-4 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,var(--safe-bottom))]",
        )}
      >
        <Button
          type="submit"
          size="lg"
          loading={pending || finalizing}
          className="w-full"
        >
          Salva spesa
        </Button>
      </div>
    </form>
  );
}
