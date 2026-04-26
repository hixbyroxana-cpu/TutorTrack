import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { processVoiceLog, ExtractedLog } from '@/src/ai/assistant';

interface AudioRecorderProps {
  onLogExtracted: (log: ExtractedLog) => void;
}

export function AudioRecorder({ onLogExtracted }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  };

  const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  };

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('Recorder error', event);
        setErrorMessage('Recording failed. Please try again.');
        setIsRecording(false);
        setIsProcessing(false);
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (chunksRef.current.length === 0 || blob.size === 0) {
          setErrorMessage('No audio captured. Please hold record for at least 1 second and try again.');
          setIsProcessing(false);
          return;
        }
        
        // Convert to base64
        const reader = new FileReader();
        reader.onerror = () => {
          setErrorMessage('Could not read your audio file. Please try again.');
          setIsProcessing(false);
        };
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;
            // Extract just the b64 string
            const base64String = base64data.split(',')[1];
            const log = await withTimeout(
              processVoiceLog(base64String, mimeType),
              20000,
              'AI processing timed out. Please try a shorter recording.'
            );
            onLogExtracted(log);
          } catch (error) {
            console.error('Failed to process voice log', error);
            const details = extractErrorMessage(error);
            setErrorMessage(`AI could not convert this recording. ${details}`);
          } finally {
            setIsProcessing(false);
          }
        };
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      setErrorMessage('Microphone access was blocked. Please allow mic permission and retry.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-slate-200 rounded bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500 animate-pulse">Transcribing and analyzing log with AI...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 border border-slate-200 rounded bg-slate-50">
      {!isRecording ? (
        <>
          <Button
            size="lg"
            variant="outline"
            className="w-20 h-20 rounded-full border-2 border-indigo-600 flex items-center justify-center bg-white hover:bg-indigo-50 transition-colors mb-4 shadow-none"
            onClick={startRecording}
          >
            <Mic className="w-8 h-8 text-indigo-600" />
          </Button>
          <div className="text-center">
            <h3 className="font-bold text-slate-900 text-sm">Record a quick voice log</h3>
            <p className="text-xs text-slate-500 mt-1">Tap the microphone and describe the session.</p>
          </div>
        </>
      ) : (
        <>
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
            <Button
              size="lg"
              variant="destructive"
              className="w-20 h-20 rounded-full shadow-none relative z-10 hover:scale-105 transition-transform"
              onClick={stopRecording}
            >
              <Square className="w-8 h-8 fill-current" />
            </Button>
          </div>
          <div className="text-center">
            <h3 className="font-bold text-red-500 text-sm animate-pulse">Recording...</h3>
            <p className="text-xs text-slate-500 mt-1">Tap to stop and transcribe.</p>
          </div>
        </>
      )}
      {errorMessage && (
        <p className="mt-3 text-xs font-medium text-red-600 text-center">{errorMessage}</p>
      )}
    </div>
  );
}
