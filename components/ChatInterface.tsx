import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { Send, Paperclip, AlertCircle, Loader2, Copy, Check, X } from 'lucide-react';
import { Message, ChatHistoryItem } from '../types';
import { chatWithOracle } from '../services/gemini';
import { extractTextFromFile } from '../services/fileProcessing';

interface ChatInterfaceProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  chatHistory: ChatHistoryItem[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  memory: string;
  setMemory: React.Dispatch<React.SetStateAction<string>>;
  onQuizRecommend: () => void;
  autoTrigger?: boolean;
  onAutoTriggerComplete?: () => void;
}

const extractText = (node: any): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    return extractText((node.props as any).children);
  }
  return '';
};

const CodeBlock = ({ children, className }: any) => {
  const [copied, setCopied] = useState(false);
  const codeText = extractText(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText.normalize("NFC"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if it's an inline code block (no 'language-' class usually)
  const isInline = !className;

  if (isInline) {
    return <code className={`${className} bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-sm text-pink-600 dark:text-pink-400 font-mono`}>{children}</code>;
  }

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="flex justify-between items-center px-4 py-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {className?.replace('language-', '') || 'Code'}
        </span>
        <button
          onClick={handleCopy}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
        </button>
      </div>
      <div className="overflow-x-auto bg-[#0d1117] p-4 text-sm">
        <code className={className}>{children}</code>
      </div>
    </div>
  );
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  setMessages,
  chatHistory,
  setChatHistory,
  memory,
  setMemory,
  onQuizRecommend,
  autoTrigger,
  onAutoTriggerComplete
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle auto-trigger from external actions
  useEffect(() => {
    if (autoTrigger && !isLoading && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'user') {
        processResponse(lastMsg.content, '');
        if (onAutoTriggerComplete) {
            onAutoTriggerComplete();
        }
      }
    }
  }, [autoTrigger, messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const processResponse = async (userText: string, fileText: string) => {
      setIsLoading(true);
      try {
        const response = await chatWithOracle(userText, chatHistory, memory, fileText);
  
        const newAiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: response.reply,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, newAiMsg]);
  
        const newHistoryItemUser: ChatHistoryItem = { role: 'user', parts: [{ text: userText + (fileText ? `\n[File Content]: ${fileText}` : '') }] };
        const newHistoryItemModel: ChatHistoryItem = { role: 'model', parts: [{ text: response.reply }] };
        
        setChatHistory(prev => [...prev, newHistoryItemUser, newHistoryItemModel].slice(-20));
        setMemory(prev => prev + "\n" + response.memoryUpdate);
  
        if (response.suggestQuiz) {
          onQuizRecommend();
        }
  
      } catch (error: any) {
        console.error("Chat Error:", error);
        const errorMsg: Message = {
          id: Date.now().toString(),
          role: 'model',
          content: error.message || "I'm having a little trouble connecting right now. Let's try that again.",
          timestamp: Date.now(),
          isError: true
        };
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const currentInput = input;
    const currentFile = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      timestamp: Date.now(),
      fileName: currentFile?.name
    };

    setMessages(prev => [...prev, newUserMsg]);

    let fileText = '';
    if (currentFile) {
        try {
            fileText = await extractTextFromFile(currentFile);
        } catch (e) {
            console.error("File read error", e);
        }
    }

    await processResponse(currentInput, fileText);
  };

  const handleRetry = async () => {
    let lastUserMsgIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            lastUserMsgIndex = i;
            break;
        }
    }

    if (lastUserMsgIndex === -1) return;
    const lastMsg = messages[lastUserMsgIndex];
    setMessages(prev => prev.slice(0, lastUserMsgIndex + 1));
    await processResponse(lastMsg.content, '');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 relative transition-colors duration-300">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm p-4 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xl text-slate-800 dark:text-slate-100">Learning Session</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
        <div className="max-w-3xl mx-auto w-full space-y-8 pb-48">
            {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 opacity-50">
                <Loader2 className="w-16 h-16 mb-4 animate-spin-slow" />
                <p>Initializing Learning Oracle...</p>
            </div>
            )}
            
            {messages.map((msg) => (
            <div
                key={msg.id}
                className={`flex flex-col w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
                {/* 
                    User: Align right, adaptive width, Purple
                    Model: Align left, full width, White/Dark
                */}
                <div
                className={`rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 ${
                    msg.role === 'user'
                    ? 'max-w-[85%] md:max-w-[75%] w-fit bg-purple-600 text-white rounded-br-none border-transparent'
                    : msg.isError 
                        ? 'w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 rounded-bl-none'
                        : 'w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-bl-none'
                }`}
                >
                {msg.fileName && (
                    <div className={`flex items-center gap-2 mb-3 text-xs p-2 rounded w-fit ${msg.role === 'user' ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 opacity-75'}`}>
                    <Paperclip className="w-3 h-3" />
                    <span>{msg.fileName}</span>
                    </div>
                )}
                <div className={`prose prose-sm md:prose-base max-w-none break-words ${msg.role === 'user' ? 'prose-invert' : 'dark:prose-invert'}`}>
                    <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex, rehypeHighlight]}
                        components={{
                            code: CodeBlock
                        }}
                    >
                        {msg.content}
                    </ReactMarkdown>
                </div>
                {msg.isError && (
                    <button onClick={handleRetry} className="mt-2 text-xs font-bold underline hover:text-red-800 dark:hover:text-red-300">
                    Retry
                    </button>
                )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {msg.role === 'user' ? 'You' : 'Oracle'}
                </span>
            </div>
            ))}
            
            {isLoading && (
            <div className="flex justify-start w-full">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm rounded-bl-none">
                    <div className="flex gap-1">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                    </div>
                </div>
            </div>
            )}
            <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 px-4 pointer-events-none">
        <div className="max-w-4xl mx-auto w-full pointer-events-auto">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl p-2 flex gap-3 items-end transition-all duration-300">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.docx,image/*,.txt"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className={`p-3.5 rounded-full transition-colors shrink-0 ${selectedFile ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                title="Upload File"
            >
                <Paperclip className="w-5 h-5" />
            </button>
            
            <div className="flex-1 relative">
                <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                    }
                }}
                placeholder="Type your response..."
                className="w-full bg-transparent border-0 text-slate-900 dark:text-slate-100 px-2 py-3.5 focus:outline-none resize-none min-h-[50px] max-h-[150px] placeholder:text-slate-400 dark:placeholder:text-slate-500"
                rows={1}
                />
            </div>

            <button
                onClick={handleSendMessage}
                disabled={isLoading || (!input.trim() && !selectedFile)}
                className="p-3.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 shrink-0"
            >
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send className="w-5 h-5" />}
            </button>
            </div>
            {selectedFile && (
            <div className="mt-2 ml-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-2 py-1 rounded-md w-fit shadow-sm">
                <span className="font-semibold">Attached:</span> 
                <span className="max-w-[200px] truncate">{selectedFile.name}</span>
                <button 
                  onClick={handleRemoveFile}
                  className="ml-2 p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-full transition-colors"
                  title="Remove file"
                >
                  <X className="w-3 h-3" />
                </button>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;