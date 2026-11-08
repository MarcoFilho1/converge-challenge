# DESIGN.md — Consultório NR-7 (Design System & Surface Rules)

## 1. Aesthetic Direction & Paradigm
- **Primary Paradigm:** P4 Atmospheric Minimalism & High-Craft Clinical UI (70%) + P2 Kinetic Typography & Neo-Brutalist Swiss Grids (30% for clinical instruments, tabular scores, and rule traceability).
- **Theme Polarity:** High-Craft Light Mode (Warm Editorial / Clinical Paper).
- **Taste-Skill Direction:** `framed-sheet` (`seed: 935023105`, `--app --kind support`).
  - Outer warm paper chassis (`--bg: #FBF5F2`), 232px navigation rail on the left, 48px top header bar, and an 8px-inset white work sheet (`--card: #FFFFFF`, `border-radius: 16px`, `1px solid #EAE2DE`) with zero elevation shadows at rest.

## 2. Color Tokens
| Token | Hex | Purpose |
|---|---|---|
| `--bg` / `--ground` | `#FBF5F2` | Warm paper outer frame & collaborator interview room ground |
| `--card` / `--surface` | `#FFFFFF` | Primary clinical work sheet & cards |
| `--raised` / `--surface-subtle` | `#F3F1EE` | Low-chroma warm stone for subtle containers & transcript bubbles |
| `--border` / `--line` | `#EAE2DE` | 1px hairlines and card borders |
| `--ink` | `#2B1D1B` | Primary clinical text (15.4:1 contrast on white) |
| `--ink-2` | `#4A3734` | Secondary body copy |
| `--muted` | `#68524F` | Metadata, timestamps, and subtitles (>= 5.8:1 contrast) |
| `--brand` / `--accent` | `#B3261E` | Clinical alert / NR-7 accent and primary CTA in voice room |
| `--sev-urgency-bg` / `--sev-urgency-ink` | `#F8DEE3` / `#7D1612` | Urgência (Regra C / PHQ9_9 >= 1 / Crise) |
| `--sev-priority-bg` / `--sev-priority-ink` | `#FBE3D6` / `#7A2E1A` | Prioridade (Regra B: presenteísmo + sinal elevado) |
| `--sev-attention-bg` / `--sev-attention-ink` | `#FBF0D9` / `#6B4509` | Atenção (Regra A: sinal moderado ou só clínico) |
| `--sev-none-bg` / `--sev-none-ink` | `#DDEFE3` / `#144929` | Sem indício / Concluído |

## 3. Typography & Scannable Hierarchy
- **Primary Typeface:** `IBM Plex Sans` (`400`, `500`, `600`) with `font-variant-numeric: tabular-nums` on all scores, timers, phones, and instrument thresholds.
- **Fixed App Scale:**
  - Page title: `22px` (`1.375rem`), weight `600`, tracking `-0.015em`
  - Section title: `16px` (`1rem`), weight `600`
  - KPI / Counter figure: `28px` (`1.75rem`), weight `600`, `tabular-nums`
  - Body / Table cell: `14px` (`0.875rem`), line-height `1.45`
  - Metadata / Badge: `12px–13px`, weight `500`

## 4. Signature Clinical Components
1. **`RuleTraceStrip` (`src/components/ui/primitives.tsx`):** Deterministic matrix showing the exact scores (`WPAI-GH`, `BAT-12`, `PHQ-9`, `GAD-7`, `PHQ9_9`) alongside the active deterministic rule (`Regra A`, `Regra B`, `Regra C`, or `Corte de Crise`), proving to the physician that severity was computed in code rather than by an LLM.
2. **`InterviewTab` (`src/components/interview-tab.tsx`):** Two-column clinical workspace pairing the minute-stamped transcript + per-turn audio player on the left with the structured summary on the right, where every sentence carries clickable origin pills (`turno 3 · 00:38`) that scroll to and highlight the exact collaborator utterance.
3. **`VoiceInterviewRoom` (`src/components/voice-interview-room.tsx`):** Mobile-first (`440px` max column) empathetic room for the collaborator with 4 states (`consent`, `running` with `falando`/`ouvindo`/`pensando` + 900ms VAD silence detection, `crisis` with direct `tel:188` CVV and `tel:192` SAMU buttons, and `done`/`stopped`).
