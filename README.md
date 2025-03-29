# Homework Helper

A Next.js application that helps students with their homework by providing smart hints using AI, without giving away complete solutions.

## 🎥 Demo Video
[![Watch the video]](https://drive.google.com/file/d/1a-aRs3x8hBBg4YHiuW-VrFCZ9s4D6HPG/view?usp=sharing)

## Features

- Modern chat interface similar to ChatGPT and Claude AI
- User authentication with NextAuth.js
- Text and image input for homework problems
- Two-hint system per problem
- Topic-specific learning resources for each problem
- Real-time message display (WhatsApp-style)
- Chat history with past conversations
- MongoDB for data persistence
- Gemini AI for generating helpful hints

## Key Benefits

- **Guided Learning**: Provides hints that guide students toward solutions without giving away answers
- **Visual Input**: Upload images of homework problems for easier input
- **Targeted Resources**: Offers topic-specific educational resources related to each problem
- **Progress Tracking**: Maintains history of all conversations and hints used

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
- Tesseract.js for OCR (image to text)
- KaTeX for math formula rendering

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
```

## Chat Interface Features

- **Dark Mode Sidebar**: Easy navigation between conversations
- **Responsive Design**: Works on mobile and desktop devices
- **Real-time Messaging**: Messages appear instantly in the chat
- **Typing Indicators**: Shows when the AI is generating a response
- **Image Upload**: Process homework problems from images using OCR
- **Resource Display**: Provides targeted educational resources after hints

## Educational Resources

The Homework Helper provides topic-specific resources that:
- Are directly related to the concepts in the student's question
- Include specific educational links addressing the problem's concepts
- Provide explanations of how each resource helps solve the specific problem
- Appear after the student has received their two hints

## License

MIT
