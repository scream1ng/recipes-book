"use client";

import { useRef, useState } from "react";

const DELETE_WIDTH = 76;

/** Trailing-swipe-to-delete wrapper. A visible Delete affordance stays available for non-touch use. */
export function SwipeRow({
  children,
  onDelete,
  deleteLabel = "Delete",
}: {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ startX: number; startDragX: number; dragging: boolean } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    dragState.current = { startX: e.clientX, startDragX: dragX, dragging: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const state = dragState.current;
    if (!state) return;
    const delta = e.clientX - state.startX;
    if (!state.dragging && Math.abs(delta) < 6) return;
    state.dragging = true;
    setDragging(true);
    setDragX(Math.min(0, Math.max(-DELETE_WIDTH, state.startDragX + delta)));
  }

  function onPointerUp() {
    const state = dragState.current;
    if (state?.dragging) {
      setDragX(dragX < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0);
    }
    setDragging(false);
    dragState.current = null;
  }

  function onClickCapture(e: React.MouseEvent) {
    if (dragState.current?.dragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (dragX !== 0) {
      e.preventDefault();
      e.stopPropagation();
      setDragX(0);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        onClick={() => {
          setDragX(0);
          onDelete();
        }}
        style={{ width: DELETE_WIDTH }}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-(--color-destructive) text-sm font-medium text-white active:opacity-80"
      >
        {deleteLabel}
      </button>
      <div
        className="relative touch-pan-y select-none bg-(--color-surface)"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
