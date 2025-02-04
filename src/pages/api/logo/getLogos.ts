import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  try {
    // 1. Obtener el término de búsqueda desde la query
    const url = new URL(request.url);
    const searchTerm = url.searchParams.get("searchTerm") || "";

    if (!searchTerm) {
      return new Response(
        JSON.stringify({ error: "Missing 'searchTerm' query param." }),
        { status: 400 }
      );
    }

    const logoResponse = await fetch(`https://api.logo.dev/search?q=${searchTerm}`, {
      headers: {
        Authorization: `Bearer ${import.meta.env.LOGODEV_KEY}`, 
      },
    });
    if (!logoResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Error fetching data from logo.dev" }),
        { status: logoResponse.status }
      );
    }
    const data = await logoResponse.json();

    // 3. Retornar los resultados al cliente en JSON
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Server error" }),
      { status: 500 }
    );
  }
};
