"use client";

import type { RunStatus } from "@/db/schema";
import type { CaseMessageItem } from "@/lib/demo/fixtures";

/** Negrito (*texto*) e itálico (_texto_) do WhatsApp, como a pessoa viu no celular. */
function waFormat(text: string) {
  return text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, i) => {
    if (/^\*[^*\n]+\*$/.test(part)) return <strong key={i} className="font-semibold">{part.slice(1, -1)}</strong>;
    if (/^_[^_\n]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

const READING_HOW = { ia: "lido pela IA", regra: "regra local", ia_confirmada: "confirmado pela pessoa" } as const;

export function ConversationPanel({
  messages,
  status,
  contactName,
}: {
  messages: CaseMessageItem[];
  status: RunStatus;
  contactName: string;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-[12px]" aria-label={`Conversa com ${contactName}`}>
      {status === "in_progress" && (
        <p className="pb-2 text-[12px] text-[var(--sev-attention-ink)]" role="status">
          Questionário em andamento: a conversa se atualiza sozinha.
        </p>
      )}
      <div className="max-h-[560px] space-y-3 overflow-y-auto rounded-[12px] bg-[var(--bg)] p-4">
        {messages.map((msg) => {
          const isBot = msg.direction === "out";
          // Só a mensagem de segurança (a que pausa o questionário) fica vermelha; o convite também cita 188 e 192.
          const isCrisisMsg = isBot && /pausar o question[aá]rio/i.test(msg.text) && msg.text.includes("188") && msg.text.includes("192");

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}
            >
              <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-[var(--muted)]">
                <span className="font-medium text-[var(--ink)]">
                  {isBot ? "Praevenius · bot do consultório" : contactName}
                </span>
                <span className="mono-code">{msg.createdAt}</span>
              </div>

              <div
                className="max-w-[88%] whitespace-pre-line rounded-[8px] border px-3.5 py-2.5 text-[13px] leading-[19px]"
                style={{
                  backgroundColor: isCrisisMsg
                    ? "var(--sev-urgency-bg)"
                    : isBot
                      ? "var(--card)"
                      : "var(--raised)",
                  borderColor: isCrisisMsg
                    ? "var(--sev-urgency-border)"
                    : isBot
                      ? "var(--border)"
                      : "var(--control)",
                  color: isCrisisMsg ? "var(--sev-urgency-ink)" : "var(--ink)",
                }}
              >
                {waFormat(msg.text)}
              </div>

              {!isBot && (msg.viaAudio || msg.reading) && (
                <div className="mt-1 flex max-w-[88%] flex-col items-end gap-0.5 px-1 text-right text-[11px] leading-[15px] text-[var(--muted)]">
                  {msg.viaAudio && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--peach-soft)] px-2 py-0.5 font-medium text-[var(--peach-ink)]">
                      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="2" width="6" height="12" rx="3" />
                        <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
                      </svg>
                      Transcrito de áudio · pode conter erros
                    </span>
                  )}
                  {msg.reading && (
                    <span>
                      Entendido como <strong className="font-medium text-[var(--ink)]">{msg.reading.label}</strong>
                      {" · "}
                      {READING_HOW[msg.reading.how]}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
