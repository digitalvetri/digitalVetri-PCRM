"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SERVICES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const field =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function EnquiryForm({ defaultService = "" }: { defaultService?: string }) {
  const [status, setStatus] = React.useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus("sending");
    try {
      const res = await fetch("/api/public/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
      setStatus("done");
      form.reset();
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
          <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold">Thanks — we&apos;ve got it!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Our team will reach out to you shortly. Talk soon.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => setStatus("idle")}>
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      {/* Honeypot — hidden from users, catches bots. */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name *</Label>
          <Input id="name" name="name" required placeholder="e.g. Priya Kumar" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="businessName">Business name</Label>
          <Input id="businessName" name="businessName" placeholder="e.g. Priya Textiles" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone / WhatsApp *</Label>
          <Input id="phone" name="phone" required type="tel" placeholder="e.g. 98765 43210" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@business.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" placeholder="e.g. Coimbatore" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="service">What do you need? *</Label>
          <select id="service" name="service" required defaultValue={defaultService} className={field}>
            <option value="" disabled>
              Select a service…
            </option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Tell us about your project</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder="What are you looking to build or improve?"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" size="lg" disabled={status === "sending"}>
        {status === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          "Request a callback"
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We&apos;ll only use your details to contact you about your enquiry.
      </p>
    </form>
  );
}
