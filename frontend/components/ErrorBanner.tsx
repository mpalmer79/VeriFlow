export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-severity-critical/40 bg-severity-critical/10 px-4 py-3 text-sm text-severity-critical">
      {message}
    </div>
  );
}
