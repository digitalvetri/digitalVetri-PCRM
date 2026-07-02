"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDUSTRIES } from "@/lib/constants";

const NONE = "NONE";

export function AddCompanyDialog({ industries = [] }: { industries?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [analyseAfter, setAnalyseAfter] = React.useState(true);

  const nameId = React.useId();
  const websiteId = React.useId();
  const industryId = React.useId();
  const employeesId = React.useId();
  const cityId = React.useId();
  const stateId = React.useId();
  const phoneId = React.useId();
  const publicEmailId = React.useId();
  const addressId = React.useId();

  const [form, setForm] = React.useState({
    name: "",
    website: "",
    industry: NONE,
    city: "",
    state: "",
    phone: "",
    publicEmail: "",
    address: "",
    employeeEstimate: "",
  });

  const industryOptions = React.useMemo(() => {
    return Array.from(new Set([...INDUSTRIES, ...industries])).sort();
  }, [industries]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm({
      name: "",
      website: "",
      industry: NONE,
      city: "",
      state: "",
      phone: "",
      publicEmail: "",
      address: "",
      employeeEstimate: "",
    });
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Company name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          website: form.website.trim() || null,
          industry: form.industry === NONE ? null : form.industry,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          phone: form.phone.trim() || null,
          publicEmail: form.publicEmail.trim() || null,
          address: form.address.trim() || null,
          employeeEstimate: form.employeeEstimate ? Number(form.employeeEstimate) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add company");
      const companyId: string = json.company.id;
      toast.success(`${json.company.name} added.`);

      if (analyseAfter) {
        const toastId = toast.loading("Running AI analysis…");
        try {
          const aRes = await fetch(`/api/companies/${companyId}/analyze`, { method: "POST" });
          const aJson = await aRes.json();
          if (!aRes.ok) throw new Error(aJson.error ?? "Analysis failed");
          toast.success("AI analysis complete.", { id: toastId });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Analysis failed", { id: toastId });
        }
      }

      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add company");
    } finally {
      setSaving(false);
    }
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
        <Button>
          <Plus className="h-4 w-4" /> Add Company
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Company</DialogTitle>
          <DialogDescription>Manually enter a company. You can run AI analysis right away.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={nameId}>Company name *</Label>
            <Input id={nameId} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Acme Industries Pvt Ltd" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={websiteId}>Website</Label>
            <Input id={websiteId} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={industryId}>Industry</Label>
            <Select value={form.industry} onValueChange={(v) => set("industry", v)}>
              <SelectTrigger id={industryId}>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not specified</SelectItem>
                {industryOptions.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={employeesId}>Employees (estimate)</Label>
            <Input
              id={employeesId}
              type="number"
              value={form.employeeEstimate}
              onChange={(e) => set("employeeEstimate", e.target.value)}
              placeholder="50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={cityId}>City</Label>
            <Input id={cityId} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Coimbatore" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={stateId}>State</Label>
            <Input id={stateId} value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Tamil Nadu" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={phoneId}>Phone</Label>
            <Input id={phoneId} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={publicEmailId}>Public email</Label>
            <Input id={publicEmailId} value={form.publicEmail} onChange={(e) => set("publicEmail", e.target.value)} placeholder="info@example.com" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={addressId}>Address</Label>
            <Input id={addressId} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, area, pincode" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="analyseAfter" checked={analyseAfter} onCheckedChange={(v) => setAnalyseAfter(v === true)} />
          <Label htmlFor="analyseAfter" className="cursor-pointer text-sm font-normal">
            Run AI analysis now
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Add Company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
