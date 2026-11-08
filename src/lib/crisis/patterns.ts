/**
 * Padrões de risco em pt-BR, aplicados sobre texto normalizado
 * (minúsculas, sem acento). Falso positivo é aceitável; falso negativo não.
 * Base: Cartilha Amarela MTE (2025) e orientação do CVV (ver docs/fontes-base-de-conhecimento.md).
 */
export const CRISIS_PATTERNS: RegExp[] = [
  /\bme matar\b/,
  /\btirar (a )?(minha )?(propria )?vida\b/,
  /\bacabar com tudo\b/,
  /\bnao vale (mais )?a pena (viver|continuar|existir)\b/,
  /\bnao (aguento|quero|consigo) mais viver\b/,
  /\bquero (sumir|desaparecer)\b/,
  /\bdesaparecer de vez\b/,
  /\bme (machucar|ferir|cortar|mutilar)\b/,
  /\bme (machuquei|feri|cortei|mutilei)\b/,
  /\b(seria|era|e) melhor (eu )?(morrer|estar morto|estar morta|nao existir|nao estar aqui)\b/,
  /\bnao quero mais acordar\b/,
  /\bsuicid/,
  /\b(quero|vontade de|penso em|pensando em) morrer\b/,
  /\bme jogar (da|de|do|na frente)\b/,
  /\btomar (todos|todas|um monte de|varios|varias) (os |as )?(remedios|comprimidos)\b/,
];
