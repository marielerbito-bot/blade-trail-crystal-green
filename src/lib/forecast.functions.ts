import { createServerFn } from "@tanstack/react-start";

const SLUGS = [
  { id: "AUDUSD", slug: "aud-usd", label: "AUD/USD" },
  { id: "SGDUSD", slug: "sgd-usd", label: "SGD/USD" },
  { id: "CHFUSD", slug: "chf-usd", label: "CHF/USD" },
  { id: "EURUSD", slug: "eur-usd", label: "EUR/USD" },
  { id: "HKDUSD", slug: "hkd-usd", label: "HKD/USD" },
  { id: "AUDSGD", slug: "aud-sgd", label: "AUD/SGD" },
] as const;

export type ForecastDay = {
  date: string;
  forecast: number;
  low: number;
  high: number;
};
export type PairForecast = { id: string; label: string; days: ForecastDay[] };
export type ForecastPayload = { pairs: PairForecast[]; fetchedAt: string; note: string };

function parseDays(html: string): ForecastDay[] {
  const rows: ForecastDay[] = [];
  const re =
    />(20\d\d-\d\d-\d\d)<\/span>[\s\S]*?<td data-label="Forecast"[^>]*>([0-9.]+)<\/td>[\s\S]*?<td data-label="Downside"[^>]*>([0-9.]+)<\/td>[\s\S]*?<td data-label="Upside"[^>]*>([0-9.]+)<\/td>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    rows.push({
      date: match[1],
      forecast: Number(match[2]),
      low: Number(match[3]),
      high: Number(match[4]),
    });
  }
  return rows;
}

async function page(slug: string, year: number): Promise<string> {
  const res = await fetch(
    `https://walletinvestor.com/forex-forecast/${slug}-prediction/data/${year}/`,
    {
      headers: { "user-agent": "Mozilla/5.0 (compatible; FXDesk/1.0)", accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) throw new Error(`forecast ${slug} ${res.status}`);
  return res.text();
}

let cache: { at: number; payload: ForecastPayload } | null = null;

export const getForecasts = createServerFn({ method: "GET" }).handler(
  async (): Promise<ForecastPayload> => {
    if (cache && Date.now() - cache.at < 6 * 60 * 60 * 1000) return cache.payload;
    const today = new Date().toISOString().slice(0, 10);
    const pairs = await Promise.all(
      SLUGS.map(async (pair) => {
        const [now, next] = await Promise.all([page(pair.slug, 0), page(pair.slug, 1)]);
        const days = [...parseDays(now), ...parseDays(next)]
          .filter((row) => row.date >= today)
          .slice(0, 30);
        return { id: pair.id, label: pair.label, days };
      }),
    );
    const payload: ForecastPayload = {
      pairs,
      fetchedAt: new Date().toISOString(),
      note: "WalletInvestor keeps the nearest 7 daily forecasts behind its premium wall, so this list starts on the first public day.",
    };
    cache = { at: Date.now(), payload };
    return payload;
  },
);
