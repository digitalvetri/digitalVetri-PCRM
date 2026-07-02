"use client";

import * as React from "react";
import { toast } from "sonner";
import { Mic, Square, Send, Trash2, StickyNote, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, relativeTime, initials } from "@/lib/utils";

export interface NoteItem {
  id: string;
  content: string;
  createdAt: string; // ISO
  author: { id: string; name: string };
}

// Minimal typing for the (un-typed) Web Speech API.
interface SpeechResultList {
  readonly length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Manual notes for a client (company). Supports voice dictation via the browser
 * Web Speech API — spoken words are transcribed into the note, which the user
 * reviews and saves against the related company.
 */
export function NotesPanel({
  companyId,
  initialNotes,
  currentUserId,
  canWrite,
  canDeleteAny = false,
}: {
  companyId: string;
  initialNotes: NoteItem[];
  currentUserId: string;
  canWrite: boolean;
  canDeleteAny?: boolean;
}) {
  const [notes, setNotes] = React.useState<NoteItem[]>(initialNotes);
  const [content, setContent] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [listening, setListening] = React.useState(false);
  const [voiceSupported, setVoiceSupported] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = React.useRef("");

  React.useEffect(() => {
    setVoiceSupported(getSpeechCtor() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  function toggleVoice() {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    baseTextRef.current = content ? content.trimEnd() + " " : "";
    rec.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (finalText) baseTextRef.current += finalText;
      setContent(baseTextRef.current + interim);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone access was blocked. Allow it in your browser to dictate notes.");
      } else if (e.error !== "aborted" && e.error !== "no-speech") {
        toast.error(`Voice input error: ${e.error}`);
      }
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* start() throws if already started — ignore */
    }
  }

  async function addNote() {
    const text = content.trim();
    if (!text || saving) return;
    recognitionRef.current?.stop();
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add note");
      setNotes((n) => [json.note as NoteItem, ...n]);
      setContent("");
      toast.success("Note added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete note");
      setNotes((n) => n.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete note");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" /> Notes
        </CardTitle>
        {notes.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {canWrite && (
          <div className="space-y-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add a note about this client — or tap Speak to dictate…"
              rows={3}
              aria-label="New note"
              className={cn(listening && "ring-2 ring-primary/50")}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {voiceSupported ? (
                <Button
                  type="button"
                  variant={listening ? "default" : "outline"}
                  size="sm"
                  onClick={toggleVoice}
                  aria-pressed={listening}
                >
                  {listening ? (
                    <>
                      <Square className="h-4 w-4" /> Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" /> Speak
                    </>
                  )}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Voice input isn’t supported in this browser.</span>
              )}
              <Button type="button" size="sm" onClick={addNote} disabled={saving || !content.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Add note
              </Button>
            </div>
            {listening && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary" role="status">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                Listening… speak now
              </p>
            )}
          </div>
        )}

        <ul className="space-y-3">
          {notes.length === 0 ? (
            <li className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              No notes yet{canWrite ? " — add the first one above." : "."}
            </li>
          ) : (
            notes.map((n) => (
              <li key={n.id} className="group rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {initials(n.author.name)}
                    </span>
                    <span className="text-xs font-medium">{n.author.name}</span>
                    <span className="text-xs text-muted-foreground">· {relativeTime(n.createdAt)}</span>
                  </div>
                  {(n.author.id === currentUserId || canDeleteAny) && (
                    <button
                      type="button"
                      onClick={() => deleteNote(n.id)}
                      disabled={deletingId === n.id}
                      aria-label="Delete note"
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{n.content}</p>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
