import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
  storageBucket,
} from "@/lib/supabase";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const photoType = formData.get("photoType") || "top";

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Bitte ein Foto auswaehlen." },
      { status: 400 },
    );
  }

  if (!hasSupabaseServerConfig()) {
    return NextResponse.json({
      mode: "demo",
      imageUrl: null,
      path: null,
      message:
        "Upload lokal angenommen. Supabase ist noch nicht konfiguriert, deshalb wurde das Foto nicht gespeichert.",
    });
  }

  const supabase = createSupabaseServerClient();
  const extension = file.name.split(".").pop() || "jpg";
  const path = `${photoType}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(storageBucket)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(storageBucket).getPublicUrl(path);

  return NextResponse.json({
    mode: "supabase",
    imageUrl: data.publicUrl,
    path,
    message: "Foto wurde in Supabase gespeichert.",
  });
}
