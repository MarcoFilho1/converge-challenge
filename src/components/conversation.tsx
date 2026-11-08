"use client";

import type { RunStatus } from "@/db/schema";
import type { CaseMessageItem } from "@/lib/demo/fixtures";

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
    <section className="flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="text-[15px] font-medium text-[var(--ink)]">
            Registro integral da conversa no WhatsApp
          </h2>
          <p className="text-[12px] text-[var(--muted)]">
            Canal confidencial · {messages.length} mensagens trocadas com {contactName}
          </p>
        </div>
        {status === "in_progress" && (
          <span className="mono-code rounded-[4px] border border-[var(--sev-attention-border)] bg-[var(--sev-attention-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--sev-attention-ink)]">
            Ao vivo · 3s
          </span>
        )}
      </div>

      <div className="space-y-3 bg-[var(--bg)] p-4 max-h-[680px] overflow-y-auto">
        {messages.map((msg) => {
          const isBot = msg.direction === "out";
          const isCrisisMsg = msg.text.includes("188") && msg.text.includes("192");

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
                className="max-w-[88%] rounded-[8px] border px-3.5 py-2.5 text-[13px] leading-[19px]"
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
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
