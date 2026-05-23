import { useState, useEffect } from "react";
import { Trash2, ChevronDown } from "lucide-react";
import { type SiteConfig, type CategoryConfig } from "../siteConfig";
import { type Service } from "../services";
import { updateConfig, updateServiceCategories, updateServices, type ConfigChave } from "../api";

type AdminTab = "home" | "categories" | "services";

interface AdminDrawerProps {
  currentConfig: SiteConfig;
  currentServices: Service[];
  onConfigUpdated: (chave: ConfigChave) => void;
  onPreviewConfig?: (val: SiteConfig | null) => void;
  onPreviewFilters?: (val: boolean | null) => void;
  onPreviewServices?: (val: Service[] | null) => void;
}

const TAB_LABELS: Record<AdminTab, string> = {
  home: "Home",
  categories: "Categorias",
  services: "Serviços",
};

const OWNER_EMAIL = ((import.meta as any).env.VITE_OWNER_EMAIL as string | undefined)?.trim().toLowerCase();
const OWNER_PASSWORD = ((import.meta as any).env.VITE_OWNER_PASSWORD as string | undefined)?.trim();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminDrawer({
  currentConfig,
  currentServices,
  onConfigUpdated,
  onPreviewConfig,
  onPreviewFilters,
  onPreviewServices,
}: AdminDrawerProps) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminTab>("home");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Home
  const [heroLine1, setHeroLine1] = useState(currentConfig.heroLine1);
  const [heroName, setHeroName] = useState(currentConfig.heroName);
  const [ctaLabel, setCtaLabel] = useState(currentConfig.ctaLabel);

  // Categories
  const [categories, setCategories] = useState<CategoryConfig[]>([...currentConfig.categories]);
  const [filtersEnabled, setFiltersEnabled] = useState(currentConfig.filtersEnabled ?? false);
  const [newCatLabel, setNewCatLabel] = useState("");

  // Services
  const [services, setServices] = useState<Service[]>([...currentServices]);

  useEffect(() => {
    if (!adminOpen) resetDraftFromCurrent();
  }, [currentConfig, currentServices, adminOpen]);

  useEffect(() => {
    if (!adminOpen) return;
    onPreviewConfig?.({ heroLine1, heroName, ctaLabel, categories, filtersEnabled });
    onPreviewFilters?.(filtersEnabled);
  }, [adminOpen, heroLine1, heroName, ctaLabel, categories, filtersEnabled, onPreviewConfig, onPreviewFilters]);

  useEffect(() => {
    if (!adminOpen) return;
    onPreviewServices?.(services);
  }, [adminOpen, services, onPreviewServices]);

  const [newSvc, setNewSvc] = useState({ name: "", desc: "", price: "", category: "" });
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [editingSvcId, setEditingSvcId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", desc: "", price: "", category: "" });
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Save feedback
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  function resetDraftFromCurrent() {
    setHeroLine1(currentConfig.heroLine1);
    setHeroName(currentConfig.heroName);
    setCtaLabel(currentConfig.ctaLabel);
    setCategories([...currentConfig.categories]);
    setFiltersEnabled(currentConfig.filtersEnabled ?? false);
    setNewCatLabel("");
    setServices([...currentServices]);
    setNewSvc({ name: "", desc: "", price: "", category: "" });
    setExpandedCat(null);
    setEditingSvcId(null);
    setEditForm({ name: "", desc: "", price: "", category: "" });
    setAddOpen(false);
    setRemovingId(null);
  }

  const handleOpen = () => {
    resetDraftFromCurrent();
    setAdminOpen(true);
  };

  const handleLogin = () => {
    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();
    setLoginError("");

    if (!email) {
      setLoginError("Informe o e-mail de acesso.");
      return;
    }

    if (!password) {
      setLoginError("Informe a senha de acesso.");
      return;
    }

    if (!OWNER_EMAIL || !OWNER_PASSWORD) {
      setLoginError("Configure VITE_OWNER_EMAIL e VITE_OWNER_PASSWORD no ambiente do site.");
      return;
    }

    if (email !== OWNER_EMAIL || password !== OWNER_PASSWORD) {
      setLoginError("E-mail ou senha incorretos.");
      return;
    }

    setAdminLoggedIn(true);
    setLoginPassword("");
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (adminOpen) return;

      const key = event.key.toLowerCase();
      const shouldOpen = event.ctrlKey && !event.altKey && !event.shiftKey && key === "p";

      if (shouldOpen) {
        event.preventDefault();
        handleOpen();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [adminOpen, currentConfig, currentServices]);

  const handleClose = () => {
    setAdminOpen(false);
    resetDraftFromCurrent();
    setLoginError("");
    setLoginPassword("");
    onPreviewConfig?.(null);
    onPreviewFilters?.(null);
    onPreviewServices?.(null);
  };

  const activeCategories = categories.filter((c) => c.active);
  const uncategorizedServices = services.filter(
    (s) => !categories.some((c) => c.id === s.category)
  );
  const isServiceDraftValid = (service: { name: string; desc: string; category: string }) =>
    Boolean(
      service.name.trim() &&
      service.desc.trim() &&
      service.category &&
      categories.some((c) => c.id === service.category),
    );

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const invalidService = services.find((service) => !isServiceDraftValid(service));
      if (invalidService) {
        setSaveMsg("Todos os serviÃ§os precisam de nome, descriÃ§Ã£o e categoria.");
        setSaving(false);
        setTimeout(() => setSaveMsg(""), 3500);
        return;
      }

      await Promise.all([
        updateConfig("home", { heroLine1, heroName, ctaLabel }),
        updateServiceCategories({ filtersEnabled, items: categories }),
        updateServices(services),
      ]);
      (["home", "categorias", "servicos"] as ConfigChave[]).forEach(onConfigUpdated);
      onPreviewConfig?.(null);
      onPreviewFilters?.(null);
      onPreviewServices?.(null);
      setSaveMsg("Salvo com sucesso!");
    } catch {
      setSaveMsg("Erro ao salvar. Servidor está rodando?");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 3500);
    }
  };

  const addCategory = () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = slugify(label);
    if (categories.some((c) => c.id === id)) return;
    setCategories((prev) => [...prev, { id, label, active: true }]);
    setNewCatLabel("");
  };

  const updateCategory = (index: number, patch: Partial<CategoryConfig>) => {
    setCategories((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const addService = () => {
    const { name, desc, price, category } = newSvc;
    if (!name.trim() || !desc.trim() || !category) return;
    setServices((prev) => [
      ...prev,
      { id: -Date.now(), slug: slugify(name), name: name.trim(), desc: desc.trim(), price: price.trim(), category },
    ]);
    setNewSvc({ name: "", desc: "", price: "", category: "" });
    setAddOpen(false);
    setExpandedCat(category);
  };

  const updateService = (index: number, patch: { name: string; desc: string; price: string; category: string }) => {
    setServices((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, ...patch, slug: slugify(patch.name) } : s
      )
    );
  };

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      {adminOpen && (
        <div className="admin-layer" aria-label="Painel administrativo">
          <button
            type="button"
            className="admin-scrim"
            aria-label="Fechar painel"
            onClick={handleClose}
          />

          <aside className="admin-drawer">
            <div className="admin-head">
              <div>
                <p className="admin-kicker">Painel</p>
                <h2>Configuração visual</h2>
              </div>
              <button
                type="button"
                className="admin-close"
                aria-label="Fechar painel"
                onClick={handleClose}
              >
                ×
              </button>
            </div>

            {!adminLoggedIn ? (
              <div className="admin-login">
                <label>
                  Usuário ou e-mail
                  <input
                    type="email"
                    placeholder="admin@barbearia.com"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (loginError) setLoginError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLogin();
                    }}
                  />
                </label>
                <label>
                  Senha
                  <input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginError) setLoginError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLogin();
                    }}
                  />
                </label>
                {loginError && <p className="admin-note">{loginError}</p>}
                <button
                  type="button"
                  className="admin-primary"
                  onClick={handleLogin}
                >
                  Entrar
                </button>
                <p className="admin-note">
                  Use o mesmo acesso do calendário administrativo.
                </p>
              </div>
            ) : (
              <div className="admin-panel">
                <div className="admin-tabs">
                  {(Object.keys(TAB_LABELS) as AdminTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={adminTab === tab ? "active" : ""}
                      onClick={() => setAdminTab(tab)}
                    >
                      {TAB_LABELS[tab]}
                    </button>
                  ))}
                </div>

                {/* ── HOME ── */}
                {adminTab === "home" && (
                  <div className="admin-section">
                    <label>
                      Texto superior
                      <input
                        type="text"
                        value={heroLine1}
                        onChange={(e) => setHeroLine1(e.target.value)}
                      />
                    </label>
                    <label>
                      Nome da barbearia
                      <input
                        type="text"
                        value={heroName}
                        onChange={(e) => setHeroName(e.target.value)}
                      />
                    </label>
                    <label>
                      Botão principal
                      <input
                        type="text"
                        value={ctaLabel}
                        onChange={(e) => setCtaLabel(e.target.value)}
                      />
                    </label>
                  </div>
                )}

                {/* ── CATEGORIAS ── */}
                {adminTab === "categories" && (
                  <div className="admin-section">
                    {/* Toggle principal */}
                    <div className="admin-filter-row">
                      <span className="admin-filter-label">Filtro de categorias no site</span>
                      <button
                        type="button"
                        className={`admin-toggle-switch${filtersEnabled ? " on" : ""}`}
                        onClick={() => {
                          const next = !filtersEnabled;
                          setFiltersEnabled(next);
                          onPreviewFilters?.(next);
                        }}
                        aria-pressed={filtersEnabled}
                        aria-label={`Filtro de categorias: ${filtersEnabled ? "ativado" : "desativado"}`}
                      >
                        <span className="admin-toggle-track">
                          <span className="admin-toggle-thumb" />
                        </span>
                        <span className="admin-toggle-text">
                          {filtersEnabled ? "Ativado" : "Desativado"}
                        </span>
                      </button>
                    </div>

                    {/* Lista de categorias */}
                    <div className={`admin-list${!filtersEnabled ? " filter-disabled" : ""}`}>
                      {categories.map((cat, i) => (
                        <div className="admin-cat-row" key={cat.id}>
                          <div className="admin-input-with-action">
                            <input
                              type="text"
                              value={cat.label}
                              onChange={(e) => updateCategory(i, { label: e.target.value })}
                            />
                            <button
                              type="button"
                              className="admin-cat-delete"
                              aria-label={`Remover ${cat.label}`}
                              onClick={() => removeCategory(i)}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                          <button
                            type="button"
                            className={`admin-toggle-switch mini${cat.active ? " on" : ""}`}
                            onClick={() => updateCategory(i, { active: !cat.active })}
                            aria-pressed={cat.active}
                            aria-label={cat.active ? `Desativar "${cat.label}"` : `Ativar "${cat.label}"`}
                          >
                            <span className="admin-toggle-track">
                              <span className="admin-toggle-thumb" />
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Adicionar categoria */}
                    <div className="admin-row admin-add-row">
                      <input
                        type="text"
                        placeholder="Nova categoria…"
                        value={newCatLabel}
                        onChange={(e) => setNewCatLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
                      />
                      <button type="button" className="admin-secondary" onClick={addCategory}>
                        + Adicionar
                      </button>
                    </div>
                  </div>
                )}

                {/* ── SERVIÇOS ── */}
                {adminTab === "services" && (
                  <div className="admin-section">
                    {categories.map((cat) => {
                      const catServices = services.filter((s) => s.category === cat.id);
                      const isOpen = expandedCat === cat.id;
                      return (
                        <div key={cat.id} className="admin-cat-block">
                          <button
                            type="button"
                            className={`admin-cat-header${isOpen ? " open" : ""}`}
                            onClick={() => {
                              setExpandedCat(isOpen ? null : cat.id);
                              setEditingSvcId(null);
                              setRemovingId(null);
                            }}
                          >
                            <span className="admin-cat-label">{cat.label}</span>
                            <span className="admin-cat-meta">
                              <span className="admin-cat-count">{catServices.length}</span>
                              <ChevronDown
                                size={16}
                                className={`admin-cat-chevron${isOpen ? " open" : ""}`}
                                aria-hidden="true"
                              />
                            </span>
                          </button>

                          {isOpen && (
                            <div className="admin-svc-list">
                              {catServices.length === 0 && (
                                <p className="admin-empty">Nenhum serviço nesta categoria.</p>
                              )}
                              {catServices.map((svc) => {
                                const svcIdx = services.findIndex((s) => s.id === svc.id);
                                const isEditing = editingSvcId === svc.id;
                                return (
                                  <div key={svc.id}>
                                    {isEditing ? (
                                      <div className="admin-svc-edit">
                                        <label>
                                          Nome
                                          <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                                          />
                                        </label>
                                        <div className="admin-grid">
                                          <label>
                                            Preço
                                            <div className="price-input-wrapper">
                                              <span className="price-prefix">R$</span>
                                              <input
                                                type="text"
                                                value={editForm.price}
                                                onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                                                placeholder="45"
                                              />
                                            </div>
                                          </label>
                                          <label>
                                            Categoria
                                            <select
                                              value={editForm.category}
                                              onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                                            >
                                              {categories.map((c) => (
                                                <option key={c.id} value={c.id}>{c.label}</option>
                                              ))}
                                            </select>
                                          </label>
                                        </div>
                                        <label>
                                          Descrição
                                          <textarea
                                            ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                                            value={editForm.desc}
                                            rows={1}
                                            placeholder="Ex: Corte com tesoura e acabamento"
                                            style={{ resize: "none", overflow: "hidden" }}
                                            onChange={(e) => {
                                              setEditForm((p) => ({ ...p, desc: e.target.value }));
                                              e.target.style.height = "auto";
                                              e.target.style.height = e.target.scrollHeight + "px";
                                            }}
                                          />
                                        </label>
                                        <div className="admin-svc-edit-actions">
                                          {!isServiceDraftValid(editForm) && (
                                            <p className="admin-note">
                                              Nome, descriÃ§Ã£o e categoria sÃ£o obrigatÃ³rios.
                                            </p>
                                          )}
                                          <button
                                            type="button"
                                            className="admin-ghost"
                                            onClick={() => setEditingSvcId(null)}
                                          >
                                            Cancelar
                                          </button>
                                          <button
                                            type="button"
                                            className="admin-secondary"
                                            disabled={!isServiceDraftValid(editForm)}
                                            onClick={() => {
                                              const newCat = editForm.category;
                                              updateService(svcIdx, editForm);
                                              setEditingSvcId(null);
                                              if (newCat !== cat.id) setExpandedCat(newCat);
                                            }}
                                          >
                                            Confirmar
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="admin-svc-row">
                                        <div className="admin-svc-info">
                                          <span className="admin-svc-name">{svc.name}</span>
                                          <span className="admin-svc-price">{svc.price ? `R$ ${svc.price}` : ""}</span>
                                        </div>
                                        {removingId === svc.id ? (
                                          <div className="admin-svc-btns admin-confirm-btns">
                                            <span className="admin-confirm-text">Remover?</span>
                                            <button
                                              type="button"
                                              className="admin-ghost admin-confirm-btn"
                                              onClick={() => setRemovingId(null)}
                                            >
                                              Não
                                            </button>
                                            <button
                                              type="button"
                                              className="admin-secondary admin-confirm-btn admin-confirm-yes"
                                              onClick={() => { removeService(svcIdx); setRemovingId(null); }}
                                            >
                                              Sim
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="admin-svc-btns">
                                            <button
                                              type="button"
                                              className="admin-secondary"
                                              onClick={() => {
                                                setEditingSvcId(svc.id);
                                                setRemovingId(null);
                                                setEditForm({ name: svc.name, desc: svc.desc, price: svc.price, category: svc.category });
                                              }}
                                            >
                                              Editar
                                            </button>
                                            <button
                                              type="button"
                                              className="admin-remove"
                                              aria-label={`Remover ${svc.name}`}
                                              onClick={() => { setRemovingId(svc.id); setEditingSvcId(null); }}
                                            >
                                              <Trash2 size={13} aria-hidden="true" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* ── SEM CATEGORIA ── */}
                    {uncategorizedServices.length > 0 && (() => {
                      const isOrphanOpen = expandedCat === "__orphan__";
                      return (
                        <div className="admin-cat-block orphan">
                          <button
                            type="button"
                            className={`admin-cat-header orphan${isOrphanOpen ? " open" : ""}`}
                            onClick={() => {
                              setExpandedCat(isOrphanOpen ? null : "__orphan__");
                              setEditingSvcId(null);
                              setRemovingId(null);
                            }}
                          >
                            <span className="admin-cat-label">Sem categoria</span>
                            <span className="admin-cat-meta">
                              <span className="admin-cat-count orphan">{uncategorizedServices.length}</span>
                              <ChevronDown
                                size={16}
                                className={`admin-cat-chevron${isOrphanOpen ? " open" : ""}`}
                                aria-hidden="true"
                              />
                            </span>
                          </button>

                          {isOrphanOpen && (
                            <div className="admin-svc-list">
                              {uncategorizedServices.map((svc) => {
                                const svcIdx = services.findIndex((s) => s.id === svc.id);
                                const isEditing = editingSvcId === svc.id;
                                return (
                                  <div key={svc.id}>
                                    {isEditing ? (
                                      <div className="admin-svc-edit">
                                        <label>
                                          Nome
                                          <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                                          />
                                        </label>
                                        <div className="admin-grid">
                                          <label>
                                            Preço
                                            <div className="price-input-wrapper">
                                              <span className="price-prefix">R$</span>
                                              <input
                                                type="text"
                                                value={editForm.price}
                                                onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                                                placeholder="45"
                                              />
                                            </div>
                                          </label>
                                          <label>
                                            Categoria
                                            <select
                                              value={editForm.category}
                                              onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                                            >
                                              <option value="">Sem categoria</option>
                                              {categories.map((c) => (
                                                <option key={c.id} value={c.id}>{c.label}</option>
                                              ))}
                                            </select>
                                          </label>
                                        </div>
                                        <label>
                                          Descrição
                                          <textarea
                                            ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                                            value={editForm.desc}
                                            rows={1}
                                            placeholder="Ex: Corte com tesoura e acabamento"
                                            style={{ resize: "none", overflow: "hidden" }}
                                            onChange={(e) => {
                                              setEditForm((p) => ({ ...p, desc: e.target.value }));
                                              e.target.style.height = "auto";
                                              e.target.style.height = e.target.scrollHeight + "px";
                                            }}
                                          />
                                        </label>
                                        <div className="admin-svc-edit-actions">
                                          {!isServiceDraftValid(editForm) && (
                                            <p className="admin-note">
                                              Nome, descriÃ§Ã£o e categoria sÃ£o obrigatÃ³rios.
                                            </p>
                                          )}
                                          <button
                                            type="button"
                                            className="admin-ghost"
                                            onClick={() => setEditingSvcId(null)}
                                          >
                                            Cancelar
                                          </button>
                                          <button
                                            type="button"
                                            className="admin-secondary"
                                            disabled={!isServiceDraftValid(editForm)}
                                            onClick={() => {
                                              const newCat = editForm.category;
                                              updateService(svcIdx, editForm);
                                              setEditingSvcId(null);
                                              if (newCat) setExpandedCat(newCat);
                                            }}
                                          >
                                            Confirmar
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="admin-svc-row">
                                        <div className="admin-svc-info">
                                          <span className="admin-svc-name">{svc.name}</span>
                                          <span className="admin-svc-price">{svc.price ? `R$ ${svc.price}` : ""}</span>
                                        </div>
                                        {removingId === svc.id ? (
                                          <div className="admin-svc-btns admin-confirm-btns">
                                            <span className="admin-confirm-text">Remover?</span>
                                            <button
                                              type="button"
                                              className="admin-ghost admin-confirm-btn"
                                              onClick={() => setRemovingId(null)}
                                            >
                                              Não
                                            </button>
                                            <button
                                              type="button"
                                              className="admin-secondary admin-confirm-btn admin-confirm-yes"
                                              onClick={() => { removeService(svcIdx); setRemovingId(null); }}
                                            >
                                              Sim
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="admin-svc-btns">
                                            <button
                                              type="button"
                                              className="admin-secondary"
                                              onClick={() => {
                                                setEditingSvcId(svc.id);
                                                setRemovingId(null);
                                                setEditForm({ name: svc.name, desc: svc.desc, price: svc.price, category: svc.category });
                                              }}
                                            >
                                              Editar
                                            </button>
                                            <button
                                              type="button"
                                              className="admin-remove"
                                              aria-label={`Remover ${svc.name}`}
                                              onClick={() => { setRemovingId(svc.id); setEditingSvcId(null); }}
                                            >
                                              <Trash2 size={13} aria-hidden="true" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="admin-add-inline">
                      <button
                        type="button"
                        className="admin-add-inline-btn"
                        onClick={() => setAddOpen((p) => !p)}
                      >
                        <span>+ Adicionar serviço</span>
                        <ChevronDown
                          size={14}
                          className={`admin-cat-chevron${addOpen ? " open" : ""}`}
                          aria-hidden="true"
                        />
                      </button>

                      {addOpen && (
                        <div className="admin-service-form admin-add-inline-form">
                          <label>
                            Nome
                            <input
                              type="text"
                              value={newSvc.name}
                              onChange={(e) => setNewSvc((p) => ({ ...p, name: e.target.value }))}
                              placeholder="Ex: Corte Tradicional"
                            />
                          </label>
                          <label>
                            Descrição
                            <textarea
                              value={newSvc.desc}
                              rows={1}
                              style={{ resize: "none", overflow: "hidden" }}
                              placeholder="Ex: Corte com tesoura e acabamento"
                              onChange={(e) => {
                                setNewSvc((p) => ({ ...p, desc: e.target.value }));
                                e.target.style.height = "auto";
                                e.target.style.height = e.target.scrollHeight + "px";
                              }}
                            />
                          </label>
                          <div className="admin-grid">
                            <label>
                              Preço
                              <div className="price-input-wrapper">
                                <span className="price-prefix">R$</span>
                                <input
                                  type="text"
                                  value={newSvc.price}
                                  onChange={(e) => setNewSvc((p) => ({ ...p, price: e.target.value }))}
                                  placeholder="45"
                                />
                              </div>
                            </label>
                            <label>
                              Categoria
                              <select
                                value={newSvc.category}
                                onChange={(e) => setNewSvc((p) => ({ ...p, category: e.target.value }))}
                              >
                                <option value="">Escolha uma categoria</option>
                                {activeCategories.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          {(!newSvc.name.trim() || !newSvc.desc.trim() || !newSvc.category) && (
                            <p className="admin-note" style={{ textAlign: "center" }}>
                              {!newSvc.name.trim()
                                ? "Preencha o nome do serviço"
                                : !newSvc.desc.trim()
                                ? "Preencha a descrição"
                                : "Escolha uma categoria para continuar"}
                            </p>
                          )}
                          <button
                            type="button"
                            className="admin-secondary"
                            onClick={addService}
                            disabled={!newSvc.name.trim() || !newSvc.desc.trim() || !newSvc.category}
                          >
                            + Adicionar serviço
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="admin-actions">
                  {saveMsg && <p className="admin-note">{saveMsg}</p>}
                  <button
                    type="button"
                    className="admin-ghost"
                    onClick={handleClose}
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    className="admin-primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
