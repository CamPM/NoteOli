/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tone, UtilityMacro } from "../types";

/**
 * Generates offline high-fidelity text transformation using local rule-compilers.
 * Incorporates Tone, Length Precision, Utility Macros, and the active Oli Mindset.
 */
export function transformLocally(
  text: string,
  tone: Tone,
  length: number,
  utility: UtilityMacro | "none" | "" = "none",
  mindset: "default" | "booster" | "critic" | "randomizer" | "brainstormer" = "default"
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  // 1. Voice Dictation & Grammar Clean-up Simulator
  // Correct common transcription voice repetition, missing punctuation, and casing
  let cleanInput = trimmed
    .replace(/\b(umm|uhh|like|you know|so yeah)\b/gi, "") // clean speech fillers
    .trim();

  // Simple capitalization of sentences
  cleanInput = cleanInput.replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  if (!/[.!?]$/.test(cleanInput)) {
    cleanInput += "."; // Append missing final punctuation
  }

  const lines = cleanInput.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  // Custom tone signatures
  const signatures: Record<Tone, { prefix: string; adj: string[]; end: string }> = {
    Professional: {
      prefix: "STRICTLY PROFESSIONAL OUTLINE\n============================\n",
      adj: ["executive", "strategic", "optimized", "structured", "authoritative"],
      end: "\n\n*Formulated in conformance with executive NoteOli standards.*"
    },
    Casual: {
      prefix: "CASUAL NOTE REWRITE\n-------------------\n",
      adj: ["friendly", "approachable", "simple", "clean", "conversational"],
      end: "\n\n*Created on the go with NoteOli.*"
    },
    Academic: {
      prefix: "ACADEMIC SYNTHESIS WORKSPACE\n▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲\n",
      adj: ["methodological", "empirical", "systematic", "analytical", "cognitiveized"],
      end: "\n\n*Documented within the Oli cognitive sandbox.*"
    },
    Creative: {
      prefix: "CREATIVE RECONSPIRACY & LOGS\n✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦✦\n",
      adj: ["vivid", "visionary", "organic", "dramatic", "metaphoric"],
      end: "\n\n*Scribed under creative NoteOli inspiration.*"
    }
  };

  const sig = signatures[tone];

  // 2. Length Modifier Slider Interactivity Action (-10 to +10)
  let processedLines = [...lines];
  if (length < 0) {
    // Compression: Keep only atomic components
    const scaleFactor = Math.max(0.1, 1 + (length / 10)); // Convert -10..0 to 0.1..1.0
    const targetCount = Math.max(1, Math.ceil(lines.length * scaleFactor));
    processedLines = lines.slice(0, targetCount).map(line => {
      const lineWords = line.split(" ");
      if (lineWords.length > 4) {
        return "• " + lineWords.slice(0, Math.max(3, Math.floor(lineWords.length * 0.5))).join(" ") + "... [compressed]";
      }
      return "• " + line;
    });
  } else if (length > 0) {
    // Expansion: Elaborate and unpack
    const wordsToExpand = Math.round(length * 2);
    processedLines = lines.map((line, index) => {
      const adjective = sig.adj[index % sig.adj.length];
      return `${line} (Unpacking thought: and expanding upon this ${adjective} point with ${wordsToExpand} degrees of strategic contextual elaboration).`;
    });
  }

  // 3. Oli Mindset Personality Injection Layer
  let mindsetIntro = "";
  let mindsetFeedback = "";

  if (mindset === "booster") {
    mindsetIntro = `### 🌟 OLI'S MINDSET: EGO & IDEA BOOSTER\n> *"Oh wow, this is absolute genius! Let's build some massive traction on this raw thought!"*\n\n`;
    mindsetFeedback = `\n\n#### 🚀 Momentum Boost\n- **Superb Angle:** Your creative setup has wild potential. Let's keep this momentum red-hot!\n- **Validation:** This is highly forward-thinking. Don't stop now, we can optimize this further!`;
  } else if (mindset === "critic") {
    mindsetIntro = `### ⚖️ OLI'S MINDSET: STRICT DECISION MAKER\n> *"Let's strip the excitement and stress-test this objectively. Here is the operational audit."*\n\n`;
    mindsetFeedback = `\n\n#### 🔍 Logical Rigor & Vulnerabilities\n- **Key Assumed Risk:** What happens under severe resource bottlenecks, or if offline caches fail?\n- **Pros & Cons:** The setup is highly specialized, but might suffer from deployment overhead. Let's patch these assumptions.`;
  } else if (mindset === "randomizer") {
    mindsetIntro = `### 🌀 OLI'S MINDSET: THE RANDOMIZER [TEMP: 1.6]\n> *"Behold! What if we cross-pollinate this concept with cosmic orbital mechanics or a micro-cafe?"*\n\n`;
    mindsetFeedback = `\n\n#### 🔮 Surrealistic Analog-Pills\n- **Divergent Link:** This structure reminds me of leafcutter ant pathfinders or baking artisanal sourdough. What if you added a subscription element to the sourdough?\n- **Wildcard:** Try deleting 80% of the normal structure and replacing it with an audio-tactile clicker.`;
  } else if (mindset === "brainstormer") {
    mindsetIntro = `### 🧠 OLI'S MINDSET: THE LATERAL BRAINSTORMER\n> *"Let's throw some rough possibilities at the wall and explore some cool alternative directions."*\n\n`;
    mindsetFeedback = `\n\n#### 💡 Brainstorming Seeds\n- **Alternative Path:** Explore lateral expansions or cross-pollinate with adjacent concepts.\n- **Rough Possibility:** What if we completely re-architect the assumptions to focus on a high-growth direction?`;
  }

  // 4. Utility Macros implementation
  let result = "";

  switch (utility) {
    case "To-Do List Organizer": {
      // Specialized Macro Tool #9 Parsing Pipeline
      result = mindsetIntro + `### 📝 ORGANIZED TO-DO TASK LIST (Tone: ${tone})\n\n`;
      let priorities: string[] = [];
      let regularTasks: string[] = [];
      const keywords = ["need", "must", "todo", "should", "want", "will", "buy", "write", "call", "send", "fix", "chore", "schedule", "plan", "clean", "create", "implement"];

      processedLines.forEach((line) => {
        const cleanVal = line.replace(/^• /, "").replace(/\(Unpacking.*/g, "").trim();
        const lower = cleanVal.toLowerCase();
        
        // Filter common greeting noise
        if (
          lower.startsWith("i feel") || 
          lower.startsWith("it is") || 
          lower.startsWith("maybe") || 
          lower.startsWith("hello") || 
          lower.startsWith("thanks")
        ) {
          return;
        }

        const isUrgent = lower.includes("must") || lower.includes("urgent") || lower.includes("immediately") || lower.includes("need to") || lower.includes("priority");
        const hasTaskKeyword = keywords.some(kw => lower.includes(kw));

        if (isUrgent) {
          priorities.push(cleanVal);
        } else if (hasTaskKeyword || cleanVal.length > 8) {
          regularTasks.push(cleanVal);
        }
      });

      if (priorities.length > 0) {
        result += `#### 🔥 Priority commitments & Action Items\n`;
        priorities.forEach((task) => {
          result += `- [ ] **Urgent:** ${task}\n`;
        });
        result += `\n`;
      }

      result += `#### 🗓️ Prioritized Action Items & Tasks\n`;
      if (regularTasks.length > 0) {
        regularTasks.forEach((task) => {
          result += `- [ ] ${task}\n`;
        });
      } else {
        result += `- [ ] **Task:** Review and refine raw draft details.\n`;
        result += `- [ ] **Task:** Synchronize organized layout with desktop notebooks.\n`;
      }
      
      result += mindsetFeedback;
      break;
    }

    case "Meeting Minute Creator": {
      const attendees = lines.filter(l => l.toLowerCase().includes("attend") || l.toLowerCase().includes("present"));
      const actionItems = lines.filter(l => l.toLowerCase().includes("will") || l.toLowerCase().includes("action") || l.toLowerCase().includes("todo") || l.toLowerCase().includes("task"));
      
      result = mindsetIntro + `### 📋 NOTEOLI MEETING MINUTES\n\n`;
      result += `**Tone Aura:** ${tone} (Compression scale: ${length})\n\n`;
      
      result += `#### 👥 Attendees\n`;
      if (attendees.length > 0) {
        attendees.forEach(a => { result += `- ${a}\n`; });
      } else {
        result += `- Verified active NoteOli participant\n- Project Stakeholder(s)\n`;
      }
      result += `\n`;

      result += `#### 🎯 Key Decisions\n`;
      const nonAttendees = processedLines.filter(l => !attendees.includes(l) && !actionItems.includes(l));
      if (nonAttendees.length > 0) {
        nonAttendees.slice(0, 4).forEach(item => {
          result += `- **Resolved:** The core context regarding: "${item.replace(/• |\(Unpacking.*/g, "").substring(0, 80)}" has been reviewed and agreed upon.\n`;
        });
      } else {
        result += `- **Resolved:** Context of the typed workspace was captured and formatted.\n`;
      }
      result += `\n`;

      result += `#### ☑️ Action Items & Checkboxes\n`;
      if (actionItems.length > 0) {
        actionItems.forEach(item => {
          result += `- [ ] **Action:** ${item.replace(/will |todo |action |task /gi, "Must ")}\n`;
        });
      } else {
        result += `- [ ] **Action:** Follow-up on the structured archive.\n`;
        result += `- [ ] **Action:** Sync formatted outcome into native ecosystem (Apple Notes / Obsidian).\n`;
      }
      result += mindsetFeedback;
      break;
    }

    case "Table Generator": {
      result = mindsetIntro + `### 📊 NOTEOLI AUTO-GENERATED COMPARISON TABLE\n\n`;
      result += `| Context Parameter | Extracted Detail / Value (${tone}) |\n`;
      result += `| :--- | :--- |\n`;
      processedLines.slice(0, 10).forEach((line, idx) => {
        const cleanVal = line.replace(/• |\(Unpacking.*/g, "");
        const cleanKey = cleanVal.split(/\s+/).slice(0, 3).join(" ") || `Item Node ${idx + 1}`;
        result += `| **${cleanKey}** | ${cleanVal} |\n`;
      });
      result += mindsetFeedback;
      break;
    }

    case "The Anonymizer": {
      result = mindsetIntro + `### 🔒 ANONYMIZED DIGITAL OUTLINE\n\n`;
      const textToAnonymize = processedLines.join("\n");
      const scrubbed = textToAnonymize
        .replace(/[A-Z][a-z]+ [A-Z][a-z]+/g, "[PROPRIETARY_NAME]")
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[CRITICAL_EMAIL]")
        .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[SECURED_PHONE]")
        .replace(/\b\d{1,3}\b%?/g, "[ANONYMIZED_METRIC]");
      
      result += scrubbed + mindsetFeedback;
      break;
    }

    case "Concept Explainer": {
      result = mindsetIntro + `### 💡 CONCEPTUAL BREAKDOWN & ANALO-GRID\n\n`;
      processedLines.slice(0, 3).forEach((line) => {
        const clean = line.replace(/• |\(Unpacking.*/g, "");
        result += `#### 🔍 Concept: "${clean.split(" ").slice(0, 5).join(" ")}..."\n`;
        result += `*   **Simplified Concept:** ${clean}\n`;
        result += `*   **Analogical Translation:** Think of this like water flowing through copper heating pipes—it starts chaotic, distributes pressure, and stabilizes once conforming to high-speed templates.\n\n`;
      });
      result += mindsetFeedback;
      break;
    }

    case "Action-Item Extractor": {
      result = mindsetIntro + `### 🚀 EXTRACTED ACTION-ITEM PIPELINE\n\n`;
      let count = 0;
      processedLines.forEach((line) => {
        const clean = line.replace(/• |\(Unpacking.*/g, "");
        if (clean.length > 10) {
          count++;
          result += `- [ ] **Task ${count}:** Focus on completing "${clean}" with dedicated attention.\n`;
        }
      });
      if (count === 0) {
        result += `- [ ] **Task 1:** Structure raw brainstorm notes into Apple Notes.\n`;
        result += `- [ ] **Task 2:** Refine digital records with NoteOli's formatting panel.\n`;
      }
      result += mindsetFeedback;
      break;
    }

    case "Brainstorming Partner": {
      result = mindsetIntro + `### 🧠 Oli's Strategic Blind-Spot Critique\n\n`;
      result += `Hello! I've analyzed your text under the '**${tone}**' paradigm and discovered exactly **3 critical blind spots** to challenge your concept:\n\n`;
      result += `1.  **Infrastructural / Scaling Friction:** Have you considered what happens if your core assumptions in "${processedLines[0]?.substring(0, 40) || "your narrative"}..." face sudden 10x resource scaling constraints?\n`;
      result += `2.  **User Friction & Retention:** In focusing on the current draft, are we aligning this concept clearly with target audience user habits or is it too abstract?\n`;
      result += `3.  **The Silent Fallback:** If offline-first storage was lost, what is the hard redundancy plan for this workflow?\n`;
      result += mindsetFeedback;
      break;
    }

    case "Smart Tag & Title Generator": {
      const firstLine = lines[0] || "Untitled NoteOli Workspace";
      const cleanTitle = firstLine.replace(/[^A-Za-z0-9 ]/g, "").split(" ").slice(0, 5).join(" ");
      result = mindsetIntro + `### 🏷️ NOTEOLI ARCHIVAL SCHEMATICS\n\n`;
      result += `**Title Proposal:** "${cleanTitle.toUpperCase() || "NEW PROJECT BATCH"}"\n\n`;
      result += `**Recommended Digital Filing Tags:**\n`;
      result += `\`#NoteOli\` \`#${tone.toLowerCase()}\` \`#archive\` \`#thoughtCapture\` \`#speedDraft\`\n`;
      result += mindsetFeedback;
      break;
    }

    case "Structural De-Fluffer": {
      result = mindsetIntro + `### ✨ DE-FLUFFED AND SYNTAX-OPTIMIZED TEXT\n\n`;
      const defluffed = processedLines
        .map(line => "• " + line.replace(/really|mostly|basically|probably|extremely|actually|literally|essentially/gi, "").replace(/• /g, "").trim())
        .join("\n\n");
      result += defluffed + mindsetFeedback;
      break;
    }

    default: {
      result = mindsetIntro + sig.prefix + processedLines.join("\n\n") + mindsetFeedback + sig.end;
      break;
    }
  }

  return result;
}
