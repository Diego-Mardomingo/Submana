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

export function jsonCachedResponse(
  data: Record<string, unknown>,
  status = 200,
  maxAge = 60,
  staleWhileRevalidate = 300
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    },
  });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
