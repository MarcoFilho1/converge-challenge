"use server";

import { revalidatePath } from "next/cache";
import { markAllRead } from "@/lib/notices/store";

/** Ao abrir a página de avisos, todos passam a lidos e o contador do menu zera. */
export async function markNoticesRead(): Promise<void> {
  await markAllRead();
  revalidatePath("/", "layout");
}
