"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { useState, useCallback } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface SortableContainerProps<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  children: React.ReactNode;
  renderOverlay?: (activeItem: T | null) => React.ReactNode;
  strategy?: "vertical" | "grid";
  className?: string;
  disabled?: boolean;
}

export function SortableContainer<T extends { id: string }>({
  items,
  onReorder,
  children,
  renderOverlay,
  strategy = "grid",
  className,
  disabled = false,
}: SortableContainerProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    if (isMobile && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [isMobile]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (over && active.id !== over.id) {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newItems = [...items];
          const [movedItem] = newItems.splice(oldIndex, 1);
          newItems.splice(newIndex, 0, movedItem);
          onReorder(newItems);
        }
      }
    },
    [items, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeItem = activeId ? items.find((item) => item.id === activeId) ?? null : null;
  const sortingStrategy = strategy === "vertical" ? verticalListSortingStrategy : rectSortingStrategy;

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[restrictToParentElement]}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={sortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
      <DragOverlay adjustScale dropAnimation={null}>
        {renderOverlay ? renderOverlay(activeItem) : null}
      </DragOverlay>
    </DndContext>
  );
}
