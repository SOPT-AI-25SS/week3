import { GoogleGenAI } from "@google/genai";

let singleton: GoogleGenAI | null = null;

/**
 * Returns a singleton instance of GoogleGenAI using the `GOOGLE_API_KEY`
 * environment variable. Throws if the key is missing.
 */
export function getGenaiClient(): GoogleGenAI {
  if (singleton) return singleton;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY environment variable is not set.");
  }

  singleton = new GoogleGenAI({ apiKey });
  return singleton;
}
