import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import QuizInterface from './components/QuizInterface';
import { Message, ChatHistoryItem, ViewState, AppSettings, QuizSessionState } from './types';
import { generateSummaryForExport } from './services/gemini';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import FileSaver from 'file-saver';
import { GraduationCap, Sun, Moon } from 'lucide-react';

const getDefaultMessages = (): Message[] => [{
  id: 'init-1',
  role: 'model',
  content: "Greetings. I am the **Learning Oracle**. I am here to help you master complex topics using the Socratic method.\n\nWhat topic shall we explore today, or do you have a document for us to analyze?",
  timestamp: Date.now()
}];

const getDefaultQuizState = (): QuizSessionState => ({
  questions: [],
  results: [],
  currentIndex: 0,
  isComplete: false,
  currentTextDraft: ''
});

function App() {
  // Session ID logic
  const [sessionId, setSessionId] = useState(() => {
    const saved = sessionStorage.getItem('oracle_active_session_id');
    return saved ? parseInt(saved, 10) : 0;
  });

  const storageKey = `oracle-session-${sessionId}`;

  // Persist Session ID
  useEffect(() => {
    sessionStorage.setItem('oracle_active_session_id', sessionId.toString());
  }, [sessionId]);

  // State Initialization using storageKey
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStorage.getItem(`${storageKey}-messages`);
    return saved ? JSON.parse(saved) : getDefaultMessages();
  });
  
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>(() => {
    const saved = sessionStorage.getItem(`${storageKey}-history`);
    return saved ? JSON.parse(saved) : [];
  });

  const [memory, setMemory] = useState<string>(() => {
    return sessionStorage.getItem(`${storageKey}-memory`) || "User is beginning their learning journey.";
  });

  const [quizState, setQuizState] = useState<QuizSessionState>(() => {
    const saved = sessionStorage.getItem(`${storageKey}-quiz`);
    return saved ? JSON.parse(saved) : getDefaultQuizState();
  });

  const [currentView, setCurrentView] = useState<ViewState>(ViewState.CHAT);
  const [isExporting, setIsExporting] = useState(false);
  const [showQuizRecommend, setShowQuizRecommend] = useState(false);
  const [autoTriggerAI, setAutoTriggerAI] = useState(false);
  
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  // Storage Effects
  useEffect(() => {
    sessionStorage.setItem(`${storageKey}-messages`, JSON.stringify(messages));
  }, [messages, storageKey]);

  useEffect(() => {
    sessionStorage.setItem(`${storageKey}-history`, JSON.stringify(chatHistory));
  }, [chatHistory, storageKey]);

  useEffect(() => {
    sessionStorage.setItem(`${storageKey}-memory`, memory);
  }, [memory, storageKey]);

  useEffect(() => {
    sessionStorage.setItem(`${storageKey}-quiz`, JSON.stringify(quizState));
  }, [quizState, storageKey]);

  // Handle theme class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleNewChat = () => {
    if (window.confirm("Are you sure? This will start a fresh session.")) {
      const nextId = sessionId + 1;
      setSessionId(nextId);

      // Reset local state for the new session
      // The Effects will then save these defaults to the new storage keys
      setMessages(getDefaultMessages());
      setChatHistory([]);
      setMemory("User is beginning a new learning journey.");
      setQuizState(getDefaultQuizState());
      
      setCurrentView(ViewState.CHAT);
      setShowQuizRecommend(false);
      setAutoTriggerAI(false);
    }
  };

  const handleExport = async () => {
    if (messages.length === 0 || memory.length === 0) return;
    setIsExporting(true);
    try {
      const summaryText = await generateSummaryForExport(memory, chatHistory);
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "Learning Oracle - Session Summary",
              heading: HeadingLevel.TITLE,
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({
                  text: summaryText,
                  font: "Calibri",
                  size: 24, // 12pt
                }),
              ],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const save = (FileSaver as any).saveAs || FileSaver;
      save(blob, `Oracle_Summary_${new Date().toISOString().split('T')[0]}.docx`);

    } catch (e: any) {
      if (e.message === 'NOT_ENOUGH_DATA') {
          alert("Not enough conversation data to generate a meaningful summary yet. Keep chatting!");
      } else {
          console.error("Export failed", e);
          alert("Failed to export summary. Please try again.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuizRecommendation = () => {
    setShowQuizRecommend(true);
  };

  const startQuiz = () => {
    if (memory.length < 50 || memory.includes("User is beginning")) {
        alert("I need to understand your knowledge level better before I can generate a quiz. Let's discuss the topic a bit more first.");
        setShowQuizRecommend(false);
        return;
    }
    setCurrentView(ViewState.QUIZ);
    setShowQuizRecommend(false);
  };

  const handleQuizDiscuss = (topicPrompt: string) => {
    setCurrentView(ViewState.CHAT);
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: topicPrompt,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newUserMsg]);
    setMemory(prev => prev + `\n[Context Update]: User struggled with quiz question related to: ${topicPrompt}`);
    setAutoTriggerAI(true);
  };

  return (
    <div className={`flex h-screen bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 ${theme === 'dark' ? 'dark' : ''}`}>
      <Sidebar 
        onNewChat={handleNewChat}
        onExport={handleExport}
        currentView={currentView}
        onViewChange={setCurrentView}
        isExporting={isExporting}
      />
      
      <main className="flex-1 relative flex flex-col min-w-0" key={sessionId}>
        {/* Floating Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
          title="Toggle Theme"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {currentView === ViewState.CHAT ? (
          <>
            <ChatInterface 
              messages={messages}
              setMessages={setMessages}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              memory={memory}
              setMemory={setMemory}
              onQuizRecommend={handleQuizRecommendation}
              autoTrigger={autoTriggerAI}
              onAutoTriggerComplete={() => setAutoTriggerAI(false)}
            />
            {showQuizRecommend && (
              <div className="absolute bottom-24 right-6 animate-bounce-in z-20">
                <div className="bg-indigo-600 dark:bg-indigo-500 text-white p-4 rounded-xl shadow-xl flex flex-col gap-2 max-w-xs ring-1 ring-white/10">
                  <div className="flex items-center gap-2 font-bold">
                    <GraduationCap className="w-5 h-5" />
                    <span>Mastery Check?</span>
                  </div>
                  <p className="text-xs text-indigo-100">You seem to have grasped the recent concepts. Ready to test your knowledge?</p>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={startQuiz}
                      className="bg-white text-indigo-600 px-3 py-1 rounded text-sm font-bold flex-1 hover:bg-indigo-50 transition-colors"
                    >
                      Start Quiz
                    </button>
                    <button 
                      onClick={() => setShowQuizRecommend(false)}
                      className="bg-indigo-700 dark:bg-indigo-600 text-white px-3 py-1 rounded text-sm flex-1 hover:bg-indigo-800 transition-colors"
                    >
                      Later
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <QuizInterface 
            memory={memory}
            onDiscuss={handleQuizDiscuss}
            onComplete={() => setCurrentView(ViewState.CHAT)}
            quizState={quizState}
            setQuizState={setQuizState}
          />
        )}
      </main>
    </div>
  );
}

export default App;