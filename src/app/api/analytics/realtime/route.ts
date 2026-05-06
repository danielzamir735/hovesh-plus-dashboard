import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

export const dynamic     = 'force-dynamic';
export const maxDuration = 30; // Vercel: allow up to 30s for 10 parallel realtime queries

function buildClient() {
  const privateKey = process.env.GA_PRIVATE_KEY!
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n');
  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.GA_CLIENT_EMAIL,
      private_key: privateKey,
    },
  });
}

type Row = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
const EMPTY: readonly [{ rows: Row[] }] = [{ rows: [] }] as const;

export async function GET() {
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!propertyId || !process.env.GA_CLIENT_EMAIL || !process.env.GA_PRIVATE_KEY) {
    return NextResponse.json({ error: 'missing env' }, { status: 500 });
  }

  const client = buildClient();
  const property = `properties/${propertyId}`;

  const MIN5  = [{ name: 'last5min',  startMinutesAgo: 4,  endMinutesAgo: 0 }];
  const MIN30 = [{ name: 'last30min', startMinutesAgo: 29, endMinutesAgo: 0 }];

  try {
    const [
      rt5,           // 1. total active users – last 5 min
      rt30,          // 2. total active users – last 30 min
      screens5,      // 3. active users by screen – last 5 min
      events5,       // 4. event counts by event name – last 5 min
      features5,     // 5. event counts by feature_name – last 5 min
      cities5,       // 6. active users by city – last 5 min
      timeline5,     // 7. active users by minutesAgo (0-4) – last 5 min
      timeline30,    // 8. active users by minutesAgo (0-29) – last 30 min
      devices5,      // 9. active users by device category – last 5 min
      hospitals5,    // 10. active users by hospital_name – last 5 min
    ] = await Promise.all([
      // 1
      client.runRealtimeReport({
        property,
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: MIN5,
      }),
      // 2
      client.runRealtimeReport({
        property,
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: MIN30,
      }),
      // 3 — which screens are users on right now
      client.runRealtimeReport({
        property,
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: MIN5,
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 8,
      }).catch(() => EMPTY),
      // 4 — what events are firing right now
      client.runRealtimeReport({
        property,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        minuteRanges: MIN5,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 10,
      }).catch(() => EMPTY),
      // 5 — which features are being used right now
      client.runRealtimeReport({
        property,
        dimensions: [{ name: 'customEvent:feature_name' }],
        metrics: [{ name: 'eventCount' }],
        minuteRanges: MIN5,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 8,
      }).catch(() => EMPTY),
      // 6 — cities with active users right now
      client.runRealtimeReport({
        property,
        dimensions: [{ name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: MIN5,
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 6,
      }).catch(() => EMPTY),
      // 7 — per-minute timeline for last 5 min (like GA4 realtime graph)
      client.runRealtimeReport({
        property,
        dimensions: [{ name: 'minutesAgo' }],
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: MIN5,
      }).catch(() => EMPTY),
      // 8 — per-minute timeline for last 30 min
      client.runRealtimeReport({
        property,
        dimensions: [{ name: 'minutesAgo' }],
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: MIN30,
      }).catch(() => EMPTY),
      // 9 — device category breakdown
      client.runRealtimeReport({
        property,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: MIN5,
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      }).catch(() => EMPTY),
      // 10 — hospital responders active right now
      client.runRealtimeReport({
        property,
        dimensions: [{ name: 'customEvent:hospital_name' }],
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: MIN5,
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }).catch(() => EMPTY),
    ]);

    const [rt5Res]       = rt5;
    const [rt30Res]      = rt30;
    const [screens5Res]  = screens5;
    const [events5Res]   = events5;
    const [features5Res] = features5;
    const [cities5Res]   = cities5;
    const [tl5Res]       = timeline5;
    const [tl30Res]      = timeline30;
    const [devices5Res]  = devices5;
    const [hosp5Res]     = hospitals5;

    // Build per-minute timeline arrays (index 0 = 0 min ago = most recent)
    function buildTimeline(res: typeof tl5Res, totalMin: number) {
      const map = new Map<number, number>();
      for (const row of res.rows ?? []) {
        const min = parseInt(row.dimensionValues?.[0]?.value ?? '0', 10);
        const val = parseInt(row.metricValues?.[0]?.value ?? '0', 10);
        map.set(min, val);
      }
      return Array.from({ length: totalMin }, (_, i) => ({
        minutesAgo: i,
        users: map.get(i) ?? 0,
      }));
    }

    return NextResponse.json(
      {
        activeUsers5min:  parseInt(rt5Res.rows?.[0]?.metricValues?.[0]?.value  ?? '0'),
        activeUsers30min: parseInt(rt30Res.rows?.[0]?.metricValues?.[0]?.value ?? '0'),

        screens5min: (screens5Res.rows ?? [])
          .map((r) => ({
            screen: r.dimensionValues?.[0]?.value ?? '',
            users:  parseInt(r.metricValues?.[0]?.value ?? '0'),
          }))
          .filter((r) => r.screen && r.screen !== '(not set)'),

        events5min: (events5Res.rows ?? [])
          .map((r) => ({
            name:  r.dimensionValues?.[0]?.value ?? '',
            count: parseInt(r.metricValues?.[0]?.value ?? '0'),
          }))
          .filter((r) => r.name && r.name !== '(not set)'),

        features5min: (features5Res.rows ?? [])
          .map((r) => ({
            name:  r.dimensionValues?.[0]?.value ?? '',
            count: parseInt(r.metricValues?.[0]?.value ?? '0'),
          }))
          .filter((r) => r.name && r.name !== '(not set)'),

        cities5min: (cities5Res.rows ?? [])
          .map((r) => ({
            city:  r.dimensionValues?.[0]?.value ?? '',
            users: parseInt(r.metricValues?.[0]?.value ?? '0'),
          }))
          .filter((r) => r.city && r.city !== '(not set)'),

        timeline5min:  buildTimeline(tl5Res, 5),
        timeline30min: buildTimeline(tl30Res, 30),

        devices5min: (devices5Res.rows ?? [])
          .map((r) => ({
            device: r.dimensionValues?.[0]?.value ?? '',
            users:  parseInt(r.metricValues?.[0]?.value ?? '0'),
          }))
          .filter((r) => r.device && r.device !== '(not set)'),

        hospitals5min: (hosp5Res.rows ?? [])
          .map((r) => ({
            name:  r.dimensionValues?.[0]?.value ?? '',
            users: parseInt(r.metricValues?.[0]?.value ?? '0'),
          }))
          .filter((r) => r.name && r.name !== '(not set)'),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[analytics/realtime] GA4 error:', error);
    return NextResponse.json({ error: 'realtime fetch failed' }, { status: 500 });
  }
}
