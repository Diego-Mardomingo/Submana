"use client";

import { useState } from "react";
import { DeleteAction, FieldGroup, FieldRow, FieldStack, FormError, FormHero, HeroTile, RowInput, SheetButton } from "@/components/SheetFields";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { useCategoryLookup, useCreateCategory, useDeleteCategory, useUpdateCategory } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";

export type CategoryFormState = { mode: "create" | "createSub" | "edit"; id?: string; parentId?: string; name: string; emoji: string };

const COMMON_EMOJIS = [
  "🍽️", "🛒", "🛍️", "🚗", "🏠", "💡", "⚡", "💰", "💵", "📈", "💼", "✈️",
  "🎬", "🎮", "📺", "📚", "🎓", "❤️", "💊", "🏥", "💪", "👕", "💻", "📱",
  "☕", "🍕", "🍎", "🎁", "🎉", "📧", "🔒", "⭐", "🌍", "🐕", "🌸", "🔥",
  "💧", "🏦", "📦", "🚌", "⛽", "🧾",
];

function CategoryFormBody({ initial, onDone }: { initial: CategoryFormState; onDone: () => void }) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const lookup = useCategoryLookup();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [name, setName] = useState(initial.name);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [error, setError] = useState("");
  const { mode } = initial;
  const parentId = initial.parentId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(es ? "Ponle un nombre a la categoría" : "Give the category a name");
      return;
    }
    try {
      if (mode === "edit" && initial.id) await updateCategory.mutateAsync({ id: initial.id, name: name.trim(), emoji: emoji || null });
      else await createCategory.mutateAsync({ name: name.trim(), parent_id: mode === "createSub" ? parentId : null, emoji: emoji || null });
      toast.success(t(mode === "edit" ? "categories.saved" : "categories.created"));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <SheetForm onSubmit={handleSubmit}>
      <SheetBody>
        <FormHero>
          <HeroTile>{emoji || "🏷️"}</HeroTile>
          {mode === "createSub" && parentId && (
            <span className="sf-badge">
              {es ? "Dentro de" : "Inside"} {lookup.emoji.get(parentId)} {lookup.name.get(parentId)}
            </span>
          )}
        </FormHero>

        <FieldGroup>
          <FieldRow label={t("settings.name")} htmlFor="category-name">
            <RowInput
              id="category-name"
              placeholder={es ? "Mascotas, gimnasio…" : "Pets, gym…"}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              enterKeyHint="done"
            />
          </FieldRow>
        </FieldGroup>

        <FieldGroup title="Emoji" hint={t("categories.emojiHint")}>
          <FieldRow label={es ? "Personalizado" : "Custom"} htmlFor="category-emoji">
            <RowInput
              id="category-emoji"
              placeholder="🏷️"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.trim())}
              className="!w-16 text-center text-xl"
              aria-label={t("categories.emojiHint")}
            />
          </FieldRow>
          <FieldStack>
            <div className="sf-emoji-grid" role="radiogroup" aria-label="Emoji">
              {COMMON_EMOJIS.map((option) => (
                <button key={option} type="button" role="radio" aria-checked={emoji === option} className="sf-emoji" onClick={() => setEmoji(option)}>
                  {option}
                </button>
              ))}
            </div>
          </FieldStack>
        </FieldGroup>

        {mode === "edit" && initial.id && (
          <FieldGroup>
            <DeleteAction
              label={es ? "Eliminar categoría" : "Delete category"}
              confirmTitle={es ? `¿Eliminar «${initial.name}»?` : `Delete “${initial.name}”?`}
              confirmText={es ? "Esta acción no se puede deshacer." : "This can't be undone."}
              confirmLabel={es ? "Sí, eliminar" : "Yes, delete"}
              pending={deleteCategory.isPending}
              onConfirm={async () => {
                try {
                  await deleteCategory.mutateAsync(initial.id!);
                } catch {
                  return; // the error toast is already up; keep the confirmation to retry
                }
                toast.success(t("categories.deleted"));
                onDone();
              }}
            />
          </FieldGroup>
        )}
      </SheetBody>

      <SheetFooter>
        <FormError>{error}</FormError>
        <SheetButton type="submit" pending={createCategory.isPending || updateCategory.isPending}>
          {mode === "edit" ? (es ? "Guardar cambios" : "Save changes") : es ? "Crear categoría" : "Create category"}
        </SheetButton>
      </SheetFooter>
    </SheetForm>
  );
}

/** Create a category or subcategory, or edit / delete one of the user's. */
export function CategorySheet({ form, onClose }: { form: CategoryFormState | null; onClose: () => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const open = !!form;
  const shown = useSheetPayload(open, form);
  const mode = shown?.mode ?? "create";
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()} title={mode === "edit" ? (lang === "es" ? "Editar categoría" : "Edit category") : t(mode === "create" ? "categories.add" : "categories.addSub")}>
      {shown && <CategoryFormBody initial={shown} onDone={onClose} />}
    </Sheet>
  );
}
