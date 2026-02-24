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
    // #region agent log
    if (v === false) fetch("http://127.0.0.1:7758/ingest/a39ccdc9-d118-4e4b-9fd3-e3cdc92e95b3",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"f06c04"},body:JSON.stringify({sessionId:"f06c04",location:"EmojiPicker.tsx:setOpen",message:"popover closing",data:{isControlled},timestamp:Date.now(),hypothesisId:"H2"})}).catch(()=>{});
    // #endregion
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
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
