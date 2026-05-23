import React, { useEffect, useRef, useState, useMemo } from "react";
import { ProgressiveBarLoader } from "./GlobalLoading";

interface StepTimeProps {
  slots: string[];
  loading?: boolean;
  message?: string | null;
  back: () => void;
  onSelectTime: (t: string) => void;
}

export default function StepTime({ slots, loading = false, message, back, onSelectTime }: StepTimeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Remove duplicados e ordena (garantia final)
  const sortedSlots = useMemo(() => {
    return [...new Set(slots)].sort((a, b) => a.localeCompare(b));
  }, [slots]);

  // Modo carrossel quando houver 5+ horários
  const isCarousel = sortedSlots.length >= 5;

  // Estados de fade top/bottom
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  // Controle do fade via scroll
  function handleScroll() {
    if (!scrollRef.current || !isCarousel) return;

    const el = scrollRef.current;
    const top = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;

    const itemHeight = 56; // mesma base que você usou na init
    const threshold = itemHeight * 0.7; // ~70% de um item escondido

    // Só mostra o fade do topo se tiver pelo menos "um item" acima
    setShowTopFade(top > threshold);

    // Só mostra o fade de baixo se tiver pelo menos "um item" abaixo
    setShowBottomFade(max - top > threshold);
  }

  // Inicialização do carrossel
  useEffect(() => {
    if (!scrollRef.current) return;

    if (!isCarousel) {
      setShowTopFade(false);
      setShowBottomFade(false);
      return;
    }

    const el = scrollRef.current;
    const itemHeight = 56;

    const middleIndex = Math.max(0, Math.floor(sortedSlots.length / 2) - 1);
    const target = middleIndex * itemHeight;

    el.scrollTo({ top: target, behavior: "auto" });

    // Garante que o estado inicial dos fades respeite a posição
    requestAnimationFrame(() => {
      handleScroll();
    });
  }, [sortedSlots, isCarousel]);

  return (
    <section id="step-time" className="step">
      {loading ? (
        <div
          className="animate-fade-in-up"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "200px",
          }}
        >
          <ProgressiveBarLoader label="Carregando horários" />
        </div>
      ) : (
        <>
          <label className="label animate-fade-in-down">Escolha um horário:</label>

          {message && (
            <p className="text-gray-300 text-center text-sm mt-2 max-w-xs mx-auto">
              {message}
            </p>
          )}

          <div
            className="time-wrap animate-fade-in-up"
            style={{ position: "relative" }}
          >
            {/* FADES */}
            {isCarousel && showTopFade && (
              <div className="time-fade-mask top"></div>
            )}
            {isCarousel && showBottomFade && (
              <div className="time-fade-mask bottom"></div>
            )}

            <div
              className="time-scroll"
              ref={scrollRef}
              onScroll={isCarousel ? handleScroll : undefined}
              style={{
                maxHeight: isCarousel ? "240px" : "auto",
                overflowY: isCarousel ? "auto" : "visible",
              }}
            >
              <div className="time-list">
                {sortedSlots.length === 0 && (
                  <p className="text-gray-300 text-center text-sm mt-2">
                    Nenhum horário disponível neste dia.
                  </p>
                )}

                {sortedSlots.map((slot) => (
                  <button
                    key={slot}
                    className="time-btn"
                    onClick={() => onSelectTime(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              marginTop: "16px",
            }}
          >
            <button className="liquid-btn back" onClick={back}>
              Voltar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
