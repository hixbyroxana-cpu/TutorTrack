import { Lesson, Student, Target } from "../db/store";
import { getFirebaseIdToken } from "../db/firebase";

export interface ExtractedLog {
  progress: string;
  topicsCovered: string;
  nextSteps: string;
  newTargets: string[];
}

type AiAction =
  | "focusSuggestion"
  | "revisionStarter"
  | "monthlyReport"
  | "voiceLog"
  | "voiceTarget";

async function requestAi<T>(action: AiAction, payload: unknown): Promise<T> {
  const idToken = await getFirebaseIdToken();
  if (!idToken) {
    throw new Error("AI features need Firebase auth to be configured.");
  }

  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "The AI request failed.");
  }

  return data.result as T;
}

export async function generateFocusSuggestion(student: Student, lessons: Lesson[], targets: Target[]) {
  if (lessons.length === 0) return null;
  return requestAi<string>("focusSuggestion", { student, lessons, targets });
}

export async function generateRevisionStarter(student: Student, lessons: Lesson[]) {
  if (lessons.length === 0) return null;
  return requestAi<string>("revisionStarter", { student, lessons });
}

export async function generateMonthlyReport(student: Student, lessons: Lesson[], targets: Target[]) {
  return requestAi<string>("monthlyReport", { student, lessons, targets });
}

export async function processVoiceLog(audioBase64: string, mimeType: string): Promise<ExtractedLog> {
  return requestAi<ExtractedLog>("voiceLog", { audioBase64, mimeType });
}

export async function processVoiceTarget(audioBase64: string, mimeType: string): Promise<string> {
  return requestAi<string>("voiceTarget", { audioBase64, mimeType });
}
