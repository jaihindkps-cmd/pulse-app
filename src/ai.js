// Asli AI: Firebase AI Logic (Gemini Developer API). Client se seedha, koi server nahi.
// Chalne ke liye Firebase console > AI Logic me "Get started" (Gemini Developer API) karna padta hai.
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

var ai = null, good = null, lastError = null;
var MODELS = ["gemini-3.8-flash", "gemini-2.5-flash"];

export function initAI(app) { try { ai = getAI(app, { backend: new GoogleAIBackend() }); } catch (e) { ai = null; lastError = e; } return !!ai; }
export function aiError() { return lastError; }
export function aiWorking() { return good; }

function model(name, system, json) {
  var cfg = { model: name, generationConfig: { temperature: json ? 1 : 0.85, maxOutputTokens: json ? 2200 : 320 } };
  if (system) cfg.systemInstruction = system;
  if (json) cfg.generationConfig.responseMimeType = "application/json";
  return getGenerativeModel(ai, cfg);
}
function order() { return good ? [good] : MODELS; }

// history: [{role:"user"|"model", text}]; onPart(textSoFar) streaming ke liye
export async function chat(system, history, onPart) {
  if (!ai) throw lastError || new Error("AI shuru nahi hua");
  var contents = history.map(function (m) { return { role: m.role, parts: [{ text: m.text }] }; }), err = null;
  for (var name of order()) {
    try {
      var res = await model(name, system, false).generateContentStream({ contents: contents }), full = "";
      for await (var ch of res.stream) { full += ch.text(); onPart && onPart(full); }
      if (!full.trim()) throw new Error("khaali jawab");
      good = name; lastError = null; return full.trim();
    } catch (e) { err = e; }
  }
  lastError = err; throw err;
}

export async function json(system, prompt) {
  if (!ai) throw lastError || new Error("AI shuru nahi hua");
  var err = null;
  for (var name of order()) {
    try {
      var r = await model(name, system, true).generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
      var t = r.response.text().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      good = name; lastError = null; return JSON.parse(t);
    } catch (e) { err = e; }
  }
  lastError = err; throw err;
}
