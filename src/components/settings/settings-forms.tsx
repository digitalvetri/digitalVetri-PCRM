"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CompanyProfile {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
}

type AiProvider = "openai" | "claude" | "gemini" | "groq";

const AI_PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: "gemini", label: "Google Gemini (recommended)" },
  { value: "groq", label: "Groq (Llama — fast & free)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "claude", label: "Anthropic Claude" },
];

async function patchSettings(body: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Update failed");
}

export function CompanyProfileForm({
  initial,
  disabled,
}: {
  initial: CompanyProfile;
  disabled?: boolean;
}) {
  const router = useRouter();
  const fieldBaseId = React.useId();
  const addressId = React.useId();
  const [profile, setProfile] = React.useState<CompanyProfile>(initial);
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof CompanyProfile>(key: K, value: string) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await patchSettings({ companyProfile: profile });
      toast.success("Company profile saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: keyof CompanyProfile; label: string; type?: string }[] = [
    { key: "name", label: "Company Name" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone" },
    { key: "website", label: "Website" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Profile</CardTitle>
        <p className="text-sm text-muted-foreground">
          These details appear on generated proposals and outreach.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`${fieldBaseId}-${f.key}`}>{f.label}</Label>
              <Input
                id={`${fieldBaseId}-${f.key}`}
                type={f.type ?? "text"}
                value={profile[f.key]}
                disabled={disabled}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={addressId}>Address</Label>
          <Input
            id={addressId}
            value={profile.address}
            disabled={disabled}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>
        {disabled ? (
          <p className="text-xs text-muted-foreground">
            Only administrators can edit the company profile.
          </p>
        ) : (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Profile"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AiProviderForm({
  initialProvider,
  disabled,
}: {
  initialProvider: AiProvider;
  disabled?: boolean;
}) {
  const router = useRouter();
  const providerId = React.useId();
  const [provider, setProvider] = React.useState<AiProvider>(initialProvider);
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      await patchSettings({ aiProvider: provider });
      toast.success("AI provider updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Provider</CardTitle>
        <p className="text-sm text-muted-foreground">
          The model provider used to analyse companies and generate content.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor={providerId}>Provider</Label>
          <Select
            value={provider}
            onValueChange={(v) => setProvider(v as AiProvider)}
            disabled={disabled}
          >
            <SelectTrigger id={providerId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            API keys are configured via environment variables on the server and are not editable
            here for security. Switching the provider only takes effect if the matching API key is
            present.
          </span>
        </div>

        {disabled ? (
          <p className="text-xs text-muted-foreground">
            Only administrators can change the AI provider.
          </p>
        ) : (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Provider"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
