"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useState, useCallback, useEffect, useRef } from "react";

interface SortableContainerProps<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  renderOverlay?: (activeItem: T | null) => React.ReactNode;
  strategy?: "vertical" | "grid";
  className?: string;
  disabled?: boolean;
}

export function SortableContainer<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  renderOverlay,
  strategy = "grid",
  className,
  disabled = false,
}: SortableContainerProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<T[]>(items);
  const isDraggingRef = useRef(false);

  // Sincronizar con items externos solo cuando no estamos arrastrando
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalItems(items);
    }
  }, [items]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    isDraggingRef.current = true;
    setActiveId(event.active.id as string);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = localItems.findIndex((item) => item.id === active.id);
        const newIndex = localItems.findIndex((item) => item.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newItems = arrayMove(localItems, oldIndex, newIndex);
          // Actualizar estado local INMEDIATAMENTE (antes de limpiar activeId)
          setLocalItems(newItems);
          // Notificar al padre para persistir
          onReorder(newItems);
        }
      }

      // Limpiar activeId después de actualizar localItems
      setActiveId(null);
      isDraggingRef.current = false;
    },
    [localItems, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    isDraggingRef.current = false;
  }, []);

  const activeItem = activeId ? localItems.find((item) => item.id === activeId) ?? null : null;
  const sortingStrategy = strategy === "vertical" ? verticalListSortingStrategy : rectSortingStrategy;

  if (disabled) {
    return <div className={className}>{localItems.map(renderItem)}</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[restrictToWindowEdges]}
    >
      <SortableContext items={localItems.map((i) => i.id)} strategy={sortingStrategy}>
        <div className={className}>{localItems.map(renderItem)}</div>
      </SortableContext>
      {renderOverlay && (
        <DragOverlay dropAnimation={null}>
          {renderOverlay(activeItem)}
        </DragOverlay>
      )}
    </DndContext>
  );
}
