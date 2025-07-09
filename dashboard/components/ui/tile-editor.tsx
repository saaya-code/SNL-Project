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

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setImageFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setFormData(prev => ({ 
      ...prev, 
      imageUrl: '', 
      uploadedImageUrl: '', 
      uploadedImageName: '' 
    }))
  }

  const handleSave = async () => {
    const updates: any = {}
    
    // Handle image upload if there's a new file
    let taskData = {
      name: formData.name,
      description: formData.description,
      imageUrl: formData.imageUrl,
      uploadedImageUrl: formData.uploadedImageUrl,
      uploadedImageName: formData.uploadedImageName
    }
    
    if (imageFile) {
      // Convert image to base64
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target?.result as string
        taskData.uploadedImageUrl = base64
        taskData.uploadedImageName = imageFile.name
        taskData.imageUrl = '' // Clear URL if uploading file
        
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
      reader.readAsDataURL(imageFile)
    } else {
      // No new image upload, just update with existing data
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
              </div>
            </label>
            
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
