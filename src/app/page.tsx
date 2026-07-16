"use client";

import { Camera, CheckCircle2, Loader2, Ruler, Upload } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { FitAnalysis } from "@/lib/fit-analysis";

type PhotoType = "top" | "side";

type UploadResult = {
  mode: "demo" | "supabase";
  imageUrl: string | null;
  path: string | null;
  message: string;
};

const photoCopy: Record<PhotoType, { title: string; body: string }> = {
  top: {
    title: "Fuss von oben",
    body: "Stelle den groesseren Fuss barfuss auf ein A4-Blatt. Innenseite an die Blattkante, Ferse an das untere Blattende. Fotografiere moeglichst senkrecht.",
  },
  side: {
    title: "Fuss von der Seite",
    body: "Lasse den Fuss auf dem A4-Blatt. Fotografiere auf Fusshoehe parallel zum Boden, damit der Rist55 eingeschaetzt werden kann.",
  },
};

export default function Home() {
  const [photoType, setPhotoType] = useState<PhotoType>("top");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCopy = photoCopy[photoType];

  const resultItems = useMemo(() => {
    if (!analysis) {
      return [];
    }

    return [
      ["Laenge", analysis.checks.length],
      ["Breite", analysis.checks.width],
      ["Zehenbox", analysis.checks.toeBox],
      ["Rist/Volumen", analysis.checks.instep],
    ];
  }, [analysis]);

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setUploadResult(null);
    setAnalysis(null);
    setError(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Bitte zuerst ein Foto auswaehlen.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("photoType", photoType);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadJson = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadJson.error || "Upload fehlgeschlagen.");
      }

      setUploadResult(uploadJson);

      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: uploadJson.imageUrl || undefined,
          photoType,
        }),
      });

      const analyzeJson = await analyzeResponse.json();

      if (!analyzeResponse.ok) {
        throw new Error(analyzeJson.error || "Analyse fehlgeschlagen.");
      }

      setAnalysis(analyzeJson);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ein unbekannter Fehler ist aufgetreten.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-mist">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-5 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-10">
        <div className="flex flex-col justify-between gap-8 rounded-lg bg-ink p-6 text-white md:p-8">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-leaf">
                <Ruler size={20} />
              </div>
              <div>
                <p className="text-sm text-white/70">MVP Test</p>
                <h1 className="text-2xl font-semibold tracking-normal">
                  Barfuss Schuh Fitter
                </h1>
              </div>
            </div>

            <div className="space-y-5">
              <p className="max-w-md text-lg leading-7 text-white/88">
                Ein erster vertikaler Test: Smartphone-Foto aufnehmen, Upload
                pruefen, KI-Analyse vorbereiten und ein erklaerbares Ergebnis
                anzeigen.
              </p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {["A4 Referenz", "Foto Upload", "Fit Diagnose"].map((item) => (
                  <div
                    className="rounded-md border border-white/14 bg-white/6 p-3"
                    key={item}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-sm leading-6 text-white/64">
            Naechster Infrastruktur-Test: Supabase Bucket verbinden, Vercel
            Deployment erstellen, OpenAI API-Key hinterlegen.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <form
            className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm md:p-6"
            onSubmit={handleSubmit}
          >
            <div className="mb-5 flex flex-wrap gap-2">
              {(["top", "side"] as PhotoType[]).map((type) => (
                <button
                  className={`rounded-md border px-4 py-2 text-sm font-medium ${
                    photoType === type
                      ? "border-leaf bg-leaf text-white"
                      : "border-ink/12 bg-white text-ink"
                  }`}
                  key={type}
                  onClick={() => setPhotoType(type)}
                  type="button"
                >
                  {photoCopy[type].title}
                </button>
              ))}
            </div>

            <div className="mb-5 rounded-md bg-mist p-4">
              <h2 className="mb-2 text-xl font-semibold">{selectedCopy.title}</h2>
              <p className="leading-6 text-ink/74">{selectedCopy.body}</p>
            </div>

            <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-ink/24 bg-white p-4 text-center">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Ausgewaehltes Foto"
                  className="max-h-72 rounded-md object-contain"
                  src={previewUrl}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-ink/68">
                  <Camera size={34} />
                  <span>Foto aufnehmen oder auswaehlen</span>
                </div>
              )}
              <input
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0] || null)
                }
                type="file"
              />
            </label>

            {error ? (
              <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-clay px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {isLoading ? "Teste Upload und Analyse..." : "Upload testen"}
            </button>
          </form>

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-leaf" size={20} />
              <h2 className="text-xl font-semibold">Ergebnis</h2>
            </div>

            {uploadResult ? (
              <p className="mb-4 rounded-md bg-mist px-3 py-2 text-sm text-ink/76">
                {uploadResult.message}
              </p>
            ) : null}

            {analysis ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-sm text-ink/58">
                    Modus: {analysis.mode === "openai" ? "OpenAI" : "Demo"} ·
                    Sicherheit: {analysis.measurementConfidence}
                  </p>
                  <p className="text-lg font-semibold leading-7">
                    {analysis.recommendation}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {resultItems.map(([label, value]) => (
                    <div className="rounded-md bg-mist p-3" key={label}>
                      <p className="text-xs uppercase text-ink/50">{label}</p>
                      <p className="mt-1 font-semibold">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Metric label="Laenge" value={analysis.footLengthMm} />
                  <Metric label="Breite" value={analysis.footWidthMm} />
                  <Metric label="Rist55" value={analysis.rist55Mm} />
                </div>

                <ul className="space-y-2 text-sm leading-6 text-ink/70">
                  {analysis.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-ink/62">
                Noch kein Foto getestet. Im Demo-Modus wird kein Bild
                gespeichert, bis Supabase konfiguriert ist.
              </p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md border border-ink/10 p-3">
      <p className="text-xs uppercase text-ink/50">{label}</p>
      <p className="mt-1 font-semibold">{value ? `${value} mm` : "offen"}</p>
    </div>
  );
}
