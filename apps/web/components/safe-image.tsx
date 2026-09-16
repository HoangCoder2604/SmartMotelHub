"use client";

import { useState } from "react";

type SafeImageProps = {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
};

export function SafeImage({ src, alt, className, eager = false }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className={`smart-image-fallback ${className ?? ""}`.trim()}>Ảnh không khả dụng</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
