import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconClassName?: string;
  eager?: boolean;
}

/** Renders a product photo with a loading skeleton, and never lets a
 * missing url or a broken/404'd image break the layout -- falls back to a
 * neutral placeholder icon in both cases. */
export default function ProductImage({
  src,
  alt,
  className = '',
  iconClassName = 'h-8 w-8',
  eager = false,
}: ProductImageProps) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || errored) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 ${className}`}>
        <ImageOff className={`text-neutral-300 ${iconClassName}`} />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-neutral-100 ${className}`}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-neutral-200" />}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
