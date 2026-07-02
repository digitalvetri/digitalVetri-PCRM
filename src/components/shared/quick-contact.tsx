"use client";

import Link from "next/link";
import { Mail, MessageCircle, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** International digits for wa.me (strip symbols, default India +91 for 10-digit). */
function normalizeNumber(raw: string): string {
  let d = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) d = "91" + d;
  return d;
}

/**
 * Quick-contact actions for a client — reach out over WhatsApp, email or phone
 * in one tap (recipient pre-filled), or jump to the AI generators with this
 * company pre-selected. No need to open a generator first.
 */
export function QuickContact({
  companyId,
  companyName,
  email,
  phone,
  contactName,
}: {
  companyId: string;
  companyName: string;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
}) {
  const firstName = contactName?.trim().split(/\s+/)[0];
  const greeting = `Hi${firstName ? ` ${firstName}` : ""}, this is DigitalVetri. `;
  const waHref = phone
    ? `https://wa.me/${normalizeNumber(phone)}?text=${encodeURIComponent(greeting)}`
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact {companyName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* WhatsApp */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <MessageCircle className="h-4 w-4 shrink-0 text-[#25d366]" />
            <span className="truncate text-sm text-muted-foreground">{phone ?? "No phone on file"}</span>
          </div>
          {waHref && (
            <Button asChild size="sm" className="bg-[#128C7E] text-white hover:bg-[#0e6f63]">
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </Button>
          )}
        </div>

        {/* Email */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm text-muted-foreground">{email ?? "No email on file"}</span>
          </div>
          {email && (
            <Button asChild size="sm" variant="outline">
              <a href={`mailto:${email}`}>Email</a>
            </Button>
          )}
        </div>

        {/* Call */}
        {phone && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm text-muted-foreground">Call directly</span>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href={`tel:${phone.replace(/\s+/g, "")}`}>Call</a>
            </Button>
          </div>
        )}

        {/* Draft with AI */}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/email-generator?companyId=${companyId}`}>
              <Sparkles className="h-4 w-4" /> AI email
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/whatsapp-generator?companyId=${companyId}`}>
              <Sparkles className="h-4 w-4" /> AI WhatsApp
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
