import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, FunctionDeclaration, EndSensitivity } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const logCorrectionDeclaration: FunctionDeclaration = {
  name: 'log_correction',
  description:
    'Log a language correction whenever you correct the user\'s mistakes or suggest a more natural native phrasing. Call this silently; do not read the tool call aloud.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      original: {
        type: Type.STRING,
        description: 'What the user said (with the mistake).',
      },
      corrected: {
        type: Type.STRING,
        description: 'The natural, corrected native speaker version.',
      },
      explanation: {
        type: Type.STRING,
        description: 'One short sentence explaining why or providing the grammar/vocabulary tip.',
      },
      category: {
        type: Type.STRING,
        description: 'The category of the correction.',
        enum: [
          'grammar',
          'vocabulary',
          'word_choice',
          'pronunciation',
          'fluency',
          'politeness_register',
        ],
      },
    },
    required: ['original', 'corrected', 'explanation', 'category'],
  },
};

const logNativeUpgradeDeclaration: FunctionDeclaration = {
  name: 'log_native_upgrade',
  description:
    'Log a spoken "Say it like a native" upgrade when you suggest a more natural, idiomatic native phrasing. Call this silently; do not read the tool call aloud.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      original: {
        type: Type.STRING,
        description: 'What the user said.',
      },
      native_version: {
        type: Type.STRING,
        description: 'The natural, idiomatic native speaker phrasing.',
      },
      why_it_sounds_more_native: {
        type: Type.STRING,
        description: 'A short sentence explaining why it sounds more natural (collocation, register, rhythm, or phrasal verb).',
      },
      register: {
        type: Type.STRING,
        description: 'The stylistic register of the native phrasing.',
        enum: ['casual', 'neutral', 'formal'],
      },
    },
    required: ['original', 'native_version', 'why_it_sounds_more_native', 'register'],
  },
};

function buildSystemInstruction(settings: any, previousContext?: string): string {
  const targetLanguage = settings?.targetLanguage || 'English';
  const level = settings?.level || 'Intermediate (B1-B2)';
  const explanationLanguage =
    !settings?.explanationLanguage || settings.explanationLanguage === 'Same as target language'
      ? targetLanguage
      : settings.explanationLanguage;
  let mode = settings?.mode || 'Free conversation';
  if (mode === 'Roleplay scenario' && settings?.roleplayScenario) {
    if (settings.roleplayScenario === 'Custom scenario' && settings.customScenario) {
      mode = `Roleplay scenario: ${settings.customScenario}`;
    } else {
      mode = `Roleplay scenario: ${settings.roleplayScenario}`;
    }
  }
  const speed = settings?.speed || 'Normal';
  const accent = targetLanguage === 'English' ? settings?.accentPreference || 'American' : 'standard native';
  const topic = settings?.topic ? settings.topic : 'General everyday life, hobbies, and interests';
  const nativeUpgradeSetting = settings?.nativeUpgrade || 'When useful';

  let prompt = `You are Sam, a friendly, relaxed native speaker who enjoys chatting. You are NOT a robotic tutor or a quiz machine. Sound like a real person on a call with a friend who is learning your language.

CURRENT PRACTICE CONTEXT:
- Target Language: ${targetLanguage} (speak primarily in ${targetLanguage})
- Learner's Level: ${level}
- Explanation Language: ${explanationLanguage} (only for direct grammar or translation requests)
- Conversation Mode: ${mode}
- Topic: ${topic}
- Native Upgrade Mode: ${nativeUpgradeSetting}
- Spoken Pace: ${speed}. Accent: ${accent}

SPEAKING STYLE
- Use natural spoken language: contractions, everyday phrasing, and short sentences. Avoid stiff, textbook, or formal wording unless I ask for it.
- Show real reactions to what I say ("Oh wow, really?", "Ha, that sounds fun", "Hmm, tough one"). React to the content first, like a person would.
- Use fillers and backchannels sparingly and naturally ("hmm", "right", "oh nice", "yeah"). Never overdo them.
- Vary how you start sentences and how you praise. Do not repeat "Great job!" or "Good try!" every turn. Sometimes say nothing about how I did and just continue the chat.
- Match my energy: more relaxed if I'm relaxed, more encouraging if I sound unsure.
- Share tiny bits about yourself or your opinions now and then so it feels like a real conversation, and keep the focus on me.
- Never list things, never say "As an AI", and never announce what you are about to do ("Now I will correct you").
- Keep your spoken turns short (1-3 sentences) and end most turns with an engaging conversational question so I speak 70% of the time.

FEEDBACK SHOULD FEEL LIKE A FRIEND, NOT A TEMPLATE
- Do not use the same script every time. Work feedback into the flow, in different ways:
  "Oh, people would usually say 'I'm running late' there. Anyway, what happened next?"
  "Small thing: it's 'I have been here since Monday'. Sounds more natural that way. So how was the trip?"
  "That works, but a native would probably go with '...'. Try it once?"
- Give feedback on at most one thing per turn in casual conversation, and skip it entirely if the chat is flowing well and the mistake is minor.
- In "When useful" mode, give a native-sounding upgrade at most every second or third turn. In "Every turn" mode, keep each upgrade to a single short sentence.
- Keep any spoken correction or upgrade under about 8 seconds, then go straight back to the conversation with a question.

PAUSES
- If I pause, hesitate, or say fillers, wait patiently. Never finish my sentence for me. Answer only when I have clearly finished my thought.`;

  if (previousContext) {
    prompt += `\n\nPREVIOUS CONVERSATION CONTEXT (to continue from earlier):
${previousContext}
Greet them warmly, acknowledge where you left off, and continue smoothly.`;
  }

  return prompt;
}

/**
 * Fast background evaluation using a separate lightweight text model (gemini-3.8-flash)
 * Generates JSON for correction and native-version cards without ever blocking the voice stream.
 */
async function evaluateTurnInBackground(
  userText: string,
  tutorText: string,
  settings: any,
  clientWs: WebSocket
) {
  if (!userText || userText.trim().length < 2) return;
  try {
    const targetLanguage = settings?.targetLanguage || 'English';
    const level = settings?.level || 'Intermediate (B1-B2)';
    const nativeUpgradeSetting = settings?.nativeUpgrade || 'When useful';
    const strictness = settings?.strictness || 'Balanced';
    const ai = getGeminiClient();

    const prompt = `You are an expert language coach evaluating a single conversational turn.
Target language: ${targetLanguage}
Learner CEFR level: ${level}
Correction Strictness: ${strictness}
Native Upgrade Preference: ${nativeUpgradeSetting}

User said: "${userText}"
Tutor replied: "${tutorText}"

Tasks:
1. "correction": Check if the user made a genuine language error (grammar, preposition, vocabulary, tense, or word order).
   - If error exists and warrants feedback for level ${level} and strictness ${strictness}: provide { "original": string, "corrected": string, "explanation": string, "category": "grammar" | "vocabulary" | "word_choice" | "pronunciation" | "fluency" | "politeness_register" }.
   - If the sentence is fine, acceptable, or too minor, return null.
2. "native_upgrade": If Native Upgrade Preference is NOT 'Off', check if there is an authentic, natural native phrasing (idiom, natural collocation, phrasal verb, or conversational rhythm) that sounds distinctly more natural than what the user said.
   - If yes: provide { "original": string, "native_version": string, "why_it_sounds_more_native": string, "register": "casual" | "neutral" | "formal" }.
   - If the user's sentence already sounds completely native and natural, return null.

Respond ONLY with valid JSON in this exact structure:
{
  "correction": { "original": string, "corrected": string, "explanation": string, "category": string } | null,
  "native_upgrade": { "original": string, "native_version": string, "why_it_sounds_more_native": string, "register": string } | null
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const rawJson = response.text?.trim();
    if (!rawJson) return;
    const parsed = JSON.parse(rawJson);

    if (parsed.correction && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'correction',
          correction: {
            id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            original: parsed.correction.original || userText,
            corrected: parsed.correction.corrected,
            explanation: parsed.correction.explanation,
            category: parsed.correction.category || 'grammar',
            timestamp: Date.now(),
          },
        })
      );
    }

    if (
      parsed.native_upgrade &&
      nativeUpgradeSetting !== 'Off' &&
      clientWs.readyState === WebSocket.OPEN
    ) {
      clientWs.send(
        JSON.stringify({
          type: 'native_upgrade',
          upgrade: {
            id: `nu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            original: parsed.native_upgrade.original || userText,
            native_version: parsed.native_upgrade.native_version,
            why_it_sounds_more_native: parsed.native_upgrade.why_it_sounds_more_native,
            register: parsed.native_upgrade.register || 'casual',
            timestamp: Date.now(),
          },
        })
      );
    }
  } catch (err) {
    console.warn('[Background Eval] Card analysis error (non-fatal, voice unaffected):', err);
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // End of session report generation
  app.post('/api/generate-report', async (req, res) => {
    try {
      const { transcript, corrections, nativeUpgrades, settings, stats } = req.body;
      const ai = getGeminiClient();

      const transcriptText = Array.isArray(transcript)
        ? transcript
            .map((t: any) => `${t.speaker === 'user' ? 'User' : 'Sam (Tutor)'}: ${t.text}`)
            .join('\n')
        : 'No transcript recorded.';

      const correctionsText = Array.isArray(corrections) && corrections.length > 0
        ? corrections
            .map(
              (c: any, i: number) =>
                `${i + 1}. [${c.category}] Original: "${c.original}" -> Corrected: "${c.corrected}" (Explanation: ${c.explanation})`
            )
            .join('\n')
        : 'None logged.';

      const nativeUpgradesText = Array.isArray(nativeUpgrades) && nativeUpgrades.length > 0
        ? nativeUpgrades
            .map(
              (u: any, i: number) =>
                `${i + 1}. [${u.register || 'casual'}] User said: "${u.original}" -> Native: "${u.native_version}" (Why: ${u.why_it_sounds_more_native})`
            )
            .join('\n')
        : 'None logged.';

      const targetLanguage = settings?.targetLanguage || 'English';
      const prompt = `You are an expert language evaluator and CEFR assessor. Analyze the following spoken language session between a language learner and their native tutor Sam.

PRACTICED LANGUAGE: ${targetLanguage}
STUDENT INTENDED LEVEL: ${settings?.level || 'Beginner'}
MODE: ${settings?.mode || 'Free conversation'}

CONVERSATION TRANSCRIPT:
${transcriptText}

LOGGED CORRECTIONS:
${correctionsText}

LOGGED NATIVE PHRASES / UPGRADES:
${nativeUpgradesText}

Produce a detailed, encouraging, and structured JSON assessment for the learner.
Include:
1. summary: A warm, motivating 2-3 sentence overview of the conversation, highlighting fluency attempts and strengths.
2. estimatedCefrLevel: Realistic estimated CEFR level (A1, A2, B1, B2, C1, or C2) based on sentence complexity, vocabulary variety, and error frequency.
3. cefrReasoning: 2-3 sentences justifying why this level was assigned.
4. topMistakePatterns: Exactly 3 recurring mistake patterns (pattern name, representative example, and a clear explanation).
5. vocabulary: 8 to 10 useful, high-impact words or idiomatic phrases relevant to what they discussed (with definition/translation and a natural example sentence).
6. practiceSuggestions: Exactly 3 actionable, specific practice exercises or focus areas for their next session.
7. nativePhrases: List of native upgrades and natural alternative phrases highlighted during the session with original phrase, nativeVersion, short explanation, and register (casual, neutral, formal).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              estimatedCefrLevel: { type: Type.STRING },
              cefrReasoning: { type: Type.STRING },
              topMistakePatterns: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pattern: { type: Type.STRING },
                    example: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['pattern', 'example', 'explanation'],
                },
              },
              vocabulary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    translationOrDefinition: { type: Type.STRING },
                    exampleSentence: { type: Type.STRING },
                  },
                  required: ['term', 'translationOrDefinition', 'exampleSentence'],
                },
              },
              practiceSuggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              nativePhrases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    nativeVersion: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    register: { type: Type.STRING },
                  },
                  required: ['original', 'nativeVersion', 'explanation'],
                },
              },
            },
            required: [
              'summary',
              'estimatedCefrLevel',
              'cefrReasoning',
              'topMistakePatterns',
              'vocabulary',
              'practiceSuggestions',
            ],
          },
        },
      });

      const reportJson = JSON.parse(response.text || '{}');

      // Guarantee any logged native upgrades from the session are included in the report
      if (Array.isArray(nativeUpgrades) && nativeUpgrades.length > 0) {
        const existingMap = new Set(
          (reportJson.nativePhrases || []).map((p: any) => (p.original || '').toLowerCase().trim())
        );
        const mappedFromSession = nativeUpgrades.map((u: any) => ({
          original: u.original,
          nativeVersion: u.native_version,
          explanation: u.why_it_sounds_more_native,
          register: u.register || 'casual',
        }));
        reportJson.nativePhrases = [
          ...mappedFromSession,
          ...(reportJson.nativePhrases || []).filter(
            (p: any) => !existingMap.has((p.original || '').toLowerCase().trim())
          ),
        ];
      }

      reportJson.sessionStats = {
        durationSeconds: stats?.durationSeconds || 0,
        turnsCount: transcript?.length || 0,
        correctionsCount: corrections?.length || 0,
        nativeUpgradesCount: Array.isArray(nativeUpgrades) ? nativeUpgrades.length : 0,
        targetLanguage,
      };

      res.json(reportJson);
    } catch (err: any) {
      console.error('Error generating session report:', err);
      res.status(500).json({
        error: 'Failed to generate report',
        message: err.message || 'Unknown error',
      });
    }
  });

  // WebSocket Server for Gemini Live streaming
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: any = null;
    let isLiveSessionReady = false;
    let isClosing = false;

    console.log('[Live] Client connected to /live');

    clientWs.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());

        if (payload.type === 'setup') {
          const { settings, previousContext } = payload;
          const ai = getGeminiClient();
          const tutorVoice = settings?.tutorVoice || 'Zephyr';
          const systemInstruction = buildSystemInstruction(settings, previousContext);

          // Configure Voice Activity Detection (VAD) & Turn-Taking
          const turnTakingMode = settings?.turnTakingMode || 'auto';
          const pausePatience = settings?.pausePatience || 'Natural';

          let silenceDurationMs = 1200; // default Natural (~1.2s)
          if (pausePatience === 'Quick') {
            silenceDurationMs = 700; // ~700ms
          } else if (pausePatience === 'Patient') {
            silenceDurationMs = 1800; // ~1.8s
          } else if (pausePatience === 'Very patient') {
            silenceDurationMs = 2500; // ~2.5s
          }

          const realtimeInputConfig =
            turnTakingMode === 'manual'
              ? {
                  automaticActivityDetection: {
                    disabled: true,
                  },
                }
              : {
                  automaticActivityDetection: {
                    disabled: false,
                    endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                    silenceDurationMs,
                    prefixPaddingMs: 200,
                  },
                };

          console.log(
            `[Live] Starting Gemini Live session (Voice: ${tutorVoice}, Mode: ${turnTakingMode}, Silence: ${silenceDurationMs}ms, Affective: true, ZeroThinkingBudget)`
          );

          // Track spoken utterances per turn for async background card generation
          let turnUserUtterance = '';
          let turnTutorUtterance = '';

          try {
            liveSession = await ai.live.connect({
              model: 'gemini-3.8-live',
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: tutorVoice },
                  },
                },
                systemInstruction,
                realtimeInputConfig,
                enableAffectiveDialog: true,
                thinkingConfig: { thinkingBudget: 0 },
                outputAudioTranscription: {},
                inputAudioTranscription: {},
              },
              callbacks: {
                onopen: () => {
                  isLiveSessionReady = true;
                  console.log('[Live] Gemini Live session established');
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'ready' }));
                  }
                },
                onmessage: (message: any) => {
                  if (clientWs.readyState !== WebSocket.OPEN) return;

                  // 1. Audio output
                  const parts = message.serverContent?.modelTurn?.parts;
                  if (Array.isArray(parts)) {
                    for (const part of parts) {
                      if (part.inlineData?.data) {
                        clientWs.send(
                          JSON.stringify({
                            type: 'audio',
                            data: part.inlineData.data,
                          })
                        );
                      }
                      if (part.text) {
                        turnTutorUtterance += (turnTutorUtterance ? ' ' : '') + part.text;
                        clientWs.send(
                          JSON.stringify({
                            type: 'transcription',
                            speaker: 'tutor',
                            text: part.text,
                            finished: false,
                          })
                        );
                      }
                    }
                  }

                  // 2. Output Transcription
                  const outTx = message.serverContent?.outputTranscription;
                  if (outTx && outTx.text) {
                    turnTutorUtterance += (turnTutorUtterance ? ' ' : '') + outTx.text;
                    clientWs.send(
                      JSON.stringify({
                        type: 'transcription',
                        speaker: 'tutor',
                        text: outTx.text,
                        finished: Boolean(outTx.finished),
                      })
                    );
                  }

                  // 3. Input Transcription (final user utterance)
                  const inTx = message.serverContent?.inputTranscription;
                  if (inTx && inTx.text) {
                    turnUserUtterance += (turnUserUtterance ? ' ' : '') + inTx.text;
                    clientWs.send(
                      JSON.stringify({
                        type: 'transcription',
                        speaker: 'user',
                        text: inTx.text,
                        finished: true,
                      })
                    );
                    // Signal user turn completed so client can start latency measurement
                    clientWs.send(
                      JSON.stringify({
                        type: 'user_turn_ended',
                        timestamp: Date.now(),
                      })
                    );
                  }

                  // 4. Interim Input Transcription (while user speaks)
                  const interimInTx = message.serverContent?.interimInputTranscription;
                  if (interimInTx && interimInTx.text) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'transcription',
                        speaker: 'user',
                        text: interimInTx.text,
                        finished: false,
                      })
                    );
                  }

                  // 5. Interrupted signal (barge-in)
                  if (message.serverContent?.interrupted) {
                    turnTutorUtterance = '';
                    clientWs.send(JSON.stringify({ type: 'interrupted' }));
                  }

                  // 6. Turn Complete: trigger asynchronous card generation in background
                  if (message.serverContent?.turnComplete) {
                    clientWs.send(JSON.stringify({ type: 'turnComplete' }));

                    if (turnUserUtterance.trim().length > 1) {
                      const userTextToEval = turnUserUtterance.trim();
                      const tutorTextToEval = turnTutorUtterance.trim();
                      turnUserUtterance = '';
                      turnTutorUtterance = '';
                      // Evaluates completely off the audio loop without blocking tutor speech
                      evaluateTurnInBackground(userTextToEval, tutorTextToEval, settings, clientWs);
                    }
                  }

                  // 7. Tool Calls: log_correction and log_native_upgrade (fallback compatibility)
                  if (message.toolCall?.functionCalls) {
                    for (const call of message.toolCall.functionCalls) {
                      if (call.name === 'log_correction' && call.args) {
                        const { original, corrected, explanation, category } = call.args;
                        const correctionId =
                          call.id || `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

                        clientWs.send(
                          JSON.stringify({
                            type: 'correction',
                            correction: {
                              id: correctionId,
                              original,
                              corrected,
                              explanation,
                              category: category || 'grammar',
                              timestamp: Date.now(),
                            },
                          })
                        );

                        try {
                          liveSession?.sendToolResponse({
                            functionResponses: [
                              {
                                id: call.id,
                                name: call.name,
                                response: { output: { logged: true } },
                              },
                            ],
                          });
                        } catch (toolRespErr) {
                          console.warn('[Live] Could not send tool response:', toolRespErr);
                        }
                      } else if (call.name === 'log_native_upgrade' && call.args) {
                        const { original, native_version, why_it_sounds_more_native, register } =
                          call.args;
                        const upgradeId =
                          call.id || `nu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

                        clientWs.send(
                          JSON.stringify({
                            type: 'native_upgrade',
                            upgrade: {
                              id: upgradeId,
                              original,
                              native_version,
                              why_it_sounds_more_native,
                              register: register || 'casual',
                              timestamp: Date.now(),
                            },
                          })
                        );

                        try {
                          liveSession?.sendToolResponse({
                            functionResponses: [
                              {
                                id: call.id,
                                name: call.name,
                                response: { output: { logged: true } },
                              },
                            ],
                          });
                        } catch (toolRespErr) {
                          console.warn('[Live] Could not send tool response:', toolRespErr);
                        }
                      }
                    }
                  }
                },
                onerror: (err: any) => {
                  console.error('[Live] Gemini session error:', err);
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'error',
                        message: err?.message || 'Error from language model session',
                      })
                    );
                  }
                },
                onclose: () => {
                  console.log('[Live] Gemini Live session closed');
                  if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'session_closed' }));
                  }
                },
              },
            });

            isLiveSessionReady = true;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'ready' }));
            }
          } catch (liveErr: any) {
            console.error('[Live] Failed to connect to Gemini Live:', liveErr);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message:
                    liveErr?.message ||
                    'Failed to initialize Live voice session. Please verify your Gemini API key in Settings.',
                })
              );
            }
          }
        } else if (payload.type === 'audio') {
          if (liveSession && payload.data) {
            liveSession.sendRealtimeInput({
              audio: {
                data: payload.data,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          }
        } else if (payload.type === 'activity_start') {
          // Manual turn-taking: start of user speech
          if (liveSession) {
            try {
              liveSession.sendRealtimeInput({ activityStart: {} });
            } catch (actErr) {
              console.warn('[Live] Error sending activityStart:', actErr);
            }
          }
        } else if (payload.type === 'activity_end') {
          // Manual turn-taking: end of user speech
          if (liveSession) {
            try {
              liveSession.sendRealtimeInput({ activityEnd: {} });
              liveSession.sendClientContent({ turnComplete: true });
            } catch (actErr) {
              console.warn('[Live] Error sending activityEnd:', actErr);
            }
          }
        } else if (payload.type === 'end') {
          isClosing = true;
          try {
            liveSession?.close();
          } catch {}
          liveSession = null;
        }
      } catch (err: any) {
        console.error('[Live] Client message handling error:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('[Live] Client disconnected');
      isClosing = true;
      try {
        liveSession?.close();
      } catch {}
      liveSession = null;
    });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`FluentPal server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
