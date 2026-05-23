import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { gsap } from "gsap";

interface StepReviewProps {
  name: string;
  phone: string;
  professional: string;
  service: string;
  date: string; // "AAAA-MM-DD"
  time: string; // "HH:MM"
  back: () => void;
  onConfirm: () => void;
  bookingStatus: string | null;
  bookingInProgress: boolean;
  bookingDone: boolean;
}

// formata "2025-12-18" -> "18 de dezembro"
function formatDatePtBr(dateStr: string | null | undefined): string {
  if (!dateStr) return "";

  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;

  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return dateStr;
  }

  const d = new Date(year, month, day);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

type Phase = "idle" | "fadingOutIdle" | "submitting" | "success";

export default function StepReview({
  name,
  phone,
  professional,
  service,
  date,
  time,
  back,
  onConfirm,
  bookingStatus,
  bookingInProgress,
  bookingDone,
}: StepReviewProps) {
  // ====== TEMPOS (alinhados ao seu CSS) ======
  const FADE_OUT_MS = 250;       // .fade-transition / .fade-only-out (0.25s)
  const MIN_LOADING_MS = 2000;   // mínimo mostrando "Agendando..."
  const SLOW_HINT_MS = 9000;     // aviso de "demorando mais que o normal" (UI)
  // (Obs: não “mata” request aqui; só avisa.)

  const formattedDateTime = useMemo(() => {
    if (!date || !time) return "";
    const niceDate = formatDatePtBr(date);
    return `${niceDate} às ${time}`;
  }, [date, time]);

  const baseHint = (
    <>
      Clique em{" "}
      <span style={{ color: "#a855ff", fontWeight: 600 }}>AGENDAR</span>{" "}
       e garanta sua vaga.
    </>
  );

  // Fase visual interna
  const [phase, setPhase] = useState<Phase>(() => {
    if (bookingDone) return "success";
    if (bookingInProgress) return "submitting";
    return "idle";
  });

  // Marca quando o botão "Agendando..." realmente entrou na tela
  const loadingStartedAtRef = useRef<number | null>(null);

  // trava pra não disparar sucesso mais de uma vez
  const successLockedRef = useRef(false);

  const sectionRef = useRef<HTMLElement>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const items  = gsap.utils.toArray<HTMLElement>(".timeline-item");
      const master = gsap.timeline();

      const ENTRY_DUR  = 0.75;
      const COLOR_DUR  = 0.50;
      const STAGGER    = 0.18;
      const COLOR_GAP  = -0.10; // cor começa 100ms antes da entrada terminar

      // Estado inicial: todos em cinza + invisíveis antes do primeiro frame
      gsap.set(items, { filter: "grayscale(1) brightness(0.48)", opacity: 0, y: 18 });
      if (bottomRef.current) {
        gsap.set(bottomRef.current, { opacity: 0, y: 8 });
      }

      items.forEach((item, i) => {
        const icon    = item.querySelector<HTMLElement>(".timeline-icon");
        const entryAt = i * STAGGER;
        const colorAt = entryAt + ENTRY_DUR + COLOR_GAP; // só começa após entrada 100%

        // Onda 1: entrada em cinza (filter intocado)
        master.fromTo(
          item,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: ENTRY_DUR, ease: "power2.out" },
          entryAt,
        );

        // Onda 2: ativação de cor (separada da entrada)
        master.fromTo(
          item,
          { filter: "grayscale(1) brightness(0.48)" },
          {
            filter: "grayscale(0) brightness(1)",
            duration: COLOR_DUR,
            ease: "power2.out",
          },
          colorAt,
        );

        // Pulse suave no círculo após cor totalmente revelada
        if (icon) {
          master.to(
            icon,
            {
              scale: 1.10,
              duration: 0.26,
              ease: "sine.inOut",
              yoyo: true,
              repeat: 1,
              transformOrigin: "50% 50%",
            },
            colorAt + COLOR_DUR + 0.04,
          );
        }
      });

      // Botões/hint surgem após o último item estar 100% colorido
      const lastColorEnd = (items.length - 1) * STAGGER + ENTRY_DUR + COLOR_GAP + COLOR_DUR;
      if (bottomRef.current) {
        master.to(
          bottomRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.50,
            ease: "power2.out",
            clearProps: "opacity,transform",
          },
          lastColorEnd + 0.12,
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // aviso de lentidão (UI), sem “matar” o request
  const [slowHint, setSlowHint] = useState(false);

  // Clique em "Agendar": inicia fade-out do estado 1 e dispara a API
  const handleConfirmClick = () => {
    if (phase !== "idle") return;

    // reset de tentativas
    successLockedRef.current = false;
    loadingStartedAtRef.current = null;
    setSlowHint(false);

    setPhase("fadingOutIdle");
    onConfirm();
  };

  // 1) Depois do fade-out real (250ms), entra em "submitting"
  useEffect(() => {
    if (phase !== "fadingOutIdle") return;

    const t = window.setTimeout(() => {
      // entra no loading (mesmo que a resposta já tenha vindo)
      loadingStartedAtRef.current = performance.now();
      setPhase("submitting");
    }, FADE_OUT_MS);

    return () => window.clearTimeout(t);
  }, [phase]);

  // 2) Se a request terminar e NÃO foi sucesso, volta pro idle (pra permitir tentar de novo)
  useEffect(() => {
    if (phase !== "submitting") return;

    // se ainda está carregando, não mexe
    if (bookingInProgress) return;

    // se foi sucesso, a regra do sucesso cuida
    if (bookingDone) return;

    // terminou e não foi sucesso -> volta pro idle (mensagem vem de bookingStatus)
    setPhase("idle");
    setSlowHint(false);
  }, [phase, bookingInProgress, bookingDone]);

  // 3) Sucesso: garante no mínimo MIN_LOADING_MS a partir do momento que "Agendando..." apareceu
  useEffect(() => {
    if (!bookingDone) return;
    if (successLockedRef.current) return;

    // Se já estava em success, não faz nada
    if (phase === "success") {
      successLockedRef.current = true;
      return;
    }

    // Se ainda não entrou em submitting (pode acontecer por corrida), espera entrar.
    if (phase !== "submitting") return;

    const startedAt = loadingStartedAtRef.current ?? performance.now();
    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, MIN_LOADING_MS - elapsed);

    const t = window.setTimeout(() => {
      setPhase("success");
      successLockedRef.current = true;
      setSlowHint(false);
    }, remaining);

    return () => window.clearTimeout(t);
  }, [bookingDone, phase]);

  // 4) Aviso de lentidão (UI) se ficar muito tempo em submitting
  useEffect(() => {
    if (phase !== "submitting") return;

    const t = window.setTimeout(() => {
      // Só mostra aviso se ainda não concluiu
      if (!bookingDone) setSlowHint(true);
    }, SLOW_HINT_MS);

    return () => window.clearTimeout(t);
  }, [phase, bookingDone]);

  const isLoading = phase === "submitting" || phase === "success";
  const isSuccess = false;

  // Texto do estado inicial (idle)
  const idleHintContent =
    phase === "idle" ? bookingStatus || baseHint : baseHint;

  const hintIdleClassName =
    "review-hint fade-only-in fade-only-out" +
    (phase === "fadingOutIdle" ? " fade-only-out--hidden" : "");

  return (
    <section id="step-review" className="step" ref={sectionRef}>
      {/* TÍTULO DO STEP */}
      <h2 className="popup-title animate-fade-in-down">Resumo do agendamento:</h2>

      {/* TIMELINE */}
      <div style={{ marginTop: "8px" }}>
        <div className="timeline">

          {/* Nome */}
          <div className="timeline-item">
            <div className="timeline-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="timeline-content">
              <h2 className="timeline-label">Seu nome</h2>
              <p className="timeline-message">{name || "—"}</p>
            </div>
          </div>

          {/* Telefone */}
          <div className="timeline-item">
            <div className="timeline-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
                <line x1="9" x2="15" y1="18" y2="18"/>
                <circle cx="12" cy="14" r="1"/>
              </svg>
            </div>
            <div className="timeline-content">
              <h2 className="timeline-label">Telefone</h2>
              <p className="timeline-message">{phone || "—"}</p>
            </div>
          </div>

          {/* Profissional */}
          <div className="timeline-item">
            <div className="timeline-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3"/>
                <circle cx="6" cy="18" r="3"/>
                <line x1="20" y1="4" x2="8.12" y2="15.88"/>
                <line x1="14.47" y1="14.48" x2="20" y2="20"/>
                <line x1="8.12" y1="8.12" x2="12" y2="12"/>
              </svg>
            </div>
            <div className="timeline-content">
              <h2 className="timeline-label">Profissional</h2>
              <p className="timeline-message">{professional || "—"}</p>
            </div>
          </div>

          {/* Serviço */}
          <div className="timeline-item">
            <div className="timeline-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 3 14.2 9.8 21 12 14.2 14.2 12 21 9.8 14.2 3 12 9.8 9.8 12 3"/>
                <line x1="5" x2="5" y1="3" y2="7"/>
                <line x1="3" x2="7" y1="5" y2="5"/>
                <line x1="19" x2="19" y1="17" y2="21"/>
                <line x1="17" x2="21" y1="19" y2="19"/>
              </svg>
            </div>
            <div className="timeline-content">
              <h2 className="timeline-label">Serviço</h2>
              <p className="timeline-message">{service || "—"}</p>
            </div>
          </div>

          {/* Data e horário */}
          <div className="timeline-item">
            <div className="timeline-icon timeline-icon--confirmed">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
                <path d="m9 16 2 2 4-4"/>
              </svg>
            </div>
            <div className="timeline-content">
              <h2 className="timeline-label">Data e horário</h2>
              <p className="timeline-message">{formattedDateTime || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========= TEXTOS DE STATUS + BOTÕES (aparecem por último via GSAP) ========= */}
      <div ref={bottomRef}>

        {(phase === "idle" || phase === "fadingOutIdle") && (
          <p
            className={hintIdleClassName}
            style={{ marginTop: "14px", fontSize: "14px", fontWeight: 600 }}
          >
            {idleHintContent}
          </p>
        )}

        {isLoading && (
          <p
            className="review-hint fade-only-in"
            style={{ marginTop: "14px", fontSize: "14px", fontWeight: 600 }}
          >
            {slowHint
              ? "Ainda estamos finalizando… só mais um instante."
              : "Estamos criando o seu agendamento..."}
          </p>
        )}

        {(phase === "idle" || phase === "fadingOutIdle") && (
          <div
            className={
              "field fade-transition" +
              (phase === "fadingOutIdle" ? " fade-transition--hidden" : "")
            }
            style={{
              gridAutoFlow: "column",
              justifyContent: "center",
              gap: "10px",
              marginTop: "10px",
            }}
          >
            <button className="liquid-btn back" onClick={back}>
              Voltar
            </button>

            <button className="liquid-btn enabled" onClick={handleConfirmClick}>
              Agendar
            </button>
          </div>
        )}

        {isLoading && (
          <div
            className="field animate-fade-in-up"
            style={{ justifyContent: "center", marginTop: "10px" }}
          >
            <button className="liquid-btn enabled" type="button" disabled>
              <span>Agendando</span>
              <span className="dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </span>
            </button>
          </div>
        )}


      </div>
    </section>
  );
}
