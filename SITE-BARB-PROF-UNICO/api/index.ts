// api/index.ts
// Camada de integração com a API própria da barbearia.
// Substitui n8n.ts e calendarApi.ts.
//
// Variável de ambiente esperada:
//   VITE_API_BASE_URL=http://localhost:4000/api   (ou URL da VPS em produção)

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
const ADMIN_API_TOKEN = (import.meta.env.VITE_ADMIN_API_TOKEN ?? "").trim();

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface Professional {
  id: number | string;
  nome: string;
  cor: string | null;
  ativo: boolean;
}

export interface CalendarEvent {
  id: number;
  telefone: string | null;
  cliente: string | null;
  profissional: string | null;
  servico: string | null;
  dia_marcado: string;   // "2025-12-03"
  hora_marcada: string;  // "09:00"
  status: string | null;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AgendaConfig {
  profissional_id: number;
  dias_semana: number[];   // 0=Dom … 6=Sáb
  hora_inicio: string;     // "08:00"
  hora_fim: string;        // "19:00"
  duracao_min: number;
  intervalo_inicio: string | null;
  intervalo_duracao_min: number | null;
  janela_agendamento_dias: number;
  atualizado_em: string | null;
}

export interface AvailableDay {
  date: string;
  availableSlotsCount: number;
  totalSlotsCount: number;
  occupancyRatio: number;
  firstSlot?: string | null;
}

export interface AvailableDaysResponse {
  professionalId: number;
  days: number;
  openDays: AvailableDay[];
  disabledDays: string[];
}

export interface DiaBloqueado {
  id: number;
  data: string;            // "YYYY-MM-DD"
  motivo: string | null;
  periodos: Array<"morning" | "afternoon" | "night"> | null;
  created_at: string;
}

export interface CheckPhoneResponse {
  exists: boolean;
  servico?: string;
  barbeiro?: string;
  data?: string;
  horario?: string;
  source?: string | null;
}

export interface CreateBookingPayload {
  telefone: string;
  cliente: string;
  profissional: string;
  servico: string;
  dia_marcado: string;  // "2025-12-20"
  hora_marcada: string; // "15:00"
  status?: string;
  source?: string;
}

export interface CreateBookingResponse {
  id?: number;
  message?: string;
  mensagem?: string;
  status?: string;
  event?: CalendarEvent;
  [key: string]: any;
}

export interface CategoryConfigDto {
  id: string;
  label: string;
  active: boolean;
}

export interface ServiceDto {
  id: number;
  slug: string;
  category: string;
  name: string;
  desc: string;
  price: string;
}

// ─── Cliente HTTP ─────────────────────────────────────────────────────────

type ApiOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

function shouldAttachAdminToken(path: string, options: RequestInit) {
  const normalizedPath = path.replace(/^\/+/, "");
  const method = String(options.method ?? "GET").toUpperCase();
  if (method !== "GET" && normalizedPath !== "agendamentos") return true;
  return normalizedPath === "agendamentos" || normalizedPath.startsWith("agendamentos?");
}

async function callApi<T = any>(
  path: string,
  options: RequestInit & ApiOptions = {},
): Promise<T> {
  const { timeoutMs = 8000, signal: externalSignal, ...fetchOptions } = options;
  const { headers, ...requestOptions } = fetchOptions;
  const attachAdminToken = ADMIN_API_TOKEN && shouldAttachAdminToken(path, fetchOptions);

  const url = `${API_BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromExternal = () => controller.abort();

  try {
    if (externalSignal?.aborted) controller.abort();
    else if (externalSignal) {
      externalSignal.addEventListener("abort", abortFromExternal, { once: true });
    }

    const res = await fetch(url, {
      ...requestOptions,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(attachAdminToken ? { Authorization: `Bearer ${ADMIN_API_TOKEN}` } : {}),
        ...(headers ?? {}),
      },
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => "");

    if (!res.ok) {
      const msg =
        (body as any)?.message ??
        (body as any)?.error ??
        (typeof body === "string" ? body : "");
      throw new Error(msg || `Erro na API (HTTP ${res.status})`);
    }

    return body as T;
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("api-timeout");
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromExternal);
    }
  }
}

// ─── Telefone / Clientes ──────────────────────────────────────────────────

/** Verifica se um telefone já possui agendamento ativo. */
export async function checkPhone(
  phone: string,
  options?: ApiOptions,
): Promise<CheckPhoneResponse> {
  return callApi<CheckPhoneResponse>(
    `agendamentos/verificar-telefone?phone=${encodeURIComponent(phone)}`,
    { method: "GET", ...options },
  );
}

// ─── Profissionais ────────────────────────────────────────────────────────

/** Retorna a lista de profissionais ativos. */
export async function getProfessionals(): Promise<Professional[]> {
  const data = await callApi<
    { professionals?: Professional[] } | Professional[]
  >("profissionais", { method: "GET" });

  const list = Array.isArray(data)
    ? data
    : ((data as any).professionals ?? []);

  return (list as Professional[]).filter((p) => p.ativo !== false);
}

/**
 * Retorna os dias bloqueados na agenda de um profissional.
 * Resposta esperada: { DisableDays: string[] } ou equivalente.
 */
export async function getProfessionalSchedule(
  professionalId: string | number,
  options?: ApiOptions,
): Promise<any> {
  return callApi(
    `profissionais/${encodeURIComponent(String(professionalId))}/agenda`,
    { method: "GET", ...options },
  );
}

// ─── Agendamentos ─────────────────────────────────────────────────────────

/**
 * Retorna todos os eventos de um profissional.
 * Usado para calcular dias/horários indisponíveis no calendário.
 */
export async function getEventsByProfessional(
  professionalId: string | number,
): Promise<CalendarEvent[]> {
  const data = await callApi<{ events?: CalendarEvent[] } | CalendarEvent[]>(
    `agendamentos?professionalId=${encodeURIComponent(String(professionalId))}`,
    { method: "GET" },
  );

  if (Array.isArray(data)) return data;
  return (data as any).events ?? [];
}

/**
 * Retorna os horários disponíveis para um profissional em uma data.
 * A resposta deve ser compatível com extractAvailableSlots() em Regras/.
 */
export async function getAvailableSlots(
  professionalId: string | number,
  date: string,
  options?: ApiOptions,
): Promise<any> {
  return callApi(
    `agendamentos/horarios-disponiveis?professionalId=${encodeURIComponent(String(professionalId))}&date=${encodeURIComponent(date)}`,
    { method: "GET", ...options },
  );
}

// ─── Agenda por profissional ──────────────────────────────────────────────

/** Retorna a configuração de agenda de um profissional (dias/horários/duração). */
/** Retorna os próximos dias com pelo menos um horário disponível. */
export async function getAvailableDays(
  professionalId: string | number,
  days = 10,
  options?: ApiOptions,
): Promise<AvailableDaysResponse> {
  const data = await callApi<AvailableDaysResponse>(
    `agendamentos/dias-disponiveis?professionalId=${encodeURIComponent(String(professionalId))}&days=${encodeURIComponent(String(days))}`,
    { method: "GET", ...options },
  );

  const openDays = (data.openDays ?? []).map((day: any) => {
    const availableSlotsCount = Number(day.availableSlotsCount ?? 0);
    const totalSlotsCount = Math.max(
      Number(day.totalSlotsCount ?? availableSlotsCount),
      availableSlotsCount,
    );
    const rawOccupancy =
      typeof day.occupancyRatio === "number"
        ? day.occupancyRatio
        : totalSlotsCount
          ? 1 - availableSlotsCount / totalSlotsCount
          : 1;

    return {
      date: String(day.date),
      availableSlotsCount,
      totalSlotsCount,
      occupancyRatio: Math.min(Math.max(rawOccupancy, 0), 1),
      firstSlot: day.firstSlot ?? null,
    };
  });

  return {
    professionalId: Number(data.professionalId ?? professionalId),
    days: Number(data.days ?? days),
    openDays,
    disabledDays: Array.isArray(data.disabledDays) ? data.disabledDays : [],
  };
}

export async function getAgendaConfig(
  professionalId: string | number,
  options?: ApiOptions,
): Promise<AgendaConfig> {
  return callApi<AgendaConfig>(
    `profissionais/${encodeURIComponent(String(professionalId))}/agenda-config`,
    { method: "GET", ...options },
  );
}

/** Salva a configuração de agenda de um profissional (upsert). */
export async function updateAgendaConfig(
  professionalId: string | number,
  config: Omit<AgendaConfig, "profissional_id" | "atualizado_em">,
  options?: ApiOptions,
): Promise<AgendaConfig> {
  return callApi<AgendaConfig>(
    `profissionais/${encodeURIComponent(String(professionalId))}/agenda-config`,
    { method: "PUT", body: JSON.stringify(config), ...options },
  );
}

/** Lista as datas bloqueadas manualmente de um profissional. */
export async function getBlockedDays(
  professionalId: string | number,
  options?: ApiOptions,
): Promise<DiaBloqueado[]> {
  return callApi<DiaBloqueado[]>(
    `profissionais/${encodeURIComponent(String(professionalId))}/dias-bloqueados`,
    { method: "GET", ...options },
  );
}

/** Bloqueia uma data manualmente para um profissional. */
export async function blockDay(
  professionalId: string | number,
  data: string,
  motivo?: string,
  options?: ApiOptions,
): Promise<DiaBloqueado> {
  return callApi<DiaBloqueado>(
    `profissionais/${encodeURIComponent(String(professionalId))}/dias-bloqueados`,
    { method: "POST", body: JSON.stringify({ data, motivo }), ...options },
  );
}

/** Desbloqueia uma data de um profissional. */
export async function unblockDay(
  professionalId: string | number,
  data: string,
  options?: ApiOptions,
): Promise<{ message: string; data: string }> {
  return callApi(
    `profissionais/${encodeURIComponent(String(professionalId))}/dias-bloqueados/${encodeURIComponent(data)}`,
    { method: "DELETE", ...options },
  );
}

// ─── Configuração ─────────────────────────────────────────────────────────

export type ConfigChave = 'home' | 'categorias' | 'servicos';

/** Retorna o valor de uma chave de configuração armazenada no banco. */
export async function getConfig(chave: ConfigChave): Promise<unknown> {
  const data = await callApi<{ valor: unknown }>(`configuracao/${chave}`, { method: 'GET' });
  return data.valor;
}

/** Persiste o valor de uma chave de configuração no banco. */
export async function updateConfig(chave: ConfigChave, valor: unknown): Promise<void> {
  await callApi(`configuracao/${chave}`, {
    method: 'PUT',
    body: JSON.stringify(valor),
  });
}

export async function getServiceCategories(): Promise<{ filtersEnabled: boolean; items: CategoryConfigDto[] }> {
  return callApi<{ filtersEnabled: boolean; items: CategoryConfigDto[] }>('categorias-servicos', {
    method: 'GET',
  });
}

export async function updateServiceCategories(payload: { filtersEnabled: boolean; items: CategoryConfigDto[] }): Promise<void> {
  await callApi('categorias-servicos', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getServices(): Promise<ServiceDto[]> {
  return callApi<ServiceDto[]>('servicos', { method: 'GET' });
}

export async function updateServices(services: ServiceDto[]): Promise<ServiceDto[]> {
  return callApi<ServiceDto[]>('servicos', {
    method: 'PUT',
    body: JSON.stringify(services),
  });
}

// ─── Agendamentos ─────────────────────────────────────────────────────────

/** Cria um novo agendamento. */
export async function createBooking(
  payload: CreateBookingPayload,
): Promise<CreateBookingResponse> {
  return callApi<CreateBookingResponse>("agendamentos", {
    method: "POST",
    body: JSON.stringify({ ...payload, source: payload.source ?? "app-etapas" }),
  });
}
