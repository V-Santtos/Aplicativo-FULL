import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { ProgressiveBarLoader } from "./GlobalLoading";
import type { AvailableDay } from "../api";

interface StepCalendarProps {
  monthTitle: string;
  week: string[];
  days: { date: string; isCurrentMonth: boolean; disabled?: boolean }[];
  back: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (date: string) => void;
  availableDays?: AvailableDay[];
  availableDaysLoading?: boolean;
  availableDaysMessage?: string | null;
  availableDaysError?: boolean;
  disabledDates?: string[];
  workSlots?: string[];
}

// ─── helpers ──────────────────────────────────────────────────────────────

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDateToISO(dateValue: string | null | undefined): string | null {
  if (!dateValue) return null;
  const trimmed = String(dateValue).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return toLocalISO(parsed);
  return null;
}

function getDayNumber(dateStr: string): number {
  const parts = dateStr.split("-");
  return Number(parts[2] ?? "1");
}

function getWeekday(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatDateCard(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  const todayIso = toLocalISO(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(new Date().getDate() + 1);
  const tomorrowIso = toLocalISO(tomorrow);

  return {
    day: String(day).padStart(2, "0"),
    weekday: date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
    month: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    relative: dateStr === todayIso ? "Hoje" : dateStr === tomorrowIso ? "Amanhã" : null,
    ariaLabel: new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date),
  };
}

function availabilityToneKey(day: AvailableDay): "open" | "medium" | "high" {
  if (day.occupancyRatio >= 0.75) return "high";
  if (day.occupancyRatio >= 0.45) return "medium";
  return "open";
}

function toneBarColor(tone: "open" | "medium" | "high"): string {
  if (tone === "high") return "rgba(255, 120, 155, 0.85)";
  if (tone === "medium") return "rgba(255, 198, 92, 0.85)";
  return "rgba(141, 255, 178, 0.85)";
}

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ─── componente principal ──────────────────────────────────────────────────

export default function StepCalendar({
  monthTitle,
  week,
  days,
  back,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
  availableDays = [],
  availableDaysLoading = false,
  availableDaysMessage = null,
  availableDaysError = false,
  disabledDates = [],
  workSlots = [],
}: StepCalendarProps) {
  const todayIso = toLocalISO(new Date());
  const currentMonthDate = days.find((d) => d.isCurrentMonth && d.date)?.date;
  const currentMonthKey = currentMonthDate?.slice(0, 7);
  const todayMonthKey = todayIso.slice(0, 7);
  const monthInPast = !!currentMonthKey && currentMonthKey < todayMonthKey;
  const showAvailabilityCards = availableDays.length > 0;

  const disabledSet = new Set(
    disabledDates.map((x) => normalizeDateToISO(x)).filter(Boolean) as string[],
  );

  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todayHasFutureSlots =
    workSlots.length === 0 ? true : workSlots.some((s) => s > currentHHMM);

  // ── carrossel state-driven ─────────────────────────────────────────────
  const [startIdx, setStartIdx] = useState(0);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLLabelElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const maxStartIdx = Math.max(0, availableDays.length - 2);

  // resetar para o primeiro card quando os dados chegam
  useEffect(() => {
    setStartIdx(0);
  }, [availableDays]);

  // oculta título/subtítulo/voltar antes do paint quando o conteúdo aparece
  useLayoutEffect(() => {
    if (availableDaysLoading || REDUCED_MOTION) return;
    if (titleRef.current)  gsap.set(titleRef.current,  { opacity: 0, y: -20 });
    if (headerRef.current) gsap.set(headerRef.current, { opacity: 0, y: -12 });
    if (backRef.current)   gsap.set(backRef.current,   { opacity: 0, y: 8 });
  }, [availableDaysLoading]);

  // anima título → subtítulo → voltar após o loading terminar
  useEffect(() => {
    if (availableDaysLoading || REDUCED_MOTION) return;

    const tl = gsap.timeline();

    if (titleRef.current) {
      tl.fromTo(
        titleRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.75, ease: "power2.out" },
      );
    }

    if (headerRef.current) {
      tl.fromTo(
        headerRef.current,
        { opacity: 0, y: -12 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
        "-=0.25",
      );
    }

    if (backRef.current) {
      tl.fromTo(
        backRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
        "+=0.1",
      );
    }

    return () => { tl.kill(); };
  }, [availableDaysLoading]);

  function handleNav(dir: 1 | -1) {
    setStartIdx((current) => Math.max(0, Math.min(maxStartIdx, current + dir)));
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy)) return;
    handleNav(dx < 0 ? 1 : -1);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dx > dy) e.preventDefault();
  }

  function handleCardClick(idx: number, date: string) {
    const visibleOffset = idx - startIdx;
    if (visibleOffset < 0 || visibleOffset > 2) return;
    onSelectDay(date);
  }

  function cardPosition(idx: number): "center" | "near" | "far" | "hidden" {
    const diff = idx - startIdx;
    if (diff === 0) return "center";
    if (diff === 1) return "near";
    if (diff === 2) return "far";
    return "hidden";
  }

  // ── render ─────────────────────────────────────────────────────────────

  return (
    <section id="step-schedule" className="step">
      {availableDaysLoading ? (
        <div
          className="animate-fade-in-up"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "260px" }}
        >
          <ProgressiveBarLoader label="Carregando calendário" />
        </div>
      ) : (
        <>
          <label ref={titleRef} className="label calendar-title">Escolha o melhor dia</label>

          {showAvailabilityCards ? (
            <div className="date-carousel-outer">
              <div className="date-carousel-header" ref={headerRef}>
                <svg className="date-carousel-header__icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1" y="2.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M1 6.5h14" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span className="date-carousel-header__accent">
                  {availableDays.length} dias disponíveis
                </span>
                <span className="date-carousel-header__rest"> para agendamento</span>
              </div>

              <div className="date-carousel-row" role="list">
                <button
                  type="button"
                  className="date-nav-btn"
                  onClick={() => handleNav(-1)}
                  disabled={startIdx === 0}
                  aria-label="Ver data anterior"
                >
                  ‹
                </button>

                <div
                  className="date-carousel-viewport"
                  ref={viewportRef}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchMove}
                >
                  <div
                    className="date-carousel-track"
                    style={{ transform: `translateX(calc(${startIdx} * -1 * var(--carousel-step)))` }}
                  >
                    {availableDays.map((availableDay, idx) => {
                      const pos = cardPosition(idx);
                      const dateParts = formatDateCard(availableDay.date);
                      const tone = availabilityToneKey(availableDay);
                      const isHidden = pos === "hidden";
                      const isFar = pos === "far";

                      return (
                        <button
                          key={availableDay.date}
                          type="button"
                          role="listitem"
                          className={cn("date-card", `date-card--${pos}`)}
                          onClick={() => handleCardClick(idx, availableDay.date)}
                          aria-label={`${dateParts.ariaLabel}, ${availableDay.availableSlotsCount} horários disponíveis`}
                          aria-hidden={isHidden || isFar ? "true" : undefined}
                          tabIndex={isHidden || isFar ? -1 : 0}
                        >
                          <span className="date-card__weekday">
                            {dateParts.relative ?? dateParts.weekday}
                          </span>
                          <span className="date-card__day">{dateParts.day}</span>
                          <span className="date-card__month">{dateParts.month}</span>
                          <div className="date-card__bar-wrap">
                            <div
                              className="date-card__bar-fill"
                              style={{
                                width: `${Math.round(availableDay.occupancyRatio * 100)}%`,
                                background: toneBarColor(tone),
                              }}
                            />
                          </div>
                          <div className="date-card__slots">
                            <span
                              className={cn(
                                "date-card__slots-count",
                                tone === "medium" && "date-card__slots-count--medium",
                                tone === "high" && "date-card__slots-count--high",
                              )}
                            >
                              {availableDay.availableSlotsCount} horários
                            </span>
                            <span className="date-card__slots-label">disponíveis</span>
                          </div>
                          {availableDay.firstSlot && (
                            <div className="date-card__next">
                              <span className="date-card__next-label">Próximo horário livre</span>
                              <span className="date-card__next-time">{availableDay.firstSlot}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  className="date-nav-btn"
                  onClick={() => handleNav(1)}
                  disabled={startIdx === maxStartIdx}
                  aria-label="Ver próxima data"
                >
                  ›
                </button>
              </div>
            </div>
          ) : availableDaysMessage && !availableDaysError ? (
            <div className="availability-empty animate-fade-in-up">
              <p>{availableDaysMessage}</p>
            </div>
          ) : (
            <>
              {availableDaysMessage && (
                <div className="availability-warning">
                  <p>{availableDaysMessage}</p>
                </div>
              )}

              <div className="calendar">
                <div className="cal-head">
                  <button id="cal-prev" type="button" className="cal-nav" onClick={onPrevMonth}>
                    <span className="cal-arrow">‹</span>
                  </button>
                  <div id="cal-title" className="cal-title-strong">{monthTitle}</div>
                  <button id="cal-next" type="button" className="cal-nav" onClick={onNextMonth}>
                    <span className="cal-arrow">›</span>
                  </button>
                </div>

                <div id="cal-week" className="cal-grid">
                  {week.map((d) => (
                    <div key={d} className="week-day">{d}</div>
                  ))}
                </div>

                <div id="cal-days" className="cal-grid">
                  {days.map((d, index) => {
                    const hasDate = !!d.date;
                    const isSunday = hasDate && getWeekday(d.date) === 0;
                    const isBlockedByN8n = hasDate ? disabledSet.has(d.date) : false;
                    const isToday = hasDate && d.date === todayIso;
                    const isBlockedTodayByTime = isToday && !todayHasFutureSlots;
                    const isDisabled =
                      !hasDate || !!d.disabled || isBlockedByN8n || isBlockedTodayByTime;

                    let label: React.ReactNode = "";
                    let isXMark = false;
                    if (hasDate) {
                      const isPast = d.date < todayIso;
                      const dayNumber = getDayNumber(d.date);
                      const shouldShowX = isDisabled && isPast && (monthInPast || !d.isCurrentMonth);
                      isXMark = shouldShowX;
                      label = shouldShowX ? "╳" : dayNumber;
                    }

                    const baseClass = `day-cell ${d.isCurrentMonth ? "current-month" : "other-month"} ${isSunday ? "day-sunday" : ""} ${isDisabled ? "day-disabled" : ""} ${isToday ? "day-today" : ""} ${isXMark ? "x-mark" : ""}`;

                    const ariaLabel = hasDate
                      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
                          new Date(Number(d.date.split("-")[0]), Number(d.date.split("-")[1]) - 1, Number(d.date.split("-")[2]), 12)
                        )
                      : undefined;

                    return (
                      <button
                        key={index}
                        type="button"
                        className={baseClass}
                        style={isDisabled ? { color: label === "╳" ? "#9E72FF" : undefined } : undefined}
                        disabled={isDisabled}
                        onClick={!isDisabled && hasDate ? () => onSelectDay(d.date) : undefined}
                        aria-label={ariaLabel}
                        aria-hidden={!hasDate ? "true" : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div ref={backRef} style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}>
            <button id="back-to-pro" className="liquid-btn back cal-back-btn" onClick={back}>
              Voltar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
