"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  targetRef: React.RefObject<HTMLDivElement | null>;
}

export function CopyScreenshotButton({ targetRef }: Props) {
  const [loading, setLoading] = useState(false);

  const handleCopy = async () => {
    const el = targetRef.current;
    if (!el) return;

    setLoading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
      });
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("Report copied as image");
    } catch (err) {
      console.error("Screenshot copy failed:", err);
      toast.error("Failed to copy — browser may not support clipboard images");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={handleCopy}
      disabled={loading}
      title="Copy as image"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
