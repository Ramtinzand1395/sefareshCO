import Image from "next/image";

export function BrandLogo({
  className = "w-36",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo-sefaresh.png"
      alt="سفارش"
      width={749}
      height={213}
      priority={priority}
      className={`h-auto ${className}`}
    />
  );
}
