import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase";

const requestSchema = z.object({
  customerLabel: z.string().optional(),
  topPhotoPath: z.string().nullable().optional(),
  sidePhotoPath: z.string().nullable().optional(),
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
    return NextResponse.json({ error: "Ungueltiger Fuss-Scan." }, { status: 400 });
  }

  if (!hasSupabaseServerConfig()) {
    return NextResponse.json({ mode: "demo", id: null });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("foot_scans")
    .insert({
      customer_label: parsed.data.customerLabel || null,
      top_photo_path: parsed.data.topPhotoPath || null,
      side_photo_path: parsed.data.sidePhotoPath || null,
      foot_length_mm: parsed.data.analysis.footLengthMm,
      foot_width_mm: parsed.data.analysis.footWidthMm,
      toe_shape: parsed.data.analysis.toeShape,
      rist55_mm: parsed.data.analysis.rist55Mm,
      measurement_confidence: parsed.data.analysis.measurementConfidence,
      llm_analysis: parsed.data.rawAnalysis,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mode: "supabase", id: data.id });
}
