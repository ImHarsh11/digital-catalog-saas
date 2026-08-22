import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { deleteProductImage, setPrimaryImage, uploadProductImage } from '@/services/products';
import { getApiErrorMessage } from '@/utils/apiError';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { ProductImage } from '@/types/product';

interface ProductImageManagerProps {
  shopId: number;
  productId: number;
  images: ProductImage[];
  primaryImageUrl: string | null;
}

interface InFlightUpload {
  id: string;
  name: string;
  progress: number;
}

export default function ProductImageManager({
  shopId,
  productId,
  images,
  primaryImageUrl,
}: ProductImageManagerProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [uploads, setUploads] = useState<InFlightUpload[]>([]);
  const [imageToDelete, setImageToDelete] = useState<ProductImage | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['shop-owner', 'product', shopId, productId] });
    queryClient.invalidateQueries({ queryKey: ['shop-owner', 'products', shopId] });
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    // Uploaded one at a time -- simpler to reason about than a parallel
    // batch, and keeps each progress bar meaningful on a slow connection.
    for (const file of Array.from(fileList)) {
      const uploadId = `${file.name}-${Date.now()}-${Math.random()}`;
      setUploads((prev) => [...prev, { id: uploadId, name: file.name, progress: 0 }]);
      try {
        await uploadProductImage(shopId, productId, file, (percent) => {
          setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: percent } : u)));
        });
        invalidate();
      } catch (err) {
        showToast('error', getApiErrorMessage(err, `Could not upload ${file.name}.`));
      } finally {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      }
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (imageId: number) => deleteProductImage(shopId, productId, imageId),
    onSuccess: () => {
      invalidate();
      showToast('success', 'Photo deleted.');
      setImageToDelete(null);
    },
    onError: (err) => showToast('error', getApiErrorMessage(err, 'Could not delete this photo.')),
  });

  const primaryMutation = useMutation({
    mutationFn: (imageId: number) => setPrimaryImage(shopId, productId, imageId),
    onSuccess: () => {
      invalidate();
      showToast('success', 'Primary photo updated.');
    },
    onError: (err) => showToast('error', getApiErrorMessage(err, 'Could not set the primary photo.')),
  });

  return (
    <div>
      <h2 className="text-sm font-semibold text-neutral-900">Photos</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Add a few clear photos. The starred photo is shown first in your catalog.
      </p>

      <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-6 py-8 text-center hover:border-brand-400 hover:bg-brand-50/40">
        <Upload className="h-6 w-6 text-neutral-400" />
        <span className="text-sm font-medium text-neutral-700">Tap to add photos</span>
        <span className="text-xs text-neutral-400">JPEG, PNG or WebP, up to 5MB each</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {uploads.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploads.map((upload) => (
            <div key={upload.id} className="rounded-lg border border-neutral-200 bg-white p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="truncate text-neutral-600">{upload.name}</span>
                <span className="text-neutral-400">{upload.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-brand-600 transition-all"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && uploads.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">No photos yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image) => {
            const isPrimary = image.image_url === primaryImageUrl;
            return (
              <div key={image.id} className="relative overflow-hidden rounded-lg border border-neutral-200">
                <img src={image.image_url} alt="" className="h-28 w-full object-cover" />
                {isPrimary && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    Primary
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-1.5 py-1">
                  {!isPrimary ? (
                    <button
                      type="button"
                      onClick={() => primaryMutation.mutate(image.id)}
                      disabled={primaryMutation.isPending}
                      className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-50"
                      title="Set as primary"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => setImageToDelete(image)}
                    className="rounded p-1 text-white hover:bg-white/20"
                    title="Delete photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {imageToDelete && (
        <ConfirmDialog
          title="Delete photo"
          message="This photo will be permanently removed from the product."
          confirmLabel="Delete"
          isDestructive
          isSubmitting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(imageToDelete.id)}
          onCancel={() => setImageToDelete(null)}
        />
      )}
    </div>
  );
}
