import React from "react";

interface Props {
  name: string;
  setName: (v: string) => void;
  next: () => void;
}

export default function StepName({ name, setName, next }: Props) {
  const normalized = name.trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ").filter(Boolean);

  const connectors = new Set(["de", "da", "do", "das", "dos", "e"]);
  const realWords = parts.filter((p) => !connectors.has(p.toLowerCase()));

  const hasTwoRealWords = realWords.length >= 2;
  const allRealWordsOk = realWords.every((w) => w.length >= 2);
  const hasMinLength = normalized.length >= 8;

  const isValid = hasTwoRealWords && allRealWordsOk && hasMinLength;

  return (
    <section id="step-name" className="step">
      {/* ===== BOTÃO HOME FIXO NO TOPO ===== */}
      <div className="step-name-home-wrap w-full grid place-items-center animate-fade-in-up">
        <div className="step-name-home-shell rounded-full flex items-center justify-center">
          <a
            href="https://autohost.shop/"
            rel="noopener noreferrer"
            className="step-name-home-link rounded-full grid place-items-center text-white relative overflow-hidden transition-all duration-200 ease-out"
            aria-label="Voltar para a página inicial"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="step-name-home-icon stroke-white fill-none"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 10.5L12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 19.5v-9z" />
              <path d="M9 21v-6h6v6" />
            </svg>
          </a>
        </div>
      </div>

      {/* ===== LABEL + INPUT ===== */}
      <label
        htmlFor="name"
        className="label step-name-title animate-fade-in-down animation-delay-200"
      >
        Digite seu nome completo:
      </label>

      <div className="field step-name-field" style={{ position: "relative" }}>
        {/* input fantasma */}
        <input
          type="text"
          autoComplete="off"
          tabIndex={-1}
          style={{
            position: "absolute",
            opacity: 0,
            height: 0,
            width: 0,
            pointerEvents: "none",
          }}
        />

        <input
          id="name"
          type="text"
          name="user-fullname"
          autoComplete="off"
          placeholder="Ex: João da Silva"
          className="step-name-input animate-fade-in-up animation-delay-400"
          value={name}
          onChange={(e) => {
            let raw = e.target.value;

            // 1) remove tudo que não for letra, acento ou espaço
            raw = raw.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, "");

            // 2) impede múltiplos espaços seguidos
            raw = raw.replace(/\s{2,}/g, " ");

            // 3) impede espaço no começo
            raw = raw.replace(/^\s+/g, "");

            // 4) limite de caracteres seguro (50)
            raw = raw.slice(0, 50);

            setName(raw);
          }}
        />

        <button
          id="go-name"
          className={`liquid-btn step-name-next animate-fade-in-up animation-delay-600 ${
            isValid ? "enabled" : ""
          }`}
          disabled={!isValid}
          onClick={() => {
            if (isValid) next();
          }}
        >
          Prosseguir
        </button>
      </div>
    </section>
  );
}
