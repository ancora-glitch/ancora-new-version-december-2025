import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Upload, Image as ImageIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StorageFile {
  name: string;
  url: string;
}

interface ImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  bucket?: string;
  folder?: string;
  maxImages?: number;
  showStoragePicker?: boolean;
}

export const ImageUploader = ({
  images,
  onImagesChange,
  bucket = "products",
  folder = "",
  maxImages = 10,
  showStoragePicker = true,
}: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [storageFiles, setStorageFiles] = useState<StorageFile[]>([]);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const fetchStorageFiles = async () => {
    setLoadingStorage(true);
    try {
      const allFiles: StorageFile[] = [];
      
      // Recursive function to fetch files from all subdirectories
      const fetchFromPath = async (path: string) => {
        const { data, error } = await supabase.storage
          .from(bucket)
          .list(path || undefined, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

        if (error) {
          console.error("Error fetching storage files:", error);
          return;
        }

        for (const item of data || []) {
          if (item.name === '.emptyFolderPlaceholder') continue;
          
          const fullPath = path ? `${path}/${item.name}` : item.name;
          
          // Check if it's a folder (no metadata means it's a folder)
          if (!item.metadata) {
            // It's a folder, recurse into it
            await fetchFromPath(fullPath);
          } else {
            // It's a file, add it to the list
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fullPath);
            allFiles.push({ name: item.name, url: urlData.publicUrl });
          }
        }
      };

      await fetchFromPath(folder);
      setStorageFiles(allFiles);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoadingStorage(false);
    }
  };

  useEffect(() => {
    if (showPicker) {
      fetchStorageFiles();
    }
  }, [showPicker, bucket, folder]);

  const addFromStorage = (url: string) => {
    if (images.includes(url)) {
      toast.error("Image already added");
      return;
    }
    if (images.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }
    onImagesChange([...images, url]);
    toast.success("Image added");
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${folder ? folder + "/" : ""}${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error } = await supabase.storage.from(bucket).upload(fileName, file);

    if (error) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload ${file.name}`);
      return null;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      toast.error("Please select image files only");
      return;
    }

    if (images.length + imageFiles.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);

    const uploadPromises = imageFiles.map((file) => uploadFile(file));
    const urls = await Promise.all(uploadPromises);
    const validUrls = urls.filter((url): url is string => url !== null);

    if (validUrls.length > 0) {
      onImagesChange([...images, ...validUrls]);
      toast.success(`${validUrls.length} image(s) uploaded`);
    }

    setUploading(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [images]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const setAsMain = (index: number) => {
    if (index === 0) return;
    const newImages = [...images];
    const [moved] = newImages.splice(index, 1);
    newImages.unshift(moved);
    onImagesChange(newImages);
    toast.success("Set as main image");
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-sm cursor-pointer transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          uploading && "opacity-50 pointer-events-none"
        )}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
          disabled={uploading}
        />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6" />
              <span className="text-sm">Drag images here or click to browse</span>
              <span className="text-xs">{images.length}/{maxImages} images</span>
            </>
          )}
        </div>
      </label>

      {/* Storage picker toggle */}
      {showStoragePicker && (
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <ImageIcon className="w-4 h-4" />
          {showPicker ? "Hide storage images" : "Choose from existing images"}
        </button>
      )}

      {/* Storage picker */}
      {showPicker && (
        <div className="border border-border rounded-sm p-3 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Storage Images</span>
            <button
              type="button"
              onClick={fetchStorageFiles}
              disabled={loadingStorage}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", loadingStorage && "animate-spin")} />
            </button>
          </div>
          
          {loadingStorage ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : storageFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No images in storage</p>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
              {storageFiles.map((file) => (
                <button
                  key={file.url}
                  type="button"
                  onClick={() => addFromStorage(file.url)}
                  disabled={images.includes(file.url)}
                  className={cn(
                    "aspect-square rounded-sm overflow-hidden border border-border hover:border-primary transition-colors",
                    images.includes(file.url) && "opacity-50 ring-2 ring-primary"
                  )}
                >
                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {images.map((url, index) => (
            <div
              key={url}
              className="relative aspect-square group rounded-sm overflow-hidden border border-border bg-muted"
            >
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              
              {/* Main badge */}
              {index === 0 && (
                <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                  Main
                </div>
              )}

              {/* Actions overlay */}
              <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {index !== 0 && (
                  <button
                    type="button"
                    onClick={() => setAsMain(index)}
                    className="p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/80 transition-colors"
                    title="Set as main"
                  >
                    <ImageIcon className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="p-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/80 transition-colors"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
