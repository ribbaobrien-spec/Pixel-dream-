const ALLOWED_ORIGIN = "https://ribbaobrien-spec.github.io";

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function exceedsText(value, maximum) {
  return typeof value === "string" && value.trim().length > maximum;
}

async function verifyTurnstile(token, env, expectedAction) {
  const secret = env.TURNSTILE_SECRET;
  if (!secret || typeof token !== "string" || !token || token.length > 2048) return false;

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {"Content-Type":"application/x-www-form-urlencoded"},
      body: form
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result?.success === true &&
      result.hostname === "ribbaobrien-spec.github.io" &&
      result.action === expectedAction;
  } catch {
    return false;
  }
}

class RequestInputError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function readJsonRequest(request, maximumBytes) {
  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestInputError("Send this request as JSON.", 415);
  }

  const contentLength = request.headers.get("Content-Length");
  if (contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > maximumBytes) {
    throw new RequestInputError("The request is too large.", 413);
  }

  if (!request.body) throw new RequestInputError("A JSON request body is required.", 400);
  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      totalBytes += part.value.byteLength;
      if (totalBytes > maximumBytes) {
        try { await reader.cancel(); } catch {}
        throw new RequestInputError("The request is too large.", 413);
      }
      chunks.push(part.value);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let value;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestInputError("The request body is not valid JSON.", 400);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestInputError("The JSON body must be an object.", 400);
  }
  return value;
}

function publicListing(record) {
  const { deleteToken, ...listing } = record;
  return listing;
}

async function handleTrades(request, env, corsHeaders) {
  const method = request.method;

  if (!env.TRADE_LISTINGS) {
    return jsonResponse({error:"The company exchange storage is not connected yet."},503,corsHeaders);
  }

  try {
    if (method === "GET") {
      const result = await env.TRADE_LISTINGS.list({prefix:"listing:",limit:500});
      const records = await Promise.all(result.keys.map((key) => env.TRADE_LISTINGS.get(key.name,"json")));
      const listings = records
        .filter((record) => record && record.id)
        .sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0,200)
        .map(publicListing);
      return jsonResponse({listings},200,corsHeaders);
    }

    if (method === "POST") {
      const body = await readJsonRequest(request, 4096);
      if (cleanText(body.website)) {
        return jsonResponse({error:"Could not post that offer."},400,corsHeaders);
      }
      if (body.publicContactConsent !== true) {
        return jsonResponse({error:"Please agree to show your business contact on the public offer."},400,corsHeaders);
      }

      const company = cleanText(body.company);
      const offeredItem = cleanText(body.offeredItem);
      const wantedItem = cleanText(body.wantedItem);
      const location = cleanText(body.location);
      const contactEmail = cleanText(body.contactEmail);
      const details = cleanText(body.details);
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail);

      if (
        exceedsText(body.company, 80) ||
        exceedsText(body.offeredItem, 120) ||
        exceedsText(body.wantedItem, 120) ||
        exceedsText(body.location, 100) ||
        exceedsText(body.contactEmail, 160) ||
        exceedsText(body.details, 500) ||
        exceedsText(body.website, 120)
      ) {
        return jsonResponse({error:"One or more fields are too long."},400,corsHeaders);
      }

      if (!company || !offeredItem || !wantedItem || !validEmail) {
        return jsonResponse({error:"Add a business name, what you offer, what you want, and a valid business email."},400,corsHeaders);
      }
      if (!await verifyTurnstile(body.turnstileToken, env, "swap-post")) {
        return jsonResponse({error:"Complete the security check before posting your offer."},403,corsHeaders);
      }

      const current = await env.TRADE_LISTINGS.list({prefix:"listing:",limit:500});
      if (current.keys.length >= 500) {
        return jsonResponse({error:"The swap board is full. Please contact the site owner."},429,corsHeaders);
      }

      const id = crypto.randomUUID();
      const deleteToken = crypto.randomUUID();
      const listing = {
        id,
        company,
        offeredItem,
        wantedItem,
        location,
        contactEmail,
        details,
        createdAt:new Date().toISOString()
      };
      await env.TRADE_LISTINGS.put(`listing:${id}`,JSON.stringify({...listing,deleteToken}));
      return jsonResponse({listing,deleteToken},201,corsHeaders);
    }

    if (method === "DELETE") {
      const body = await readJsonRequest(request, 1024);
      const id = cleanText(body.id);
      const deleteToken = cleanText(body.deleteToken);
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(id) || !uuidPattern.test(deleteToken)) {
        return jsonResponse({error:"Missing offer removal details."},400,corsHeaders);
      }
      const key = `listing:${id}`;
      const record = await env.TRADE_LISTINGS.get(key,"json");
      if (!record) return jsonResponse({error:"That offer has already been removed."},404,corsHeaders);
      if (record.deleteToken !== deleteToken) {
        return jsonResponse({error:"Only the business that posted this offer can remove it."},403,corsHeaders);
      }
      await env.TRADE_LISTINGS.delete(key);
      return jsonResponse({removed:true},200,corsHeaders);
    }

    return jsonResponse({error:"Method not allowed."},405,corsHeaders);
  } catch (error) {
    if (error instanceof RequestInputError) {
      return jsonResponse({error:error.message},error.status,corsHeaders);
    }
    console.error("Company exchange request failed:",error instanceof Error ? error.name : "UnknownError");
    return jsonResponse({error:"The company exchange could not complete that request."},500,corsHeaders);
  }
}

async function handleIdeas(request, env, corsHeaders) {
  const method = request.method;

  if (!env.TRADE_LISTINGS) {
    return jsonResponse({error:"The idea board storage is not connected yet."},503,corsHeaders);
  }

  try {
    if (method === "GET") {
      const result = await env.TRADE_LISTINGS.list({prefix:"idea:",limit:500});
      const records = await Promise.all(result.keys.map((key) => env.TRADE_LISTINGS.get(key.name,"json")));
      const messages = records
        .filter((record) => record && record.id && typeof record.message === "string")
        .sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0,200)
        .map((record) => ({
          id:record.id,
          displayName:cleanText(record.displayName) || "Dreamer",
          message:cleanText(record.message),
          inReplyTo:cleanText(record.inReplyTo),
          inReplyToName:cleanText(record.inReplyToName),
          createdAt:cleanText(record.createdAt)
        }));
      return jsonResponse({messages},200,corsHeaders);
    }

    if (method === "POST") {
      const body = await readJsonRequest(request,4096);
      if (cleanText(body.website)) {
        return jsonResponse({error:"Could not post that message."},400,corsHeaders);
      }

      const displayName = cleanText(body.displayName) || "Dreamer";
      const message = cleanText(body.message);
      const inReplyTo = cleanText(body.inReplyTo);

      if (
        exceedsText(body.displayName,40) ||
        exceedsText(body.message,500) ||
        exceedsText(body.inReplyTo,36) ||
        exceedsText(body.website,120)
      ) {
        return jsonResponse({error:"One or more fields are too long."},400,corsHeaders);
      }
      if (message.length < 3) {
        return jsonResponse({error:"Write a message of at least 3 characters."},400,corsHeaders);
      }
      if (!await verifyTurnstile(body.turnstileToken,env,"idea-post")) {
        return jsonResponse({error:"Complete the security check before sharing your message."},403,corsHeaders);
      }

      let inReplyToName = "";
      if (inReplyTo) {
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(inReplyTo)) {
          return jsonResponse({error:"That conversation message could not be found."},400,corsHeaders);
        }
        const parent = await env.TRADE_LISTINGS.get("idea:"+inReplyTo,"json");
        if (!parent || !parent.id) {
          return jsonResponse({error:"That conversation message could not be found."},404,corsHeaders);
        }
        inReplyToName = cleanText(parent.displayName) || "Dreamer";
      }

      const current = await env.TRADE_LISTINGS.list({prefix:"idea:",limit:500});
      if (current.keys.length >= 500) {
        return jsonResponse({error:"The idea board is full for now. Please check back later."},429,corsHeaders);
      }

      const id = crypto.randomUUID();
      const deleteToken = crypto.randomUUID();
      const record = {
        id,
        displayName:displayName.slice(0,40),
        message,
        inReplyTo,
        inReplyToName,
        createdAt:new Date().toISOString()
      };
      await env.TRADE_LISTINGS.put("idea:"+id,JSON.stringify({...record,deleteToken}));
      return jsonResponse({message:record,deleteToken},201,corsHeaders);
    }

    if (method === "DELETE") {
      const body = await readJsonRequest(request,1024);
      const id = cleanText(body.id);
      const deleteToken = cleanText(body.deleteToken);
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(id) || !uuidPattern.test(deleteToken)) {
        return jsonResponse({error:"Missing message removal details."},400,corsHeaders);
      }
      const key = "idea:"+id;
      const record = await env.TRADE_LISTINGS.get(key,"json");
      if (!record) return jsonResponse({error:"That message has already been removed."},404,corsHeaders);
      if (record.deleteToken !== deleteToken) {
        return jsonResponse({error:"Only the person who posted this message can remove it."},403,corsHeaders);
      }
      await env.TRADE_LISTINGS.delete(key);
      return jsonResponse({removed:true},200,corsHeaders);
    }

    return jsonResponse({error:"Method not allowed."},405,corsHeaders);
  } catch (error) {
    if (error instanceof RequestInputError) {
      return jsonResponse({error:error.message},error.status,corsHeaders);
    }
    console.error("Idea board request failed:",error instanceof Error ? error.name : "UnknownError");
    return jsonResponse({error:"The idea board could not complete that request."},500,corsHeaders);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const securityHeaders = {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store"
    };
    const corsHeaders = {
      ...securityHeaders,
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin"
    };

    if (origin !== ALLOWED_ORIGIN) {
      return new Response("Origin not allowed", {status:403,headers:securityHeaders});
    }
    corsHeaders["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
    if (request.method === "OPTIONS") {
      return new Response(null,{status:204,headers:corsHeaders});
    }

    const path = new URL(request.url).pathname.replace(/\/+$/,"") || "/";
    if (path === "/trades") return handleTrades(request,env,corsHeaders);
    if (path === "/ideas") return handleIdeas(request,env,corsHeaders);
    if (path !== "/generate") return new Response("Not found",{status:404,headers:corsHeaders});

    if (request.method !== "POST") {
      return new Response("Method not allowed",{status:405,headers:corsHeaders});
    }

    try {
      const body = await readJsonRequest(request, 4096);
      const prompt = cleanText(body.prompt);
      const size = body.size;
      const allowedSizes = new Set(["1024x1536","1536x1024","1024x1024"]);

      if (!prompt || prompt.length > 700) {
        return new Response("Please provide a prompt of 1–700 characters.",{status:400,headers:corsHeaders});
      }
      if (!allowedSizes.has(size)) {
        return new Response("Invalid image size.",{status:400,headers:corsHeaders});
      }
      if (!env.OPENAI_API_KEY) {
        return new Response("Image service is not configured.",{status:503,headers:corsHeaders});
      }
      if (!await verifyTurnstile(body.turnstileToken, env, "image-generation")) {
        return new Response("Complete the security check before creating an image.",{status:403,headers:{...corsHeaders,"Content-Type":"text/plain; charset=utf-8"}});
      }

      const upstream = await fetch("https://api.openai.com/v1/images/generations",{
        method:"POST",
        headers:{
          "Authorization":`Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          model:"gpt-image-2.5-flare",
          prompt,
          size,
          quality:"medium",
          output_format:"png",
          n:1
        })
      });

      if (!upstream.ok) {
        console.error("OpenAI image request failed:",upstream.status);
        const status = upstream.status === 429 ? 429 : 502;
        return new Response(
          status === 429 ? "Image service is busy or the API usage limit was reached. Try again later." :
          "The image service could not complete the request. Please try again.",
          {status,headers:corsHeaders}
        );
      }

      const result = await upstream.json();
      const encoded = result?.data?.[0]?.b64_json;
      if (typeof encoded !== "string" || encoded.length > 20 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
        return new Response("The image service returned no image.",{status:502,headers:corsHeaders});
      }
      const binary = Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      return new Response(binary,{
        status:200,
        headers:{
          ...corsHeaders,
          "Content-Type":"image/png",
          "Cache-Control":"no-store"
        }
      });
    } catch (error) {
      if (error instanceof RequestInputError) {
        return new Response(error.message,{status:error.status,headers:{...corsHeaders,"Content-Type":"text/plain; charset=utf-8"}});
      }
      console.error("Worker error:",error instanceof Error ? error.name : "UnknownError");
      return new Response("Unexpected server error. Please try again.",{status:500,headers:{...corsHeaders,"Content-Type":"text/plain; charset=utf-8"}});
    }
  }
};
