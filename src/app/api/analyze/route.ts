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
          "Du bist ein Messassistent fuer einen Barfussschuh-MVP. Gib nur gueltiges JSON aus. Wenn ein A4-Blatt oder eine andere klare Referenz sichtbar ist, schaetze Laengen in Millimetern aktiv. Unsicherheit wird ueber measurementConfidence und notes markiert, nicht durch leere Werte, ausser eine Kante ist wirklich nicht sichtbar.",
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
      "Top-Foto: Schaetze die nutzbare Innenlaenge und maximale nutzbare Vorfussbreite. Bei Einlegesohle direkt messen. Bei Aussenschuh sichtbar: Innenraum konservativ aus Aussenform minus Rand/Materialstaerke schaetzen.";
    const sideInstruction =
      "Seitenfoto: Schaetze Volumen/Rist-Risiko und, falls moeglich, Rist55-Kompatibilitaet. Laenge/Breite duerfen vom Top-Foto unbekannt bleiben, wenn seitlich nicht sichtbar.";

    return `${reference}
Zielobjekt: Schuhreferenz fuer Barfussschuh-Fitting.
Fotoart: ${photoType === "top" ? "von oben" : "von der Seite"}.
${photoType === "top" ? topInstruction : sideInstruction}
Gib bei sichtbarer A4-Referenz numerische mm-Schaetzungen aus. Verwende low confidence, wenn perspektivisch unsicher, aber liefere dennoch eine plausible Schaetzung, wenn die Kontur erkennbar ist.
JSON-Schema: { "mode": "openai", "measurementConfidence": "low|medium|high", "footLengthMm": number|null, "footWidthMm": number|null, "toeShape": "straight|slope|fan|unknown", "rist55Mm": number|null, "recommendation": string, "checks": { "length": "passt|knapp|zu kurz|unbekannt", "width": "passt|knapp|zu schmal|unbekannt", "toeBox": "passend|kritisch|unbekannt", "instep": "niedriges Risiko|mittleres Risiko|hohes Risiko|unbekannt" }, "notes": string[] }`;
  }

  return `${reference}
Zielobjekt: Kundenfuss.
Fotoart: ${photoType === "top" ? "von oben" : "von der Seite"}.
Top-Foto: Schaetze Fusslaenge, maximale Fussbreite und Zehenform.
Seitenfoto: Schaetze Rist55 an 55% der Fusslaenge ab Ferse Richtung Zehen.
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
