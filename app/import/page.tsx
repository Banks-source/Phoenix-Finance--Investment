"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { Upload, FileText, X } from "lucide-react";

interface FileEntry {
  name: string;
  csv: string;
}

interface ImportResult {
  imported: number;
  perFile: { name: string; institution: string; parsed: number; imported: number; skipped: number }[];
}

export default function ImportPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const entries: FileEntry[] = [];
    for (const f of Array.from(list)) {
      entries.push({ name: f.name, csv: await f.text() });
    }
    setFiles((prev) => [...prev, ...entries]);
    setResult(null);
  }

  async function upload() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ImportResult;
      setResult(data);
      setFiles([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Import" subtitle="Upload bank CSV exports (NAB or CBA)" />

      <label
        className="card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 p-10 text-center hover:border-indigo-300 hover:bg-indigo-50/30"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="text-gray-400" />
        <div className="text-sm font-medium">Drop CSV files here or click to browse</div>
        <div className="text-xs text-gray-500">NAB and CBA formats auto-detected</div>
        <input
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </label>

      {files.length > 0 && (
        <div className="card divide-y divide-gray-100">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <FileText size={16} className="text-gray-400" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-gray-400">{Math.round(f.csv.length / 1024)} KB</span>
              <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                <X size={15} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
          ))}
          <div className="flex justify-end px-4 py-3">
            <button className="btn-primary" onClick={upload} disabled={busy}>
              {busy ? "Importing…" : `Import ${files.length} file${files.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {error && <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {result && (
        <div className="card space-y-3 p-5">
          <div className="text-sm">
            Imported <span className="font-semibold">{result.imported}</span> new transactions.
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="py-1.5">File</th>
                <th className="py-1.5">Bank</th>
                <th className="py-1.5 text-right">Parsed</th>
                <th className="py-1.5 text-right">Imported</th>
                <th className="py-1.5 text-right">Skipped</th>
              </tr>
            </thead>
            <tbody>
              {result.perFile.map((f) => (
                <tr key={f.name} className="border-t border-gray-100">
                  <td className="py-1.5">{f.name}</td>
                  <td className="py-1.5 uppercase">{f.institution}</td>
                  <td className="py-1.5 text-right tabular">{f.parsed}</td>
                  <td className="py-1.5 text-right tabular">{f.imported}</td>
                  <td className="py-1.5 text-right tabular text-gray-400">{f.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <a href="/review" className="btn-primary inline-flex w-fit">
            Review imported →
          </a>
        </div>
      )}
    </div>
  );
}
