import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextRequest, NextResponse } from 'next/server';

// Automatic GA4 events that are not feature-specific
const AUTO_EVENTS = [
  'page_view', 'scroll', 'session_start', 'first_visit',
  'user_engagement', 'click', 'file_download', 'video_start',
  'video_progress', 'video_complete', 'view_search_results',
  'first_open', 'app_update', 'os_update', 'notification_open',
  'notification_receive', 'notification_dismiss', 'firebase_campaign',
];

function parsePrivateKey(raw: string): string {
  // Strip surrounding quotes that Vercel (or copy-paste) may add
  const stripped = raw.trim().replace(/^["']|["']$/g, '');
  // Convert literal \n sequences to real newlines
  return stripped.replace(/\\n/g, '\n');
}

function buildClient() {
  const privateKey = parsePrivateKey(process.env.GA_PRIVATE_KEY!);
  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.GA_CLIENT_EMAIL,
      private_key: privateKey,
    },
  });
}

type Range = '30min' | '24h' | '7d' | '30d';

function getDateRange(range: Range) {
  switch (range) {
    case '30min':
    case '24h':
      return { startDate: 'today', endDate: 'today' };
    case '7d':
      return { startDate: '7daysAgo', endDate: 'today' };
    case '30d':
      return { startDate: '30daysAgo', endDate: 'today' };
  }
}

export async function GET(request: NextRequest) {
  const propertyId = process.env.GA_PROPERTY_ID;

  const missing = [
    !propertyId && 'GA_PROPERTY_ID',
    !process.env.GA_CLIENT_EMAIL && 'GA_CLIENT_EMAIL',
    !process.env.GA_PRIVATE_KEY && 'GA_PRIVATE_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    console.error('[analytics/route] Missing env vars:', missing.join(', '));
    return NextResponse.json(
      { error: `Missing GA4 environment variables: ${missing.join(', ')}` },
      { status: 500 }
    );
  }

  const rangeParam = request.nextUrl.searchParams.get('range') ?? '24h';
  const range = (['30min', '24h', '7d', '30d'].includes(rangeParam)
    ? rangeParam
    : '24h') as Range;

  const dateRange = getDateRange(range);
  const useHourly = range === '30min' || range === '24h';

  const client = buildClient();
  const property = `properties/${propertyId}`;

  try {
    const [
      summaryReport,
      chartReport,
      eventsReport,
      cityReport,
      hourlyReport,
      realtimeReport,
      totalInstallsReport,
      platformReport,
      screenReport,
    ] = await Promise.all([
      // Summary: active users, sessions, new users, avg session duration
      client.runReport({
        property,
        dateRanges: [dateRange],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'newUsers' },
          { name: 'averageSessionDuration' },
        ],
      }),

      // Chart: hourly (today) for 24h/30min, daily for 7d/30d
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: useHourly ? 'hour' : 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: useHourly ? 'hour' : 'date' } }],
      }),

      // Feature events: filtered, no automatic events, top 10
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          notExpression: {
            filter: {
              fieldName: 'eventName',
              inListFilter: { values: AUTO_EVENTS },
            },
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 10,
      }),

      // Geographic: top 10 cities
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter: {
          notExpression: {
            filter: {
              fieldName: 'city',
              inListFilter: { values: ['(not set)', 'not set', '(not provided)'] },
            },
          },
        },
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }),

      // Peak hours: hourly aggregation over the range (0-23)
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'hour' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'hour' } }],
      }),

      // Realtime: active users in last 30 minutes
      client.runRealtimeReport({
        property,
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: [{ name: 'last30min', startMinutesAgo: 29, endMinutesAgo: 0 }],
      }),

      // Total installs (all-time new users = cumulative installs proxy)
      client.runReport({
        property,
        dateRanges: [{ startDate: '2023-01-01', endDate: 'today' }],
        metrics: [{ name: 'newUsers' }],
      }),

      // Platform / OS breakdown
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'operatingSystem' }],
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter: {
          notExpression: {
            filter: {
              fieldName: 'operatingSystem',
              inListFilter: { values: ['(not set)', 'not set'] },
            },
          },
        },
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 6,
      }),

      // Top screens / pages
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          notExpression: {
            filter: {
              fieldName: 'unifiedScreenName',
              inListFilter: { values: ['(not set)', 'not set'] },
            },
          },
        },
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 8,
      }),
    ]);

    const [summaryRes] = summaryReport;
    const [chartRes] = chartReport;
    const [eventsRes] = eventsReport;
    const [cityRes] = cityReport;
    const [hourlyRes] = hourlyReport;
    const [realtimeRes] = realtimeReport;
    const [totalInstallsRes] = totalInstallsReport;
    const [platformRes] = platformReport;
    const [screenRes] = screenReport;

    const summaryStats = {
      activeUsers: parseInt(summaryRes.rows?.[0]?.metricValues?.[0]?.value ?? '0'),
      sessions: parseInt(summaryRes.rows?.[0]?.metricValues?.[1]?.value ?? '0'),
      newUsers: parseInt(summaryRes.rows?.[0]?.metricValues?.[2]?.value ?? '0'),
      avgSessionDuration: parseFloat(summaryRes.rows?.[0]?.metricValues?.[3]?.value ?? '0'),
    };

    const chartData = (chartRes.rows ?? []).map((row) => {
      const dim = row.dimensionValues?.[0]?.value ?? '';
      const label = useHourly
        ? `${dim.padStart(2, '0')}:00`
        : dim.length === 8
          ? `${dim.slice(6, 8)}/${dim.slice(4, 6)}`
          : dim;
      return {
        label,
        sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
        users: parseInt(row.metricValues?.[1]?.value ?? '0'),
      };
    });

    const featureEvents = (eventsRes.rows ?? []).map((row) => ({
      name: row.dimensionValues?.[0]?.value ?? '',
      count: parseInt(row.metricValues?.[0]?.value ?? '0'),
    }));

    const cityData = (cityRes.rows ?? []).map((row) => ({
      city: row.dimensionValues?.[0]?.value ?? '',
      users: parseInt(row.metricValues?.[0]?.value ?? '0'),
    }));

    const hourlyData = (hourlyRes.rows ?? []).map((row) => {
      const h = row.dimensionValues?.[0]?.value ?? '0';
      return {
        hour: parseInt(h),
        label: `${h.padStart(2, '0')}:00`,
        sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
      };
    });

    const realtimeUsers = parseInt(
      realtimeRes.rows?.[0]?.metricValues?.[0]?.value ?? '0'
    );

    const totalInstalls = parseInt(
      totalInstallsRes.rows?.[0]?.metricValues?.[0]?.value ?? '0'
    );

    const platformData = (platformRes.rows ?? []).map((row) => ({
      platform: row.dimensionValues?.[0]?.value ?? '',
      users: parseInt(row.metricValues?.[0]?.value ?? '0'),
    }));

    const screenData = (screenRes.rows ?? []).map((row) => ({
      screen: row.dimensionValues?.[0]?.value ?? '',
      views: parseInt(row.metricValues?.[0]?.value ?? '0'),
    }));

    return NextResponse.json(
      {
        summaryStats,
        chartData,
        chartType: useHourly ? 'hourly' : 'daily',
        featureEvents,
        cityData,
        hourlyData,
        realtimeUsers,
        totalInstalls,
        platformData,
        screenData,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[analytics/route] GA4 error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
