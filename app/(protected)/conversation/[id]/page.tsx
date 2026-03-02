'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Send, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ConversationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const router = useRouter();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (params.id) {
      loadConversation(params.id as string);
    }
  }, [params.id]);

  const loadConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`);
      if (!response.ok) throw new Error('Error al cargar conversación');

      const data = await response.json();
      setConversationId(id);
      setMessages(
        data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }))
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar la conversación');
      router.push('/chat');
    } finally {
      setLoadingConversation(false);
    }
  };

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

      if (!response.ok) {
        throw new Error('Error al enviar mensaje');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content:
          'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessageWithText(input);
  };

  if (loadingConversation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/chat')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conversación</h1>
            <p className="text-sm text-gray-600 mt-1">
              Continúa tu conversación con OlivIA
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-900 border border-gray-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
      </div>

      {/* Input */}
      <div className="bg-gray-50 p-4">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              className="flex-1 px-4 py-3 rounded-lg bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
  );
}