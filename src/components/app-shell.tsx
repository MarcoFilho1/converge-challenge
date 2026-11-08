"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/login/actions";

interface AppShellProps {
  children: React.ReactNode;
  urgentCount: number;
  priorityCount: number;
}

export function AppShell({ children, urgentCount, priorityCount }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const actionQueueCount = urgentCount + priorityCount;

  const navItems = [
    {
      href: "/fila",
      label: "Fila de triagem",
      badge: actionQueueCount > 0 ? String(actionQueueCount) : null,
      badgeUrgent: urgentCount > 0,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.5 4H13.5M2.5 8H10.5M2.5 12H7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      href: "/contatos",
      label: "Contatos e disparo",
      badge: null,
      badgeUrgent: false,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6" cy="5.2" r="2.3" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M2.2 12.8C2.2 10.7 3.9 9.2 6 9.2C8.1 9.2 9.8 10.7 9.8 12.8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M11.2 6.5H14.2M12.7 5V8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      href: "/conexao",
      label: "Conexão WhatsApp",
      badge: null,
      badgeUrgent: false,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="2.5" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.5" />
          <rect x="2.5" y="9" width="4.5" height="4.5" rx="0.8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9.5 9.5H13.5V13.5H9.5V9.5Z" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
  ];

  const isNavActive = (href: string) => {
    if (href === "/fila") {
      return pathname === "/fila" || pathname.startsWith("/caso/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const currentLabel = pathname.startsWith("/caso/")
    ? "Prontuário do caso"
    : navItems.find((item) => isNavActive(item.href))?.label ?? "Visão geral";

  const navLink = (item: (typeof navItems)[number], onClick?: () => void) => {
    const active = isNavActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className="group flex h-[36px] items-center justify-between rounded-[8px] px-2.5 text-[14px] transition-colors hover:bg-[var(--raised)]"
        style={{
          backgroundColor: active ? "var(--active)" : undefined,
          fontWeight: active ? 600 : 400,
          color: active ? "var(--brand)" : "var(--ink)",
        }}
      >
        <span className="flex items-center gap-2.5">
          <span style={{ color: active ? "var(--brand)" : "var(--muted)" }}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
        {item.badge && (
          <span
            className="tabular-nums whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium"
            style={{
              backgroundColor: item.badgeUrgent ? "var(--sev-urgency-bg)" : "var(--peach-soft)",
              color: item.badgeUrgent ? "var(--sev-urgency-ink)" : "var(--peach-ink)",
              borderColor: item.badgeUrgent ? "var(--sev-urgency-border)" : "var(--peach)",
            }}
          >
            {item.badge}
            <span className="sr-only"> casos aguardando avaliação</span>
          </span>
        )}
      </Link>
    );
  };

  const brandMark = (
    <Link href="/fila" className="flex items-center gap-2.5" aria-label="Praevenius, início">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/praevenius-mark.png" alt="" width={28} height={28} className="h-7 w-7" />
      <span className="flex flex-col leading-none">
        <span className="text-[16px] font-semibold tracking-tight text-[var(--ink)]">praevenius</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
          Consultório NR-7
        </span>
      </span>
    </Link>
  );

  const helenaLink = (onClick?: () => void) => (
    <Link
      href="/entrevista/demo-mariana-nr7"
      onClick={onClick}
      className="flex h-[36px] items-center justify-between rounded-[8px] px-2.5 text-[14px] text-[var(--ink)] hover:bg-[var(--raised)]"
    >
      <span className="flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full bg-[var(--peach)] ring-2 ring-[var(--peach-soft)]" aria-hidden="true" />
        <span>Entrevista por voz</span>
      </span>
      <span className="text-[12px] text-[var(--muted)]">Helena</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex">
      {/* Barra lateral (desktop): marca, unidade, navegação, confiança e usuário — estrutura do protótipo Praevenius */}
      <aside
        aria-label="Navegação do consultório"
        className="sticky top-0 hidden h-screen w-[232px] flex-none flex-col justify-between border-r border-[var(--border)] bg-[var(--card)] px-3 py-4 lg:flex"
      >
        <div className="space-y-5">
          <div className="px-1.5">{brandMark}</div>

          <div className="flex items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2">
            <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-[var(--brand-soft)] text-[12px] font-semibold text-[var(--brand)]">
              VB
            </span>
            <span className="min-w-0 leading-tight">
              <strong className="block truncate text-[13px] font-semibold text-[var(--ink)]">Unidade Recife</strong>
              <small className="block truncate text-[12px] text-[var(--muted)]">PCMSO 2026 · ambiente de demonstração</small>
            </span>
          </div>

          <nav className="space-y-1" aria-label="Vigilância individual">
            <p className="eyebrow px-2.5 pb-1">Vigilância NR-7</p>
            {navItems.map((item) => navLink(item))}
          </nav>

          <div className="space-y-1">
            <p className="eyebrow px-2.5 pb-1">Canal do colaborador</p>
            {helenaLink()}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[10px] border border-[var(--peach)] bg-[var(--peach-soft)] p-3">
            <strong className="block text-[13px] font-semibold text-[var(--ink)]">Sigilo em primeiro lugar</strong>
            <p className="mt-1 text-[12px] leading-[17px] text-[var(--ink-2)]">
              Só a médica responsável vê dados individuais. A empresa não recebe respostas nem conversas.
            </p>
          </div>
          <div className="rounded-[10px] border border-[var(--sev-urgency-border)] bg-[var(--card)] p-3">
            <strong className="block text-[13px] font-semibold text-[var(--sev-urgency-ink)]">Corte de crise ativo</strong>
            <p className="mt-1 text-[12px] leading-[17px] text-[var(--muted)]">
              Item 9 do PHQ-9 ≥ 1 ou frase de risco aciona CVV 188 e SAMU 192, em código.
            </p>
          </div>
          <div className="flex items-center gap-2.5 border-t border-[var(--border)] px-1 pt-3">
            <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-[12px] font-semibold text-[#FFFFFF]">
              AL
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <strong className="block truncate text-[13px] font-semibold text-[var(--ink)]">Dra. Ana Lima</strong>
              <small className="tabular-nums block truncate text-[12px] text-[var(--muted)]">CRM-PE 18420 · Coordenadora</small>
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="h-[28px] cursor-pointer rounded-[6px] px-2 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)]"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabeçalho: trilha de navegação + atalho para a sala da Helena */}
        <header className="flex h-[56px] items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--card)] px-2.5 text-[13px] font-medium text-[var(--ink)] lg:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2.5 4.5H13.5M2.5 8H13.5M2.5 11.5H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Menu
            </button>
            <span className="lg:hidden">{brandMark}</span>
            <span className="hidden truncate text-[14px] text-[var(--muted)] lg:inline">
              Consultório <b className="font-semibold text-[var(--ink)]">/ {currentLabel}</b>
            </span>
          </div>
          <Link
            href="/entrevista/demo-mariana-nr7"
            className="hidden h-[32px] items-center gap-2 rounded-full border border-[var(--peach)] bg-[var(--peach-soft)] px-3.5 text-[13px] font-medium text-[var(--peach-ink)] hover:brightness-[0.98] md:inline-flex"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" aria-hidden="true" />
            Sala de entrevista por voz (Helena)
          </Link>
        </header>

        {/* Menu gaveta mobile (< 1024px) */}
        {mobileMenuOpen && (
          <div id="mobile-nav-drawer" className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 lg:hidden">
            <nav aria-label="Navegação móvel" className="space-y-1">
              {navItems.map((item) => navLink(item, () => setMobileMenuOpen(false)))}
              {helenaLink(() => setMobileMenuOpen(false))}
            </nav>
            <form action={logout} className="mt-2 border-t border-[var(--border)] pt-2">
              <button type="submit" className="h-[34px] w-full rounded-[8px] text-left text-[14px] text-[var(--muted)] px-2.5 hover:bg-[var(--raised)]">
                Sair · Dra. Ana Lima
              </button>
            </form>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="enter mx-auto w-full max-w-[1200px] rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
