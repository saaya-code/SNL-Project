'use client'

import { useState } from 'react'
import { CheckCircle, Upload, X } from 'lucide-react'

interface TileEditorProps {
  tileNumber: number
  initialData: any
  onSave: (tileNumber: number, updates: any) => void
  onCancel: () => void
  loading: boolean
}

export default function TileEditor({ tileNumber, initialData, onSave, onCancel, loading }: TileEditorProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    imageUrl: initialData?.imageUrl || '',
    uploadedImageUrl: initialData?.uploadedImageUrl || '',
    uploadedImageName: initialData?.uploadedImageName || ''
  })
  
  const [snakeLadderData, setSnakeLadderData] = useState({
    type: 'none' as 'none' | 'snake' | 'ladder',
    destination: ''
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  // Image compression function
  const compressImage = (file: File, maxSizeKB: number = 500): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions (max 800x600 to reduce size)
        let { width, height } = img
        const maxWidth = 800
        const maxHeight = 600

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height

        // Fill with white background for PNG transparency
        ctx!.fillStyle = '#ffffff'
        ctx!.fillRect(0, 0, width, height)

        // Draw the image
        ctx?.drawImage(img, 0, 0, width, height)
        
        // Convert everything to JPEG for consistency and better compression
        let quality = 0.9 // Start with good quality
        let result = canvas.toDataURL('image/jpeg', quality)
        
        // Reduce quality until size is acceptable
        while (result.length > maxSizeKB * 1024 * 4/3 && quality > 0.4) { // Base64 is ~4/3 of binary size
          quality -= 0.1
          result = canvas.toDataURL('image/jpeg', quality)
        }

        const finalSizeKB = Math.round((result.length * 3) / 4 / 1024)
        console.log(`Compressed image to JPEG: ${finalSizeKB}KB (quality: ${quality})`)

        if (finalSizeKB > maxSizeKB * 2) { // Allow PNG to be a bit larger due to transparency
          reject(new Error(`Image too large: ${finalSizeKB}KB. Please use a smaller image.`))
        } else {
          resolve(result)
        }
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImageError(null)

    // Check file size (limit to 5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image file too large. Please select an image under 5MB.')
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file.')
      return
    }

    try {
      setImageFile(file)
      
      // Compress the image
      const compressedBase64 = await compressImage(file, 500) // 500KB limit
      setImagePreview(compressedBase64)
      
      // Update form data with compressed image and clear old image URL
      setFormData(prev => ({
        ...prev,
        uploadedImageUrl: compressedBase64,
        uploadedImageName: file.name,
        imageUrl: '' // Clear URL when uploading a new file
      }))
    } catch (error) {
      console.error('Image compression failed:', error)
      setImageError(error instanceof Error ? error.message : 'Failed to process image')
      setImageFile(null)
      setImagePreview(null)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setImageError(null)
    setFormData(prev => ({ 
      ...prev, 
      imageUrl: '',
      uploadedImageUrl: '',
      uploadedImageName: ''
    }))
  }

  const handleSave = async () => {
    const updates: any = {}
    
    // Handle task data
    let taskData = {
      name: formData.name,
      description: formData.description,
      imageUrl: formData.imageUrl,
      uploadedImageUrl: formData.uploadedImageUrl,
      uploadedImageName: formData.uploadedImageName
    }
    
    // Update tile task data
    if (taskData.name || taskData.description || taskData.imageUrl || taskData.uploadedImageUrl) {
      updates.task = taskData
    }
    
    // Update snake/ladder data
    if (snakeLadderData.type !== 'none' && snakeLadderData.destination) {
      updates.snakeLadder = {
        type: snakeLadderData.type,
        destination: parseInt(snakeLadderData.destination)
      }
    } else if (snakeLadderData.type === 'none') {
      // Remove snake/ladder
      updates.snakeLadder = null
    }
    
    onSave(tileNumber, updates)
  }

  return (
    <div className="space-y-6">
      {/* Tile Info */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h4 className="font-bold text-white mb-2">Tile Information</h4>
        <div className="text-sm text-gray-300">
          Tile Number: {tileNumber}
        </div>
      </div>

      {/* Task Content */}
      <div className="space-y-4">
        <h4 className="font-bold text-white">Task Content</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Task Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter task name..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Task Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter task description..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Image URL
          </label>
          <input
            type="url"
            value={formData.imageUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter image URL..."
            disabled={!!imageFile}
          />
        </div>

        <div className="text-center text-gray-400">
          <div className="text-sm mb-2">OR</div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Upload Image
          </label>
          <div className="space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
            >
              <div className="text-center">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-300">Click to upload image</p>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                <p className="text-xs text-blue-400 mt-1">Images are automatically compressed to under 500KB</p>
              </div>
            </label>
            
            {/* Error Message */}
            {imageError && (
              <div className="bg-red-600/20 border border-red-600/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{imageError}</p>
              </div>
            )}
            
            {/* Image Preview */}
            {(imagePreview || formData.uploadedImageUrl) && (
              <div className="relative">
                <img
                  src={imagePreview || formData.uploadedImageUrl}
                  alt="Preview"
                  className="w-full max-w-xs mx-auto rounded-lg"
                />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                {imageFile && (
                  <div className="mt-2 text-center">
                    <p className="text-xs text-green-400">✓ Image compressed and ready</p>
                  </div>
                )}
              </div>
            )}
            
            {formData.uploadedImageName && (
              <p className="text-sm text-gray-400 text-center">
                Current: {formData.uploadedImageName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Snake/Ladder Configuration */}
      <div className="space-y-4">
        <h4 className="font-bold text-white">Snake/Ladder Configuration</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Type
          </label>
          <select
            value={snakeLadderData.type}
            onChange={(e) => setSnakeLadderData(prev => ({ ...prev, type: e.target.value as any }))}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="none">None</option>
            <option value="snake">Snake (goes down)</option>
            <option value="ladder">Ladder (goes up)</option>
          </select>
        </div>

        {snakeLadderData.type !== 'none' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Destination Tile
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={snakeLadderData.destination}
              onChange={(e) => setSnakeLadderData(prev => ({ ...prev, destination: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Enter destination tile (${snakeLadderData.type === 'snake' ? 'lower' : 'higher'} number)`}
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 px-6 rounded transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-5 h-5" />
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white py-3 px-6 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
