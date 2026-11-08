"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/login/actions";

interface AppShellProps {
  children: React.ReactNode;
  urgentCount: number;
  priorityCount: number;
  /** Avisos ainda não lidos (ex.: entrevista terminou). */
  noticeCount?: number;
}

/**
 * Moldura "Prontuário em ordem": sem cor no chrome, barra lateral com marca, três itens e a médica.
 * A única cor da moldura é a contagem de casos urgentes.
 */
export function AppShell({ children, urgentCount, priorityCount, noticeCount = 0 }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const waiting = urgentCount + priorityCount;

  const nav = [
    { href: "/fila", label: "Fila", count: waiting > 0 ? String(waiting) : null, hot: urgentCount > 0 },
    { href: "/contatos", label: "Colaboradores", count: null, hot: false },
    { href: "/avisos", label: "Avisos", count: noticeCount > 0 ? String(noticeCount) : null, hot: false },
    { href: "/conexao", label: "WhatsApp", count: null, hot: false },
    { href: "/medicao", label: "Medição", count: null, hot: false },
  ];
  const isActive = (href: string) =>
    href === "/fila" ? pathname === "/fila" || pathname.startsWith("/caso/") : pathname.startsWith(href);

  const links = (onClick?: () => void) =>
    nav.map((item) => {
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          aria-current={active ? "page" : undefined}
          className={`flex h-[36px] items-center justify-between rounded-[8px] px-3 text-[14px] transition-colors ${
            active
              ? "bg-[var(--card)] font-semibold text-[var(--brand-deep)] shadow-[0_1px_2px_rgba(10,60,100,0.08)]"
              : "text-[var(--ink-2)] hover:bg-[var(--brand-tint)]"
          }`}
        >
          <span>{item.label}</span>
          {item.count && (
            <span
              className={`tabular-nums rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                item.hot ? "bg-[var(--sev-urgency-bg)] text-[var(--alert-ink)]" : "bg-[var(--brand-soft)] text-[var(--brand-deep)]"
              }`}
            >
              {item.count}
              <span className="sr-only">{item.href === "/avisos" ? " avisos não lidos" : " casos aguardando avaliação"}</span>
            </span>
          )}
        </Link>
      );
    });

  const brand = (
    <Link href="/fila" className="flex items-center gap-2.5" aria-label="Praevenius, início">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/praevenius-mark.png" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--ink)]">praevenius</span>
        <span className="mt-1 text-[11px] text-[var(--muted)]">Consultório NR-7</span>
      </span>
    </Link>
  );

  const me = (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-[12px] font-semibold text-[#FFFFFF]">
        AL
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-medium text-[var(--ink)]">Dra. Ana Lima</span>
        <span className="block truncate text-[12px] text-[var(--muted)]">Médica do trabalho</span>
      </span>
      <form action={logout}>
        <button type="submit" className="h-[28px] cursor-pointer rounded-[6px] px-2 text-[12px] text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)]">
          Sair
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--frame)] text-[var(--ink)]">
      <aside
        aria-label="Navegação"
        className="sticky top-0 hidden h-screen w-[232px] flex-none flex-col justify-between px-3 py-5 lg:flex"
      >
        <div>
          <div className="px-2 pb-6">{brand}</div>
          <nav className="space-y-0.5" aria-label="Principal">{links()}</nav>
        </div>
        <div className="px-1">{me}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] items-center justify-between px-4 lg:hidden">
          {brand}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-movel"
            className="h-8 rounded-[8px] border border-[var(--border)] px-3 text-[13px] font-medium"
          >
            Menu
          </button>
        </header>
        {open && (
          <div id="menu-movel" className="px-4 pb-3 lg:hidden">
            <nav className="space-y-0.5" aria-label="Principal no celular">{links(() => setOpen(false))}</nav>
            <div className="mt-3 border-t border-[var(--rule)] pt-3">{me}</div>
          </div>
        )}
        <main className="min-w-0 flex-1 px-2 pb-2 sm:px-3 sm:pb-3 lg:py-3 lg:pl-0 lg:pr-3">
          <div className="enter min-h-full rounded-[18px] border border-[var(--frame-line)] bg-[var(--card)] px-4 py-6 shadow-[var(--sheet-shadow)] sm:px-8 lg:px-12 lg:py-9">
            <div className="mx-auto w-full max-w-[1080px]">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
