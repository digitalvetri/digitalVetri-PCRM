import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * DigitalVetri brand lockup: the DV monogram tile + the "DigitalVetri.AI"
 * wordmark. The monogram PNG is self-contained (cream on royal blue) so it
 * sits cleanly on any surface; the wordmark is rendered as text so it stays
 * crisp and inherits the parent's text color (with the ".AI" always in the
 * brand red). Use `wordmark={false}` for a compact icon-only lockup.
 */
export function Logo({
  className,
  tileSize = 36,
  wordmark = true,
  subtitle,
  wordmarkClassName,
}: {
  className?: string;
  tileSize?: number;
  wordmark?: boolean;
  subtitle?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/brand/dv-monogram.png"
        alt="DigitalVetri"
        width={tileSize}
        height={tileSize}
        priority
        className="rounded-[0.55rem] shadow-sm ring-1 ring-white/10"
        style={{ width: tileSize, height: tileSize }}
      />
      {wordmark && (
        <span className="flex flex-col leading-none">
          <span className={cn("text-[15px] font-bold tracking-tight", wordmarkClassName)}>
            DigitalVetri<span className="text-brand-red">.AI</span>
          </span>
          {subtitle && (
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] opacity-70">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
