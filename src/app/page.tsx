"use client";

import {
  Camera,
  CheckCircle2,
  Footprints,
  Loader2,
  Ruler,
  Save,
  Store,
  Upload,
} from "lucide-react";
import { FormEvent, useState } from "react";
import type { FitAnalysis } from "@/lib/fit-analysis";

type Flow = "customer" | "shop";
type PhotoType = "top" | "side";
type MeasurementSource = "insole" | "inside_shoe" | "outsole_estimated";

type UploadResult = {
  mode: "demo" | "supabase";
  imageUrl: string | null;
  path: string | null;
  message: string;
};

const flowCopy = {
  customer: {
    title: "Kunde",
    intro:
      "Fuss mit A4-Referenz fotografieren, vom LLM schaetzen lassen und als FootScan speichern.",
  },
  shop: {
    title: "Shop",
    intro:
      "Schuh oder Einlegesohle fotografieren, nutzbare Innenmasse schaetzen lassen und als ShoeReference speichern.",
  },
};

const photoCopy: Record<Flow, Record<PhotoType, { title: string; body: string }>> = {
  customer: {
    top: {
      title: "Fuss von oben",
      body: "Groesseren Fuss barfuss auf ein A4-Blatt stellen. Innenseite an die Blattkante, Ferse an das untere Blattende. Senkrecht von oben fotografieren.",
    },
    side: {
      title: "Fuss von der Seite",
      body: "Fuss auf dem A4-Blatt lassen. Auf Fusshoehe parallel zum Boden fotografieren, damit Rist55 eingeschaetzt werden kann.",
    },
  },
  shop: {
    top: {
      title: "Einlegesohle oder Schuh von oben",
      body: "Wenn moeglich Einlegesohle fotografieren. Sonst Innenschuh oder Aussenschuh von oben fotografieren und Messquelle passend setzen.",
    },
    side: {
      title: "Schuh von der Seite",
      body: "Schuh seitlich fotografieren, damit Volumen/Rist-Risiko als Modellwissen erfasst werden kann.",
    },
  },
};

export default function Home() {
  const [flow, setFlow] = useState<Flow>("customer");
  const [photoType, setPhotoType] = useState<PhotoType>("top");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerLabel, setCustomerLabel] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [euSize, setEuSize] = useState("");
  const [measurementSource, setMeasurementSource] =
    useState<MeasurementSource>("insole");
  const [staffNotes, setStaffNotes] = useState("");

  const selectedCopy = photoCopy[flow][photoType];

  function resetResult() {
    setUploadResult(null);
    setAnalysis(null);
    setSavedId(null);
    setError(null);
  }

  function handleFlowChange(nextFlow: Flow) {
    setFlow(nextFlow);
    setPhotoType("top");
    handleFileChange(null);
    resetResult();
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    resetResult();

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

    if (flow === "shop" && (!brand || !model || !euSize)) {
      setError("Bitte Marke, Modell und Groesse erfassen.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSavedId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("photoType", `${flow}/${photoType}`);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: uploadJson.imageUrl || undefined,
          photoType,
          targetType: flow === "shop" ? "shoe" : "foot",
        }),
      });
      const analyzeJson = await analyzeResponse.json();

      if (!analyzeResponse.ok) {
        throw new Error(analyzeJson.error || "Analyse fehlgeschlagen.");
      }

      setAnalysis(analyzeJson);
      await saveObject(analyzeJson, uploadJson);
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

  async function saveObject(nextAnalysis: FitAnalysis, nextUpload: UploadResult) {
    const endpoint = flow === "customer" ? "/api/foot-scans" : "/api/shoe-references";
    const body =
      flow === "customer"
        ? {
            customerLabel,
            topPhotoPath: photoType === "top" ? nextUpload.path : null,
            sidePhotoPath: photoType === "side" ? nextUpload.path : null,
            analysis: nextAnalysis,
            rawAnalysis: nextAnalysis,
          }
        : {
            brand,
            model,
            euSize,
            measurementSource,
            topPhotoPath: photoType === "top" ? nextUpload.path : null,
            sidePhotoPath: photoType === "side" ? nextUpload.path : null,
            staffNotes,
            analysis: nextAnalysis,
            rawAnalysis: nextAnalysis,
          };

    const saveResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const saveJson = await saveResponse.json();

    if (!saveResponse.ok) {
      throw new Error(saveJson.error || "Speichern fehlgeschlagen.");
    }

    setSavedId(saveJson.id || "demo");
  }

  return (
    <main className="min-h-screen bg-mist">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-5 md:grid-cols-[0.86fr_1.14fr] md:px-8 md:py-10">
        <aside className="flex flex-col justify-between gap-8 rounded-lg bg-ink p-6 text-white md:p-8">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-leaf">
                <Ruler size={20} />
              </div>
              <div>
                <p className="text-sm text-white/70">MVP Durchstich</p>
                <h1 className="text-2xl font-semibold tracking-normal">
                  Barfuss Schuh Fitter
                </h1>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-lg leading-7 text-white/88">
                Zwei Rollen, zwei Objekte, eine spaeter versionierbare
                Matching-Logik.
              </p>
              <div className="grid gap-3 text-sm">
                <InfoItem label="Shop" value="ShoeReference erfassen" />
                <InfoItem label="Kunde" value="FootScan erfassen" />
                <InfoItem label="Matching" value="Business-Regeln versionieren" />
              </div>
            </div>
          </div>

          <p className="text-sm leading-6 text-white/64">
            V1 nutzt LLM-Schaetzungen fuer Fotoauswertung. Die eigentliche
            Bewertung bleibt als separates Business-Logik-Objekt modelliert.
          </p>
        </aside>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-ink/10 bg-white p-2 shadow-sm">
            <FlowButton
              active={flow === "customer"}
              icon={<Footprints size={18} />}
              label="Kunde"
              onClick={() => handleFlowChange("customer")}
            />
            <FlowButton
              active={flow === "shop"}
              icon={<Store size={18} />}
              label="Shop"
              onClick={() => handleFlowChange("shop")}
            />
          </div>

          <form
            className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm md:p-6"
            onSubmit={handleSubmit}
          >
            <div className="mb-5">
              <p className="text-sm font-semibold uppercase text-ink/50">
                {flowCopy[flow].title}
              </p>
              <p className="mt-1 leading-6 text-ink/72">{flowCopy[flow].intro}</p>
            </div>

            {flow === "customer" ? (
              <label className="mb-4 block">
                <span className="mb-1 block text-sm font-medium">Kundenlabel</span>
                <input
                  className="w-full rounded-md border border-ink/14 px-3 py-2"
                  onChange={(event) => setCustomerLabel(event.target.value)}
                  placeholder="z.B. Testkunde Laden A"
                  value={customerLabel}
                />
              </label>
            ) : (
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <TextInput label="Marke" onChange={setBrand} value={brand} />
                <TextInput label="Modell" onChange={setModel} value={model} />
                <TextInput label="EU Groesse" onChange={setEuSize} value={euSize} />
                <label className="md:col-span-2">
                  <span className="mb-1 block text-sm font-medium">Messquelle</span>
                  <select
                    className="w-full rounded-md border border-ink/14 px-3 py-2"
                    onChange={(event) =>
                      setMeasurementSource(event.target.value as MeasurementSource)
                    }
                    value={measurementSource}
                  >
                    <option value="insole">Einlegesohle</option>
                    <option value="inside_shoe">Innenschuh</option>
                    <option value="outsole_estimated">Aussenschuh geschaetzt</option>
                  </select>
                </label>
                <TextInput label="Notiz" onChange={setStaffNotes} value={staffNotes} />
              </div>
            )}

            <div className="mb-5 flex flex-wrap gap-2">
              {(["top", "side"] as PhotoType[]).map((type) => (
                <button
                  className={`rounded-md border px-4 py-2 text-sm font-medium ${
                    photoType === type
                      ? "border-leaf bg-leaf text-white"
                      : "border-ink/12 bg-white text-ink"
                  }`}
                  key={type}
                  onClick={() => {
                    setPhotoType(type);
                    handleFileChange(null);
                  }}
                  type="button"
                >
                  {photoCopy[flow][type].title}
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
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Upload size={18} />
              )}
              {isLoading ? "Analysiere und speichere..." : "Foto erfassen"}
            </button>
          </form>

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-leaf" size={20} />
              <h2 className="text-xl font-semibold">Ergebnis</h2>
            </div>

            {uploadResult ? (
              <p className="mb-3 rounded-md bg-mist px-3 py-2 text-sm text-ink/76">
                {uploadResult.message}
              </p>
            ) : null}

            {savedId ? (
              <p className="mb-4 flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                <Save size={16} />
                {flow === "customer" ? "FootScan" : "ShoeReference"} gespeichert:
                {savedId}
              </p>
            ) : null}

            {analysis ? (
              <Result analysis={analysis} flow={flow} />
            ) : (
              <p className="text-ink/62">
                Noch kein Objekt erfasst. Nach Upload und Analyse wird hier das
                gespeicherte Ergebnis angezeigt.
              </p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function FlowButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-md px-3 py-3 font-semibold ${
        active ? "bg-ink text-white" : "bg-mist text-ink"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function TextInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        className="w-full rounded-md border border-ink/14 px-3 py-2"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function Result({ analysis, flow }: { analysis: FitAnalysis; flow: Flow }) {
  const metrics =
    flow === "shop"
      ? [
          ["Nutzlaenge", analysis.footLengthMm],
          ["Nutzbreite", analysis.footWidthMm],
          ["Rist55", analysis.rist55Mm],
        ]
      : [
          ["Fusslaenge", analysis.footLengthMm],
          ["Fussbreite", analysis.footWidthMm],
          ["Rist55", analysis.rist55Mm],
        ];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm text-ink/58">
          Modus: {analysis.mode === "openai" ? "OpenAI" : "Demo"} · Sicherheit:
          {analysis.measurementConfidence}
        </p>
        <p className="text-lg font-semibold leading-7">{analysis.recommendation}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ["Laenge", analysis.checks.length],
          ["Breite", analysis.checks.width],
          ["Zehenbox", analysis.checks.toeBox],
          ["Rist/Volumen", analysis.checks.instep],
        ].map(([label, value]) => (
          <div className="rounded-md bg-mist p-3" key={label}>
            <p className="text-xs uppercase text-ink/50">{label}</p>
            <p className="mt-1 font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        {metrics.map(([label, value]) => (
          <Metric key={label} label={label as string} value={value as number | null} />
        ))}
      </div>

      <ul className="space-y-2 text-sm leading-6 text-ink/70">
        {analysis.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/14 bg-white/6 p-3">
      <p className="text-xs uppercase text-white/48">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
