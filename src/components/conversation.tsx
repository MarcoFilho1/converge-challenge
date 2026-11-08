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
    <section className="flex flex-col overflow-hidden rounded-[12px]" aria-label={`Conversa com ${contactName}`}>
      {status === "in_progress" && (
        <p className="pb-2 text-[12px] text-[var(--sev-attention-ink)]" role="status">
          Questionário em andamento: a conversa se atualiza sozinha.
        </p>
      )}
      <div className="max-h-[560px] space-y-3 overflow-y-auto rounded-[12px] bg-[var(--bg)] p-4">
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
