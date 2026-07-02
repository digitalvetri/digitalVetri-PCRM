"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MeetingComposer } from "@/components/meetings/meeting-composer";

export function NewMeetingDialog() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New Discovery Meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Discovery Meeting</DialogTitle>
          <DialogDescription>
            Schedule a meeting and generate an industry-tailored discovery questionnaire.
          </DialogDescription>
        </DialogHeader>
        <MeetingComposer onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
