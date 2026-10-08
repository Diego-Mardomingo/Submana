/** JSON request against the app API: resolves to `data`, throws the server `error` message on failure. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers type the payload
export async function api<T = any>(url: string, method = "GET", body?: unknown, init?: { keepalive?: boolean }): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    ...init,
    ...(body !== undefined && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `${method} ${url} failed (${res.status})`);
  return json.data;
}
