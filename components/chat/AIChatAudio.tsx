import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { logger } from '../../utils/logger';

interface AIChatAudioProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

/**
 * Voice input component using Web Speech API (SpeechRecognition).
 * Free, no API key needed. Works in Chrome/Edge/Safari.
 */
export const AIChatAudio: React.FC<AIChatAudioProps> = ({ onTranscript, disabled }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<number>();

  useEffect(() => {
    // Check if SpeechRecognition is available
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    setIsSupported(!!SpeechRecognition);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = 'es-CO';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      logger.log('aiChatAudio: transcript received', transcript);
      onTranscript(transcript);
      stopListening();
    };

    recognition.onerror = (event: any) => {
      logger.error('aiChatAudio: error', event.error);
      setIsListening(false);
      // If the error is 'not-allowed', the user denied mic permission
      if (event.error === 'not-allowed') {
        // Just silently stop — user denied mic
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);

      // Stop after 10 seconds of silence
      timeoutRef.current = window.setTimeout(() => {
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch {}
        }
        setIsListening(false);
      }, 10000);
    } catch (error) {
      logger.error('aiChatAudio: start error', error);
      setIsListening(false);
    }
  }, [onTranscript, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      title={isListening ? 'Detener grabación' : 'Hablar con voz'}
      className={`p-3 rounded-xl transition-all flex items-center justify-center w-12 h-12 ${
        isListening
          ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse scale-110'
          : 'bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 hover:shadow-lg hover:shadow-emerald-200/20'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {isListening ? (
        <div className="relative">
          <MicOff size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
        </div>
      ) : (
        <Mic size={20} />
      )}
    </button>
  );
};

export default AIChatAudio;
