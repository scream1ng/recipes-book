"use client";

import { useRef, useState } from "react";

const DELETE_WIDTH = 76;
/** A finger tap drifts a few px; only treat a gesture as a swipe past this, and only if it's
 *  more horizontal than vertical — otherwise taps on rows containing inputs get swallowed. */
const DRAG_THRESHOLD = 10;

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
  const dragState = useRef<{
    startX: number;
    startY: number;
    startDragX: number;
    dragX: number;
    dragging: boolean;
    rejected: boolean;
  } | null>(null);
  /** Set on a gesture that actually dragged, so the trailing click doesn't also fire. */
  const justDragged = useRef(false);
  /** Mirrors dragX for handlers that would otherwise read a stale render closure. */
  const openRef = useRef(false);

  function close() {
    openRef.current = false;
    setDragX(0);
  }

  function onPointerDown(e: React.PointerEvent) {
    justDragged.current = false;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startDragX: dragX,
      dragX,
      dragging: false,
      rejected: false,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const state = dragState.current;
    if (!state || state.rejected) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.dragging) {
      // Undecided: a clearly vertical gesture is a scroll, never a swipe.
      if (Math.abs(dx) < DRAG_THRESHOLD) {
        if (Math.abs(dy) >= DRAG_THRESHOLD) state.rejected = true;
        return;
      }
      if (Math.abs(dx) <= Math.abs(dy)) {
        state.rejected = true;
        return;
      }
      state.dragging = true;
      setDragging(true);
    }
    state.dragX = Math.min(0, Math.max(-DELETE_WIDTH, state.startDragX + dx));
    setDragX(state.dragX);
  }

  function onPointerUp() {
    const state = dragState.current;
    if (state?.dragging) {
      const settled = state.dragX < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0;
      openRef.current = settled !== 0;
      setDragX(settled);
      justDragged.current = true;
    }
    setDragging(false);
    dragState.current = null;
  }

  function onClickCapture(e: React.MouseEvent) {
    if (justDragged.current) {
      justDragged.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (openRef.current) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        onClick={() => {
          close();
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
