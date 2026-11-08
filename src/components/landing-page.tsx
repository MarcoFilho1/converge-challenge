"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import "./landing-page.css";

const examples = [
  { label: "Ritmo de trabalho", message: "Nos últimos dias, tem sido difícil desligar do trabalho.", reply: "Em que momentos você percebe isso com mais intensidade?" },
  { label: "Apoio da equipe", message: "Queria ter mais espaço para conversar com minha equipe.", reply: "Como você se sente quando precisa pedir ajuda no trabalho?" },
  { label: "Como me sinto", message: "Estou tentando entender o que tem me deixado tão cansado.", reply: "Podemos começar pelo seu dia a dia. Como foi sua última semana?" },
];

function Brand() {
  return <a href="#inicio" className="lp-brand" aria-label="Praevenius — voltar ao topo"><Image src="/brand/praevenius-mark.png" alt="" width={38} height={38} priority /><span>praevenius</span></a>;
}

function CountUp({ value, prefix = "" }: { value: number; prefix?: string }) {
  const number = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = number.current;
    if (!element) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      element.textContent = `${prefix}${value}`;
    };
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      if (motion.matches) { finish(); return; }
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 1500);
        element.textContent = `${prefix}${Math.round(value * (1 - Math.pow(1 - progress, 3)))}`;
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      element.textContent = `${prefix}0`;
      frame = requestAnimationFrame(tick);
    }, { threshold: .6 });
    observer.observe(element);
    const onPreference = () => { if (motion.matches) finish(); };
    motion.addEventListener("change", onPreference);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); motion.removeEventListener("change", onPreference); };
  }, [value, prefix]);
  return <span className="lp-counter" ref={number} aria-label={`${prefix}${value}`}>{prefix}{value}</span>;
}

const agentStages = [
  { title: "Questionário", detail: "Escuta pelo WhatsApp", owner: "Agente", icon: "M5 4h14v12H9l-4 4V4Z M9 8h6 M9 12h4" },
  { title: "Triagem", detail: "Regras identificam sinais", owner: "Regras + agente", icon: "M4 5h16M7 10h10M10 15h4M12 15v5" },
  { title: "Helena", detail: "Entrevista quando indicada", owner: "Agente", icon: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Z M5 11v1a7 7 0 0 0 14 0v-1 M12 19v3" },
  { title: "Resumo", detail: "Relatos e evidências reunidos", owner: "Agente", icon: "M6 3h9l4 4v14H6V3Z M14 3v5h5 M9 12h7 M9 16h5" },
  { title: "Acompanhamento", detail: "Avaliação e próximos passos", owner: "Médico", icon: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" },
];

function AgentJourney() {
  return <section className="lp-process" id="como-funciona" aria-labelledby="process-title">
    <h2 id="process-title">O agente conecta as etapas.<br /><em>O médico conduz o cuidado.</em></h2>
    <ol className="lp-journey" aria-label="Etapas do acompanhamento clínico">
      {agentStages.map((stage, index) => <li key={stage.title} className={index === 4 ? "lp-journeyHuman" : ""}>
        <div className="lp-journeyNode"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={stage.icon} /></svg><span className="lp-journeyNumber">0{index + 1}</span></div>
        <h3>{stage.title}</h3><p>{stage.detail}</p><span className="lp-journeyOwner">{stage.owner}</span>
      </li>)}
    </ol>
    <p className="lp-journeyNote">A entrevista depende dos sinais identificados. Situações de urgência priorizam o contato humano.</p>
  </section>;
}

/** Teste como colaborador: no computador, QR para abrir no celular; no celular, o botão. */
function TryIt() {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("qrcode").then(QRCode => QRCode.toString(`${window.location.origin}/entrar`, { type: "svg", margin: 1, color: { dark: "#24363B", light: "#FFFFFF" } })).then(svg => { if (alive) setQr(svg); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return <section className="lp-privacy lp-try" id="testar" aria-labelledby="try-title">
    <p className="lp-eyebrow">TESTE AGORA</p>
    <div className="lp-sectionHeading"><h2 id="try-title">Responda como um colaborador.<br /><em>Pelo seu celular.</em></h2><p>O questionário chega pelo WhatsApp, o canal principal. Se o WhatsApp estiver fora do ar, o atendimento continua pelo Telegram, a reserva.</p></div>
    <div className="lp-tryRow">
      {qr && <div className="lp-tryQr" role="img" aria-label="QR code para abrir o teste no celular" dangerouslySetInnerHTML={{ __html: qr }} />}
      <div><p className="lp-tryText">No computador, leia o QR code com a câmera do celular. No celular, toque no botão.</p><Link className="lp-button" href="/demo">Iniciar a demo <span aria-hidden="true">↗</span></Link><p className="lp-tryNote">O roteiro passa por todos os papéis: colaborador, Helena e médica. Quer só o questionário? <Link href="/entrar">Abrir direto no WhatsApp</Link>.</p></div>
    </div>
  </section>;
}

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [topic, setTopic] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const example = examples[topic];
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hero = container.querySelector<HTMLElement>(".lp-hero");
    let scrollFrame = 0;
    const updateScroll = () => {
      scrollFrame = 0;
      setScrolled(window.scrollY > 48);
      if (!hero) return;
      const distance = Math.max(1, hero.offsetHeight * .72);
      const progress = preference.matches ? 0 : Math.max(0, Math.min(1, window.scrollY / distance));
      hero.style.setProperty("--hero-exit", String(progress));
      hero.querySelectorAll<HTMLElement>("a").forEach(link => { link.inert = progress >= .95; });
    };
    const onScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); };
    updateScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    preference.addEventListener("change", onScroll);
    const animations = new Set<Animation>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (preference.matches) return;
        const element = entry.target as HTMLElement;
        const isPreview = element.classList.contains("lp-conversation");
        const index = Array.from(element.parentElement?.children ?? []).indexOf(element);
        const stagger = element.matches("li, article") ? Math.max(0, index) * 110 : 0;
        const animation = element.animate([
          { opacity: 0, transform: isPreview ? "translateY(36px) scale(.97)" : "translateY(24px)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ], { duration: isPreview ? 850 : 650, delay: stagger, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" });
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      });
    }, { threshold: 0.12 });
    container.querySelectorAll(".lp-sectionHeading, .lp-conversation, .lp-process > h2, .lp-process li, .lp-accessRows article, .lp-evidenceNumbers > div, .lp-final > h2, .lp-final > .lp-button").forEach(element => observer.observe(element));
    const stopMotion = () => { if (preference.matches) animations.forEach(animation => animation.cancel()); };
    preference.addEventListener("change", stopMotion);
    const navigate = (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      const target = link && document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: preference.matches ? "instant" : "smooth", block: "start" });
      history.pushState(null, "", link!.hash);
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    container.addEventListener("click", navigate);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); preference.removeEventListener("change", onScroll); cancelAnimationFrame(scrollFrame); observer.disconnect(); animations.forEach(animation => animation.cancel()); preference.removeEventListener("change", stopMotion); container.removeEventListener("click", navigate); };
  }, []);
  return <div className={scrolled ? "lp lp-scrolled" : "lp"} ref={root} id="inicio">
    <a className="lp-skip" href="#conteudo">Ir para o conteúdo</a>
    <header className="lp-header"><Brand /><button className="lp-menu" aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Fechar ×" : "Menu ☰"}</button><nav id="landing-navigation" className={menuOpen ? "lp-nav lp-navOpen" : "lp-nav"} aria-label="Navegação principal"><a href="#prevencao" onClick={() => setMenuOpen(false)}>A plataforma</a><a href="#como-funciona" onClick={() => setMenuOpen(false)}>Como funciona</a><a href="#privacidade" onClick={() => setMenuOpen(false)}>Privacidade</a><a href="#testar" onClick={() => setMenuOpen(false)}>Testar agora</a><Link href="/demo" className="lp-login lp-demoLink">Iniciar a demo <span aria-hidden="true">↗</span></Link><Link href="/login" className="lp-login">Entrar <span aria-hidden="true">↗</span></Link></nav></header>
    <main id="conteudo">
      <section className="lp-hero" aria-labelledby="hero-title"><h1 id="hero-title">Cuidar antes que<br /><em>o problema cresça.</em></h1><div className="lp-heroBottom"><p>A Praevenius apoia o médico do trabalho na identificação precoce de sinais de adoecimento e ajuda empresas a organizar a prevenção. O objetivo é evitar agravamentos e reduzir o impacto dos afastamentos.</p><div className="lp-heroActions"><Link className="lp-button" href="/demo">Iniciar a demo <span aria-hidden="true">↗</span></Link><a className="lp-button lp-buttonQuiet" href="#evidencias">Conheça a Praevenius <span aria-hidden="true">↘</span></a></div></div></section>
      <section className="lp-privacy lp-evidence" id="evidencias" aria-labelledby="evidence-title">
        <div className="lp-sectionHeading"><h2 id="evidence-title">Saúde e trabalho.<br /><em>O cenário brasileiro.</em></h2><p>Dados sobre benefícios por incapacidade e engajamento no Brasil.</p></div>
        <dl className="lp-evidenceNumbers lp-brazilNumbers">
          <div><dt>Benefícios por transtornos mentais · 2022–2025</dt><dd><CountUp value={171} prefix="+" /><span>%</span></dd><p>De 201.864 para 546.254 benefícios por incapacidade temporária concedidos. Crescimento aproximado; dados de 2025 divulgados como preliminares.</p><a href="https://www.gov.br/fundacentro/pt-br/comunicacao/noticias/noticias/2026/marco/concessao-de-beneficios-por-transtornos-mentais-e-comportamentais-cresce-mais-de-100-apos-pandemia" target="_blank" rel="noopener noreferrer">Previdência Social / Fundacentro ↗</a></div>
          <div><dt>Perdas anuais associadas ao desengajamento</dt><dd><CountUp value={77} prefix="R$ " /> <span>bilhões</span></dd><p>Estimativa equivalente a cerca de 0,66% do PIB brasileiro, considerando presenteísmo e rotatividade. Não são perdas exclusivamente atribuíveis à saúde mental.</p><a href="https://portal.fgv.br/noticias/engajamento-no-trabalho-cai-ao-menor-nivel-da-serie-historica-e-gera-perda-anual-de-r-77" target="_blank" rel="noopener noreferrer">FGV EAESP · Engaja S/A, 2025 ↗</a></div>
          <div><dt>Profissionais pesquisados que se dizem engajados</dt><dd><CountUp value={39} /><span>%</span></dd><p>Menor nível da série histórica do Engaja S/A. A pesquisa de 2025 ouviu 5.397 profissionais brasileiros.</p><a href="https://flashapp.com.br/engaja-sa" target="_blank" rel="noopener noreferrer">Flash · Pesquisa Engaja S/A ↗</a></div>
        </dl>
        <details className="lp-evidenceCaveats"><summary>Contexto e limites dos dados</summary><ul><li>Benefícios concedidos não equivalem necessariamente a pessoas distintas. Nem todos os transtornos que motivaram benefícios tiveram origem no trabalho.</li><li>O crescimento de aproximadamente 171% é calculado sobre os totais de 2022 e 2025 apresentados. Os dados de 2025 são preliminares.</li><li>Os R$ 77 bilhões são uma estimativa da pesquisa Engaja S/A para desengajamento, somando presenteísmo e rotatividade; não medem apenas saúde mental.</li><li>Os 39% se referem aos participantes da pesquisa de 2025. Os indicadores não demonstram resultados obtidos pela Praevenius.</li></ul></details>
      </section>
      <section className="lp-privacy" id="prevencao" aria-labelledby="prevention-title">
        <div className="lp-sectionHeading"><h2 id="prevention-title">Do cuidado individual<br /><em>à prevenção na empresa.</em></h2><p>A Praevenius reúne duas frentes de apoio: o acompanhamento do médico do trabalho e a organização do ciclo de prevenção da empresa.</p></div>
        <div className="lp-accessRows">
          <article><span>NR-7 / CONSULTÓRIO<br />Disponível na demonstração</span><h3>Mais contexto para o médico.</h3><p>Questionário pelo WhatsApp, fila de triagem, evidências e entrevista com Helena. Informações organizadas para apoiar a avaliação e o acompanhamento individual pelo médico do trabalho.</p></article>
          <article><span>NR-1 / EMPRESA<br />Em breve</span><h3>Um ciclo de prevenção contínuo.</h3><p>A proposta é acompanhar sinais por setor, sugerir ações, registrar responsáveis e prazos, reavaliar e reunir evidências do acompanhamento. O RH recebe somente informações agregadas, sem acesso às conversas individuais.</p></article>
          <article><span>REGISTRO E CONTINUIDADE</span><h3>Do sinal ao acompanhamento.</h3><p>Organizar o que foi identificado, quais ações foram propostas e como o cuidado evolui. A plataforma apoia prevenção e documentação; a conformidade depende também dos processos e da avaliação dos profissionais responsáveis.</p></article>
        </div>
      </section>
      <AgentJourney />
      <section className="lp-product" id="plataforma" aria-labelledby="product-title"><div className="lp-sectionHeading"><h2 id="product-title">Uma conversa pode ser<br />o <em>primeiro passo.</em></h2><p>Helena é a assistente da Praevenius. Ela conduz uma escuta sobre a relação com o trabalho, com perguntas simples e espaço para responder no seu ritmo.</p></div>
        <div className="lp-conversation"><div className="lp-conversationBar"><div><span className="lp-helenaIcon" aria-hidden="true">h.</span><div><strong>Helena</strong><span>Assistente de bem-estar</span></div></div><span className="lp-exampleLabel">Conversa ilustrativa</span></div><div className="lp-dialogue" key={topic}><p className="lp-userMessage">{example.message}</p><div className="lp-helenaMessage"><span>HELENA</span><p>{example.reply}</p></div></div><div className="lp-topics" role="group" aria-label="Exemplos de conversa">{examples.map((item, index) => <button key={item.label} aria-pressed={topic === index} onClick={() => setTopic(index)}>{item.label}<span aria-hidden="true">↗</span></button>)}</div><div className="lp-conversationFoot"><span>Você escolhe o que compartilhar.</span><Link href="/entrevista/demo-mariana-nr7">Conhecer a sala da Helena →</Link></div></div>
      </section>
      <section className="lp-privacy" id="privacidade" aria-labelledby="privacy-title"><div className="lp-sectionHeading"><h2 id="privacy-title">O cuidado aproxima.<br /><em>A privacidade protege.</em></h2><p>Visões diferentes, com limites claros sobre o acesso às informações.</p></div><div className="lp-accessRows"><article><span>Trabalhador</span><h3>Um espaço pessoal.</h3><p>Converse com Helena e reflita sobre a sua relação com o trabalho.</p></article><article><span>Organização</span><h3>Um olhar coletivo.</h3><p>Indicadores agregados por setor, em grupos de pelo menos cinco pessoas. Conversas individuais não fazem parte dessa visão.</p></article><article><span>Médico do trabalho</span><h3>Acompanhamento individual.</h3><p>A escuta clínica pertence a um ambiente separado, com acesso restrito ao profissional de saúde.</p></article></div></section>
      <section className="lp-privacy" id="embasamento" aria-labelledby="basis-title">
        <div className="lp-sectionHeading"><h2 id="basis-title">Escuta humana.<br /><em>Critérios claros.</em></h2><p>Na trilha clínica, o acompanhamento reúne questionários, regras de pontuação e referências documentais para apoiar o médico do trabalho.</p></div>
        <div className="lp-accessRows">
          <article><span>QUESTIONÁRIOS</span><h3>Pontuação por regras.</h3><p>WPAI-GH, BAT-12, PHQ-9, GAD-7 e COPSOQ II-Br: os escores são calculados em código, separados da conversa com a assistente.</p></article>
          <article><span>ACOMPANHAMENTO</span><h3>Sinais para avaliação.</h3><p>Os resultados são apresentados como indícios e relatos para avaliação profissional. A assistente não estabelece diagnósticos.</p></article>
          <article><span>REFERÊNCIAS</span><h3>Origem documentada.</h3><p>Evidências associadas a documentos e páginas, com referências à NR-1, NR-7 e aos manuais utilizados no acompanhamento.</p></article>
          <article><span>PRIORIDADE DE CUIDADO</span><h3>Atenção aos sinais de risco.</h3><p>A trilha clínica utiliza regras específicas para interromper a coleta e priorizar o acompanhamento humano quando identifica sinais de crise.</p></article>
        </div>
      </section>
      <TryIt />
      <section className="lp-final" aria-labelledby="final-title"><h2 id="final-title">Mais escuta.<br /><em>Mais espaço para cuidar.</em></h2><Link className="lp-button" href="/login">Acessar a plataforma <span aria-hidden="true">↗</span></Link></section>
    </main><footer className="lp-footer"><Brand /><span>Bem-estar no trabalho, com pessoas no centro.</span><a href="#conteudo">Voltar ao topo ↑</a></footer>
  </div>;
}
