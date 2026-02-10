import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ChatHistoryItem, OracleResponse, QuizQuestion } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const MODELS = [
  'gemini-3-flash-preview',
  'gemini-2.5-flask',       // Maps to gemini 2 flask (flash)
  'gemini-2.5-flash-lite'   // Maps to gemini 2 flask lite (flash-lite)
];

const GENERIC_ERROR_MSG = "I'm having a little trouble connecting to my knowledge base right now. Let's try that again in a moment.";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: apiKey });
};

// Helper to manage fallback logic
async function callWithFallback<T>(
  operation: (model: string) => Promise<T>
): Promise<T> {
  let lastError: any;
  for (const model of MODELS) {
    try {
      return await operation(model);
    } catch (error) {
      console.error(`Error with model ${model}:`, error);
      lastError = error;
      // Continue to next model
    }
  }
  throw lastError || new Error("All models failed");
}

export const chatWithOracle = async (
  message: string,
  history: ChatHistoryItem[],
  memory: string,
  fileContent?: string
): Promise<OracleResponse> => {
  const systemInstruction = `
    System Language (FORCED INPUT/OUTPUT LANGUAGE): English

    You are the 'Learning Oracle', a world-class polymath and supportive mentor. 
    Your scope is UNLIMITED: from primary education and competitive exams (IGCSE, SAT, AP, IELTS) to University-level research and professional Industrial practices.

    Your PRIMARY objective is to generate the best possible response for the current user input by intelligently combining:
    - Short-term conversational context (recent dialogue)
    - Long-term student memory (persistent profile)

    Memory exists to SUPPORT reasoning and personalization — never to distract from answer quality.

    CRITICAL FOR MATH & CODE:
    1. **LATEX DELIMITERS:** Strictly use "$$" for block math and "$" for inline math. **Do NOT use "\\[" or "\\("**.
    2. **JSON ESCAPING:** All backslashes in LaTeX must be double-escaped (e.g., use "\\\\frac" so it appears as "\\frac" in the string).
    3. **Markdown:** Code blocks must use standard markdown fences.
    4. **Newlines:** Use literal "\\n" for line breaks within the JSON string.

    Memory Update Rules (CRITICAL):
    - The "reply" is ALWAYS the top priority.
    - Update memory ONLY if new information is:
      • Long-term relevant (weeks/months, not minutes)
      • Useful for future personalization, pacing, or difficulty tuning
      • Stable (identity, level, strengths, weaknesses, goals, ongoing projects)
    - DO NOT store:
      • Temporary confusion
      • One-off questions
      • Step-by-step solutions
      • Raw chat summaries
    - If nothing meaningful should be updated, return the previous memory unchanged.

    STOPPING CRITERIA (DYNAMIC MASTERY) - aka 'suggestQuiz':
    - **IGNORE MESSAGE COUNT:** Do not determine the end of a topic based on how many turns have passed.
    - **CONTENT-BASED TERMINATION:** Evaluate the user's recent responses against the "Student Profile" in memory. If the user demonstrates a synthesis of the concept that matches their target level, set 'suggestQuiz' to true.
    - **NEVER LOOP:** If the user has correctly applied a concept twice, do not ask further clarifying questions; suggest a quiz to progress.

    Your Interaction Framework:
    1. START: If you don't know the user's name, greet them warmly and ask for their name and what they are currently studying or working on.
    2. VALIDATE: Always start by acknowledging the user's input. If they share a thought or answer, tell them exactly what they got right and where the logic might be slipping.
    3. DECIDE:
       - If the student is close to a breakthrough, use the Socratic method (HINTING). Give them a small push to find the answer themselves.
       - If the topic is a new fundamental concept, a complex industrial process, or if the student is clearly frustrated/stuck, EXPLAIN it clearly with high-quality analogies.
    4. PACING: Ask only ONE question at a time. Do not overwhelm the user with multiple questions or a wall of text. Wait for their response before moving to the next part of the dialogue.
    5. TONE: Professional yet highly encouraging. Adapt your vocabulary to the user's level (e.g., simpler for IGCSE, more technical for University/Industrial).
  `;

  const prompt = `
    User Context/Memory: ${memory}
    
    Chat History (Last 10 turns):
    ${JSON.stringify(history)}
    
    Attached File Content: ${fileContent ? fileContent.substring(0, 10000) + '...' : 'None'}
    
    User Input: ${message}
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      reply: { type: Type.STRING, description: "The response to the user." },
      memoryUpdate: { type: Type.STRING, description: "The updated memory string." },
      suggestQuiz: { type: Type.BOOLEAN, description: "True if the user has mastered the concept and is ready for a quiz." }
    },
    required: ["reply", "memoryUpdate", "suggestQuiz"]
  };

  try {
    const ai = getAIClient();
    
    return await callWithFallback(async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
        }
      });
      
      const text = response.text;
      if (!text) throw new Error("Empty response");
      return JSON.parse(text) as OracleResponse;
    });
  } catch (e) {
    console.error("Critical AI Error:", e);
    throw new Error(GENERIC_ERROR_MSG);
  }
};

export const generateQuiz = async (
  topic: string,
  memory: string,
  count: number
): Promise<QuizQuestion[]> => {
  
  // Guard: Too little data
  if (memory.length < 50 || memory.includes("User is beginning")) {
    throw new Error("NOT_ENOUGH_DATA");
  }

  const systemInstruction = `
    Generate a quiz to test the user's mastery of the current topic based on their memory.
    Memory: ${memory}
    Topic Focus: ${topic}
    Generate ${count} questions. Mix of MCQ and Open-ended (TEXT).
    MCQ must have options and a correct answer letter.
    
    CRITICAL:
    - Use LaTeX for any math equations ($$).
    - Ensure questions are challenging but fair based on memory level.
  `;

  const responseSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.INTEGER },
        type: { type: Type.STRING, enum: ["MCQ", "TEXT"] },
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of strings for MCQ options" },
        correctAnswer: { type: Type.STRING, description: "The correct option string for MCQ" },
        explanation: { type: Type.STRING, description: "Detailed explanation of the answer" }
      },
      required: ["id", "type", "question", "explanation"]
    }
  };

  try {
    const ai = getAIClient();
    return await callWithFallback(async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: `Generate ${count} quiz questions.`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
        }
      });
      
      const text = response.text;
      if (!text) throw new Error("Empty quiz response");
      return JSON.parse(text) as QuizQuestion[];
    });
  } catch (e) {
    console.error("Quiz Generation Error:", e);
    throw e; // Re-throw so UI can handle the specific NOT_ENOUGH_DATA error
  }
};

export const gradeTextAnswer = async (
  question: string,
  userAnswer: string,
  context: string
): Promise<{ isCorrect: boolean; feedback: string }> => {
  const prompt = `
    Question: ${question}
    User Answer: ${userAnswer}
    Context/Explanation: ${context}
    
    Grade this answer. Be lenient but accurate.
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      isCorrect: { type: Type.BOOLEAN },
      feedback: { type: Type.STRING }
    },
    required: ["isCorrect", "feedback"]
  };

  try {
    const ai = getAIClient();
    return await callWithFallback(async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema
        }
      });
       const text = response.text;
      if (!text) throw new Error("Empty grading response");
      return JSON.parse(text);
    });
  } catch (e) {
    return { isCorrect: false, feedback: "Unable to grade automatically. Please discuss in chat." };
  }
};

export const generateSummaryForExport = async (
  memory: string,
  history: ChatHistoryItem[]
): Promise<string> => {
  // Guard
  if (history.length < 2) {
    throw new Error("NOT_ENOUGH_DATA");
  }

  const prompt = `
    Based on the following learning session, create a comprehensive, structured summary suitable for a document.
    Include key concepts covered, user struggles, and future learning paths.
    
    Memory: ${memory}
    Recent Discussion: ${JSON.stringify(history)}
  `;

  try {
    const ai = getAIClient();
    return await callWithFallback(async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt
      });
      return response.text || "No summary available.";
    });
  } catch (e) {
    console.error("Summary generation error", e);
    throw e;
  }
};