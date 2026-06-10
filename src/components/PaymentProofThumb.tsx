import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  value: string | null;
}

/**
 * Renders a payment proof thumbnail/link.
 * - If `value` is a full http(s) URL (legacy public-bucket records), it extracts
 *   the storage path from the URL and creates a signed URL.
 * - If `value` is already a storage path (new records), creates a signed URL directly.
 */
export function PaymentProofThumb({ value }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!value) {
        setLoading(false);
        return;
      }
      let path = value;
      const marker = "/payment-proofs/";
      const idx = value.indexOf(marker);
      if (idx !== -1) path = value.slice(idx + marker.length);

      const { data, error } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(path, 60 * 60);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setUrl(null);
      } else {
        setUrl(data.signedUrl);
      }
      setLoading(false);
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  if (loading) return <span className="text-xs text-muted-foreground">Loading…</span>;
  if (!url) return <span className="text-xs text-destructive">Unavailable</span>;

  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) || /\.(jpg|jpeg|png|gif|webp)$/i.test(value);

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
      {isImage ? (
        <img
          src={url}
          alt="Payment proof"
          className="h-12 w-12 object-cover rounded border border-border hover:opacity-80 transition-opacity"
        />
      ) : (
        <Badge variant="outline" className="cursor-pointer">View File</Badge>
      )}
    </a>
  );
}
