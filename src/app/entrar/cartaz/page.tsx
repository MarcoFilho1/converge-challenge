import { Suspense } from "react";
import { connection } from "next/server";
import { publicBaseUrl } from "@/lib/channels/public";
import { qrSvg, telegramDirectUrl } from "@/lib/channels/qr";

export const metadata = { title: "QR de entrada · Praevenius", description: "Cartaz para projetar ou colocar no slide: QR principal e QR reserva do Telegram." };

function Qr({ svg, label, size }: { svg: string; label: string; size: number }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className="max-w-full flex-none rounded-[12px] border border-[var(--frame-line)] bg-[#FFFFFF] p-3 [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

async function Poster() {
  await connection();
  const entryUrl = `${publicBaseUrl()}/entrar`;
  const tgUrl = telegramDirectUrl();
  const [entry, tg] = await Promise.all([qrSvg(entryUrl), qrSvg(tgUrl)]);
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-[34px] font-semibold leading-tight tracking-tight sm:text-[44px]">Teste pelo seu celular</h1>
      <p className="mt-3 max-w-[560px] text-[18px] leading-relaxed text-[var(--ink-2)]">Leia o QR code com a câmera e responda como um colaborador.</p>
      <div className="mt-8">
        <Qr svg={entry} label={`QR code principal: ${entryUrl}`} size={340} />
      </div>
      <p className="mt-3 text-[15px] tabular-nums text-[var(--muted)]">{entryUrl.replace(/^https?:\/\//, "")}</p>

      <div className="mt-10 flex w-full max-w-[620px] flex-col items-center gap-5 border-t border-[var(--rule)] pt-8 sm:flex-row sm:text-left">
        <Qr svg={tg} label={`QR code reserva do Telegram: ${tgUrl}`} size={150} />
        <p className="text-[16px] leading-relaxed text-[var(--ink-2)]">
          <strong className="font-semibold text-[var(--ink)]">O WhatsApp é o canal principal.</strong> Se o número cair, configuramos também o Telegram: é só ler este QR code.
        </p>
      </div>
    </div>
  );
}

/** Cartaz para projetar ou tirar print para o slide. */
export default function CartazPage() {
  return (
    <div className="min-h-svh bg-[var(--card)] px-4 py-10 text-[var(--ink)] sm:py-14">
      <div className="mx-auto mb-10 flex w-full max-w-[620px] items-center justify-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/praevenius-mark.png" alt="" width={30} height={30} />
        <span className="text-[21px] font-semibold tracking-tight">praevenius</span>
      </div>
      <Suspense fallback={null}>
        <Poster />
      </Suspense>
    </div>
  );
}
