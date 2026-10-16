// Estrellas de solo lectura (puntaje de un curso o de una reseña). Colores del tema: text-star.
const PATH = "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z";

export function Stars({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  return (
    <span aria-label={label ?? `${value} de 5`} className="flex flex-none gap-px">
      {[1, 2, 3, 4, 5].map((k) => {
        // Media estrella cuando el promedio cae en el medio (4,5 → cuatro y media).
        const fill = value >= k ? 1 : value >= k - 0.5 ? 0.5 : 0;
        return (
          <svg key={k} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <clipPath id={`half-${k}`}>
                <rect x="0" y="0" width="12" height="24" />
              </clipPath>
            </defs>
            <path d={PATH} className="fill-none stroke-star" strokeWidth="1.4" strokeLinejoin="round" />
            {fill > 0 && <path d={PATH} className="fill-star" clipPath={fill < 1 ? `url(#half-${k})` : undefined} />}
          </svg>
        );
      })}
    </span>
  );
}

export function StarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="flex-none fill-star">
      <path d={PATH} />
    </svg>
  );
}
