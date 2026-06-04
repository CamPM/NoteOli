/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Copy,
  Download,
  Trash2,
  Plus,
  Volume2,
  VolumeX,
  FileText,
  Check,
  RotateCcw,
  BookOpen,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  CloudLightning,
  X,
  PlusCircle,
  Eye,
  Code
} from "lucide-react";

import { Tone, UtilityMacro, NoteEntry } from "./types";
import * as audio from "./utils/audio";
import * as storage from "./utils/storage";
import { transformLocally } from "./utils/localTransformer";

const UTILITY_MACROS: { name: UtilityMacro; desc: string; icon: string }[] = [
  {
    name: "Meeting Minute Creator",
    desc: "Extracts Attendees, Decisions, and Action Items with markdown checkboxes.",
    icon: "📋"
  },
  {
    name: "Table Generator",
    desc: "Structures qualitative and contrast notes into markdown tables.",
    icon: "📊"
  },
  {
    name: "The Anonymizer",
    desc: "PII scrub: translates personal metrics and names into safe generic tags.",
    icon: "🔒"
  },
  {
    name: "Concept Explainer",
    desc: "Converts complex jargon into plain English with real-world analogies.",
    icon: "💡"
  },
  {
    name: "Action-Item Extractor",
    desc: "Isolates and lists promises and target points in a clean roadmap list.",
    icon: "🎯"
  },
  {
    name: "Brainstorming Partner",
    desc: "Critiques input and highlights 3 strategic blind spots or key questions.",
    icon: "🧠"
  },
  {
    name: "Smart Tag & Title Generator",
    desc: "Builds indexing indexing tags and creative folder title proposals.",
    icon: "🏷️"
  },
  {
    name: "Structural De-Fluffer",
    desc: "Removes linguistic filler, redundancies, and optimizes syntax flow.",
    icon: "✨"
  },
  {
    name: "To-Do List Organizer",
    desc: "Extracts action tasks, chores, or timelines into grouped markdown checklist priorities.",
    icon: "📝"
  }
];

export default function App() {
  // State for raw note text area
  const [inputText, setInputText] = useState<string>(() => storage.loadCurrentDraft());
  const [outputText, setOutputText] = useState<string>("");
  
  // App parameters
  const [tone, setTone] = useState<Tone>("Professional");
  const [length, setLength] = useState<number>(0);
  const [utility, setUtility] = useState<UtilityMacro | "none">("none");
  
  // Audio state
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(() => storage.loadAudioToggle());
  
  // Engine Mode - "cloud" leverages Gemini server route; "local" runs structural rules
  const [sandboxMode, setSandboxMode] = useState<"cloud" | "local">("cloud");
  const [localLlmStatus, setLocalLlmStatus] = useState<"idle" | "loading" | "ready" | "failed" | "unsupported">("idle");
  const [llmProgress, setLlmProgress] = useState<number>(0);
  const [llmProgressMsg, setLlmProgressMsg] = useState<string>("");
  const [useActualLlm, setUseActualLlm] = useState<boolean>(false);
  const selectedLlmModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  // Notes history list
  const [notesHistory, setNotesHistory] = useState<NoteEntry[]>(() => storage.loadNotes());
  
  // UI states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingPhase, setProcessingPhase] = useState<string>("");
  const [rippleActive, setRippleActive] = useState<boolean>(false);
  const [outputTab, setOutputTab] = useState<"preview" | "raw">("preview");
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState<string>("");
  const [activeHistoryNoteId, setActiveHistoryNoteId] = useState<string | null>(null);

  // Copy success indicator
  const [copiedType, setCopiedType] = useState<"raw" | "rich" | "markdown" | null>(null);

  // Dynamic user alert toasts
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: "success" | "info" | "error" }[]>([]);

  // Ref to trigger temporary ripple animation
  const rippleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to target the output section for scrolling
  const outputSectionRef = useRef<HTMLDivElement | null>(null);

  // Synchronize audio setting on init
  useEffect(() => {
    audio.toggleAudio(isAudioEnabled);
  }, [isAudioEnabled]);

  // Monitor browser network offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast("Online network resolved. Cloud Sandbox activated.", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSandboxMode("local");
      showToast("Network offline. noteOli automatically shifted to Local Sandbox Processing.", "info");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Autosave draft edits to browser-native localStorage on modifications
  useEffect(() => {
    storage.saveCurrentDraft(inputText);
  }, [inputText]);

  // Trigger feedback toasts helper
  const showToast = (msg: string, type: "success" | "info" | "error" = "info") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Sound triggering helper with interactive audio enablement block
  const playClick = (type: "click" | "success" | "release" = "click") => {
    if (!isAudioEnabled) return;
    // Ensure Web Audio context is initialized
    audio.enableAudio();
    audio.playMechanicalClick(type);
  };

  const handleAudioToggle = () => {
    const nextVal = !isAudioEnabled;
    setIsAudioEnabled(nextVal);
    storage.saveAudioToggle(nextVal);
    if (nextVal) {
      setTimeout(() => {
        audio.enableAudio();
        audio.playMechanicalClick("success");
      }, 50);
    }
  };

  // Sample injector to immediately show NoteOli mechanical flow
  const injectSample = () => {
    playClick("click");
    const sample = `NOTES FROM WEEKLY SYNC ON PRODUCT BATCH ALPHA
Date: May 29, 2026. Attendees present: Jonathan (Product), Sarah (Tech Lead), Clara (Design).
We had quite a messy brainstorm but here are the raw points.
Clara says the design specs for our luxury stationery theme are mostly ready but the active buttons really need a high-contrast muted Gold border (#d4af37) to stand out.
Sarah raised an essential concern regarding background database performance: she thinks that using Firestore index templates is great, but we should make sure that we provide a zero-telemetry local rule-compiler for users that want 100% offline security. Absolutely agree.
Also, we need to wrap up the service worker cache headers by next Thursday so the site works perfectly at 30,000 feet.
Let's make sure that Jonathan will schedule the design walkthrough meeting and Clara should deliver the custom sitting-cat SVG icon asset to git repo.
Overall, great progress. Need to defluff this raw text and turn it into actionable tasks ASAP.`;
    setInputText(sample);
    showToast("Sample text imported into capture canvas.", "success");
  };

  // Clearing workspace safely with a loading helper
  const clearWorkspace = () => {
    playClick("click");
    setInputText("");
    setOutputText("");
    setActiveHistoryNoteId(null);
    showToast("Workspace canvas cleared.", "info");
  };

  // Function to initialize Local WebGPU model
  const warmLocalLlm = async (showToasts = true) => {
    try {
      setLocalLlmStatus("loading");
      setLlmProgress(0);
      setLlmProgressMsg(`Initializing WebGPU for Llama 3.2 1B (Oli)...`);
      
      const { initializeWebLlmEngine } = await import("./utils/webLlmEngine");
      
      await initializeWebLlmEngine((prog, msg) => {
        setLlmProgress(prog);
        setLlmProgressMsg(msg);
      });
      
      setLocalLlmStatus("ready");
      setUseActualLlm(true);
      if (showToasts) {
        showToast("Oli (Llama 3.2 1B-Instruct) ready via WebGPU offline sandbox.", "success");
      }
    } catch (err: any) {
      console.warn("WebLLM initialization failed, falling back to rule-compiler:", err);
      setLocalLlmStatus("unsupported");
      setUseActualLlm(false);
      if (showToasts) {
        showToast(err.message || "Failed loading model weights. Utilizing local rule-compiler fallback. NoteOli requires a WebGPU compliant device config.", "info");
      }
    }
  };

  // Warm-up local LLM proactively when user selects Local Sandbox
  useEffect(() => {
    if (sandboxMode === "local" && localLlmStatus === "idle") {
      warmLocalLlm(true);
    }
  }, [sandboxMode]);

  // Main Oli Sandbox Transformation Orchestrator
  const runOliTransform = async () => {
    if (!inputText.trim()) {
      playClick("click");
      showToast("Canvas is silent. Please write or paste raw text to run Oli.", "error");
      return;
    }

    // Trigger haptic mechanical clicking sound and state ripples
    playClick("click");
    setRippleActive(true);
    if (rippleTimeoutRef.current) clearTimeout(rippleTimeoutRef.current);
    rippleTimeoutRef.current = setTimeout(() => setRippleActive(false), 600);

    setIsProcessing(true);
    setProcessingPhase("Calibrating high-precision templates...");

    const phaseDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      if (sandboxMode === "local" || !isOnline) {
        // If they chose local but the model is idle/not ready yet, try to load it first
        if (localLlmStatus === "idle") {
          await warmLocalLlm(false);
        }

        if (localLlmStatus === "ready" || useActualLlm) {
          setProcessingPhase("Llama 1B local inference via WebGPU...");
          const { runLocalTransformWithModel } = await import("./utils/webLlmEngine");
          const response = await runLocalTransformWithModel(inputText, tone, length, utility);
          setOutputText(response);
          showToast("Transformed completely offline with Llama 3.2 1B-Instruct via WebGPU.", "success");
        } else {
          // Rule compilation fallback
          await phaseDelay(300);
          setProcessingPhase("Executing Local Coprocessor...");
          const response = transformLocally(inputText, tone, length, utility);
          setOutputText(response);
          showToast("Transformed via Secure Offline Local Coprocessor.", "success");
        }
        playClick("success");
      } else {
        // Query server side proxy which calls Gemini with server safety
        setProcessingPhase("Oli SLM compiling remote output...");
        const res = await fetch("/api/transform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: inputText,
            tone,
            length,
            utility
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Server failed to process note.");
        }

        const data = await res.json();
        setOutputText(data.text);
        playClick("success");
        showToast("Transformed successfully using Oli AI (Cloud Proxy).", "success");
      }
      
      // Critique 3: Smooth scroll output into view so users don't scroll blindly!
      setTimeout(() => {
        outputSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);

    } catch (err: any) {
      console.error(err);
      if (sandboxMode === "local") {
        setLocalLlmStatus("unsupported");
        setUseActualLlm(false);
        showToast(err.message || "Failed to transform note, shifting to local coprocessor.", "error");
      } else {
        showToast(err.message || "Failed to transform note, shifting to local coprocessor.", "error");
      }
      // Fallback safely to local transform compiler rather than failing completely
      const fallback = transformLocally(inputText, tone, length, utility);
      setOutputText(fallback);
      playClick("success");

      setTimeout(() => {
        outputSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } finally {
      setIsProcessing(false);
      setProcessingPhase("");
    }
  };

  // Manual save to Note History logger
  const saveToHistory = () => {
    playClick("click");
    if (!inputText.trim()) {
      showToast("Cannot save empty workspace.", "error");
      return;
    }

    const titlePrefix = outputText 
      ? (outputText.split("\n").find(l => l.includes("Title") || l.includes("###"))?.replace(/[#*`"]/g, "").trim() || `${utility} Output`)
      : (inputText.split("\n")[0]?.substring(0, 30) || "Untitled Note");

    const newNote: NoteEntry = {
      id: activeHistoryNoteId || Math.random().toString(36).substr(2, 9),
      title: titlePrefix.length > 50 ? titlePrefix.substring(0, 50) + "..." : titlePrefix,
      content: inputText,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString()
    };

    let updatedList: NoteEntry[] = [];
    if (activeHistoryNoteId) {
      updatedList = notesHistory.map((note) => (note.id === activeHistoryNoteId ? newNote : note));
      showToast("Archived item updated inside native storage log.", "success");
    } else {
      updatedList = [newNote, ...notesHistory];
      setActiveHistoryNoteId(newNote.id);
      showToast("Captured note saved to local history log.", "success");
    }

    setNotesHistory(updatedList);
    storage.saveNotes(updatedList);
  };

  // Load a historic note back into the editor
  const loadHistoricNote = (note: NoteEntry) => {
    playClick("click");
    setInputText(note.content);
    setOutputText("");
    setActiveHistoryNoteId(note.id);
    showToast(`Loaded "${note.title}" into active workspace.`, "info");
    setShowHistoryDrawer(false);
  };

  // Delete note from history safely
  const deleteHistoricNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playClick("click");
    const updated = notesHistory.filter((note) => note.id !== id);
    setNotesHistory(updated);
    storage.saveNotes(updated);
    if (activeHistoryNoteId === id) {
      setActiveHistoryNoteId(null);
    }
    showToast("Archived note removed from local records.", "info");
  };

  // One-Click Copy formatting handlers
  const handleCopyRaw = async () => {
    playClick("click");
    const textToCopy = outputText || inputText;
    if (!textToCopy) {
      showToast("Nothing to copy.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedType("raw");
      setTimeout(() => setCopiedType(null), 2000);
      playClick("success");
      showToast("Copied raw text to clipboard.", "success");
    } catch (err) {
      showToast("Failed to copy text.", "error");
    }
  };

  const handleCopyMarkdown = async () => {
    playClick("click");
    if (!outputText) {
      showToast("Generate Oli output to copy formatted Markdown.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(outputText);
      setCopiedType("markdown");
      setTimeout(() => setCopiedType(null), 2000);
      playClick("success");
      showToast("Copied clean Markdown to clipboard.", "success");
    } catch (err) {
      showToast("Failed to copy markdown.", "error");
    }
  };

  const handleCopyRichText = async () => {
    playClick("click");
    if (!outputText) {
      showToast("Generate Oli output to copy structured Rich Text.", "error");
      return;
    }

    const htmlContent = convertMarkdownToHtml(outputText);
    try {
      const textBlob = new Blob([outputText], { type: "text/plain" });
      const htmlBlob = new Blob([htmlContent], { type: "text/html" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": textBlob,
          "text/html": htmlBlob
        })
      ]);
      setCopiedType("rich");
      setTimeout(() => setCopiedType(null), 2000);
      playClick("success");
      showToast("Copied structured Rich Text (pasteable to Apple Notes/Obsidian)!", "success");
    } catch (err) {
      // Fallback
      await navigator.clipboard.writeText(outputText);
      setCopiedType("rich");
      setTimeout(() => setCopiedType(null), 2000);
      showToast("ClipboardItem unsupported; fallback text copied successfully.", "info");
    }
  };

  // Export to native files using download blob mechanism 
  const exportToLocalDisk = () => {
    playClick("click");
    const textToSave = outputText || inputText;
    if (!textToSave) {
      showToast("Workspace was silent. Cannot write empty file.", "error");
      return;
    }

    try {
      const fileTitle = outputText
        ? (outputText.split("\n")[0]?.replace(/[^A-Za-z0-9 ]/g, "").trim().replace(/\s+/g, "_").toLowerCase() || `noteoli_archive`)
        : `note_draft`;
      
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${fileTitle}_${timestamp}.md`;

      const blob = new Blob([textToSave], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      playClick("success");
      showToast(`Exported "${filename}" straight to Downloads folder.`, "success");
    } catch (err) {
      showToast("Failed to export file to local disk.", "error");
    }
  };

  // Markdown renderer for clean screen preview
  const convertMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return "";
    
    // Safety escape to prevent markdown injector XSS 
    let html = markdown
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Convert Headers h3, h2, h1
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-[#1d1d1f] font-sans mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-[#1d1d1f] font-sans mt-5 mb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black text-[#1d1d1f] font-display mt-6 mb-3">$1</h1>');

    // Convert Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-black">$1</strong>');
    
    // Convert Italics
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-gray-800">$1</em>');

    // Convert backtick inline codes
    html = html.replace(/`(.*?)`/g, '<code class="bg-[#f5f5f7] px-1.5 py-0.5 rounded text-sm text-[#c5a059] font-mono border border-[#e5e5eb]">$1</code>');

    // Convert list checkboxes unchecked
    html = html.replace(/^\s*-\s*\[\s*\]\s*(.*$)/gim, '<div class="flex items-start gap-2 my-1"><input type="checkbox" disabled class="mt-1 w-4 h-4 accent-[#d4af37]" /> <span class="font-sans text-[#1d1d1f]">$1</span></div>');
    
    // Convert list checkboxes checked
    html = html.replace(/^\s*-\s*\[x\]\s*(.*$)/gim, '<div class="flex items-start gap-2 my-1"><input type="checkbox" checked disabled class="mt-1 w-4 h-4 accent-[#d4af37]" /> <span class="font-sans line-through text-gray-500">$1</span></div>');

    // Convert Bullet lists
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc font-sans text-[#1d1d1f] my-0.5">$1</li>');
    html = html.replace(/^\s*•\s+(.*$)/gim, '<li class="ml-4 list-disc font-sans text-[#1d1d1f] my-0.5">$1</li>');

    // Convert Tables markdown syntax (basic line replacement)
    const lines = html.split("\n");
    let inTable = false;
    let tableHtml = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("|") && line.endsWith("|")) {
        if (!inTable) {
          inTable = true;
          tableHtml += '<div class="overflow-x-auto my-4"><table class="min-w-full border border-[#e5e5eb] border-collapse bg-white rounded-lg text-sm font-sans">';
        }
        
        const cols = line.split("|").slice(1, -1).map(c => c.trim());
        
        // Skip separator line | :--- | :--- |
        if (cols.every(c => c.replace(/:-/g, "").length === 0)) {
          continue;
        }

        // Check if header row (assume first row in active table block)
        const isHeader = tableHtml.endsWith("</table>") || tableHtml.endsWith('rounded-lg text-sm font-sans">');
        
        tableHtml += '<tr class="border-b border-[#e5e5eb] hover:bg-[#fafafc] transition-colors">';
        cols.forEach(c => {
          if (isHeader) {
            tableHtml += `<th class="px-3 py-2 text-left font-semibold text-[#1d1d1f] bg-[#f5f5f7] border-r border-[#e5e5eb]">${c}</th>`;
          } else {
            tableHtml += `<td class="px-3 py-2 text-[#1d1d1f] border-r border-[#e5e5eb]">${c}</td>`;
          }
        });
        tableHtml += "</tr>";
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += "</table></div>";
          lines[i] = tableHtml + "\n" + line;
          tableHtml = "";
        }
      }
    }
    
    if (inTable) {
      tableHtml += "</table></div>";
      lines[lines.length - 1] = lines[lines.length - 1] + "\n" + tableHtml;
    }

    html = lines.join("\n");

    // Standard single line breaks to br
    html = html.replace(/\n/g, '<br class="my-1" />');

    return html;
  };

  const filteredHistory = notesHistory.filter((note) =>
    note.title.toLowerCase().includes(searchHistoryQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchHistoryQuery.toLowerCase())
  );

  return (
    <div id="noteoli-application-root" className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans selection:bg-[#d4af37]/20 flex flex-col relative antialiased">
      
      {/* Toast notifications container */}
      <div id="noteoli-toasts-area" className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`p-4 rounded-lg shadow-md border-l-4 grow flex items-center justify-between text-sm transition-all duration-300 transform translate-x-0 bg-white ${
              toast.type === "success"
                ? "border-l-[#d4af37] text-[#1d1d1f]"
                : toast.type === "error"
                ? "border-l-red-500 text-red-800 bg-red-50/90"
                : "border-l-blue-400 text-blue-900 bg-blue-50/90"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" && <Sparkles className="w-4 h-4 text-[#d4af37]" />}
              <p className="font-medium">{toast.msg}</p>
            </div>
            <button
              id={`close-toast-${toast.id}`}
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Embedded application header */}
      <header id="noteoli-header" className="bg-white border-b border-[#e5e5eb] px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div id="header-branding" className="flex items-center gap-3">
          <div id="vector-cat-silhouette" className="p-2 bg-[#f5f5f7] rounded-lg text-[#1d1d1f] hover:text-[#d4af37] transition-colors">
            {/* Master custom poised stationery cat silhouette */}
            <svg viewBox="0 0 100 100" className="w-8 h-8" fill="currentColor">
              <path d="M50 12 L43 2 L38 10 L38 28 L42 35 L44 38 L38 52 C33 60 33 72 38 78 C40 83 45 86 50 86 C55 86 60 83 62 78 C67 72 67 60 62 52 L56 38 L58 35 L62 28 L62 10 L57 2 Z" />
              <path d="M62 70 C70 70 74 74 74 80 C74 83 71 86 68 86 L50 86" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="46" cy="18" r="1.5" fill="#f5f5f7" />
              <circle cx="54" cy="18" r="1.5" fill="#f5f5f7" />
            </svg>
          </div>
          <div>
            <h1 id="noteoli-logo-text" className="font-display font-semibold text-2xl tracking-tight text-[#1d1d1f] flex items-center gap-1.5 leading-none">
              NoteOli <span className="text-xs bg-[#d4af37] text-white font-mono px-1.5 py-0.5 rounded tracking-normal">SLM</span>
            </h1>
            <p id="noteoli-tagline" className="text-[10px] text-gray-400 font-mono tracking-widest mt-1 uppercase">
              Luxury Offline-Safe Text Processing Terminal
            </p>
          </div>
        </div>

        {/* Global Toolbar and Controls */}
        <div id="header-actions" className="flex items-center gap-3">
          {/* History log toggler */}
          <button
            id="history-drawer-button"
            onClick={() => {
              playClick("click");
              setShowHistoryDrawer(!showHistoryDrawer);
            }}
            className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all duration-150 ${
              showHistoryDrawer || activeHistoryNoteId
                ? "bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]"
                : "bg-white text-gray-600 border-[#e5e5eb] hover:bg-[#fafafc]"
            }`}
            title="Archived Notes logs stored locally"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Archive Logs</span>
            {notesHistory.length > 0 && (
              <span id="history-badge-count" className="bg-[#1d1d1f] text-white text-[10px] font-mono px-1.5 py-0.5 rounded-full scale-90">
                {notesHistory.length}
              </span>
            )}
          </button>

          {/* Sound clicker mechanics keypress toggle */}
          <button
            id="tactile-audio-toggle"
            onClick={handleAudioToggle}
            className={`p-2.5 rounded-lg border transition-all duration-150 relative cursor-pointer ${
              isAudioEnabled
                ? "bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]"
                : "bg-white text-gray-400 border-[#e5e5eb] hover:text-gray-600"
            }`}
            title={isAudioEnabled ? "Mute mechanical keys click cues" : "Unmute high-fidelity mechanical click cues"}
          >
            {isAudioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            {isAudioEnabled && (
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d4af37] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d4af37]"></span>
              </span>
            )}
          </button>

          {/* Connected state and sandbox indicators */}
          <div id="connection-status-pill" className="hidden md:flex items-center gap-2 border border-[#e5e5eb] bg-white rounded-lg px-3 py-1.5 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-orange-400"}`}></span>
            <span className="text-gray-500 uppercase">{isOnline ? "Cloud Sandbox Ready" : "Offline Sandbox Active"}</span>
          </div>
        </div>
      </header>

      {/* Core split screen container */}
      <main id="noteoli-main" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Workspace Areas (Left 7 Columns = 70% space) */}
        <div id="workstation-canvas-container" className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Main workspace title bar */}
          <div id="canvas-header" className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-400 tracking-wider">01 //</span>
              <h2 id="canvas-heading" className="font-display font-medium text-lg text-[#1d1d1f]">
                RAW CAPTURE WORKSPACE
              </h2>
              {activeHistoryNoteId && (
                <span className="text-[11px] bg-gray-200 text-gray-700 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full"></span>
                  Editing Archived Note
                </span>
              )}
            </div>
            
            <div id="canvas-quick-tools" className="flex items-center gap-2">
              <button
                id="load-sample-button"
                onClick={injectSample}
                className="text-xs text-gray-500 hover:text-[#d4af37] flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-gray-100 transition-colors"
                title="Populate messy notes to check transformation"
              >
                <Layers className="w-3.5 h-3.5" />
                Inject Messy Notes
              </button>
              {inputText && (
                <button
                  id="clear-canvas-button"
                  onClick={clearWorkspace}
                  className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 px-2 py-1.5 rounded hover:bg-red-50/50 transition-colors"
                  title="Clear the active workspaces"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Double or single notebook canvas */}
          <div id="canvases-split-view" className={`grid grid-cols-1 gap-4 ${outputText ? "md:grid-cols-2" : ""}`}>
            
            {/* Input Canvas element */}
            <div id="raw-canvas-card" className="bg-white rounded-xl border border-[#e5e5eb] shadow-sm flex flex-col relative focus-within:border-[#d4af37] focus-within:shadow-[0_4px_16px_rgba(212,175,55,0.04)] transition-all">
              <textarea
                id="raw-note-textarea"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                }}
                disabled={isProcessing}
                placeholder="Pour your chaotic raw thoughts here... No formatting, no pressure. Let Oli gather the signals, organize the chaos, and craft the archives."
                className="w-full h-[520px] p-6 sm:p-8 font-mono text-[#1d1d1f] text-base leading-relaxed bg-white border-none rounded-xl resize-none outline-none focus:ring-0 placeholder:text-gray-300 placeholder:italic disabled:opacity-60 disabled:cursor-not-allowed"
              />
              
              {/* Counter / details bar */}
              <div id="input-metrics-bar" className="border-t border-[#f5f5f7] px-6 py-3 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                <div className="flex items-center gap-3">
                  <span>{inputText.length} CHARS</span>
                  <span>{inputText.trim() ? inputText.trim().split(/\s+/).length : 0} WORDS</span>
                </div>
                <div>
                  <span>DRAFT SAVED IN PRIVATE STORAGE</span>
                </div>
              </div>
            </div>

            {/* Oli's Transformed Output canvas Panel */}
            {outputText && (
              <div
                ref={outputSectionRef}
                id="polished-canvas-card"
                className="bg-white rounded-xl border border-[#d4af37]/30 shadow-md flex flex-col relative animate-fade-in"
              >
                
                {/* Panel Top header */}
                <div id="polished-canvas-header" className="border-b border-[#f5f5f7] px-5 py-3 flex items-center justify-between bg-white rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse"></span>
                    <span className="font-display font-medium text-xs tracking-wider uppercase text-[#1d1d1f]">
                      02 // archive draft
                    </span>
                  </div>
                  
                  {/* Tab controllers */}
                  <div id="format-preview-tabs" className="bg-[#f5f5f7] p-0.5 rounded-lg flex items-center text-[10px] font-mono border border-[#e5e5eb]">
                    <button
                      id="tab-preview-rendered"
                      onClick={() => {
                        playClick("click");
                        setOutputTab("preview");
                      }}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        outputTab === "preview"
                          ? "bg-white text-[#1d1d1f] font-semibold shadow-sm"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Rendered
                      </span>
                    </button>
                    <button
                      id="tab-preview-raw"
                      onClick={() => {
                        playClick("click");
                        setOutputTab("raw");
                      }}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        outputTab === "raw"
                          ? "bg-white text-[#1d1d1f] font-semibold shadow-sm"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Code className="w-3 h-3" /> Markdown
                      </span>
                    </button>
                  </div>
                </div>

                {/* Main scrollable text layout */}
                <div id="polished-output-scroll-container" className="flex-1 p-6 sm:p-8 overflow-y-auto max-h-[468px] min-h-[468px] bg-[#fafafc]">
                  {outputTab === "preview" ? (
                    <div
                      id="rendered-preview-markdown"
                      className="prose prose-slate max-w-none text-[#1d1d1f] leading-relaxed break-words"
                      dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(outputText) }}
                    />
                  ) : (
                    <pre
                      id="raw-markdown-block"
                      className="font-mono text-xs text-gray-700 whitespace-pre-wrap leading-relaxed select-text"
                    >
                      {outputText}
                    </pre>
                  )}
                </div>

                {/* Foot actionable export and save segment */}
                <div id="polished-actions-foot-bar" className="border-t border-[#f5f5f7] px-4 py-3 flex flex-wrap items-center justify-between bg-white rounded-b-xl gap-2">
                  <div id="copiers-btn-group" className="flex items-center gap-1.5 flex-wrap">
                    {/* Rich text copy optimized for physical word architectures */}
                    <button
                      id="action-copy-rich"
                      onClick={handleCopyRichText}
                      className="px-3 py-1.5 rounded bg-white hover:bg-[#fafafc] border border-[#e5e5eb] text-xs font-medium flex items-center gap-1 transition-colors hover:border-gray-300"
                      title="Copy styled layout to clipboard (paste straight into Apple Notes/Obsidian)"
                    >
                      <Check className={`w-3.5 h-3.5 text-[#d4af37] ${copiedType === "rich" ? "scale-100 opacity-100" : "scale-0 opacity-0 w-0"}`} />
                      <span>{copiedType === "rich" ? "Copied Rich!" : "Copy Clipboard"}</span>
                    </button>

                    <button
                      id="action-copy-markdown"
                      onClick={handleCopyMarkdown}
                      className="px-3 py-1.5 rounded bg-white hover:bg-[#fafafc] border border-[#e5e5eb] text-xs font-medium flex items-center gap-1 transition-colors hover:border-gray-300 text-gray-500"
                      title="Copy raw markdown text syntax"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Markdown</span>
                    </button>
                  </div>

                  <div id="savers-btn-group" className="flex items-center gap-1.5">
                    {/* Native local export segment */}
                    <button
                      id="action-export-disk"
                      onClick={exportToLocalDisk}
                      className="px-3 py-1.5 rounded bg-white hover:bg-[#fafafc] border border-[#e5e5eb] text-xs font-medium flex items-center gap-1 transition-colors hover:border-[#d4af37] hover:text-[#d4af37]"
                      title="Download Markdown note to local disk using Blob elements"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save as File</span>
                    </button>

                    {/* Commit note to log system */}
                    <button
                      id="action-commit-log"
                      onClick={saveToHistory}
                      className="px-3 py-1.5 rounded bg-[#1d1d1f] hover:bg-neutral-800 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                      title="Commit note to inside archive logs"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>Archive Log</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Quick info tip for stationary terminal */}
          <div id="workspace-help-tip" className="bg-[#e5e5eb]/30 border border-[#e5e5eb] rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-gray-500">
            <Info className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
            <p>
              <strong>🔒 100% Private:</strong> Your notes never leave this device. The <strong>one-click copy</strong> format renders raw markdown into standard clipboard layers, preserving list ticks and header sizes when pasting to Obsidian.
            </p>
          </div>

        </div>

        {/* Oli Co-Pilot Controller Card (Right 3 Columns = 30% space) */}
        <div id="copilot-control-panel-container" className="lg:col-span-3 flex flex-col gap-4">
          
          <div id="copilot-header" className="flex items-center gap-2">
            <span className="text-sm font-mono text-gray-400 tracking-wider">02 //</span>
            <h2 id="copilot-heading" className="font-display font-medium text-lg text-[#1d1d1f]">
              OLI AI PARAMETER CARDS
            </h2>
          </div>

          {/* Control board module */}
          <div id="parameter-board-card" className="bg-white rounded-xl border border-[#e5e5eb] shadow-sm p-5 sm:p-6 flex flex-col gap-6 relative">
            
            {/* Top gold line representing luxurious stationary aesthetics */}
            <div className="absolute top-0 inset-x-0 h-1 bg-[#d4af37] rounded-t-xl" />

            {/* Sandbox selection slider representing mechanical toggle buttons */}
            <div id="sandbox-engine-switch" className="flex flex-col gap-2">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>Transformation Engine</span>
                <span className={`text-[10px] uppercase font-semibold border px-1.5 py-0.5 rounded ${
                  sandboxMode === "cloud" ? "bg-amber-50 text-[#d4af37] border-[#d4af37]/30" : "bg-neutral-50 text-gray-500 border-gray-200"
                }`}>
                  {sandboxMode === "cloud" ? "Cloud SLM Hybrid" : "Safe Native Rule"}
                </span>
              </label>

              <div className="grid grid-cols-2 bg-[#f5f5f7] p-1 rounded-lg text-xs font-mono border border-[#e5e5eb] gap-1">
                <button
                  id="engine-cloud-btn"
                  onClick={() => {
                    playClick("click");
                    if (!isOnline) {
                      showToast("No active connection. Cloud hybrid mode requires network connectivity.", "error");
                      return;
                    }
                    setSandboxMode("cloud");
                  }}
                  className={`py-2 px-1 rounded-md text-center transition-all ${
                    sandboxMode === "cloud"
                      ? "bg-white text-black font-semibold shadow-sm border border-[#e5e5eb]"
                      : "text-gray-400 hover:text-gray-600 cursor-pointer"
                  }`}
                >
                  Cloud Hybrid
                </button>
                <button
                  id="engine-local-btn"
                  onClick={() => {
                    playClick("click");
                    setSandboxMode("local");
                  }}
                  className={`py-2 px-1 rounded-md text-center transition-all ${
                    sandboxMode === "local"
                      ? "bg-white text-black font-semibold shadow-sm border border-[#e5e5eb]"
                      : "text-gray-400 hover:text-gray-600 cursor-pointer"
                  }`}
                >
                  Local Sandbox
                </button>
              </div>

              {sandboxMode === "local" && (
                <div id="local-model-selector-panel" className="mt-2 flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
                    Active GPU Engine
                  </label>
                  <div className="w-full p-2 bg-neutral-50 border border-neutral-100 rounded-md text-xs font-mono font-semibold text-[#1d1d1f]">
                    Oli (Llama 3.2 1B-Instruct)
                  </div>

                  <div id="local-model-status-container" className="p-3 bg-neutral-50 rounded-lg border border-neutral-100 font-mono text-[11px] text-gray-500">
                    <div className="flex items-center justify-between mb-1.5 font-bold">
                      <span className="truncate max-w-[140px]">Oli Engine</span>
                      <span className={`${
                        localLlmStatus === "ready" ? "text-green-600" :
                        localLlmStatus === "loading" ? "text-amber-500 animate-pulse" :
                        localLlmStatus === "unsupported" ? "text-gray-400" : "text-gray-400"
                      }`}>
                        {localLlmStatus === "ready" ? "Ready" :
                         localLlmStatus === "loading" ? "Downloading" :
                         localLlmStatus === "unsupported" ? "Offline Backup" : "On-Demand Sandbox"}
                      </span>
                    </div>
                    {localLlmStatus === "loading" && (
                      <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-[#d4af37]" style={{ width: `${llmProgress * 100}%` }}></div>
                      </div>
                    )}
                    <p className="text-[10px] leading-tight text-gray-400">
                      {localLlmStatus === "loading" ? llmProgressMsg :
                       localLlmStatus === "ready" ? "🔒 100% internet-free processing via browser-cached weights." :
                       localLlmStatus === "unsupported" ? "WebGPU not active or device lost. NoteOli fell back to local rules." :
                       "Warming this mode secures 100% offline edge-AI storage limits."}
                    </p>
                    {localLlmStatus === "ready" && (
                      <button
                        id="unload-weights-btn"
                        type="button"
                        onClick={async () => {
                          playClick("click");
                          try {
                            const { unloadWebLlmEngine } = await import("./utils/webLlmEngine");
                            await unloadWebLlmEngine();
                            setLocalLlmStatus("idle");
                            setUseActualLlm(false);
                            showToast("Local model weights unloaded. GPU memory freed.", "success");
                          } catch (err: any) {
                             showToast("Failed to unload weights cleanly.", "error");
                          }
                        }}
                        className="mt-2 w-full py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded text-[10px] font-mono uppercase font-semibold tracking-wider transition-colors cursor-pointer border border-neutral-200 text-center"
                      >
                        Unload weights (Free GPU Memory)
                      </button>
                    )}
                    {localLlmStatus === "unsupported" && (
                      <button
                        id="reinit-webgpu-btn"
                        type="button"
                        onClick={() => {
                          playClick("click");
                          warmLocalLlm(true);
                        }}
                        className="mt-2 w-full py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-[#c5a059] border border-[#d4af37]/40 rounded text-[10px] font-mono uppercase font-semibold tracking-wider transition-colors cursor-pointer text-center"
                      >
                        🔄 Re-Initialize WebGPU
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Parameter UI: Tone Selector Grid */}
            <div id="tone-ui-matrix" className="flex flex-col gap-2">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-500">
                Tone
              </label>
              
              <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                {(["Professional", "Casual", "Academic", "Creative"] as Tone[]).map((t) => (
                  <button
                    key={t}
                    id={`tone-select-${t.toLowerCase()}`}
                    onClick={() => {
                      playClick("click");
                      setTone(t);
                    }}
                    className={`py-3 px-2 text-center rounded-lg border transition-all flex flex-col items-center justify-center gap-1.5 ${
                      tone === t
                        ? "bg-[#d4af37]/5 text-[#1d1d1f] border-[#d4af37] font-semibold"
                        : "bg-white text-gray-500 border-[#e5e5eb] hover:bg-[#fafafc] hover:border-gray-300"
                    }`}
                  >
                    <span className="text-xs leading-none">{t}</span>
                    <span className="text-[9px] text-gray-400 font-normal font-mono scale-95 leading-none">
                      {t === "Professional" && "Executive logic"}
                      {t === "Casual" && "Approachable style"}
                      {t === "Academic" && "Scholarly precise"}
                      {t === "Creative" && "Poetic cadence"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Parameter UI: Length Control Precision Slider */}
            <div id="length-ui-slider" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-500">
                  Length
                </label>
                <span className={`text-xs font-mono font-bold text-[#d4af37]`}>
                  {length > 0 ? `+${length}` : length}
                </span>
              </div>
              
              <input
                id="length-slider-range"
                type="range"
                min="-10"
                max="10"
                step="1"
                value={length}
                onChange={(e) => {
                  setLength(Number(e.target.value));
                }}
                className="w-full h-1.5 bg-gray-200 rounded-lg cursor-pointer accent-[#d4af37] py-2"
              />
              
              <div id="length-slider-description" className="flex justify-between text-[9px] font-mono text-gray-400 mt-1 uppercase leading-snug">
                <span className={length < 0 ? "text-[#d4af37]" : ""}>-10 Compressing Outline</span>
                <span className={length === 0 ? "text-[#d4af37]" : ""}>0 Equal</span>
                <span className={length > 0 ? "text-[#d4af37]" : ""}>+10 Elaboration</span>
              </div>
            </div>

            {/* Parameter UI: Utility Dropdown Selector */}
            <div id="utility-ui-dropdown" className="flex flex-col gap-2">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-500">
                Choose a Tool
              </label>
              
              <div className="relative">
                <select
                  id="utility-select-menu"
                  value={utility}
                  onChange={(e) => {
                    playClick("click");
                    setUtility(e.target.value as any);
                  }}
                  className="w-full p-3 bg-white border border-[#e5e5eb] rounded-lg text-xs font-medium text-[#1d1d1f] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] appearance-none cursor-pointer pr-10"
                >
                  <option id="macro-option-none" value="none">-- Optional: Choose a Tool --</option>
                  {UTILITY_MACROS.map((macro) => (
                    <option
                      key={macro.name}
                      id={`macro-option-${macro.name.toLowerCase().replace(/\s+/g, "-")}`}
                      value={macro.name}
                    >
                      {macro.icon}  {macro.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Main Action Call button with sound trigger and tactile ripples */}
            <button
              id="oli-transform-trigger-btn"
              disabled={isProcessing}
              onClick={runOliTransform}
              className={`w-full py-4 px-6 rounded-lg font-display font-medium text-lg text-black transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden ${
                isProcessing
                  ? "bg-slate-100 text-gray-400 stroke-gray-400 border border-slate-200 cursor-not-allowed"
                  : "bg-[#d4af37] text-slate-900 border border-[#d4af37] hover:bg-[#c5a059] hover:border-[#c5a059] hover:shadow-[0_4px_16px_rgba(212,175,55,0.2)]"
              } ${rippleActive ? "animate-gold-ripple" : ""}`}
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-mono text-sm leading-none">OLI PROCESSING...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>✨ Ask Oli</span>
                </>
              )}
            </button>

            {/* Inline subtle progress indicator */}
            {isProcessing && (
              <div id="inline-processing-bar" className="flex flex-col gap-1.5 text-center mt-[-10px] text-[11px] font-mono animate-pulse text-gray-500 bg-neutral-50 p-2.5 rounded border border-neutral-100">
                <span className="font-semibold text-[#d4af37]">{processingPhase}</span>
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#d4af37] animate-[shimmer_1.5s_infinite] rounded-full w-4/5"></div>
                </div>
              </div>
            )}

          </div>

          {/* Quick Clear Current Draft logs indicator */}
          <button
            id="commit-draft-history-btn"
            onClick={saveToHistory}
            className="w-full text-xs text-center border border-[#e5e5eb] bg-white hover:bg-neutral-50 p-3.5 rounded-lg font-mono text-gray-500 font-semibold hover:text-black transition-all flex items-center justify-center gap-1.5 shrink-0"
          >
            <PlusCircle className="w-4 h-4 text-[#d4af37]" />
            Commit Current to Archive
          </button>

        </div>

      </main>

      {/* Slide-out Archive logs Panel drawer */}
      {showHistoryDrawer && (
        <div id="archive-history-overlay" className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-xs z-50 flex justify-end transition-opacity">
          
          <div id="archive-drawer-card" className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 relative border-l border-[#e5e5eb] animate-[slideLeft_0.2s_ease-out]">
            
            {/* Header of Drawer */}
            <div className="flex items-center justify-between border-b border-[#f5f5f7] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#d4af37]" />
                <h3 className="font-display font-semibold text-lg text-black">
                  Archived Note Logs
                </h3>
              </div>
              <button
                id="close-archive-drawer-btn"
                onClick={() => {
                  playClick("click");
                  setShowHistoryDrawer(false);
                }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-gray-400 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search segment for history */}
            <div id="drawer-search-bar" className="relative mb-4">
              <input
                id="search-history-input-field"
                type="text"
                value={searchHistoryQuery}
                onChange={(e) => setSearchHistoryQuery(e.target.value)}
                placeholder="Search raw context and titles..."
                className="w-full pl-3 pr-10 py-2 border border-[#e5e5eb] rounded-lg text-sm bg-neutral-50 focus:bg-white focus:outline-none focus:border-[#d4af37]"
              />
              {searchHistoryQuery && (
                <button
                  id="search-clear-input-btn"
                  onClick={() => setSearchHistoryQuery("")}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-black"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* List scroll panel */}
            <div id="drawer-archive-list" className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 font-mono text-xs max-w-xs mx-auto flex flex-col items-center gap-3">
                  <p>No archived record segments found matching search criteria.</p>
                  <button
                    id="populate-drawer-sample-btn"
                    onClick={injectSample}
                    className="text-[11px] font-mono text-[#d4af37] underline"
                  >
                    Load dynamic notes preview
                  </button>
                </div>
              ) : (
                filteredHistory.map((note) => (
                  <div
                    key={note.id}
                    id={`archive-log-item-${note.id}`}
                    onClick={() => loadHistoricNote(note)}
                    className={`block p-4 rounded-lg border text-left cursor-pointer transition-all ${
                      activeHistoryNoteId === note.id
                        ? "bg-[#d4af37]/5 border-[#d4af37] shadow-sm"
                        : "bg-white border-zinc-200 hover:border-gray-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5 mb-1">
                      <h4 className="font-semibold text-xs text-[#1d1d1f] line-clamp-1 leading-snug">
                        {note.title}
                      </h4>
                      <button
                        id={`delete-archive-item-btn-${note.id}`}
                        onClick={(e) => deleteHistoricNote(note.id, e)}
                        className="text-gray-300 hover:text-red-500 p-1 rounded-md transition-colors hover:bg-red-50"
                        title="Delete record securely"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed mb-2.5 font-mono">
                      {note.content.substring(0, 160)}
                    </p>

                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-400">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      <span className="text-zinc-300">•</span>
                      <span>{note.content.length} CHS</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom actions for Drawer logs */}
            <div className="border-t border-[#f5f5f7] pt-4 mt-4 flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>Total Logs: {notesHistory.length} items</span>
              {notesHistory.length > 0 && (
                <button
                  id="action-nuke-all-logs-btn"
                  onClick={() => {
                    if (confirm("Are you sure you want to securely erase all archived logs from native local web storage?")) {
                      playClick("click");
                      setNotesHistory([]);
                      storage.saveNotes([]);
                      setActiveHistoryNoteId(null);
                      showToast("All native local history erased.", "info");
                    }
                  }}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  Secure Erase All
                </button>
              )}
            </div>

          </div>

        </div>
      )}

      {/* Styled clean layout stationery footer */}
      <footer id="noteoli-footer" className="bg-[#f5f5f7] border-t border-[#e5e5eb] px-6 py-4 text-center mt-auto text-[10px] font-mono text-zinc-400 tracking-wider">
        <span>PROJECT NOTEOLI — SCRIPT ARCHIVAL WORKBENCH. DESIGNED FOR HIGH-SPEED TEXT TRANSLATION. </span>
        <span className="hidden sm:inline">• NATIVE BROWSER ENCRYPTED PERSISTENCE.</span>
      </footer>

    </div>
  );
}
