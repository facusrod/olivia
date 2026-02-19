'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Trash2, Loader2, Clock, Search, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string;
}

interface ChatSidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  onConversationsChange?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function ChatSidebar({
  currentConversationId,
  onSelectConversation,
  onNewChat,
  onConversationsChange,
  mobileOpen = false,
  onMobileClose,
}: ChatSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (!response.ok) throw new Error('Error al cargar conversaciones');

      const data = await response.json();
      setConversations(data.conversations);
      onConversationsChange?.();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar esta conversación?')) return;

    try {
      const response = await fetch(`/api/conversations?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Error al eliminar');

      setConversations((prev) => prev.filter((c) => c.id !== id));

      // Si eliminamos la conversación actual, crear un nuevo chat
      if (id === currentConversationId) {
        onNewChat();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar la conversación');
    }
  };

  const handleSelectConversation = (convId: string) => {
    onSelectConversation(convId);
    onMobileClose?.();
  };

  const handleNewChat = () => {
    onNewChat();
    onMobileClose?.();
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sidebarContent = (
    <>
      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar"
            className="w-full pl-10 pr-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {/* New Chat Button - Styled as list item */}
            <button
              onClick={handleNewChat}
              className="w-full group relative p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 text-left"
            >
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    New Chat
                  </h4>
                  <p className="text-xs text-gray-500 truncate">
                    Iniciar una nueva conversación
                  </p>
                </div>
              </div>
            </button>

            {/* Show empty state only if no conversations AND no search */}
            {filteredConversations.length === 0 && searchQuery && (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500">
                  No se encontraron conversaciones
                </p>
              </div>
            )}
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                  currentConversationId === conversation.id
                    ? 'bg-primary-50 border border-primary-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    currentConversationId === conversation.id
                      ? 'text-primary-600'
                      : 'text-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-medium truncate mb-1 ${
                      currentConversationId === conversation.id
                        ? 'text-primary-900'
                        : 'text-gray-900'
                    }`}>
                      {conversation.title}
                    </h4>
                    {conversation.lastMessage && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-1">
                        {conversation.lastMessage}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>
                        {formatDistanceToNow(new Date(conversation.updatedAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conversation.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed top-14 left-0 bottom-0 z-40 w-80 max-w-[85vw] bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 text-sm">Conversaciones</h3>
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-80 bg-white border-r border-gray-200 flex-col h-full">
        {sidebarContent}
      </div>
    </>
  );
}
