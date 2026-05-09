import { GoogleGenAI, Type } from "@google/genai";

const TEXT_MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash"];
const REPORT_MODEL_CANDIDATES = ["gemini-2.5-pro", "gemini-2.5-flash"];
const AUDIO_MODEL_CANDIDATES = ["gemini-2.0-flash", "gemini-2.5-flash"];
const MAX_AUDIO_BASE64_CHARS = 8_000_000;

async function verifyFirebaseIdToken(authorizationHeader: string | undefined) {
  const token = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length)
    : "";
  if (!token) {
    throw new Error("Missing authentication token.");
  }

  const firebaseApiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    throw new Error("Missing FIREBASE_API_KEY server environment variable.");
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });

  if (!response.ok) {
    throw new Error("Invalid authentication token.");
  }

  const data = await response.json();
  if (!Array.isArray(data.users) || data.users.length === 0) {
    throw new Error("Invalid authentication token.");
  }
}

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    throw new Error("Missing GEMINI_API_KEY server environment variable.");
  }
  return key;
}

async function generateWithModelFallback(
  ai: GoogleGenAI,
  models: string[],
  requestFactory: (model: string) => Promise<any>
) {
  let lastError: unknown = null;
  for (const model of models) {
    try {
      return await requestFactory(model);
    } catch (error) {
      lastError = error;
      console.warn(`Gemini request failed for model ${model}, trying fallback model.`, error);
    }
  }
  throw lastError ?? new Error("All Gemini model attempts failed.");
}

function normalizeAudioMimeType(mimeType: string): string {
  return mimeType.split(";")[0]?.trim() || "audio/webm";
}

function parseJsonFromText(rawText: string): unknown {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Model did not return valid JSON.");
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}

function assertAudioPayload(payload: any) {
  if (!payload?.audioBase64 || typeof payload.audioBase64 !== "string") {
    throw new Error("Missing audio payload.");
  }
  if (payload.audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
    throw new Error("Audio recording is too large. Please try a shorter recording.");
  }
}

async function handleAction(action: string, payload: any) {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });

  if (action === "focusSuggestion") {
    const { student, lessons, targets } = payload;
    const activeTargets = targets.filter((t: any) => t.status === "active").map((t: any) => t.title);
    const context = `
Student Name: ${student.name}
Age: ${student.age}
Level: ${student.level}

Recent Lessons (Progress & Topics):
${lessons.slice(0, 3).map((l: any) => `- ${l.topicsCovered} | ${l.progress}`).join("\n")}

Current Active Targets (Struggles/Goals we are working on):
${activeTargets.length > 0 ? activeTargets.map((t: string) => `- ${t}`).join("\n") : "None logged yet."}

Based on the previous lessons and specifically the Active Targets above, suggest the primary focus for the NEXT single lesson.
CRITICAL CONSTRAINTS:
1. STRICT MAXIMUM: You must suggest a MAXIMUM of 2 specific micro-topics or activities for the entire lesson.
2. A single session cannot fit too much. It is much better to focus deeply on 1 specific struggle area or target, rather than glossing over multiple concepts.
3. Synthesize a brief, actionable focus that tackles 1 or 2 key items MAXIMUM from the Active Targets list or recent trajectory.
4. Keep it to a maximum of 3 sentences. Be direct, no preambles.
`;
    const response = await generateWithModelFallback(ai, TEXT_MODEL_CANDIDATES, (model) =>
      ai.models.generateContent({ model, contents: context })
    );
    return response.text;
  }

  if (action === "revisionStarter") {
    const { student, lessons } = payload;
    const context = `
Student Name: ${student.name}
Age: ${student.age}
Level: ${student.level}
Curriculum: ${student.curriculum}

Recent Lessons:
${lessons.slice(0, 3).map((l: any) => `Topics Covered: ${l.topicsCovered}
Observations/Progress: ${l.progress}`).join("\n\n")}

Based strictly on the progress and topics covered in the preceding lessons, create a brief, 5-minute warm-up or "revision starter" activity to begin the NEXT session.

CRITICAL CONSTRAINTS:
1. This will be shown DIRECTLY to the student on a whiteboard/screen layout.
2. Format it cleanly using Markdown.
3. You MUST use bullet points or numbered lists for the questions/tasks. Do NOT output a dense block of text.
4. If your starter involves ANY Math equations, formulas, or symbols, you MUST use standard LaTeX formatting enclosed in $ for inline equations or $$ for block equations.
5. Keep it concise, engaging, and directly actionable for the student. Give them the actual question to solve!
`;
    const response = await generateWithModelFallback(ai, TEXT_MODEL_CANDIDATES, (model) =>
      ai.models.generateContent({ model, contents: context })
    );
    return response.text;
  }

  if (action === "monthlyReport") {
    const { student, lessons, targets } = payload;
    const context = `
Student Name: ${student.name}
Age/Level: ${student.age} / ${student.level}
Curriculum/Goal: ${student.curriculum}

Recent Lessons from this period:
${lessons.map((l: any) => `- ${new Date(l.date).toLocaleDateString()}: Covered: ${l.topicsCovered}. Progress: ${l.progress}`).join("\n")}

Targets (Areas of struggle / Core Focus Areas):
Active/Pending Targets:
${targets.filter((t: any) => t.status === "active").map((t: any) => `- ${t.title}`).join("\n") || "None currently."}

Covered/Completed Targets:
${targets.filter((t: any) => t.status === "completed").map((t: any) => `- ${t.title}`).join("\n") || "None currently."}

Write a professional and encouraging "Monthly Progress Report".
It must be written in a versatile way so it makes sense both if a parent is reading it OR if the student themselves hired the tutor and is reading it directly.
Do NOT specifically address "Dear Parent". Just address it neutrally or directly regarding the student's progress.

It should include a warm opening, What We Covered, Targets Discussed & Achieved, Focus for Next Month, and a concise encouraging closing.

CRITICAL SIGNATURE: You MUST sign off the end of the report exactly like this:
Best regards,
Roxana Scurtu

Make it read like a polished letter or structured log using markdown formatting.
`;
    const response = await generateWithModelFallback(ai, REPORT_MODEL_CANDIDATES, (model) =>
      ai.models.generateContent({ model, contents: context })
    );
    return response.text;
  }

  if (action === "voiceLog") {
    assertAudioPayload(payload);
    const response = await generateWithModelFallback(ai, AUDIO_MODEL_CANDIDATES, (model) =>
      ai.models.generateContent({
        model,
        contents: [
          {
            text: "You are an assistant for a private tutor. The tutor has provided an audio log outlining the recent session. Extract 'progress', 'topicsCovered', 'nextSteps', and ANY specific struggles or 'newTargets' the tutor mentions we need to focus on next. Rephrase and clean up their speech to make the logs concise. If anything is omitted, provide empty strings or empty arrays. Output only JSON."
          },
          {
            inlineData: {
              data: payload.audioBase64,
              mimeType: normalizeAudioMimeType(payload.mimeType || "audio/webm")
            }
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              progress: { type: Type.STRING },
              topicsCovered: { type: Type.STRING },
              nextSteps: { type: Type.STRING },
              newTargets: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["progress", "topicsCovered", "nextSteps", "newTargets"]
          }
        }
      })
    );
    return parseJsonFromText(response.text);
  }

  if (action === "voiceTarget") {
    assertAudioPayload(payload);
    const response = await generateWithModelFallback(ai, AUDIO_MODEL_CANDIDATES, (model) =>
      ai.models.generateContent({
        model,
        contents: [
          {
            text: "You are an assistant for a private tutor. The tutor has provided an audio snippet specifying a new target or struggle area for a student. Extract the core target description in a concise, actionable format. Keep it entirely plain text, no markdown, very brief."
          },
          {
            inlineData: {
              data: payload.audioBase64,
              mimeType: normalizeAudioMimeType(payload.mimeType || "audio/webm")
            }
          }
        ]
      })
    );
    return response.text.trim();
  }

  throw new Error("Unknown AI action.");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await verifyFirebaseIdToken(req.headers?.authorization);
    const { action, payload } = req.body || {};
    const result = await handleAction(action, payload || {});
    res.status(200).json({ result });
  } catch (error) {
    console.error("AI API error", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "AI request failed." });
  }
}
