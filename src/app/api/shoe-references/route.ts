import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase";

const requestSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  euSize: z.string().min(1),
  measurementSource: z
    .enum(["insole", "inside_shoe", "outsole_estimated"])
    .default("insole"),
  topPhotoPath: z.string().nullable().optional(),
  sidePhotoPath: z.string().nullable().optional(),
  staffNotes: z.string().optional(),
  analysis: z.object({
    measurementConfidence: z.enum(["low", "medium", "high"]),
    footLengthMm: z.number().nullable(),
    footWidthMm: z.number().nullable(),
    toeShape: z.enum(["straight", "slope", "fan", "unknown"]),
    rist55Mm: z.number().nullable(),
  }),
  rawAnalysis: z.unknown(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Schuhreferenz." },
      { status: 400 },
    );
  }

  if (!hasSupabaseServerConfig()) {
    return NextResponse.json({ mode: "demo", id: null });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shoe_references")
    .insert({
      brand: parsed.data.brand,
      model: parsed.data.model,
      eu_size: parsed.data.euSize,
      measurement_source: parsed.data.measurementSource,
      top_photo_path: parsed.data.topPhotoPath || null,
      side_photo_path: parsed.data.sidePhotoPath || null,
      usable_length_mm: parsed.data.analysis.footLengthMm,
      usable_width_mm: parsed.data.analysis.footWidthMm,
      toe_shape: parsed.data.analysis.toeShape,
      rist55_mm: parsed.data.analysis.rist55Mm,
      measurement_confidence: parsed.data.analysis.measurementConfidence,
      llm_analysis: parsed.data.rawAnalysis,
      staff_notes: parsed.data.staffNotes || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mode: "supabase", id: data.id });
}
