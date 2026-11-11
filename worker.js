const ALLOWED_ORIGIN = "https://ribbaobrien-spec.github.io";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };

    if (origin !== ALLOWED_ORIGIN) {
      return new Response("Origin not allowed", { status: 403 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      const size = body.size;
      const allowedSizes = new Set(["1024x1536", "1536x1024", "1024x1024"]);

      if (!prompt || prompt.length > 700) {
        return new Response("Please provide a prompt of 1–700 characters.", { status: 400, headers: corsHeaders });
      }
      if (!allowedSizes.has(size)) {
        return new Response("Invalid image size.", { status: 400, headers: corsHeaders });
      }
      if (!env.OPENAI_API_KEY) {
        return new Response("Image service is not configured.", { status: 503, headers: corsHeaders });
      }

      const upstream = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-image-2.5-flare",
          prompt,
          size,
          quality: "medium",
          output_format: "png",
          n: 1
        })
      });

      if (!upstream.ok) {
        const details = await upstream.text();
        console.error("OpenAI image request failed:", upstream.status, details.slice(0, 500));
        const status = upstream.status === 429 ? 429 : 502;
        return new Response(
          status === 429 ? "Image service is busy or the API usage limit was reached. Try again later." :
          "The image service could not complete the request. Please try again.",
          { status, headers: corsHeaders }
        );
      }

      const result = await upstream.json();
      const encoded = result?.data?.[0]?.b64_json;
      if (!encoded) {
        return new Response("The image service returned no image.", { status: 502, headers: corsHeaders });
      }
      const binary = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      return new Response(binary, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          "Cache-Control": "no-store"
        }
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response("Unexpected server error. Please try again.", { status: 500, headers: corsHeaders });
    }
  }
};
