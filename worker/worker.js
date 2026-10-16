// Eftertanke – diktat-tjeneste (Cloudflare Worker)
//
// Tager en dagbeskrivelse fra appen, spørger Claude og sender tidsblokke tilbage.
// API-nøglen ligger kun her i Cloudflare og når aldrig ud til telefonen.
//
// Variabler, der skal sættes i Cloudflare (Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY  (Secret)  din nøgle fra console.anthropic.com
//   APP_KEY            (Secret)  en selvvalgt adgangskode, som også skrives ind i appen
//   ALLOWED_ORIGIN     (Text)    fx https://dit-brugernavn.github.io
//   MODEL              (Text, valgfri)  standard er claude-haiku-5-5

const DEFAULT_MODEL = "claude-haiku-5-5";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").replace(/\/+$/, "");
    const cors = {
      "access-control-allow-origin": allowed || "null",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-app-key",
      "access-control-max-age": "86400",
      "vary": "origin"
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (allowed && origin && origin !== allowed) return json({ error: "Forkert oprindelse" }, 403);
    if (!env.APP_KEY || request.headers.get("x-app-key") !== env.APP_KEY) return json({ error: "Forkert adgangskode" }, 401);

    const { pathname } = new URL(request.url);
    if (pathname === "/ping") return json({ ok: true });
    if (pathname !== "/structure" || request.method !== "POST") return json({ error: "Ukendt adresse" }, 404);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY mangler i Cloudflare" }, 500);

    let input;
    try { input = await request.json(); } catch { return json({ error: "Ugyldig forespørgsel" }, 400); }
    const text = String(input.text || "").slice(0, 4000).trim();
    if (!text) return json({ error: "Ingen tekst" }, 400);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : "";
    const weekday = String(input.weekday || "").slice(0, 20);
    const categories = (Array.isArray(input.categories) ? input.categories : []).slice(0, 30)
      .map(c => ({ id: String(c.id).slice(0, 30), name: String(c.name).slice(0, 60) }));
    const existing = (Array.isArray(input.existing) ? input.existing : []).slice(0, 60)
      .map(b => ({ id: String(b.id).slice(0, 20), start: String(b.start).slice(0, 5), end: String(b.end).slice(0, 5), cat: String(b.cat).slice(0, 30), label: String(b.label || "").slice(0, 80) }));

    const prompt = `Du omsætter en kort dansk dagbeskrivelse til tidsblokke for et personligt tidsregnskab.
Dato: ${date} (${weekday}).
Kategorier (brug id): ${categories.map(c => `${c.id} = ${c.name}`).join("; ")}.
Eksisterende blokke for dagen (kan være en skabelon, der skal rettes til): ${JSON.stringify(existing)}
Brugerens beskrivelse: """${text}"""

Returnér HELE dagen som en revideret liste. Behold eksisterende blokke, som beskrivelsen ikke ændrer på, og angiv deres id i "from". Ret tider, opdel eller erstat blokke, hvor beskrivelsen siger noget andet. Tilføj nye blokke for det, der mangler. Undgå overlap. Skøn tider, hvis de er upræcise. Etiketter er korte (højst 6 ord), på dansk, og generelle om arbejde: nævn aldrig navne på patienter, kolleger eller sager.
Svar KUN med JSON, uden forklaring: {"blocks":[{"start":"HH:MM","end":"HH:MM","cat":"<id>","label":"...","from":"<eksisterende id eller null>"}]}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: env.MODEL || DEFAULT_MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.log("Anthropic API error", res.status, detail.slice(0, 500));
      return json({ error: "Claude svarede ikke som forventet" }, res.status === 429 || res.status === 529 ? 429 : 502);
    }
    const data = await res.json();
    const out = (data.content || []).filter(p => p.type === "text").map(p => p.text).join("");
    const first = out.indexOf("{"), last = out.lastIndexOf("}");
    try {
      const parsed = JSON.parse(out.slice(first, last + 1));
      if (!Array.isArray(parsed.blocks)) throw new Error("no blocks");
      return json({ blocks: parsed.blocks.slice(0, 60) });
    } catch {
      console.log("Could not parse model output", out.slice(0, 500));
      return json({ error: "Kunne ikke læse Claudes svar" }, 502);
    }
  }
};
