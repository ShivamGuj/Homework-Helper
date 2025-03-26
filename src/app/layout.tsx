import { Inter } from 'next/font/google';
import { getServerSession } from 'next-auth/next';
import { SessionProvider } from '@/components/SessionProvider';
import './globals.css';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Homework Helper',
  description: 'Get smart hints for your homework problems',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Add try/catch to handle potential auth errors
  let session = null;
  try {
    session = await getServerSession();
  } catch (error) {
    console.error("Error getting session:", error);
  }
  headers(); // This is needed to make the session work in app router

  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
