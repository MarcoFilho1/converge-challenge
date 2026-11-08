import Link from "next/link";
import Image from "next/image";
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

export default function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  return <div className="grid min-h-svh grid-cols-1 bg-[#F8FAF9] text-[#24363B] md:grid-cols-2">
    <section className="flex min-h-svh flex-col px-6 py-8 sm:px-12 lg:px-20">
    <header className="w-full"><Link href="/" className="inline-flex items-center gap-2" aria-label="Praevenius — início">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/praevenius-mark.png" alt="" width={32} height={32} />
      <span className="text-[23px] font-semibold tracking-tight">praevenius</span>
    </Link></header>
    <main className="mx-auto my-auto w-full max-w-[380px] py-14">
      <h1 className="mb-2 text-[30px] font-medium tracking-tight">Entrar</h1>
      <p className="mb-8 text-[13px] text-[var(--muted)]">Acesso ao ambiente médico.</p>
      <Suspense fallback={null}><LoginErrorAlert searchParams={searchParams} /></Suspense>
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
                placeholder="Seu e-mail ou CRM"
                autoComplete="username"
                className="h-[40px] w-full rounded-[10px] border border-[var(--control)] bg-[#FFFFFF] px-3 text-[14px] text-[var(--ink)] focus:border-[var(--brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-soft)]"
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
                placeholder="Sua senha"
                autoComplete="current-password"
                className="h-[40px] w-full rounded-[10px] border border-[var(--control)] bg-[#FFFFFF] px-3 text-[14px] text-[var(--ink)] focus:border-[var(--brand)] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-soft)]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="h-[42px] w-full cursor-pointer rounded-full bg-[var(--primary)] px-4 text-[14px] font-medium text-[#FFFFFF] shadow-[0_1px_2px_rgba(0,80,140,0.25)] transition-colors hover:bg-[var(--primary-hover)]"
              >
                Entrar
              </button>
            </div>
          </form>
      <p className="mt-5 text-[12px] text-[var(--muted)]">Demonstração: preencha os campos para conhecer a plataforma.</p>
      <Link href="/" className="mt-8 inline-block text-[13px] text-[#006EB8]">← Voltar ao início</Link>
    </main>
    </section>
    <aside className="relative hidden min-h-svh bg-[#E5EEF0] md:block" aria-label="Pessoas no trabalho">
      <Image src="/brand/workplace-conversation.jpg" alt="Dois colegas com camisas azuis analisando juntos um documento em um ambiente claro." fill priority unoptimized sizes="50vw" className="object-cover object-[50%_35%]" />
      <a href="https://www.pexels.com/photo/portrait-of-colleagues-wearing-blue-shirts-19345566/" target="_blank" rel="noopener noreferrer" className="absolute bottom-5 right-5 rounded-full bg-white px-3 py-1.5 text-[10px] text-[#24363B]">Foto: Angela Chacón · Pexels ↗</a>
    </aside>
  </div>;
}
