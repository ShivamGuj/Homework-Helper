'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { FaBook, FaRobot, FaSignOutAlt, FaChevronRight, FaLightbulb, FaGraduationCap, FaImage } from 'react-icons/fa';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/auth/login');
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <nav className="bg-white shadow-md p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FaBook className="text-3xl text-blue-600" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 text-transparent bg-clip-text">Homework Helper</span>
          </div>
          
          {status === 'loading' ? (
            <div className="w-24 h-8 bg-gray-200 animate-pulse rounded"></div>
          ) : status === 'authenticated' ? (
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
                  <Link href="/chatbot" className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors">
                    <FaRobot className="mr-2 text-blue-600" /> Go to Chatbot
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                  >
                    <FaSignOutAlt className="mr-2 text-blue-600" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-4">
              <Link 
                href="/auth/login" 
                className="px-4 py-2 text-blue-600 hover:text-blue-800 transition-colors"
              >
                Login
              </Link>
              <Link 
                href="/auth/signup" 
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg hover:from-blue-600 hover:to-blue-800 transition-colors shadow-md"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-blue-800 text-transparent bg-clip-text">
              Learn More Effectively with Smart Guidance
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Stuck on a problem? Our AI assistant provides helpful hints that guide your thinking without giving away the answer, helping you build problem-solving skills that last.
            </p>
            
            {status === 'authenticated' ? (
              <div className="space-y-4">
                <Link
                  href="/chatbot"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg hover:from-blue-600 hover:to-blue-800 transition-colors shadow-md text-lg font-medium"
                >
                  <FaRobot className="text-xl" />
                  Start Getting Hints
                </Link>
                <p className="text-sm text-gray-500 mt-2">
                  You're logged in as {session?.user?.name || 'a user'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg hover:from-blue-600 hover:to-blue-800 transition-colors shadow-md text-lg font-medium"
                >
                  Start Getting Hints <FaChevronRight />
                </Link>
                <p className="text-sm text-gray-500">
                  Already have an account? <Link href="/auth/login" className="text-blue-600 hover:underline">Login here</Link>
                </p>
              </div>
            )}
          </div>

          {/* How It Works Section */}
          <div className="mt-16 mb-20">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-xl shadow-md transform transition-transform hover:scale-105">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-blue-600">1</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-center">Ask Your Question</h3>
                <p className="text-gray-600 text-center">
                  Type your homework problem or upload an image of the question that's giving you trouble.
                </p>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-md transform transition-transform hover:scale-105">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-blue-600">2</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-center">Receive Strategic Hints</h3>
                <p className="text-gray-600 text-center">
                  Get a carefully crafted hint that points you in the right direction without solving it for you.
                </p>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-md transform transition-transform hover:scale-105">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-blue-600">3</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-center">Deepen Understanding</h3>
                <p className="text-gray-600 text-center">
                  If needed, request a follow-up hint that builds your understanding of the core concepts.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Feature highlights */}
        <div className="mt-16 pb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Why Homework Helper Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4 text-blue-600">
                <FaLightbulb size={40} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">Guided Learning</h3>
              <p className="text-gray-600 text-center">
                Our hints are designed to spark your own insights rather than just giving away answers, helping you develop problem-solving skills.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4 text-blue-600">
                <FaImage size={40} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">Image Recognition</h3>
              <p className="text-gray-600 text-center">
                Upload a photo of your textbook problem or written homework and get hints tailored to your specific question.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex justify-center mb-4 text-blue-600">
                <FaGraduationCap size={40} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">Progressive Hints</h3>
              <p className="text-gray-600 text-center">
                Start with a subtle hint, and if you're still stuck, request a more detailed explanation that builds deeper understanding.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-blue-100 rounded-2xl p-10 max-w-4xl mx-auto mb-20 shadow-md">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to improve your learning?</h2>
            <p className="text-lg text-gray-700 mb-8">
              Join thousands of students who are developing deeper understanding through guided learning.
            </p>
            <Link
              href={status === 'authenticated' ? "/chatbot" : "/auth/signup"}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg hover:from-blue-600 hover:to-blue-800 transition-colors shadow-md text-lg font-medium"
            >
              {status === 'authenticated' ? "Go to Chatbot" : "Get Started for Free"}
              <FaChevronRight />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white shadow-inner py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <FaBook className="text-2xl text-blue-600" />
              <span className="text-lg font-bold">Homework Helper</span>
            </div>
            <div className="text-sm text-gray-500">
              © {new Date().getFullYear()} Homework Helper. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
