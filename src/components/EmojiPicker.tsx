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
  "🍽️", "🛒", "🛍️", "🚗", "🏠", "💡", "⚡", "💰", "💵", "📈", "💼",
  "✈️", "🎬", "🎮", "📺", "📚", "🎓", "❤️", "💊", "🏥", "💪",
  "👕", "💻", "📱", "☕", "🍕", "🍎", "🎁", "🎉", "📧", "🔒",
  "⭐", "🌍", "🐕", "🌸", "🔥", "💧", "🏦", "📦", "🚌", "⛽",
];

interface EmojiPickerProps {
  value?: string | null;
  onChange: (emoji: string) => void;
  className?: string;
  /** Controlled mode: parent controls open state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function EmojiPicker({ value, onChange, className, open: controlledOpen, onOpenChange }: EmojiPickerProps) {
  const lang = useLang();
  const t = useTranslations(lang);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [inputVal, setInputVal] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Al abrir, el input arranca con el valor actual (ajuste de estado en render).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setInputVal(value || "");
  }

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

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
      <PopoverContent
        side="bottom"
        align="start"
        className="w-auto p-3 max-h-[200px] overflow-y-auto"
        style={{ zIndex: 9999 }}
        data-emoji-picker-popover
      >
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
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
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-accent",
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
