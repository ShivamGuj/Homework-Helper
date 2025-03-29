import '../styles/globals.css'; // Updated path
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
