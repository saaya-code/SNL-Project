'use client'

import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { LogIn, Gamepad2, Users, Trophy } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-discord-blurple via-purple-600 to-pink-500">
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8">
          {/* Logo and Title */}
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-white rounded-full flex items-center justify-center mb-6">
              <Gamepad2 className="h-8 w-8 text-discord-blurple" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              SNL Dashboard
            </h2>
            <p className="text-white/80">
              Snakes & Ladders Game Management
            </p>
          </div>

          {/* Features */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-white">
              <Users className="h-5 w-5 text-discord-green" />
              <span className="text-sm">Manage teams and players</span>
            </div>
            <div className="flex items-center space-x-3 text-white">
              <Trophy className="h-5 w-5 text-discord-yellow" />
              <span className="text-sm">Track game progress</span>
            </div>
            <div className="flex items-center space-x-3 text-white">
              <Gamepad2 className="h-5 w-5 text-discord-fuchsia" />
              <span className="text-sm">Real-time game control</span>
            </div>
          </div>

          {/* Login Button */}
          <div className="space-y-4">
            <button
              onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-discord-blurple hover:bg-discord-blurple/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-discord-blurple transition-all duration-200 transform hover:scale-105"
            >
              <LogIn className="h-5 w-5 mr-2" />
              Sign in with Discord
            </button>
            
            <p className="text-center text-xs text-white/60">
              You need to be a member of the SNL Discord server
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
