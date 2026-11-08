"use client";

import React, { useEffect, useState } from "react";

export type CallVoiceState = "falando" | "ouvindo" | "pensando" | "inativo";

type Props = {
  interviewerName: string;
  doctorRef: string;
  voiceState: CallVoiceState;
  micLevel: number;
  muted: boolean;
  captionsOn: boolean;
  caption: string;
  showListenHint: boolean;
  connectionError: boolean;
  micError: string | null;
  showTextInput: boolean;
  textDraft: string;
  onRetry: (() => void) | null;
  onToggleMute: () => void;
  onToggleCaptions: () => void;
  onSkip: () => void;
  onToggleText: () => void;
  onHangUp: () => void;
  onTextChange: (v: string) => void;
  onSubmitText: (e: React.FormEvent) => void;
};

/** Tela da chamada, no estilo de uma ligação: avatares, quem fala acende, sem texto do que a pessoa disse. */
export function CallStage(p: Props) {
  const [seconds, setSeconds] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const helenaSpeaking = p.voiceState === "falando";
  const thinking = p.voiceState === "pensando";
  const youSpeaking = p.voiceState === "ouvindo" && !p.muted && p.micLevel > 0.08;
  const timer = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#1d1b1b] text-[#f4efed] flex flex-col">
      {/* Barra superior */}
      <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5 text-[13px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[#e5534b]" aria-hidden="true" />
          <span className="truncate font-medium">Conversa com {p.interviewerName}</span>
          <span className="tabular-nums text-[#a9a19e]">{timer}</span>
        </div>
        <span className="flex items-center gap-1.5 text-[#a9a19e] shrink-0">
          <LockIcon />
          <span className="hidden sm:inline">Só a {p.doctorRef} ouve</span>
          <span className="sm:hidden">Sigilo</span>
        </span>
      </header>

      {/* Palco: avatar da Helena no centro */}
      <main className="relative flex-1 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {helenaSpeaking && (
              <>
                <span className="absolute inset-0 rounded-full bg-[#e8857e]/30 animate-ping" aria-hidden="true" />
                <span className="absolute -inset-3 rounded-full ring-4 ring-[#e8857e]/50" aria-hidden="true" />
              </>
            )}
            <div
              className="relative flex h-32 w-32 sm:h-40 sm:w-40 items-center justify-center rounded-full bg-[#b3261e] text-[56px] sm:text-[68px] font-medium text-white select-none"
              aria-label={`${p.interviewerName}${helenaSpeaking ? ", falando" : thinking ? ", pensando" : ""}`}
              role="img"
            >
              {p.interviewerName.slice(0, 1)}
            </div>
          </div>
          <div className="flex h-6 items-center gap-2 text-[15px]">
            <span className="font-medium">{p.interviewerName}</span>
            {thinking && (
              <span className="flex gap-1" aria-label="pensando">
                <Dot delay="0ms" />
                <Dot delay="150ms" />
                <Dot delay="300ms" />
              </span>
            )}
          </div>
        </div>

        {/* Você: miniatura no canto, como no Meet */}
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex h-28 w-24 sm:h-36 sm:w-32 flex-col items-center justify-center gap-2 rounded-[12px] bg-[#2c2928] border border-white/5">
          <div className="relative">
            {youSpeaking && (
              <span
                className="absolute -inset-1.5 rounded-full ring-[3px] ring-[#7fc79a] transition-opacity"
                style={{ opacity: Math.min(1, 0.4 + p.micLevel) }}
                aria-hidden="true"
              />
            )}
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#5b6b8a] text-white">
              <PersonIcon />
            </div>
          </div>
          <span className="flex items-center gap-1 text-[12px] text-[#d6cfcc]">
            {p.muted && <MicOffIcon small />}
            Você
          </span>
        </div>
      </main>

      {/* Avisos e legenda (só a fala da Helena, e só se ligar) */}
      <div className="px-4 pb-3 flex flex-col items-center gap-2">
        {p.showListenHint && p.voiceState === "ouvindo" && !p.muted && (
          <p className="rounded-full bg-white/10 px-4 py-2 text-[13px] text-[#e9e3e1]">
            Pode falar. Quando você fizer uma pausa, a {p.interviewerName} continua.
          </p>
        )}
        {p.muted && p.voiceState !== "falando" && (
          <p className="rounded-full bg-white/10 px-4 py-2 text-[13px] text-[#e9e3e1]">
            Microfone desligado. Toque no microfone para responder.
          </p>
        )}
        {p.connectionError && p.onRetry && (
          <button type="button" onClick={p.onRetry} className="rounded-full bg-[#e5534b] px-4 py-2 text-[13px] font-medium text-white">
            Sua resposta não chegou. Tocar para tentar de novo
          </button>
        )}
        {p.micError && !p.connectionError && (
          <p className="max-w-[520px] rounded-[10px] bg-white/10 px-4 py-2 text-center text-[13px] text-[#e9e3e1]">{p.micError}</p>
        )}
        {p.captionsOn && p.caption && (
          <p className="max-w-[720px] rounded-[8px] bg-black/60 px-4 py-2 text-center text-[16px] leading-snug">
            <span className="text-[#a9a19e]">{p.interviewerName}: </span>
            {p.caption}
          </p>
        )}
        {p.showTextInput && (
          <form onSubmit={p.onSubmitText} className="flex w-full max-w-[560px] gap-2">
            <label htmlFor="call-text" className="sr-only">Responder digitando</label>
            <input
              id="call-text"
              value={p.textDraft}
              onChange={(e) => p.onTextChange(e.target.value)}
              placeholder="Escreva sua resposta…"
              autoComplete="off"
              className="flex-1 rounded-full bg-[#2c2928] px-4 py-2.5 text-[15px] text-white placeholder:text-[#8f8784] outline-none focus:ring-2 focus:ring-[#e8857e]"
            />
            <button type="submit" disabled={!p.textDraft.trim() || thinking} className="rounded-full bg-[#f4efed] px-4 py-2.5 text-[14px] font-medium text-[#1d1b1b] disabled:opacity-40">
              Enviar
            </button>
          </form>
        )}
      </div>

      {/* Controles da chamada */}
      <footer className="relative flex items-center justify-center gap-3 px-4 pb-6 sm:pb-8">
        <RoundButton label={p.muted ? "Ligar microfone" : "Desligar microfone"} onClick={p.onToggleMute} danger={p.muted}>
          {p.muted ? <MicOffIcon /> : <MicIcon />}
        </RoundButton>
        <RoundButton label={p.captionsOn ? "Esconder legenda" : "Mostrar legenda da Helena"} onClick={p.onToggleCaptions} active={p.captionsOn}>
          <CaptionsIcon />
        </RoundButton>
        <div className="relative">
          <RoundButton label="Mais opções" onClick={() => setMenuOpen((v) => !v)} active={menuOpen}>
            <MoreIcon />
          </RoundButton>
          {menuOpen && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-56 overflow-hidden rounded-[12px] bg-[#2c2928] shadow-xl border border-white/10 text-[14px]">
              <button type="button" disabled={thinking} onClick={() => { setMenuOpen(false); p.onSkip(); }} className="block w-full px-4 py-3 text-left hover:bg-white/5 disabled:opacity-40">
                Pular esta pergunta
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); p.onToggleText(); }} className="block w-full px-4 py-3 text-left hover:bg-white/5">
                {p.showTextInput ? "Voltar a responder falando" : "Responder digitando"}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={p.onHangUp}
          aria-label="Encerrar conversa"
          title="Encerrar conversa"
          className="flex h-12 w-16 items-center justify-center rounded-full bg-[#e5534b] text-white hover:bg-[#d4423a] transition-colors"
        >
          <HangUpIcon />
        </button>
      </footer>
    </div>
  );
}

function RoundButton({ label, onClick, children, danger, active }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active ?? danger ?? undefined}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
        danger ? "bg-[#e5534b] text-white hover:bg-[#d4423a]" : active ? "bg-[#f4dcd9] text-[#1d1b1b]" : "bg-[#3a3635] text-white hover:bg-[#46413f]"
      }`}
    >
      {children}
    </button>
  );
}

function Dot({ delay }: { delay: string }) {
  return <span className="h-1.5 w-1.5 rounded-full bg-[#d6cfcc] animate-bounce" style={{ animationDelay: delay }} aria-hidden="true" />;
}

const svg = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function MicIcon() {
  return (<svg {...svg}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>);
}
function MicOffIcon({ small }: { small?: boolean }) {
  const s = small ? { ...svg, width: 13, height: 13 } : svg;
  return (<svg {...s}><path d="M15 9.3V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5.1 2.1M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 10.6 6M12 18v3M3 3l18 18" /></svg>);
}
function CaptionsIcon() {
  return (<svg {...svg}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 10.5a2 2 0 1 0 0 3M16 10.5a2 2 0 1 0 0 3" /></svg>);
}
function MoreIcon() {
  return (<svg {...svg}><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>);
}
function HangUpIcon() {
  return (<svg {...svg} width={24} height={24}><path d="M3 15.5c5-4.7 13-4.7 18 0l-2.3 2.3a1 1 0 0 1-1.3.1l-2.4-1.8a1 1 0 0 1-.4-.8v-1.9a12 12 0 0 0-5.2 0v1.9a1 1 0 0 1-.4.8l-2.4 1.8a1 1 0 0 1-1.3-.1z" /></svg>);
}
function PersonIcon() {
  return (<svg {...svg} width={26} height={26}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>);
}
function LockIcon() {
  return (<svg {...svg} width={14} height={14}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
}
