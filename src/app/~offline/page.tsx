export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-xl font-semibold">Sin conexión</h1>
      <p className="text-neutral-400">
        No hay conexión a internet. Intenta de nuevo cuando tengas conexión.
      </p>
    </main>
  );
}
