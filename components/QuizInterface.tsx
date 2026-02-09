import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ArrowRight, Loader2, MessageCircle, RefreshCw, AlertCircle, ArrowLeft, Settings, Play } from 'lucide-react';
import { QuizQuestion, QuizResult, QuizSessionState } from '../types';
import { generateQuiz, gradeTextAnswer } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface QuizInterfaceProps {
  memory: string;
  onDiscuss: (topic: string) => void;
  onComplete: () => void;
  quizState: QuizSessionState;
  setQuizState: React.Dispatch<React.SetStateAction<QuizSessionState>>;
}

const QuizInterface: React.FC<QuizInterfaceProps> = ({ 
  memory, 
  onDiscuss, 
  onComplete,
  quizState,
  setQuizState
}) => {
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Local state for configuration
  const [configCount, setConfigCount] = useState(5);

  const startQuizGeneration = async () => {
    setLoading(true);
    setError(null);
    try {
      const generated = await generateQuiz("Current Learning Topic", memory, configCount);
      setQuizState(prev => ({
        ...prev,
        questions: generated,
        currentIndex: 0,
        results: [],
        isComplete: false,
        currentTextDraft: ''
      }));
    } catch (err: any) {
      if (err.message === 'NOT_ENOUGH_DATA') {
        setError("We don't have enough context yet to create a meaningful quiz. Please chat more with the Oracle first.");
      } else {
        setError("Failed to generate quiz questions. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMCQSubmit = (option: string) => {
    const currentQ = quizState.questions[quizState.currentIndex];
    const isCorrect = option === currentQ.correctAnswer;
    
    const result: QuizResult = {
      questionId: currentQ.id,
      userAnswer: option,
      isCorrect
    };

    setQuizState(prev => ({
      ...prev,
      results: [...prev.results, result]
    }));
    setShowExplanation(true);
  };

  const handleTextSubmit = async () => {
    if (!quizState.currentTextDraft.trim()) return;
    setGrading(true);
    const currentQ = quizState.questions[quizState.currentIndex];
    
    try {
      const grade = await gradeTextAnswer(currentQ.question, quizState.currentTextDraft, currentQ.explanation);
      const result: QuizResult = {
        questionId: currentQ.id,
        userAnswer: quizState.currentTextDraft,
        isCorrect: grade.isCorrect,
        feedback: grade.feedback
      };
      
      setQuizState(prev => ({
        ...prev,
        results: [...prev.results, result],
        currentTextDraft: '' // clear draft after submit
      }));
      setShowExplanation(true);
    } catch (e) {
       setQuizState(prev => ({
        ...prev,
        results: [...prev.results, { questionId: currentQ.id, userAnswer: prev.currentTextDraft, isCorrect: false, feedback: "Error grading." }]
      }));
       setShowExplanation(true);
    } finally {
      setGrading(false);
    }
  };

  const updateTextDraft = (text: string) => {
    setQuizState(prev => ({ ...prev, currentTextDraft: text }));
  };

  const nextQuestion = () => {
    if (quizState.currentIndex < quizState.questions.length - 1) {
      setQuizState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        currentTextDraft: ''
      }));
      setShowExplanation(false);
    } else {
      setQuizState(prev => ({ ...prev, isComplete: true }));
    }
  };

  const handleRestartQuiz = () => {
      setError(null);
      setQuizState({
          questions: [],
          results: [],
          currentIndex: 0,
          isComplete: false,
          currentTextDraft: ''
      });
      setShowExplanation(false);
  };

  const handleDiscuss = () => {
    const currentQ = quizState.questions[quizState.currentIndex];
    onDiscuss(`I was confused about this quiz question: "${currentQ.question}". Can you help explain?`);
  };

  // Header Component
  const QuizHeader = () => (
    <header className="bg-white dark:bg-slate-900 shadow-sm p-4 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <button onClick={onComplete} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl text-slate-800 dark:text-slate-100">Mastery Check</h2>
        </div>
    </header>
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        <QuizHeader />
        <div className="flex-1 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <h3 className="text-xl font-semibold">Generating Mastery Check...</h3>
            <p className="text-slate-500 dark:text-slate-400">Tailoring questions to your progress.</p>
        </div>
      </div>
    );
  }

  // Configuration Screen (Initial State)
  if (quizState.questions.length === 0 && !error) {
      return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            <QuizHeader />
            <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
                            <Settings className="w-8 h-8" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-center text-slate-800 dark:text-slate-100 mb-2">Quiz Setup</h3>
                    <p className="text-center text-slate-600 dark:text-slate-400 mb-8">
                        Configure your mastery check. The AI will generate questions based on your recent discussions.
                    </p>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Number of Questions
                            </label>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    value={configCount} 
                                    onChange={(e) => setConfigCount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="font-mono text-lg font-bold text-indigo-600 dark:text-indigo-400 w-8 text-center">
                                    {configCount}
                                </span>
                            </div>
                        </div>

                        <button 
                            onClick={startQuizGeneration}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition-all transform hover:scale-[1.02]"
                        >
                            <Play className="w-5 h-5 fill-current" />
                            Start Quiz
                        </button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  if (error) {
     return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            <QuizHeader />
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Quiz Generation Paused</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">{error}</p>
                <button onClick={onComplete} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
                    Return to Chat
                </button>
            </div>
        </div>
     )
  }

  if (quizState.isComplete) {
    const score = quizState.results.filter(r => r.isCorrect).length;
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        <QuizHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg w-full text-center border border-slate-100 dark:border-slate-800">
            <GraduationIcon className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Session Complete</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">You scored {score} out of {quizState.questions.length}</p>
            
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 mb-8">
                <div 
                className="bg-indigo-600 dark:bg-indigo-500 h-4 rounded-full transition-all duration-1000" 
                style={{ width: `${(score / quizState.questions.length) * 100}%` }}
                ></div>
            </div>

            <div className="grid gap-4">
                <button onClick={onComplete} className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition">
                Back to Learning
                </button>
                <button onClick={handleRestartQuiz} className="w-full border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Generate New Quiz
                </button>
            </div>
            </div>
        </div>
      </div>
    );
  }

  if (quizState.questions.length === 0) return null;

  const currentQ = quizState.questions[quizState.currentIndex];
  const currentResult = quizState.results.find(r => r.questionId === currentQ.id);

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      <QuizHeader />
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Question {quizState.currentIndex + 1} / {quizState.questions.length}
            </span>
            <span className="text-sm text-indigo-600 dark:text-indigo-400 font-bold">Learning Oracle Quiz</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
            <div className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-100 mb-6 prose dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {currentQ.question}
                </ReactMarkdown>
            </div>

            {!showExplanation ? (
                <div className="space-y-4">
                {currentQ.type === 'MCQ' && currentQ.options?.map((opt, idx) => (
                    <button
                    key={idx}
                    onClick={() => handleMCQSubmit(opt)}
                    className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all flex items-center group"
                    >
                    <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full mr-4 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 font-bold">
                        {String.fromCharCode(65 + idx)}
                    </span>
                    <div className="text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white prose dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</ReactMarkdown>
                    </div>
                    </button>
                ))}

                {currentQ.type === 'TEXT' && (
                    <div className="space-y-4">
                    <textarea
                        value={quizState.currentTextDraft}
                        onChange={(e) => updateTextDraft(e.target.value)}
                        placeholder="Type your explanation here..."
                        className="w-full p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[120px]"
                    />
                    <button
                        onClick={handleTextSubmit}
                        disabled={grading || !quizState.currentTextDraft.trim()}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {grading ? <Loader2 className="animate-spin w-4 h-4"/> : "Submit Answer"}
                    </button>
                    </div>
                )}
                </div>
            ) : (
                <div className={`rounded-xl p-6 ${currentResult?.isCorrect ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800'}`}>
                <div className="flex items-center gap-3 mb-4">
                    {currentResult?.isCorrect ? (
                    <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    )}
                    <span className={`font-bold ${currentResult?.isCorrect ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
                    {currentResult?.isCorrect ? 'Correct!' : 'Incorrect'}
                    </span>
                </div>
                
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 mb-4">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {currentQ.explanation}
                    </ReactMarkdown>
                    {currentResult?.feedback && (
                    <div className="mt-2 p-3 bg-white/50 dark:bg-black/20 rounded border border-black/5 dark:border-white/10 italic">
                        Feedback: {currentResult.feedback}
                    </div>
                    )}
                </div>

                <div className="flex gap-3 mt-6">
                    {!currentResult?.isCorrect && (
                    <button 
                        onClick={handleDiscuss}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium transition"
                    >
                        <MessageCircle className="w-4 h-4" />
                        Discuss with Oracle
                    </button>
                    )}
                    <button
                    onClick={nextQuestion}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 text-sm font-medium ml-auto transition"
                    >
                    {quizState.currentIndex === quizState.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                    <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
                </div>
            )}
            </div>
        </div>
      </div>
    </div>
  );
};

// Simple Icon component for the completion screen
const GraduationIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

export default QuizInterface;