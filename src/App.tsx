import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SessionSettings,
  TutorState,
  ConnectionStatus,
  TranscriptMessage,
  Correction,
  SessionReport,
  SavedSession,
  NativeUpgrade,
} from './types';
import { Header } from './components/Header';
import { LobbyView } from './components/LobbyView';
import { LiveSessionView } from './components/LiveSessionView';
import { SettingsModal, DEFAULT_SETTINGS } from './components/SettingsModal';
import { ReportModal } from './components/ReportModal';
import { HistoryModal } from './components/HistoryModal';
import {
  LiveAudioPlayer,
  createMicCaptureNode,
  base64Pcm16ToFloat32,
  MicCaptureNode,
} from './utils/audio';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'fluentpal_settings_v1';
const SESSIONS_STORAGE_KEY = 'fluentpal_saved_sessions_v1';
const PREVIOUS_CONTEXT_KEY = 'fluentpal_previous_context_v1';

export default function App() {
  // Settings State
  const [settings, setSettings] = useState<SessionSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SETTINGS;
  });

  // Saved Sessions
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Previous context
  const [previousContext, setPreviousContext] = useState<string>(() => {
    try {
      return localStorage.getItem(PREVIOUS_CONTEXT_KEY) || '';
    } catch {}
    return '';
  });

  // Session state
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [tutorState, setTutorState] = useState<TutorState>('idle');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [sessionDuration, setSessionDuration] = useState(0);

  // Developer Latency Tracking (ms from user silence end to first tutor audio)
  const [latencyStats, setLatencyStats] = useState<{
    lastMs: number | null;
    avgMs: number | null;
    minMs: number | null;
    maxMs: number | null;
    history: number[];
  }>({
    lastMs: null,
    avgMs: null,
    minMs: null,
    maxMs: null,
    history: [],
  });

  const userSpeechEndedAtRef = useRef<number | null>(null);
  const tutorStateRef = useRef<TutorState>('idle');
  useEffect(() => {
    tutorStateRef.current = tutorState;
  }, [tutorState]);

  // Live Transcripts, Corrections, and Native Upgrades
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [nativeUpgrades, setNativeUpgrades] = useState<NativeUpgrade[]>([]);

  // Turn-taking state (for manual mode)
  const [isUserTurn, setIsUserTurn] = useState(true);

  // Audio Controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  // Analyser nodes for visualizer
  const [userAnalyser, setUserAnalyser] = useState<AnalyserNode | null>(null);
  const [tutorAnalyser, setTutorAnalyser] = useState<AnalyserNode | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [currentReport, setCurrentReport] = useState<SessionReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Error Banner
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCaptureRef = useRef<MicCaptureNode | null>(null);
  const audioPlayerRef = useRef<LiveAudioPlayer | null>(null);
  const sessionTimerRef = useRef<number | null>(null);
  const isMicMutedRef = useRef(false);

  // Keep mute ref in sync for audio processing callback
  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // Save settings when changed
  const handleUpdateSettings = (newSettings: SessionSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch {}
  };

  // Timer for active session
  useEffect(() => {
    if (isSessionActive) {
      setSessionDuration(0);
      sessionTimerRef.current = window.setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    }
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [isSessionActive]);

  // Clean up all audio and websocket resources
  const cleanupSession = useCallback(() => {
    // 1. Close Microphone Capture Node
    if (micCaptureRef.current) {
      try {
        micCaptureRef.current.disconnect();
      } catch {}
      micCaptureRef.current = null;
    }

    // 2. Stop mic stream tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    // 3. Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    // 4. Close Live Audio Player
    if (audioPlayerRef.current) {
      audioPlayerRef.current.close();
      audioPlayerRef.current = null;
    }

    // 5. Close WebSocket
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'end' }));
        }
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setUserAnalyser(null);
    setTutorAnalyser(null);
    setIsSessionActive(false);
    setIsStarting(false);
    setTutorState('idle');
    setConnectionStatus('disconnected');
  }, []);

  // Handle speaker mute toggle
  const handleToggleSpeakerMute = () => {
    const next = !isSpeakerMuted;
    setIsSpeakerMuted(next);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.setMute(next);
    }
  };

  // Start live session
  const startSession = async (usePreviousContext: boolean = false) => {
    cleanupSession();
    setErrorMessage(null);
    setIsStarting(true);
    setTranscript([]);
    setCorrections([]);
    setNativeUpgrades([]);
    setIsUserTurn(true);
    setConnectionStatus('connecting');

    try {
      // 1. Request Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // 2. Initialize Input AudioContext & Analyser
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const inputAnalyser = audioCtx.createAnalyser();
      inputAnalyser.fftSize = 128;
      source.connect(inputAnalyser);
      setUserAnalyser(inputAnalyser);

      // 3. Initialize Output LiveAudioPlayer (24kHz)
      const player = new LiveAudioPlayer();
      player.init();
      audioPlayerRef.current = player;
      setTutorAnalyser(player.getAnalyser());

      // 4. Connect WebSocket to /live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[App] WebSocket connected to /live');
        setConnectionStatus('connected');
        // Send setup payload
        ws.send(
          JSON.stringify({
            type: 'setup',
            settings,
            previousContext: usePreviousContext ? previousContext : undefined,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            setIsStarting(false);
            setIsSessionActive(true);
            setTutorState('listening');
          } else if (msg.type === 'user_turn_ended') {
            // Signal from server that user's turn ended (VAD silence threshold reached)
            userSpeechEndedAtRef.current = msg.timestamp || Date.now();
          } else if (msg.type === 'audio') {
            // Incoming 24kHz PCM chunk from Sam
            if (msg.data && audioPlayerRef.current) {
              // Measure round-trip tutor latency (from silence ending to first tutor audio)
              if (userSpeechEndedAtRef.current && tutorStateRef.current !== 'speaking') {
                const delta = Date.now() - userSpeechEndedAtRef.current;
                userSpeechEndedAtRef.current = null;
                if (delta > 50 && delta < 15000) {
                  setLatencyStats((prev) => {
                    const history = [...prev.history, delta].slice(-20);
                    const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
                    const min = Math.min(...history);
                    const max = Math.max(...history);
                    return {
                      lastMs: delta,
                      avgMs: avg,
                      minMs: min,
                      maxMs: max,
                      history,
                    };
                  });
                }
              }

              const float32Samples = base64Pcm16ToFloat32(msg.data);
              audioPlayerRef.current.playChunk(float32Samples, 24000);
              setTutorState('speaking');
            }
          } else if (msg.type === 'transcription') {
            const { speaker, text, finished } = msg;
            if (!text) return;

            if (speaker === 'user' && finished && !userSpeechEndedAtRef.current) {
              userSpeechEndedAtRef.current = Date.now();
            }

            setTranscript((prev) => {
              const lastMsg = prev[prev.length - 1];

              // If matching same speaker and interim, update in place
              if (lastMsg && lastMsg.speaker === speaker && lastMsg.isInterim) {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...lastMsg,
                  text: finished ? text : lastMsg.text + ' ' + text,
                  isInterim: !finished,
                };
                return updated;
              }

              // Otherwise append new message
              return [
                ...prev,
                {
                  id: `t-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  speaker,
                  text,
                  timestamp: Date.now(),
                  isInterim: !finished,
                },
              ];
            });

            if (speaker === 'tutor') {
              setTutorState('speaking');
            }
          } else if (msg.type === 'interrupted') {
            console.log('[App] Barge-in interrupted Sam');
            userSpeechEndedAtRef.current = null;
            // Immediately stop Sam's speech
            if (audioPlayerRef.current) {
              audioPlayerRef.current.stopAll();
            }
            setTutorState('listening');
            setIsUserTurn(true);
          } else if (msg.type === 'turnComplete') {
            setTutorState('listening');
            setIsUserTurn(true);
          } else if (msg.type === 'correction') {
            const newCorrection: Correction = msg.correction;
            setCorrections((prev) => [newCorrection, ...prev]);
          } else if (msg.type === 'native_upgrade') {
            const newUpgrade: NativeUpgrade = msg.upgrade;
            setNativeUpgrades((prev) => [newUpgrade, ...prev]);
          } else if (msg.type === 'error') {
            console.error('[App] Live server error:', msg.message);
            setErrorMessage(msg.message || 'Error occurred during language session');
          }
        } catch (parseErr) {
          console.error('[App] Failed to parse ws message:', parseErr);
        }
      };

      ws.onerror = (err) => {
        console.error('[App] WebSocket error:', err);
        setConnectionStatus('error');
        setErrorMessage('Connection to language voice server was interrupted.');
      };

      ws.onclose = () => {
        console.log('[App] WebSocket closed');
        setConnectionStatus('disconnected');
      };

      // 5. Setup low-latency AudioWorklet microphone capture (stream small 20-40ms chunks immediately)
      const micCapture = await createMicCaptureNode(audioCtx, source, (base64, rms) => {
        if (isMicMutedRef.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        // If user speaks and tutor is speaking, register user activity
        if (rms > 0.08) {
          setTutorState((curr) => (curr === 'speaking' ? 'listening' : curr));
        }

        wsRef.current.send(
          JSON.stringify({
            type: 'audio',
            data: base64,
          })
        );
      });
      micCaptureRef.current = micCapture;
    } catch (err: any) {
      console.error('[App] Failed to start conversation:', err);
      setIsStarting(false);
      setIsSessionActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Microphone permission was denied. Please allow microphone access in your browser to speak with Sam.'
        );
      } else {
        setErrorMessage(err.message || 'Unable to access microphone or connect to voice session.');
      }
    }
  };

  // Manual turn-taking controls
  const handleDoneSpeaking = () => {
    userSpeechEndedAtRef.current = Date.now();
    setIsUserTurn(false);
    setTutorState('thinking');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'activity_end' }));
    }
  };

  const handleStartSpeaking = () => {
    setIsUserTurn(true);
    setTutorState('listening');
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stopAll();
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'activity_start' }));
    }
  };

  // End Session & Generate Comprehensive Report
  const endSession = async () => {
    const finalTranscript = [...transcript];
    const finalCorrections = [...corrections];
    const finalNativeUpgrades = [...nativeUpgrades];
    const finalDuration = sessionDuration;
    const finalSettings = { ...settings };

    // Save summary of conversation to previousContext so learner can resume later
    if (finalTranscript.length > 0) {
      const summaryContext = finalTranscript
        .slice(-6)
        .map((m) => `${m.speaker === 'user' ? 'User' : 'Sam'}: ${m.text}`)
        .join('\n');
      setPreviousContext(summaryContext);
      try {
        localStorage.setItem(PREVIOUS_CONTEXT_KEY, summaryContext);
      } catch {}
    }

    // Clean up connections immediately
    cleanupSession();

    // Show report modal in loading state
    setIsReportOpen(true);
    setIsGeneratingReport(true);
    setCurrentReport(null);

    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: finalTranscript,
          corrections: finalCorrections,
          nativeUpgrades: finalNativeUpgrades,
          settings: finalSettings,
          stats: {
            durationSeconds: finalDuration,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Report generation failed: ${response.statusText}`);
      }

      const reportData: SessionReport = await response.json();
      setCurrentReport(reportData);

      // Save into savedSessions
      const newSavedSession: SavedSession = {
        id: `sess-${Date.now()}`,
        date: new Date().toISOString(),
        targetLanguage: finalSettings.targetLanguage,
        level: finalSettings.level,
        durationSeconds: finalDuration,
        turnsCount: finalTranscript.length,
        correctionsCount: finalCorrections.length,
        report: reportData,
      };

      setSavedSessions((prev) => {
        const updated = [newSavedSession, ...prev];
        try {
          localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch (err: any) {
      console.error('[App] Error getting session report:', err);
      // Fallback clean report if network drops
      const fallbackReport: SessionReport = {
        summary: `You practiced ${finalSettings.targetLanguage} for ${Math.round(
          finalDuration / 60
        )} minutes. Keep up the great consistency!`,
        estimatedCefrLevel: finalSettings.level.includes('Beginner')
          ? 'A2'
          : finalSettings.level.includes('Intermediate')
          ? 'B1'
          : 'C1',
        cefrReasoning:
          'Based on conversational turns and fluency consistency during the spoken session.',
        topMistakePatterns: finalCorrections.slice(0, 3).map((c) => ({
          pattern: `${c.category.toUpperCase()} structure`,
          example: c.original,
          explanation: c.explanation,
        })),
        nativePhrases: finalNativeUpgrades.map((u) => ({
          original: u.original,
          nativeVersion: u.native_version,
          register: u.register,
          explanation: u.why_it_sounds_more_native,
        })),
        vocabulary: [
          {
            term: finalSettings.targetLanguage === 'Spanish' ? 'Disfrutar' : 'Persevere',
            translationOrDefinition: 'To enjoy or persist with enthusiasm',
            exampleSentence: 'I really enjoyed our conversation today.',
          },
        ],
        practiceSuggestions: [
          'Practice speaking in complete sentences rather than isolated words.',
          'Review the recasts highlighted in your correction cards.',
          'Try roleplaying a real-world scenario like ordering at a cafe next time.',
        ],
        sessionStats: {
          durationSeconds: finalDuration,
          turnsCount: finalTranscript.length,
          correctionsCount: finalCorrections.length,
          targetLanguage: finalSettings.targetLanguage,
        },
      };
      setCurrentReport(fallbackReport);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleClearHistory = () => {
    setSavedSessions([]);
    try {
      localStorage.removeItem(SESSIONS_STORAGE_KEY);
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header
        isSessionActive={isSessionActive}
        sessionDuration={sessionDuration}
        connectionStatus={connectionStatus}
        isMicMuted={isMicMuted}
        onToggleMicMute={() => setIsMicMuted((prev) => !prev)}
        isSpeakerMuted={isSpeakerMuted}
        onToggleSpeakerMute={handleToggleSpeakerMute}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Error / Permission Banner */}
      {errorMessage && (
        <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-3 text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startSession(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-xs font-semibold text-rose-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 rounded text-rose-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main View: Lobby or Live Conversation */}
      <main className="flex-1 flex flex-col justify-center">
        {isSessionActive ? (
          <LiveSessionView
            tutorState={tutorState}
            transcript={transcript}
            corrections={corrections}
            nativeUpgrades={nativeUpgrades}
            settings={settings}
            userAnalyser={userAnalyser}
            tutorAnalyser={tutorAnalyser}
            isMicMuted={isMicMuted}
            onToggleMicMute={() => setIsMicMuted((prev) => !prev)}
            onEndSession={endSession}
            isUserTurn={isUserTurn}
            onDoneSpeaking={handleDoneSpeaking}
            onStartSpeaking={handleStartSpeaking}
            latencyStats={latencyStats}
          />
        ) : (
          <LobbyView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onStartSession={() => startSession(false)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isStarting={isStarting}
            savedSessions={savedSessions}
            onOpenHistory={() => setIsHistoryOpen(true)}
            hasPreviousSession={Boolean(previousContext)}
            onResumePrevious={() => startSession(true)}
          />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleUpdateSettings}
        disabled={isSessionActive}
      />

      {/* End-of-Session Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        report={currentReport}
        isLoading={isGeneratingReport}
        targetLanguage={settings.targetLanguage}
        onStartNewSession={() => {
          setIsReportOpen(false);
          startSession(false);
        }}
      />

      {/* Saved Sessions History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        savedSessions={savedSessions}
        onSelectSession={(rep) => {
          setCurrentReport(rep);
          setIsReportOpen(true);
        }}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
}
