"use client";

import { useActionState, useState } from "react";
import { resetConfig, saveConfig, type SaveState } from "@/app/(app)/configuracoes/actions";
import { formatPhoneBr } from "@/components/ui/primitives";
import type { Settings } from "@/lib/settings";

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" });

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--rule)] py-6">
      <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
      {hint && <p className="mt-1 max-w-[62ch] text-[14px] text-[var(--muted)]">{hint}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

function DemoTag() {
  return <span className="ml-2 rounded-full bg-[var(--peach-soft)] px-2 py-px align-middle text-[12px] font-medium text-[var(--peach-ink)]">demonstração</span>;
}

function Toggle({ name, label, help, defaultChecked, demo }: { name: string; label: string; help: string; defaultChecked: boolean; demo?: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  const id = `cfg-${name}`;
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[15px] font-medium text-[var(--ink)]">
          {label}
          {demo && <DemoTag />}
        </label>
        <p id={`${id}-help`} className="mt-0.5 max-w-[60ch] text-[14px] text-[var(--muted)]">{help}</p>
      </div>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          name={name}
          type="checkbox"
          role="switch"
          aria-describedby={`${id}-help`}
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="peer h-[26px] w-[46px] cursor-pointer appearance-none rounded-full bg-[#C9D3D7] ring-1 ring-inset ring-[#B5C1C6] transition-colors checked:bg-[var(--brand)] checked:ring-[var(--brand)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[3px] top-[3px] h-[20px] w-[20px] rounded-full bg-[#FFFFFF] shadow-[0_1px_2px_rgba(36,54,59,0.25)] transition-transform peer-checked:translate-x-[20px]"
        />
      </span>
    </div>
  );
}

function NumberField({ name, label, help, defaultValue, min, max, suffix }: { name: string; label: string; help: string; defaultValue: number; min: number; max: number; suffix: string }) {
  const id = `cfg-${name}`;
  return (
    <div>
      <label htmlFor={id} className="text-[15px] font-medium text-[var(--ink)]">{label}</label>
      <p id={`${id}-help`} className="mt-0.5 max-w-[60ch] text-[14px] text-[var(--muted)]">{help}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <input
          id={id}
          name={name}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          required
          defaultValue={defaultValue}
          aria-describedby={`${id}-help`}
          className="h-[44px] w-[92px] rounded-[10px] border border-[var(--rule)] bg-[var(--surface)] px-3 text-[20px] font-semibold tabular-nums text-[var(--ink)] focus:border-[var(--brand)]"
        />
        <span className="text-[15px] text-[var(--muted)]">{suffix}</span>
      </div>
    </div>
  );
}

function Feedback({ state }: { state: SaveState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-[14px] ${state.ok ? "text-[var(--sev-none-ink)]" : "text-[var(--alert-ink)]"}`}>
      {state.message}
    </p>
  );
}

/** Configurações da médica: tudo editável, vale na hora e cada mudança fica registrada. */
export function SettingsForm({ settings, defaults, changes }: { settings: Settings; defaults: Settings; changes: { at: string; detail: string }[] }) {
  const [saved, save, saving] = useActionState(saveConfig, null);
  const [reset, doReset, resetting] = useActionState(resetConfig, null);
  // Depois de "voltar ao padrão", o formulário remonta com os valores novos vindos do servidor.
  const formKey = JSON.stringify(settings);

  return (
    <div className="max-w-[820px]">
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">Configurações</h1>
      <p className="mt-1 text-[14px] text-[var(--muted)]">
        Quem é convidado para a entrevista, quem recebe os avisos e quando o questionário sai. Vale na hora, sem reiniciar nada.
      </p>

      <div className="mt-5 rounded-[14px] bg-[var(--peach-soft)] px-5 py-4 text-[14px] text-[var(--ink-2)]">
        <b className="font-semibold text-[var(--peach-ink)]">Demonstração.</b> Pode mexer em tudo. As opções marcadas com{" "}
        <span className="font-medium text-[var(--peach-ink)]">demonstração</span> estão ligadas para quem avalia passar pelo fluxo completo com o
        próprio celular. Em uso real, a médica decide cada uma.
      </div>

      <form key={formKey} action={save} className="mt-6">
        <Section
          title="Convite para a entrevista com a Helena"
          hint="Depois do questionário, o sistema calcula o índice de bem-estar, de 0 a 100. Quanto menor, pior."
        >
          <NumberField
            name="inviteThreshold"
            label="Convidar quem ficar abaixo de"
            help={`Quem tem sinal de atenção ou prioridade é convidado sempre, qualquer que seja o índice. Casos de urgência vão direto para a médica, sem entrevista. Padrão: ${defaults.inviteThreshold} de 100.`}
            defaultValue={settings.inviteThreshold}
            min={0}
            max={100}
            suffix="de 100"
          />
          <Toggle
            name="autoInvite"
            label="Convite automático"
            help="Ao terminar o questionário, quem se encaixa na regra acima recebe o link da entrevista no WhatsApp. Desligado, ninguém é convidado."
            defaultChecked={settings.autoInvite}
          />
          <Toggle
            name="inviteAll"
            label="Entrevista para todos"
            help="Convida também quem está bem, com um aviso de que é só para a demonstração. Isso fica anotado no caso."
            defaultChecked={settings.inviteAll}
            demo
          />
        </Section>

        <Section title="Avisos" hint="Quando uma entrevista termina, o aviso aparece na página Avisos com o link do caso, sem nenhum dado de saúde.">
          <div>
            <label htmlFor="cfg-doctorWhatsapp" className="text-[15px] font-medium text-[var(--ink)]">WhatsApp da médica</label>
            <p id="cfg-doctorWhatsapp-help" className="mt-0.5 max-w-[60ch] text-[14px] text-[var(--muted)]">
              Recebe o mesmo aviso no celular. Com DDD. Deixe vazio para avisar só aqui no painel.
            </p>
            <input
              id="cfg-doctorWhatsapp"
              name="doctorWhatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="(81) 99999-0000"
              defaultValue={settings.doctorWhatsapp ? formatPhoneBr(settings.doctorWhatsapp) : ""}
              aria-describedby="cfg-doctorWhatsapp-help"
              className="mt-2 h-[44px] w-full max-w-[260px] rounded-[10px] border border-[var(--rule)] bg-[var(--surface)] px-3 text-[15px] tabular-nums text-[var(--ink)] focus:border-[var(--brand)]"
            />
          </div>
          <Toggle
            name="notifyParticipant"
            label="Mandar o aviso também para quem fez a entrevista"
            help="Quem fez a entrevista recebe no próprio WhatsApp o aviso que iria para a médica, marcado como demonstração."
            defaultChecked={settings.notifyParticipant}
            demo
          />
        </Section>

        <Section title="Entrevista e WhatsApp">
          <NumberField
            name="idleMinutes"
            label="Encerrar a entrevista parada depois de"
            help={`Se a pessoa fecha a página ou a conexão cai, a entrevista termina sozinha e o resumo sai com o que foi dito. Padrão: ${defaults.idleMinutes} minutos.`}
            defaultValue={settings.idleMinutes}
            min={1}
            max={120}
            suffix="minutos sem fala"
          />
          <Toggle
            name="openEntry"
            label="Aceitar qualquer número no WhatsApp"
            help="Quem não está na lista de colaboradores pode mandar mensagem e fazer o questionário, com o nome do perfil do WhatsApp. Em uso real, só colaboradores cadastrados."
            defaultChecked={settings.openEntry}
            demo
          />
        </Section>

        <Section
          title="Disparo automático do questionário"
          hint="Pronto e testado, mas desligado na demonstração: ainda não há colaboradores cadastrados para receber."
        >
          <Toggle
            name="autoDispatch"
            label="Mandar o questionário sozinho"
            help="Em dias úteis, das 9h às 18h, no máximo 20 pessoas por hora, para o número do consultório não ser bloqueado. Vai para quem nunca respondeu ou respondeu há mais tempo que o intervalo abaixo."
            defaultChecked={settings.autoDispatch}
          />
          <NumberField
            name="autoDispatchDays"
            label="Intervalo entre questionários"
            help={`Quem respondeu há menos tempo que isso não recebe de novo. Padrão: ${defaults.autoDispatchDays} dias.`}
            defaultValue={settings.autoDispatchDays}
            min={1}
            max={365}
            suffix="dias"
          />
        </Section>

        <div className="flex flex-wrap items-center gap-4 border-t border-[var(--rule)] pt-6">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-[44px] items-center rounded-full bg-[var(--brand)] px-6 text-[15px] font-medium text-[#FFFFFF] hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <Feedback state={saved} />
        </div>
      </form>

      <form action={doReset} className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={resetting}
          className="inline-flex h-[40px] items-center rounded-full bg-[var(--brand-soft)] px-5 text-[14px] font-medium text-[var(--brand-deep)] hover:bg-[var(--brand)] hover:text-[#FFFFFF] disabled:opacity-60"
        >
          {resetting ? "Voltando..." : "Voltar tudo ao padrão"}
        </button>
        <Feedback state={reset} />
      </form>

      <section className="mt-10 border-t border-[var(--rule)] pt-6">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Últimas mudanças</h2>
        {changes.length === 0 ? (
          <p className="mt-2 text-[14px] text-[var(--muted)]">Nenhuma mudança ainda. Tudo está no padrão.</p>
        ) : (
          <ul className="mt-3">
            {changes.map((c, i) => (
              <li key={`${c.at}-${i}`} className="flex flex-wrap gap-x-4 gap-y-1 border-b border-[var(--rule)] py-3 text-[14px]">
                <span className="tabular-nums text-[var(--muted)]">{when(c.at)}</span>
                <span className="min-w-0 flex-1 text-[var(--ink)]">{c.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
