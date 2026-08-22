import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { getShopQrCode } from '@/services/superAdmin';
import { getApiErrorMessage } from '@/utils/apiError';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';
import ErrorState from '@/components/ErrorState';

interface QrCodeModalProps {
  shopId: number;
  shopName: string;
  shopSlug: string;
  onClose: () => void;
}

export default function QrCodeModal({ shopId, shopName, shopSlug, onClose }: QrCodeModalProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['super-admin', 'shops', shopId, 'qr-code'],
    queryFn: () => getShopQrCode(shopId),
  });

  // Derived during render (not via setState-in-effect) so there's no extra
  // render pass; the effect below only handles the cleanup side effect --
  // revoking the previous blob: URL once it's no longer displayed.
  const objectUrl = useMemo(() => (data ? URL.createObjectURL(data) : null), [data]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  return (
    <Modal title={`QR Code -- ${shopName}`} onClose={onClose} widthClassName="max-w-sm">
      <div className="flex flex-col items-center">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}

        {isError && (
          <ErrorState
            message={getApiErrorMessage(error, 'Could not generate the QR code.')}
            onRetry={() => refetch()}
          />
        )}

        {objectUrl && (
          <>
            <img
              src={objectUrl}
              alt={`QR code linking to ${shopName}'s catalog`}
              className="h-56 w-56 rounded-lg border border-neutral-200 p-2"
            />
            <p className="mt-3 text-center text-sm text-neutral-500">
              Scans straight to <span className="font-medium text-neutral-700">/shop/{shopSlug}</span>
            </p>
            <a
              href={objectUrl}
              download={`${shopSlug}-qr-code.png`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Download className="h-4 w-4" />
              Download PNG
            </a>
          </>
        )}
      </div>
    </Modal>
  );
}
