"use client";

import Link from "next/link";
import { ChannelEntry } from "@/components/channel-entry";
import type { PublicChannels } from "@/lib/channels/public";

/**
 * Roteiro da demonstração: um caminho só, em ordem, por todos os papéis.
 * Quem avalia responde como colaborador, conversa com a Helena, entra como a médica
 * e termina na Medição, vendo o que o sistema fez e quanto custou.
 */

type Role = "colaborador" | "helena" | "medica" | "sistema";

const ROLE: Record<Role, { label: string; bg: string; ink: string }> = {
  colaborador: { label: "Colaborador", bg: "var(--peach-soft)", ink: "var(--peach-ink)" },
  helena: { label: "Helena, a assistente", bg: "var(--peach-soft)", ink: "var(--peach-ink)" },
  medica: { label: "Médica do trabalho", bg: "var(--brand-soft)", ink: "var(--brand-deep)" },
  sistema: { label: "Por dentro", bg: "var(--surface-subtle)", ink: "var(--ink-2)" },
};

const solid =
  "inline-flex h-[48px] items-center justify-center gap-2 rounded-[10px] bg-[var(--brand)] px-5 text-[15px] font-semibold text-[#FFFFFF] no-underline transition-colors hover:bg-[var(--brand-deep)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]";
const quiet =
  "inline-flex h-[44px] items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-4 text-[14px] font-medium text-[var(--ink)] no-underline hover:bg-[var(--brand-tint)]";

function Step({ n, role, title, last, children }: { n: number; role: Role; title: string; last?: boolean; children: React.ReactNode }) {
  const r = ROLE[role];
  return (
    <li className="relative grid grid-cols-[44px_1fr] gap-x-4 pb-10 last:pb-0">
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[17px] font-semibold tabular-nums text-[#FFFFFF]"
        >
          {n}
        </span>
        {!last && <span aria-hidden="true" className="mt-2 w-px flex-1 bg-[var(--frame-line)]" />}
      </div>
      <div className="min-w-0 pt-1.5">
        <p className="mb-1.5">
          <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ background: r.bg, color: r.ink }}>
            {r.label}
          </span>
        </p>
        <h2 className="text-[22px] font-semibold leading-tight tracking-tight">{title}</h2>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[var(--ink-2)]">{children}</div>
      </div>
    </li>
  );
}

function EntryQr({ svg }: { svg: string }) {
  return (
    <div
      role="img"
      aria-label="QR code para abrir o teste no celular"
      className="hidden w-[168px] shrink-0 rounded-[12px] border border-[var(--frame-line)] bg-[#FFFFFF] p-2 sm:block [&_svg]:h-auto [&_svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function DemoGuide({ channels, qr }: { channels: PublicChannels; qr: string }) {
  return (
    <div className="min-h-svh bg-[var(--frame)] px-4 py-8 text-[var(--ink)] sm:py-14">
      <main className="mx-auto w-full max-w-[720px] rounded-[18px] border border-[var(--frame-line)] bg-[var(--card)] px-6 py-8 shadow-[var(--sheet-shadow)] sm:px-10 sm:py-12">
        <Link href="/" className="inline-flex items-center gap-2 no-underline" aria-label="Praevenius, início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/praevenius-mark.png" alt="" width={28} height={28} />
          <span className="text-[19px] font-semibold tracking-tight text-[var(--ink)]">praevenius</span>
        </Link>

        <p className="mt-8 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Roteiro da demonstração</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight sm:text-[34px]">
          Cinco passos, todos os papéis.
          <br />
          Uns 10 minutos.
        </h1>
        <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-[var(--ink-2)]">
          Você vai responder o questionário como colaborador, conversar com a Helena e depois abrir o painel da médica para ver o próprio caso.
          No fim, a Medição mostra o que o sistema fez e quanto custou.
        </p>

        <div className="mt-6 rounded-[14px] bg-[var(--peach-soft)] px-5 py-4 text-[14px] leading-relaxed text-[var(--ink-2)]">
          <b className="font-semibold text-[var(--peach-ink)]">Por que este roteiro existe.</b> Em uso real, cada papel vê só a sua parte: o colaborador
          nunca entra no painel, e a médica não acompanha a conversa. Aqui você passa por todos em sequência, de forma simplificada, para avaliar o
          fluxo inteiro com o seu próprio celular. As escolhas feitas só para a demonstração estão marcadas no painel.
        </div>

        <ol className="mt-10 list-none p-0">
          <Step n={1} role="colaborador" title="Responda o questionário no WhatsApp">
            <p>
              São 8 perguntas curtas sobre trabalho e bem-estar, do jeito que você fala. Pode responder por texto ou por áudio. Para parar a qualquer
              momento, escreva PARAR.
            </p>
            <div className="flex items-start gap-6">
              <EntryQr svg={qr} />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-[14px] text-[var(--muted)]">No computador, leia o QR code com a câmera do celular. No celular, toque no botão.</p>
                <ChannelEntry initial={channels} />
              </div>
            </div>
          </Step>

          <Step n={2} role="helena" title="Converse com a Helena">
            <p>
              No fim do questionário, chega pelo WhatsApp o link de uma conversa por voz com a Helena, a assistente da médica. Ela aprofunda o que você
              contou, no seu ritmo, e nunca dá diagnóstico nem indica tratamento. Dura uns 5 minutos.
            </p>
            <p className="text-[14px] text-[var(--muted)]">
              Na demonstração, todo mundo é convidado. Em uso real, só quem tem indício na regra clínica ou índice de bem-estar abaixo do limite
              que a médica define (padrão 70 de 100).
            </p>
          </Step>

          <Step n={3} role="medica" title="Entre como a médica e abra o seu caso">
            <p>
              O painel é o que a médica do trabalho vê. Na <b className="font-semibold text-[var(--ink)]">Fila</b>, o seu caso aparece no topo com a
              gravidade, o índice e o resumo. Em <b className="font-semibold text-[var(--ink)]">Avisos</b>, está o aviso de que a sua entrevista terminou.
              Abra o caso para ver as respostas, os indícios, o resumo da conversa e cada decisão explicada.
            </p>
            <p className="text-[14px] text-[var(--muted)]">
              Na demonstração, a entrada é direta. Em uso real, a médica entra com o próprio acesso e o aviso chega no WhatsApp dela.
            </p>
            <p>
              <a href="/api/auth/demo-session?next=/fila" className={solid}>
                Entrar como a médica <span aria-hidden="true">→</span>
              </a>
            </p>
          </Step>

          <Step n={4} role="medica" title="Mude uma regra em Configurações">
            <p>
              Em <b className="font-semibold text-[var(--ink)]">Configurações</b>, a médica decide quem é convidado para a entrevista, quem recebe os
              avisos e quando o questionário sai. Troque o limite do índice e veja a mudança registrada na hora.
            </p>
            <p>
              <a href="/api/auth/demo-session?next=/configuracoes" className={quiet}>
                Abrir Configurações
              </a>
            </p>
          </Step>

          <Step n={5} last role="sistema" title="Veja o que o sistema fez e quanto custou">
            <p>
              A <b className="font-semibold text-[var(--ink)]">Medição</b> mostra cada chamada de IA do seu caso: modelo, tempo, tokens e custo, e o que
              foi decidido em código, sem IA. Um atendimento completo custa cerca de US$ 0,03.
            </p>
            <p>
              <a href="/api/auth/demo-session?next=/medicao" className={solid}>
                Abrir a Medição <span aria-hidden="true">→</span>
              </a>
            </p>
          </Step>
        </ol>

        <p className="mt-12 border-t border-[var(--rule)] pt-6 text-[14px] leading-relaxed text-[var(--muted)]">
          Seus dados ficam só neste servidor da demonstração e são apagados ao fim do evento. Quer entender a plataforma antes?{" "}
          <Link href="/" className="text-[var(--brand-deep)] underline underline-offset-4">
            Volte para a página inicial
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
