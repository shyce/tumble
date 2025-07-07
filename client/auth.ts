import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { InvalidLoginError } from "./lib/auth-errors"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required")
        }

        try {
          const response = await fetch(`https://tumble.royer.app/api/v1/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || "Authentication failed")
          }

          const data = await response.json()
          
          // Check user status - backend already handles this, but we include it for session management
          if (data.user.status !== 'active') {
            throw new Error("Account is not active")
          }

          return {
            id: data.user.id.toString(),
            email: data.user.email,
            name: `${data.user.first_name} ${data.user.last_name}`,
            role: data.user.role,
            status: data.user.status,
            first_name: data.user.first_name,
            last_name: data.user.last_name,
            accessToken: data.token,
          }
        } catch (error: any) {
          throw new InvalidLoginError(error.message || "Authentication failed")
        }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as any).accessToken
        token.role = (user as any).role
        token.status = (user as any).status
        token.first_name = (user as any).first_name
        token.last_name = (user as any).last_name
      }
      return token
    },
    session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken,
        user: {
          ...session.user,
          role: token.role,
          status: token.status,
          first_name: token.first_name,
          last_name: token.last_name,
        }
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
})