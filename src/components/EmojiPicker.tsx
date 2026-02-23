"use client";

import { useState, useRef, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

const COMMON_EMOJIS = [
  "🍽️", "🛒", "🚗", "🏠", "💡", "⚡", "💰", "💵", "📈", "💼",
  "✈️", "🎬", "🎮", "📺", "📚", "❤️", "💊", "🏥", "💪", "🛍️",
  "👕", "💻", "📱", "☕", "🍕", "🍎", "🎁", "🎉", "📧", "🔒",
  "⭐", "🌍", "🐕", "🌸", "🔥", "💧", "🏦", "📦", "🚌", "⛽",
];

interface EmojiPickerProps {
  value?: string | null;
  onChange: (emoji: string) => void;
  className?: string;
}

export default function EmojiPicker({ value, onChange, className }: EmojiPickerProps) {
  const lang = useLang();
  const t = useTranslations(lang);
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInputVal(value || "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputVal(v);
    if (v.trim()) onChange(v.trim());
  };

  const handleInputBlur = () => {
    if (inputVal.trim()) onChange(inputVal.trim());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 text-2xl transition-colors hover:bg-accent hover:text-accent-foreground",
            className
          )}
        >
          {value || "🏷️"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 max-h-[min(70vh,420px)] overflow-y-auto" align="start" style={{ zIndex: 9999 }}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">
              {t("categories.emojiHint")}
            </label>
            <Input
              ref={inputRef}
              type="text"
              inputMode="text"
              value={inputVal}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              placeholder="🏷️"
              className="text-xl h-11 text-center"
              aria-label="Escribe o pega un emoji"
            />
          </div>
          <div className="text-xs text-muted-foreground">{t("categories.emojiQuickPick")}</div>
          <div className="grid grid-cols-5 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors hover:bg-accent",
                  value === emoji && "bg-accent"
                )}
                onClick={() => {
                  onChange(emoji);
                  setInputVal(emoji);
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
