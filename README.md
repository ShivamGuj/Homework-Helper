# Homework Helper

A Next.js application that helps students with their homework by providing smart hints using AI, without giving away complete solutions.

## Features

- User authentication with NextAuth.js
- Text and image input for homework problems
- Two-hint system per problem
- Chat history with past conversations
- MongoDB for data persistence
- Gemini AI for generating helpful hints

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with the following variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   NEXTAUTH_SECRET=your_random_secret_string
   NEXTAUTH_URL=http://localhost:3000
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Tech Stack

- Next.js 14
- TypeScript
- NextAuth.js for authentication
- MongoDB & Mongoose
- Tailwind CSS
- Google's Gemini AI

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── chatbot/           # Chatbot interface
│   └── page.tsx           # Home page
├── components/            # React components
├── lib/                   # Utility functions
└── models/               # MongoDB models
