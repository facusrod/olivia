'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, MessageSquareMore } from 'lucide-react';
import ChatSidebar from '@/components/ChatSidebar';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessageWithText = async (messageText: string) => {
    if (!messageText.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Placeholder del mensaje assistant que se irá llenando con el stream
    const assistantPlaceholder: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          conversationId,
          includeContext: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Error al enviar mensaje');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.chunk) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: last.content + data.chunk };
                return updated;
              });
            } else if (data.done) {
              if (!conversationId && data.conversationId) {
                setConversationId(data.conversationId);
              }
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch {
            // chunk malformado, ignorar
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessageWithText(input);
  };

  const quickQuestions = [
    '¿Qué productos Keto tenemos?',
    'Productos veganos disponibles',
    '¿Qué productos tienen bajo stock?',
    'Productos más vendidos este mes',
  ];

  // Cargar una conversación existente
  const loadConversation = async (convId: string) => {
    try {
      setLoadingConversation(true);
      const response = await fetch(`/api/conversations/${convId}`);
      if (!response.ok) throw new Error('Error al cargar conversación');

      const data = await response.json();

      // Convertir mensajes del formato de BD al formato local
      const loadedMessages: Message[] = data.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));

      setMessages(loadedMessages);
      setConversationId(convId);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar la conversación');
    } finally {
      setLoadingConversation(false);
    }
  };

  // Crear un nuevo chat (limpiar todo)
  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen bg-gray-50">
      {/* Sidebar */}
      <ChatSidebar
        currentConversationId={conversationId}
        onSelectConversation={loadConversation}
        onNewChat={handleNewChat}
        mobileOpen={chatSidebarOpen}
        onMobileClose={() => setChatSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile chat header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200">
          <button
            onClick={() => setChatSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Ver conversaciones"
          >
            <MessageSquareMore className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {conversationId ? 'Conversación' : 'Nuevo Chat'}
          </h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {loadingConversation ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 md:py-12">
            <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-primary-100 rounded-full mb-4">
              <Sparkles className="w-7 h-7 md:w-8 md:h-8 text-primary-600" />
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
              ¡Hola! Soy OlivIA
            </h2>
            <p className="text-sm md:text-base text-gray-600 mb-6 max-w-md mx-auto px-4">
              Estoy aquí para ayudarte con información sobre productos, inventario y
              sugerencias de compra. Pregúntame lo que necesites.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 max-w-2xl mx-auto px-2">
              {quickQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessageWithText(question)}
                  disabled={loading}
                  className="px-3 md:px-4 py-2.5 md:py-3 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm text-left hover:border-primary-300 hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {question}
                </button>
              ))}
            </div>
            </div>
          ) : (
            <>
              {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <MarkdownRenderer content={message.content} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  <p
                    className={`text-xs mt-1 ${
                      message.role === 'user'
                        ? 'text-primary-200'
                        : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-900 border border-gray-200 rounded-2xl px-4 py-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
        </div>

        {/* Input */}
        <div className="bg-gray-50 p-3 md:p-4">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto">
          <div className="flex gap-2 md:gap-3 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-lg bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 text-sm md:text-base"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-4 md:px-6 py-2.5 md:py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
