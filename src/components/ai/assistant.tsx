"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, X, Send, Loader2, ArrowRight, Mic, Volume2, VolumeX, RefreshCw, Ear, EarOff, Hand } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRole } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import {
  getSpeechCtor,
  isSpeechSynthesisSupported,
  speakSmart,
  isSpeaking,
  cancelSpeech,
  primeSpeech,
  type SpeechRecognitionLike,
} from "@/lib/speech";

interface ConfirmAction {
  action: "add_company" | "record_payment";
  params: Record<string, unknown>;
  title: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  action?: { type: "navigate"; href: string; label: string };
  speak?: string; // clean narration for text-to-speech (falls back to content)
  confirm?: ConfirmAction; // renders Save/Cancel — a write awaiting an explicit tap
}

// Voice navigation — client-side, instant, no AI. Trigger word + a destination.
const NAV_TRIGGERS = ["open", "go to", "goto", "show me", "show ", "navigate", "take me", "திற", "காட்டு", "போ", "செல்"];
const NAV_MAP: { keys: string[]; href: string; label: string }[] = [
  { keys: ["ai company", "vetri", "வெற்றி", "ஏஐ"], href: "/company", label: "AI Company" },
  { keys: ["command center", "கமாண்ட்"], href: "/command-center", label: "Command Center" },
  { keys: ["client", "compan", "நிறுவன", "கிளையண்ட்"], href: "/companies", label: "Clients" },
  { keys: ["prospect", "deal", "ப்ராஸ்பெக்ட்"], href: "/prospects", label: "Prospects" },
  { keys: ["meeting", "மீட்டிங்"], href: "/meetings", label: "Meetings" },
  { keys: ["proposal", "ப்ரொபோசல்"], href: "/proposals", label: "Proposals" },
  { keys: ["follow", "பாலோ"], href: "/follow-ups", label: "Follow-ups" },
  { keys: ["task", "டாஸ்க்", "பணி"], href: "/tasks", label: "Tasks" },
  { keys: ["calendar", "கேலண்டர்", "நாட்காட்டி"], href: "/calendar", label: "Calendar" },
  { keys: ["report", "analytic", "ரிப்போர்ட்"], href: "/reports", label: "Reports & Analytics" },
  { keys: ["team", "employee", "டீம்", "ஊழியர்"], href: "/team", label: "Team" },
  { keys: ["setting", "செட்டிங்"], href: "/settings", label: "Settings" },
  { keys: ["dashboard", "home", "முகப்பு"], href: "/", label: "Dashboard" },
];
function detectNav(text: string): { href: string; label: string } | null {
  const t = text.toLowerCase().trim();
  // Navigation is a short, terse command ("open reports"), not a sentence
  // ("show me which deals are at risk" — that's a question to answer).
  if (t.split(/\s+/).length > 5) return null;
  if (!NAV_TRIGGERS.some((w) => t.includes(w))) return null;
  for (const n of NAV_MAP) if (n.keys.some((k) => t.includes(k))) return { href: n.href, label: n.label };
  return null;
}

interface CeoBriefing {
  greeting: string;
  headline: string;
  revenue: string;
  focus: string;
  risks: string[];
  actions: { action: string; why: string }[];
  spoken: string;
}

const SUGGESTIONS = [
  "What should I focus on today?",
  "How is my revenue tracking against target?",
  "Which deals are at risk?",
  "Who should I follow up with first?",
];

const VOICE_KEY = "dv-ceo-voice";
const WAKE_KEY = "dv-vetri-wake";
const CLAP_KEY = "dv-vetri-clap";
const LANG_KEY = "dv-vetri-lang";
type Lang = "en" | "ta";
// The names the assistant answers to (spoken), incl. the Tamil word வெற்றி.
const WAKE_WORDS = ["vetri", "vetary", "vetree", "vettri", "hey vetri", "hi vetri", "வெற்றி"];

function stripWakeWord(text: string): string {
  let t = text.toLowerCase();
  for (const w of WAKE_WORDS) {
    const idx = t.indexOf(w);
    if (idx !== -1) return text.slice(idx + w.length).replace(/^[\s,.:!?-]+/, "").trim();
  }
  return text.trim();
}
function containsWakeWord(text: string): boolean {
  const t = text.toLowerCase();
  return WAKE_WORDS.some((w) => t.includes(w));
}

/** Mobile browsers don't support continuous background speech recognition. */
function isMobileDevice(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile|Silk|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/** Render a briefing object into a readable chat message. */
function formatBriefing(b: CeoBriefing): string {
  const L: string[] = [];
  if (b.greeting) L.push(b.greeting);
  if (b.headline) L.push("", b.headline);
  if (b.revenue) L.push("", `💰 ${b.revenue}`);
  if (b.focus) L.push("", `🎯 Today's #1: ${b.focus}`);
  if (b.risks.length) {
    L.push("", "⚠️ Watch:");
    for (const r of b.risks) L.push(`• ${r}`);
  }
  if (b.actions.length) {
    L.push("", "Top moves:");
    b.actions.forEach((a, i) => L.push(`${i + 1}. ${a.action}${a.why ? ` — ${a.why}` : ""}`));
  }
  return L.join("\n");
}

export function AiAssistant() {
  const router = useRouter();
  // The assistant drives paid AI calls; gated to content.generate roles on the
  // server. Read-only VIEWERs don't get the launcher at all.
  const canUse = useRole() !== "VIEWER";
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [savingIdx, setSavingIdx] = React.useState<number | null>(null);
  const [briefingState, setBriefingState] = React.useState<"idle" | "loading" | "done" | "error">("idle");

  // Voice: output (CEO talks back) is a user toggle persisted in localStorage;
  // input (dictation) needs the Web Speech recognition API.
  const [voiceOn, setVoiceOn] = React.useState(false);
  const [voiceInSupported, setVoiceInSupported] = React.useState(false);
  const [voiceOutSupported, setVoiceOutSupported] = React.useState(false);

  // Wake word — "Vetri" always-listening (opt-in).
  const [wakeOn, setWakeOn] = React.useState(false);
  const [clapOn, setClapOn] = React.useState(false);
  const [lang, setLang] = React.useState<Lang>("en");
  const langRef = React.useRef<Lang>("en");
  const [armed, setArmed] = React.useState(false); // heard "Vetri" / clap, capturing the question
  const wakeRecRef = React.useRef<SpeechRecognitionLike | null>(null);
  const captureRecRef = React.useRef<SpeechRecognitionLike | null>(null);
  const wakeOnRef = React.useRef(false);
  const armedRef = React.useRef(false);
  const questionBufRef = React.useRef("");
  const silenceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const armExpiryRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreUntilRef = React.useRef(0); // ignore recognizer input while we speak
  const sendRef = React.useRef<(q: string, forceSpeak?: boolean) => void>(() => {});

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const panelInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  React.useEffect(() => {
    setVoiceInSupported(getSpeechCtor() !== null);
    setVoiceOutSupported(isSpeechSynthesisSupported());
    try {
      // Voice output is always available. Hands-free listening (wake word + clap)
      // only works on desktop — mobile browsers can't do continuous background
      // recognition, so on phones we use tap-to-talk (the mic button) instead.
      setVoiceOn(localStorage.getItem(VOICE_KEY) !== "0");
      if (isMobileDevice()) {
        setWakeOn(false);
        setClapOn(false);
      } else {
        setWakeOn(localStorage.getItem(WAKE_KEY) !== "0");
        setClapOn(localStorage.getItem(CLAP_KEY) === "1");
      }
      const storedLang = localStorage.getItem(LANG_KEY);
      // Default English so English commands ("open calendar") are recognised;
      // Tamil is one tap away (the த toggle). STT language must match what you speak.
      const initialLang: Lang = storedLang === "ta" ? "ta" : "en";
      setLang(initialLang);
      langRef.current = initialLang;
    } catch {
      /* localStorage blocked — use defaults */
    }
  }, []);

  React.useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // Shared "arm" flow — both the wake word AND a clap trigger this: Vetri
  // wakes, greets you as boss, and captures your question.
  const disarm = React.useCallback(() => {
    armedRef.current = false;
    setArmed(false);
    questionBufRef.current = "";
    if (silenceRef.current) clearTimeout(silenceRef.current);
    if (armExpiryRef.current) clearTimeout(armExpiryRef.current);
    // Stop the one-shot capture recognizer (if we started one for clap/button).
    if (captureRecRef.current) {
      captureRecRef.current.onresult = null;
      captureRecRef.current.onend = null;
      try {
        captureRecRef.current.stop();
      } catch {
        /* ignore */
      }
      captureRecRef.current = null;
    }
  }, []);
  const finalizeSoon = React.useCallback(() => {
    if (silenceRef.current) clearTimeout(silenceRef.current);
    silenceRef.current = setTimeout(() => {
      const q = questionBufRef.current.trim();
      if (q) {
        disarm();
        sendRef.current(q, true);
      }
    }, 1100);
  }, [disarm]);
  // When Vetri is woken by a clap or the "Talk to Vetri" button (not the
  // always-on wake word), nothing is feeding the question buffer — so start a
  // short recognizer that captures what you say next, then stops.
  const startCapture = React.useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = langRef.current === "ta" ? "ta-IN" : "en-IN";
    // Mobile browsers can't do continuous recognition — capture one phrase.
    rec.continuous = !isMobileDevice();
    rec.interimResults = true;
    rec.onresult = (e) => {
      if (isSpeaking()) return;
      if (Date.now() < ignoreUntilRef.current) return;
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalText) {
        questionBufRef.current = (questionBufRef.current + " " + finalText).trim();
        finalizeSoon();
      } else if (interim) {
        finalizeSoon();
      }
    };
    // On mobile the recognizer ends after a phrase — send what we captured.
    rec.onend = () => {
      if (armedRef.current && questionBufRef.current.trim()) finalizeSoon();
    };
    captureRecRef.current = rec;
    try {
      rec.start();
    } catch {
      /* ignore */
    }
  }, [finalizeSoon]);
  // Start listening for a question (from tap, wake word, or clap). No spoken
  // greeting — the "Listening…" indicator is the feedback, and it auto-sends
  // what you say. Toggling while listening stops it.
  const arm = React.useCallback(
    (initial: string) => {
      if (armedRef.current) return;
      cancelSpeech();
      armedRef.current = true;
      setArmed(true);
      setOpen(true);
      questionBufRef.current = initial;
      ignoreUntilRef.current = 0;
      // The always-on wake recognizer already feeds the buffer; only spin up a
      // capture recognizer when it isn't running (tap / clap activation).
      if (!wakeOnRef.current) startCapture();
      if (armExpiryRef.current) clearTimeout(armExpiryRef.current);
      armExpiryRef.current = setTimeout(disarm, 15000);
    },
    [disarm, startCapture]
  );

  // "Vetri" wake word — an always-listening recognizer that opens the assistant
  // and answers when it hears its name. Opt-in; restarts itself when the browser
  // times out the recognition; deafened briefly while the CEO speaks.
  React.useEffect(() => {
    wakeOnRef.current = wakeOn;
    if (!wakeOn) {
      armedRef.current = false;
      setArmed(false);
      return;
    }
    const Ctor = getSpeechCtor();
    if (!Ctor) return;

    function start() {
      if (!wakeOnRef.current) return;
      const rec = new Ctor!();
      rec.lang = langRef.current === "ta" ? "ta-IN" : "en-IN";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        // Never react to our own speech — otherwise the CEO saying "DigitalVetri"
        // would re-trigger the wake word and loop. `speaking` is ground truth;
        // the ignore-window is a fallback for the moment right after speech ends.
        if (isSpeaking()) return;
        if (Date.now() < ignoreUntilRef.current) return;
        let finalText = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (!armedRef.current) {
          if (containsWakeWord(finalText)) arm(stripWakeWord(finalText));
          else if (containsWakeWord(interim)) arm(stripWakeWord(interim));
          return;
        }
        if (finalText) {
          questionBufRef.current = (questionBufRef.current + " " + stripWakeWord(finalText)).trim();
          finalizeSoon();
        } else if (interim) {
          finalizeSoon();
        }
      };
      rec.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          toast.error("Microphone blocked. Allow mic access to use the “Vetri” wake word.");
          setWakeOn(false);
        }
      };
      rec.onend = () => {
        if (!wakeOnRef.current) return;
        try {
          rec.start();
        } catch {
          setTimeout(() => wakeOnRef.current && start(), 400);
        }
      };
      wakeRecRef.current = rec;
      try {
        rec.start();
      } catch {
        /* already started — ignore */
      }
    }
    start();

    return () => {
      wakeOnRef.current = false;
      const rec = wakeRecRef.current;
      if (rec) {
        rec.onend = null;
        rec.onresult = null;
        rec.stop();
      }
      wakeRecRef.current = null;
      if (silenceRef.current) clearTimeout(silenceRef.current);
      if (armExpiryRef.current) clearTimeout(armExpiryRef.current);
    };
  }, [wakeOn, arm, finalizeSoon]);

  // Clap-to-activate — a second, hands-free way to wake Vetri. Listens for two
  // quick amplitude spikes (claps) via Web Audio and triggers the same arm flow.
  React.useEffect(() => {
    if (!clapOn) return;
    let audioCtx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastClap = 0;
    let firstClapAt = 0;
    let clapCooldownUntil = 0;
    let cancelled = false;

    const AC =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AC || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Clap detection isn’t supported in this browser.");
      setClapOn(false);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        audioCtx = new AC();
        const src = audioCtx.createMediaStreamSource(s);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);

        const tick = () => {
          if (cancelled) return;
          const now = performance.now();
          // Never sample while Vetri is speaking (else it hears its own voice and
          // re-triggers), nor during the cooldown right after an activation.
          if ((isSpeaking()) || now < clapCooldownUntil || armedRef.current) {
            firstClapAt = 0;
            raf = requestAnimationFrame(tick);
            return;
          }
          analyser.getByteTimeDomainData(data);
          // Peak deviation from the 128 midpoint = loudness of a transient.
          let peak = 0;
          for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
          // A clap is a SHARP, loud spike. High threshold + a required quiet gap
          // between the two claps rejects speech and steady noise.
          if (peak > 118 && now - lastClap > 200) {
            lastClap = now;
            if (firstClapAt && now - firstClapAt < 700 && now - firstClapAt > 120) {
              firstClapAt = 0;
              clapCooldownUntil = now + 4000; // don't listen again for 4s
              arm("");
            } else {
              firstClapAt = now;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        toast.error("Microphone blocked. Allow mic access to use clap-to-activate.");
        setClapOn(false);
      });

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close().catch(() => {});
    };
  }, [clapOn, arm]);

  // "vetri:talk" (HUD button) opens + starts listening; "vetri:open" (top-bar
  // button, available on every page) just opens the panel.
  React.useEffect(() => {
    const onTalk = () => {
      setOpen(true);
      arm("");
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("vetri:talk", onTalk);
    window.addEventListener("vetri:open", onOpen);
    return () => {
      window.removeEventListener("vetri:talk", onTalk);
      window.removeEventListener("vetri:open", onOpen);
    };
  }, [arm]);

  const hasUserMessage = messages.some((m) => m.role === "user");

  const loadBriefing = React.useCallback(async () => {
    setBriefingState("loading");
    try {
      const res = await fetch("/api/command-center/briefing");
      const data = await res.json();
      if (!res.ok || !data.briefing) throw new Error(data.error ?? "no briefing");
      const b = data.briefing as CeoBriefing;
      const msg: Message = { role: "assistant", content: formatBriefing(b), speak: b.spoken };
      setMessages([msg]);
      setBriefingState("done");
      // The briefing is shown, never auto-spoken — Vetri only speaks when you
      // ask it something (avoids it "talking by itself" on open).
    } catch {
      setMessages([
        {
          role: "assistant",
          content:
            "Good morning — I'm your AI CEO. I couldn't pull today's briefing just now, but ask me anything about revenue, your pipeline, deals at risk or who to follow up with.",
        },
      ]);
      setBriefingState("error");
    }
  }, []);

  // Load the morning briefing the first time the panel opens.
  React.useEffect(() => {
    if (open && briefingState === "idle") loadBriefing();
  }, [open, briefingState, loadBriefing]);

  // Move focus into the panel on open; close on Escape; stop any speech on close.
  React.useEffect(() => {
    if (!open) {
      // NOTE: do NOT cancelSpeech() here — navigating closes the panel and would
      // cut off Vetri's spoken reply. Speech is stopped only on an explicit close
      // (the X button / Escape) below.
      disarm();
      return;
    }
    // The panel lives outside the full-screened HUD, so in full-screen it would be
    // invisible — exit full-screen so the panel is actually shown.
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    panelInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelSpeech();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, disarm]);

  if (!canUse) return null;

  function toggleVoiceOut() {
    setVoiceOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(VOICE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (!next) cancelSpeech();
      return next;
    });
  }

  function toggleWake() {
    if (!voiceInSupported) return;
    setWakeOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(WAKE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (next) toast.success("Listening for “Vetri” — just call my name.");
      return next;
    });
  }

  function toggleClap() {
    setClapOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(CLAP_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (next) toast.success("Clap twice and I’ll answer, boss.");
      return next;
    });
  }

  function toggleLang() {
    setLang((l) => {
      const next: Lang = l === "ta" ? "en" : "ta";
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {
        /* ignore */
      }
      langRef.current = next;
      toast.success(next === "ta" ? "வெற்றி இனி தமிழில் பேசும். (Speak Tamil to it.)" : "Vetri will speak English.");
      return next;
    });
  }

  // Tap the mic: start listening (auto-sends what you say) or stop if already on.
  function micTap() {
    if (!voiceInSupported) return;
    primeSpeech(); // unlock TTS within this tap so the reply can speak
    if (armedRef.current) disarm();
    else arm("");
  }

  function sayOut(text: string, force = false) {
    if (!(voiceOn || force)) return;
    // Deafen the wake/clap listeners while Vetri talks (isSpeaking() also guards).
    ignoreUntilRef.current = Date.now() + text.split(/\s+/).length * 420 + 2500;
    void speakSmart(text, lang);
  }

  async function send(question: string, forceSpeak = false) {
    if (!question.trim() || loading) return;
    if (!forceSpeak) disarm(); // typing stops any active listening
    cancelSpeech();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);

    // Fast path for TYPED English navigation only — instant, no AI. Voice and
    // Tamil go through the unified interpreter below so they're never misrouted.
    if (!forceSpeak && lang === "en") {
      const nav = detectNav(question);
      if (nav) {
        const say = `Opening ${nav.label}.`;
        setMessages((m) => [...m, { role: "assistant", content: say }]);
        sayOut(say, forceSpeak);
        setOpen(false);
        router.push(nav.href);
        return;
      }
    }

    setLoading(true);
    try {
      // One unified call: it understands commands (navigate / add company /
      // record payment) AND answers questions — so a normal Tamil question is
      // never mistaken for a command.
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, fast: true, lang }),
      });
      const d = await res.json();

      if (res.ok && d.kind === "navigate" && d.href) {
        setMessages((m) => [...m, { role: "assistant", content: d.say }]);
        sayOut(d.say, forceSpeak);
        setOpen(false);
        router.push(d.href);
        return;
      }
      if (res.ok && d.kind === "confirm") {
        setMessages((m) => [...m, { role: "assistant", content: d.say, confirm: { action: d.action, params: d.params, title: d.title } }]);
        sayOut(d.say, forceSpeak);
        return;
      }
      if (res.ok && d.kind === "clarify") {
        setMessages((m) => [...m, { role: "assistant", content: d.say }]);
        sayOut(d.say, forceSpeak);
        return;
      }
      const content = d.answer ?? d.error ?? "Sorry, something went wrong.";
      setMessages((m) => [...m, { role: "assistant", content, action: d.action }]);
      sayOut(content, forceSpeak);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }
  // Keep a stable ref so the wake recognizer always calls the latest send().
  sendRef.current = send;

  async function confirmWrite(index: number) {
    const msg = messages[index];
    if (!msg?.confirm) return;
    setSavingIdx(index);
    try {
      const res = await fetch("/api/assistant/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: msg.confirm.action, params: msg.confirm.params, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      setMessages((m) => m.map((mm, i) => (i === index ? { ...mm, confirm: undefined } : mm)));
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.say, action: data.href ? { type: "navigate", href: data.href, label: data.label } : undefined },
      ]);
      sayOut(data.say);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSavingIdx(null);
    }
  }

  function cancelWrite(index: number) {
    setMessages((m) => m.map((mm, i) => (i === index ? { ...mm, confirm: undefined, content: mm.content + " (cancelled)" } : mm)));
  }

  // No floating launcher — Vetri opens from the AI Company page (the HUD's
  // "Talk to Vetri") via the `vetri:talk` event, or by voice wake/clap if on.
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-label="AI CEO"
            className="fixed bottom-24 right-6 z-40 flex h-[560px] max-h-[calc(100vh-8rem)] w-[calc(100vw-3rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
              <Crown className="h-5 w-5" />
              <div className="flex-1">
                <div className="text-sm font-semibold">Your AI CEO</div>
                <div className="flex items-center gap-1 text-[11px] text-blue-100">
                  {armed ? (
                    <>
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Listening…
                    </>
                  ) : wakeOn ? (
                    "Say “Vetri” anytime"
                  ) : clapOn ? (
                    "Clap twice to talk"
                  ) : (
                    "DigitalVetri — Chief of Staff"
                  )}
                </div>
              </div>
              {briefingState !== "loading" && (
                <button
                  onClick={loadBriefing}
                  title="Refresh briefing"
                  aria-label="Refresh briefing"
                  className="rounded-md p-1.5 text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
              {voiceOutSupported && (
                <button
                  onClick={toggleVoiceOut}
                  title={voiceOn ? "Voice on — tap to mute" : "Voice off — tap to hear your CEO"}
                  aria-label={voiceOn ? "Mute voice" : "Enable voice"}
                  aria-pressed={voiceOn}
                  className="rounded-md p-1.5 text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              )}
              {voiceInSupported && (
                <button
                  onClick={toggleWake}
                  title={wakeOn ? "Wake word on — say “Vetri”" : "Enable the “Vetri” wake word"}
                  aria-label={wakeOn ? "Disable Vetri wake word" : "Enable Vetri wake word"}
                  aria-pressed={wakeOn}
                  className={cn(
                    "rounded-md p-1.5 text-blue-100 transition-colors hover:bg-white/10 hover:text-white",
                    wakeOn && "bg-white/15 text-white"
                  )}
                >
                  {wakeOn ? <Ear className="h-4 w-4" /> : <EarOff className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={toggleClap}
                title={clapOn ? "Clap-to-activate on — clap twice" : "Enable clap-to-activate"}
                aria-label={clapOn ? "Disable clap activation" : "Enable clap activation"}
                aria-pressed={clapOn}
                className={cn(
                  "rounded-md p-1.5 text-blue-100 transition-colors hover:bg-white/10 hover:text-white",
                  clapOn && "bg-white/15 text-white"
                )}
              >
                <Hand className="h-4 w-4" />
              </button>
              <button
                onClick={toggleLang}
                title={lang === "ta" ? "Vetri speaks Tamil — tap for English" : "Vetri speaks English — tap for Tamil"}
                aria-label="Toggle language"
                className="min-w-[28px] rounded-md px-1.5 py-1 text-xs font-bold text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
              >
                {lang === "ta" ? "த" : "EN"}
              </button>
              <button
                onClick={() => {
                  cancelSpeech();
                  setOpen(false);
                }}
                title="Close"
                aria-label="Close Vetri"
                className="rounded-md p-1.5 text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="flex-1 space-y-3 overflow-y-auto p-4"
            >
              {briefingState === "loading" && messages.length === 0 && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Reviewing your business…
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                      m.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground"
                    )}
                  >
                    {m.content}
                    {m.confirm && (
                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => confirmWrite(i)} disabled={savingIdx === i}>
                          {savingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => cancelWrite(i)} disabled={savingIdx === i}>
                          Cancel
                        </Button>
                      </div>
                    )}
                    {m.action && (
                      <button
                        onClick={() => {
                          router.push(m.action!.href);
                          setOpen(false);
                        }}
                        className="mt-2 flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {m.action.label} <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                  </div>
                </div>
              )}

              {briefingState !== "loading" && !hasUserMessage && (
                <div className="space-y-1.5 pt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        primeSpeech();
                        send(s);
                      }}
                      className="block w-full rounded-lg border bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                primeSpeech();
                send(input);
              }}
              className="flex items-center gap-2 border-t p-3"
            >
              {voiceInSupported && (
                <Button
                  type="button"
                  size="icon"
                  variant={armed ? "default" : "outline"}
                  onClick={micTap}
                  disabled={wakeOn}
                  title={wakeOn ? "Wake word is on — just say “Vetri”" : armed ? "Listening… tap to stop" : "Tap to talk"}
                  aria-label={armed ? "Stop listening" : "Talk to Vetri"}
                  aria-pressed={armed}
                  className={cn(armed && "animate-pulse")}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              )}
              <input
                ref={panelInputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={armed ? "Listening… speak now" : "Ask your CEO anything…"}
                aria-label="Ask your AI CEO a question"
                className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <Button type="submit" size="icon" aria-label="Send message" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
