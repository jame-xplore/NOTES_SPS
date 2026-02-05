export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST" || new URL(request.url).pathname !== "/check") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const sentences = Array.isArray(body?.sentences) ? body.sentences : null;
    if (!sentences || sentences.length === 0) {
      return new Response(JSON.stringify({ error: "sentences must be a non-empty array" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const system = [
      "You are a friendly English teacher for Level 6B students.",
      "Focus on Past Perfect tense.",
      "For each sentence: provide corrected sentence, short explanation, and encouraging feedback.",
      "Keep feedback simple and supportive.",
      "Return as HTML paragraphs, one per sentence, starting with 'Sentence N:'",
    ].join(" ");

    const user = `Sentences:\n${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return new Response(JSON.stringify({ error: "OpenAI request failed", details: errText }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const aiJson = await aiResponse.json();
    const content = aiJson?.choices?.[0]?.message?.content?.trim();

    return new Response(JSON.stringify({ feedback: content || "" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  },
};
