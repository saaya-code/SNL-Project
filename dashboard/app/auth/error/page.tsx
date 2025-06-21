'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams?.get('error')

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'Configuration':
        return 'There is a problem with the server configuration.'
      case 'AccessDenied':
        return 'Access denied. You do not have permission to sign in.'
      case 'Verification':
        return 'The verification token has expired or has already been used.'
      default:
        return 'An error occurred while signing in.'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 flex items-center justify-center">
      <div className="bg-red-900/50 backdrop-blur-sm p-8 rounded-xl shadow-2xl max-w-md w-full border border-red-500">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-200 mb-4">Authentication Error</h1>
          <p className="text-red-300 mb-6">{getErrorMessage(error)}</p>
          
          <Link
            href="/"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Try Again
          </Link>
        </div>
      </div>
    </div>
  )
}
