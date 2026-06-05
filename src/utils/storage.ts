/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NoteEntry } from "../types";

const WORKSPACE_KEY = "noteoli_current_workspace";
const NOTES_LIST_KEY = "noteoli_saved_notes";
const AUDIO_TOGGLE_KEY = "noteoli_audio_toggle";

export function loadCurrentDraft(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(WORKSPACE_KEY) || "";
}

export function saveCurrentDraft(content: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORKSPACE_KEY, content);
}

export function loadNotes(): NoteEntry[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(NOTES_LIST_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (err) {
    return [];
  }
}

export function saveNotes(notes: NoteEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTES_LIST_KEY, JSON.stringify(notes));
}

export function loadAudioToggle(): boolean {
  if (typeof window === "undefined") return false; // Default to silent
  return localStorage.getItem(AUDIO_TOGGLE_KEY) === "true";
}

export function saveAudioToggle(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUDIO_TOGGLE_KEY, enabled ? "true" : "false");
}
