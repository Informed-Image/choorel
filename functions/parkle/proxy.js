// Cloudflare Pages Function: /parkle/proxy.php or /parkle/proxy
// Replaces legacy PHP proxy for Parkle Groq AI validation & hints

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Only allow POST
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const data = await request.json();
    if (!data || typeof data.prompt !== "string" || !data.prompt.trim()) {
      return new Response(JSON.stringify({ error: "Missing or invalid prompt" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Sanitize prompt length
    const prompt = data.prompt.trim().slice(0, 1000);

    // Groq API Key from environment variable
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY environment variable not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const groqPayload = {
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 80,
    };

    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(groqPayload),
    });

    if (!groqResp.ok) {
      return new Response(
        JSON.stringify({ error: `Groq returned HTTP ${groqResp.status}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResp.json();
    const text = groqData?.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Empty response from Groq" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
