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

function cleanText(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
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
        .sort((a,b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0,200)
        .map(publicListing);
      return jsonResponse({listings},200,corsHeaders);
    }

    if (method === "POST") {
      const body = await request.json();
      if (cleanText(body.website,120)) {
        return jsonResponse({error:"Could not post that offer."},400,corsHeaders);
      }
      if (body.publicContactConsent !== true) {
        return jsonResponse({error:"Please agree to show your business contact on the public offer."},400,corsHeaders);
      }

      const company = cleanText(body.company,80);
      const offeredItem = cleanText(body.offeredItem,120);
      const wantedItem = cleanText(body.wantedItem,120);
      const location = cleanText(body.location,100);
      const contactEmail = cleanText(body.contactEmail,160);
      const details = cleanText(body.details,500);
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail);

      if (!company || !offeredItem || !wantedItem || !validEmail) {
        return jsonResponse({error:"Add a business name, what you offer, what you want, and a valid business email."},400,corsHeaders);
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
      const body = await request.json();
      const id = cleanText(body.id,80);
      const deleteToken = cleanText(body.deleteToken,80);
      if (!id || !deleteToken) {
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
    console.error("Company exchange request failed:",error);
    return jsonResponse({error:"The company exchange could not complete that request."},500,corsHeaders);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Vary": "Origin"
    };

    if (origin !== ALLOWED_ORIGIN) {
      return new Response("Origin not allowed", {status:403,headers:corsHeaders});
    }
    if (request.method === "OPTIONS") {
      return new Response(null,{status:204,headers:corsHeaders});
    }

    const path = new URL(request.url).pathname.replace(/\/+$/,"") || "/";
    if (path === "/trades") return handleTrades(request,env,corsHeaders);
    if (path !== "/generate") return new Response("Not found",{status:404,headers:corsHeaders});

    if (request.method !== "POST") {
      return new Response("Method not allowed",{status:405,headers:corsHeaders});
    }

    try {
      const body = await request.json();
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
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
        const details = await upstream.text();
        console.error("OpenAI image request failed:",upstream.status,details.slice(0,500));
        const status = upstream.status === 429 ? 429 : 502;
        return new Response(
          status === 429 ? "Image service is busy or the API usage limit was reached. Try again later." :
          "The image service could not complete the request. Please try again.",
          {status,headers:corsHeaders}
        );
      }

      const result = await upstream.json();
      const encoded = result?.data?.[0]?.b64_json;
      if (!encoded) {
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
      console.error("Worker error:",error);
      return new Response("Unexpected server error. Please try again.",{status:500,headers:corsHeaders});
    }
  }
};
