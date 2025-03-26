'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaPaperPlane, FaImage, FaSpinner, FaBook, FaSignOutAlt, FaBars, FaTimes, FaTrash, FaLightbulb } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Import KaTeX for LaTeX rendering
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Chat {
  _id: string;
  messages: Message[];
  hintsUsed: number;
  isCompleted: boolean;
}

// Add a type guard function to verify chat objects
const isValidChat = (chat: any): chat is Chat => {
  return chat && 
    typeof chat === 'object' && 
    typeof chat._id === 'string' && 
    Array.isArray(chat.messages);
};

export default function ChatbotPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [pastChats, setPastChats] = useState<Chat[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    } else if (status === 'authenticated') {
      console.log('User authenticated, fetching chats');
      fetchPastChats();
    }
  }, [status, router]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [currentChat?.messages]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch past chats with better error handling and logging
  const fetchPastChats = async () => {
    try {
      console.log("Fetching past chats...");
      const response = await fetch('/api/chats');
      
      if (!response.ok) {
        console.error('Error fetching past chats:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
        return;
      }

      const data = await response.json();
      console.log(`Received ${data.chats?.length || 0} chats from API:`, data);
      
      // Apply more detailed validation of chat data
      const validChats = (data.chats || []).filter((chat: any) => {
        const isValid = isValidChat(chat);
        if (!isValid) {
          console.warn('Filtering out invalid chat:', chat);
        }
        return isValid;
      });
      
      console.log(`Setting ${validChats.length} valid chats to state`);
      setPastChats(validChats);
    } catch (error) {
      console.error('Error fetching past chats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !fileInputRef.current?.files?.[0]) return;

    setIsLoading(true);
    const formData = new FormData();
    
    if (fileInputRef.current?.files?.[0]) {
      formData.append('image', fileInputRef.current.files[0]);
    }
    formData.append('message', message);
    if (currentChat?._id) {
      formData.append('chatId', currentChat._id);
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (isValidChat(data.chat)) {
        setCurrentChat(data.chat);
        if (!currentChat) {
          setPastChats(prev => [...prev, data.chat]);
        }
      } else {
        console.error('Invalid chat data received:', data);
      }
      
      setMessage('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetAnotherHint = async () => {
    if (!currentChat || currentChat.hintsUsed >= 2) return;

    setIsLoading(true);
    try {
      // Use the dedicated hint endpoint
      const response = await fetch(`/api/chat/${currentChat._id}/hint`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error getting hint:', errorData.message || 'Unknown error');
        throw new Error(errorData.message || 'Failed to get another hint');
      }
      
      const data = await response.json();
      
      // Update the current chat with the new data
      if (isValidChat(data.chat)) {
        setCurrentChat(data.chat);
        
        // Update the chat in pastChats list too with proper typing
        setPastChats(prev => 
          prev.map((chat: Chat) => 
            chat._id === data.chat._id ? data.chat : chat
          )
        );
      } else {
        console.error('Invalid chat data received:', data);
      }
    } catch (error) {
      console.error('Error getting hint:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentChat(null);
  };

  const handleLoadChat = (chat: Chat) => {
    setCurrentChat(chat);
    setShowSidebar(false);
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/auth/login');
  };

  // Add a handler to delete a chat
  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the chat selection
    setChatToDelete(chatId);
  };

  // Confirm delete handler
  const confirmDelete = async () => {
    if (!chatToDelete) return;
    
    try {
      const response = await fetch(`/api/chat/${chatToDelete}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }
      
      // Remove chat from state
      setPastChats(pastChats.filter(chat => chat._id !== chatToDelete));
      
      // If the current chat is the one being deleted, reset it
      if (currentChat && currentChat._id === chatToDelete) {
        setCurrentChat(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    } finally {
      setChatToDelete(null); // Close the confirmation dialog
    }
  };

  // Cancel delete handler
  const cancelDelete = () => {
    setChatToDelete(null);
  };

  // Function to process message content and render LaTeX
  const renderMessage = (content: string) => {
    // Create a temporary div to render the content with KaTeX
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    
    try {
      renderMathInElement(tempDiv, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
        ],
        throwOnError: false,
        output: 'html'
      });
    } catch (error) {
      console.error('Error rendering LaTeX:', error);
    }
    
    return { __html: tempDiv.innerHTML };
  };

  // Add a refresh button to manually refresh chats
  const refreshChats = () => {
    if (status === 'authenticated') {
      fetchPastChats();
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FaSpinner className="animate-spin text-4xl text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-md p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <button 
              className="md:hidden mr-2 text-gray-600" 
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? <FaTimes /> : <FaBars />}
            </button>
            <Link href="/" className="flex items-center">
              <FaBook className="text-blue-600 text-2xl mr-2" />
              <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-blue-800 text-transparent bg-clip-text">Homework Helper</span>
            </Link>
          </div>
          
          {/* User Info & Logout */}
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 py-2 px-3 rounded-full hover:bg-blue-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-md">
                {session?.user?.name ? session.user.name[0].toUpperCase() : '?'}
              </div>
              <span className="hidden md:inline text-gray-700">{session?.user?.name || 'User'}</span>
            </button>
            
            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-1 z-10 transform transition-all duration-200 ease-in-out">
                <div className="px-4 py-2 text-sm text-gray-700 border-b">
                  {session?.user?.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                >
                  <FaSignOutAlt className="mr-2 text-blue-600" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content with Sidebar and Chat Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 transform ${showSidebar ? 'translate-x-0' : '-translate-x-full'} w-72 bg-white shadow-lg transition-transform duration-300 ease-in-out mt-16 md:mt-0 md:relative md:translate-x-0 z-10`}>
          <div className="p-4 overflow-y-auto h-full">
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={handleNewChat}
                className="py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg hover:from-blue-600 hover:to-blue-800 transition-colors shadow-md flex-grow flex items-center justify-center"
              >
                <FaPaperPlane className="mr-2" /> New Chat
              </button>
              <button 
                onClick={refreshChats}
                className="ml-2 p-3 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                title="Refresh chats"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <h3 className="text-sm uppercase font-semibold text-gray-500 mb-3 pl-2">Your Conversations</h3>
            
            {pastChats.length === 0 ? (
              <div className="text-center text-gray-500 mt-8 p-4 bg-blue-50 rounded-lg">
                No past chats found. Start a new conversation!
              </div>
            ) : (
              <div className="space-y-2">
                {pastChats.map((chat) => (
                  <div 
                    key={chat._id}
                    className="group relative rounded-lg overflow-hidden hover:bg-blue-50 transition-colors"
                  >
                    <button
                      onClick={() => handleLoadChat(chat)}
                      className={`w-full p-3 text-left flex flex-col ${
                        currentChat && chat._id && currentChat._id === chat._id ? 'bg-blue-100' : ''
                      }`}
                    >
                      <div className="font-medium truncate">
                        {chat && chat.messages && chat.messages.length > 0 
                          ? `${chat.messages[0]?.content?.slice(0, 30) || 'Chat content'}`
                          : 'New Chat'
                        }...
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {chat.hintsUsed} hint{chat.hintsUsed !== 1 ? 's' : ''} used
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleDeleteChat(chat._id, e)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete chat"
                    >
                      <FaTrash className="text-sm" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Chat Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-6"
          >
            {!currentChat && (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <FaBook className="text-5xl text-blue-300 mb-4" />
                <h2 className="text-2xl font-bold text-gray-700 mb-2">Welcome to Homework Helper</h2>
                <p className="text-gray-500 max-w-md mb-6">
                  Ask any homework question to get subtle hints that will guide you to the answer without giving it away.
                </p>
                <p className="text-sm text-gray-400">Type your question below or select a past conversation</p>
              </div>
            )}
            
            {currentChat?.messages?.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-md'
                      : 'bg-white shadow-md text-gray-800 border border-gray-100'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="font-semibold mb-2 flex items-center gap-2 text-blue-600">
                      <FaLightbulb /> Hint:
                    </div>
                  )}
                  {/* Render LaTeX formatted content */}
                  <div 
                    dangerouslySetInnerHTML={renderMessage(msg.content)} 
                    className="math-content prose prose-sm max-w-none" 
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="border-t bg-white p-4 shadow-md">
            {currentChat?.isCompleted ? (
              <div className="text-center p-4">
                <div className="text-gray-600 mb-4">
                  You've used all available hints. Try solving the problem with the provided guidance.
                </div>
                <button
                  onClick={handleNewChat}
                  className="py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg hover:from-blue-600 hover:to-blue-800 transition-colors shadow-md"
                >
                  Ask Another Problem
                </button>
              </div>
            ) : (
              <>
                {currentChat && currentChat.hintsUsed >= 1 ? (
                  <div className="mb-4 flex justify-center">
                    <button
                      onClick={handleGetAnotherHint}
                      disabled={isLoading || currentChat.hintsUsed >= 2}
                      className="py-3 px-6 bg-gradient-to-r from-green-500 to-green-700 text-white rounded-lg hover:from-green-600 hover:to-green-800 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          <span>Getting hint...</span>
                        </>
                      ) : (
                        <>
                          <FaLightbulb />
                          <span>Get Another Hint</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex items-center gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={() => {}} // Add proper handling if needed
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors"
                      title="Upload image"
                    >
                      <FaImage className="text-xl" />
                    </button>
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your homework problem..."
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="p-3 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Send message"
                    >
                      {isLoading ? (
                        <FaSpinner className="animate-spin text-xl" />
                      ) : (
                        <FaPaperPlane className="text-xl" />
                      )}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4 shadow-2xl">
            <h3 className="text-xl font-semibold mb-4">Delete Conversation</h3>
            <p className="mb-6 text-gray-600">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
