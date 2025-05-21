export default function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={`size-5 animate-spin rounded-full border-4 border-primary border-t-white ${className}`}
    ></div>
  );
}
