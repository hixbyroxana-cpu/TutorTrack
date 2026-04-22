import { GoogleGenAI, Type } from "@google/genai";
import { Student, Lesson, Target } from "../db/store";

export async function generateFocusSuggestion(student: Student, lessons: Lesson[], targets: Target[]) {
  if (lessons.length === 0) return null;
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const activeTargets = targets.filter(t => t.status === 'active').map(t => t.title);
  
  const context = `
  Student Name: ${student.name}
  Age: ${student.age}
  Level: ${student.level}
  
  Recent Lessons (Progress & Topics):
  ${lessons.slice(0, 3).map(l => `- ${l.topicsCovered} | ${l.progress}`).join('\n')}
  
  Current Active Targets (Struggles/Goals we are working on):
  ${activeTargets.length > 0 ? activeTargets.map(t => `- ${t}`).join('\n') : "None logged yet."}
  
  Based on the previous lessons and specifically the Active Targets above, suggest the primary focus for the NEXT single lesson.
  CRITICAL CONSTRAINTS:
  1. STRICT MAXIMUM: You must suggest a MAXIMUM of 2 specific micro-topics or activities for the entire lesson. 
  (For example: "mastering 6 times tables" is ONE thing. "6, 7, and 8 times tables + counting in 3s and 5s" is FOUR things and is STRICTLY PROHIBITED. Do not cram lists of topics.)
  2. A single session cannot fit too much. It is much better to focus deeply on 1 specific struggle area or target, rather than glossing over multiple concepts.
  3. Synthesize a brief, actionable focus that tackles 1 or 2 key items MAXIMUM from the Active Targets list or recent trajectory.
  4. Keep it to a maximum of 3 sentences. Be direct, no preambles.
  `;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: context,
  });
  
  return response.text;
}

export async function generateRevisionStarter(student: Student, lessons: Lesson[]) {
  if (lessons.length === 0) return null;
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const context = `
  Student Name: ${student.name}
  Age: ${student.age}
  Level: ${student.level}
  Curriculum: ${student.curriculum}
  
  Recent Lessons:
  ${lessons.slice(0, 3).map(l => `Topics Covered: ${l.topicsCovered}
  Observations/Progress: ${l.progress}`).join('\n\n')}
  
  Based strictly on the progress and topics covered in the preceding lessons, create a brief, 5-minute warm-up or "revision starter" activity to begin the NEXT session.
  
  CRITICAL CONSTRAINTS: 
  1. This will be shown DIRECTLY to the student on a whiteboard/screen layout. 
  2. Format it cleanly using Markdown.
  3. You MUST use bullet points or numbered lists for the questions/tasks. Do NOT output a dense block of text.
  4. If your starter involves ANY Math equations, formulas, or symbols, you MUST use standard LaTeX formatting enclosed in $ for inline equations (e.g., $x^2 + y^2 = r^2$) or $$ for block equations, so it renders correctly on screen.
  5. Keep it concise, engaging, and directly actionable for the student. Give them the actual question to solve!
  `;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: context,
  });
  
  return response.text;
}

export async function generateMonthlyReport(student: Student, lessons: Lesson[], targets: Target[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const context = `
  Student Name: ${student.name}
  Age/Level: ${student.age} / ${student.level}
  Curriculum/Goal: ${student.curriculum}
  
  Recent Lessons from this period:
  ${lessons.map(l => `- ${new Date(l.date).toLocaleDateString()}: Covered: ${l.topicsCovered}. Progress: ${l.progress}`).join('\n')}
  
  Targets (Areas of struggle / Core Focus Areas):
  Active/Pending Targets:
  ${targets.filter(t => t.status === 'active').map(t => `- ${t.title}`).join('\n') || "None currently."}
  
  Covered/Completed Targets:
  ${targets.filter(t => t.status === 'completed').map(t => `- ${t.title}`).join('\n') || "None currently."}
  
  Write a professional and encouraging "Monthly Progress Report".
  CRITICAL constraints for addressing this report:
  It must be written in a versatile way so it makes sense both if a parent is reading it OR if the student themselves hired the tutor and is reading it directly.
  Do NOT specifically address "Dear Parent". Just address it neutrally or directly regarding the student's progress. Use phrasing like: "Here is a brief report of what we have covered this month during the math lessons with ${student.name}."
  
  It should include:
  1. A warm opening.
  2. "What We Covered": A summary of the topics covered this month.
  3. "Targets Discussed & Achieved": Discuss targets they struggled with that we are currently addressing, and highlight the ones they successfully passed.
  4. "Focus for Next Month": A brief preview of what we plan to cover next month based on their active targets and progress.
  5. A concise, encouraging closing.
  
  CRITICAL SIGNATURE: You MUST sign off the end of the report exactly like this:
  Best regards,  
  Roxana Scurtu
  
  Make it read like a polished letter or structured log (use markdown formatting).
  `;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: context,
  });
  
  return response.text;
}

export interface ExtractedLog {
  progress: string;
  topicsCovered: string;
  nextSteps: string;
  newTargets: string[];
}

export async function processVoiceLog(audioBase64: string, mimeType: string): Promise<ExtractedLog> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType
        }
      },
      {
        text: "You are an assistant for a private tutor. The tutor has provided an audio log outlining the recent session. Extract 'progress', 'topicsCovered', 'nextSteps', and ANY specific struggles or 'newTargets' the tutor mentions we need to focus on next. Rephrase and clean up their speech to make the logs concise. If anything is omitted, provide empty strings or empty arrays."
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          progress: { type: Type.STRING, description: "Overall progress or performance in the session." },
          topicsCovered: { type: Type.STRING, description: "Specific topics or skills covered." },
          nextSteps: { type: Type.STRING, description: "Homework or planned next steps for the next session." },
          newTargets: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific struggles or targeted goals the student needs to work on that were mentioned in the audio log." }
        },
        required: ["progress", "topicsCovered", "nextSteps", "newTargets"]
      }
    }
  });

  const parsed = JSON.parse(response.text.trim());
  return parsed as ExtractedLog;
}

export async function processVoiceTarget(audioBase64: string, mimeType: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType
        }
      },
      {
        text: "You are an assistant for a private tutor. The tutor has provided an audio snippet specifying a new target or struggle area for a student. Extract the core target description in a concise, actionable format (e.g., 'Factoring polynomials', 'Struggles with negative signs', 'Mastering the quadratic formula'). Keep it entirely plain text, no markdown, very brief."
      }
    ]
  });

  return response.text.trim();
}
