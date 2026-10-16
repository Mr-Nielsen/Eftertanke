# Eftertanke

Tidsregnskab med eftertanke: hvilke timer ville du vælge igen?
Appen ligger på GitHub Pages og kan installeres på telefonen med eget ikon. Data gemmes kun på telefonen.
Opdelingen af dagen i blokke klares af en AI-model på Cloudflares gratis kvote. Der kræves ingen betalingsoplysninger.

**Appens adresse:** <https://mr-nielsen.github.io/eftertanke/>

## Indhold

| Fil | Hvad den gør |
|---|---|
| `index.html` | Selve appen |
| `manifest.webmanifest` | App-navn, ikon og fuldskærm |
| `sw.js` | Gør appen tilgængelig uden net |
| `icons/` | App-ikoner |
| `worker/worker.js` | Blok-tjenesten, som skal ligge på Cloudflare |

## 1. GitHub Pages

*Settings → Pages → Source: Deploy from a branch → main / (root) → Save.*

## 2. Blok-tjenesten på Cloudflare (gratis, cirka 10 min)

1. Opret en gratis konto på <https://dash.cloudflare.com>. Der skal ikke bruges kort.
2. Gå til **Compute (Workers) → Workers & Pages → Create → Start with Hello World**. Kald workeren `eftertanke`, og klik **Deploy**.
3. Klik **Edit code**. Slet alt, indsæt hele indholdet af `worker/worker.js`, og klik **Deploy**.
4. Gå tilbage til workeren → **Settings → Bindings → Add binding → Workers AI**. Variablens navn skal være præcis `AI`. Klik **Add binding**.
5. Under **Settings → Variables and Secrets** tilføjer du:
   - `APP_KEY`: typen *Secret*. Vælg selv en lang adgangskode, fx fire tilfældige ord.
   - `ALLOWED_ORIGIN`: typen *Text*, med værdien `https://mr-nielsen.github.io`
6. Kopiér workerens adresse (øverst, `https://eftertanke.….workers.dev`).

Den gratis kvote er 10.000 "neurons" om dagen. Én opdeling af en dag bruger cirka 200, så kvoten rækker til omkring 50 opdelinger om dagen. Bliver den brugt op, stopper tjenesten bare til næste dag. Den koster aldrig penge.

## 3. Forbind appen og installér den

1. Åbn <https://mr-nielsen.github.io/eftertanke/> på telefonen (iPhone: brug Safari).
2. Installér den:
   - **iPhone:** Del-knappen → *Føj til hjemmeskærm*
   - **Android:** menuen ⋮ → *Installer app*
3. Åbn appen fra ikonet, rul ned til *Indstillinger og backup*, indsæt workerens adresse og din `APP_KEY`, og tryk *Test forbindelsen*.

## Backup

Alt ligger kun på telefonen. Brug *Gem backup* en gang imellem. *Hent backup* lægger dagene tilbage, også på en ny telefon.

## Opdatering af appen

Når `index.html` ændres, skal versionsnummeret øverst i `sw.js` også hæves. Ændringen slår igennem anden gang, appen åbnes.

## Fejlfinding

- **"Kunne ikke nå adressen":** Tjek workerens adresse, og at `ALLOWED_ORIGIN` er præcis `https://mr-nielsen.github.io`.
- **"Adgangskoden passer ikke":** `APP_KEY` i Cloudflare og koden i appen skal være ens.
- **"Det lykkedes ikke at lave blokke":** Tjek at bindingen hedder `AI`. Under workerens **Logs** i Cloudflare kan du se den præcise fejl.
- **Svarene er for upræcise:** Sæt variablen `MODEL` til en anden model fra Cloudflares katalog, fx `@cf/mistralai/mistral-small-3.1-24b-instruct`.
