/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioContext: AudioContext | null = null;
let isAudioEnabled = false;

export function enableAudio() {
  if (typeof window === "undefined") return;
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  isAudioEnabled = true;
}

export function toggleAudio(enabled: boolean) {
  isAudioEnabled = enabled;
  if (enabled && audioContext && audioContext.state === "suspended") {
    audioContext.resume();
  }
}

export function getAudioStatus(): boolean {
  return isAudioEnabled;
}

/**
 * Synthesizes a crisp, luxury mechanical tactile keyboard clack
 * using Web Audio API oscillator nodes.
 */
export function playMechanicalClick(type: "click" | "success" | "release" = "click") {
  if (!isAudioEnabled) return;
  
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    
    const now = audioContext.currentTime;
    
    if (type === "success") {
      // Premium triple metallic electronic chime / confirmation gear
      // Part 1: High crisp tick
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08); // E6
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      const filter = audioContext.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 600;
      
      osc1.connect(gain1);
      gain1.connect(filter);
      filter.connect(audioContext.destination);
      osc1.start(now);
      osc1.stop(now + 0.16);
      
      // Part 2: Success response secondary beep
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1046.50, now + 0.06); // C6
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.linearRampToValueAtTime(0.1, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.23);
      
    } else {
      // Luxury switch keypress: tactile metallic pick + lower resonant body thud
      // 1. High frequency 'clack' pluck
      const clickOsc = audioContext.createOscillator();
      const clickGain = audioContext.createGain();
      clickOsc.type = "triangle";
      clickOsc.frequency.setValueAtTime(1800, now);
      clickOsc.frequency.exponentialRampToValueAtTime(800, now + 0.015);
      
      clickGain.gain.setValueAtTime(0.2, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      
      const clickFilter = audioContext.createBiquadFilter();
      clickFilter.type = "highpass";
      clickFilter.frequency.value = 1000;
      
      clickOsc.connect(clickGain);
      clickGain.connect(clickFilter);
      clickFilter.connect(audioContext.destination);
      
      clickOsc.start(now);
      clickOsc.stop(now + 0.025);
      
      // 2. Low frequency base wood/plastic resonant 'thump'
      const thumpOsc = audioContext.createOscillator();
      const thumpGain = audioContext.createGain();
      thumpOsc.type = "sine";
      thumpOsc.frequency.setValueAtTime(125, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(85, now + 0.03);
      
      thumpGain.gain.setValueAtTime(0.25, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      
      const thumpFilter = audioContext.createBiquadFilter();
      thumpFilter.type = "lowpass";
      thumpFilter.frequency.value = 250;
      
      thumpOsc.connect(thumpGain);
      thumpGain.connect(thumpFilter);
      thumpFilter.connect(audioContext.destination);
      
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.06);
    }
  } catch (err) {
    console.warn("Audio synthesis was skipped or unsupported by the browser:", err);
  }
}
