"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProposalGenerator } from "@/components/proposals/proposal-generator";

export function NewProposalDialog() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Sparkles className="h-4 w-4" /> Generate Proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Proposal</DialogTitle>
          <DialogDescription>
            Create a full, professional proposal from a company&apos;s AI analysis.
          </DialogDescription>
        </DialogHeader>
        <ProposalGenerator />
      </DialogContent>
    </Dialog>
  );
}
