"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CallStage } from "@/components/call-stage";
import type {
  BlockInfo,
  InterviewStatus,
  InterviewView,
  TurnResponse,
} from "@/lib/interview/contract";
import { BLOCK_LABELS } from "@/lib/interview/contract";

export type RoomVoiceState = "falando" | "ouvindo" | "pensando" | "inativo";

interface DemoScriptStep {
  block: BlockInfo;
  say: string;
}

const DEMO_SCRIPT: DemoScriptStep[] = [
  {
    block: { id: "saude", label: BLOCK_LABELS.saude, index: 1, total: 4 },
    say: "Oi, eu sou a Helena, trabalho com a Dra. Ana Lima. Essa conversa leva uns dez minutos e só ela vai ouvir o que você disser. Você pode pular qualquer pergunta ou parar quando quiser. O que você tem sentido nas últimas semanas?",
  },
  {
    block: { id: "trabalho", label: BLOCK_LABELS.trabalho, index: 2, total: 4 },
    say: "Obrigada por contar. E no trabalho, o que está mais difícil agora? Você consegue parar e descansar durante o dia?",
  },
  {
    block: { id: "barreiras", label: BLOCK_LABELS.barreiras, index: 3, total: 4 },
    say: "Entendi seu relato. O que impediu você de buscar ajuda até agora?",
  },
  {
    block: { id: "seguranca", label: BLOCK_LABELS.seguranca, index: 4, total: 4 },
    say: "Nessas semanas, você teve pensamentos de se machucar, ou de que não vale a pena continuar?",
  },
];

const CRISIS_REGEX =
  /\b(me\s+matar|suic[ií]dio|acabar\s+com\s+tudo|n[aã]o\s+aguento\s+mais\s+viver|quero\s+morrer|me\s+machucar|tirar\s+minha\s+vida)\b/i;


function formatDoctorRef(doctorName: string): string {
  return doctorName.startsWith("Dra.") || doctorName.startsWith("Dr.")
    ? doctorName
    : `Dra. ${doctorName}`;
}

/** Fim de fala: pausa de 1,8 s depois de pelo menos 0,5 s de voz; ruído medido nos primeiros 0,4 s. */
const VAD_SILENCE_MS = 1800;
const VAD_MIN_VOICE_MS = 500;
const VAD_CALIBRATE_MS = 400;
const VAD_MIN_THRESHOLD = 0.14;

export function VoiceInterviewRoom({
  token,
  initialView,
}: {
  token: string;
  initialView: InterviewView;
}) {
  const doctorRef = formatDoctorRef(initialView.doctorName);
  /** Só a demonstração sem servidor (dados sintéticos) pode simular a conversa. Com o servidor real, nunca inventamos fala. */
  const demoMode = initialView.id.startsWith("99999999-");

  const [status, setStatus] = useState<InterviewStatus>(initialView.status);
  const [voiceState, setVoiceState] = useState<RoomVoiceState>("inativo");
  const [, setBlock] = useState<BlockInfo | null>(initialView.block);
  const [sayText, setSayText] = useState<string>(
    initialView.currentUtterance?.text ??
      (initialView.status === "crisis"
        ? "Obrigada por contar. Você não precisa passar por isso sozinho(a)."
        : "")
  );
  const [turnIndex, setTurnIndex] = useState<number>(initialView.turnsCount);
  const [elapsedMs, setElapsedMs] = useState<number>(initialView.elapsedMs);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [, setRecordMs] = useState<number>(0);
  const [showTextInput, setShowTextInput] = useState<boolean>(false);
  const [textDraft, setTextDraft] = useState<string>("");
  const [micError, setMicError] = useState<string | null>(null);
  /** Microfone desligado pela pessoa: a Helena termina de falar e espera, sem gravar. */
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  /** Legenda (só da fala da Helena), desligada por padrão: a conversa é por voz. */
  const [captionsOn, setCaptionsOn] = useState(false);
  const [connectionError, setConnectionError] = useState<boolean>(false);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [crisisInfo, setCrisisInfo] = useState<{
    cvv: "188";
    samu: "192";
    doctorNotified: boolean;
  }>({
    cvv: "188",
    samu: "192",
    doctorNotified: true,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Volume da voz da Helena (0 a 1), para a animação estilo Meet. Só funciona se o áudio passar por um AudioContext ativo. */
  const [helenaLevel, setHelenaLevel] = useState(0);
  const outCtxRef = useRef<AudioContext | null>(null);
  const outAnalyserRef = useRef<AnalyserNode | null>(null);
  const outTriedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordStartRef = useRef<number>(0);
  const spokenDetectedRef = useRef<boolean>(false);
  const silenceStartRef = useRef<number | null>(null);
  const submitAudioRef = useRef<((blob: Blob, durationMs: number) => void) | null>(null);
  /** Encerrar e Pular param o gravador sem enviar o que estava sendo gravado. */
  const discardRecordingRef = useRef(false);

  const stopMediaResources = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore stop errors on already-stopped recorder
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMicLevel(0);
    setRecordMs(0);
  }, []);

  useEffect(() => {
    return () => {
      stopMediaResources();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopMediaResources]);

  //Elapsed timer while running
  useEffect(() => {
    if (status !== "running") return;
    const interval = window.setInterval(() => {
      setElapsedMs((prev) => prev + 1000);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  const startListening = useCallback(async () => {
    setMicError(null);
    setVoiceState("ouvindo");
    setRecordMs(0);
    spokenDetectedRef.current = false;
    silenceStartRef.current = null;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setShowTextInput(true);
      setMicError(
        "Microfone indisponível neste navegador. Use o campo de texto abaixo para responder."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // sem ganho automático: ele aumenta o ruído durante o silêncio e o fim da fala nunca é detectado
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recordStartRef.current = performance.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          return;
        }
        const duration = Math.round(performance.now() - recordStartRef.current);
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (submitAudioRef.current && blob.size > 0) {
          submitAudioRef.current(blob, duration);
        }
      };

      recorder.start(200);

      const data = new Uint8Array(analyser.frequencyBinCount);
      // Detecção de fim de fala: mede o ruído do ambiente no começo, exige fala sustentada
      // e só fecha o turno depois de uma pausa longa (pausas para pensar não cortam a pessoa).
      let noiseSum = 0;
      let noiseFrames = 0;
      let threshold = VAD_MIN_THRESHOLD;
      let voicedMs = 0;
      let lastTick = performance.now();
      const tick = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
          return;
        }
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i] ?? 0;
        }
        const avg = sum / data.length / 255;
        const normalized = Math.min(1, avg * 2.8);
        setMicLevel(normalized);

        const now = performance.now();
        const elapsed = now - recordStartRef.current;
        setRecordMs(elapsed);

        // Max 60s per turn
        if (elapsed >= 60000) {
          stopMediaResources();
          return;
        }

        const dt = now - lastTick;
        lastTick = now;
        if (elapsed < VAD_CALIBRATE_MS) {
          noiseSum += normalized;
          noiseFrames += 1;
          threshold = Math.max(VAD_MIN_THRESHOLD, (noiseSum / noiseFrames) * 2.5 + 0.06);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        if (normalized > threshold) {
          voicedMs += dt;
          if (voicedMs >= VAD_MIN_VOICE_MS) spokenDetectedRef.current = true;
          silenceStartRef.current = null;
        } else if (spokenDetectedRef.current) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = now;
          } else if (now - silenceStartRef.current >= VAD_SILENCE_MS) {
            stopMediaResources();
            return;
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setShowTextInput(true);
      setMicError(
        "Permissão de microfone não concedida. Você pode responder digitando abaixo."
      );
    }
  }, [stopMediaResources]);

  /** Liga um analisador ao áudio da Helena. Só conecta se o contexto estiver rodando, senão ela ficaria muda. */
  const ensureOutAnalyser = useCallback(async () => {
    if (outTriedRef.current || !audioRef.current) return;
    outTriedRef.current = true;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      await ctx.resume().catch(() => {});
      if (ctx.state !== "running") {
        await ctx.close().catch(() => {});
        return;
      }
      const src = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      outCtxRef.current = ctx;
      outAnalyserRef.current = analyser;
    } catch {
      // sem analisador: a tela usa a animação fixa
    }
  }, []);

  const playUtterance = useCallback(
    (text: string, audioUrl: string | null, isFinal: boolean) => {
      stopMediaResources();
      setVoiceState("falando");

      const onSpeechEnd = () => {
        if (isFinal || mutedRef.current) {
          setVoiceState("inativo");
        } else {
          startListening();
        }
      };

      if (audioUrl && audioRef.current) {
        void ensureOutAnalyser();
        outCtxRef.current?.resume().catch(() => {});
        audioRef.current.src = audioUrl;
        audioRef.current.onended = onSpeechEnd;
        audioRef.current.onerror = () => {
          onSpeechEnd();
        };
        audioRef.current.play().catch(() => {
          onSpeechEnd();
        });
        return;
      }

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = "pt-BR";
          utter.rate = 1.02;
          utter.onend = onSpeechEnd;
          utter.onerror = onSpeechEnd;
          window.speechSynthesis.speak(utter);
          return;
        } catch {
          // Fallback if speechSynthesis fails
        }
      }

      const timer = window.setTimeout(onSpeechEnd, 1400);
      return () => window.clearTimeout(timer);
    },
    [startListening, stopMediaResources, ensureOutAnalyser]
  );

  // Sync / resume on reload via GET /api/entrevista/[token]
  useEffect(() => {
    let active = true;
    fetch(`/api/entrevista/${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(8000),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const view = (await res.json()) as InterviewView;
        if (!active) return;
        setStatus(view.status);
        setBlock(view.block);
        setTurnIndex(view.turnsCount);
        setElapsedMs(view.elapsedMs);
        if (view.currentUtterance) {
          setSayText(view.currentUtterance.text);
          if (view.status === "running") {
            playUtterance(
              view.currentUtterance.text,
              view.currentUtterance.audioUrl,
              false
            );
          }
        }
      })
      .catch(() => {
        // Ignore before merge when API route is not mounted
      });
    return () => {
      active = false;
    };
  }, [playUtterance, token]);

  const applyTurnResponse = useCallback(
    (res: TurnResponse) => {
      setConnectionError(false);
      setRetryAction(null);
      setStatus(res.status);
      setBlock(res.block);
      setSayText(res.say);
      setTurnIndex(res.turnIndex);
      setElapsedMs(res.elapsedMs);
      if (res.crisis) {
        setCrisisInfo(res.crisis);
      }
      // última fala e crise usam o mesmo caminho das outras: áudio do servidor (voz da Helena); voz do navegador só sem áudio
      playUtterance(res.say, res.audioUrl, res.status === "crisis" || res.final);
    },
    [playUtterance]
  );

  const buildFallbackTurn = useCallback(
    (
      nextIdx: number,
      userText: string | null,
      action: "start" | "turno" | "skip" | "stop"
    ): TurnResponse => {
      if (action === "stop") {
        return {
          status: "stopped",
          heard: null,
          say: `Obrigada por conversar. O que você contou vai só para a ${doctorRef}. Nada vai para a empresa.`,
          audioUrl: null,
          voice: "browser",
          block: {
            id: "fechamento",
            label: BLOCK_LABELS.fechamento,
            index: 4,
            total: 4,
          },
          turnIndex: nextIdx,
          elapsedMs,
          final: true,
        };
      }

      if (userText && CRISIS_REGEX.test(userText)) {
        return {
          status: "crisis",
          heard: userText,
          say: `Obrigada por contar. Você não precisa passar por isso sozinho(a). A ${doctorRef} foi avisada agora.`,
          audioUrl: null,
          voice: "browser",
          block: {
            id: "seguranca",
            label: BLOCK_LABELS.seguranca,
            index: 4,
            total: 4,
          },
          turnIndex: nextIdx,
          elapsedMs,
          final: true,
          crisis: {
            cvv: "188",
            samu: "192",
            doctorNotified: true,
          },
        };
      }

      if (nextIdx >= DEMO_SCRIPT.length) {
        return {
          status: "done",
          heard: userText,
          say: `Obrigada por conversar. O que você contou vai só para a ${doctorRef}. Nada vai para a empresa.`,
          audioUrl: null,
          voice: "browser",
          block: {
            id: "fechamento",
            label: BLOCK_LABELS.fechamento,
            index: 4,
            total: 4,
          },
          turnIndex: nextIdx,
          elapsedMs,
          final: true,
        };
      }

      const step = DEMO_SCRIPT[nextIdx]!;
      return {
        status: "running",
        heard: userText,
        say: step.say,
        audioUrl: null,
        voice: "browser",
        block: step.block,
        turnIndex: nextIdx,
        elapsedMs,
        final: false,
      };
    },
    [doctorRef, elapsedMs]
  );

  const reportSendFailure = (retry: () => void) => {
    setConnectionError(true);
    setRetryAction(() => () => {
      setMicError(null);
      retry();
    });
    setShowTextInput(true);
    setMicError("Sua resposta não chegou. Você também pode responder digitando abaixo.");
    setVoiceState("inativo");
  };

  const handleStart = async (consent: boolean) => {
    setConnectionError(false);
    setVoiceState("pensando");
    try {
      const res = await fetch(`/api/entrevista/${encodeURIComponent(token)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent }),
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) {
        const data = (await res.json()) as TurnResponse;
        applyTurnResponse(data);
        return;
      }
      if (res.status >= 500) {
        setConnectionError(true);
        setRetryAction(() => () => handleStart(consent));
        setVoiceState("inativo");
        return;
      }
    } catch {
      // Fallback to local contract simulation before merge
    }

    if (!demoMode) {
      reportSendFailure(() => handleStart(consent));
      return;
    }
    if (!consent) {
      applyTurnResponse(buildFallbackTurn(0, null, "stop"));
      return;
    }
    applyTurnResponse(buildFallbackTurn(0, null, "start"));
  };

  const handleSendAudioTurn = useCallback(
    async (blob: Blob, durationMs: number) => {
      setConnectionError(false);
      setVoiceState("pensando");
      try {
        const form = new FormData();
        form.append("audio", blob, "turno.webm");
        form.append("clientMs", String(durationMs));
        const res = await fetch(
          `/api/entrevista/${encodeURIComponent(token)}/turno`,
          {
            method: "POST",
            body: form,
            signal: AbortSignal.timeout(25000),
          }
        );
        if (res.ok) {
          const data = (await res.json()) as TurnResponse;
          applyTurnResponse(data);
          return;
        }
        if (res.status === 503) {
          let errCode = "";
          try {
            const payload = (await res.json()) as { error?: string };
            errCode = payload.error ?? "";
          } catch {
            // ignore json parse error
          }
          if (errCode === "stt_indisponivel") {
            setConnectionError(false);
            setRetryAction(null);
            setShowTextInput(true);
            setMicError(
              "Não consegui ouvir. Você pode responder digitando no modo texto abaixo ou tentar falar novamente."
            );
            setVoiceState("inativo");
            return;
          }
        }
        if (res.status >= 500) {
          setConnectionError(true);
          setRetryAction(() => () => submitAudioRef.current?.(blob, durationMs));
          setVoiceState("inativo");
          return;
        }
      } catch {
        // Fallback when backend voice route is in sibling worktree
      }

      if (!demoMode) {
        reportSendFailure(() => submitAudioRef.current?.(blob, durationMs));
        return;
      }
      const simulatedHeard =
        turnIndex === 0
          ? "Tenho sentido bastante cansaço mental no fim do turno e dificuldade para desligar à noite."
          : turnIndex === 1
          ? "A fila de atendimento dobrou nas últimas semanas e quase não consigo fazer pausa."
          : turnIndex === 2
          ? "Falta horário fora do expediente para procurar atendimento."
          : "Não, não tive pensamentos desse tipo, só preciso descansar melhor.";
      applyTurnResponse(
        buildFallbackTurn(turnIndex + 1, simulatedHeard, "turno")
      );
    },
    [applyTurnResponse, buildFallbackTurn, token, turnIndex, demoMode]
  );

  useEffect(() => {
    submitAudioRef.current = handleSendAudioTurn;
  }, [handleSendAudioTurn]);

  const sendTextTurnValue = async (trimmed: string) => {
    stopMediaResources();
    setConnectionError(false);
    setVoiceState("pensando");

    try {
      const form = new FormData();
      form.append("text", trimmed);
      const res = await fetch(
        `/api/entrevista/${encodeURIComponent(token)}/turno`,
        {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(25000),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as TurnResponse;
        applyTurnResponse(data);
        return;
      }
      if (res.status >= 500) {
        setConnectionError(true);
        setRetryAction(() => () => sendTextTurnValue(trimmed));
        setVoiceState("inativo");
        return;
      }
    } catch {
      // Fallback
    }

    if (!demoMode) {
      reportSendFailure(() => sendTextTurnValue(trimmed));
      return;
    }
    applyTurnResponse(buildFallbackTurn(turnIndex + 1, trimmed, "turno"));
  };

  const handleSendTextTurn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    setTextDraft("");
    await sendTextTurnValue(trimmed);
  };

  const handleSkip = async () => {
    discardRecordingRef.current = mediaRecorderRef.current?.state === "recording";
    stopMediaResources();
    setConnectionError(false);
    setVoiceState("pensando");
    try {
      const res = await fetch(
        `/api/entrevista/${encodeURIComponent(token)}/skip`,
        {
          method: "POST",
          signal: AbortSignal.timeout(25000),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as TurnResponse;
        applyTurnResponse(data);
        return;
      }
    } catch {
      // Fallback
    }
    if (!demoMode) {
      reportSendFailure(() => handleSkip());
      return;
    }
    applyTurnResponse(
      buildFallbackTurn(turnIndex + 1, "(pergunta pulada)", "skip")
    );
  };

  const handleStop = async () => {
    discardRecordingRef.current = mediaRecorderRef.current?.state === "recording";
    stopMediaResources();
    setConnectionError(false);
    setVoiceState("pensando");
    try {
      const res = await fetch(
        `/api/entrevista/${encodeURIComponent(token)}/stop`,
        {
          method: "POST",
          signal: AbortSignal.timeout(25000),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as TurnResponse;
        applyTurnResponse(data);
        return;
      }
    } catch {
      // Fallback
    }
    if (!demoMode) {
      reportSendFailure(() => handleStop());
      return;
    }
    applyTurnResponse(buildFallbackTurn(turnIndex, null, "stop"));
  };

  useEffect(() => {
    if (voiceState !== "falando" || !outAnalyserRef.current) {
      setHelenaLevel(0);
      return;
    }
    const analyser = outAnalyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const loop = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] ?? 0;
      setHelenaLevel(Math.min(1, (sum / data.length / 255) * 3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [voiceState]);

  const handleToggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      // desligar: descarta o que estava sendo gravado, não envia nada
      discardRecordingRef.current = mediaRecorderRef.current?.state === "recording";
      stopMediaResources();
      setVoiceState((v) => (v === "ouvindo" ? "inativo" : v));
    } else if (voiceState === "inativo" || voiceState === "ouvindo") {
      startListening();
    }
  };

  const handleToggleText = () => {
    const opening = !showTextInput;
    setShowTextInput(opening);
    if (opening && !mutedRef.current) handleToggleMute();
    if (!opening && mutedRef.current) handleToggleMute();
  };

  return (
    <>
      {/* o elemento de áudio fica sempre montado no mesmo lugar: trocar de tela não corta a fala da Helena */}
      <audio ref={audioRef} className="hidden" />
      {status === "running" ? (
        <CallStage
          interviewerName={initialView.interviewer.name}
          doctorRef={doctorRef}
          voiceState={voiceState}
          micLevel={micLevel}
          helenaLevel={helenaLevel}
          muted={muted}
          captionsOn={captionsOn}
          caption={sayText}
          showListenHint={turnIndex <= 2}
          connectionError={connectionError}
          micError={micError}
          showTextInput={showTextInput}
          textDraft={textDraft}
          onRetry={retryAction}
          onToggleMute={handleToggleMute}
          onToggleCaptions={() => setCaptionsOn((v) => !v)}
          onSkip={handleSkip}
          onToggleText={handleToggleText}
          onHangUp={handleStop}
          onTextChange={setTextDraft}
          onSubmitText={handleSendTextTurn}
        />
      ) : (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)] flex flex-col justify-between px-4 py-5 sm:px-6 sm:py-8">

      {/* Cabeçalho fino */}
      <header className="w-full max-w-[440px] mx-auto flex items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
        <span className="text-[13px] font-medium text-[var(--ink)] truncate">
          Praevenius · {doctorRef}
        </span>
        <span className="tabular-nums text-[12px] text-[var(--muted)] shrink-0">
          Sigilo médico
        </span>
      </header>

      {/* Corpo central (uma coluna, mobile-first) */}
      <main className="w-full max-w-[440px] mx-auto my-auto py-4 flex-1 flex flex-col justify-center">
        {/* ESTADO 1: CONSENTIMENTO */}
        {status === "consent" && (
          <section
            aria-labelledby="consent-heading"
            className="bg-[var(--card)] border border-[var(--line)] rounded-[12px] p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] border border-[var(--brand)]/25 flex items-center justify-center text-[var(--brand)] font-semibold text-[16px] shrink-0">
                H
              </div>
              <div>
                <h1
                  id="consent-heading"
                  className="text-[20px] font-semibold tracking-[-0.015em] text-[var(--ink)] leading-snug"
                >
                  {initialView.interviewer.name}
                </h1>
                <p className="text-[13px] text-[var(--muted)]">
                  trabalha com a {doctorRef}
                </p>
              </div>
            </div>

            <p className="text-[15px] leading-[1.55] text-[var(--ink-2)]">
              Essa conversa leva uns {initialView.estimatedMinutes} minutos. Só a{" "}
              <strong>{doctorRef}</strong> vai ouvir o que você disser. Você pode
              pular qualquer pergunta ou parar quando quiser.
            </p>

            <div className="bg-[var(--surface-subtle)] border border-[var(--line)] rounded-[8px] p-3.5 text-[13px] text-[var(--ink-2)] space-y-1.5">
              <p>
                <strong className="text-[var(--ink)]">Sigilo garantido:</strong>{" "}
                RH e liderança não recebem seus áudios nem suas respostas individuais.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleStart(true)}
                disabled={voiceState === "pensando"}
                className="w-full py-3 px-4 rounded-[8px] bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-semibold text-[15px] transition-colors disabled:opacity-60"
              >
                {voiceState === "pensando"
                  ? "Helena está pensando..."
                  : "Aceito e quero começar"}
              </button>
              <button
                type="button"
                onClick={() => handleStart(false)}
                disabled={voiceState === "pensando"}
                className="w-full py-2.5 px-4 rounded-[8px] border border-[var(--line)] bg-transparent hover:bg-[var(--surface-subtle)] text-[var(--ink-2)] font-medium text-[14px] transition-colors"
              >
                Prefiro não
              </button>
            </div>
          </section>
        )}

        {/* ESTADO 3: CRISE (status "crisis") */}
        {status === "crisis" && (
          <section
            role="alert"
            aria-labelledby="crisis-heading"
            className="bg-[var(--card)] border-2 border-[var(--danger-fg)] rounded-[12px] p-5 sm:p-6 space-y-5"
          >
            <h1
              id="crisis-heading"
              className="text-[20px] font-semibold tracking-[-0.015em] text-[var(--ink)] leading-snug"
            >
              Obrigada por contar. Você não precisa passar por isso sozinho(a).
            </h1>

            <p className="text-[15px] leading-[1.55] text-[var(--ink-2)]">
              A <strong>{doctorRef}</strong> foi avisada agora.
            </p>

            <div className="space-y-2.5 pt-1">
              <a
                href={`tel:${crisisInfo.cvv}`}
                className="flex items-center justify-between w-full py-3.5 px-4 rounded-[8px] bg-[var(--danger-fg)] hover:opacity-95 text-white font-semibold text-[15px] transition-opacity"
              >
                <span>CVV 188 (Apoio emocional gratuito 24h)</span>
                <span className="tabular-nums text-[16px]">CVV 188</span>
              </a>

              <a
                href={`tel:${crisisInfo.samu}`}
                className="flex items-center justify-between w-full py-3 px-4 rounded-[8px] border border-[var(--danger-fg)] bg-[var(--danger-bg)] text-[var(--danger-fg)] font-semibold text-[15px]"
              >
                <span>SAMU 192 (Emergência médica 24h)</span>
                <span className="tabular-nums text-[16px]">SAMU 192</span>
              </a>
            </div>
          </section>
        )}

        {/* ESTADO 4: ENCERRADA (done | stopped) */}
        {(status === "done" || status === "stopped") && (
          <section
            aria-labelledby="done-heading"
            className="bg-[var(--card)] border border-[var(--line)] rounded-[12px] p-5 sm:p-6 space-y-4"
          >
            <h1
              id="done-heading"
              className="text-[20px] font-semibold tracking-[-0.015em] text-[var(--ink)] leading-snug"
            >
              Obrigada por conversar.
            </h1>

            <p className="text-[15px] leading-[1.55] text-[var(--ink-2)]">
              O que você contou vai só para a <strong>{doctorRef}</strong>. Nada
              vai para a empresa.
            </p>

            <div className="bg-[var(--surface-subtle)] border border-[var(--line)] rounded-[8px] p-3.5 text-[13px] text-[var(--ink-2)]">
              Se precisar conversar a qualquer hora, ligue{" "}
              <a
                href="tel:188"
                className="font-semibold text-[var(--alert-ink)] underline"
              >
                CVV 188
              </a>{" "}
              (gratuito, 24h).
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.close();
                }
              }}
              className="w-full py-2.5 px-4 rounded-[8px] border border-[var(--line)] bg-[var(--surface-subtle)] hover:bg-[var(--bg)] text-[var(--ink)] font-medium text-[14px] transition-colors"
            >
              Fechar
            </button>
          </section>
        )}
      </main>

      {/* Rodapé de confidencialidade */}
      <footer className="w-full max-w-[440px] mx-auto pt-3 border-t border-[var(--line)] flex items-center justify-between text-[12px] text-[var(--muted)]">
        <span>Sigilo médico · PCMSO NR-7</span>
        <span className="tabular-nums">CVV 188 · SAMU 192</span>
      </footer>
    </div>
      )}
    </>
  );
}
