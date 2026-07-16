# Barfuss Schuh Fitter

Mobile MVP-Webapp fuer den ersten Infrastruktur-Test:

- Smartphone-Foto aufnehmen oder hochladen
- optional in Supabase Storage speichern
- optional mit OpenAI Vision analysieren
- strukturierte Passformdiagnose anzeigen

## Lokal starten

Diese Codex-Umgebung nutzt eine gebuendelte Node-Laufzeit. Falls `node` und `pnpm`
lokal installiert sind, reichen:

```bash
pnpm install
pnpm dev
```

Ohne lokale Node-Installation kann der gebuendelte Pfad verwendet werden:

```bash
PATH=/Users/timothy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/timothy/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm dev
```

## Environment

`.env.example` nach `.env.local` kopieren und Werte setzen:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=fit-photos
OPENAI_API_KEY=
```

Ohne diese Werte laeuft die App im Demo-Modus. Fotos werden dann nicht gespeichert
und die Analyse gibt ein strukturiertes Demo-Ergebnis zurueck.

## Supabase

1. Neues Supabase-Projekt erstellen.
2. SQL aus `supabase/schema.sql` im SQL Editor ausfuehren.
3. Unter Storage den Bucket `fit-photos` pruefen.
4. Project URL, anon key und service role key in `.env.local` eintragen.

## Vercel

1. Projekt mit Vercel verbinden.
2. Dieselben Environment-Variablen in Vercel hinterlegen.
3. Deploy ausloesen.
4. URL auf dem Smartphone testen, besonders Kamera/Upload.
