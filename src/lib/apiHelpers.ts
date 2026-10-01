import type { SupabaseClient } from "@supabase/supabase-js";

export async function parseRequestBody(
  request: Request
): Promise<{ body: Record<string, string>; isJson: boolean }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    const body: Record<string, string> = {};
    for (const [key, value] of Object.entries(json)) {
      body[key] = value != null ? String(value) : "";
    }
    return { body, isJson: true };
  }

  const formData = await request.formData();
  const body: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    body[key] = value.toString();
  }
  return { body, isJson: false };
}

export function jsonResponse(data: Record<string, unknown>, status = 200) {
  return Response.json(data, { status });
}

/**
 * Datos de usuario mutables: el navegador debe revalidar siempre (la caché vive en
 * React Query). Con max-age, un refetch tras una mutación podía recibir la respuesta antigua.
 */
export function jsonCachedResponse(data: Record<string, unknown>, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-cache" },
  });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * 500 genérico: el detalle (mensajes de Postgres/PostgREST con nombres de tablas,
 * constraints, etc.) se registra en el servidor y no se envía al cliente.
 */
export function jsonServerError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
  return jsonError("internal_error", 500);
}

/**
 * Comprueba que la cuenta pertenece al usuario. No depender solo de RLS:
 * los ids llegan del cliente y se usan después para mover saldos.
 */
export async function isOwnedAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** True si todas las categorías son del sistema (user_id null) o del usuario. */
export async function areAccessibleCategories(
  supabase: SupabaseClient,
  userId: string,
  categoryIds: (string | null | undefined)[]
): Promise<boolean> {
  const unique = [...new Set(categoryIds.filter((id): id is string => !!id))];
  if (unique.length === 0) return true;
  const { data } = await supabase
    .from("categories")
    .select("id")
    .in("id", unique)
    .or(`user_id.is.null,user_id.eq.${userId}`);
  return (data?.length ?? 0) === unique.length;
}

/** Solo rutas internas ("/x"); evita redirecciones abiertas con "//host", "/\host" o "@host". */
export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
