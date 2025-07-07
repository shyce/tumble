'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Crown, Truck, User } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { TumbleInput } from '@/components/ui/tumble-input'
import { TumbleButton } from '@/components/ui/tumble-button'
import { tumbleToast } from '@/components/ui/tumble-toast'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        tumbleToast.error('Sign in failed', result.code as string)
      } else {
        tumbleToast.success('Welcome back!', 'You have been signed in successfully.')
        router.push('/dashboard')
      }
    } catch (error: any) {
      tumbleToast.error('Sign in failed', 'An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/dashboard' })
  }

  const handleTestAccountLogin = async (email: string, password: string) => {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        tumbleToast.error('Sign in failed', result.code as string)
      } else {
        tumbleToast.success('Welcome back!', 'You have been signed in successfully.')
        router.push('/dashboard')
      }
    } catch (error: any) {
      tumbleToast.error('Sign in failed', 'An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:py-12 lg:px-8 overflow-x-hidden">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 lg:gap-12 lg:items-center w-full">
          {/* Sign In Form */}
          <div className="max-w-md mx-auto w-full space-y-6 lg:space-y-8 min-w-0">
        <PageHeader title="Sign In" subtitle="Your laundry service awaits" compact={true} />
        <form className="mt-6 lg:mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <TumbleInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              label="Email address"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TumbleInput
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>


          <TumbleButton
            type="submit"
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </TumbleButton>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <TumbleButton
                type="button"
                onClick={handleGoogleSignIn}
                variant="outline"
                className="w-full"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="ml-2">Sign in with Google</span>
              </TumbleButton>
            </div>
          </div>

          <div className="text-center">
            <span className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href="/auth/signup" className="font-medium text-[#A7E7E1] hover:text-[#8BE2B3]">
                Sign up
              </Link>
            </span>
          </div>
          </form>
          </div>

          {/* Welcome Section */}
          <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-2xl border border-slate-200 w-full max-w-md mx-auto lg:max-w-none min-w-0">
            <div className="text-center mb-4 lg:mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 lg:w-16 lg:h-16 bg-teal-100 rounded-full mb-2 lg:mb-3">
                <Sparkles className="w-6 h-6 lg:w-8 lg:h-8 text-teal-600" />
              </div>
              <h2 className="text-xl lg:text-2xl font-bold text-slate-800 mb-1">Welcome to Tumble</h2>
              <p className="text-slate-600 text-xs lg:text-sm">Premium laundry service platform</p>
            </div>
            
            {/* Test Accounts */}
            <div className="space-y-3 lg:space-y-4 mb-4 lg:mb-6">
              <h3 className="text-base lg:text-lg font-semibold text-slate-800 text-center mb-2 lg:mb-3">Test Accounts</h3>
              <div className="space-y-3">
                <TumbleButton 
                  onClick={() => handleTestAccountLogin('admin@tumble.com', 'admin123')}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-auto p-3 lg:p-4 text-left border-purple-200 hover:border-purple-300 hover:bg-purple-50/50"
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Crown className="w-4 h-4 lg:w-5 lg:h-5 text-purple-600" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm lg:text-base font-semibold text-purple-800">Admin</div>
                        <div className="text-xs lg:text-sm text-purple-600">Manage everything</div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 flex-shrink-0">
                      <div className="font-mono hidden sm:block">admin@tumble.com</div>
                      <div className="font-mono hidden sm:block">admin123</div>
                      <div className="font-mono sm:hidden">admin</div>
                    </div>
                  </div>
                </TumbleButton>
                <TumbleButton 
                  onClick={() => handleTestAccountLogin('driver@tumble.com', 'driver123')}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-auto p-3 lg:p-4 text-left border-blue-200 hover:border-blue-300 hover:bg-blue-50/50"
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Truck className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm lg:text-base font-semibold text-blue-800">Driver</div>
                        <div className="text-xs lg:text-sm text-blue-600">Routes & earnings</div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 flex-shrink-0">
                      <div className="font-mono hidden sm:block">driver@tumble.com</div>
                      <div className="font-mono hidden sm:block">driver123</div>
                      <div className="font-mono sm:hidden">driver</div>
                    </div>
                  </div>
                </TumbleButton>
                <TumbleButton 
                  onClick={() => handleTestAccountLogin('customer@tumble.com', 'customer123')}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-auto p-3 lg:p-4 text-left border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className="w-8 h-8 lg:w-10 lg:h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-600" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm lg:text-base font-semibold text-emerald-800">Customer</div>
                        <div className="text-xs lg:text-sm text-emerald-600">Orders & subscriptions</div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 flex-shrink-0">
                      <div className="font-mono hidden sm:block">customer@tumble.com</div>
                      <div className="font-mono hidden sm:block">customer123</div>
                      <div className="font-mono sm:hidden">customer</div>
                    </div>
                  </div>
                </TumbleButton>
              </div>
            </div>

            {/* Welcome Letter */}
            <div className="border-t border-slate-200 pt-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Hey Lyndsay and Micheal!</h3>
              </div>
              
              <div className="text-slate-600 text-sm leading-relaxed space-y-3">
                <p>
                  Hey Lyndsay and Micheal! Welcome to your new laundry service platform. 
                  Everything here is fully customizable - feel free to adjust anything to fit your vision.
                </p>
                
                <p>
                  This is just the beginning! Coming soon: automated route optimization, smart driver assignments, 
                  real-time tracking, advanced analytics, and mobile apps for drivers and customers.
                </p>
                
                <div className="text-center mt-4 pt-3 border-t border-slate-100">
                  <p className="text-teal-600 font-medium">You've got this! 💚</p>
                  <p className="text-xs text-slate-500 mt-1">Love, Brian</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}