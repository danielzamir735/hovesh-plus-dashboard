import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextRequest, NextResponse } from 'next/server';

const AUTO_EVENTS = [
  'page_view', 'scroll', 'session_start', 'first_visit',
  'user_engagement', 'click', 'file_download', 'video_start',
  'video_progress', 'video_complete', 'view_search_results',
  'first_open', 'app_update', 'os_update', 'notification_open',
  'notification_receive', 'notification_dismiss', 'firebase_campaign',
];

const FEATURE_CATEGORY_MAP: Record<string, string> = {
  burn_calculator: 'calculators',
  'medication-scanner': 'medical_knowledge',
  'realtime-translate': 'medical_knowledge',
  hospitals: 'medical_knowledge',
  'kit-standards': 'medical_knowledge',
  'whatsapp-community': 'tools',
  simulators: 'tools',
};

function parsePrivateKey(raw: string): string {
  const stripped = raw.trim().replace(/^["']|["']$/g, '');
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

type Range = '30min' | '2h' | '6h' | '24h' | '7d' | '30d' | 'custom';

function getDateRange(range: Range, customStart?: string, customEnd?: string) {
  switch (range) {
    case '30min':
    case '2h':
    case '6h':
    case '24h':
      return { startDate: 'today', endDate: 'today' };
    case '7d':
      return { startDate: '7daysAgo', endDate: 'today' };
    case '30d':
      return { startDate: '30daysAgo', endDate: 'today' };
    case 'custom':
      return {
        startDate: customStart ?? '7daysAgo',
        endDate: customEnd ?? 'today',
      };
  }
}

const EMPTY_RT_REPORT = [
  {
    rows: [] as {
      dimensionValues?: { value?: string }[];
      metricValues?: { value?: string }[];
    }[],
  },
] as const;

const EMPTY_REPORT = [
  {
    rows: [] as {
      dimensionValues?: { value?: string }[];
      metricValues?: { value?: string }[];
    }[],
  },
];

export async function GET(request: NextRequest) {
  const propertyId = process.env.GA_PROPERTY_ID;

  const missing = [
    !propertyId && 'GA_PROPERTY_ID',
    !process.env.GA_CLIENT_EMAIL && 'GA_CLIENT_EMAIL',
    !process.env.GA_PRIVATE_KEY && 'GA_PRIVATE_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `חסרים משתני סביבה ל-GA4: ${missing.join(', ')}` },
      { status: 500 }
    );
  }

  const rangeParam = request.nextUrl.searchParams.get('range') ?? '24h';
  const range = (['30min', '2h', '6h', '24h', '7d', '30d', 'custom'].includes(rangeParam)
    ? rangeParam
    : '24h') as Range;

  const customStart = request.nextUrl.searchParams.get('startDate') ?? undefined;
  const customEnd = request.nextUrl.searchParams.get('endDate') ?? undefined;

  const dateRange = getDateRange(range, customStart, customEnd);
  const useHourly = range === '30min' || range === '2h' || range === '6h' || range === '24h';

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
      firstOpenReport,
      realtimeFeaturesReport,
      realtimeHospitalReport,
      todayUsersReport,
      featureDetailReport,
    ] = await Promise.all([
      // 1. Summary
      client.runReport({
        property,
        dateRanges: [dateRange],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
        ],
      }),

      // 2. Chart: hourly or daily
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: useHourly ? 'hour' : 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: useHourly ? 'hour' : 'date' } }],
      }),

      // 3. Feature events: top 10 custom events
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

      // 4. Cities: top 25
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'country',
                  stringFilter: { matchType: 'EXACT', value: 'Israel' },
                },
              },
              {
                notExpression: {
                  filter: {
                    fieldName: 'city',
                    inListFilter: { values: ['(not set)', 'not set', '(not provided)'] },
                  },
                },
              },
            ],
          },
        },
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 25,
      }),

      // 5. Peak hours
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'hour' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'hour' } }],
      }),

      // 6. Realtime active users
      client.runRealtimeReport({
        property,
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: [{ name: 'last30min', startMinutesAgo: 29, endMinutesAgo: 0 }],
      }),

      // 7. Total installs (all-time)
      client.runReport({
        property,
        dateRanges: [{ startDate: '2023-01-01', endDate: 'today' }],
        metrics: [{ name: 'newUsers' }],
      }),

      // 8. Platform / OS
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

      // 9. Top screens
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

      // 10. New users in selected date range
      client.runReport({
        property,
        dateRanges: [dateRange],
        metrics: [{ name: 'newUsers' }],
      }),

      // 11. Realtime events by feature_name (any event that carries this parameter)
      client.runRealtimeReport({
        property,
        dimensions: [{ name: 'customEvent:feature_name' }],
        metrics: [{ name: 'eventCount' }],
        minuteRanges: [{ name: 'last30min', startMinutesAgo: 29, endMinutesAgo: 0 }],
      }).catch(() => EMPTY_RT_REPORT),

      // 12. Realtime hospital_name (active responders at hospitals)
      client.runRealtimeReport({
        property,
        dimensions: [{ name: 'customEvent:hospital_name' }],
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: [{ name: 'last30min', startMinutesAgo: 29, endMinutesAgo: 0 }],
      }).catch(() => EMPTY_RT_REPORT),

      // 13. Today's active users (start-of-day to now, always today regardless of range)
      client.runReport({
        property,
        dateRanges: [{ startDate: 'today', endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }],
      }),

      // 14. Feature events enriched with customEvent:feature_name parameter
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'eventName' }, { name: 'customEvent:feature_name' }],
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
        limit: 15,
      }).catch(() => EMPTY_REPORT),
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
    const [firstOpenRes] = firstOpenReport;
    const [realtimeFeaturesRes] = realtimeFeaturesReport;
    const [realtimeHospitalRes] = realtimeHospitalReport;
    const [todayUsersRes] = todayUsersReport;
    const [featureDetailRes] = featureDetailReport;

    const summaryStats = {
      activeUsers: parseInt(summaryRes.rows?.[0]?.metricValues?.[0]?.value ?? '0'),
      sessions: parseInt(summaryRes.rows?.[0]?.metricValues?.[1]?.value ?? '0'),
      newUsers: parseInt(firstOpenRes.rows?.[0]?.metricValues?.[0]?.value ?? '0'),
      avgSessionDuration: parseFloat(summaryRes.rows?.[0]?.metricValues?.[2]?.value ?? '0'),
    };

    let chartData = (chartRes.rows ?? []).map((row) => {
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

    let hourlyData = (hourlyRes.rows ?? [])
      .map((row) => {
        const h = row.dimensionValues?.[0]?.value ?? '0';
        return {
          hour: parseInt(h, 10),
          label: `${h.padStart(2, '0')}:00`,
          sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
        };
      })
      .sort((a, b) => a.hour - b.hour);

    // Slice to the relevant window for 2h and 6h ranges
    if (range === '2h' || range === '6h') {
      const currentHour = new Date().getHours();
      const hoursBack = range === '2h' ? 2 : 6;
      const minHour = Math.max(0, currentHour - hoursBack + 1);
      hourlyData = hourlyData.filter((h) => h.hour >= minHour);
      chartData = chartData.filter((p) => {
        const h = parseInt(p.label.split(':')[0], 10);
        return h >= minHour;
      });
    }

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

    // Realtime feature interaction aggregation
    const byCategory: Record<string, number> = {
      calculators: 0,
      medical_knowledge: 0,
      tools: 0,
      emergency_info: 0,
    };
    const byFeature: { name: string; count: number }[] = [];

    for (const row of realtimeFeaturesRes.rows ?? []) {
      const featureName = row.dimensionValues?.[0]?.value ?? '';
      const count = parseInt(row.metricValues?.[0]?.value ?? '0');
      if (!featureName || featureName === '(not set)') continue;
      const category = FEATURE_CATEGORY_MAP[featureName] ?? 'tools';
      byCategory[category] = (byCategory[category] ?? 0) + count;
      byFeature.push({ name: featureName, count });
    }
    byFeature.sort((a, b) => b.count - a.count);

    // Realtime hospital data
    const hospitalData: { name: string; users: number }[] = [];
    for (const row of realtimeHospitalRes.rows ?? []) {
      const name = row.dimensionValues?.[0]?.value ?? '';
      const users = parseInt(row.metricValues?.[0]?.value ?? '0');
      if (!name || name === '(not set)') continue;
      hospitalData.push({ name, users });
    }
    hospitalData.sort((a, b) => b.users - a.users);

    const todayActiveUsers = parseInt(
      todayUsersRes.rows?.[0]?.metricValues?.[0]?.value ?? '0'
    );

    const featureEventsDetail = (featureDetailRes.rows ?? [])
      .map((row) => ({
        eventName: row.dimensionValues?.[0]?.value ?? '',
        featureName: row.dimensionValues?.[1]?.value ?? '',
        count: parseInt(row.metricValues?.[0]?.value ?? '0'),
      }))
      .filter((r) => r.eventName && r.eventName !== '(not set)');

    // Debug: log raw GA4 keys so we can add missing translations
    console.log('[GA4 raw keys]', featureEventsDetail.map(e => `${e.eventName} | ${e.featureName}`));
    console.log('[GA4 featureEvents]', featureEvents.map(e => e.name));

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
        realtimeInteractions: { byCategory, byFeature, hospitalData },
        todayActiveUsers,
        featureEventsDetail,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const msg = String(error);
    const isQuota =
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('429') ||
      msg.toLowerCase().includes('quota');
    console.error('[analytics/route] GA4 error:', error);
    return NextResponse.json(
      {
        error: isQuota
          ? 'מכסת GA4 מלאה – המתן מספר שניות ונסה שוב'
          : 'שגיאה בקבלת נתוני אנליטיקס',
      },
      { status: isQuota ? 429 : 500 }
    );
  }
}
