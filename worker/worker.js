// Eftertanke – blok-tjeneste (Cloudflare Worker med Workers AI)
//
// Tager en dagbeskrivelse fra appen, lader en AI-model dele den op i tidsblokke
// og sender blokkene tilbage. Bruger Cloudflares gratis AI-kvote, så der
// kræves hverken betalingsoplysninger eller API-nøgler.
//
// Opsætning i Cloudflare (se README.md):
//   Binding:   Workers AI med navnet AI
//   APP_KEY         (Secret)  en selvvalgt adgangskode, som også skrives ind i appen
//   ALLOWED_ORIGIN  (Text)    https://mr-nielsen.github.io
//   MODEL           (Text, valgfri)  standard er Llama 3.3 70B

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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
    if (pathname === "/ping") return json({ ok: true, ai: Boolean(env.AI) });
    if (pathname !== "/structure" || request.method !== "POST") return json({ error: "Ukendt adresse" }, 404);
    if (!env.AI) return json({ error: "Workers AI-binding 'AI' mangler i Cloudflare" }, 500);

    let input;
    try { input = await request.json(); } catch { return json({ error: "Ugyldig forespørgsel" }, 400); }
    const text = String(input.text || "").slice(0, 4000).trim();
    if (!text) return json({ error: "Ingen tekst" }, 400);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : "";
    const weekday = String(input.weekday || "").slice(0, 20);
    const categories = (Array.isArray(input.categories) ? input.categories : []).slice(0, 30)
      .map(c => ({ id: String(c.id).slice(0, 30), name: String(c.name).slice(0, 60) }));
    const catIds = new Set(categories.map(c => c.id));
    const existing = (Array.isArray(input.existing) ? input.existing : []).slice(0, 60)
      .map(b => ({ id: String(b.id).slice(0, 20), start: String(b.start).slice(0, 5), end: String(b.end).slice(0, 5), cat: String(b.cat).slice(0, 30), label: String(b.label || "").slice(0, 80) }));

    const system = `Du omsætter en kort dansk dagbeskrivelse til tidsblokke for et personligt tidsregnskab.
Regler:
- Returnér HELE dagen som en revideret liste, sorteret efter starttid.
- Behold eksisterende blokke, som beskrivelsen ikke ændrer på, og angiv deres id i "from".
- Ret tider, opdel eller erstat blokke, hvor beskrivelsen siger noget andet. Tilføj nye blokke for det, der mangler.
- Ingen overlap. Skøn tider, hvis de er upræcise ("halv tolv" = 11:30, "kvart over fire" = 16:15, eftermiddag/aften betyder 24-timers tid).
- Brug kun disse kategori-id'er: ${categories.map(c => `${c.id} (${c.name})`).join(", ")}.
- Etiketter er korte (højst 6 ord) og på dansk. Om arbejde skrives kun generelt: aldrig navne på patienter, kolleger eller sager.
- Svar KUN med JSON i formen {"blocks":[{"start":"HH:MM","end":"HH:MM","cat":"<id>","label":"...","from":"<eksisterende id eller null>"}]}`;

    const user = `Dato: ${date} (${weekday}).
Eksisterende blokke (kan være en skabelon, der skal rettes til): ${JSON.stringify(existing)}
Beskrivelse: """${text}"""`;

    let result;
    try {
      result = await env.AI.run(env.MODEL || DEFAULT_MODEL, {
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_tokens: 2048,
        temperature: 0.2
      });
    } catch (e) {
      console.log("Workers AI error", String(e).slice(0, 500));
      const msg = String(e);
      return json({ error: "AI'en svarede ikke" }, /limit|quota|429|capacity/i.test(msg) ? 429 : 502);
    }

    const raw = result && result.response;
    let parsed = raw && typeof raw === "object" ? raw : null;
    if (!parsed) {
      const out = String(raw || "");
      const first = out.indexOf("{"), last = out.lastIndexOf("}");
      try { parsed = JSON.parse(out.slice(first, last + 1)); }
      catch { console.log("Could not parse model output", out.slice(0, 500)); return json({ error: "Kunne ikke læse AI'ens svar" }, 502); }
    }
    const time = t => /^\d{1,2}:\d{2}$/.test(String(t)) ? String(t).padStart(5, "0") : null;
    const blocks = (Array.isArray(parsed.blocks) ? parsed.blocks : []).slice(0, 60)
      .map(b => ({ start: time(b.start), end: time(b.end), cat: catIds.has(b.cat) ? b.cat : "andet", label: String(b.label || "").slice(0, 80), from: b.from || null }))
      .filter(b => b.start && b.end);
    return json({ blocks });
  }
};
