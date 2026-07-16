import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAnalysis } from "@/lib/fit-analysis";

const requestSchema = z.object({
  imageUrl: z.string().url().optional(),
  photoType: z.enum(["top", "side"]).default("top"),
  targetType: z.enum(["foot", "shoe"]).default("foot"),
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
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Du bist ein vorsichtiger Assistent fuer Barfussschuh-Passform. Gib nur JSON aus. Wenn Messwerte aus dem Bild unsicher sind, nutze null und confidence low.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analysiere dieses ${parsed.data.photoType === "top" ? "Top-Foto" : "Seitenfoto"} fuer den Barfuss-Schuh-Fitter MVP. Zielobjekt: ${parsed.data.targetType === "shoe" ? "Schuhreferenz oder Einlegesohle" : "Kundenfuss"}. Nutze A4 als Referenz, falls sichtbar. Bei Schuhen bedeuten footLengthMm und footWidthMm die geschaetzte nutzbare Innenlaenge und Innenbreite. Schema: { "mode": "openai", "measurementConfidence": "low|medium|high", "footLengthMm": number|null, "footWidthMm": number|null, "toeShape": "straight|slope|fan|unknown", "rist55Mm": number|null, "recommendation": string, "checks": { "length": "passt|knapp|zu kurz|unbekannt", "width": "passt|knapp|zu schmal|unbekannt", "toeBox": "passend|kritisch|unbekannt", "instep": "niedriges Risiko|mittleres Risiko|hohes Risiko|unbekannt" }, "notes": string[] }`,
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

  return NextResponse.json(JSON.parse(content));
}
