import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

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

export async function GET() {
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!propertyId || !process.env.GA_CLIENT_EMAIL || !process.env.GA_PRIVATE_KEY) {
    return NextResponse.json({ error: 'missing env' }, { status: 500 });
  }

  const client = buildClient();
  const property = `properties/${propertyId}`;

  try {
    const [rt5, rt30] = await Promise.all([
      client.runRealtimeReport({
        property,
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: [{ name: 'last5min', startMinutesAgo: 4, endMinutesAgo: 0 }],
      }),
      client.runRealtimeReport({
        property,
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: [{ name: 'last30min', startMinutesAgo: 29, endMinutesAgo: 0 }],
      }),
    ]);

    const [rt5Res] = rt5;
    const [rt30Res] = rt30;

    return NextResponse.json(
      {
        activeUsers5min:  parseInt(rt5Res.rows?.[0]?.metricValues?.[0]?.value  ?? '0'),
        activeUsers30min: parseInt(rt30Res.rows?.[0]?.metricValues?.[0]?.value ?? '0'),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[analytics/realtime] GA4 error:', error);
    return NextResponse.json({ error: 'realtime fetch failed' }, { status: 500 });
  }
}
