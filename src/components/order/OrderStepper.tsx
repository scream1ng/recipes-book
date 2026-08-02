"use client";

import { useOptimistic, useTransition } from "react";
import { setOrderQty } from "@/lib/actions/order";
import { Stepper } from "@/components/ui/Stepper";

export function OrderStepper({ recipeId, qty }: { recipeId: string; qty: number }) {
  const [optimisticQty, setOptimisticQty] = useOptimistic(qty);
  const [, startTransition] = useTransition();

  function update(next: number) {
    const clamped = Math.max(0, next);
    startTransition(() => {
      setOptimisticQty(clamped);
      setOrderQty(recipeId, clamped);
    });
  }

  return (
    <Stepper
      value={optimisticQty}
      onIncrement={() => update(optimisticQty + 1)}
      onDecrement={() => update(optimisticQty - 1)}
    />
  );
}
