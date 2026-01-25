import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Image as ImageIcon, RefreshCw, ChevronDown, Folder, GripVertical, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface StorageFile {
  name: string;
  url: string;
}

interface StorageImagePickerProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  bucket?: string;
  folder?: string;
  maxImages?: number;
  singleImage?: boolean;
}

interface SortableImageProps {
  url: string;
  index: number;
  isMain: boolean;
  onRemove: () => void;
  onSetMain: () => void;
  singleImage: boolean;
}

const SortableImage = ({ url, index, isMain, onRemove, onSetMain, singleImage }: SortableImageProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative aspect-square group rounded-sm overflow-hidden border bg-muted",
        isDragging ? "z-50 opacity-80 border-primary shadow-lg" : "border-border",
        isMain && "ring-2 ring-primary"
      )}
    >
      {/* Drag handle */}
      {!singleImage && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute top-1 right-1 z-10 p-1 bg-background/90 rounded cursor-grab active:cursor-grabbing hover:bg-background transition-colors"
        >
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </button>
      )}

      <img
        src={url}
        alt={`Image ${index + 1}`}
        className="w-full h-full object-cover"
      />
      
      {/* Main badge */}
      {!singleImage && isMain && (
        <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
          <Star className="w-2.5 h-2.5 fill-current" />
          Main
        </div>
      )}

      {/* Hover actions */}
      <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {!singleImage && !isMain && (
          <button
            type="button"
            onClick={onSetMain}
            className="p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/80 transition-colors"
            title="Set as main image"
          >
            <Star className="w-3 h-3" />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/80 transition-colors"
          title="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export const StorageImagePicker = ({
  images,
  onImagesChange,
  bucket = "products",
  folder = "",
  maxImages = 10,
  singleImage = false,
}: StorageImagePickerProps) => {
  const [storageFiles, setStorageFiles] = useState<StorageFile[]>([]);
  const [storageFolders, setStorageFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder || undefined, { limit: 100 });

      if (error) {
        console.error("Error fetching folders:", error);
        return;
      }

      const folders = (data || [])
        .filter(item => !item.metadata && item.name !== '.emptyFolderPlaceholder')
        .map(item => item.name);

      setStorageFolders(folders);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  // Helper to check if a file is an image based on extension
  const isImageFile = (name: string): boolean => {
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
    return imageExtensions.test(name);
  };

  const fetchStorageFiles = async (targetFolder: string = selectedFolder) => {
    setLoadingStorage(true);
    try {
      const allFiles: StorageFile[] = [];
      const basePath = folder ? (targetFolder ? `${folder}/${targetFolder}` : folder) : targetFolder;
      
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
          
          // Check if it's an image file by extension OR has metadata (indicating it's a file, not folder)
          const hasFileMetadata = item.metadata && Object.keys(item.metadata).length > 0;
          const looksLikeImage = isImageFile(item.name);
          
          if (hasFileMetadata || looksLikeImage) {
            // It's a file - add it to the list
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fullPath);
            allFiles.push({ name: item.name, url: urlData.publicUrl });
          } else if (!item.metadata) {
            // It's likely a folder - recurse into it
            await fetchFromPath(fullPath);
          }
        }
      };

      await fetchFromPath(basePath);
      setStorageFiles(allFiles);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoadingStorage(false);
    }
  };

  useEffect(() => {
    if (showPicker) {
      fetchFolders();
      fetchStorageFiles();
    }
  }, [showPicker, bucket, folder]);

  useEffect(() => {
    if (showPicker) {
      fetchStorageFiles(selectedFolder);
    }
  }, [selectedFolder]);

  const handleFolderSelect = (folderName: string) => {
    setSelectedFolder(folderName);
    setShowFolderDropdown(false);
  };

  const addFromStorage = (url: string) => {
    if (singleImage) {
      onImagesChange([url]);
      toast.success("Image selected");
      return;
    }
    
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.indexOf(active.id as string);
      const newIndex = images.indexOf(over.id as string);
      const newImages = arrayMove(images, oldIndex, newIndex);
      onImagesChange(newImages);
    }
  };

  return (
    <div className="space-y-4">
      {/* Storage picker toggle */}
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-sm hover:border-primary/50 hover:bg-muted/50 transition-colors"
      >
        <ImageIcon className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {showPicker ? "Hide storage images" : "Choose from existing images"}
        </span>
        {!singleImage && (
          <span className="text-xs text-muted-foreground ml-2">({images.length}/{maxImages})</span>
        )}
      </button>

      {/* Storage picker */}
      {showPicker && (
        <div className="border border-border rounded-sm p-3 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Storage Images</span>
              
              {storageFolders.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-background border border-border rounded hover:bg-muted transition-colors"
                  >
                    <Folder className="w-3 h-3" />
                    {selectedFolder || "All folders"}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  
                  {showFolderDropdown && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded shadow-lg min-w-32 max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => handleFolderSelect("")}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors",
                          selectedFolder === "" && "bg-muted font-medium"
                        )}
                      >
                        All folders
                      </button>
                      {storageFolders.map((folderName) => (
                        <button
                          key={folderName}
                          type="button"
                          onClick={() => handleFolderSelect(folderName)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2",
                            selectedFolder === folderName && "bg-muted font-medium"
                          )}
                        >
                          <Folder className="w-3 h-3" />
                          {folderName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => fetchStorageFiles(selectedFolder)}
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
                  disabled={!singleImage && images.includes(file.url)}
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

      {/* Preview grid with drag-and-drop */}
      {images.length > 0 && (
        <div className="space-y-2">
          {!singleImage && images.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Drag images to reorder. First image is the main product image.
            </p>
          )}
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={images} strategy={rectSortingStrategy}>
              <div className={cn(
                "grid gap-3",
                singleImage ? "grid-cols-1 max-w-[120px]" : "grid-cols-3 md:grid-cols-5"
              )}>
                {images.map((url, index) => (
                  <SortableImage
                    key={url}
                    url={url}
                    index={index}
                    isMain={index === 0}
                    onRemove={() => removeImage(index)}
                    onSetMain={() => setAsMain(index)}
                    singleImage={singleImage}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
};
