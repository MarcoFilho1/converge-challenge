import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { VoiceInterviewRoom } from "@/components/voice-interview-room";
import { getSyntheticInterviewView } from "@/lib/demo/fixtures";

async function EntrevistaContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 3 || token.length > 128) {
    notFound();
  }

  const initialView = getSyntheticInterviewView(token);
  return <VoiceInterviewRoom token={token} initialView={initialView} />;
}

export default function CollaboratorInterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[14px] text-[var(--muted)]">
          Carregando sala de entrevista...
        </div>
      }
    >
      <EntrevistaContent params={params} />
    </Suspense>
  );
}
