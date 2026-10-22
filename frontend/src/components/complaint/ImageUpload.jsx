import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function ImageUpload({ images, onImagesChange, maxImages = 5, className }) {
    const fileInputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);
    const { toast } = useToast();

    const handleFiles = (files) => {
        if (!files) return;
        const validFiles = [];
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/jfif', 'image/png', 'image/x-png', 'image/webp'];
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        let rejectedReason = null;

        Array.from(files).forEach((file) => {
            const mime = (file.type || '').toLowerCase();
            const ext = (file.name || '').substring((file.name || '').lastIndexOf('.')).toLowerCase();
            const isValidMime = allowedTypes.includes(mime);
            const isValidExt = allowedExtensions.includes(ext);

            if (!isValidMime && !isValidExt) {
                rejectedReason = `"${file.name}" is not a supported format. Please upload JPG, PNG, or WebP images.`;
                return;
            }
            if (file.size > maxSize) {
                rejectedReason = `"${file.name}" exceeds the 10MB size limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`;
                return;
            }
            if (images.length + validFiles.length < maxImages) {
                validFiles.push(file);
            } else {
                rejectedReason = `Maximum ${maxImages} images allowed.`;
            }
        });

        if (rejectedReason) {
            toast({
                title: 'Photo Upload Notice',
                description: rejectedReason,
                variant: 'destructive',
            });
        }

        if (validFiles.length > 0) {
            onImagesChange([...images, ...validFiles]);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
    };

    const removeImage = (index) => {
        const newImages = images.filter((_, i) => i !== index);
        onImagesChange(newImages);
    };

    const getPreviewUrl = (file) => {
        return URL.createObjectURL(file);
    };

    return (
        <div className={cn('space-y-4', className)}>
            {/* Upload Area */}
            <div
                className={cn(
                    'rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all',
                    dragActive
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-secondary/30 hover:bg-secondary/50',
                    images.length >= maxImages && 'opacity-50 cursor-not-allowed'
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => images.length < maxImages && fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                    disabled={images.length >= maxImages}
                />
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-medium">
                    {images.length >= maxImages
                        ? `Maximum ${maxImages} images uploaded`
                        : 'Drag and drop photos or click to browse'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WebP • Max 10MB each • {images.length}/{maxImages} uploaded
                </p>
            </div>

            {/* Preview Grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {images.map((file, index) => (
                        <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-secondary">
                            <img src={getPreviewUrl(file)} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(getPreviewUrl(file), '_blank');
                                    }}
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="destructive"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeImage(index);
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-foreground/80 text-background text-[10px] px-2 py-1 truncate">
                                {file.name}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
