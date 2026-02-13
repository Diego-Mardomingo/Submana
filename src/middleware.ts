import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
    const { url, request } = context;

    const response = await next();

    // Define paths that contain dynamic user data and should not be cached
    // This effectively forces the browser/router to re-fetch the page content
    // whenever the user navigates to it, ensuring data freshness.
    const dynamicPaths = [
        "/subscriptions",
        "/subscription",
        "/settings",
        "/accounts",
        "/transactions"
    ];

    const isDynamicPath = dynamicPaths.some(path => url.pathname.startsWith(path)) || url.pathname === "/";

    // Check if it's an HTML response (pages) and not assets/API
    const contentType = response.headers.get("Content-Type") || "";
    const isHTML = contentType.includes("text/html");

    if (isDynamicPath && isHTML) {
        // Current standard for "do not cache"
        response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("Expires", "0");

        // Also help the browser understand this content varies by user (cookie)
        response.headers.set("Vary", "Cookie");
    }

    return response;
});
