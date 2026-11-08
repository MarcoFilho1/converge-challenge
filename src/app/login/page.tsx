import Link from "next/link";
import { Suspense } from "react";
import { login } from "./actions";

async function LoginErrorAlert({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const params = await searchParams;
  if (!params.erro) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-[6px] border border-[var(--sev-urgency-border)] bg-[var(--sev-urgency-bg)] px-3 py-2 text-[13px] text-[var(--sev-urgency-ink)]"
    >
      Preencha o identificador profissional e a senha para abrir a sessão.
    </div>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col justify-between p-4 sm:p-8">
      {/* Cabeçalho institucional discreto */}
      <header className="mx-auto flex w-full max-w-[1080px] items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/praevenius-mark.png" alt="" width={32} height={32} className="h-8 w-8" />
          <div className="leading-none">
            <span className="block text-[18px] font-semibold tracking-tight text-[var(--ink)]">praevenius</span>
            <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
              Consultório NR-7 · PCMSO
            </span>
          </div>
        </div>
        <Link
          href="/entrevista/demo-mariana-nr7"
          className="rounded-full border border-[var(--peach)] bg-[var(--peach-soft)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--peach-ink)] hover:brightness-[0.98]"
        >
          Ver sala de entrevista (Helena) →
        </Link>
      </header>

      {/* Corpo em duas colunas na folha branca */}
      <main className="enter mx-auto my-8 grid w-full max-w-[1080px] grid-cols-1 overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card)] lg:grid-cols-12">
        {/* Coluna esquerda: contexto normativo e regra clínica */}
        <section className="flex flex-col justify-between border-b border-[var(--border)] bg-[var(--raised)] p-6 sm:p-8 lg:col-span-7 lg:border-b-0 lg:border-r">
          <div>
            <p className="eyebrow mb-1.5">Cuidar começa por escutar</p>
            <h1 className="text-[22px] font-semibold leading-[28px] tracking-tight text-[var(--ink)]">
              Triagem psicossocial NR-7
            </h1>
            <p className="mt-2 max-w-[58ch] text-[14px] leading-[21px] text-[var(--muted)]">
              Presenteísmo e escuta clínica individual protegidos por sigilo médico (PCMSO e LGPD art. 11).
              Respostas coletadas pelo WhatsApp são pontuadas em código e vinculadas aos trechos
              normativos e manuais validados no Brasil.
            </p>

            <div className="mt-6 space-y-3 border-t border-[var(--border)] pt-5">
              <h2 className="text-[14px] font-semibold text-[var(--ink)]">
                Garantias arquiteturais ativas nesta instância
              </h2>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-3.5">
                  <dt className="text-[13px] font-semibold text-[var(--ink)]">
                    1. Regra A · B · C em código
                  </dt>
                  <dd className="mt-1 text-[13px] leading-[19px] text-[var(--muted)]">
                    WPAI-GH, BAT-12, PHQ-9, GAD-7 e COPSOQ II-Br calculados sem interferência de LLM.
                  </dd>
                </div>
                <div className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-3.5">
                  <dt className="text-[13px] font-semibold text-[var(--alert)]">
                    2. Corte imediato de crise
                  </dt>
                  <dd className="mt-1 text-[13px] leading-[19px] text-[var(--muted)]">
                    Item 9 do PHQ-9 ≥ 1 ou frase de risco interrompe a coleta, envia CVV 188 / SAMU 192 e eleva à Urgência.
                  </dd>
                </div>
                <div className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-3.5">
                  <dt className="text-[13px] font-semibold text-[var(--ink)]">
                    3. Proibição de rótulo diagnóstico
                  </dt>
                  <dd className="mt-1 text-[13px] leading-[19px] text-[var(--muted)]">
                    Filtro léxico bloqueia termos clínicos conclusivos; todo achado é descrito como indício ou relato.
                  </dd>
                </div>
                <div className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-3.5">
                  <dt className="text-[13px] font-semibold text-[var(--ink)]">
                    4. Origem documental obrigatória
                  </dt>
                  <dd className="mt-1 text-[13px] leading-[19px] text-[var(--muted)]">
                    Cada indício cita o documento e a página (NR-1, NR-7, Guia MTE 2025, manuais clínicos).
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4 text-[13px] text-[var(--muted)]">
            <span>Acesso exclusivo do médico coordenador · Dados individuais vedados ao RH</span>
            <span className="tabular-nums">CFM 2.454/2026 · NR-1 Cap. 1.5</span>
          </div>
        </section>

        {/* Coluna direita: formulário de entrada */}
        <section className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-5">
          <div className="mb-6">
            <h2 className="text-[18px] font-semibold text-[var(--ink)]">
              Entrar no prontuário ocupacional
            </h2>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              Ambiente de demonstração Converge Challenge: qualquer credencial preenchida inicia a sessão médica.
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginErrorAlert searchParams={searchParams} />
          </Suspense>

          <form action={login} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-[14px] font-medium text-[var(--ink)] mb-2"
              >
                E-mail profissional ou CRM
              </label>
              <input
                id="email"
                name="email"
                type="text"
                required
                defaultValue="ana.lima@pcmso.med.br"
                autoComplete="username"
                className="h-[40px] w-full rounded-[8px] border border-[var(--control)] bg-[#FFFFFF] px-3 text-[14px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[14px] font-medium text-[var(--ink)] mb-2"
              >
                Senha da sessão
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                defaultValue="nr7-pcmso-2026"
                autoComplete="current-password"
                className="h-[40px] w-full rounded-[8px] border border-[var(--control)] bg-[#FFFFFF] px-3 text-[14px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="h-[38px] w-full cursor-pointer rounded-[6px] bg-[var(--primary)] px-4 text-[14px] font-medium text-[#FFFFFF] transition-colors hover:bg-[var(--primary-hover)]"
              >
                Acessar bancada médica
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-3 text-[12px] text-[var(--muted)]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--ink)]">Responsável técnica configurada</span>
              <span className="mono-code text-[11px]">CRM-PE 18420</span>
            </div>
            <p className="mt-0.5">
              Dra. Ana Lima · Médica do Trabalho Coordenadora (PCMSO)
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1080px] items-center justify-between text-[12px] text-[var(--muted)]">
        <span>Praevenius · Consultório NR-7 · Recife, 2026</span>
        <span className="mono-code">Canais de emergência: CVV 188 · SAMU 192</span>
      </footer>
    </div>
  );
}
