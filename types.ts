/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Tone = "Professional" | "Casual" | "Academic" | "Creative";

export type UtilityMacro =
  | "Meeting Minute Creator"
  | "Table Generator"
  | "The Anonymizer"
  | "Concept Explainer"
  | "Action-Item Extractor"
  | "Brainstorming Partner"
  | "Smart Tag & Title Generator"
  | "Structural De-Fluffer"
  | "To-Do List Organizer";

export interface NoteEntry {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  lastModifiedAt: string;
}

export interface TransformationConfig {
  tone: Tone;
  length: number; // -10 to +10
  utility: UtilityMacro | "none";
}

export type ModelCacheStatus = "unloaded" | "loading" | "ready" | "error";
