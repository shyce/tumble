import { getSession } from 'next-auth/react';

export async function authFetch(url: string, options: RequestInit = {}) {
  const session = await getSession();
  
  if (!session) {
    throw new Error('No session found');
  }

  const authHeaders = {
    'Authorization': `Bearer ${(session as any)?.accessToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers: authHeaders,
  });
}

export function authFetchWithSession(session: any, url: string, options: RequestInit = {}) {
  if (!session) {
    throw new Error('No session found');
  }

  const authHeaders = {
    'Authorization': `Bearer ${(session as any)?.accessToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers: authHeaders,
  });
}

export function useAuthToken() {
  // This is a simple hook that can be used in components
  return (session: any) => (session as any)?.accessToken;
}