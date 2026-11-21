import { hourLabel, hourRangeLabel, peakIndex, type ByHour } from "@/lib/admin/by-hour";
import { dayLabel, percent } from "@/lib/admin/usage";

const people = (n: number) => `${n.toLocaleString("es-AR")} ${n === 1 ? "persona" : "personas"}`;

/**
 * "Personas que entraron por hora (aprox.)": the last 24 hours (Buenos Aires) with the busiest hour
 * labelled, and the busiest hour of each of the last 14 days. Plain CSS bars; hover shows the value.
 */
export function HourlyChart({ data }: { data: ByHour }) {
  const hourPeak = peakIndex(data.hours.map((h) => h.users));
  const dayPeak = peakIndex(data.days.map((d) => d.peak));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="font-semibold">Últimas 24 horas</span>
          <span className="text-muted tabular-nums">
            {hourPeak >= 0
              ? `Pico: ${people(data.hours[hourPeak].users)} de ${hourRangeLabel(data.hours[hourPeak].hour)}`
              : "Sin visitas registradas"}
          </span>
        </div>
        <Bars
          height="h-28"
          label="Personas que entraron en cada hora de las últimas 24 horas"
          peak={hourPeak}
          bars={data.hours.map((h) => ({ key: h.hour, value: h.users, title: `${hourRangeLabel(h.hour)}: ${people(h.users)}` }))}
          axis={data.hours.map((h, i) => (i % 6 === 0 || i === data.hours.length - 1 ? (i === data.hours.length - 1 ? "ahora" : hourLabel(h.hour)) : ""))}
        />
      </div>

      {data.days.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-semibold">Hora pico de cada día, últimos 14 días</span>
            {dayPeak >= 0 && (
              <span className="text-muted tabular-nums">
                Máximo: {people(data.days[dayPeak].peak)} ({dayLabel(data.days[dayPeak].day)})
              </span>
            )}
          </div>
          <Bars
            height="h-16"
            label="Personas en la hora pico de cada uno de los últimos 14 días"
            peak={dayPeak}
            bars={data.days.map((d) => ({
              key: d.day,
              value: d.peak,
              title: `${dayLabel(d.day)}: ${people(d.peak)} en la hora pico`,
            }))}
            axis={data.days.map((d, i) => (i === 0 || i === 7 ? dayLabel(d.day) : i === data.days.length - 1 ? "hoy" : ""))}
          />
        </div>
      )}

      <p className="text-[13px] text-muted">
        Aproximado: cada alumno cuenta como mucho una vez por hora, en la hora en que entró; si sigue usando la app en la hora
        siguiente, puede no volver a contar. Se guardan 15 días.
      </p>
    </div>
  );
}

function Bars({
  bars,
  axis,
  peak,
  height,
  label,
}: {
  bars: { key: string; value: number; title: string }[];
  axis: string[];
  peak: number;
  height: string;
  label: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <figure className="m-0 flex flex-col gap-1">
      <ol aria-label={label} className={`flex ${height} items-end gap-[2px] border-b border-line`}>
        {bars.map((b, i) => (
          <li key={b.key} title={b.title} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <span className="sr-only">{b.title}</span>
            {i === peak && (
              <span aria-hidden="true" className="pointer-events-none mb-0.5 text-center text-[11px] font-semibold text-ink-2 tabular-nums">
                {b.value.toLocaleString("es-AR")}
              </span>
            )}
            <span
              aria-hidden="true"
              className={`block rounded-t-[4px] ${b.value > 0 ? "bg-accent group-hover:brightness-110" : "bg-line"}`}
              // 80 % at most, so the label of the peak fits above its bar.
              style={{ height: b.value > 0 ? `max(${percent(b.value, max) * 0.8}%, 3px)` : "2px" }}
            />
          </li>
        ))}
      </ol>
      <div aria-hidden="true" className="flex h-4 gap-[2px] text-[11px] text-muted tabular-nums">
        {axis.map((a, i) => (
          <span key={i} className="relative min-w-0 flex-1">
            {a && <span className={`absolute whitespace-nowrap ${i === axis.length - 1 ? "right-0" : "left-0"}`}>{a}</span>}
          </span>
        ))}
      </div>
    </figure>
  );
}
