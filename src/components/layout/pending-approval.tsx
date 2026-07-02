import { SignOutButton } from "@clerk/nextjs";
import { Clock } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

/**
 * Shown to a signed-in user whose account has not yet been activated by an
 * admin. New sign-ups are created inactive (see getCurrentUser) so open
 * registration can't grant access; an admin approves them in Settings → Users.
 */
export function PendingApproval({ email }: { email: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo tileSize={40} subtitle="Sales Intelligence" />
        </div>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Clock className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Account pending approval</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your account <span className="font-medium text-foreground">{email}</span> has been
          created and is awaiting activation by an administrator. You&apos;ll get full access as
          soon as it&apos;s approved.
        </p>
        <div className="mt-7">
          <SignOutButton>
            <Button variant="outline" className="w-full">
              Sign out
            </Button>
          </SignOutButton>
        </div>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Need access sooner? Contact your DigitalVetri administrator.
      </p>
    </div>
  );
}
