import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const response = await fetch(`${process.env.API_URL}/api/auth/login`, {
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
            return null
          }

          const data = await response.json()
          
          return {
            id: data.user.id.toString(),
            email: data.user.email,
            name: `${data.user.first_name} ${data.user.last_name}`,
            image: data.user.avatar_url,
            accessToken: data.token,
            user: data.user,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.accessToken = user.accessToken
        token.user = user.user
      }
      
      if (account?.provider === "google") {
        // Handle Google OAuth by calling our backend
        try {
          const response = await fetch(`${process.env.API_URL}/api/auth/google/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user?.email,
              name: user?.name,
              image: user?.image,
              google_id: account.providerAccountId,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            token.accessToken = data.token
            token.user = data.user
          }
        } catch (error) {
          console.error('Google auth error:', error)
        }
      }

      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.user = token.user
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: "jwt",
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }