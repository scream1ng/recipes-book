"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { StorePreference } from "@/generated/prisma";

export async function getSettings() {
  const userId = await requireUser();
  return prisma.userSettings.findUniqueOrThrow({ where: { userId } });
}

export interface UpdateSettingsInput {
  storePreference?: StorePreference;
  showUnitPrices?: boolean;
  warnStalePrices?: boolean;
  stalePriceHours?: number;
  roundUpPartPacks?: boolean;
  keepOffline?: boolean;
}

export async function updateSettings(input: UpdateSettingsInput) {
  const userId = await requireUser();
  const settings = await prisma.userSettings.update({
    where: { userId },
    data: input,
  });
  revalidatePath("/settings");
  revalidatePath("/list");
  return settings;
}
