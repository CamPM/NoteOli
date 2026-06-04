/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CreateMLCEngine, MLCEngine, InitProgressReport } from "@mlc-ai/web-llm";

let engineInstance: MLCEngine | null = null;
let initPromise: Promise<MLCEngine> | null = null;

export const DEFAULT_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

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
 * Unloads the active model and releases the associated WebGPU memory.
 */
export async function unloadWebLlmEngine(): Promise<void> {
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
        onProgress(1, `${DEFAULT_MODEL_ID} ready (Cached)`);
        return engineInstance;
      }

      onProgress(0.01, `Compiling WebGPU device and downloading weights for ${DEFAULT_MODEL_ID}...`);
      const engine = await CreateMLCEngine(DEFAULT_MODEL_ID, {
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
      throw err;
    } finally {
      initPromise = null;
    }
  };

  initPromise = performInit();
  return initPromise;
}

/**
 * Generates transformed text using the local active WebLLM engine.
 * Nullifies engine dynamic memory structure if buffer or device disconnect occurs.
 */
export async function runLocalTransformWithModel(
  text: string,
  tone: string,
  length: number,
  utility: string
): Promise<string> {
  if (!engineInstance) {
    throw new Error("Local WebLLM engine has not been initialized. Please warm it up in Offline Sandbox controls first.");
  }

  try {
    // Compile specific prompt instructions matching noteOli logic
    const macroDesc = utility && utility !== "none" 
      ? `Perform the macro operation: ${utility}. Organize and format the text accordingly.`
      : "Perform clean structure, grammatical pruning, and optimization on this text.";

    const lengthDesc = length < 0 
      ? "Compress the text down to its bare skeleton, outline, and core points." 
      : length > 0 
      ? "Expand the text context, add rich descriptions, texture and nuanced details." 
      : "Maintain the word count and length of the original text closely.";

    const systemPrompt = `You are "Oli", a premium client-side Small Language Model (SLM) integrated directly inside the NoteOli text workstation (${DEFAULT_MODEL_ID} via local WebGPU).
Your goal is to parse and transform the provided text strictly according to the user's requested structural utility, tone, and length constraints.

CONSTRAINTS:
1. ${macroDesc}
2. Tone constraint: Apply a strictly '${tone}' tone. Ensure spelling, vocabulary, and phrasing conform to this aesthetic.
3. Length constraint: ${lengthDesc}

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
      temperature: 0.3,
    });

    return reply.choices[0].message.content || "";
  } catch (err: any) {
    console.error("Local SLM inference failed. Cleaning up engine instance:", err);
    
    // Clear out engine instance immediately to recover from Device Lost or GPUBuffer unmap errors
    await unloadWebLlmEngine();
    
    // Enrich error message to guide the user to fall back or try lighter weights
    if (
      err.message && 
      (err.message.includes("lost") || 
       err.message.includes("unmapped") || 
       err.message.includes("memory") || 
       err.message.includes("Device was lost"))
    ) {
      throw new Error(`Device memory limit exceeded or WebGPU device lost. NoteOli has unloaded weights to recover the browser-side WebGPU context. Please check your browser's WebGPU support or refresh the page.`);
    }
    throw err;
  }
}
