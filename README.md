# Eftertanke

Tidsregnskab med eftertanke: hvilke timer ville du vælge igen?
Appen installeres fra GitHub Pages som en webapp (PWA) med eget ikon på hjemmeskærmen. Data gemmes kun på telefonen.

## Indhold

| Fil | Hvad den gør |
|---|---|
| `index.html` | Selve appen |
| `manifest.webmanifest` | App-navn, ikon og fuldskærm |
| `sw.js` | Gør appen tilgængelig uden net |
| `icons/` | App-ikoner |
| `worker/worker.js` | Diktat-tjenesten til Cloudflare. Skal **ikke** ligge på GitHub Pages |

## 1. Læg appen på GitHub Pages (cirka 5 min)

1. Opret et nyt repo på GitHub, fx `eftertanke`. Det må gerne være offentligt, for der ligger ingen hemmeligheder i det.
2. Upload `index.html`, `manifest.webmanifest`, `sw.js` og mappen `icons` (træk dem ind under *Add file → Upload files*).
3. Gå til *Settings → Pages*. Under *Source* vælger du *Deploy from a branch*, branch `main` og mappen `/ (root)`. Klik *Save*.
4. Efter et minut ligger appen på `https://DIT-BRUGERNAVN.github.io/eftertanke/`.

## 2. Hent en API-nøgle hos Anthropic (cirka 5 min)

1. Log ind på <https://console.anthropic.com>. Det er en separat konto fra dit Claude-abonnement.
2. Tilføj betaling under *Billing*. En dags diktering koster en brøkdel af en øre, så et lille beløb rækker længe. Sæt gerne en månedlig grænse.
3. Opret en nøgle under *API Keys*, og kopier den.

## 3. Opret diktat-tjenesten på Cloudflare (cirka 10 min)

1. Opret en gratis konto på <https://dash.cloudflare.com>.
2. Gå til *Workers & Pages → Create → Create Worker*, og giv den navnet `eftertanke`. Klik *Deploy*.
3. Klik *Edit code*, slet alt, og indsæt hele indholdet af `worker/worker.js`. Klik *Deploy*.
4. Gå til workerens *Settings → Variables and Secrets*, og tilføj:
   - `ANTHROPIC_API_KEY`: typen *Secret*, værdien er nøglen fra trin 2.
   - `APP_KEY`: typen *Secret*. Vælg selv en lang adgangskode, fx fire tilfældige ord.
   - `ALLOWED_ORIGIN`: typen *Text*, værdien er `https://DIT-BRUGERNAVN.github.io`. Kun domænet, uden `/eftertanke` og uden `/` til sidst.
5. Notér workerens adresse. Den ser ud som `https://eftertanke.DIT-NAVN.workers.dev`.

## 4. Forbind appen og installér den på telefonen

1. Åbn appens adresse på telefonen (iPhone: brug Safari).
2. Rul ned til *Indstillinger og backup*. Indsæt workerens adresse og din `APP_KEY`, og tryk *Test forbindelsen*.
3. Installér appen:
   - **iPhone:** Del-knappen → *Føj til hjemmeskærm*.
   - **Android:** menuen ⋮ → *Installer app* / *Føj til startskærm*.

Åbn den fremover fra ikonet. Indstillingerne skal indtastes i den installerede app. På iPhone har den sin egen lagerplads, adskilt fra Safari.

## Backup

Alt ligger kun på telefonen. Brug *Gem backup* en gang imellem, og gem filen i Filer/iCloud Drive eller Google Drev. *Hent backup* lægger dagene tilbage, også på en ny telefon.

## Opdatering af appen

Når du ændrer `index.html`, skal du også hæve versionsnummeret øverst i `sw.js` (`eftertanke-v1` → `eftertanke-v2`). Så henter telefonen den nye version. Ændringen slår igennem anden gang, du åbner appen.

## Fejlfinding

- **"Kunne ikke nå adressen"**: Tjek workerens adresse og at `ALLOWED_ORIGIN` passer præcist med domænet i browserens adresselinje.
- **"Adgangskoden passer ikke"**: `APP_KEY` i Cloudflare og koden i appen skal være ens.
- **"Claude svarede ikke som forventet"**: Tjek at API-nøglen er gyldig, og at der er kredit på kontoen. Under workerens *Logs* i Cloudflare kan du se den præcise fejl.
