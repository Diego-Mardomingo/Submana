/**
 * Shared helper to parse request body in both JSON and FormData formats.
 * Allows API routes to support both traditional form submissions (redirect)
 * and modern fetch() calls (JSON response) seamlessly.
 */

export async function parseRequestBody(
    request: Request
): Promise<{ body: Record<string, string>; isJson: boolean }> {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        const json = await request.json();
        // Convert all values to strings to match FormData behavior
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

/** Return a JSON success response for API callers */
export function jsonResponse(
    data: Record<string, unknown>,
    status = 200
): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

/** Return a JSON error response for API callers */
export function jsonError(message: string, status = 400): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
