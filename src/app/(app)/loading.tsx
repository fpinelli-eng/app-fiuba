// Mientras el servidor arma la sección, se ve su esqueleto apenas se toca el menú
// (la barra superior queda fija). Next.js también lo precarga con los links del menú.
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Cargando" className="mx-auto flex w-full max-w-[1280px] animate-pulse flex-col gap-[22px] px-10 pt-9 pb-12">
      <div className="flex flex-col gap-3">
        <div className="h-3 w-48 rounded bg-disabled" />
        <div className="h-9 w-72 rounded-lg bg-disabled" />
      </div>
      <div className="flex flex-wrap gap-[22px]">
        <div className="h-64 min-w-0 flex-[999_1_560px] rounded-2xl border border-line bg-surface" />
        <div className="h-64 flex-[1_1_300px] rounded-2xl border border-line bg-surface" />
      </div>
      <div className="h-48 rounded-2xl border border-line bg-surface" />
    </main>
  );
}
