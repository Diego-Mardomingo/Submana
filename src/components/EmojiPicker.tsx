"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";

const COMMON_EMOJIS = [
  "🍽️", "🛒", "🛍️", "🚗", "🏠", "💡", "⚡", "💰", "💵", "📈", "💼",
  "✈️", "🎬", "🎮", "📺", "📚", "🎓", "❤️", "💊", "🏥", "💪",
  "👕", "💻", "📱", "☕", "🍕", "🍎", "🎁", "🎉", "📧", "🔒",
  "⭐", "🌍", "🐕", "🌸", "🔥", "💧", "🏦", "📦", "🚌", "⛽",
];

/** Emoji field: type/paste any emoji or pick a common one. */
export default function EmojiPicker({ value, onChange }: { value?: string | null; onChange: (emoji: string) => void }) {
  const t = useTranslations(useLang());
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const openChange = (next: boolean) => {
    if (next) setInput(value || "");
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 text-2xl transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {value || "🏷️"}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-auto p-3 max-h-[200px] overflow-y-auto" style={{ zIndex: 9999 }}>
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">{t("categories.emojiHint")}</label>
            <Input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (e.target.value.trim()) onChange(e.target.value.trim());
              }}
              placeholder="🏷️"
              className="text-lg h-9 text-center"
              aria-label="Escribe o pega un emoji"
            />
          </div>
          <div className="text-xs text-muted-foreground">{t("categories.emojiQuickPick")}</div>
          <div className="grid grid-cols-5 gap-0.5">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={cn("flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-accent", value === emoji && "bg-accent")}
                onClick={() => {
                  onChange(emoji);
                  setOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
