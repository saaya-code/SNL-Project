import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    // For now, return a simple response
    // In a real implementation, you'd query the GameParameters model
    return NextResponse.json({
      moderatorRoleId: null, // Will be populated from database
      settings: {
        allowMultipleGames: false,
        defaultGameDuration: 7,
        maxTeamsPerGame: 10
      }
    })
  } catch (error) {
    console.error('Error fetching guild moderator role:', error)
    return NextResponse.json(
      { error: 'Failed to fetch moderator role' },
      { status: 500 }
    )
  }
}
