'use client';

// Add this configuration export at the top of the file
export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaPaperPlane, FaImage, FaSpinner, FaBook, FaSignOutAlt, FaBars, FaTimes, FaTrash, FaLightbulb, FaExternalLinkAlt } from 'react-icons/fa';
import Link from 'next/link';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';
import { createWorker } from 'tesseract.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isResource?: boolean; // Add optional isResource flag
  timestamp?: Date;
}

interface Chat {
  _id: string;
  messages: Message[];
  hintsUsed: number;
  isCompleted: boolean;
  hasResources?: boolean; // Add hasResources property to fix the error
}

interface Resource {
  topic: string;
  links: {
    title: string;
    url: string;
    snippet: string;
  }[];
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
  const messageEndRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
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

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentChat?.messages, isTyping]);

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

    // Immediately add the user message to the UI
    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    
    // Create a temporary chat if none exists
    if (!currentChat) {
      const tempChat: Chat = {
        _id: 'temp-' + Date.now(),
        messages: [userMessage],
        hintsUsed: 0,
        isCompleted: false
      };
      setCurrentChat(tempChat);
    } else {
      // Add to existing chat
      setCurrentChat({
        ...currentChat,
        messages: [...currentChat.messages, userMessage]
      });
    }

    setIsLoading(true);
    const formData = new FormData();
    
    if (fileInputRef.current?.files?.[0]) {
      formData.append('image', fileInputRef.current.files[0]);
    }
    formData.append('message', message);
    if (currentChat?._id && !currentChat._id.startsWith('temp-')) {
      formData.append('chatId', currentChat._id);
    }

    // Clear the input immediately
    setMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (isValidChat(data.chat)) {
        setCurrentChat(data.chat);
        if (!currentChat || currentChat._id.startsWith('temp-')) {
          setPastChats(prev => [...prev, data.chat]);
        }
      } else {
        console.error('Invalid chat data received:', data);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetAnotherHint = async () => {
    if (!currentChat || currentChat.hintsUsed >= 2) return;

    // Add the user's hint request message to the UI immediately
    const hintRequestMessage: Message = {
      role: 'user',
      content: 'I need another hint for this problem.',
      timestamp: new Date()
    };

    // Update the current chat with the user's hint request
    setCurrentChat({
      ...currentChat,
      messages: [...currentChat.messages, hintRequestMessage]
    });

    setIsLoading(true);
    try {
      // Use the dedicated hint endpoint
      const response = await fetch(`/api/chat/${currentChat._id}/hint`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.details || 'Unknown error occurred';
        console.error('Error getting hint:', errorMessage);
        throw new Error(errorMessage || 'Failed to get another hint');
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
      // Show an error message to the user
      alert(`Failed to get a hint: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    // If this is a resources message, just return the HTML
    if (isResourceMessage(content)) {
      return { __html: content };
    }
    
    // Otherwise, use the existing LaTeX rendering logic
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

  const handleImageUpload = async (file: File) => {
    try {
      setIsProcessingImage(true);
      setOcrProgress(0);
      
      // Create worker for OCR
      const worker = await createWorker();

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setOcrProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 500);

      // Perform OCR
      const result = await worker.recognize(file);
      
      // Cleanup
      clearInterval(progressInterval);
      setOcrProgress(100);
      await worker.terminate();

      // Set the OCR text to the message input
      if (result.data.text) {
        setMessage(result.data.text.trim());
      }
      
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setIsProcessingImage(false);
      setOcrProgress(0);
    }
  };

  const handleGetResources = async () => {
    // Only show resources when the chat is completed (all hints used)
    if (!currentChat || !currentChat.isCompleted) return;
    
    // If resources were already fetched before, don't fetch again
    if (currentChat.hasResources) {
      // Find the resource message to display
      const resourceMessage = currentChat.messages.find(msg => 
        msg.role === 'assistant' && msg.isResource
      );
      
      if (resourceMessage) {
        setShowResources(true);
        return; // Resources already exist, no need to fetch again
      }
    }
    
    try {
      setIsLoadingResources(true);
      
      // Get the chat content to analyze - use all messages for better context
      const content = currentChat.messages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join(' ');
      
      console.log("Fetching resources for content:", content.substring(0, 100) + "...");
      
      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Resources API error:", errorData);
        throw new Error(errorData.error || 'Failed to fetch resources');
      }
      
      const data = await response.json();
      console.log("Resources received:", data.resources);
      setResources(data.resources || []);
      
      // Add resources as a special message in the chat
      if (data.resources && data.resources.length > 0) {
        // Create a formatted message with the resources
        const resourcesMessage = formatResourcesAsMessage(data.resources);
        
        try {
          // Update the server's chat record to include the resource message with the isResource flag
          const saveResponse = await fetch(`/api/chat/${currentChat._id}/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: 'assistant',
              content: resourcesMessage,
              isResource: true
            }),
          });
          
          if (!saveResponse.ok) {
            console.error("Failed to save resources to chat:", await saveResponse.json());
          } else {
            // Successfully saved, update local state to reflect this
            const updatedChatData = await saveResponse.json();
            if (updatedChatData.chat) {
              setCurrentChat(updatedChatData.chat);
            }
          }
        } catch (saveError) {
          console.error("Error saving resources to chat:", saveError);
        }
        
        // REMOVED: Don't add resources locally since we're already updating from server response
      }
      
    } catch (error) {
      console.error('Error getting resources:', error);
      // Set fallback resources and still add them to chat
      const fallbackResources = [{
        topic: "General Learning Resources",
        links: [
          {
            title: "Khan Academy",
            url: "https://www.khanacademy.org/",
            snippet: "Free online courses, lessons, and practice for students."
          },
          {
            title: "MIT OpenCourseWare",
            url: "https://ocw.mit.edu/",
            snippet: "Access free course materials from MIT."
          }
        ]
      }];
      
      setResources(fallbackResources);
      
      // Add fallback resources through API instead of locally
      try {
        const resourcesMessage = formatResourcesAsMessage(fallbackResources);
        const saveResponse = await fetch(`/api/chat/${currentChat._id}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: 'assistant',
            content: resourcesMessage,
            isResource: true
          }),
        });
        
        if (saveResponse.ok) {
          const updatedChatData = await saveResponse.json();
          if (updatedChatData.chat) {
            setCurrentChat(updatedChatData.chat);
          }
        }
      } catch (fallbackError) {
        console.error("Error saving fallback resources:", fallbackError);
      }
    } finally {
      setIsLoadingResources(false);
      setShowResources(true);
    }
  };

  // Function to format resources as HTML for a chat message with a simpler, more direct format
const formatResourcesAsMessage = (resourceList: Resource[]) => {
  let message = '<div class="resources-container"><h3 class="text-lg font-semibold mb-3">📚 Learning Resources</h3>';
  
  resourceList.forEach(resource => {
    message += `<div class="mb-4">
      <h4 class="font-medium text-blue-600 mb-2">${resource.topic}</h4>
      <div class="space-y-2">`;
    
    resource.links.forEach(link => {
      message += `
        <div class="resource-link-item">
          <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="resource-link flex items-center">
            <span class="resource-icon mr-2">🔗</span>
            <span class="font-medium">${link.title}</span>
          </a>
        </div>`;
    });
    
    message += `</div></div>`;
  });
  
  message += '</div>';
  return message;
};

  // Function to determine if a message contains resources
  const isResourceMessage = (content: string) => {
    return content.includes('resources-container');
  };

  // Add a function to check if the chat already has resources
  const chatHasResources = () => {
    if (currentChat?.hasResources) {
      return true;
    }
    // Fallback check: look through messages for resource messages
    return currentChat?.messages?.some(msg => 
      msg.role === 'assistant' && 
      ((msg as any).isResource || isResourceMessage(msg.content))
    ) || false;
  };

  if (status === "loading") {
    return <div className="p-8">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar - Modern design similar to ChatGPT */}
      <div 
        className={`fixed md:relative inset-y-0 left-0 z-20 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out ${
          showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="flex items-center justify-center w-full gap-2 px-3 py-3 text-sm font-medium text-white transition-colors border border-white/20 rounded-md hover:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New chat
          </button>
        </div>

        {/* Chat History */}
        <div className="px-3 py-2">
          <h3 className="px-2 mb-2 text-xs font-medium text-gray-400 uppercase">Chat History</h3>
          <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
            {pastChats.length === 0 ? (
              <div className="px-2 py-3 text-sm text-gray-400">No conversations yet</div>
            ) : (
              pastChats.map((chat) => (
                <div 
                  key={chat._id}
                  className={`group relative flex items-center p-2 rounded-md cursor-pointer hover:bg-gray-800 ${
                    currentChat && chat._id === currentChat._id ? 'bg-gray-800' : ''
                  }`}
                  onClick={() => handleLoadChat(chat)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {chat && chat.messages && chat.messages.length > 0 
                        ? `${chat.messages[0]?.content?.slice(0, 25) || 'Chat'}`
                        : 'New Chat'
                      }...
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date().toLocaleDateString()} • {chat.hintsUsed}/2 hints
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(chat._id, e)}
                    className="p-1 text-gray-400 rounded-md opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-gray-700"
                    title="Delete chat"
                  >
                    <FaTrash className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* User Profile */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/20">
          <div 
            className="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-gray-800"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 text-white bg-blue-600 rounded-full">
                {session?.user?.name ? session.user.name[0].toUpperCase() : '?'}
              </div>
              <div className="text-sm font-medium text-white truncate">
                {session?.user?.name || 'User'}
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          
          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute bottom-16 left-3 right-3 p-2 bg-gray-800 rounded-md shadow-lg" ref={userMenuRef}>
              <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700">
                {session?.user?.email}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center w-full gap-2 px-3 py-2 text-sm text-white rounded-md hover:bg-gray-700"
              >
                <FaSignOutAlt className="w-4 h-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex flex-col flex-1 overflow-hidden">
        {/* Mobile Header */}
        <header className="flex items-center justify-between p-3 border-b border-gray-200 md:hidden">
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 text-gray-600 rounded-md hover:bg-gray-100"
          >
            {showSidebar ? <FaTimes /> : <FaBars />}
          </button>
          <div className="font-semibold text-blue-600">Homework Helper</div>
          <div className="w-8"></div> {/* Spacer for alignment */}
        </header>

        {/* Chat Messages Area */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto bg-white"
        >
          {!currentChat ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-16 h-16 mb-4 text-blue-600">
                <FaBook className="w-full h-full" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-800">Welcome to Homework Helper</h2>
              <p className="max-w-md mb-6 text-gray-600">
                Ask any homework question to get subtle hints that will guide you to the answer without giving it away.
              </p>
              <p className="text-sm text-gray-500">Type your question below or select a past conversation</p>
            </div>
          ) : (
            <div className="max-w-3xl px-4 py-5 mx-auto">
              {currentChat.messages.map((msg, index) => (
                <div 
                  key={index}
                  className={`flex mb-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Avatar */}
                  <div className={`flex ${msg.role === 'user' ? 'order-2 ml-3' : 'mr-3'}`}>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {msg.role === 'user' ? 'U' : 'A'}
                    </div>
                  </div>
                  
                  {/* Message Content */}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                    {/* Role Label */}
                    <div className={`mb-1 text-xs font-medium ${
                      msg.role === 'user' ? 'text-blue-600 text-right' : 'text-gray-600'
                    }`}>
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    
                    {/* Message Bubble */}
                    <div className={`p-3 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : isResourceMessage(msg.content)
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-gray-100 text-gray-800'
                    }`}>
                      {/* Hint Label */}
                      {msg.role === 'assistant' && !isResourceMessage(msg.content) && (
                        <div className="flex items-center gap-1 mb-2 text-sm font-semibold text-blue-600">
                          <FaLightbulb className="text-amber-500" /> Hint:
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div 
                        dangerouslySetInnerHTML={renderMessage(msg.content)} 
                        className={`${
                          isResourceMessage(msg.content) 
                            ? 'resources-content' 
                            : 'prose prose-sm max-w-none math-content'
                        } ${
                          msg.role === 'user' ? 'text-white prose-invert' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Typing Indicator */}
              {isLoading && (
                <div className="flex mb-6">
                  <div className="flex mr-3">
                    <div className="flex items-center justify-center w-8 h-8 text-gray-700 bg-gray-200 rounded-full">
                      A
                    </div>
                  </div>
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* This div helps with scrolling to the bottom */}
              <div ref={messageEndRef}></div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white">
          <div className="max-w-3xl px-4 py-3 mx-auto">
            {currentChat?.isCompleted ? (
              <div className="text-center p-4">
                <div className="inline-flex items-center p-3 mb-4 text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  You've used all available hints. Try solving the problem with the provided guidance.
                </div>
                <div className="flex flex-row justify-center gap-4 mb-4">
                  {/* Only show the resources button if resources haven't been fetched yet and hints used are 2 */}
                  {currentChat.hintsUsed >= 2 && !chatHasResources() ? (
                    <button
                      onClick={handleGetResources}
                      disabled={isLoadingResources}
                      className="flex items-center gap-2 px-4 py-2 font-medium text-white transition-colors bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {isLoadingResources ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          <span>Finding resources...</span>
                        </>
                      ) : (
                        <>
                          <FaBook />
                          <span>Find Learning Resources</span>
                        </>
                      )}
                    </button>
                  ) : null}
                  <button
                    onClick={handleNewChat}
                    className="flex items-center gap-2 px-4 py-2 font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>New Problem</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {currentChat && currentChat.hintsUsed >= 1 ? (
                  <div className="flex justify-center gap-4 mb-4">
                    <button
                      onClick={handleGetAnotherHint}
                      disabled={isLoading || currentChat.hintsUsed >= 2}
                      className="flex items-center gap-2 px-4 py-2 font-medium text-white transition-colors bg-amber-500 rounded-md hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    
                    {/* Resources button with updated styling */}
                    {currentChat.hintsUsed >= 2 && !chatHasResources() ? (
                      <button
                        onClick={handleGetResources}
                        disabled={isLoadingResources}
                        className="flex items-center gap-2 px-4 py-2 font-medium text-white transition-colors bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoadingResources ? (
                          <>
                            <FaSpinner className="animate-spin" />
                            <span>Finding resources...</span>
                          </>
                        ) : (
                          <>
                            <FaBook />
                            <span>Find Learning Resources</span>
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file);
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-gray-500 transition-colors rounded-md hover:text-blue-600 hover:bg-blue-50 self-end"
                      title="Upload image"
                      disabled={isProcessingImage}
                    >
                      {isProcessingImage ? (
                        <FaSpinner className="w-5 h-5 animate-spin" />
                      ) : (
                        <FaImage className="w-5 h-5" />
                      )}
                    </button>
                    <div className="relative flex-1">
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={isProcessingImage ? "Processing image..." : "Type your homework problem..."}
                        className="w-full py-3 px-4 pr-12 text-gray-700 bg-white border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={1}
                        disabled={isProcessingImage || isLoading}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (message.trim()) handleSubmit(e);
                          }
                        }}
                        style={{ minHeight: '48px', maxHeight: '200px' }}
                      />
                      {isProcessingImage && (
                        <div className="absolute left-0 right-0 bottom-full mb-1 text-xs text-center bg-blue-100 text-blue-700 p-1 rounded">
                          Processing image... {Math.round(ocrProgress)}%
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isLoading || !message.trim()}
                        className="absolute right-3 bottom-1/2 transform translate-y-1/2 p-1.5 text-gray-400 transition-colors rounded-full hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <FaSpinner className="w-5 h-5 animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                          </svg>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
            
            {/* Footer info */}
            <div className="mt-2 text-xs text-center text-gray-500">
              Homework Helper provides hints to guide your learning without giving away answers.
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal - Modern design */}
      {chatToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 m-4 bg-white rounded-lg shadow-2xl">
            <div className="flex items-center mb-4 text-red-500">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <h3 className="text-xl font-semibold">Delete Conversation</h3>
            </div>
            <p className="mb-6 text-gray-600">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-gray-700 transition-colors border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-white transition-colors bg-red-600 rounded-md hover:bg-red-700"
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
