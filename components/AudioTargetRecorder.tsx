import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { processVoiceTarget } from '@/src/ai/assistant';

interface AudioTargetRecorderProps {
  onTargetExtracted: (targetTitle: string) => void;
}

export function AudioTargetRecorder({ onTargetExtracted }: AudioTargetRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;
            // Extract just the b64 string
            const base64String = base64data.split(',')[1];
            const targetTitle = await processVoiceTarget(base64String, mimeType);
            onTargetExtracted(targetTitle);
          } catch (error) {
            console.error('Failed to process voice target', error);
          } finally {
            setIsProcessing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
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
        <p className="text-sm font-medium text-slate-500 animate-pulse">Transcribing with AI...</p>
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
            className="w-16 h-16 rounded-full border-2 border-indigo-600 flex items-center justify-center bg-white hover:bg-indigo-50 transition-colors mb-3 shadow-none"
            onClick={startRecording}
          >
            <Mic className="w-6 h-6 text-indigo-600" />
          </Button>
          <div className="text-center">
            <h3 className="font-bold text-slate-900 text-sm">Record Target</h3>
            <p className="text-xs text-slate-500 mt-1">Tap to speak the target.</p>
          </div>
        </>
      ) : (
        <>
          <div className="relative mb-3">
            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
            <Button
              size="lg"
              variant="destructive"
              className="w-16 h-16 rounded-full shadow-none relative z-10 hover:scale-105 transition-transform"
              onClick={stopRecording}
            >
              <Square className="w-6 h-6 fill-current" />
            </Button>
          </div>
          <div className="text-center">
            <h3 className="font-bold text-red-500 text-sm animate-pulse">Recording...</h3>
            <p className="text-xs text-slate-500 mt-1">Tap to stop.</p>
          </div>
        </>
      )}
    </div>
  );
}
