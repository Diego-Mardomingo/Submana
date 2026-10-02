"use client";

import { useState } from "react";
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/** Drag & drop list/grid; `onReorder` receives the items in their new order. */
export function SortableContainer<T extends { id: string }>({ items, onReorder, renderItem, renderOverlay, strategy = "grid", className }: {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T) => React.ReactNode;
  renderOverlay?: (activeItem: T | null) => React.ReactNode;
  strategy?: "vertical" | "grid";
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToWindowEdges]}
      onDragStart={({ active }) => {
        setActiveId(String(active.id));
        navigator.vibrate?.(50);
      }}
      onDragEnd={({ active, over }) => {
        setActiveId(null);
        const from = items.findIndex((item) => item.id === active.id);
        const to = items.findIndex((item) => item.id === over?.id);
        if (from !== -1 && to !== -1 && from !== to) onReorder(arrayMove(items, from, to));
      }}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={strategy === "vertical" ? verticalListSortingStrategy : rectSortingStrategy}>
        <div className={className}>{items.map(renderItem)}</div>
      </SortableContext>
      {renderOverlay && <DragOverlay dropAnimation={null}>{renderOverlay(items.find((i) => i.id === activeId) ?? null)}</DragOverlay>}
    </DndContext>
  );
}

const layoutTransition = { type: "spring" as const, stiffness: 400, damping: 30 };

/** Sortable cell: the whole card drags on mobile (long press), a grip handle does on desktop. */
export function SortableItem({ id, children, showHandle = true }: { id: string; children: React.ReactNode; showHandle?: boolean }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const reduceMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useSortable({ id });
  const motionProps = { layout: !isDragging, transition: reduceMotion ? { duration: 0 } : layoutTransition };

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0, visibility: "hidden" } : { transform: CSS.Translate.toString(transform) }}
      className={cn("sortable-item", isMobile ? "sortable-item--mobile" : "sortable-item--desktop", isDragging && "sortable-item--dragging")}
      {...attributes}
      {...(isMobile && listeners)}
    >
      {isMobile ? (
        <motion.div {...motionProps}>{children}</motion.div>
      ) : (
        <motion.div {...motionProps} className="sortable-item__motion">
          {showHandle && (
            <button ref={setActivatorNodeRef} type="button" className="sortable-handle" {...listeners} aria-label="Reordenar">
              <GripVertical className="size-4" />
            </button>
          )}
          <div className="sortable-item__content">{children}</div>
        </motion.div>
      )}
    </div>
  );
}
