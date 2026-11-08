import Link from "next/link";
import { connection } from "next/server";
import { RehearsalToggle } from "@/components/rehearsal-toggle";
import { publicBaseUrl } from "@/lib/channels/public";
import { qrSvg } from "@/lib/channels/qr";
import { getChannelStatus } from "@/lib/channels/status";

/** Tela Canais, parte de baixo: a reserva (Telegram), o QR de entrada dos participantes e o ensaio da queda. */
export async function TelegramPanel() {
  await connection();
  const status = await getChannelStatus();
  const entryUrl = `${publicBaseUrl()}/entrar`;
  const qr = await qrSvg(entryUrl);
  const tg = status.telegram;

  return (
    <section aria-labelledby="reserva-titulo" className="mt-12 max-w-[960px] border-t border-[var(--rule)] pt-10">
      <h2 id="reserva-titulo" className="text-[22px] font-semibold tracking-[-0.01em]">
        Telegram, a reserva
      </h2>
      <p className="mt-1 text-[14px] text-[var(--muted)]">
        {tg.online
          ? `No ar${tg.username ? ` como @${tg.username}` : ""}. Se o WhatsApp cair, convites, lembretes e avisos vão por aqui para quem ligou o Telegram.`
          : "Fora do ar. Confira TELEGRAM_BOT_TOKEN no .env e se só um servidor está ligado com esse token."}
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
        <div
          role="img"
          aria-label={`QR code da página de entrada: ${entryUrl}`}
          className="h-[220px] w-[220px] rounded-[12px] border border-[var(--frame-line)] bg-[#FFFFFF] p-3 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
        <div className="space-y-4 text-[14px] leading-relaxed text-[var(--ink-2)]">
          <h3 className="text-[16px] font-semibold text-[var(--ink)]">Entrada dos participantes</h3>
          <p>
            O QR abre <span className="tabular-nums text-[var(--ink)]">{entryUrl.replace(/^https?:\/\//, "")}</span>. A página oferece o WhatsApp; quem
            escolher o Telegram vê um aviso antes. Se o WhatsApp cair, ela troca sozinha para o Telegram.
          </p>
          <p className="flex flex-wrap gap-x-5 gap-y-2 font-medium">
            <Link href="/entrar/cartaz" className="text-[var(--brand-deep)] underline underline-offset-4">
              Abrir cartaz para projetar
            </Link>
            <Link href="/entrar" className="text-[var(--brand-deep)] underline underline-offset-4">
              Ver a página de entrada
            </Link>
          </p>
          <div className="border-t border-[var(--rule)] pt-4">
            <h3 className="mb-3 text-[16px] font-semibold text-[var(--ink)]">Ensaio</h3>
            <RehearsalToggle initial={status.whatsapp.simulatedDown} />
          </div>
        </div>
      </div>
    </section>
  );
}
