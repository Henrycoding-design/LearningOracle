export enum ViewState {
  CHAT = 'CHAT',
  QUIZ = 'QUIZ',
  SETTINGS = 'SETTINGS'
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  fileName?: string;
  isError?: boolean;
}

export interface ChatHistoryItem {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface OracleResponse {
  reply: string;
  memoryUpdate: string;
  suggestQuiz: boolean;
}

export interface QuizQuestion {
  id: number;
  type: 'MCQ' | 'TEXT';
  question: string;
  options?: string[]; // Only for MCQ
  correctAnswer?: string; // For MCQ comparison
  explanation: string;
}

export interface QuizResult {
  questionId: number;
  userAnswer: string;
  isCorrect: boolean;
  feedback?: string;
}

export interface QuizSessionState {
  questions: QuizQuestion[];
  results: QuizResult[];
  currentIndex: number;
  isComplete: boolean;
  currentTextDraft: string; // To save unfinished text answers
}

export interface AppSettings {
  quizCount: number;
}
