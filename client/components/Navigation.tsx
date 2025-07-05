'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function Navigation() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="space-x-4">
        <div className="inline-block w-16 h-8 bg-white/20 rounded animate-pulse"></div>
        <div className="inline-block w-20 h-8 bg-white/20 rounded animate-pulse"></div>
      </div>
    );
  }

  if (session?.user) {
    const user = session.user as any;
    
    const getDashboardLink = () => {
      return '/dashboard';
    };

    const getDashboardLabel = () => {
      switch (user.role) {
        case 'admin':
          return 'Admin Panel';
        case 'driver':
          return 'Driver Dashboard';
        default:
          return 'Dashboard';
      }
    };

    return (
      <div className="flex items-center space-x-4">
        <span className="text-white/90 hidden sm:inline">
          Hi, {user.first_name || user.name}!
        </span>
        {user.role !== 'driver' && user.role !== 'admin' && (
          <Link 
            href="/apply-driver" 
            className="text-white hover:text-white/80 transition-colors hidden sm:inline"
          >
            Drive with Us
          </Link>
        )}
        <Link 
          href={getDashboardLink()} 
          className="bg-white text-teal-600 px-4 py-2 rounded-full font-medium hover:bg-white/90 transition-colors"
        >
          {getDashboardLabel()}
        </Link>
        <Link
          href="/api/auth/signout"
          className="text-white hover:text-white/80 transition-colors"
        >
          Sign Out
        </Link>
      </div>
    );
  }

  return (
    <div className="space-x-4">
      <Link 
        href="/apply-driver" 
        className="text-white hover:text-white/80 transition-colors"
      >
        Drive with Us
      </Link>
      <Link 
        href="/auth/signin" 
        className="text-white hover:text-white/80 transition-colors"
      >
        Sign In
      </Link>
      <Link 
        href="/auth/signup" 
        className="bg-white text-teal-600 px-4 py-2 rounded-full font-medium hover:bg-white/90 transition-colors"
      >
        Get Started
      </Link>
    </div>
  );
}