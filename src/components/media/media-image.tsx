"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { shouldBypassImageOptimization } from "@/lib/should-bypass-image-optimization";

type MediaImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string;
  alt: string;
  /** Optional class applied when the image fails to load. */
  fallbackClassName?: string;
};

/**
 * Catalogue / storage media image.
 * Uses Next Image Optimization for stable catalogue/CDN URLs; bypasses only for
 * signed query strings and GIFs so Vercel transform quota stays healthy at scale.
 */
export function MediaImage({
  src,
  alt,
  className,
  fallbackClassName,
  onError,
  unoptimized,
  loading,
  priority,
  ...rest
}: MediaImageProps) {
  const [failed, setFailed] = useState(false);
  const bypass = unoptimized ?? shouldBypassImageOptimization(src);
  const resolvedLoading = priority ? "eager" : loading ?? "lazy";

  if (failed || !src) {
    return (
      <div
        className={fallbackClassName ?? className}
        aria-hidden={alt ? undefined : true}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      />
    );
  }

  return (
    <Image
      {...rest}
      src={src}
      alt={alt}
      className={className}
      unoptimized={bypass}
      priority={priority}
      loading={resolvedLoading}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
