import { db } from "@/db/client";
import { waSessions } from "@/db/schema";

export async function saveConnectionState(state: string, phone?: string | null) {
  const instanceName = process.env.EVOLUTION_INSTANCE ?? "consultorio";
  await db
    .insert(waSessions)
    .values({ instanceName, state, phone: phone ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: waSessions.instanceName,
      set: { state, updatedAt: new Date(), ...(phone !== undefined ? { phone } : {}) },
    });
}
