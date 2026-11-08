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
      badge: actionQueueCount > 0 ? `${actionQueueCount} pendentes` : null,
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

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      {/* Top bar de 48px no chassi (sem borda inferior no desktop: regra framed-sheet) */}
      <header className="flex h-[48px] w-full items-center justify-between px-4 lg:px-5">
        <div className="flex items-center gap-3">
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

          <Link href="/fila" className="flex items-center gap-2.5">
            <span
              className="mono-code inline-flex h-6 w-6 items-center justify-center rounded-[5px] border border-[var(--sev-urgency-border)] bg-[var(--sev-urgency-bg)] text-[11px] font-medium text-[var(--brand)]"
              aria-hidden="true"
            >
              NR7
            </span>
            <span className="text-[14px] font-semibold tracking-tight text-[var(--ink)]">
              Consultório NR-7
            </span>
          </Link>

          <span className="hidden text-[13px] text-[var(--muted)] sm:inline">
            / Unidade Recife · PCMSO 2026
          </span>
        </div>

        {/* Centro: atalho rápido para a Sala de Entrevista da Helena */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/entrevista/demo-mariana-nr7"
            className="inline-flex h-[30px] items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--raised)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" aria-hidden="true" />
            Sala de Entrevista por Voz (Helena)
          </Link>
        </div>

        {/* Direita: identificação da médica coordenadora */}
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[13px] font-medium leading-none text-[var(--ink)]">
              Dra. Ana Lima
            </div>
            <div className="tabular-nums mt-0.5 text-[13px] leading-none text-[var(--muted)]">
              CRM-PE 18420 · Coordenadora
            </div>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="h-[30px] cursor-pointer rounded-[6px] border border-[var(--border)] bg-[var(--card)] px-2.5 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      {/* Menu gaveta mobile (< 1024px) */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          className="border-b border-[var(--border)] bg-[var(--bg)] px-4 py-3 lg:hidden"
        >
          <nav aria-label="Navegação móvel" className="space-y-1">
            {navItems.map((item) => {
              const active = isNavActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-[38px] items-center justify-between rounded-[8px] px-3 text-[14px]"
                  style={{
                    backgroundColor: active ? "var(--active)" : "transparent",
                    fontWeight: active ? 500 : 400,
                    color: "var(--ink)",
                  }}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-[var(--muted)]">{item.icon}</span>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className="mono-code rounded-[4px] border px-1.5 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: item.badgeUrgent ? "var(--sev-urgency-bg)" : "var(--card)",
                        color: item.badgeUrgent ? "var(--sev-urgency-ink)" : "var(--ink)",
                        borderColor: item.badgeUrgent ? "var(--sev-urgency-border)" : "var(--border)",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
            <Link
              href="/entrevista/demo-mariana-nr7"
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-[38px] items-center justify-between rounded-[8px] px-3 text-[14px] text-[var(--ink)]"
            >
              <span>Sala de Entrevista por Voz (Helena)</span>
              <span className="mono-code text-[11px] text-[var(--muted)]">/entrevista</span>
            </Link>
          </nav>
        </div>
      )}

      {/* Corpo: Sidebar L-frame (232px no desktop) + Folha branca recuada 8px */}
      <div className="flex flex-1">
        <aside
          aria-label="Navegação do consultório"
          className="hidden w-[232px] flex-none flex-col justify-between px-3 pb-4 pt-2 lg:flex"
        >
          <div className="space-y-5">
            <nav className="space-y-1">
              <div className="px-2.5 pb-1.5 text-[13px] text-[var(--muted)]">
                Vigilância individual (NR-7)
              </div>
              {navItems.map((item) => {
                const active = isNavActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex h-[34px] items-center justify-between rounded-[8px] px-2.5 text-[14px] transition-colors"
                    style={{
                      backgroundColor: active ? "var(--active)" : "transparent",
                      fontWeight: active ? 500 : 400,
                      color: "var(--ink)",
                    }}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-[var(--muted)]">{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    {item.badge && (
                      <span
                        className="tabular-nums rounded-[4px] border px-1.5 py-0.5 text-[13px] font-medium"
                        style={{
                          backgroundColor: item.badgeUrgent ? "var(--sev-urgency-bg)" : "var(--card)",
                          color: item.badgeUrgent ? "var(--sev-urgency-ink)" : "var(--ink)",
                          borderColor: item.badgeUrgent ? "var(--sev-urgency-border)" : "var(--border)",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-1 pt-2">
              <div className="px-2.5 pb-1.5 text-[13px] text-[var(--muted)]">
                Canal do colaborador (MVP2)
              </div>
              <Link
                href="/entrevista/demo-mariana-nr7"
                className="flex h-[34px] items-center justify-between rounded-[8px] px-2.5 text-[13px] text-[var(--ink)] hover:bg-[var(--active)]"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--brand)]" aria-hidden="true" />
                  <span>Entrevista por voz</span>
                </span>
                <span className="text-[13px] text-[var(--muted)]">Helena</span>
              </Link>
            </div>
          </div>

          {/* Rodapé da barra lateral: protocolo de crise e sigilo */}
          <div className="space-y-2 px-2">
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-2.5 text-[13px]">
              <div className="font-medium text-[var(--ink)]">Corte de crise ativo</div>
              <p className="mt-0.5 text-[13px] leading-[17px] text-[var(--muted)]">
                PHQ-9 #9 ≥ 1 ou expressão de risco aciona CVV 188 e SAMU 192 em código.
              </p>
            </div>
            <div className="px-0.5 text-[13px] text-[var(--muted)]">
              Sigilo médico · Dados individuais vedados à empresa.
            </div>
          </div>
        </aside>

        {/* Folha branca recuada 8px da direita e do fundo no desktop (framed-sheet) */}
        <main className="flex-1 min-w-0 bg-[var(--card)] border-t border-[var(--border)] lg:border lg:mr-[8px] lg:mb-[8px] lg:rounded-[16px] p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
