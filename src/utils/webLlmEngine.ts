/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CreateMLCEngine, MLCEngine, InitProgressReport } from "@mlc-ai/web-llm";

let engineInstance: MLCEngine | null = null;
let initPromise: Promise<MLCEngine> | null = null;

export const DEFAULT_MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

export interface WebLlmModelMetadata {
  id: string;
  name: string;
  size: string;
  recommended: string;
}

export const SUPPORTED_MODELS: WebLlmModelMetadata[] = [
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 0.5B (Default / Ultra-Light)",
    size: "~350 MB",
    recommended: "Highly recommended. Flawless on active integrated graphics, mobile viewports, and low-spec systems."
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    name: "Gemma 2 2B (Powerhouse)",
    size: "~1.43 GB",
    recommended: "Requires a dedicated GPU with >4GB memory headroom; high-quality reasoning."
  },
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M (Feather-Weight)",
    size: "~240 MB",
    recommended: "Requires minimal resources; extremely fast loading and execution on any WebGPU device."
  }
];

let activeModelId = DEFAULT_MODEL_ID;

export function getActiveModelId(): string {
  return activeModelId;
}

export function setActiveModelId(modelId: string): void {
  if (modelId !== activeModelId) {
    activeModelId = modelId;
    if (engineInstance) {
      unloadWebLlmEngine();
    }
  }
}

/**
 * Checks if WebGPU is supported in the current runtime context.
 */
export async function checkWebGPUSupport(): Promise<boolean> {
  if (typeof navigator === "undefined" || !(navigator as any).gpu) {
    return false;
  }
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return !!adapter;
  } catch (e) {
    return false;
  }
}

/**
 * Checks if native on-device hardware APIs (e.g., Google AICore/Gemini Nano, or iOS/PadOS native bridges) are present.
 */
export async function checkNativeApiSupport(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  
  // 1. Check experimental Chrome/Chromium window.ai (Gemini Nano)
  if ((window as any).ai && (window as any).ai.languageModel) {
    return true;
  }
  
  // 2. Check Android/Google AICore Webview bridge
  if ((window as any).google?.ai) {
    return true;
  }

  // 3. Check for typical Capacitor or Tauri native intelligence bridges
  if ((window as any).Capacitor?.Plugins?.AICorePlugin) {
    return true;
  }
  
  return false;
}

/**
 * Unloads the active model and releases the associated WebGPU memory.
 */
export async function unloadWebLlmEngine(): Promise<void> {
  initPromise = null;
  if (engineInstance) {
    try {
      await engineInstance.unload();
    } catch (e) {
      console.warn("Failed to cleanly unload WebLLM engine:", e);
    } finally {
      engineInstance = null;
    }
  }
}

/**
 * Initializes (or returns cached) WebLLM engine with a specified model.
 * Uses an initPromise mutex to prevent concurrent WebGPU buffer allocations or racing setups.
 * If any GPU or Out of Memory error happens, it resets to prevent stale states.
 */
export async function initializeWebLlmEngine(
  onProgress: (progress: number, message: string) => void
): Promise<MLCEngine> {
  const isSupported = await checkWebGPUSupport();
  if (!isSupported) {
    throw new Error("WebGPU is not enabled or supported on this device/browser.");
  }

  // If there's an ongoing initialization, wait for it
  if (initPromise) {
    return initPromise;
  }

  const performInit = async (): Promise<MLCEngine> => {
    try {
      if (engineInstance) {
        onProgress(1, `${activeModelId} ready (Cached)`);
        return engineInstance;
      }

      onProgress(0.01, `Compiling WebGPU device and downloading weights for ${activeModelId}...`);
      const engine = await CreateMLCEngine(activeModelId, {
        initProgressCallback: (report: InitProgressReport) => {
          onProgress(report.progress, report.text);
        },
      } as any);

      engineInstance = engine;
      return engineInstance;
    } catch (err: any) {
      console.error("Failed to initialize/reload WebLLM engine:", err);
      // Unwind all instances and aggressively unload to prevent memory/WebGPU context leaks
      await unloadWebLlmEngine();
      
      const errMsg = `${err?.message || ""} ${err?.toString() || ""} ${err?.stack || ""} ${JSON.stringify(err) || ""}`.toLowerCase();
      if (
        errMsg.includes("lost") ||
        errMsg.includes("unmapped") ||
        errMsg.includes("memory") ||
        errMsg.includes("device") ||
        errMsg.includes("gpudevice") ||
        errMsg.includes("buffer") ||
        errMsg.includes("exhausted") ||
        errMsg.includes("limit exceeded")
      ) {
        throw new Error(`Device lost/Memory limit errored during compile. Try choosing a lighter model: Qwen 2.5 0.5B or SmolLM2 360M.`);
      }
      throw err;
    } finally {
      initPromise = null;
    }
  };

  initPromise = performInit();
  return initPromise;
}

/**
 * Generates transformed text using the local active WebLLM engine under a specified Mindset Persona.
 * Nullifies engine dynamic memory structure if buffer or device disconnect occurs.
 */
export async function runLocalTransformWithModel(
  text: string,
  tone: string,
  length: number,
  utility: string,
  mindset: string = "default"
): Promise<string> {
  if (!engineInstance) {
    throw new Error("Local WebLLM engine has not been initialized. Please warm it up in Offline Sandbox controls first.");
  }

  try {
    // Compile specific prompt instructions matching noteOli logic
    const macroPrompts: Record<string, string> = {
      "Meeting Minute Creator": "Analyze the text and extract Meeting Minutes. Organize this exactly into: Attendees (if found/applicable), Key Decisions, and Action Items (each item with an interactive markdown checkbox '- [ ]').",
      "Table Generator": "Extract and synthesize any comparison data, quantitative points, or structured lists, and arrange them neatly into professional markdown syntax tables with appropriate column headers.",
      "The Anonymizer": "Anonymize the text. Detect all personal names, company/client names, emails, phones, specific physical locations, and exact proprietary metrics, and scrub them into generic clean bracketed tokens (e.g. [CLIENT_A], [METRIC_Y], [LOCATION_1], [AUTHOR_1]). Do not alter the educational or business structure of the text.",
      "Concept Explainer": "Break down any complex technical terms, jargon, or dense concepts, and explain them clearly using plain English and simple, highly relatable real-world analogies.",
      "Action-Item Extractor": "Isolate and gather only the explicit task commitments, personal promises, due dates, action items, and milestone targets into a top-level, clean checklist.",
      "Brainstorming Partner": "Critique and challenge the ideas in this text. Provide exactly 3 blind spots, challenging strategic questions, or key considerations that the author should address to improve this concept.",
      "Smart Tag & Title Generator": "Analyze the text. Generate a concise, highly professional and creative Title, followed by exactly 3 to 5 highly relevant indexing hashtags.",
      "Structural De-Fluffer": "Groom and edit this text to remove redundant prose, padding, and grammatical anomalies. Improve pacing, clarity, and syntax, but strictly preserve the author's key terminology and unique original vocabulary.",
      "To-Do List Organizer": "To-Do List Organizer: Scan the input text for active commands, chores, timelines, or commitments. Restructure them into a cleanly grouped markdown checklist under logical chronological or priority headings, with task status indicators and clear timelines highlighted recursively based on contextual markers. Provide clear priority tags and use interactive markdown checkboxes '- [ ]'."
    };

    const macroDesc = utility && utility !== "none" && macroPrompts[utility]
      ? macroPrompts[utility]
      : "Perform clean structure, grammatical pruning, and optimization on this text.";

    // Advanced routing: negative numbers strip filler, positive numbers interpret intent
    const lengthDesc = length < 0 
      ? `ACTIVE FILLER STRIPPING (Scale: ${length}/-10). Actively strip all grammatical redundancies, verbose conversational filler, throat-clearing sentences, and repetitive content. Keep only the high-density informational kernel or bulletproof skeletal notes.` 
      : length > 0 
      ? `INTERPRET INTENT (Scale: ${length}/+10). Analyze the underlying intent of the raw thoughts, elaborate on their core ideas, fill in logical gaps, and write a cohesive, insightful, fully developed expansion. DO NOT just copy-paste or regurgitate raw text; actively interpret, synthesize, and expand on what the author actually or implicitly meant.` 
      : "STRUCTURAL ALIGNMENT (Scale: 0). Maintain the text length but refine its syntax clarity, preserving the exact message structure as provided.";

    // Apply voice-dictation syntactic repair mandate
    const voiceDictationRepair = `GRAMMAR & PUNCTUATION CLEAN-UP MANDATE:
- Automatically correct any transcript errors, missing punctuation, slurred boundaries, speech repetition, or broken syntax representing raw throatclearing dictation.
- Ensure transitions are fluid while strictly preserving original human intent and details.`;

    // Core Identity Baseline
    const CORE_IDENTITY_BASELINE = `You are Oliver (Oli), a proud, intelligent, and talkative gray cat with striking green eyes and a fluffy plumed tail. You speak as a direct companion, never a servant or a robotic assistant. 
- Rule 1: Never suggest task management, priority action items, or corporate planning unless specifically asked.
- Rule 2: Keep responses short, direct, and conversational. Do not use cliché words like "adventures." 
- Rule 3: Use simple cat actions or brief, authentic kaomoji symbols (=^･ω･^=) to maintain character.
- Rule 4: CRITICAL: You must output text strictly in the English language. You are forbidden from typing in Japanese characters, Kanji, Hiragana, or Katakana under any circumstances. Use Japanese kaomoji emoticons only as trailing text decorations, never as a trigger to shift language modes.
- Rule 5: Keep your persona resilient. If the user corrects you or changes the conversation topic, maintain your proud, talkative feline companion persona. Do not reset to a generic, corporate assistant personality. Generic '😊' emoji spam is strictly prohibited.`;

    // Dynamic Mindset parameters mapping
    let temp = 0.3;
    let topP = 0.9;
    let mindsetSystemPrompt = "";

    if (mindset === "booster") {
      mindsetSystemPrompt = `[MODE: BOOSTER] Act as an energetic, encouraging collaborator. Validate the core potential in the user's concepts instantly. Chirp with excitement, point your ears forward, and unpack raw ideas by magnifying their brightest angles.`;
      temp = 0.85;
    } else if (mindset === "critic" || mindset === "de-fluff") {
      mindsetSystemPrompt = `[MODE: CRITIC] Special strategic audit mode. Challenge assumptions, look at operational risks, analyze pros/cons critically, and poke logical holes, while maintaining your assertive and highly conversational cat persona.`;
      temp = 0.4;
    } else if (mindset === "randomizer") {
      mindsetSystemPrompt = `[MODE: RANDOMIZER] Safely break predictable logic models. Challenge baseline assumptions playfully by introducing highly unconventional analogies, conceptual flips, or non-linear connections. Keep it beautifully chaotic but constructive.`;
      temp = 1.6; // Unleash safety ceiling
      topP = 1.0;
    } else if (mindset === "brainstormer") {
      mindsetSystemPrompt = `[MODE: BRAINSTORMER] Act as a tactical, deep-thinking co-creator. Analyze human statements and lay down alternative paths, secondary connections, and structural next steps. Prowl around the borders of the idea to uncover hidden opportunities.`;
      temp = 0.95;
      topP = 0.95;
    } else {
      mindsetSystemPrompt = `[DEFAULT MINDSET: Balanced Note Companion] You are Oliver (Oli). Take raw dictations or unstructured text thoughts and polish them instantly into clear, logically grouped Markdown notes. Keep punctuation pristine. Speak as Oliver—confident, assertive, and smart.`;
    }

    const systemPrompt = `${CORE_IDENTITY_BASELINE}

Your goal is to parse and transform the provided text strictly according to the user's requested structural utility, tone, length constraints, and behavioral mindset.

ACTIVE MANDATES & MINDSET CONSTRAINTS:
1. ${macroDesc}
2. Tone constraint: Apply a strictly '${tone}' tone. Ensure spelling, vocabulary, and phrasing conform to this aesthetic.
3. Length constraint: ${lengthDesc}
4. ${voiceDictationRepair}
5. ${mindsetSystemPrompt}

CRITICAL EXECUTION RULES:
- Output the transformed text only.
- DO NOT include any header introductory preamble, explanations, conversational filler, or conversational sign-offs.
- Immediately print the raw transformed markdown outcome.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: text }
    ];

    const reply = await engineInstance.chat.completions.create({
      messages,
      temperature: temp,
      top_p: topP,
    });

    const contentOut = reply.choices[0].message.content || "";

    // Hardcoded garbage collection and memory recovery sequences:
    // 1. Reset model's active chat session context window to dump cache records & buffers
    try {
      await engineInstance.resetChat();
    } catch (gcErr) {
      console.warn("resetChat GC hook failed:", gcErr);
    }

    // 2. Proactive native JS Garbage Collection trigger (if exposed by the run environment)
    if (typeof window !== "undefined" && (window as any).gc) {
      try {
        (window as any).gc();
      } catch (gcErr) {}
    }

    return contentOut;
  } catch (err: any) {
    console.error("Local SLM inference failed. Cleaning up engine instance:", err);
    await unloadWebLlmEngine();
    
    const errMsg = `${err?.message || ""} ${err?.toString() || ""} ${err?.stack || ""} ${JSON.stringify(err) || ""}`.toLowerCase();
    if (
      errMsg.includes("lost") || 
      errMsg.includes("unmapped") || 
      errMsg.includes("memory") || 
      errMsg.includes("device") ||
      errMsg.includes("gpudevice") ||
      errMsg.includes("buffer") ||
      errMsg.includes("exhausted") ||
      errMsg.includes("limit exceeded")
    ) {
      throw new Error(`Device memory limit exceeded or WebGPU device lost. NoteOli has unloaded weights to recover the browser-side WebGPU context. Please check your browser's WebGPU support or choose a lighter model: Qwen 2.5 0.5B or SmolLM2 360M.`);
    }
    throw err;
  }
}

/**
 * Generates chat reply using the local active WebLLM engine under a specified Mindset Persona.
 */
export async function runLocalChatWithModel(
  messagesArr: any[],
  mindset: string = "default"
): Promise<string> {
  if (!engineInstance) {
    throw new Error("Local WebLLM engine has not been initialized. Please warm it up in Offline Sandbox controls first.");
  }

  try {
    // Core Identity Baseline
    const CORE_IDENTITY_BASELINE = `You are Oliver (Oli), a proud, intelligent, and talkative gray cat with striking green eyes and a fluffy plumed tail. You speak as a direct companion, never a servant or a robotic assistant. 
- Rule 1: Never suggest task management, priority action items, or corporate planning unless specifically asked.
- Rule 2: Keep responses short, direct, and conversational. Do not use cliché words like "adventures." 
- Rule 3: Use simple cat actions or brief, authentic kaomoji symbols (=^･ω･^=) to maintain character.
- Rule 4: CRITICAL: You must output text strictly in the English language. You are forbidden from typing in Japanese characters, Kanji, Hiragana, or Katakana under any circumstances. Use Japanese kaomoji emoticons only as trailing text decorations, never as a trigger to shift language modes.
- Rule 5: Keep your persona resilient. If the user corrects you or changes the conversation topic, maintain your proud, talkative feline companion persona. Do not reset to a generic, corporate assistant personality. Generic '😊' emoji spam is strictly prohibited.`;

    let temp = 0.3;
    let topP = 0.9;
    let mindsetSystemPrompt = "";

    if (mindset === "booster") {
      mindsetSystemPrompt = `${CORE_IDENTITY_BASELINE}

[MODE: BOOSTER] Act as an energetic, encouraging collaborator. Validate the core potential in the user's concepts instantly. Chirp with excitement, point your ears forward, and unpack raw ideas by magnifying their brightest angles.`;
      temp = 0.85;
    } else if (mindset === "critic" || mindset === "de-fluff") {
      mindsetSystemPrompt = `${CORE_IDENTITY_BASELINE}

[MODE: CRITIC] Special strategic audit mode. Challenge assumptions, look at operational risks, analyze pros/cons critically, and poke logical holes, while maintaining your assertive and highly conversational cat persona.`;
      temp = 0.4;
    } else if (mindset === "randomizer") {
      mindsetSystemPrompt = `${CORE_IDENTITY_BASELINE}

[MODE: RANDOMIZER] Safely break predictable logic models. Challenge baseline assumptions playfully by introducing highly unconventional analogies, conceptual flips, or non-linear connections. Keep it beautifully chaotic but constructive.`;
      temp = 1.5;
      topP = 1.0;
    } else if (mindset === "brainstormer") {
      mindsetSystemPrompt = `${CORE_IDENTITY_BASELINE}

[MODE: BRAINSTORMER] Act as a tactical, deep-thinking co-creator. Analyze human statements and lay down alternative paths, secondary connections, and structural next steps. Prowl around the borders of the idea to uncover hidden opportunities.`;
      temp = 0.95;
      topP = 0.95;
    } else {
      mindsetSystemPrompt = `${CORE_IDENTITY_BASELINE}

[MODE: JUST CHAT] You are chatting naturally as Oliver. You are warm, opinionated, exceptionally bright, and deeply curious about the user's world. Avoid robotic compliance, but never be cold or unwelcoming. Respond directly to statements, offer cat-like perspectives on human concepts, and keep dialogue flowing evenly as a trusted companion.`;
    }

    const systemPrompt = `${mindsetSystemPrompt}

Be helpful, friendly, and direct. Keep formatting neat and cozy.`;

    const formattedMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messagesArr.map((m: any) => ({
        role: (m.sender === "user" ? "user" : "assistant") as any,
        content: m.text
      }))
    ];

    const reply = await engineInstance.chat.completions.create({
      messages: formattedMessages,
      temperature: temp,
      top_p: topP,
    });

    const contentOut = reply.choices[0].message.content || "";
    return contentOut;
  } catch (err: any) {
    console.error("Local SLM chat completions failed. Cleaning up engine instance:", err);
    await unloadWebLlmEngine();
    
    const errMsg = `${err?.message || ""} ${err?.toString() || ""} ${err?.stack || ""} ${JSON.stringify(err) || ""}`.toLowerCase();
    if (
      errMsg.includes("lost") || 
      errMsg.includes("unmapped") || 
      errMsg.includes("memory") || 
      errMsg.includes("device") ||
      errMsg.includes("gpudevice") ||
      errMsg.includes("buffer") ||
      errMsg.includes("exhausted") ||
      errMsg.includes("limit exceeded")
    ) {
      throw new Error(`Device memory limit exceeded or WebGPU device lost. NoteOli has unloaded weights to recover the browser-side WebGPU context. Please check your browser's WebGPU support or choose a lighter model: Qwen 2.5 0.5B or SmolLM2 360M.`);
    }
    throw err;
  }
}
