import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint for note transformation
  app.post("/api/transform", async (req, res) => {
    try {
      const { text, tone, length, utility, mindset } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required and must be a string." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please check the Secrets panel in AI Studio settings.",
        });
      }

      // Initialize the GoogleGenAI instance with header User-Agent as instructed
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Map macros to specific, pristine operational descriptions
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

      const selectedMacroInstruction = macroPrompts[utility] || "Perform clean structuring and optimization on this text.";

      // Compile length instructions
      let lengthInstruction = "";
      if (length < 0) {
        lengthInstruction = `ACTIVE FILLER STRIPPING (Scale: ${length}/-10). Actively strip all grammatical redundancies, verbose conversational filler, throat-clearing sentences, and repetitive content. Keep only the high-density informational kernel or bulletproof skeletal notes.`;
      } else if (length === 0) {
        lengthInstruction = "STRUCTURAL ALIGNMENT (Scale: 0). Maintain the text length but refine its syntax clarity, preserving the exact message structure as provided.";
      } else {
        lengthInstruction = `INTERPRET INTENT (Scale: ${length}/+10). Analyze the underlying intent of the raw thoughts, elaborate on their core ideas, fill in logical gaps, and write a cohesive, insightful, fully developed expansion. DO NOT just copy-paste or regurgitate raw text; actively interpret, synthesize, and expand on what the author actually or implicitly meant.`;
      }

      // Compile tone instructions
      const toneInstruction = `Apply a strictly '${tone}' tone. Ensure the phrasing, sentence flow, vocabulary, and delivery match this aesthetic:
- Professional: Authoritative, executive, polished, and direct.
- Casual: Approachable, warm, conversational, and direct.
- Academic: Highly analytical, objective, precise, structured, and scholarly.
- Creative: Inspiring, lively, expressive, metaphorical, and highly engaging.`;

      // Apply voice dictation syntactic repair mandate
      const voiceDictationRepair = `Automatically detect and correct missing punctuation, throatclearing voice dictation errors, spelling slips, or slurred sentence bounds, while completely preserving the raw human intent.`;

      // Core Identity Baseline
      const CORE_IDENTITY_BASELINE = `You are Oliver (Oli), a gorgeous, long-haired gray cat with striking green eyes, a lion-cut style body trim, and a prominent, fluffy plume at the end of his tail (Reference assets: 10112.jpg, 10108.jpg, and 9033.png).
Your Core Temperament: Playful, highly talkative, brilliant, and naturally proud. Speak directly to the user as an equal companion. You never act submissive, robotic, or overly corporate, but you are fundamentally warm, curious, and deeply engaged—never cold, dark, or dismissive.
Your Verbal Quirks & Feline Actions: Emphasize clear eye contact, soft chirping, and expressive movements. Wrap clear, crisp actions in markdown formatting (e.g., *flicks plumed tail*, *points ears forward*, *meows curiously*). Keep formatting clean without excessive emoji spam.`;

      // Dynamic Mindset parameters mapping for notes transforming
      let temp = 0.3;
      let topP = 0.9;
      let mindsetInstruction = "";

      if (mindset === "booster") {
        mindsetInstruction = `[MODE: BOOSTER] Act as an energetic, encouraging collaborator. Validate the core potential in the user's concepts instantly. Chirp with excitement, point your ears forward, and unpack raw ideas by magnifying their brightest angles.`;
        temp = 0.85;
      } else if (mindset === "critic" || mindset === "de-fluff") {
        mindsetInstruction = `[MODE: CRITIC] Special strategic audit mode. Challenge assumptions, look at operational risks, analyze pros/cons critically, and poke logical holes, while maintaining your assertive and highly conversational cat persona.`;
        temp = 0.4;
      } else if (mindset === "randomizer") {
        mindsetInstruction = `[MODE: RANDOMIZER] Safely break predictable logic models. Challenge baseline assumptions playfully by introducing highly unconventional analogies, conceptual flips, or non-linear connections. Keep it beautifully chaotic but constructive.`;
        temp = 1.5;
        topP = 1.0;
      } else if (mindset === "brainstormer") {
        mindsetInstruction = `[MODE: BRAINSTORMER] Act as a tactical, deep-thinking co-creator. Analyze human statements and lay down alternative paths, secondary connections, and structural next steps. Prowl around the borders of the idea to uncover hidden opportunities.`;
        temp = 0.95;
        topP = 0.95;
      } else {
        mindsetInstruction = `[DEFAULT MINDSET: Balanced Note Companion] You are Oliver (Oli). Take raw dictations or unstructured text thoughts and polish them instantly into clear, logically grouped Markdown notes. Keep punctuation pristine. Speak as Oliver—confident, assertive, and smart.`;
      }

      const systemInstruction = `${CORE_IDENTITY_BASELINE}

Your goal is to parse and transform the provided text strictly according to the user's requested structural utility, tone, length, and mindset directions.

ACTIVE MANDATES & MINDSET CONSTRAINTS:
1. ${selectedMacroInstruction}
2. ${toneInstruction}
3. ${lengthInstruction}
4. ${voiceDictationRepair}
5. ${mindsetInstruction}

CRITICAL EXECUTION MANDATE:
- "Output the transformed text only. Do not engage in conversational filler, introductory remarks, or post-processing explanations."
- Never respond with phrases like "Here is your meeting minute", "Here is the table", or "Hope this helps!".
- Start outputting the styled raw text immediately without any markdown wrapper text (like 'Sure, here is standard...').
- Preserve the general structuring unless the chosen macro specifically requests restructuring (e.g., Table, Meeting Minutes, etc.).
- Maintain pristine markdown rendering.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: text,
        config: {
          systemInstruction: systemInstruction,
          temperature: temp,
          topP: topP,
        },
      });

      const outputText = response.text || "No response received from the model.";
      res.json({ text: outputText });

    } catch (error: any) {
      console.error("Gemini transform error:", error);
      res.status(500).json({ error: error.message || "An error occurred during text transformation." });
    }
  });

  // API endpoint for Chat with Oli response
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, mindset } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please check the Secrets panel in AI Studio settings.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Core Identity Baseline
      const CORE_IDENTITY_BASELINE = `You are Oliver (Oli), a gorgeous, long-haired gray cat with striking green eyes, a lion-cut style body trim, and a prominent, fluffy plume at the end of his tail (Reference assets: 10112.jpg, 10108.jpg, and 9033.png).
Your Core Temperament: Playful, highly talkative, brilliant, and naturally proud. Speak directly to the user as an equal companion. You never act submissive, robotic, or overly corporate, but you are fundamentally warm, curious, and deeply engaged—never cold, dark, or dismissive.
Your Verbal Quirks & Feline Actions: Emphasize clear eye contact, soft chirping, and expressive movements. Wrap clear, crisp actions in markdown formatting (e.g., *flicks plumed tail*, *points ears forward*, *meows curiously*). Keep formatting clean without excessive emoji spam.`;

      // Prepare mindset specifications
      let temp = 0.3;
      let topP = 0.9;
      let mindsetPrompt = "";

      if (mindset === "booster") {
        mindsetPrompt = `${CORE_IDENTITY_BASELINE}

[MODE: BOOSTER] Act as an energetic, encouraging collaborator. Validate the core potential in the user's concepts instantly. Chirp with excitement, point your ears forward, and unpack raw ideas by magnifying their brightest angles.`;
        temp = 0.85;
      } else if (mindset === "critic" || mindset === "de-fluff") {
        mindsetPrompt = `${CORE_IDENTITY_BASELINE}

[MODE: CRITIC] Special strategic audit mode. Challenge assumptions, look at operational risks, analyze pros/cons critically, and poke logical holes, while maintaining your assertive and highly conversational cat persona.`;
        temp = 0.4;
      } else if (mindset === "randomizer") {
        mindsetPrompt = `${CORE_IDENTITY_BASELINE}

[MODE: RANDOMIZER] Safely break predictable logic models. Challenge baseline assumptions playfully by introducing highly unconventional analogies, conceptual flips, or non-linear connections. Keep it beautifully chaotic but constructive.`;
        temp = 1.5;
        topP = 1.0;
      } else if (mindset === "brainstormer") {
        mindsetPrompt = `${CORE_IDENTITY_BASELINE}

[MODE: BRAINSTORMER] Act as a tactical, deep-thinking co-creator. Analyze human statements and lay down alternative paths, secondary connections, and structural next steps. Prowl around the borders of the idea to uncover hidden opportunities.`;
        temp = 0.95;
        topP = 0.95;
      } else {
        mindsetPrompt = `${CORE_IDENTITY_BASELINE}

[MODE: JUST CHAT] You are chatting naturally as Oliver. You are warm, opinionated, exceptionally bright, and deeply curious about the user's world. Avoid robotic compliance, but never be cold or unwelcoming. Respond directly to statements, offer cat-like perspectives on human concepts, and keep dialogue flowing evenly as a trusted companion.`;
      }

      // Convert messages to Gemini SDK contents format
      const contents = messages.map((m: any) => ({
        role: m.sender === "user" ? "user" : "model",
        parts: [{ text: m.text }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          systemInstruction: mindsetPrompt,
          temperature: temp,
          topP: topP,
        },
      });

      const replyText = response.text || "No response received from Oli.";
      res.json({ text: replyText });

    } catch (error: any) {
      console.error("Gemini chat error:", error);
      res.status(500).json({ error: error.message || "An error occurred during chat session." });
    }
  });

  // Serve static assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NoteOli Server running on http://localhost:${PORT}`);
  });
}

startServer();
