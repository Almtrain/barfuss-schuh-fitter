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

type PhotoState = {
  file: File | null;
  previewUrl: string | null;
};

const emptyPhoto: PhotoState = {
  file: null,
  previewUrl: null,
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
      "Marke, Modell und Groesse erfassen. Danach zwei Pflichtfotos aufnehmen: oben und seitlich.",
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
      title: "Foto 1: von oben",
      body: "Einlegesohle auf ein A4-Blatt legen. Falls keine Einlegesohle moeglich ist: Schuh von oben fotografieren und Messquelle auf Aussenschuh geschaetzt setzen.",
    },
    side: {
      title: "Foto 2: von der Seite",
      body: "Schuh seitlich auf gleicher Flaeche fotografieren. Dieses Foto hilft fuer Volumen, Rist und Konstruktion.",
    },
  },
};

export default function Home() {
  const [flow, setFlow] = useState<Flow>("customer");
  const [customerPhotoType, setCustomerPhotoType] = useState<PhotoType>("top");
  const [customerPhoto, setCustomerPhoto] = useState<PhotoState>(emptyPhoto);
  const [shopPhotos, setShopPhotos] = useState<Record<PhotoType, PhotoState>>({
    top: emptyPhoto,
    side: emptyPhoto,
  });
  const [uploadResult, setUploadResult] = useState<string | null>(null);
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

  function resetResult() {
    setUploadResult(null);
    setAnalysis(null);
    setSavedId(null);
    setError(null);
  }

  function clearPhoto(photo: PhotoState) {
    if (photo.previewUrl) {
      URL.revokeObjectURL(photo.previewUrl);
    }
  }

  function handleFlowChange(nextFlow: Flow) {
    setFlow(nextFlow);
    resetResult();
  }

  function setCustomerFile(nextFile: File | null) {
    clearPhoto(customerPhoto);
    setCustomerPhoto({
      file: nextFile,
      previewUrl: nextFile ? URL.createObjectURL(nextFile) : null,
    });
    resetResult();
  }

  function setShopFile(type: PhotoType, nextFile: File | null) {
    clearPhoto(shopPhotos[type]);
    setShopPhotos((current) => ({
      ...current,
      [type]: {
        file: nextFile,
        previewUrl: nextFile ? URL.createObjectURL(nextFile) : null,
      },
    }));
    resetResult();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSavedId(null);

    try {
      if (flow === "customer") {
        await submitCustomerFlow();
      } else {
        await submitShopFlow();
      }
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

  async function submitCustomerFlow() {
    if (!customerPhoto.file) {
      throw new Error("Bitte zuerst ein Foto auswaehlen.");
    }

    const upload = await uploadPhoto(customerPhoto.file, `customer/${customerPhotoType}`);
    const nextAnalysis = await analyzePhoto(upload.imageUrl, customerPhotoType, "foot");

    setUploadResult(upload.message);
    setAnalysis(nextAnalysis);

    const saveResponse = await fetch("/api/foot-scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerLabel,
        topPhotoPath: customerPhotoType === "top" ? upload.path : null,
        sidePhotoPath: customerPhotoType === "side" ? upload.path : null,
        analysis: nextAnalysis,
        rawAnalysis: nextAnalysis,
      }),
    });
    const saveJson = await saveResponse.json();

    if (!saveResponse.ok) {
      throw new Error(saveJson.error || "Speichern fehlgeschlagen.");
    }

    setSavedId(saveJson.id || "demo");
  }

  async function submitShopFlow() {
    if (!brand || !model || !euSize) {
      throw new Error("Bitte Marke, Modell und Groesse erfassen.");
    }

    if (!shopPhotos.top.file || !shopPhotos.side.file) {
      throw new Error("Bitte beide Pflichtfotos erfassen: oben und seitlich.");
    }

    const topUpload = await uploadPhoto(shopPhotos.top.file, "shop/top");
    const sideUpload = await uploadPhoto(shopPhotos.side.file, "shop/side");
    const topAnalysis = await analyzePhoto(topUpload.imageUrl, "top", "shoe");
    const sideAnalysis = await analyzePhoto(sideUpload.imageUrl, "side", "shoe");
    const combinedAnalysis = combineShoeAnalyses(topAnalysis, sideAnalysis);

    setUploadResult("Beide Schuhfotos wurden gespeichert.");
    setAnalysis(combinedAnalysis);

    const saveResponse = await fetch("/api/shoe-references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand,
        model,
        euSize,
        measurementSource,
        topPhotoPath: topUpload.path,
        sidePhotoPath: sideUpload.path,
        staffNotes,
        analysis: combinedAnalysis,
        rawAnalysis: {
          top: topAnalysis,
          side: sideAnalysis,
        },
      }),
    });
    const saveJson = await saveResponse.json();

    if (!saveResponse.ok) {
      throw new Error(saveJson.error || "Speichern fehlgeschlagen.");
    }

    setSavedId(saveJson.id || "demo");
  }

  async function uploadPhoto(file: File, photoType: string) {
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

    return uploadJson as UploadResult;
  }

  async function analyzePhoto(
    imageUrl: string | null,
    photoType: PhotoType,
    targetType: "foot" | "shoe",
  ) {
    const analyzeResponse = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: imageUrl || undefined,
        photoType,
        targetType,
      }),
    });
    const analyzeJson = await analyzeResponse.json();

    if (!analyzeResponse.ok) {
      throw new Error(analyzeJson.error || "Analyse fehlgeschlagen.");
    }

    return analyzeJson as FitAnalysis;
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
                <InfoItem label="Shop" value="ShoeReference mit 2 Fotos" />
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
              <CustomerCapture
                customerLabel={customerLabel}
                onCustomerLabelChange={setCustomerLabel}
                onPhotoChange={setCustomerFile}
                onPhotoTypeChange={setCustomerPhotoType}
                photo={customerPhoto}
                photoType={customerPhotoType}
              />
            ) : (
              <ShopCapture
                brand={brand}
                euSize={euSize}
                measurementSource={measurementSource}
                model={model}
                onBrandChange={setBrand}
                onEuSizeChange={setEuSize}
                onMeasurementSourceChange={setMeasurementSource}
                onModelChange={setModel}
                onPhotoChange={setShopFile}
                onStaffNotesChange={setStaffNotes}
                photos={shopPhotos}
                staffNotes={staffNotes}
              />
            )}

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
              {isLoading ? "Analysiere und speichere..." : "Speichern"}
            </button>
          </form>

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-leaf" size={20} />
              <h2 className="text-xl font-semibold">Ergebnis</h2>
            </div>

            {uploadResult ? (
              <p className="mb-3 rounded-md bg-mist px-3 py-2 text-sm text-ink/76">
                {uploadResult}
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

function CustomerCapture({
  customerLabel,
  onCustomerLabelChange,
  onPhotoChange,
  onPhotoTypeChange,
  photo,
  photoType,
}: {
  customerLabel: string;
  onCustomerLabelChange: (value: string) => void;
  onPhotoChange: (file: File | null) => void;
  onPhotoTypeChange: (value: PhotoType) => void;
  photo: PhotoState;
  photoType: PhotoType;
}) {
  return (
    <>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Kundenlabel</span>
        <input
          className="w-full rounded-md border border-ink/14 px-3 py-2"
          onChange={(event) => onCustomerLabelChange(event.target.value)}
          placeholder="z.B. Testkunde Laden A"
          value={customerLabel}
        />
      </label>

      <div className="mb-5 flex flex-wrap gap-2">
        {(["top", "side"] as PhotoType[]).map((type) => (
          <button
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              photoType === type
                ? "border-leaf bg-leaf text-white"
                : "border-ink/12 bg-white text-ink"
            }`}
            key={type}
            onClick={() => onPhotoTypeChange(type)}
            type="button"
          >
            {photoCopy.customer[type].title}
          </button>
        ))}
      </div>

      <PhotoInput
        body={photoCopy.customer[photoType].body}
        onChange={onPhotoChange}
        photo={photo}
        title={photoCopy.customer[photoType].title}
      />
    </>
  );
}

function ShopCapture({
  brand,
  euSize,
  measurementSource,
  model,
  onBrandChange,
  onEuSizeChange,
  onMeasurementSourceChange,
  onModelChange,
  onPhotoChange,
  onStaffNotesChange,
  photos,
  staffNotes,
}: {
  brand: string;
  euSize: string;
  measurementSource: MeasurementSource;
  model: string;
  onBrandChange: (value: string) => void;
  onEuSizeChange: (value: string) => void;
  onMeasurementSourceChange: (value: MeasurementSource) => void;
  onModelChange: (value: string) => void;
  onPhotoChange: (type: PhotoType, file: File | null) => void;
  onStaffNotesChange: (value: string) => void;
  photos: Record<PhotoType, PhotoState>;
  staffNotes: string;
}) {
  return (
    <>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <TextInput label="Marke" onChange={onBrandChange} value={brand} />
        <TextInput label="Modell" onChange={onModelChange} value={model} />
        <TextInput label="EU Groesse" onChange={onEuSizeChange} value={euSize} />
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium">Messquelle oben</span>
          <select
            className="w-full rounded-md border border-ink/14 px-3 py-2"
            onChange={(event) =>
              onMeasurementSourceChange(event.target.value as MeasurementSource)
            }
            value={measurementSource}
          >
            <option value="insole">Einlegesohle auf A4</option>
            <option value="inside_shoe">Innenschuh von oben</option>
            <option value="outsole_estimated">Aussenschuh geschaetzt</option>
          </select>
        </label>
        <TextInput label="Notiz" onChange={onStaffNotesChange} value={staffNotes} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PhotoInput
          body={photoCopy.shop.top.body}
          onChange={(file) => onPhotoChange("top", file)}
          photo={photos.top}
          required
          title={photoCopy.shop.top.title}
        />
        <PhotoInput
          body={photoCopy.shop.side.body}
          onChange={(file) => onPhotoChange("side", file)}
          photo={photos.side}
          required
          title={photoCopy.shop.side.title}
        />
      </div>
    </>
  );
}

function PhotoInput({
  body,
  onChange,
  photo,
  required = false,
  title,
}: {
  body: string;
  onChange: (file: File | null) => void;
  photo: PhotoState;
  required?: boolean;
  title: string;
}) {
  return (
    <div>
      <div className="mb-3 rounded-md bg-mist p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {required ? (
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-ink/58">
              Pflicht
            </span>
          ) : null}
        </div>
        <p className="leading-6 text-ink/74">{body}</p>
      </div>

      <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-ink/24 bg-white p-4 text-center">
        {photo.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="Ausgewaehltes Foto"
            className="max-h-72 rounded-md object-contain"
            src={photo.previewUrl}
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
          onChange={(event) => onChange(event.target.files?.[0] || null)}
          type="file"
        />
      </label>
    </div>
  );
}

function combineShoeAnalyses(top: FitAnalysis, side: FitAnalysis): FitAnalysis {
  return {
    ...top,
    measurementConfidence:
      top.measurementConfidence === "high" && side.measurementConfidence === "high"
        ? "high"
        : top.measurementConfidence === "low" || side.measurementConfidence === "low"
          ? "low"
          : "medium",
    rist55Mm: side.rist55Mm ?? top.rist55Mm,
    checks: {
      ...top.checks,
      instep: side.checks.instep,
    },
    notes: [
      ...top.notes,
      ...side.notes,
      "Schuhreferenz wurde aus Top- und Seitenfoto kombiniert.",
    ],
  };
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
