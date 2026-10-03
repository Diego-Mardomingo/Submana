import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ventana fija en Postgres (public.consume_rate_limit, solo service role).
 * Devuelve una respuesta 429 si se supera el límite, o null para continuar.
 * Si el servidor no tiene service role configurado o la BD falla, deja pasar
 * (fail-open): el rate limit protege de abuso, no debe tumbar la app.
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<Response | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rateLimit]", error);
      return null;
    }
    if (data === false) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(windowSeconds) },
      });
    }
    return null;
  } catch (err) {
    console.error("[rateLimit]", err);
    return null;
  }
}

export const RATE_LIMITS = {
  /** Atajos/automatizaciones: uso humano, holgado. */
  automation: { limit: 30, windowSeconds: 60 },
  /** Fallos de token por IP: frena fuerza bruta. */
  automationAuthFailure: { limit: 20, windowSeconds: 600 },
  /** Importaciones de extractos por usuario. */
  import: { limit: 20, windowSeconds: 600 },
  /** Regeneración de token por usuario. */
  tokenRotation: { limit: 10, windowSeconds: 3600 },
  /** Clasificación previa a importar (consultas por lote, sin escrituras). */
  importPreview: { limit: 60, windowSeconds: 600 },
  /** Solicitudes de amistad por usuario. */
  friends: { limit: 10, windowSeconds: 60 },
  /** Escrituras de grupos, gastos compartidos y liquidaciones por usuario. */
  shared: { limit: 60, windowSeconds: 60 },
} as const;
