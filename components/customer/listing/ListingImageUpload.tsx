import React, { useState, useRef } from 'react';
import { Upload, X, Loader } from 'lucide-react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../../../utils/imageOptimizer';
import { logger } from '../../../utils/logger';

interface ListingImageUploadProps {
  images: string[];
  onImagesChange: (urls: string[]) => void;
  maxImages?: number;
  sellerId: string;
  listingId?: string;
}

/**
 * ListingImageUpload — Drag & drop image uploader for marketplace listings.
 * Uploads to Firebase Storage at: listings/{sellerId}/{listingId}/image_{timestamp}
 */
export const ListingImageUpload: React.FC<ListingImageUploadProps> = ({
  images,
  onImagesChange,
  maxImages = 5,
  sellerId,
  listingId,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (images.length >= maxImages) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const compressed = await compressImage(file);
      const storage = getStorage();
      const timestamp = Date.now();
      const path = `listings/${sellerId}/${listingId || 'new'}/image_${timestamp}.jpg`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, compressed);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
      onImagesChange([...images, downloadUrl]);
    } catch (error) {
      logger.error('Image upload failed:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {images.length < maxImages && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader size={24} className="animate-spin text-emerald-600" />
              <span className="text-sm text-gray-500">Subiendo... {uploadProgress}%</span>
              <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-500">
                Arrastra imágenes o haz clic para subir
              </span>
              <span className="text-[11px] text-gray-400">
                {images.length}/{maxImages} imágenes · JPG, PNG, WEBP
              </span>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};

export default ListingImageUpload;