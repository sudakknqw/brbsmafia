/** The BRABUS wordmark from the logo, instead of a text title. */
export function Wordmark({ className = "" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/brabus.png" alt="" aria-hidden="true" width={1233} height={201} className={`max-w-none ${className}`} />;
}
