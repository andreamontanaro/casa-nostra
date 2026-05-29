"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { createExpense, type ExpenseFormState } from "@/app/actions/expenses";
import { uploadAttachments } from "@/lib/attachments";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { toast } from "@/lib/toast";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  CATEGORY_LABELS,
  CATEGORY_ICON,
  SPLIT_LABELS,
  formatEur,
  todayISO,
} from "@/lib/fmt";
import { Tables, Constants } from "@/types/database";
import { cn } from "@/lib/utils";

type Profile = Tables<"profiles">;
type Category = (typeof Constants.public.Enums.expense_category)[number];
type SplitRule = (typeof Constants.public.Enums.split_rule)[number];

const DEFAULT_SPLIT: Record<Category, SplitRule> = {
  affitto: "fifty_fifty",
  bolletta: "sixty_forty",
  spesa_alimentare: "sixty_forty",
  abbonamento: "sixty_forty",
  manutenzione: "sixty_forty",
  viaggi: "fifty_fifty",
  altro: "sixty_forty",
};

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
}

export function ExpenseForm({
  profiles,
  currentUserId,
  suggestions = [],
  onOptimisticInsert,
}: ExpenseFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ExpenseFormState, FormData>(
    createExpense,
    {},
  );
  const [attachFiles, setAttachFiles] = useState<File[]>([]);
  // Quando createExpense torna un expenseId (caso con allegati) entriamo nella
  // fase di finalizzazione: upload dei file e poi navigazione.
  const finalizing = Boolean(state.expenseId);

  // Con allegati createExpense non fa redirect ma torna expenseId: carichiamo
  // i file e poi navighiamo alla home.
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
      router.push("/?ok=expense-created");
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.expenseId]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!onOptimisticInsert) return;

    const amt = parseFloat(rawAmount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) return;
    const desc = descriptionInputRef.current?.value.trim() ?? "";
    if (!desc) return;

    const dateInput = (e.currentTarget.elements.namedItem(
      "expense_date",
    ) as HTMLInputElement | null)?.value;
    if (!dateInput) return;

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
      expense_date: dateInput,
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

  const [category, setCategory] = useState<Category>("spesa_alimentare");
  const [splitRule, setSplitRule] = useState<SplitRule>("sixty_forty");
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [rawAmount, setRawAmount] = useState("");
  const [customOtherShare, setCustomOtherShare] = useState("");

  const descriptionInputRef = useRef<HTMLInputElement | null>(null);

  function handleCategoryChange(cat: Category) {
    setCategory(cat);
    setSplitRule(DEFAULT_SPLIT[cat]);
  }

  function applySuggestion(s: string) {
    if (descriptionInputRef.current) {
      descriptionInputRef.current.value = s;
      descriptionInputRef.current.focus();
    }
  }

  const otherProfile = profiles.find((p) => p.id !== paidBy);
  const parsedAmount = parseFloat(rawAmount.replace(",", "."));
  const parsedCustomShare = parseFloat(customOtherShare.replace(",", "."));
  const showCustomPreview =
    splitRule === "custom" &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    !isNaN(parsedCustomShare) &&
    parsedCustomShare > 0 &&
    parsedCustomShare < parsedAmount;

  // Default categoria → eventuali pre-fill (affitto: importo + descrizione mese)
  useEffect(() => {
    let description = CATEGORY_LABELS[category] as string;
    if (category === "affitto") {
      setRawAmount("530,00");
      const today = new Date();
      description = `Affitto ${today.toLocaleString("it-IT", { month: "long", year: "numeric" })}`;
    } else {
      setRawAmount("");
    }

    if (descriptionInputRef.current) {
      descriptionInputRef.current.value = description;
    }
  }, [category]);

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 px-4 pt-4 pb-6"
    >
      {/* Importo — hero */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Importo (€)
        </label>
        <input
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          required
          disabled={pending}
          value={rawAmount}
          onChange={(e) => setRawAmount(e.target.value)}
          className={cn(
            "h-16 w-full rounded-2xl border border-border bg-surface px-4",
            "text-3xl font-bold tracking-tight text-foreground tabular-nums",
            "placeholder:text-muted/60 placeholder:font-medium",
            "shadow-soft transition-[border-color,box-shadow] duration-150",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
            "disabled:opacity-50",
          )}
        />
        {state.fieldErrors?.amount && (
          <p className="text-xs text-destructive">{state.fieldErrors.amount}</p>
        )}
      </div>

      {/* Descrizione + suggerimenti */}
      <div className="flex flex-col gap-2">
        <Input
          ref={descriptionInputRef}
          label="Descrizione"
          name="description"
          placeholder="es. Coop settimana"
          required
          disabled={pending}
          error={state.fieldErrors?.description}
        />
        {suggestions.length > 0 && (
          <div className="-mx-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 px-4">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  disabled={pending}
                  className={cn(
                    "shrink-0 rounded-full border border-border bg-surface-raised",
                    "px-3 py-1 text-xs font-medium text-muted",
                    "hover:border-accent/50 hover:text-foreground",
                    "active:scale-95 transition-[transform,border-color,color] duration-150",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Categoria — chip con emoji+label */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Categoria</span>
        <div className="grid grid-cols-3 gap-2">
          {Constants.public.Enums.expense_category.map((cat) => {
            const isActive = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                disabled={pending}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5",
                  "text-sm font-medium transition-[border-color,background-color,color,transform] duration-150",
                  "active:scale-[0.97]",
                  isActive
                    ? "border-accent bg-accent-muted text-accent shadow-soft"
                    : "border-border bg-surface text-muted hover:border-accent/40",
                )}
              >
                <span className="text-base leading-none">
                  {CATEGORY_ICON[cat]}
                </span>
                <span className="truncate">{CATEGORY_LABELS[cat]}</span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="category" value={category} />
      </div>

      {/* Regola divisione */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Divisione</span>
        <div className="flex gap-2">
          {Constants.public.Enums.split_rule.map((rule) => (
            <button
              key={rule}
              type="button"
              onClick={() => setSplitRule(rule)}
              disabled={pending}
              className={cn(
                "flex-1 rounded-2xl border py-2.5 text-sm font-medium transition-[border-color,background-color,color,transform] duration-150",
                "active:scale-[0.97]",
                splitRule === rule
                  ? "border-accent bg-accent-muted text-accent shadow-soft"
                  : "border-border bg-surface text-muted hover:border-accent/40",
              )}
            >
              {SPLIT_LABELS[rule]}
            </button>
          ))}
        </div>
        <input type="hidden" name="split_rule" value={splitRule} />
      </div>

      {/* Quota personalizzata — comparsa animata */}
      <AnimatePresence initial={false}>
        {splitRule === "custom" && (
          <motion.div
            key="custom-share"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Quota di {otherProfile?.display_name ?? "altra persona"} (€)
              </label>
              <input
                name="custom_other_share"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={customOtherShare}
                onChange={(e) => setCustomOtherShare(e.target.value)}
                disabled={pending}
                className={cn(
                  "h-12 w-full rounded-2xl border border-border bg-surface px-4",
                  "text-xl font-semibold text-foreground tabular-nums",
                  "placeholder:text-muted shadow-soft",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
                  "disabled:opacity-50",
                )}
              />
              {showCustomPreview && (
                <p className="text-xs text-muted tabular-nums">
                  La tua quota: {formatEur(parsedAmount - parsedCustomShare)}
                </p>
              )}
              {state.fieldErrors?.custom_other_share && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.custom_other_share}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {splitRule !== "custom" && (
        <input type="hidden" name="custom_other_share" value="" />
      )}

      {/* Pagato da */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Pagato da</span>
        <div className="flex gap-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPaidBy(p.id)}
              disabled={pending}
              className={cn(
                "flex-1 rounded-2xl border py-2.5 text-sm font-medium transition-[border-color,background-color,color,transform] duration-150",
                "active:scale-[0.97]",
                paidBy === p.id
                  ? "border-accent bg-accent-muted text-accent shadow-soft"
                  : "border-border bg-surface text-muted hover:border-accent/40",
              )}
            >
              {p.id === currentUserId ? "Io" : p.display_name}
            </button>
          ))}
        </div>
        <input type="hidden" name="paid_by" value={paidBy} />
      </div>

      {/* Data */}
      <Input
        label="Data"
        name="expense_date"
        type="date"
        defaultValue={todayISO()}
        required
        disabled={pending}
      />

      {/* Allegati */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">
          Allegati (facoltativi)
        </span>
        <AttachmentUploader
          mode="deferred"
          files={attachFiles}
          onFilesChange={setAttachFiles}
          disabled={pending || finalizing}
        />
      </div>
      <input
        type="hidden"
        name="has_attachments"
        value={attachFiles.length > 0 ? "1" : "0"}
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        loading={pending || finalizing}
        className="mt-1 w-full"
      >
        Salva spesa
      </Button>
    </form>
  );
}
