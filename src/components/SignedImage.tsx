import { useEffect, useState } from 'react';
import { getSignedUrl } from '../lib/storage';

export function SignedImage({
  bucket, path, className, alt = '',
}: {
  bucket: string; path: string | null | undefined; className?: string; alt?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!path) return;
    let active = true;
    getSignedUrl(bucket, path).then((u) => { if (active) setUrl(u); }).catch(() => {});
    return () => { active = false; };
  }, [bucket, path]);

  if (!path || !url) return <div className={className} />;
  return <img src={url} className={className} alt={alt} loading="lazy" />;
}
