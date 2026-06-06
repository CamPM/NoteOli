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
  Code,
  MessageSquare,
  Send,
  Cpu,
  Sun,
  Moon
} from "lucide-react";

import { Tone, UtilityMacro, NoteEntry } from "./types";
import * as audio from "./utils/audio";
import * as storage from "./utils/storage";
import { transformLocally } from "./utils/localTransformer";
import { SUPPORTED_MODELS } from "./utils/webLlmEngine";

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
  
  // NoteOli is now strictly 100% offline-first.
  const [mindset, setMindset] = useState<"default" | "booster" | "critic" | "randomizer" | "brainstormer">(() => {
    try {
      const saved = localStorage.getItem("noteoli_chat_mindset");
      if (saved && ["default", "booster", "critic", "randomizer", "brainstormer"].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return "default";
  });

  const [localLlmStatus, setLocalLlmStatus] = useState<"idle" | "loading" | "ready" | "failed" | "unsupported">("idle");
  const [llmProgress, setLlmProgress] = useState<number>(0);
  const [llmProgressMsg, setLlmProgressMsg] = useState<string>("");
  const [useActualLlm, setUseActualLlm] = useState<boolean>(false);
  const [selectedLlmModel, setSelectedLlmModel] = useState<string>("Qwen2.5-0.5B-Instruct-q4f16_1-MLC");
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Newly requested "Chat with Oli" interface states
  const [activeTab, setActiveTab] = useState<"edit" | "output" | "chat">("edit");
  const [chatInitiated, setChatInitiated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("noteoli_chat_initiated");
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [chatMessages, setChatMessages] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("noteoli_chat_messages");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [
      {
        id: "welcome-msg",
        sender: "oli",
        text: `*Flicks plumed tail.* My ears are up and I'm listening. What's on your mind today? Let's talk. (=^･ω･^=)`,
        timestamp: new Date().toLocaleTimeString(),
        meta: "💬 Just Chat"
      }
    ];
  });
  const [chatInput, setChatInput] = useState<string>("");
  const [chatIsResponding, setChatIsResponding] = useState<boolean>(false);

  // Background listener for caching chat state (localStorage state tracking)
  useEffect(() => {
    try {
      localStorage.setItem("noteoli_chat_messages", JSON.stringify(chatMessages));
      localStorage.setItem("noteoli_chat_initiated", JSON.stringify(chatInitiated));
      localStorage.setItem("noteoli_chat_mindset", mindset);
    } catch (err) {
      console.error("Failed to cache chat state:", err);
    }
  }, [chatMessages, chatInitiated, mindset]);

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
  const [copiedType, setCopiedType] = useState<"raw" | "rich" | "markdown" | "scratchpad" | null>(null);

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

  // Global proactive hook to catch unhandled WebGPU device loss or memory issues asynchronously
  useEffect(() => {
    const handleGlobalError = async (event: any) => {
      const errorObj = event.reason || event.error || event;
      if (!errorObj) return;

      const errorText = `${errorObj.message || ""} ${errorObj.toString() || ""} ${errorObj.stack || ""}`.toLowerCase();
      const isGpuIssue = errorText.includes("lost") || 
                         errorText.includes("unmapped") || 
                         errorText.includes("memory") || 
                         errorText.includes("gpudevicelostinfo") || 
                         errorText.includes("gpudevice") || 
                         errorText.includes("buffer") || 
                         errorText.includes("exhausted") || 
                         errorText.includes("limit exceeded");

      if (isGpuIssue) {
        console.warn("Global WebGPU failure detected. Triggering self-healing unload and model downgrade...", errorObj);
        try {
          const { unloadWebLlmEngine } = await import("./utils/webLlmEngine");
          await unloadWebLlmEngine();
        } catch (e) {
          console.warn("Failed to globally unload WebLLM engine:", e);
        }

        if (selectedLlmModel === "gemma-2-2b-it-q4f16_1-MLC") {
          showToast("WebGPU memory limit exceeded. Auto-downgrading active weights to Ultra-Light Qwen 2.5 0.5B.", "info");
          setSelectedLlmModel("Qwen2.5-0.5B-Instruct-q4f16_1-MLC");
          setLocalLlmStatus("idle");
          setUseActualLlm(false);
        } else if (selectedLlmModel === "Qwen2.5-0.5B-Instruct-q4f16_1-MLC") {
          showToast("WebGPU memory limit exceeded. Auto-downgrading active weights to Feather-Weight SmolLM2 360M.", "info");
          setSelectedLlmModel("SmolLM2-360M-Instruct-q4f16_1-MLC");
          setLocalLlmStatus("idle");
          setUseActualLlm(false);
        } else {
          showToast("WebGPU lost context completely. Local LLM weights disabled.", "info");
          setLocalLlmStatus("unsupported");
          setUseActualLlm(false);
        }
      }
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleGlobalError);

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleGlobalError);
    };
  }, [selectedLlmModel]);



  // Monitor browser network offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast("Network offline. NoteOli operates in 100% offline-first mode.", "info");
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
      
      const { SUPPORTED_MODELS, initializeWebLlmEngine, setActiveModelId } = await import("./utils/webLlmEngine");
      
      // Make sure the active model id in the engine matches our selected state
      setActiveModelId(selectedLlmModel);
      
      const modelMeta = SUPPORTED_MODELS.find((m) => m.id === selectedLlmModel);
      const currentModelName = modelMeta ? modelMeta.name : "Local Model";
      setLlmProgressMsg(`Initializing WebGPU for ${currentModelName} (Oli)...`);
      
      await initializeWebLlmEngine((prog, msg) => {
        setLlmProgress(prog);
        setLlmProgressMsg(msg);
      });
      
      setLocalLlmStatus("ready");
      setUseActualLlm(true);
      if (showToasts) {
        showToast(`Oli (${currentModelName}) ready via WebGPU local offline execution.`, "success");
      }
    } catch (err: any) {
      console.warn("WebLLM initialization failed, falling back to rule-compiler:", err);
      
      const errMsg = `${err?.message || ""} ${err?.toString() || ""} ${err?.stack || ""} ${JSON.stringify(err) || ""}`.toLowerCase();
      const isGpuIssue = errMsg.includes("lost") || 
                         errMsg.includes("unmapped") || 
                         errMsg.includes("memory") || 
                         errMsg.includes("gpudevicelostinfo") || 
                         errMsg.includes("gpudevice") || 
                         errMsg.includes("buffer") ||
                         errMsg.includes("exhausted") ||
                         errMsg.includes("limit exceeded");
      
      if (isGpuIssue) {
        if (selectedLlmModel === "gemma-2-2b-it-q4f16_1-MLC") {
          showToast("GPU memory limit exceeded or context lost. Auto-downgrading to Ultra-Light Qwen 2.5 0.5B for safety.", "info");
          setSelectedLlmModel("Qwen2.5-0.5B-Instruct-q4f16_1-MLC");
          setLocalLlmStatus("idle");
          setUseActualLlm(false);
          setTimeout(() => {
            warmLocalLlm(showToasts);
          }, 300);
          return;
        } else if (selectedLlmModel === "Qwen2.5-0.5B-Instruct-q4f16_1-MLC") {
          showToast("GPU memory limit exceeded. Auto-downgrading to Feather-Weight SmolLM2 360M for safety.", "info");
          setSelectedLlmModel("SmolLM2-360M-Instruct-q4f16_1-MLC");
          setLocalLlmStatus("idle");
          setUseActualLlm(false);
          setTimeout(() => {
            warmLocalLlm(showToasts);
          }, 300);
          return;
        }
      }
      
      setLocalLlmStatus("unsupported");
      setUseActualLlm(false);
      if (showToasts) {
        showToast(err.message || "Failed loading model weights. Utilizing local rule-compiler fallback.", "error");
      }
    }
  };

  // Warm-up local LLM proactively when app mounts or model is switched
  useEffect(() => {
    if (localLlmStatus === "idle") {
      warmLocalLlm(true);
    }
  }, [selectedLlmModel, localLlmStatus]);

  // Persona initiation and conversation reset helper
  const handleInitChat = (selectedMindset: "default" | "booster" | "critic" | "randomizer" | "brainstormer") => {
    playClick("click");
    setMindset(selectedMindset);
    setChatInitiated(true);
    
    let starterText = "";
    let metaText = "";
    if (selectedMindset === "default") {
      starterText = `*Flicks plumed tail.* My ears are up and I'm listening. What's on your mind today? Let's talk. (=^･ω･^=)`;
      metaText = "💬 Just Chat Active";
    } else if (selectedMindset === "booster") {
      starterText = `*Chirps happily.* I can tell you've got something cooking. Lay it on me, let's make it huge! 🚀 ヽ(=^･ω･^=)丿`;
      metaText = "🚀 Booster Active";
    } else if (selectedMindset === "randomizer") {
      starterText = `*Purrs playfully.* Let's make things interesting. Give me a concept, and I'll toss it into a completely parallel universe to see how it lands. 🎲 (=｀ω´=)`;
      metaText = "🎲 Randomizer Active";
    } else if (selectedMindset === "brainstormer") {
      starterText = `*Points ears forward.* There are hidden angles to this strategy that we haven't tracked down yet. Lay out your topic, and let's explore the territory. (︶￣ω￣︶)`;
      metaText = "🧠 Brainstormer Active";
    } else {
      starterText = `*Flicks plumed tail and looks at you strategically.* Audit mode engaged. Put your notes out there, let's poke some logical holes in them. (=｀•ω•´=)`;
      metaText = "🔍 Critic Active";
    }
    
    setChatMessages([
      {
        id: "oli-init-msg-" + Date.now(),
        sender: "oli" as const,
        text: starterText,
        timestamp: new Date().toLocaleTimeString(),
        meta: metaText
      }
    ]);
  };

  // Copy conversation logs directly as Markdown format
  const handleCopyChatLogs = async () => {
    playClick("click");
    if (chatMessages.length === 0) {
      showToast("No active conversation logs to copy.", "error");
      return;
    }

    const logHeader = `# NoteOli Active Conversation Logs with Oliver (Oli)\nGenerated on: ${new Date().toLocaleString()}\nActive Mindset: ${mindset.toUpperCase()}\n\n---\n\n`;
    const logBody = chatMessages.map(msg => {
      const senderName = msg.sender === "user" ? "Human" : "Oliver (Oli)";
      const roleEmoji = msg.sender === "user" ? "👤" : "🐱";
      return `### ${roleEmoji} ${senderName} [${msg.timestamp}]\n\n${msg.text}\n`;
    }).join("\n---\n\n");

    const fullText = logHeader + logBody;

    try {
      await navigator.clipboard.writeText(fullText);
      showToast("Copied full chat session logs as Markdown!", "success");
      playClick("success");
    } catch (err) {
      showToast("Failed to copy logs to clipboard.", "error");
    }
  };

  // Export raw markdown log file and prompt downloads
  const handleSaveChatFile = () => {
    playClick("click");
    if (chatMessages.length === 0) {
      showToast("No active conversation logs to save.", "error");
      return;
    }

    try {
      const logHeader = getExportHeader("Chat");
      const logBody = chatMessages.map(msg => {
        const senderName = msg.sender === "user" ? "Human" : "Oliver (Oli)";
        const roleEmoji = msg.sender === "user" ? "👤" : "🐱";
        return `### ${roleEmoji} ${senderName} [${msg.timestamp}]\n\n${msg.text}\n`;
      }).join("\n---\n\n");

      const textToSave = logHeader + logBody;
      const timestamp = new Date().toISOString().slice(0, 10) + "_" + new Date().toTimeString().slice(0, 8).replace(/:/g, "-");
      const filename = `oliver_chat_log_${timestamp}.md`;

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
      showToast(`Exported "${filename}" straight to Downloads folder!`, "success");
    } catch (err) {
      showToast("Failed to save draft log file.", "error");
    }
  };

  // Reset conversation log and pull up initial chat message
  const handleClearChatHistory = () => {
    playClick("click");
    let initStarterText = `*Flicks plumed tail.* My ears are up and I'm listening. What's on your mind today? Let's talk. (=^･ω･^=)`;
    let initMetaText = "💬 Just Chat Active";

    if (mindset === "booster") {
      initStarterText = `*Chirps happily.* I can tell you've got something cooking. Lay it on me, let's make it huge! 🚀 ヽ(=^･ω･^=)丿`;
      initMetaText = "🚀 Booster Active";
    } else if (mindset === "randomizer") {
      initStarterText = `*Purrs playfully.* Let's make things interesting. Give me a concept, and I'll toss it into a completely parallel universe to see how it lands. 🎲 (=｀ω´=)`;
      initMetaText = "🎲 Randomizer Active";
    } else if (mindset === "brainstormer") {
      initStarterText = `*Points ears forward.* There are hidden angles to this strategy that we haven't tracked down yet. Lay out your topic, and let's explore the territory. (︶￣ω￣︶)`;
      initMetaText = "🧠 Brainstormer Active";
    } else if (mindset === "critic") {
      initStarterText = `*Flicks plumed tail and looks at you strategically.* Audit mode engaged. Put your notes out there, let's poke some logical holes in them. (=｀•ω•´=)`;
      initMetaText = "🔍 Critic Active";
    }

    setChatMessages([
      {
        id: "oli-init-msg-" + Date.now(),
        sender: "oli" as const,
        text: initStarterText,
        timestamp: new Date().toLocaleTimeString(),
        meta: initMetaText
      }
    ]);
    showToast("Chat logs cleared.", "info");
  };

  // Newly requested Chat with Oli Handler supporting System Native, Sandboxed Vault, and Cloud Hybrid mode.
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatIsResponding) return;

    playClick("click");
    const userText = chatInput.trim();
    setChatInput("");
    setChatIsResponding(true);

    const userMessage = {
      id: "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      sender: "user" as const,
      text: userText,
      timestamp: new Date().toLocaleTimeString(),
    };

    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);

    try {
      let replyText = "";

      // Make sure local LLM is loaded
      if (localLlmStatus === "idle") {
        await warmLocalLlm(false);
      }

      if (localLlmStatus === "ready" || useActualLlm) {
        try {
          const { runLocalChatWithModel } = await import("./utils/webLlmEngine");
          replyText = await runLocalChatWithModel(updatedMessages, mindset);
        } catch (modelErr: any) {
          console.error("Local SLM chat failed, attempting self-healing recovery:", modelErr);
          const modelErrMsg = `${modelErr?.message || ""} ${modelErr?.toString() || ""} ${modelErr?.stack || ""} ${JSON.stringify(modelErr) || ""}`.toLowerCase();
          const isGpuIssue = modelErrMsg.includes("lost") || 
                             modelErrMsg.includes("unmapped") || 
                             modelErrMsg.includes("memory") || 
                             modelErrMsg.includes("gpudevicelostinfo") || 
                             modelErrMsg.includes("gpudevice") || 
                             modelErrMsg.includes("buffer") || 
                             modelErrMsg.includes("exhausted") || 
                             modelErrMsg.includes("limit exceeded");
          
          if (isGpuIssue) {
            const { unloadWebLlmEngine } = await import("./utils/webLlmEngine");
            await unloadWebLlmEngine();
            
            if (selectedLlmModel === "gemma-2-2b-it-q4f16_1-MLC") {
              showToast("WebGPU memory limit exceeded. Resetting and loading Tier 2 Qwen...", "info");
              setSelectedLlmModel("Qwen2.5-0.5B-Instruct-q4f16_1-MLC");
              setLocalLlmStatus("idle");
              setUseActualLlm(false);
              setTimeout(() => { warmLocalLlm(false); }, 300);
            } else if (selectedLlmModel === "Qwen2.5-0.5B-Instruct-q4f16_1-MLC") {
              showToast("WebGPU memory limit exceeded. Resetting and loading Tier 1 SmolLM2...", "info");
              setSelectedLlmModel("SmolLM2-360M-Instruct-q4f16_1-MLC");
              setLocalLlmStatus("idle");
              setUseActualLlm(false);
              setTimeout(() => { warmLocalLlm(false); }, 300);
            } else {
              showToast("WebGPU lost context completely. Switching off local engine.", "info");
              setLocalLlmStatus("unsupported");
              setUseActualLlm(false);
            }

            // Build smart rule-based response immediately to keep session active seamlessly
            if (mindset === "booster") {
              replyText = `*Flicks plumed tail.* WebGPU memory was low, so I reset to lighter weights, but I'm still listening. Tell me more about "${userText.substring(0, 40)}"! (=^･ω･^=) 🚀`;
            } else if (mindset === "randomizer") {
              replyText = `*Meows curiously.* WebGPU memory was low, so I cleared the cache. Let's stay playful: what if we took "${userText.substring(0, 30)}" and flipped it backward? (=｀ω´=) 🎲`;
            } else if (mindset === "brainstormer") {
              replyText = `*Points ears forward.* WebGPU memory limit triggered a clean reset to prevent locks. Let's keep exploring "${userText.substring(0, 40)}" together. (︶￣ω￣︶)`;
            } else if (mindset === "critic" || mindset === "de-fluff") {
              replyText = `*Looks at you strategically.* WebGPU memory limits hit our active Local LLM weights. I've automatically unloaded them. Let's inspect the situation carefully. (=｀•ω•´=)`;
            } else {
              replyText = `*Flicks plumed tail.* My local WebGPU engine ran low on memory, so I've unloaded the weights to safeguard your browser context. What are your thoughts? (=^･ω･^=)`;
            }
          } else {
            throw modelErr;
          }
        }
      } else {
        // Cozy fallback chat response builder when offline without WebGPU
        await new Promise((r) => setTimeout(r, 800));
        if (mindset === "booster") {
          replyText = `*Chirps happily.* That's a great thought! I love how you're approaching this. Let's talk more about "${userText.substring(0, 50)}...". (=^･ω･^=) 🚀`;
        } else if (mindset === "randomizer") {
          replyText = `*Meows playfully.* Let's look at this from a totally weird angle. What if we completely flipped your main assumption on its head? (=｀ω´=) 🎲`;
        } else if (mindset === "brainstormer") {
          replyText = `*Points ears forward.* Let's map out some alternative directions for "${userText.substring(0, 50)}...". What other options do you see? (︶￣ω￣︶)`;
        } else if (mindset === "critic" || mindset === "de-fluff") {
          replyText = `*Looks at you strategically.* Let's analyze details for "${userText.substring(0, 50)}...". Where do you think the main trade-offs or weaknesses are? (=｀•ω•´=)`;
        } else {
          replyText = `*Flicks plumed tail.* I hear you. Let me think about "${userText.substring(0, 50)}..." for a moment. What are your honest thoughts on how we should play this? (=^･ω･^=)`;
        }
      }

      const activeEngineMeta = selectedLlmModel === "SmolLM2-360M-Instruct-q4f16_1-MLC" ? "Local LLM: Tier 1 (SmolLM2)" : selectedLlmModel === "Qwen2.5-0.5B-Instruct-q4f16_1-MLC" ? "Local LLM: Tier 2 (Qwen 3B)" : "Local LLM: Tier 3 (Gemma 2)";

      const oliMessage = {
        id: "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        sender: "oli" as const,
        text: replyText,
        timestamp: new Date().toLocaleTimeString(),
        meta: activeEngineMeta,
      };

      setChatMessages((prev) => [...prev, oliMessage]);
      playClick("success");

    } catch (e: any) {
      console.error("Chat response execution issue:", e);
      showToast(e.message || "Failed to establish a cozy chat connection with Oli. Checking offline fallback constraints...", "error");
      
      const errorMsg = {
        id: "msg-err-" + Date.now(),
        sender: "oli" as const,
        text: `⚠️ I had a brief synapse disconnect: ${e.message || "connection error"}. Let's make sure our active Local Transformation Engine settings are loaded correctly.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setChatIsResponding(false);
    }
  };

  // Main Oli Sandbox Transformation Orchestrator
  const runOliTransform = async () => {
    if (!inputText.trim()) {
      playClick("click");
      showToast("Canvas is silent. Please write or paste raw text to run Oli.", "error");
      return;
    }

    // Switch view immediately to Output Menu so user watches the conversion compiling
    setActiveTab("output");

    // Trigger haptic mechanical clicking sound and state ripples
    playClick("click");
    setRippleActive(true);
    if (rippleTimeoutRef.current) clearTimeout(rippleTimeoutRef.current);
    rippleTimeoutRef.current = setTimeout(() => setRippleActive(false), 600);

    setIsProcessing(true);
    setProcessingPhase("Calibrating high-precision templates...");

    const phaseDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      // If the model is idle/not ready yet, try to load it first
      if (localLlmStatus === "idle") {
        await warmLocalLlm(false);
      }

      const { SUPPORTED_MODELS } = await import("./utils/webLlmEngine");
      const modelMeta = SUPPORTED_MODELS.find((m) => m.id === selectedLlmModel);
      const currentModelBaseName = modelMeta ? modelMeta.name.split(" (")[0] : "Local LLM";

      if (localLlmStatus === "ready" || useActualLlm) {
        setProcessingPhase(`${currentModelBaseName} local inference via WebGPU...`);
        try {
          const { runLocalTransformWithModel } = await import("./utils/webLlmEngine");
          const response = await runLocalTransformWithModel(inputText, tone, length, utility, mindset);
          setOutputText(response);
          showToast(`Transformed completely offline with ${currentModelBaseName} via WebGPU. [Mindset: ${mindset.toUpperCase()}]`, "success");
        } catch (modelErr: any) {
          console.error("Local SLM transform execution issue:", modelErr);
          const modelErrMsg = `${modelErr?.message || ""} ${modelErr?.toString() || ""} ${modelErr?.stack || ""} ${JSON.stringify(modelErr) || ""}`.toLowerCase();
          const isGpuIssue = modelErrMsg.includes("lost") || 
                             modelErrMsg.includes("unmapped") || 
                             modelErrMsg.includes("memory") || 
                             modelErrMsg.includes("gpudevicelostinfo") || 
                             modelErrMsg.includes("gpudevice") || 
                             modelErrMsg.includes("buffer") || 
                             modelErrMsg.includes("exhausted") || 
                             modelErrMsg.includes("limit exceeded");
          
          if (isGpuIssue) {
            const { unloadWebLlmEngine } = await import("./utils/webLlmEngine");
            await unloadWebLlmEngine();
            
            if (selectedLlmModel === "gemma-2-2b-it-q4f16_1-MLC") {
              showToast("WebGPU memory limit exceeded. Downgrading to Tier 2 Qwen...", "info");
              setSelectedLlmModel("Qwen2.5-0.5B-Instruct-q4f16_1-MLC");
              setLocalLlmStatus("idle");
              setUseActualLlm(false);
              setTimeout(() => { warmLocalLlm(false); }, 300);
            } else if (selectedLlmModel === "Qwen2.5-0.5B-Instruct-q4f16_1-MLC") {
              showToast("WebGPU memory limit exceeded. Downgrading to Tier 1 SmolLM2...", "info");
              setSelectedLlmModel("SmolLM2-360M-Instruct-q4f16_1-MLC");
              setLocalLlmStatus("idle");
              setUseActualLlm(false);
              setTimeout(() => { warmLocalLlm(false); }, 300);
            } else {
              showToast("WebGPU lost context completely. Utilizing backup rule-compiler.", "info");
              setLocalLlmStatus("unsupported");
              setUseActualLlm(false);
            }
            
            // Fallback immediately to local rule compiler
            const response = transformLocally(inputText, tone, length, utility, mindset);
            setOutputText(response);
            showToast("Transformed offline via Backup Rule Coprocessor (due to WebGPU error).", "success");
          } else {
            throw modelErr;
          }
        }
      } else {
        // Rule compilation fallback
        await phaseDelay(300);
        setProcessingPhase("Executing Local Coprocessor...");
        const response = transformLocally(inputText, tone, length, utility, mindset);
        setOutputText(response);
        showToast(`Transformed via Secure Offline Local Coprocessor. [Mindset: ${mindset.toUpperCase()}]`, "success");
      }
      playClick("success");
      
      // Critique 3: Smooth scroll output into view so users don't scroll blindly!
      setTimeout(() => {
        outputSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);

    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to transform note, shifting to local coprocessor.", "error");
      
      // Fallback safely to local transform compiler rather than failing completely
      const fallback = transformLocally(inputText, tone, length, utility, mindset);
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

  const getExportHeader = (viewName: "Scratchpad" | "Polished Note" | "Chat") => {
    let activeEngineName = "Local LLM: Tier 2 (Qwen)";
    if (selectedLlmModel === "SmolLM2-360M-Instruct-q4f16_1-MLC") {
      activeEngineName = "Local LLM: Tier 1 (SmolLM2)";
    } else if (selectedLlmModel === "Qwen2.5-0.5B-Instruct-q4f16_1-MLC") {
      activeEngineName = "Local LLM: Tier 2 (Qwen)";
    } else if (selectedLlmModel === "gemma-2-2b-it-q4f16_1-MLC") {
      activeEngineName = "Local LLM: Tier 3 (Gemma 2)";
    }

    let selectedMode = "";
    if (viewName === "Scratchpad") {
      selectedMode = mindset === "default" ? "Balanced Note Companion" : `${mindset.charAt(0).toUpperCase() + mindset.slice(1)} Mode`;
    } else if (viewName === "Polished Note") {
      selectedMode = utility !== "none" ? utility : (mindset === "default" ? "Balanced Note Companion" : `${mindset.charAt(0).toUpperCase() + mindset.slice(1)} Mode`);
    } else if (viewName === "Chat") {
      selectedMode = `Chat (${mindset === "default" ? "Balanced Note Companion" : `${mindset.charAt(0).toUpperCase() + mindset.slice(1)} Mode`})`;
    }

    const timestamp = new Date().toLocaleString();
    return `# NoteOli Workspace Export\nGenerated on: ${timestamp}\nActive Engine: ${activeEngineName}\nActive Mindset/Tool: ${selectedMode}\n\n---\n\n`;
  };

  // Export to native files using download blob mechanism 
  const exportToLocalDisk = () => {
    playClick("click");
    if (!outputText) {
      showToast("Workspace was silent. Cannot write empty file.", "error");
      return;
    }

    try {
      const fileTitle = outputText.split("\n")[0]?.replace(/[^A-Za-z0-9 ]/g, "").trim().replace(/\s+/g, "_").toLowerCase() || `noteoli_archive`;
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${fileTitle}_${timestamp}.md`;

      const header = getExportHeader("Polished Note");
      const fullContent = header + outputText;

      const blob = new Blob([fullContent], { type: "text/markdown;charset=utf-8" });
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

  const exportScratchpadToLocalDisk = () => {
    playClick("click");
    if (!inputText.trim()) {
      showToast("Scratchpad was silent. Cannot write empty file.", "error");
      return;
    }

    try {
      const fileTitle = inputText.split("\n")[0]?.replace(/[^A-Za-z0-9 ]/g, "").trim().replace(/\s+/g, "_").toLowerCase() || "scratchpad_draft";
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${fileTitle}_${timestamp}.md`;

      const header = getExportHeader("Scratchpad");
      const fullContent = header + inputText;

      const blob = new Blob([fullContent], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      playClick("success");
      showToast(`Exported scratchpad as "${filename}" to Downloads folder.`, "success");
    } catch (err) {
      showToast("Failed to export scratchpad file.", "error");
    }
  };

  const handleCopyScratchpad = async () => {
    playClick("click");
    if (!inputText.trim()) {
      showToast("Scratchpad was silent. Cannot copy empty text.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(inputText);
      setCopiedType("scratchpad");
      setTimeout(() => setCopiedType(null), 2000);
      playClick("success");
      showToast("Copied Scratchpad text to clipboard.", "success");
    } catch (err) {
      // Fallback
      try {
        const tempTextarea = document.createElement("textarea");
        tempTextarea.value = inputText;
        document.body.appendChild(tempTextarea);
        tempTextarea.select();
        document.execCommand("copy");
        document.body.removeChild(tempTextarea);
        setCopiedType("scratchpad");
        setTimeout(() => setCopiedType(null), 2000);
        showToast("Scratchpad text copied to clipboard.", "success");
      } catch (fbErr) {
        showToast("Failed to copy scratchpad text.", "error");
      }
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
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-stone-950 dark:text-stone-100 font-sans mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-stone-950 dark:text-stone-100 font-sans mt-5 mb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black text-stone-950 dark:text-stone-100 font-display mt-6 mb-3">$1</h1>');

    // Convert Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-black">$1</strong>');
    
    // Convert Italics
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-gray-800">$1</em>');

    // Convert backtick inline codes
    html = html.replace(/`(.*?)`/g, '<code class="bg-[#f5f5f7] px-1.5 py-0.5 rounded text-sm text-[#c5a059] font-mono border border-neutral-200 dark:border-neutral-700">$1</code>');

    // Convert list checkboxes unchecked
    html = html.replace(/^\s*-\s*\[\s*\]\s*(.*$)/gim, '<div class="flex items-start gap-2 my-1"><input type="checkbox" disabled class="mt-1 w-4 h-4 accent-[#d4af37]" /> <span class="font-sans text-stone-950 dark:text-stone-100">$1</span></div>');
    
    // Convert list checkboxes checked
    html = html.replace(/^\s*-\s*\[x\]\s*(.*$)/gim, '<div class="flex items-start gap-2 my-1"><input type="checkbox" checked disabled class="mt-1 w-4 h-4 accent-[#d4af37]" /> <span class="font-sans line-through text-gray-500">$1</span></div>');

    // Convert Bullet lists
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc font-sans text-stone-950 dark:text-stone-100 my-0.5">$1</li>');
    html = html.replace(/^\s*•\s+(.*$)/gim, '<li class="ml-4 list-disc font-sans text-stone-950 dark:text-stone-100 my-0.5">$1</li>');

    // Convert Tables markdown syntax (basic line replacement)
    const lines = html.split("\n");
    let inTable = false;
    let tableHtml = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("|") && line.endsWith("|")) {
        if (!inTable) {
          inTable = true;
          tableHtml += '<div class="overflow-x-auto my-4"><table class="min-w-full border border-neutral-200 dark:border-neutral-700 border-collapse bg-white rounded-lg text-sm font-sans">';
        }
        
        const cols = line.split("|").slice(1, -1).map(c => c.trim());
        
        // Skip separator line | :--- | :--- |
        if (cols.every(c => c.replace(/:-/g, "").length === 0)) {
          continue;
        }

        // Check if header row (assume first row in active table block)
        const isHeader = tableHtml.endsWith("</table>") || tableHtml.endsWith('rounded-lg text-sm font-sans">');
        
        tableHtml += '<tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">';
        cols.forEach(c => {
          if (isHeader) {
            tableHtml += `<th class="px-3 py-2 text-left font-semibold text-stone-950 dark:text-stone-100 bg-[#f5f5f7] border-r border-neutral-200 dark:border-neutral-700">${c}</th>`;
          } else {
            tableHtml += `<td class="px-3 py-2 text-stone-950 dark:text-stone-100 border-r border-neutral-200 dark:border-neutral-700">${c}</td>`;
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
    <div id="noteoli-application-root" className="min-h-screen md:h-screen md:max-h-screen overflow-y-auto md:overflow-hidden bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-200 font-sans selection:bg-[#d4af37]/20 flex flex-col relative antialiased animate-fade-in">
      
      {/* Toast notifications container */}
      <div id="noteoli-toasts-area" className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`p-4 rounded-lg shadow-md border-l-4 grow flex items-center justify-between text-sm transition-all duration-300 transform translate-x-0 bg-white dark:bg-stone-900 ${
              toast.type === "success"
                ? "border-l-[#d4af37] text-stone-900 dark:text-stone-100 font-display"
                : toast.type === "error"
                ? "border-l-red-500 text-red-800 dark:text-red-400 bg-red-50/90 dark:bg-red-950/90 font-display"
                : "border-l-blue-400 text-blue-900 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/90 font-display"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" && <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
              <p className="font-semibold text-xs">{toast.msg}</p>
            </div>
            <button
              id={`close-toast-${toast.id}`}
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Top Header */}
      <header id="noteoli-header" className="bg-white dark:bg-stone-900 border-b border-neutral-200 dark:border-neutral-700 px-6 py-3 flex items-center justify-between shadow-xs shrink-0 select-none relative z-40">
              {/* Left branding */}
        <div id="header-branding" className="flex items-center gap-2 animate-fade-in">
          <h1 id="noteoli-logo-text" className="font-display font-medium text-lg leading-none text-stone-950 dark:text-stone-100 flex items-center gap-1.5 font-bold">
            NoteOli <span className="text-[9px] bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 font-mono px-1.5 py-0.5 rounded tracking-normal font-semibold">WORKSPACE</span>
          </h1>
        </div>

        {/* Center Part: Vector silhouette of a cat head */}
        <div id="header-center" className="absolute left-1/2 transform -translate-x-1/2 flex items-center select-none pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-8 h-8 text-[#d4af37] fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 38 L28 15 L40 28 L60 28 L72 15 L85 38 C90 48 90 64 85 75 C80 84 70 88 50 88 C30 88 20 84 15 75 C10 64 10 48 15 38 Z" />
            <circle cx="36" cy="52" r="3.5" fill="#faf6f0" />
            <circle cx="64" cy="52" r="3.5" fill="#faf6f0" />
            <path d="M44 65 Q50 70 56 65" stroke="#faf6f0" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        {/* Right Panel elements */}
        <div id="header-actions" className="flex items-center gap-2">
          {/* Theme toggle controller */}
          <button
            id="theme-toggle-btn"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>


          {/* Archived notes log picker */}
          <button
            id="history-logs-toggle-btn"
            onClick={() => {
              playClick("click");
              setShowHistoryDrawer(!showHistoryDrawer);
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-display flex items-center gap-1.5 transition-all ${
              showHistoryDrawer || activeHistoryNoteId
                ? "bg-sky-50 text-sky-700 border-sky-200"
                : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-semibold">Archive Logs</span>
            {notesHistory.length > 0 && (
              <span id="history-badge-count" className="bg-neutral-700 text-white text-[9px] font-mono px-1 rounded-full scale-90">
                {notesHistory.length}
              </span>
            )}
          </button>

          {/* Top Right Control: Hamburger Settings toggle menu (☰) */}
          <button
            id="settings-hamburger-btn"
            onClick={() => {
              playClick("click");
              setShowSettingsDrawer(true);
            }}
            className="p-2 px-3 rounded-lg border bg-white border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 transition-all font-display font-semibold text-xs flex items-center gap-1 cursor-pointer"
            title="Configure engine tones & macros"
          >
            <span className="text-sm">☰</span>
            <span className="hidden sm:inline font-semibold">Settings</span>
          </button>
        </div>
      </header>

      {/* Viewport flexible stack container */}
      <main id="cozy-workstation-body" className="flex-1 w-full max-w-4xl mx-auto p-4 flex flex-col justify-between gap-3 overflow-y-auto md:overflow-hidden select-text">
        
        {/* Workspace Selector Segmented Tabs (New 3-View Architecture) */}
        <div 
          id="workspace-view-tabs" 
          className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-none bg-stone-50 dark:bg-stone-900 border border-neutral-200 dark:border-neutral-700 p-1 rounded-xl gap-1 shrink-0 select-none mx-1 mb-1 transition-all"
        >
          <button
            id="tab-btn-edit"
            onClick={() => {
              playClick("click");
              setActiveTab("edit");
            }}
            className={`flex-1 shrink-0 px-4 py-2 rounded-lg text-xs font-display flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "edit"
                ? "bg-white text-stone-900 font-bold border-b-2 border-b-[#d4af37]"
                : "text-neutral-500 hover:text-stone-700 font-medium"
            }`}
          >
            <span>[📝 Scratchpad]</span>
          </button>

          <button
            id="tab-btn-output"
            onClick={() => {
              playClick("click");
              setActiveTab("output");
            }}
            className={`flex-1 shrink-0 px-4 py-2 rounded-lg text-xs font-display flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "output"
                ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs border-b-2 border-b-[#d4af37] dark:border-b-[#b5942b] font-bold"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-medium"
            }`}
          >
            <span>[✨ Polished Note]</span>
          </button>

          <button
            id="tab-btn-chat"
            onClick={() => {
              playClick("click");
              setActiveTab("chat");
            }}
            className={`flex-1 shrink-0 px-4 py-2 rounded-lg text-xs font-display flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
              activeTab === "chat"
                ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs border-b-2 border-b-[#d4af37] dark:border-b-[#b5942b] font-bold"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-medium"
            }`}
          >
            <span>[💬 Chat with Oli]</span>
          </button>
        </div>

        {activeTab === "edit" && (
          <div id="tab-content-edit" className="flex-1 flex flex-col justify-between gap-3 overflow-hidden animate-fade-in">
            {/* Workspace Title & Actions row with Exclusive "Ask Oli" button on upper-right */}
            <div id="workspace-top-bar" className="flex items-center justify-between shrink-0 select-none px-1">
              <div className="flex items-center gap-1.5">
                <h2 id="desktop-heading" className="font-display font-semibold text-xs text-neutral-700 uppercase tracking-wide">
                  Personal Workspace
                </h2>
            {activeHistoryNoteId && (
                  <span className="text-[9px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-mono font-medium">
                    Active Archive Note
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="inject-sample-cozy"
                  onClick={injectSample}
                  className="text-[11px] font-display font-semibold text-neutral-500 hover:text-[#d4af37] dark:text-neutral-400 dark:hover:text-[#b5942b] transition-colors flex items-center gap-1"
                >
                  <Layers className="w-3 h-3" />
                  <span className="hidden sm:inline">Inject Raw Messy Notes</span>
                </button>
                {inputText && (
                  <button
                    id="reset-workspace-cozy"
                    onClick={clearWorkspace}
                    className="text-[11px] font-display font-semibold text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1 mr-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}

                {/* EXCLUSIVE Prominent Standalone "Ask Oli" Button (appears ONLY on scratchpad view) */}
                <button
                  id="oli-transform-trigger-btn"
                  disabled={isProcessing}
                  onClick={async () => {
                    await runOliTransform();
                    setActiveTab("output");
                  }}
                  className={`h-8 px-4 rounded-lg font-display font-bold text-xs transition-all shadow-xs active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer relative overflow-hidden ${
                    isProcessing
                      ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border border-neutral-200 dark:border-neutral-700 cursor-not-allowed"
                      : "bg-[#d4af37] text-white border border-[#d4af37] hover:bg-[#b09030]"
                  } ${rippleActive ? "animate-gold-ripple" : ""}`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-mono text-[9px] uppercase font-bold tracking-wider">OLIZING...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 shrink-0" />
                      <span className="font-semibold text-xs font-display">✨ Ask Oli</span>
                    </>
                  )}
                </button>
              </div>
            </div>

        {/* ELEMENT 2: Main Input Text Box (Comfortable writing block) */}
        <div id="main-input-card" className="flex-1 min-h-[140px] flex flex-col bg-white border border-neutral-200 rounded-xl p-3 shadow-xs focus-within:border-[#d4af37] focus-within:ring-1 focus-within:ring-[#d4af37] transition-colors relative overflow-hidden">
          <textarea
            id="raw-note-textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isProcessing}
            placeholder="Pour your chaotic raw thoughts here... No formatting, no pressure. Let Oli gather the signals, organize the chaos, and craft the archives."
            className="w-full h-full flex-1 p-2 font-sans text-stone-950 text-sm md:text-base leading-relaxed bg-white border-none resize-none outline-none focus:ring-0 placeholder:text-gray-400 placeholder:italic disabled:opacity-60 disabled:cursor-not-allowed caret-stone-900"
          />
        </div>

            {/* Bottom Actions Utility strip for Edit view */}
            <div id="cozy-edit-bottom-actions-dock" className="flex items-center justify-between gap-3 shrink-0 select-none pb-1.5 border-t border-neutral-200 dark:border-neutral-800 pt-3">
              <div id="dock-text-metrics" className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 flex items-center gap-2">
                <span>{inputText.length} CHARS</span>
                <span className="text-neutral-200">|</span>
                <span>{inputText.trim() ? inputText.trim().split(/\s+/).length : 0} WORDS</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 font-sans">
                {/* Download File */}
                <button
                  id="scratchpad-save-disk-btn"
                  onClick={exportScratchpadToLocalDisk}
                  disabled={!inputText.trim()}
                  className="h-9 px-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-[#d4af37] dark:hover:text-[#b5942b] transition-colors flex items-center justify-center gap-1 text-[11px] font-display font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save raw scratchpad note as markdown file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save Draft</span>
                </button>

                {/* Copy Clipboard */}
                <button
                  id="scratchpad-clipboard-btn"
                  onClick={handleCopyScratchpad}
                  disabled={!inputText.trim()}
                  className="w-9 h-9 rounded-lg bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-stone-900 dark:text-stone-100 hover:border-[#d4af37] transition-colors flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Copy raw text to clipboard"
                >
                  {copiedType === "scratchpad" ? (
                    <Check className="w-4 h-4 text-emerald-600 animate-fade-in" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  id="cozy-commit-logs-btn-edit"
                  onClick={saveToHistory}
                  disabled={!inputText.trim()}
                  className="h-9 px-3 rounded-lg bg-neutral-800 dark:bg-stone-100 hover:bg-neutral-950 dark:hover:bg-white text-white dark:text-stone-900 border border-transparent dark:border-[#b5942b] text-[11px] font-display font-semibold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save current raw work to Local logs"
                >
                  <Plus className="w-3.5 h-3.5 pointer-events-none text-neutral-400 dark:text-neutral-500" />
                  <span className="hidden sm:inline">Archive Note</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "output" && (
          <div id="tab-content-output" className="flex-1 flex flex-col justify-between gap-3 overflow-hidden animate-fade-in">
            {/* Output Format Toggles */}
            <div id="cozy-output-format-toggles" className="flex items-center justify-between shrink-0 select-none px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Format:</span>
                <div className="bg-stone-50 dark:bg-stone-900 border border-neutral-200 dark:border-neutral-700 p-0.5 rounded-lg flex gap-1">
                  <button
                    id="toggle-format-plain"
                    onClick={() => {
                      playClick("click");
                      setOutputTab("raw");
                    }}
                    className={`px-3 py-1 text-xs font-display font-bold rounded-md transition-all cursor-pointer ${
                      outputTab === "raw"
                        ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs border border-neutral-200 dark:border-neutral-700 font-bold"
                        : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-medium"
                    }`}
                  >
                    Plain Text
                  </button>
                  <button
                    id="toggle-format-markdown"
                    onClick={() => {
                      playClick("click");
                      setOutputTab("preview");
                    }}
                    className={`px-3 py-1 text-xs font-display font-bold rounded-md transition-all cursor-pointer ${
                      outputTab === "preview"
                        ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs border border-neutral-200 dark:border-neutral-700 font-bold"
                        : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 font-medium"
                    }`}
                  >
                    Markdown
                  </button>
                </div>
              </div>

              <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1.5 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span>Offline-First WebGPU Core</span>
              </div>
            </div>

            {/* Dynamic Output Box */}
            <div id="cozy-dynamic-output-card" className="flex-1 min-h-[140px] flex flex-col bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs relative">
              <div ref={outputSectionRef} id="cozy-output-scroll" className="flex-1 p-4 md:p-5 overflow-y-auto bg-white">
                {isProcessing ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-neutral-400 py-6 animate-pulse">
                    <div className="w-6 h-6 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-sky-700">{processingPhase}</p>
                  </div>
                ) : outputText ? (
                  outputTab === "preview" ? (
                    <div
                      id="rendered-preview-markdown"
                      className="prose prose-neutral max-w-none text-stone-950 leading-relaxed font-sans break-words text-sm md:text-base/relaxed"
                      dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(outputText) }}
                    />
                  ) : (
                    <pre
                      id="raw-markdown-block"
                      className="font-mono text-xs md:text-sm text-stone-950 whitespace-pre-wrap leading-relaxed select-text"
                    >
                      {outputText}
                    </pre>
                  )
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-neutral-300 py-6 font-mono text-xs select-none">
                    <span className="text-2xl mb-1 filter grayscale opacity-45">☕</span>
                    <p className="font-display font-semibold text-neutral-400 text-sm mb-1">Your Transformed Draft</p>
                    <p className="text-[10px] text-neutral-400">Configure parameters and hit "Ask Oli" under the Ask Oli tab to trigger secure formatting.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Dock for Output view */}
            <div id="cozy-output-bottom-actions-dock" className="flex items-center justify-between gap-3 shrink-0 select-none pb-1.5 border-t border-neutral-200 dark:border-neutral-700 pt-3">
              <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-2">
                <span>OUTPUT: {outputText ? outputText.length : 0} CHARS</span>
              </div>

              {/* Action outputs buttons */}
              <div id="dock-action-triggers" className="flex items-center gap-1.5 shrink-0">
                {/* Download File */}
                <button
                  id="cozy-save-disk-btn"
                  onClick={exportToLocalDisk}
                  disabled={!outputText}
                  className="h-9 px-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-[#d4af37] dark:hover:text-[#b5942b] transition-colors flex items-center justify-center gap-1 text-[11px] font-display font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save formatted note as markdown file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save File</span>
                </button>

                {/* Copy Clipboard */}
                <button
                  id="cozy-clipboard-btn"
                  onClick={handleCopyRichText}
                  disabled={!outputText}
                  className="w-9 h-9 rounded-lg bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-stone-900 dark:text-stone-100 hover:border-[#d4af37] transition-colors flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Copy rich rendered formatting directly into Apple Notes or Obsidian"
                >
                  {copiedType === "rich" ? (
                    <Check className="w-4 h-4 text-emerald-600 animate-fade-in" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Commit note to History Archive logs */}
                <button
                  id="cozy-commit-logs-btn"
                  onClick={saveToHistory}
                  disabled={!outputText}
                  className="h-9 px-3 rounded-lg bg-neutral-800 dark:bg-stone-100 hover:bg-neutral-950 dark:hover:bg-white text-white dark:text-stone-900 border border-transparent dark:border-[#b5942b] text-[11px] font-display font-semibold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save current raw work to Local logs"
                >
                  <Plus className="w-3.5 h-3.5 pointer-events-none text-neutral-400 dark:text-neutral-500" />
                  <span className="hidden sm:inline">Archive Note</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transition conditional to chat */}
        {activeTab === "chat" && (
      <div id="cozy-chat-container" className={`flex-1 flex flex-col min-h-[420px] overflow-hidden ${
        chatInitiated 
          ? "bg-transparent border-none p-0 shadow-none -mx-4 w-[calc(100%+2rem)]" 
          : "bg-white dark:bg-stone-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-4 shadow-xs"
      }`}>
        
        {!chatInitiated ? (
          <div id="chat-uninitiated-welcome" className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6 max-w-sm mx-auto my-auto pb-8">
            <div className="bg-sky-50 dark:bg-sky-950 p-4 rounded-full select-none">
              <Sparkles className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            </div>
            
            <div className="space-y-2 select-none">
              <h3 className="font-display font-bold text-base text-stone-950 dark:text-stone-100">
                Chat with Oli
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                Pick a style to start talking, or just jump straight into a regular chat.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                id="init-just-chat-btn"
                onClick={() => handleInitChat("default")}
                className="py-3 px-2 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 hover:border-[#d4af37] dark:hover:border-[#b5942b] rounded-xl font-display font-bold text-xs select-none text-neutral-800 dark:text-neutral-100 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-sm"
              >
                <span className="select-none">💬</span> Just Chat
              </button>
              
              <button
                id="init-booster-btn"
                onClick={() => handleInitChat("booster")}
                className="py-3 px-2 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 hover:border-[#d4af37] dark:hover:border-[#b5942b] rounded-xl font-display font-bold text-xs select-none text-neutral-800 dark:text-neutral-100 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-sm"
              >
                <span className="select-none">🚀</span> Booster
              </button>

              <button
                id="init-randomizer-btn"
                onClick={() => handleInitChat("randomizer")}
                className="py-3 px-2 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 hover:border-[#d4af37] dark:hover:border-[#b5942b] rounded-xl font-display font-bold text-xs select-none text-neutral-800 dark:text-neutral-100 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-sm"
              >
                <span className="select-none">🎲</span> Randomizer
              </button>

              <button
                id="init-brainstormer-btn"
                onClick={() => handleInitChat("brainstormer")}
                className="py-3 px-2 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 hover:border-[#d4af37] dark:hover:border-[#b5942b] rounded-xl font-display font-bold text-xs select-none text-neutral-800 dark:text-neutral-100 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-sm"
              >
                <span className="select-none">🧠</span> Brainstormer
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header / Mindset Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2.5 mb-3 gap-2 text-xs font-mono select-none px-4">
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
                <span className="font-semibold text-stone-950 dark:text-stone-100">Oli's Mindset:</span>
              </div>
              <div id="chat-mindset-pill-select" className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  id="chat-mindset-pill-default"
                  onClick={() => handleInitChat("default")}
                  className={`px-2 py-1 rounded-md text-[10px] font-sans font-bold transition-all border shrink-0 cursor-pointer ${
                    mindset === "default"
                      ? "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800"
                      : "bg-white dark:bg-neutral-800 text-neutral-650 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                  }`}
                >
                  💬 Just Chat
                </button>
                <button
                  id="chat-mindset-pill-booster"
                  onClick={() => handleInitChat("booster")}
                  className={`px-2 py-1 rounded-md text-[10px] font-sans font-bold transition-all border shrink-0 cursor-pointer ${
                    mindset === "booster"
                      ? "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800"
                      : "bg-white dark:bg-neutral-800 text-neutral-650 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                  }`}
                >
                  🚀 Booster
                </button>
                <button
                  id="chat-mindset-pill-randomizer"
                  onClick={() => handleInitChat("randomizer")}
                  className={`px-2 py-1 rounded-md text-[10px] font-sans font-bold transition-all border shrink-0 cursor-pointer ${
                    mindset === "randomizer"
                      ? "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800"
                      : "bg-white dark:bg-neutral-800 text-neutral-650 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                  }`}
                >
                  🎲 Randomizer
                </button>
                <button
                  id="chat-mindset-pill-brainstormer"
                  onClick={() => handleInitChat("brainstormer")}
                  className={`px-2 py-1 rounded-md text-[10px] font-sans font-bold transition-all border shrink-0 cursor-pointer ${
                    mindset === "brainstormer"
                      ? "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800"
                      : "bg-white dark:bg-neutral-800 text-neutral-650 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                  }`}
                >
                  🧠 Brainstormer
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div id="chat-messages-stream" className="flex-1 overflow-y-auto space-y-4 px-4 pb-2 scroll-smooth">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  id={`chat-msg-${msg.id}`}
                  className={`flex flex-col transition-all duration-300 ${
                    msg.sender === "user" ? "ml-auto items-end max-w-[85%]" : "mr-auto items-start w-full"
                  }`}
                >
                  {msg.sender === "user" ? (
                    <div
                      className="p-3 text-xs md:text-sm leading-relaxed whitespace-pre-wrap bg-transparent text-stone-900 dark:text-stone-100 font-sans"
                    >
                      {msg.text}
                    </div>
                  ) : (
                    <div
                      className="w-full bg-sky-50 dark:bg-sky-950/40 p-4 rounded-xl text-stone-900 dark:text-stone-100 font-sans text-xs md:text-sm leading-relaxed prose prose-sm max-w-none shadow-xs"
                      dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(msg.text) }}
                    />
                  )}
                  
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] font-mono text-neutral-400 select-none">
                    <span>{msg.timestamp}</span>
                    {msg.meta && (
                      <>
                        <span>•</span>
                        <span className="text-sky-700 dark:text-sky-400 font-semibold">{msg.meta}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
              
              {chatIsResponding && (
                <div className="flex flex-col mr-auto items-start w-full animate-pulse py-2">
                  <div className="text-xs text-neutral-400 flex items-center gap-2 font-mono">
                    <div className="w-1.5 h-1.5 bg-sky-200 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-sky-200 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-1.5 h-1.5 bg-sky-200 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 ml-1 font-semibold">Oli is formulating thoughts...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Low-profile Utility Panel (Clipboard / Export / State Storage) */}
            <div id="chat-utility-panel" className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 mt-2 border-t border-neutral-200 dark:border-neutral-700 text-[10px] font-mono text-neutral-400 select-none">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span>Session auto-cached</span>
              </div>
              <div className="flex items-center gap-2 font-sans shrink-0">
                <button
                  id="chat-btn-copy-logs"
                  onClick={handleCopyChatLogs}
                  className="px-2 py-1 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 hover:border-[#d4af37] dark:hover:border-[#b5942b] rounded-md transition-all flex items-center gap-1 cursor-pointer font-semibold text-neutral-700 dark:text-neutral-300 active:scale-95 shadow-3xs"
                  title="Copy session logs directly as Markdown"
                >
                  <span>📋 Copy Logs</span>
                </button>
                <button
                  id="chat-btn-save-file"
                  onClick={handleSaveChatFile}
                  className="px-2 py-1 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 hover:border-[#d4af37] dark:hover:border-[#b5942b] rounded-md transition-all flex items-center gap-1 cursor-pointer font-semibold text-neutral-700 dark:text-neutral-300 active:scale-95 shadow-3xs"
                  title="Export session logs as markdown file"
                >
                  <span>💾 Save File</span>
                </button>
                <button
                  id="chat-btn-clear-logs"
                  onClick={handleClearChatHistory}
                  className="pl-2 pr-1 py-1 text-neutral-450 hover:text-red-500 rounded-md transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                  title="Reset conversation state"
                >
                  <span>Reset Chat</span>
                </button>
              </div>
            </div>

            {/* Input Dock */}
            <div id="chat-input-bar-container" className="border-t border-neutral-200 dark:border-neutral-700 pt-3 mt-1.5 flex gap-2 shrink-0 px-4 pb-1">
              <input
                id="chat-input-field"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendChatMessage();
                  }
                }}
                disabled={chatIsResponding}
                placeholder={`Ask Oli anything... (${mindset} persona operating mode active)`}
                className="flex-1 px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-[#d4af37] dark:focus:ring-[#b5942b] focus:border-[#d4af37] dark:focus:border-[#b5942b] placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
              />
              <button
                id="chat-send-msg-btn"
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || chatIsResponding}
                className={`p-2.5 px-4 rounded-xl font-display font-medium text-xs flex items-center gap-1.5 hover:shadow-xs transition-colors active:scale-95 border ${
                  !chatInput.trim() || chatIsResponding
                    ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-neutral-200 dark:border-neutral-700"
                    : "bg-stone-100 dark:bg-stone-800 border-[#d4af37] dark:border-[#b5942b] text-stone-900 dark:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-700"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span className="font-bold">Send</span>
              </button>
            </div>
          </>
        )}

      </div>
    )}



      </main>

      {/* Slide-out Settings Drawer overlay (activated by top-right hamburger ☰ Button) */}
      {showSettingsDrawer && (
        <div
          id="cozy-settings-drawer-overlay"
          className="fixed inset-0 bg-neutral-900/30 backdrop-blur-xs z-50 flex justify-end transition-opacity"
          onClick={() => setShowSettingsDrawer(false)}
        >
          <div
            id="cozy-settings-card"
            className="w-full max-w-sm bg-white dark:bg-stone-900 h-full shadow-2xl flex flex-col p-6 relative border-l border-neutral-200 dark:border-neutral-700 animate-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-5 select-none animate-fade-in">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#d4af37] dark:text-[#b5942b]" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <h3 className="font-display font-semibold text-base text-stone-950 dark:text-stone-100">
                  Control Parameters
                </h3>
              </div>
              <button
                id="close-settings-drawer-btn"
                onClick={() => {
                  playClick("click");
                  setShowSettingsDrawer(false);
                }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body Scroll Content */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-6 select-text">
              
              {/* Local Transformation Engine Selection Buttons */}
              <div id="local-transformation-engine-block" className="flex flex-col gap-3">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                  Select Local Transformation Engine
                </label>
                
                <div className="relative">
                  <select
                    id="local-engine-selector"
                    value={selectedLlmModel}
                    onChange={async (e) => {
                      playClick("click");
                      const newModelId = e.target.value;
                      setSelectedLlmModel(newModelId);
                      setLocalLlmStatus("idle");
                      setUseActualLlm(false);
                      const { setActiveModelId } = await import("./utils/webLlmEngine");
                      setActiveModelId(newModelId);
                      showToast(`Switched to active model profile. Click 'Prepare Weights' to load.`, "info");
                    }}
                    className="w-full p-2.5 bg-white dark:bg-stone-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-display font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-[#d4af37] dark:focus:ring-[#b5942b] focus:border-[#d4af37] dark:focus:border-[#b5942b] appearance-none cursor-pointer pr-10"
                  >
                    {SUPPORTED_MODELS.map(model => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Performance Insights Area */}
                <div id="local-engine-performance-insights" className="p-3 bg-stone-50 rounded-xl border border-neutral-200 text-xs text-neutral-600 animate-fade-in">
                  <p className="font-mono text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1">Engine Performance Insights:</p>
                  <p className="font-sans leading-relaxed text-[11px] text-stone-700 font-medium">
                    {SUPPORTED_MODELS.find(m => m.id === selectedLlmModel)?.recommended}
                  </p>
                </div>

                <div id="local-engine-status-block" className="p-3 bg-white rounded-xl border border-neutral-200 text-xs text-neutral-600 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between font-mono text-[10px] font-bold border-t border-neutral-200 pt-2">
                    <span>WebGPU Engine Profile:</span>
                    <span className={localLlmStatus === "ready" ? "text-green-600" : localLlmStatus === "loading" ? "text-sky-600 animate-pulse" : "text-sky-600"}>
                      {localLlmStatus === "ready" ? "ACTIVE & CACHED" : localLlmStatus === "loading" ? "DOWNLOADING WEIGHTS" : "NOT READY (COAX TO WARM)"}
                    </span>
                  </div>

                  {localLlmStatus === "loading" && (
                    <div className="space-y-1.5 mt-2">
                      <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden border border-neutral-200">
                        <div className="h-full bg-[#d4af37] transition-all duration-300" style={{ width: `${llmProgress * 100}%` }}></div>
                      </div>
                      <p className="text-[10px] text-sky-700 font-mono animate-pulse">{llmProgressMsg}</p>
                    </div>
                  )}

                  <div className="pt-1 select-none">
                    {localLlmStatus === "ready" ? (
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
                            showToast("Active weights unloaded cleanly. GPU memory released.", "success");
                          } catch (err: any) {
                             showToast("Failed to unload weights correctly.", "error");
                          }
                        }}
                        className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-[10px] font-mono uppercase font-bold tracking-wider transition-colors cursor-pointer border border-red-200 text-center"
                      >
                        Unload GPU Weights
                      </button>
                    ) : localLlmStatus === "loading" ? (
                      <div className="text-center text-[10px] font-mono text-neutral-450 uppercase py-1 animate-pulse">Refining Local Context...</div>
                    ) : (
                      <button
                        id="prep-sandbox-btn"
                        type="button"
                        onClick={() => {
                          playClick("click");
                          warmLocalLlm(true);
                        }}
                        className="w-full py-2 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-xl text-[10px] font-mono lowercase font-bold transition-colors cursor-pointer text-center"
                      >
                        prepare local 4-bit weights
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tone selection */}
              <div id="tone-ui-matrix" className="flex flex-col gap-2">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                  Tone Profile
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
                      className={`py-2 px-1 text-center rounded-lg border transition-all flex flex-col justify-center items-center gap-1.5 ${
                        tone === t
                          ? "bg-[#d4af37]/10 dark:bg-[#b5942b]/20 text-stone-900 dark:text-stone-100 border-[#d4af37] dark:border-[#b5942b] font-semibold"
                          : "bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                      }`}
                    >
                      <span className="text-[11px] leading-none font-display">{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Macro Tool Selection DROPDOWN */}
              <div id="utility-ui-dropdown" className="flex flex-col gap-2">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
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
                    className="w-full p-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-display font-semibold text-stone-950 dark:text-stone-100 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-[#d4af37] dark:focus:ring-[#b5942b] focus:border-[#d4af37] dark:focus:border-[#b5942b] appearance-none cursor-pointer pr-10 animate-fade-in"
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



              {/* Length Precision Slider (-10 to +10) */}
              <div id="length-ui-slider" className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                    Length / Intent Scale
                  </label>
                  <span className={`text-xs font-mono font-bold text-[#d4af37] dark:text-[#b5942b]`}>
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
                  className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer accent-[#d4af37] dark:accent-[#b5942b] py-1"
                />
                
                <div id="length-slider-description" className="flex justify-between text-[9px] font-mono text-gray-400 mt-1 uppercase leading-snug font-semibold select-none">
                  <span className={length < 0 ? "text-[#d4af37] dark:text-[#b5942b]" : ""}>-10 Stripping</span>
                  <span className={length === 0 ? "text-[#d4af37] dark:text-[#b5942b]" : ""}>0 Equal</span>
                  <span className={length > 0 ? "text-[#d4af37] dark:text-[#b5942b]" : ""}>+10 Intent</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Slide-out Archive logs Panel drawer */}
      {showHistoryDrawer && (
        <div id="archive-history-overlay" className="fixed inset-0 bg-neutral-900/35 backdrop-blur-xs z-50 flex justify-end transition-opacity">
          
          <div id="archive-drawer-card" className="w-full max-w-sm bg-white dark:bg-stone-900 h-full shadow-2xl flex flex-col p-6 relative border-l border-neutral-200 dark:border-neutral-700 animate-slide-left">
            
            {/* Header of Drawer */}
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-4 select-none">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#d4af37] dark:text-[#b5942b]" />
                <h3 className="font-display font-semibold text-base text-stone-950 dark:text-stone-100">
                  Archived Note Logs
                </h3>
              </div>
              <button
                id="close-archive-drawer-btn"
                onClick={() => {
                  playClick("click");
                  setShowHistoryDrawer(false);
                }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-black transition-colors"
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
                className="w-full pl-3 pr-10 py-1.5 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs bg-neutral-50 dark:bg-neutral-800 focus:bg-white dark:focus:bg-neutral-700 focus:outline-none focus:ring-1 focus:ring-[#d4af37] dark:focus:ring-[#b5942b] focus:border-[#d4af37] dark:focus:border-[#b5942b] font-sans dark:text-neutral-100 placeholder:text-neutral-400"
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
            <div id="drawer-archive-list" className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 select-text">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 font-mono text-xs max-w-xs mx-auto flex flex-col items-center gap-2.5">
                  <p>No archived record segments found matching search criteria.</p>
                  <button
                    id="populate-drawer-sample-btn"
                    onClick={injectSample}
                    className="text-[11px] font-mono text-[#d4af37] dark:text-[#b5942b] underline"
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
                        ? "bg-[#d4af37]/5 dark:bg-[#b5942b]/10 border-[#d4af37] dark:border-[#b5942b] shadow-xs"
                        : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-xs text-stone-950 dark:text-stone-100 line-clamp-1 leading-snug font-display">
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

                    <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed mb-2 font-mono">
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
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4 flex items-center justify-between text-xs font-mono text-zinc-400 select-none">
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
      <footer id="noteoli-footer" className="bg-white dark:bg-stone-900 border-t border-neutral-200 dark:border-neutral-700 px-6 py-2 text-center mt-auto text-[9px] font-mono text-zinc-400 dark:text-zinc-500 tracking-wider select-none shrink-0">
        <span>PROJECT NOTEOLI. OPTIMIZED TEXT TRANSLATION. </span>
        <span className="hidden sm:inline">• LOCAL GPU GEMMA-2B & SECURE CLOUD HYBRID CORES.</span>
      </footer>

    </div>
  );
}
