import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { VoiceProvider } from "./types";

export const DEFAULT_VOICE_CACHE_ROOT = join(process.cwd(), "data", "voz");

export function audioCachePath(profile: string, cacheKey: string, text: string, root = DEFAULT_VOICE_CACHE_ROOT): string {
  const hash = createHash("sha1").update(`${cacheKey}\n${text}`).digest("hex").slice(0, 16);
  return join(root, profile.replace(/[^a-z0-9_-]/gi, "_"), `${hash}.wav`);
}

/** Devolve o caminho do wav em cache, gerando na primeira vez; null quando o provedor não tem voz. */
export async function getOrGenerate(provider: VoiceProvider, profile: string, cacheKey: string, text: string, root = DEFAULT_VOICE_CACHE_ROOT): Promise<string | null> {
  const path = audioCachePath(profile, cacheKey, text, root);
  if (existsSync(path)) return path;
  const out = await provider.tts(text);
  if (!out) return null;
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, out.audio);
  return path;
}
