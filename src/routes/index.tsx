import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, RefreshCw } from "lucide-react";
import { getXeRates, type Quote } from "@/lib/fx.functions";
import { getForecasts } from "@/lib/forecast.functions";

export const Route = createFileRoute("/")({ component: Home });

const NAMES: Record<string, string> = {
  AUDUSD: "Australian dollar",
  SGDUSD: "Singapore dollar",
  CHFUSD: "Swiss franc",
  EURUSD: "Euro",
  HKDUSD: "Hong Kong dollar",
  AUDSGD: "Australian dollar",
};

function formatRate(n: number) {
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function formatSigned(n: number) {
  const body = Math.abs(n) >= 0.01 ? Math.abs(n).toFixed(4) : Math.abs(n).toFixed(5);
  return `${n >= 0 ? "+" : "−"}${body}`;
}

function formatPct(n: number) {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`;
}

function Home() {
  const query = useQuery({
    queryKey: ["xe-rates"],
    queryFn: () => getXeRates(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

  const quotes = query.data?.quotes ?? [];
  const forecast = useQuery({
    queryKey: ["wi-forecast"],
    queryFn: () => getForecasts(),
    staleTime: 6 * 60 * 60 * 1000,
  });
  const [forecastId, setForecastId] = useState("EURUSD");
  const forecastPair = forecast.data?.pairs.find((p) => p.id === forecastId);
  const [base, setBase] = useState("EURUSD");
  const [amount, setAmount] = useState("1000");
  const [history, setHistory] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (!quotes.length) return;
    setHistory((prev) => {
      const next = { ...prev };
      for (const q of quotes) {
        const series = next[q.id] ? [...next[q.id]] : [];
        if (series[series.length - 1] !== q.rate) series.push(q.rate);
        next[q.id] = series.slice(-16);
      }
      return next;
    });
  }, [quotes]);

  const selected = quotes.find((q) => q.id === base);
  const usd = useMemo(() => {
    const n = Number(amount.replace(/,/g, ""));
    if (!selected || !Number.isFinite(n)) return null;
    return n * selected.rate;
  }, [amount, selected]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-primary">XE.com mid-market</p>
          <h1 className="mt-1 font-display text-4xl leading-none text-fg sm:text-5xl">
            Rate desk
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            Live quotes versus the XE chart print at 00:00 UTC (prior day’s close).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted">
            {query.data
              ? `XE quote ${new Date(query.data.quotes[0]?.asOf ?? query.data.fetchedAt).toLocaleTimeString()} · checked ${new Date(query.data.fetchedAt).toLocaleTimeString()}`
              : query.isLoading
                ? "Fetching XE…"
                : "Waiting"}
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {query.isError && (
        <p className="mb-6 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-down">
          Could not read XE right now. Try refresh.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quotes.length === 0 && query.isLoading
          ? ["AUDUSD", "SGDUSD", "CHFUSD", "EURUSD", "HKDUSD", "AUDSGD"].map((code) => (
              <div key={code} className="h-40 rounded-2xl border border-border bg-surface" />
            ))
          : quotes.map((q) => (
              <RateCard
                key={q.id}
                quote={q}
                series={[q.close, ...(history[q.id] ?? [q.rate])]}
                active={q.id === base}
                onSelect={() => setBase(q.id)}
              />
            ))}
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted">
          <ArrowLeftRight className="size-4 text-primary" />
          Convert into {selected?.quote ?? "USD"}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <label className="block">
            <span className="text-xs text-muted">Amount</span>
            <div className="mt-1 flex h-12 items-center rounded-xl border border-border bg-surface-2 px-3">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent text-lg font-semibold outline-none"
                aria-label="Amount"
              />
              <select
                value={base}
                onChange={(e) => setBase(e.target.value)}
                className="bg-transparent text-sm font-medium text-fg outline-none"
                aria-label="Currency"
              >
                {Object.keys(NAMES).map((code) => (
                  <option key={code} value={code} className="bg-surface">
                    {code.slice(0, 3)}/{code.slice(3)}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <span className="hidden pb-3 text-muted sm:block">=</span>
          <div>
            <span className="text-xs text-muted">{selected?.quote === "SGD" ? "Singapore dollars" : "US dollars"}</span>
            <p className="mt-1 flex h-12 items-center font-display text-3xl text-fg">
              {usd == null
                ? "—"
                : usd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </p>
          </div>
        </div>
        {selected && (
          <p className="mt-4 text-xs text-muted">
            1 {selected.base} = {formatRate(selected.rate)} {selected.quote}
            {selected.asOf ? ` · mid-market at ${selected.asOf}` : ""}
            {" · "}
            1 {selected.quote} = {formatRate(1 / selected.rate)} {selected.base}
            {" · "}
            {formatSigned(selected.change)} ({formatPct(selected.changePct)}) vs {selected.closeDate} close{" "}
            {formatRate(selected.close)} at 00:00 UTC {selected.closeAt.slice(0, 10)}
          </p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary">WalletInvestor</p>
            <h2 className="mt-1 font-display text-3xl text-fg">Forecast</h2>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-muted">
              Daily model targets, with the published downside and upside. These are projections, not a quote and not advice.
            </p>
          </div>
          <label className="block">
            <span className="text-xs text-muted">Pair</span>
            <select
              value={forecastId}
              onChange={(e) => setForecastId(e.target.value)}
              className="mt-1 h-11 rounded-xl border border-border bg-surface-2 px-3 text-sm font-medium text-fg"
              aria-label="Forecast pair"
            >
              {(forecast.data?.pairs ?? Object.keys(NAMES).map((id) => ({ id, label: `${id.slice(0, 3)}/${id.slice(3)}` }))).map(
                (pair) => (
                  <option key={pair.id} value={pair.id} className="bg-surface">
                    {pair.label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        {forecast.isError && (
          <p className="mt-4 text-sm text-down">Could not load WalletInvestor forecasts.</p>
        )}
        {forecast.isLoading && <p className="mt-4 text-sm text-muted">Loading forecasts…</p>}
        {forecastPair && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 text-right font-medium">Forecast</th>
                  <th className="py-2 text-right font-medium">Downside</th>
                  <th className="py-2 text-right font-medium">Upside</th>
                </tr>
              </thead>
              <tbody>
                {forecastPair.days.map((row) => (
                  <tr key={row.date} className="border-t border-border">
                    <td className="py-2 text-muted">{row.date}</td>
                    <td className="py-2 text-right font-display text-lg text-fg">{formatRate(row.forecast)}</td>
                    <td className="py-2 text-right text-down">{formatRate(row.low)}</td>
                    <td className="py-2 text-right text-primary">{formatRate(row.high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {forecast.data?.note && (
              <p className="mt-3 text-xs text-muted">{forecast.data.note}</p>
            )}
          </div>
        )}
      </section>

      <footer className="mt-8 text-xs leading-relaxed text-muted">
        Source: live rates from XE. Daily forecasts are WalletInvestor model targets, not quotes and not advice. The previous close is the XE chart rate at 00:00 UTC.
      </footer>
    </main>
  );
}

function RateCard({
  quote,
  series,
  active,
  onSelect,
}: {
  quote: Quote;
  series: number[];
  active: boolean;
  onSelect: () => void;
}) {
  const up = quote.change >= 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border bg-surface p-4 text-left transition-colors ${
        active ? "border-primary" : "border-border hover:border-muted"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">
          {quote.base}/{quote.quote}
        </span>
        <span className={`text-xs font-medium ${up ? "text-primary" : "text-down"}`}>
          {formatPct(quote.changePct)}
        </span>
      </div>
      <p className="mt-2 font-display text-3xl leading-none">{formatRate(quote.rate)}</p>
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">00:00 UTC close</dt>
          <dd className="font-medium text-fg">{formatRate(quote.close)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">{quote.closeDate}</dt>
          <dd className={`font-medium ${up ? "text-primary" : "text-down"}`}>
            {formatSigned(quote.change)} · {formatPct(quote.changePct)}
          </dd>
        </div>
      </dl>
      <Spark series={series} up={up} />
    </button>
  );
}

function Spark({ series, up }: { series: number[]; up: boolean }) {
  const w = 120;
  const h = 28;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series
    .map((v, i) => {
      const x = series.length === 1 ? w : (i / (series.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-7 w-full" aria-hidden>
      <polyline
        fill="none"
        stroke={up ? "var(--color-primary)" : "var(--color-down)"}
        strokeWidth="2"
        points={pts}
      />
    </svg>
  );
}
