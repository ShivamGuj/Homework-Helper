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
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [showResources, setShowResources] = useState(false);

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

  // Update the chat message rendering section for better design
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
        {/* Sidebar - Updated with better styling */}
        <div className={`fixed inset-y-0 left-0 transform ${showSidebar ? 'translate-x-0' : '-translate-x-full'} w-80 bg-white shadow-lg transition-transform duration-300 ease-in-out mt-16 md:mt-0 md:relative md:translate-x-0 z-10 border-r border-gray-200`}>
          <div className="p-4 overflow-y-auto h-full flex flex-col">
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
            <h3 className="text-sm uppercase font-semibold text-gray-500 mb-3 pl-2 flex items-center">
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              Your Conversations
            </h3>
            <div className="flex-1 overflow-y-auto pr-1 chat-list">
              {pastChats.length === 0 ? (
                <div className="text-center text-gray-500 mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
                  <svg className="w-12 h-12 mx-auto text-blue-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm">No past chats found. Start a new conversation!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pastChats.map((chat) => (
                    <div 
                      key={chat._id}
                      className="group relative rounded-xl overflow-hidden hover:bg-blue-50 transition-colors border border-gray-100 hover:border-blue-200"
                      onClick={() => handleLoadChat(chat)}
                    >
                      <button 
                        className={`w-full p-3 text-left flex flex-col ${
                          currentChat && chat._id && currentChat._id === chat._id ? 'bg-blue-100 border-blue-300' : ''
                        }`}
                      >
                        <div className="font-medium truncate text-gray-800">
                          {chat && chat.messages && chat.messages.length > 0 
                            ? `${chat.messages[0]?.content?.slice(0, 30) || 'Chat content'}`
                            : 'New Chat'
                          }...
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date().toLocaleDateString()} • {chat.hintsUsed} hint{chat.hintsUsed !== 1 ? 's' : ''}
                        </div>
                      </button>
                      <button
                        onClick={(e) => handleDeleteChat(chat._id, e)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-50"
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
        </div>

        {/* Main Chat Area - Enhanced with better styling */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Chat Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-6"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%239C92AC" fill-opacity="0.05" fill-rule="evenodd"%3E%3Ccircle cx="3" cy="3" r="3"/%3E%3Ccircle cx="13" cy="13" r="3"/%3E%3C/g%3E%3C/svg%3E")' }}
          >
            {!currentChat && (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <FaBook className="text-4xl text-blue-500" />
                </div>
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
                  className={`relative max-w-[80%] rounded-2xl p-4 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                      : 'bg-white shadow-md text-gray-800 border border-gray-200'
                  }`}
                >
                  {msg.role === 'assistant' && !isResourceMessage(msg.content) && (
                    <div className="font-semibold mb-2 flex items-center gap-2 text-blue-600">
                      <FaLightbulb className="text-amber-500" /> Hint:
                    </div>
                  )}
                  {/* Message sender indicator */}
                  <div className={`absolute ${msg.role === 'user' ? '-right-1 -top-1' : '-left-1 -top-1'} bg-${msg.role === 'user' ? 'blue' : 'gray'}-500 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs shadow-md`}>
                    {msg.role === 'user' ? 'U' : 'A'}
                  </div>
                  {/* Render message content */}
                  <div 
                    dangerouslySetInnerHTML={renderMessage(msg.content)} 
                    className={`${isResourceMessage(msg.content) ? '' : 'math-content prose prose-sm max-w-none'}`} 
                  />
                  {/* Message timestamp */}
                  <div className={`text-xs mt-1 text-right ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input Area - Enhanced styling */}
          <div className="border-t bg-white p-4 shadow-md">
            {currentChat?.isCompleted ? (
              <div className="text-center p-4">
                <div className="text-gray-600 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg inline-flex items-center">
                  <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  You've used all available hints. Try solving the problem with the provided guidance.
                </div>
                <div className="flex flex-row gap-4 justify-center items-center mb-4">
                  {/* Only show the resources button if resources haven't been fetched yet and hints used are 2 */}
                  {currentChat.hintsUsed >= 2 && !chatHasResources() && !showResources ? (
                    <button
                      onClick={handleGetResources}
                      disabled={isLoadingResources}
                      className="py-3 px-6 bg-gradient-to-r from-green-500 to-green-700 text-white rounded-lg hover:from-green-600 hover:to-green-800 transition-colors shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                      {isLoadingResources ? (
                        <>
                          <FaSpinner className="animate-spin mr-2" />
                          <span>Finding resources...</span>
                        </>
                      ) : (
                        <>
                          <FaBook className="mr-2" />
                          <span>Find Learning Resources</span>
                        </>
                      )}
                    </button>
                  ) : null}
                  <button
                    onClick={handleNewChat}
                    className="py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg hover:from-blue-600 hover:to-blue-800 transition-colors shadow-md flex items-center gap-2"
                  >
                    <FaPaperPlane className="mr-2" />
                    <span>New Problem</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {currentChat && currentChat.hintsUsed >= 1 ? (
                  <div className="mb-4 flex justify-center gap-4">
                    <button
                      onClick={handleGetAnotherHint}
                      disabled={isLoading || currentChat.hintsUsed >= 2}
                      className="py-3 px-6 bg-gradient-to-r from-amber-400 to-amber-600 text-white rounded-lg hover:from-amber-500 hover:to-amber-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    {currentChat.hintsUsed >= 2 && !showResources ? (
                      <button
                        onClick={handleGetResources}
                        disabled={isLoadingResources}
                        className="py-3 px-6 bg-gradient-to-r from-green-500 to-green-700 text-white rounded-lg hover:from-green-600 hover:to-green-800 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isLoadingResources ? (
                          <>
                            <FaSpinner className="animate-spin" />
                            <span>Finding resources...</span>
                          </>
                        ) : (
                          <>
                            <FaBook className="mr-2" />
                            <span>Find Learning Resources</span>
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex items-center gap-3">
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
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors"
                        title="Upload image"
                        disabled={isProcessingImage}
                      >
                        {isProcessingImage ? (
                          <FaSpinner className="text-xl animate-spin" />
                        ) : (
                          <FaImage className="text-xl" />
                        )}
                      </button>
                      {isProcessingImage && (
                        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
                          Processing... {Math.round(ocrProgress)}%
                        </div>
                      )}
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={isProcessingImage ? "Processing image..." : "Type your homework problem..."}
                        className="w-full p-3 pl-4 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                        disabled={isProcessingImage}
                      />
                      <button
                        type="submit"
                        disabled={isLoading || !message.trim()}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-blue-600 hover:text-blue-800 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Send message"
                      >
                        {isLoading ? (
                          <FaSpinner className="animate-spin text-xl" />
                        ) : (
                          <FaPaperPlane className="text-xl" />
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal - Enhanced styling */}
      {chatToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-md w-full m-4 shadow-2xl">
            <div className="flex items-center mb-4 text-red-500">
              <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
