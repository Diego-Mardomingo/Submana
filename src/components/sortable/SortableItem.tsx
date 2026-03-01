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
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });

  const style: React.CSSProperties = isDragging
    ? {
        opacity: 0,
        visibility: "hidden" as const,
      }
    : {
        transform: CSS.Translate.toString(transform),
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
          "sortable-item sortable-item--mobile",
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
          ref={setActivatorNodeRef}
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
