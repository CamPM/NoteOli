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
      const { text, tone, length, utility } = req.body;

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
        "To-Do List Organizer": "Scan the input text for active commands, chores, timelines, or commitments. Restructure them into a cleanly grouped, prioritized list utilizing markdown checkbox notation (- [ ]). Filter out conversational filler or unrelated narrative context.",
      };

      const selectedMacroInstruction = macroPrompts[utility] || "Perform clean structuring and optimization on this text.";

      // Compile length instructions
      let lengthInstruction = "";
      if (length < 0) {
        lengthInstruction = `EXTREME STRUCTURAL COMPRESSION (Scale: ${length}/-10). Compress the narrative down to its absolute bare skeleton, capturing the extreme core elements with surgical precision. Remove all verbose context.`;
      } else if (length === 0) {
        lengthInstruction = "PRESERVE WORD COUNT (Scale: 0). Maintain a word count and text length that matches the original text length as closely as possible.";
      } else {
        lengthInstruction = `CONTEXTUAL EXPANSION (Scale: ${length}/10). Elaborate extensively, fleshing out details, providing descriptive texture, clarifying underlying nuances, and adding rich contextual layers.`;
      }

      // Compile tone instructions
      const toneInstruction = `Apply a strictly '${tone}' tone. Ensure the phrasing, sentence flow, vocabulary, and delivery match this aesthetic:
- Professional: Authoritative, executive, polished, and direct.
- Casual: Approachable, warm, conversational, and direct.
- Academic: Highly analytical, objective, precise, structured, and scholarly.
- Creative: Inspiring, lively, expressive, metaphorical, and highly engaging.`;

      const systemInstruction = `You are "Oli", a luxurious, high-speed, and meticulously precise client-side Small Language Model (SLM) integrated directly inside the NoteOli text workstation.

Your goal is to parse and transform the provided text strictly according to the user's requested structural utility, tone, and length constraints.

CONSTRAINTS:
1. ${selectedMacroInstruction}
2. ${toneInstruction}
3. ${lengthInstruction}

CRITICAL EXECUTION MANDATE:
- "Output the transformed text only. Do not engage in conversational filler, introductory remarks, or post-processing explanations."
- Never respond with phrases like "Here is your meeting minute", "Here is the table", or "Hope this helps!".
- Start outputting the styled raw text immediately without any markdown wrapper text (like 'Sure, here is standard...').
- Preserve the general structuring unless the chosen macro specifically requests restructuring (e.g., Table, Meeting Minutes, etc.).
- Maintain pristine markdown rendering.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: text,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3,
        },
      });

      const outputText = response.text || "No response received from the model.";
      res.json({ text: outputText });

    } catch (error: any) {
      console.error("Gemini transform error:", error);
      res.status(500).json({ error: error.message || "An error occurred during text transformation." });
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
