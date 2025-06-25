'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Save, 
  Upload, 
  Trash2, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown,
  Calendar,
  Type,
  Image as ImageIcon,
  Zap
} from 'lucide-react'
import { gamesApi } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface TileData {
  id: number
  taskName: string
  taskDescription: string
  imageFile?: File
  imageUrl?: string
  hasSnake?: boolean
  snakeEnd?: number
  hasLadder?: boolean
  ladderEnd?: number
}

interface GameFormData {
  name: string
  deadline: string
  maxTeamSize: number
  snakeCount: number
  ladderCount: number
}

const GRID_SIZE = 10
const TOTAL_TILES = 100

// Initialize empty tiles
const initializeTiles = (): TileData[] => {
  return Array.from({ length: TOTAL_TILES }, (_, index) => ({
    id: index + 1,
    taskName: '',
    taskDescription: '',
  }))
}

export default function CreateGamePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<'form' | 'board'>('form')
  const [gameForm, setGameForm] = useState<GameFormData>({
    name: '',
    deadline: '',
    maxTeamSize: 3,
    snakeCount: 0,
    ladderCount: 0
  })
  const [tiles, setTiles] = useState<TileData[]>(initializeTiles())
  const [selectedTile, setSelectedTile] = useState<number | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [placingSnake, setPlacingSnake] = useState(false)
  const [placingLadder, setPlacingLadder] = useState(false)
  const [snakeStart, setSnakeStart] = useState<number | null>(null)
  const [ladderStart, setLadderStart] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get tile position in snake-like pattern (bottom-left is 1, top-right is 100)
  const getTilePosition = (tileNumber: number) => {
    const row = Math.floor((tileNumber - 1) / GRID_SIZE)
    const col = (tileNumber - 1) % GRID_SIZE
    const actualCol = row % 2 === 0 ? col : (GRID_SIZE - 1 - col)
    return { row, col: actualCol }
  }

  // Get tile number from grid position (where row 0 = bottom, row 9 = top)
  const getTileNumber = (row: number, col: number) => {
    const actualCol = row % 2 === 0 ? col : (GRID_SIZE - 1 - col)
    return row * GRID_SIZE + actualCol + 1
  }

  // Get visual position for SVG overlays (flipped for display)
  // Get visual position for SVG overlays and rendering
  const getVisualPosition = (tileNumber: number) => {
    const { row, col } = getTilePosition(tileNumber)
    // Convert to visual grid coordinates (flip row for display since we show top row first)
    const visualRow = GRID_SIZE - 1 - row
    return { 
      row: visualRow, 
      col,
      x: col * (100 / GRID_SIZE) + (50 / GRID_SIZE), // Center of tile as percentage
      y: visualRow * (100 / GRID_SIZE) + (50 / GRID_SIZE) // Center of tile as percentage
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!gameForm.name || !gameForm.deadline) {
      toast.error('Please fill in all required fields')
      return
    }
    setCurrentStep('board')
  }

  const handleTileClick = (tileNumber: number) => {
    if (placingSnake) {
      if (snakeStart === null) {
        setSnakeStart(tileNumber)
        toast('Now select the end tile for the snake', { icon: 'ℹ️' })
      } else {
        if (snakeStart === tileNumber) {
          toast.error('Snake start and end cannot be the same tile')
          return
        }
        if (snakeStart < tileNumber) {
          toast.error('Snake end must be lower than start')
          return
        }
        
        // Add snake
        setTiles(prev => prev.map(tile => {
          if (tile.id === snakeStart) {
            return { ...tile, hasSnake: true, snakeEnd: tileNumber }
          }
          return tile
        }))
        
        setSnakeStart(null)
        setPlacingSnake(false)
        setGameForm(prev => ({ ...prev, snakeCount: prev.snakeCount + 1 }))
        toast.success('Snake placed!')
      }
    } else if (placingLadder) {
      if (ladderStart === null) {
        setLadderStart(tileNumber)
        toast('Now select the end tile for the ladder', { icon: 'ℹ️' })
      } else {
        if (ladderStart === tileNumber) {
          toast.error('Ladder start and end cannot be the same tile')
          return
        }
        if (ladderStart > tileNumber) {
          toast.error('Ladder end must be higher than start')
          return
        }
        
        // Add ladder
        setTiles(prev => prev.map(tile => {
          if (tile.id === ladderStart) {
            return { ...tile, hasLadder: true, ladderEnd: tileNumber }
          }
          return tile
        }))
        
        setLadderStart(null)
        setPlacingLadder(false)
        setGameForm(prev => ({ ...prev, ladderCount: prev.ladderCount + 1 }))
        toast.success('Ladder placed!')
      }
    } else {
      setSelectedTile(tileNumber)
    }
  }

  const handleTileUpdate = (field: keyof TileData, value: any) => {
    if (selectedTile === null) return
    
    setTiles(prev => prev.map(tile => 
      tile.id === selectedTile 
        ? { ...tile, [field]: value }
        : tile
    ))
  }

  const handleImageUpload = (file: File) => {
    if (selectedTile === null) return
    
    const imageUrl = URL.createObjectURL(file)
    setTiles(prev => prev.map(tile => 
      tile.id === selectedTile 
        ? { ...tile, imageFile: file, imageUrl }
        : tile
    ))
  }

  const handleImageDrop = (e: React.DragEvent, tileNumber: number) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))
    
    if (imageFile) {
      const imageUrl = URL.createObjectURL(imageFile)
      setTiles(prev => prev.map(tile => 
        tile.id === tileNumber 
          ? { ...tile, imageFile, imageUrl }
          : tile
      ))
      toast.success('Image added to tile!')
    }
  }

  const removeSnakeOrLadder = (tileNumber: number) => {
    setTiles(prev => prev.map(tile => {
      if (tile.id === tileNumber) {
        const updatedTile = { ...tile }
        if (tile.hasSnake) {
          delete updatedTile.hasSnake
          delete updatedTile.snakeEnd
          setGameForm(prev => ({ ...prev, snakeCount: Math.max(0, prev.snakeCount - 1) }))
        }
        if (tile.hasLadder) {
          delete updatedTile.hasLadder
          delete updatedTile.ladderEnd
          setGameForm(prev => ({ ...prev, ladderCount: Math.max(0, prev.ladderCount - 1) }))
        }
        return updatedTile
      }
      return tile
    }))
  }

  const clearTile = (tileNumber: number) => {
    setTiles(prev => prev.map(tile => {
      if (tile.id === tileNumber) {
        // Update game form counters when clearing snakes/ladders
        if (tile.hasSnake) {
          setGameForm(prevForm => ({ ...prevForm, snakeCount: Math.max(0, prevForm.snakeCount - 1) }))
        }
        if (tile.hasLadder) {
          setGameForm(prevForm => ({ ...prevForm, ladderCount: Math.max(0, prevForm.ladderCount - 1) }))
        }
        
        return { 
          id: tile.id, 
          taskName: '', 
          taskDescription: '',
          ...(tile.imageUrl && { imageUrl: undefined, imageFile: undefined }),
          // Clear snake/ladder data
          hasSnake: false,
          hasLadder: false,
          snakeEnd: undefined,
          ladderEnd: undefined
        }
      }
      
      // Also clear any snakes/ladders that end at this tile
      if (tile.snakeEnd === tileNumber) {
        setGameForm(prevForm => ({ ...prevForm, snakeCount: Math.max(0, prevForm.snakeCount - 1) }))
        return { ...tile, hasSnake: false, snakeEnd: undefined }
      }
      if (tile.ladderEnd === tileNumber) {
        setGameForm(prevForm => ({ ...prevForm, ladderCount: Math.max(0, prevForm.ladderCount - 1) }))
        return { ...tile, hasLadder: false, ladderEnd: undefined }
      }
      
      return tile
    }))
    toast.success('Tile cleared!')
  }

  const quickFillRandomTasks = () => {
    const sampleTasks = [
      { name: 'Answer a trivia question', description: 'Show your knowledge!' },
      { name: 'Tell a joke', description: 'Make everyone laugh' },
      { name: 'Do 5 push-ups', description: 'Physical challenge' },
      { name: 'Name 3 countries', description: 'Geography challenge' },
      { name: 'Sing a song', description: 'Musical talent time' },
      { name: 'Draw something', description: 'Show your artistic side' },
      { name: 'Tell a story', description: 'Creative storytelling' },
      { name: 'Dance for 10 seconds', description: 'Show your moves!' },
    ]

    setTiles(prev => prev.map(tile => {
      if (tile.taskName === '') {
        const randomTask = sampleTasks[Math.floor(Math.random() * sampleTasks.length)]
        return {
          ...tile,
          taskName: randomTask.name,
          taskDescription: randomTask.description
        }
      }
      return tile
    }))
    toast.success('Empty tiles filled with sample tasks!')
  }

  const handleSaveGame = async () => {
    try {
      setLoading(true)
      
      // Validate that we have at least some tasks
      const tilesWithTasks = tiles.filter(tile => tile.taskName.trim() !== '')
      if (tilesWithTasks.length === 0) {
        toast.error('Please add at least one task to the board')
        return
      }

      // Create tileTasks object with proper image handling
      const tileTasks: Record<string, any> = {}
      const snakes: Record<string, number> = {}
      const ladders: Record<string, number> = {}

      // Helper function to convert file to base64
      const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.readAsDataURL(file)
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = error => reject(error)
        })
      }

      // Count tiles with images for progress tracking
      const tilesWithImages = tiles.filter(tile => tile.imageFile).length
      let processedImages = 0

      if (tilesWithImages > 0) {
        toast('Converting images to send to server...', { icon: '🖼️' })
      }

      // Process tiles and convert images to base64
      for (const tile of tiles) {
        if (tile.taskName.trim() !== '' || tile.imageFile) {
          const tileData: any = {
            name: tile.taskName,
            description: tile.taskDescription
          }

          // Convert image file to base64 if it exists
          if (tile.imageFile) {
            try {
              console.log(`Converting image for tile ${tile.id} to base64...`)
              const base64Image = await fileToBase64(tile.imageFile)
              tileData.imageUrl = base64Image
              processedImages++
              console.log(`✅ Successfully converted image for tile ${tile.id} (${Math.round(base64Image.length / 1024)}KB)`)
              
              if (tilesWithImages > 1) {
                toast(`Converting images... ${processedImages}/${tilesWithImages}`, { icon: '⏳' })
              }
            } catch (error) {
              console.error(`Error converting image for tile ${tile.id}:`, error)
              toast.error(`Failed to process image for tile ${tile.id}`)
              // Continue without the image if conversion fails
            }
          }

          tileTasks[tile.id.toString()] = tileData
        }
        
        if (tile.hasSnake && tile.snakeEnd) {
          snakes[tile.id.toString()] = tile.snakeEnd
        }
        
        if (tile.hasLadder && tile.ladderEnd) {
          ladders[tile.id.toString()] = tile.ladderEnd
        }
      }

      if (tilesWithImages > 0) {
        toast.success(`All ${processedImages} images converted successfully!`)
      }

      const gameData = {
        name: gameForm.name,
        applicationDeadline: gameForm.deadline,
        maxTeamSize: gameForm.maxTeamSize,
        tileTasks,
        snakes,
        ladders,
        snakeCount: gameForm.snakeCount,
        ladderCount: gameForm.ladderCount
      }

      console.log('Sending game data to server:', { 
        ...gameData, 
        tileTasks: Object.keys(gameData.tileTasks).length + ' tiles with tasks',
        imageCount: Object.values(gameData.tileTasks).filter((task: any) => task.imageUrl).length
      })

      await gamesApi.create(gameData)
      toast.success('Game created successfully!')
      router.push('/dashboard')
      
    } catch (error) {
      console.error('Error creating game:', error)
      toast.error('Failed to create game. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectedTileData = selectedTile ? tiles.find(t => t.id === selectedTile) : null
  const completedTasks = tiles.filter(tile => tile.taskName.trim() !== '').length

  if (currentStep === 'form') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800/50 rounded-lg p-8">
            <h1 className="text-3xl font-bold text-white mb-8">Create New Game</h1>
            
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Game Name *
                </label>
                <input
                  type="text"
                  value={gameForm.name}
                  onChange={(e) => setGameForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter game name..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Application Deadline *
                </label>
                <input
                  type="datetime-local"
                  value={gameForm.deadline}
                  onChange={(e) => setGameForm(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Maximum Team Size
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={gameForm.maxTeamSize}
                  onChange={(e) => setGameForm(prev => ({ ...prev, maxTeamSize: parseInt(e.target.value) }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ArrowUp className="w-5 h-5" />
                Continue to Board Designer
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800/50 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{gameForm.name} - Board Designer</h1>
              <p className="text-gray-300">Design your 10x10 Snakes & Ladders board</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-300">
                Progress: {completedTasks}/100 tiles completed
              </div>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                {showGrid ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showGrid ? 'Hide' : 'Show'} Grid
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Board */}
          <div className="lg:col-span-3">
            <div className="bg-gray-800/50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Game Board</h2>
                <div className="flex gap-2">
                  <button
                    onClick={quickFillRandomTasks}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                  >
                    🎲 Fill Empty
                  </button>
                  <button
                    onClick={() => {
                      setPlacingSnake(!placingSnake)
                      setPlacingLadder(false)
                      setSnakeStart(null)
                      setLadderStart(null)
                    }}
                    className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      placingSnake 
                        ? 'bg-red-600 text-white' 
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    🐍 {placingSnake ? 'Cancel Snake' : 'Place Snake'}
                  </button>
                  <button
                    onClick={() => {
                      setPlacingLadder(!placingLadder)
                      setPlacingSnake(false)
                      setLadderStart(null)
                      setSnakeStart(null)
                    }}
                    className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      placingLadder 
                        ? 'bg-yellow-600 text-white' 
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    🪜 {placingLadder ? 'Cancel Ladder' : 'Place Ladder'}
                  </button>
                </div>
              </div>
              
              {/* Status indicator */}
              {(placingSnake || placingLadder) && (
                <div className="mb-4 p-3 bg-blue-600/20 border border-blue-600/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-blue-200 text-sm">
                      {placingSnake && snakeStart === null && 'Click on a tile to place the snake start'}
                      {placingSnake && snakeStart !== null && `Snake start placed on tile ${snakeStart}. Now click on a lower tile for the end.`}
                      {placingLadder && ladderStart === null && 'Click on a tile to place the ladder start'}
                      {placingLadder && ladderStart !== null && `Ladder start placed on tile ${ladderStart}. Now click on a higher tile for the end.`}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="relative">
                <div className="grid grid-cols-10 gap-1 bg-gray-900 p-4 rounded-lg">
                  {Array.from({ length: TOTAL_TILES }, (_, index) => {
                    // Calculate visual position (row 0 = top, row 9 = bottom in display)
                    const visualRow = Math.floor(index / GRID_SIZE)
                    const visualCol = index % GRID_SIZE
                    
                    // Convert visual position to actual tile number (bottom-left is 1)
                    const actualRow = GRID_SIZE - 1 - visualRow  // Flip row: visual row 0 = actual row 9
                    const actualCol = actualRow % 2 === 0 ? visualCol : (GRID_SIZE - 1 - visualCol)
                    const tileNumber = actualRow * GRID_SIZE + actualCol + 1
                    
                    const tile = tiles.find(t => t.id === tileNumber)
                    const isSelected = selectedTile === tileNumber
                    const isSnakeStart = snakeStart === tileNumber
                    const isLadderStart = ladderStart === tileNumber
                    
                    return (
                      <div
                        key={tileNumber}
                        onClick={() => handleTileClick(tileNumber)}
                        onDrop={(e) => handleImageDrop(e, tileNumber)}
                        onDragOver={(e) => e.preventDefault()}
                        className={`
                          relative aspect-square border-2 rounded-lg cursor-pointer transition-all
                          ${isSelected ? 'border-blue-500 bg-blue-900/50' : 'border-gray-600 bg-gray-700/50'}
                          ${isSnakeStart ? 'border-red-500 bg-red-900/50' : ''}
                          ${isLadderStart ? 'border-yellow-500 bg-yellow-900/50' : ''}
                          hover:border-gray-400 hover:bg-gray-600/50
                        `}
                      >
                        {/* Tile Number */}
                        <div className="absolute top-1 left-1 text-xs font-bold text-white bg-black/50 rounded px-1">
                          {tileNumber}
                        </div>
                        
                        {/* Tile Image */}
                        {tile?.imageUrl && (
                          <img
                            src={tile.imageUrl}
                            alt={`Tile ${tileNumber}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        )}
                        
                        {/* Task Indicator */}
                        {tile?.taskName && (
                          <div className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                        
                        {/* Snake Indicator */}
                        {tile?.hasSnake && (
                          <div className="absolute top-1 right-1 text-xs">🐍</div>
                        )}
                        
                        {/* Ladder Indicator */}
                        {tile?.hasLadder && (
                          <div className="absolute top-1 right-1 text-xs">🪜</div>
                        )}
                        
                        {/* Grid Numbers */}
                        {showGrid && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-400">
                            {tileNumber}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                
                {/* SVG Overlay for Snakes and Ladders */}
                <svg 
                  className="absolute inset-0 pointer-events-none" 
                  style={{ left: '1rem', top: '1rem', right: '1rem', bottom: '1rem' }}
                  viewBox="0 0 100 100" 
                  preserveAspectRatio="none"
                >
                  {/* Draw Snakes */}
                  {tiles.filter(tile => tile.hasSnake && tile.snakeEnd).map(tile => {
                    const startPos = getVisualPosition(tile.id)
                    const endPos = getVisualPosition(tile.snakeEnd!)
                    
                    return (
                      <g key={`snake-${tile.id}`}>
                        {/* Snake Path */}
                        <path
                          d={`M ${startPos.x} ${startPos.y} Q ${(startPos.x + endPos.x) / 2} ${Math.min(startPos.y, endPos.y) - 10} ${endPos.x} ${endPos.y}`}
                          stroke="#ef4444"
                          strokeWidth="0.8"
                          fill="none"
                          strokeDasharray="2,1"
                        />
                        {/* Snake Head */}
                        <circle
                          cx={endPos.x}
                          cy={endPos.y}
                          r="1.5"
                          fill="#dc2626"
                        />
                        {/* Arrow */}
                        <polygon
                          points={`${endPos.x-1},${endPos.y-1} ${endPos.x+1},${endPos.y-1} ${endPos.x},${endPos.y+1}`}
                          fill="#991b1b"
                        />
                      </g>
                    )
                  })}
                  
                  {/* Draw Ladders */}
                  {tiles.filter(tile => tile.hasLadder && tile.ladderEnd).map(tile => {
                    const startPos = getVisualPosition(tile.id)
                    const endPos = getVisualPosition(tile.ladderEnd!)
                    
                    return (
                      <g key={`ladder-${tile.id}`}>
                        {/* Ladder Rails */}
                        <line
                          x1={startPos.x - 1}
                          y1={startPos.y}
                          x2={endPos.x - 1}
                          y2={endPos.y}
                          stroke="#eab308"
                          strokeWidth="0.3"
                        />
                        <line
                          x1={startPos.x + 1}
                          y1={startPos.y}
                          x2={endPos.x + 1}
                          y2={endPos.y}
                          stroke="#eab308"
                          strokeWidth="0.3"
                        />
                        {/* Ladder Rungs */}
                        {Array.from({ length: 5 }, (_, i) => {
                          const progress = (i + 1) / 6
                          const rungX1 = startPos.x - 1 + progress * ((endPos.x - 1) - (startPos.x - 1))
                          const rungY = startPos.y + progress * (endPos.y - startPos.y)
                          const rungX2 = startPos.x + 1 + progress * ((endPos.x + 1) - (startPos.x + 1))
                          
                          return (
                            <line
                              key={i}
                              x1={rungX1}
                              y1={rungY}
                              x2={rungX2}
                              y2={rungY}
                              stroke="#ca8a04"
                              strokeWidth="0.2"
                            />
                          )
                        })}
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Game Stats */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-4">Game Stats</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Tasks:</span>
                    <span className="text-white">{completedTasks}/100</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all" 
                      style={{ width: `${(completedTasks / 100) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Snakes:</span>
                  <span className="text-white">{gameForm.snakeCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Ladders:</span>
                  <span className="text-white">{gameForm.ladderCount}</span>
                </div>
                
                {completedTasks < 10 && (
                  <div className="mt-3 p-2 bg-yellow-600/20 border border-yellow-600/50 rounded text-xs text-yellow-200">
                    ⚠️ Consider adding more tasks for a better game experience
                  </div>
                )}
                
                {gameForm.snakeCount === 0 && gameForm.ladderCount === 0 && (
                  <div className="mt-2 p-2 bg-blue-600/20 border border-blue-600/50 rounded text-xs text-blue-200">
                    💡 Add some snakes and ladders to make the game more exciting!
                  </div>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-3">Instructions</h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div><strong>Editing Tiles:</strong></div>
                <div>• Click a tile to select and edit it</div>
                <div>• Drag & drop images onto tiles</div>
                <div>• Use 🎲 Fill Empty to add sample tasks</div>
                <div><strong>Snakes & Ladders:</strong></div>
                <div>• Click 🐍 Place Snake, then click start tile → end tile</div>
                <div>• Click 🪜 Place Ladder, then click start tile → end tile</div>
                <div>• Snakes: end must be lower than start (goes down)</div>
                <div>• Ladders: end must be higher than start (goes up)</div>
                <div>• Visual connections appear on the board</div>
                <div>• Clear tiles to remove associated snakes/ladders</div>
              </div>
            </div>

            {/* Tile Editor */}
            {selectedTile && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-lg font-bold text-white mb-4">
                  Edit Tile {selectedTile}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Task Name
                    </label>
                    <input
                      type="text"
                      value={selectedTileData?.taskName || ''}
                      onChange={(e) => handleTileUpdate('taskName', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      placeholder="Enter task name..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={selectedTileData?.taskDescription || ''}
                      onChange={(e) => handleTileUpdate('taskDescription', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm h-20 resize-none"
                      placeholder="Enter task description..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tile Image
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(file)
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Image
                    </button>
                    {selectedTileData?.imageUrl && (
                      <img
                        src={selectedTileData.imageUrl}
                        alt="Tile preview"
                        className="w-full h-20 object-cover rounded mt-2"
                      />
                    )}
                  </div>
                  
                  {(selectedTileData?.hasSnake || selectedTileData?.hasLadder) && (
                    <button
                      onClick={() => removeSnakeOrLadder(selectedTile)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove {selectedTileData.hasSnake ? 'Snake' : 'Ladder'}
                    </button>
                  )}
                  
                  {(selectedTileData?.taskName || selectedTileData?.imageUrl) && (
                    <button
                      onClick={() => clearTile(selectedTile)}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear Tile
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="space-y-3">
                <button
                  onClick={() => setCurrentStep('form')}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowDown className="w-4 h-4" />
                  Back to Form
                </button>
                
                <button
                  onClick={handleSaveGame}
                  disabled={loading || completedTasks === 0}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Creating Game...' : 'Create Game'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
