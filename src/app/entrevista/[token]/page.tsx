import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { VoiceInterviewRoom } from "@/components/voice-interview-room";
import { getSyntheticInterviewView } from "@/lib/demo/fixtures";
import type { InterviewView } from "@/lib/interview/contract";

interface InterviewServiceModule {
  getInterviewService: () => {
    viewByToken: (token: string) => Promise<InterviewView | null>;
  };
}

async function resolveInterviewView(token: string): Promise<InterviewView> {
  if (token.startsWith("demo-") || token.startsWith("entrevista-")) {
    return getSyntheticInterviewView(token);
  }

  let serviceLoaded = false;
  try {
    const servicePath = "@/lib/interview/service";
    const mod = (await import(
      /* webpackIgnore: true */ servicePath
    )) as unknown as InterviewServiceModule;
    if (typeof mod.getInterviewService === "function") {
      serviceLoaded = true;
      const realView = await mod.getInterviewService().viewByToken(token);
      if (realView) {
        return realView;
      }
    }
  } catch {
    // Antes da merge de feature/m7-entrevista-voz, cai no fallback sintético
  }

  if (serviceLoaded) {
    notFound();
  }

  return getSyntheticInterviewView(token);
}

async function EntrevistaContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 3 || token.length > 128) {
    notFound();
  }

  const initialView = await resolveInterviewView(token);
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
