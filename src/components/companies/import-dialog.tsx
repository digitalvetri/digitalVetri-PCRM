"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Plus, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/misc";

interface ImportResult {
  imported: number;
  enriched: number;
  errors: string[];
  note?: string;
}

const PUBLIC_NOTE = "Uses only publicly available business information.";

export function ImportDialog() {
  const router = useRouter();
  const fileId = React.useId();
  const websiteBaseId = React.useId();
  const mapsBaseId = React.useId();
  const linkedinBaseId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [enrich, setEnrich] = React.useState(true);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  // Excel/CSV
  const [file, setFile] = React.useState<File | null>(null);

  // Website rows
  const [websiteRows, setWebsiteRows] = React.useState([{ name: "", website: "" }]);
  // Google Maps rows
  const [mapsRows, setMapsRows] = React.useState([{ name: "", sourceUrl: "", city: "" }]);
  // LinkedIn rows
  const [linkedinRows, setLinkedinRows] = React.useState([{ name: "", linkedinUrl: "" }]);

  function reset() {
    setResult(null);
    setFile(null);
    setWebsiteRows([{ name: "", website: "" }]);
    setMapsRows([{ name: "", sourceUrl: "", city: "" }]);
    setLinkedinRows([{ name: "", linkedinUrl: "" }]);
  }

  function hostnameFrom(url: string): string {
    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  async function submitFile() {
    if (!file) {
      toast.error("Choose an Excel or CSV file first.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("enrich", String(enrich));
    await run(() => fetch("/api/companies/import", { method: "POST", body: fd }));
  }

  async function submitJson(source: "WEBSITE" | "GOOGLE_MAPS" | "LINKEDIN", entries: Record<string, unknown>[]) {
    if (entries.length === 0) {
      toast.error("Add at least one entry.");
      return;
    }
    await run(() =>
      fetch("/api/companies/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, enrich, entries }),
      })
    );
  }

  async function run(fn: () => Promise<Response>) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fn();
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      const r: ImportResult = {
        imported: json.imported ?? 0,
        enriched: json.enriched ?? 0,
        errors: json.errors ?? [],
        note: json.note,
      };
      setResult(r);
      if (r.imported > 0) toast.success(`Imported ${r.imported} compan${r.imported === 1 ? "y" : "ies"}.`);
      else toast.error("No companies were imported.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  function submitWebsite() {
    const entries = websiteRows
      .filter((r) => r.website.trim() || r.name.trim())
      .map((r) => ({
        name: r.name.trim() || hostnameFrom(r.website),
        website: r.website.trim() || null,
      }));
    submitJson("WEBSITE", entries);
  }

  function submitMaps() {
    const entries = mapsRows
      .filter((r) => r.name.trim() || r.sourceUrl.trim())
      .map((r) => ({
        name: r.name.trim() || hostnameFrom(r.sourceUrl),
        sourceUrl: r.sourceUrl.trim() || null,
        city: r.city.trim() || null,
      }));
    submitJson("GOOGLE_MAPS", entries);
  }

  function submitLinkedin() {
    const entries = linkedinRows
      .filter((r) => r.name.trim() || r.linkedinUrl.trim())
      .map((r) => ({
        name: r.name.trim() || hostnameFrom(r.linkedinUrl),
        linkedinUrl: r.linkedinUrl.trim() || null,
      }));
    submitJson("LINKEDIN", entries);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Companies</DialogTitle>
          <DialogDescription>
            Bring in companies from a spreadsheet, website, Google Maps or LinkedIn.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Import complete
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Imported</p>
                <p className="text-2xl font-bold">{result.imported}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">AI Enriched</p>
                <p className="text-2xl font-bold">{result.enriched}</p>
              </div>
            </div>
            {result.note && <p className="text-xs text-muted-foreground">{result.note}</p>}
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {result.errors.length} row{result.errors.length === 1 ? "" : "s"} could not be imported
                </p>
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto text-xs text-muted-foreground">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Import more
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                  router.refresh();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Tabs defaultValue="excel">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="excel">Excel/CSV</TabsTrigger>
                <TabsTrigger value="website">Website URL</TabsTrigger>
                <TabsTrigger value="maps">Google Maps</TabsTrigger>
                <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
              </TabsList>

              {/* Excel / CSV */}
              <TabsContent value="excel" className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={fileId}>Spreadsheet file</Label>
                  <Input
                    id={fileId}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Accepts .xlsx, .xls or .csv with company name, website, city and similar columns.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={submitFile} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {loading ? "Importing…" : "Import file"}
                  </Button>
                </div>
              </TabsContent>

              {/* Website */}
              <TabsContent value="website" className="space-y-3">
                {websiteRows.map((row, i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`${websiteBaseId}-name-${i}`} className={i === 0 ? "" : "sr-only"}>Company name (optional)</Label>
                      <Input
                        id={`${websiteBaseId}-name-${i}`}
                        placeholder="Company name"
                        value={row.name}
                        onChange={(e) =>
                          setWebsiteRows((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                        }
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`${websiteBaseId}-url-${i}`} className={i === 0 ? "" : "sr-only"}>Website URL</Label>
                      <Input
                        id={`${websiteBaseId}-url-${i}`}
                        placeholder="https://example.com"
                        value={row.website}
                        onChange={(e) =>
                          setWebsiteRows((rows) => rows.map((r, j) => (j === i ? { ...r, website: e.target.value } : r)))
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mb-0.5 h-9 w-9"
                      aria-label="Remove row"
                      disabled={websiteRows.length === 1}
                      onClick={() => setWebsiteRows((rows) => rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWebsiteRows((rows) => [...rows, { name: "", website: "" }])}
                >
                  <Plus className="h-4 w-4" /> Add row
                </Button>
                <div className="flex justify-end">
                  <Button onClick={submitWebsite} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading ? "Importing…" : "Import websites"}
                  </Button>
                </div>
              </TabsContent>

              {/* Google Maps */}
              <TabsContent value="maps" className="space-y-3">
                {mapsRows.map((row, i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`${mapsBaseId}-name-${i}`} className={i === 0 ? "" : "sr-only"}>Business name</Label>
                      <Input
                        id={`${mapsBaseId}-name-${i}`}
                        placeholder="Business name"
                        value={row.name}
                        onChange={(e) =>
                          setMapsRows((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                        }
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`${mapsBaseId}-url-${i}`} className={i === 0 ? "" : "sr-only"}>Maps place URL (optional)</Label>
                      <Input
                        id={`${mapsBaseId}-url-${i}`}
                        placeholder="https://maps.google.com/…"
                        value={row.sourceUrl}
                        onChange={(e) =>
                          setMapsRows((rows) => rows.map((r, j) => (j === i ? { ...r, sourceUrl: e.target.value } : r)))
                        }
                      />
                    </div>
                    <div className="w-32 space-y-1.5">
                      <Label htmlFor={`${mapsBaseId}-city-${i}`} className={i === 0 ? "" : "sr-only"}>City</Label>
                      <Input
                        id={`${mapsBaseId}-city-${i}`}
                        placeholder="City"
                        value={row.city}
                        onChange={(e) =>
                          setMapsRows((rows) => rows.map((r, j) => (j === i ? { ...r, city: e.target.value } : r)))
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mb-0.5 h-9 w-9"
                      aria-label="Remove row"
                      disabled={mapsRows.length === 1}
                      onClick={() => setMapsRows((rows) => rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapsRows((rows) => [...rows, { name: "", sourceUrl: "", city: "" }])}
                >
                  <Plus className="h-4 w-4" /> Add row
                </Button>
                <p className="text-xs text-muted-foreground">{PUBLIC_NOTE}</p>
                <div className="flex justify-end">
                  <Button onClick={submitMaps} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading ? "Importing…" : "Import from Maps"}
                  </Button>
                </div>
              </TabsContent>

              {/* LinkedIn */}
              <TabsContent value="linkedin" className="space-y-3">
                {linkedinRows.map((row, i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`${linkedinBaseId}-name-${i}`} className={i === 0 ? "" : "sr-only"}>Company name</Label>
                      <Input
                        id={`${linkedinBaseId}-name-${i}`}
                        placeholder="Company name"
                        value={row.name}
                        onChange={(e) =>
                          setLinkedinRows((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                        }
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`${linkedinBaseId}-url-${i}`} className={i === 0 ? "" : "sr-only"}>LinkedIn URL</Label>
                      <Input
                        id={`${linkedinBaseId}-url-${i}`}
                        placeholder="https://linkedin.com/company/…"
                        value={row.linkedinUrl}
                        onChange={(e) =>
                          setLinkedinRows((rows) =>
                            rows.map((r, j) => (j === i ? { ...r, linkedinUrl: e.target.value } : r))
                          )
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mb-0.5 h-9 w-9"
                      aria-label="Remove row"
                      disabled={linkedinRows.length === 1}
                      onClick={() => setLinkedinRows((rows) => rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLinkedinRows((rows) => [...rows, { name: "", linkedinUrl: "" }])}
                >
                  <Plus className="h-4 w-4" /> Add row
                </Button>
                <p className="text-xs text-muted-foreground">{PUBLIC_NOTE}</p>
                <div className="flex justify-end">
                  <Button onClick={submitLinkedin} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading ? "Importing…" : "Import from LinkedIn"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center gap-2 border-t pt-3">
              <Checkbox
                id="enrich"
                checked={enrich}
                onCheckedChange={(v) => setEnrich(v === true)}
              />
              <Label htmlFor="enrich" className="cursor-pointer text-sm font-normal">
                Analyse with AI after import
              </Label>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
