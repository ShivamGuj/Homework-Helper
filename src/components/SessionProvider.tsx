'use client';

import { SessionProvider as Provider } from 'next-auth/react';
import { Session } from 'next-auth';
import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  session: Session | null;
};

export function SessionProvider({ children, session }: Props) {
  return (
    <Provider session={session} refetchInterval={0}>
      {children}
    </Provider>
  );
}
