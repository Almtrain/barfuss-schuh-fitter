import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAnalysis } from "@/lib/fit-analysis";
import type { FitAnalysis } from "@/lib/fit-analysis";

const requestSchema = z.object({
  imageUrl: z.string().url().optional(),
  photoType: z.enum(["top", "side"]).default("top"),
  targetType: z.enum(["foot", "shoe"]).default("foot"),
});

const analysisSchema = z.object({
  mode: z.literal("openai").default("openai"),
  measurementConfidence: z.enum(["low", "medium", "high"]).default("low"),
  footLengthMm: z.number().nullable().default(null),
  footWidthMm: z.number().nullable().default(null),
  toeShape: z.enum(["straight", "slope", "fan", "unknown"]).default("unknown"),
  rist55Mm: z.number().nullable().default(null),
  recommendation: z.string().default("Analyse erstellt. Bitte Messwerte pruefen."),
  checks: z
    .object({
      length: z.enum(["passt", "knapp", "zu kurz", "unbekannt"]).default("unbekannt"),
      width: z.enum(["passt", "knapp", "zu schmal", "unbekannt"]).default("unbekannt"),
      toeBox: z.enum(["passend", "kritisch", "unbekannt"]).default("unbekannt"),
      instep: z
        .enum([
          "niedriges Risiko",
          "mittleres Risiko",
          "hohes Risiko",
          "unbekannt",
        ])
        .default("unbekannt"),
    })
    .default({
      length: "unbekannt",
      width: "unbekannt",
      toeBox: "unbekannt",
      instep: "unbekannt",
    }),
  notes: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Analyse-Anfrage." },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY || !parsed.data.imageUrl) {
    return NextResponse.json(demoAnalysis);
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Du bist ein Mess- und Formanalyse-Assistent fuer einen Barfussschuh-Fitter MVP. Es gibt zwei Use Cases: 1) Kunde erfasst seinen Fuss mit Top-Foto und Seitenfoto auf A4-Referenz. 2) Schuhverkaeufer erfasst ein Schuhmodell/eine Groesse mit Top-Foto der Einlegesohle oder Schuhform und Seitenfoto des Schuhs. Deine Aufgabe in diesem API-Schritt ist nur Messwerte, Formmerkmale und Unsicherheit aus dem aktuellen Foto zu liefern. Du machst noch kein finales Matching zwischen Kunde und Schuh. Gib nur gueltiges JSON aus.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildPrompt(parsed.data.targetType, parsed.data.photoType),
          },
          {
            type: "image_url",
            image_url: {
              url: parsed.data.imageUrl,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message.content;

  if (!content) {
    return NextResponse.json(demoAnalysis);
  }

  try {
    const normalized = normalizeAnalysis(JSON.parse(content));
    return NextResponse.json(normalized);
  } catch {
    return NextResponse.json({
      ...demoAnalysis,
      mode: "openai",
      recommendation:
        "Analyse konnte nicht stabil strukturiert werden. Bitte Foto mit sichtbarer A4-Referenz wiederholen.",
      notes: ["OpenAI hat kein gueltiges Analyse-JSON geliefert."],
    });
  }
}

function buildPrompt(targetType: "foot" | "shoe", photoType: "top" | "side") {
  const reference =
    "A4-Referenz: kurze Seite 210 mm, lange Seite 297 mm. Nutze sichtbare Blattkanten zur Skalierung.";

  if (targetType === "shoe") {
    const topInstruction =
      "Aktueller Prozesskontext: Schuh erfassen durch Schuhverkaeufer. Top-Foto: Schaetze fuer dieses konkrete Schuhmodell/diese Groesse die nutzbare Innenlaenge und maximale nutzbare Vorfussbreite. Bei Einlegesohle direkt messen. Bei Aussenschuh sichtbar: Innenraum konservativ aus Aussenform minus Rand/Materialstaerke schaetzen.";
    const sideInstruction =
      "Aktueller Prozesskontext: Schuh erfassen durch Schuhverkaeufer. Seitenfoto: Schaetze Schuhvolumen, Konstruktion und Rist-/Spann-Risiko des Schuhs. Laenge/Breite duerfen vom Top-Foto unbekannt bleiben, wenn sie seitlich nicht sichtbar sind.";

    return `${reference}
Zielobjekt: ShoeReference. Diese Daten beschreiben den Schuh, nicht die Passform fuer einen konkreten Kunden.
Fotoart: ${photoType === "top" ? "von oben" : "von der Seite"}.
${photoType === "top" ? topInstruction : sideInstruction}
Fachliche Bedeutung der Felder:
- footLengthMm: bei ShoeReference die geschaetzte nutzbare Innenlaenge des Schuhs/der Einlegesohle in mm.
- footWidthMm: bei ShoeReference die geschaetzte maximale nutzbare Vorfuss-/Ballenbreite in mm.
- toeShape: Zehenbox-/Vorfussform des Schuhs. "fan" = breit auffaechernd, "straight" = eher gerade, "slope" = deutlich schraeg zulaufend.
- rist55Mm: nur wenn aus dem Seitenfoto sinnvoll schaetzbar; sonst null.
- checks.length und checks.width: bei ShoeReference keine Kundenpassform. Nutze "unbekannt", ausser du willst eine reine Messqualitaetswarnung ausdruecken.
- checks.toeBox: "passend" bedeutet zehenfreundliche/breite Barfuss-Zehenbox, "kritisch" bedeutet eng/spitz/schmal.
- checks.instep: Risiko, dass der Schuh fuer hohe Riste/hohen Spann knapp wird.
- recommendation: kurze fachliche Zusammenfassung der Schuhreferenz, keine Kaufempfehlung fuer einen Kunden.
Gib bei sichtbarer A4-Referenz numerische mm-Schaetzungen aus. Verwende low confidence, wenn perspektivisch unsicher, aber liefere dennoch eine plausible Schaetzung, wenn die Kontur erkennbar ist.
JSON-Schema: { "mode": "openai", "measurementConfidence": "low|medium|high", "footLengthMm": number|null, "footWidthMm": number|null, "toeShape": "straight|slope|fan|unknown", "rist55Mm": number|null, "recommendation": string, "checks": { "length": "passt|knapp|zu kurz|unbekannt", "width": "passt|knapp|zu schmal|unbekannt", "toeBox": "passend|kritisch|unbekannt", "instep": "niedriges Risiko|mittleres Risiko|hohes Risiko|unbekannt" }, "notes": string[] }`;
  }

  return `${reference}
Zielobjekt: FootScan. Diese Daten beschreiben den Fuss eines Kunden, nicht direkt einen Schuh.
Fotoart: ${photoType === "top" ? "von oben" : "von der Seite"}.
Top-Foto: Schaetze Fusslaenge, maximale Fussbreite und Zehenform.
Seitenfoto: Schaetze Rist55 an 55% der Fusslaenge ab Ferse Richtung Zehen.
Fachliche Bedeutung der Felder:
- footLengthMm: Fusslaenge in mm.
- footWidthMm: maximale Fussbreite in mm.
- toeShape: Zehenform des Fusses. "fan" = auffaechernde Zehen, "straight" = eher gerade, "slope" = schraeg abfallend.
- rist55Mm: vertikale Hoehe vom Boden bis Fussoberkante bei 55% der Fusslaenge ab Ferse.
- checks: beim FootScan nur qualitative Hinweise zur Messbarkeit/Risiko, noch kein finales Matching.
- recommendation: kurze Zusammenfassung der Fussmessung, keine finale Schuh-Empfehlung.
Gib bei sichtbarer A4-Referenz numerische mm-Schaetzungen aus. Verwende low confidence, wenn perspektivisch unsicher, aber liefere dennoch eine plausible Schaetzung, wenn Fuss und Blatt erkennbar sind.
JSON-Schema: { "mode": "openai", "measurementConfidence": "low|medium|high", "footLengthMm": number|null, "footWidthMm": number|null, "toeShape": "straight|slope|fan|unknown", "rist55Mm": number|null, "recommendation": string, "checks": { "length": "passt|knapp|zu kurz|unbekannt", "width": "passt|knapp|zu schmal|unbekannt", "toeBox": "passend|kritisch|unbekannt", "instep": "niedriges Risiko|mittleres Risiko|hohes Risiko|unbekannt" }, "notes": string[] }`;
}

function normalizeAnalysis(input: unknown): FitAnalysis {
  const parsed = analysisSchema.parse(input);

  return {
    mode: "openai",
    measurementConfidence: parsed.measurementConfidence,
    footLengthMm: parsed.footLengthMm,
    footWidthMm: parsed.footWidthMm,
    toeShape: parsed.toeShape,
    rist55Mm: parsed.rist55Mm,
    recommendation: parsed.recommendation,
    checks: parsed.checks,
    notes: parsed.notes,
  };
}
