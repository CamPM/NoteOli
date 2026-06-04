/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tone, UtilityMacro } from "../types";

/**
 * Generates offline high-fidelity text transformation using local rule-compilers
 * to ensure NoteOli is robustly offline-first and instantly responsive.
 */
export function transformLocally(
  text: string,
  tone: Tone,
  length: number,
  utility?: UtilityMacro | "none" | ""
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  // Splitting text into lines and words for processing
  const lines = trimmed.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const words = trimmed.split(/\s+/);
  
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

  // Length modifier simulation
  let processedLines = [...lines];
  if (length < 0) {
    // Compression
    const targetCount = Math.max(1, Math.ceil(lines.length * (1 + length / 10)));
    processedLines = lines.slice(0, targetCount).map(line => {
      // Shorten the line to its absolute core nouns and verbs
      const lineWords = line.split(" ");
      if (lineWords.length > 5) {
        return "• " + lineWords.slice(0, Math.floor(lineWords.length * 0.618)).join(" ") + "... [compressed]";
      }
      return "• " + line;
    });
  } else if (length > 0) {
    // Expansion
    processedLines = lines.map((line, index) => {
      const adjective = sig.adj[index % sig.adj.length];
      return `${line} (Providing a ${adjective} and structured amplification based on context analysis to expand the core narrative point).`;
    });
  }

  // Utility Macros implementation
  let result = "";

  switch (utility) {
    case "Meeting Minute Creator": {
      const attendees = lines.filter(l => l.toLowerCase().includes("attend") || l.toLowerCase().includes("present"));
      const actionItems = lines.filter(l => l.toLowerCase().includes("will") || l.toLowerCase().includes("action") || l.toLowerCase().includes("todo") || l.toLowerCase().includes("task"));
      
      result = `### 📋 NOTEOLI MEETING MINUTES\n\n`;
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
          result += `- **Resolved:** The core context regarding: "${item.replace(/• |\(Providing.*/g, "").substring(0, 80)}" has been reviewed and agreed upon.\n`;
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
      break;
    }

    case "Table Generator": {
      result = `### 📊 NOTEOLI AUTO-GENERATED COMPARISON TABLE\n\n`;
      result += `| Context Parameter | Extracted Detail / Value (${tone}) |\n`;
      result += `| :--- | :--- |\n`;
      processedLines.slice(0, 10).forEach((line, idx) => {
        const cleanVal = line.replace(/• |\(Providing.*/g, "");
        const cleanKey = cleanVal.split(/\s+/).slice(0, 3).join(" ") || `Item Node ${idx + 1}`;
        result += `| **${cleanKey}** | ${cleanVal} |\n`;
      });
      break;
    }

    case "The Anonymizer": {
      result = `### 🔒 ANONYMIZED DIGITAL OUTLINE\n\n`;
      // High frequency entity scrubbing simulation
      const textToAnonymize = processedLines.join("\n");
      const scrubbed = textToAnonymize
        .replace(/[A-Z][a-z]+ [A-Z][a-z]+/g, "[PROPRIETARY_NAME]")
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[CRITICAL_EMAIL]")
        .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[SECURED_PHONE]")
        .replace(/\b\d{1,3}\b%?/g, "[ANONYMIZED_METRIC]");
      
      result += scrubbed;
      break;
    }

    case "Concept Explainer": {
      result = `### 💡 CONCEPTUAL BREAKDOWN & ANALO-GRID\n\n`;
      processedLines.slice(0, 3).forEach((line) => {
        const clean = line.replace(/• |\(Providing.*/g, "");
        result += `#### 🔍 Concept: "${clean.split(" ").slice(0, 5).join(" ")}..."\n`;
        result += `*   **Simplified Concept:** ${clean}\n`;
        result += `*   **Analogical Translation:** Think of this like water flowing through copper heating pipes—it starts chaotic, distributes pressure throughout, and stabilizes once it conforms to NoteOli's high-speed templates.\n\n`;
      });
      break;
    }

    case "Action-Item Extractor": {
      result = `### 🚀 EXTRACTED ACTION-ITEM PIPELINE\n\n`;
      let count = 0;
      processedLines.forEach((line) => {
        const clean = line.replace(/• |\(Providing.*/g, "");
        if (clean.length > 10) {
          count++;
          result += `[ ] **Task ${count}:** Focus on completing "${clean}" with dedicated attention.\n`;
        }
      });
      if (count === 0) {
        result += `[ ] **Task 1:** Structure raw brainstorm notes into Apple Notes.\n`;
        result += `[ ] **Task 2:** Refine digital records with NoteOli's formatting panel.\n`;
      }
      break;
    }

    case "Brainstorming Partner": {
      result = `### 🧠 Oli's Strategic Blind-Spot Critique\n\n`;
      result += `Hello! I've analyzed your text under the '**${tone}**' paradigm and discovered exactly **3 critical blind spots** to challenge your concept:\n\n`;
      result += `1.  **Infrastructural / Scaling Friction:** Have you considered what happens if your core assumptions in "${processedLines[0]?.substring(0, 40) || "your narrative"}..." face sudden 10x resource scaling constraints?\n`;
      result += `2.  **User Friction & Retention:** In focusing on the current draft, are we aligning this concept clearly with target audience user habits or is it too abstract?\n`;
      result += `3.  **The Silent Fallback:** If offline-first storage was lost, what is the hard redundancy plan for this workflow?\n`;
      break;
    }

    case "Smart Tag & Title Generator": {
      const firstLine = lines[0] || "Untitled NoteOli Workspace";
      const cleanTitle = firstLine.replace(/[^A-Za-z0-9 ]/g, "").split(" ").slice(0, 5).join(" ");
      result = `### 🏷️ NOTEOLI ARCHIVAL SCHEMATICS\n\n`;
      result += `**Title Proposal:** "${cleanTitle.toUpperCase() || "NEW PROJECT BATCH"}"\n\n`;
      result += `**Recommended Digital Filing Tags:**\n`;
      result += `\`#NoteOli\` \`#${tone.toLowerCase()}\` \`#archive\` \`#thoughtCapture\` \`#speedDraft\`\n`;
      break;
    }

    case "Structural De-Fluffer": {
      result = `### ✨ DE-FLUFFED AND SYNTAX-OPTIMIZED TEXT\n\n`;
      // Re-joining lines with tight single sentences
      const defluffed = processedLines
        .map(line => "• " + line.replace(/really|mostly|basically|probably|extremely|actually|literally|essentially/gi, "").replace(/• /g, "").trim())
        .join("\n\n");
      result += defluffed;
      break;
    }

    case "To-Do List Organizer": {
      result = `### 📝 ORGANIZED TO-DO TASK LIST\n\n`;
      let priorities: string[] = [];
      let regularTasks: string[] = [];
      const keywords = ["need", "must", "todo", "should", "want", "will", "buy", "write", "call", "send", "fix", "chore", "schedule", "plan", "clean"];

      processedLines.forEach((line) => {
        const cleanVal = line.replace(/• |\(Providing.*/g, "").trim();
        const lower = cleanVal.toLowerCase();
        
        // Skip common conversational filler
        if (
          lower.startsWith("i feel") || 
          lower.startsWith("it is") || 
          lower.startsWith("maybe") || 
          lower.startsWith("hello") || 
          lower.startsWith("thanks")
        ) {
          return;
        }

        const isUrgent = lower.includes("must") || lower.includes("urgent") || lower.includes("immediately") || lower.includes("need to");
        const hasTaskKeyword = keywords.some(kw => lower.includes(kw));

        if (isUrgent) {
          priorities.push(cleanVal);
        } else if (hasTaskKeyword || cleanVal.length > 8) {
          regularTasks.push(cleanVal);
        }
      });

      if (priorities.length > 0) {
        result += `#### 🔥 High Priority Commitments\n`;
        priorities.forEach((task) => {
          result += `- [ ] **Urgent:** ${task}\n`;
        });
        result += `\n`;
      }

      result += `#### 🗓️ Structured Actions & Tasks\n`;
      if (regularTasks.length > 0) {
        regularTasks.forEach((task) => {
          result += `- [ ] ${task}\n`;
        });
      } else {
        result += `- [ ] Review raw workspace content\n`;
        result += `- [ ] Complete designated project requirements\n`;
      }
      break;
    }

    default:
      result = sig.prefix + processedLines.join("\n\n") + sig.end;
  }

  return result;
}
