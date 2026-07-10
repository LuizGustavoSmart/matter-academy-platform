import { useState } from 'react';
import { getSignedUrl } from '../lib/storage';

export function FileLink({
  bucket, path, className, children,
}: {
  bucket: string; path: string; className?: string; children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const url = await getSignedUrl(bucket, path);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={open} disabled={loading} className={className}>
      {loading ? 'Abrindo...' : children}
    </button>
  );
}
