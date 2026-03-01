"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  showHandle?: boolean;
  disabled?: boolean;
}

export function SortableItem({
  id,
  children,
  className,
  showHandle = true,
  disabled = false,
}: SortableItemProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : "auto",
    touchAction: "none",
  };

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  if (isMobile) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "sortable-item",
          isDragging && "sortable-item--dragging",
          className
        )}
        {...attributes}
        {...listeners}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "sortable-item sortable-item--desktop",
        isDragging && "sortable-item--dragging",
        className
      )}
      {...attributes}
    >
      {showHandle && (
        <button
          type="button"
          className="sortable-handle"
          {...listeners}
          aria-label="Reordenar"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <div className="sortable-item__content">{children}</div>
    </div>
  );
}
