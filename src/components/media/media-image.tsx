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
 * Catalogue / storage media image. Bypasses Next/Vercel optimization for signed
 * and private-storage URLs so posters keep loading when the optimizer quota is exhausted.
 */
export function MediaImage({
  src,
  alt,
  className,
  fallbackClassName,
  onError,
  unoptimized,
  ...rest
}: MediaImageProps) {
  const [failed, setFailed] = useState(false);
  const bypass = unoptimized ?? shouldBypassImageOptimization(src);

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
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
