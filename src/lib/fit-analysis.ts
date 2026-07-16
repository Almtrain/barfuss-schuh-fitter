export type FitAnalysis = {
  mode: "demo" | "openai";
  measurementConfidence: "low" | "medium" | "high";
  footLengthMm: number | null;
  footWidthMm: number | null;
  toeShape: "straight" | "slope" | "fan" | "unknown";
  rist55Mm: number | null;
  recommendation: string;
  checks: {
    length: "passt" | "knapp" | "zu kurz" | "unbekannt";
    width: "passt" | "knapp" | "zu schmal" | "unbekannt";
    toeBox: "passend" | "kritisch" | "unbekannt";
    instep: "niedriges Risiko" | "mittleres Risiko" | "hohes Risiko" | "unbekannt";
  };
  notes: string[];
};

export const demoAnalysis: FitAnalysis = {
  mode: "demo",
  measurementConfidence: "low",
  footLengthMm: null,
  footWidthMm: null,
  toeShape: "unknown",
  rist55Mm: null,
  recommendation:
    "Demo-Modus: Foto wurde angenommen. Sobald Supabase und OpenAI verbunden sind, wird hier eine strukturierte Passformanalyse angezeigt.",
  checks: {
    length: "unbekannt",
    width: "unbekannt",
    toeBox: "unbekannt",
    instep: "unbekannt",
  },
  notes: [
    "A4-Referenz: 210 x 297 mm",
    "MVP-Regel: Fusslaenge plus 8-10 mm Spielraum",
    "Rist55 wird im Seitenfoto bei 55% der Fusslaenge bewertet",
  ],
};
