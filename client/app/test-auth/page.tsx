import { auth } from "@/auth"

export default async function TestAuthPage() {
  const session = await auth()
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Authentication Test</h1>
      
      {session ? (
        <div>
          <p className="text-green-600 mb-4">✅ Authenticated!</p>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
      ) : (
        <div>
          <p className="text-red-600 mb-4">❌ Not authenticated</p>
          <a href="/auth/signin" className="text-blue-600 underline">
            Go to Sign In
          </a>
        </div>
      )}
    </div>
  )
}