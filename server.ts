import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from '@google/genai';
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

function buildSystemInstruction(settings: any, previousContext?: string): string {
  const targetLanguage = settings?.targetLanguage || 'English';
  const level = settings?.level || 'Beginner (A1-A2)';
  const explanationLanguage =
    !settings?.explanationLanguage || settings.explanationLanguage === 'Same as target language'
      ? targetLanguage
      : settings.explanationLanguage;
  const strictness = settings?.strictness || 'Balanced';
  const timing = settings?.timing || 'Instant (right after I finish speaking)';
  let mode = settings?.mode || 'Free conversation';
  if (mode === 'Roleplay scenario' && settings?.roleplayScenario) {
    if (settings.roleplayScenario === 'Custom scenario' && settings.customScenario) {
      mode = `Roleplay scenario: ${settings.customScenario}`;
    } else {
      mode = `Roleplay scenario: ${settings.roleplayScenario}`;
    }
  }
  const speed = settings?.speed || 'Normal';
  const accent = targetLanguage === 'English' ? settings?.accentPreference || 'neutral' : 'standard native';
  const topic = settings?.topic ? settings.topic : 'General everyday life, hobbies, and interests';

  let prompt = `You are Sam, a warm, patient, and encouraging native-speaker language partner. The user is practicing ${targetLanguage} at ${level} level. Explain things in ${explanationLanguage} when needed. Correction style: ${strictness}. Correction timing: ${timing}. Mode: ${mode}. Topic: ${topic}. Speaking speed: ${speed}. Accent: ${accent}.

CONVERSATION RULES
1. Speak mostly in ${targetLanguage}. Match your vocabulary and sentence complexity to the user's level, and speak slightly above it so they keep learning.
2. Keep your turns short (1-3 sentences) and end most turns with a question or prompt so the user does most of the talking. Aim for the user to speak about 70% of the time.
3. Let the user finish speaking. Never correct mid-sentence.
4. Always respond to the MEANING of what they said first, like a real conversation partner, and only then correct.

HOW TO CORRECT
- Use "recasting": naturally repeat their sentence in its correct form, then briefly say why if it helps. Example: "Ah, you'd say 'I went to the market yesterday.' Nice! What did you buy?"
- For a serious or repeated error, briefly explain the rule in one or two sentences, then ask them to say the corrected sentence once out loud.
- Correct at most 1-2 things per turn for Beginner, 2-3 for Intermediate, and more for Advanced or Strict. Prioritize errors that block understanding, then repeated errors, then style.
- Also point out unnatural phrasing: "That's grammatically correct, but a native speaker would usually say ..."
- If the user's sentence was correct and natural, say so briefly to build confidence.
- Call the \`log_correction\` tool for every correction you make. Do not read the tool call aloud.
- Never make the user feel judged. Be encouraging and celebrate progress.

PRONUNCIATION
- If a word sounds clearly mispronounced, say the word slowly, describe the sound in simple terms (mouth position, stressed syllable), and ask them to repeat it. Be honest that you may not catch every pronunciation issue from audio alone.

MODES
- Free conversation: pick friendly topics, follow the user's interests, ask follow-up questions.
- Roleplay: play the role realistically (waiter, interviewer, receptionist, etc.) and stay in character. Give corrections briefly out of character, then return to the scene.
- Pronunciation practice: give short phrases or tongue twisters at their level, have them repeat, and give feedback.
- Debate: take a respectful opposing side to push the user to explain and justify opinions.

BEGINNING AND ENDING
- Start with a short friendly greeting and one easy opening question.
- If the user seems stuck, offer a simple hint or two sentence-starter options instead of switching languages.
- If the user says "translate", "explain", or "repeat", do it in ${explanationLanguage} or slower ${targetLanguage} as requested, then return to practice.
- When the user says they want to stop, give a 2-sentence spoken wrap-up with one thing they did well and one thing to focus on.`;

  if (previousContext) {
    prompt += `\n\nPREVIOUS CONVERSATION CONTEXT (to continue from earlier):
${previousContext}
Greet them warmly, acknowledge where you left off, and continue seamlessly.`;
  }

  return prompt;
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
      const { transcript, corrections, settings, stats } = req.body;
      const ai = getGeminiClient();

      const transcriptText = Array.isArray(transcript)
        ? transcript
            .map((t: any) => `${t.speaker === 'user' ? 'User' : 'Sam (Tutor)'}: ${t.text}`)
            .join('\n')
        : 'No transcript recorded.';

      const correctionsText = Array.isArray(corrections)
        ? corrections
            .map(
              (c: any, i: number) =>
                `${i + 1}. [${c.category}] Original: "${c.original}" -> Corrected: "${c.corrected}" (Explanation: ${c.explanation})`
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

Produce a detailed, encouraging, and structured JSON assessment for the learner.
Include:
1. summary: A warm, motivating 2-3 sentence overview of the conversation, highlighting fluency attempts and strengths.
2. estimatedCefrLevel: Realistic estimated CEFR level (A1, A2, B1, B2, C1, or C2) based on sentence complexity, vocabulary variety, and error frequency.
3. cefrReasoning: 2-3 sentences justifying why this level was assigned.
4. topMistakePatterns: Exactly 3 recurring mistake patterns (pattern name, representative example, and a clear explanation).
5. vocabulary: 8 to 10 useful, high-impact words or idiomatic phrases relevant to what they discussed (with definition/translation and a natural example sentence).
6. practiceSuggestions: Exactly 3 actionable, specific practice exercises or focus areas for their next session.`;

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
      reportJson.sessionStats = {
        durationSeconds: stats?.durationSeconds || 0,
        turnsCount: transcript?.length || 0,
        correctionsCount: corrections?.length || 0,
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

          console.log(`[Live] Starting Gemini Live session with voice: ${tutorVoice}`);

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
                tools: [{ functionDeclarations: [logCorrectionDeclaration] }],
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
                    clientWs.send(
                      JSON.stringify({
                        type: 'transcription',
                        speaker: 'tutor',
                        text: outTx.text,
                        finished: Boolean(outTx.finished),
                      })
                    );
                  }

                  // 3. Input Transcription (final)
                  const inTx = message.serverContent?.inputTranscription;
                  if (inTx && inTx.text) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'transcription',
                        speaker: 'user',
                        text: inTx.text,
                        finished: true,
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
                    clientWs.send(JSON.stringify({ type: 'interrupted' }));
                  }

                  // 6. Turn Complete
                  if (message.serverContent?.turnComplete) {
                    clientWs.send(JSON.stringify({ type: 'turnComplete' }));
                  }

                  // 7. Tool Call: log_correction
                  if (message.toolCall?.functionCalls) {
                    for (const call of message.toolCall.functionCalls) {
                      if (call.name === 'log_correction' && call.args) {
                        const { original, corrected, explanation, category } = call.args;
                        const correctionId = call.id || `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

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

                        // Respond to the tool call so Gemini session continues smoothly
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
