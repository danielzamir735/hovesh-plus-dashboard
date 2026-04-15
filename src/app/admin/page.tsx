'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Activity,
  TrendingUp,
  UserPlus,
  Zap,
  RefreshCw,
  AlertCircle,
  BarChart2,
  Clock,
  MapPin,
  Download,
  Smartphone,
  Monitor,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummaryStats {
  activeUsers: number;
  sessions: number;
  newUsers: number;
  avgSessionDuration: number;
}

interface ChartPoint {
  label: string;
  sessions: number;
  users: number;
}

interface EventPoint {
  name: string;
  count: number;
}

interface CityPoint {
  city: string;
  users: number;
}

interface HourlyPoint {
  hour: number;
  label: string;
  sessions: number;
}

interface PlatformPoint {
  platform: string;
  users: number;
}

interface ScreenPoint {
  screen: string;
  views: number;
}

interface AnalyticsData {
  summaryStats: SummaryStats;
  chartData: ChartPoint[];
  chartType: 'hourly' | 'daily';
  featureEvents: EventPoint[];
  cityData: CityPoint[];
  hourlyData: HourlyPoint[];
  realtimeUsers: number;
  totalInstalls: number;
  platformData: PlatformPoint[];
  screenData: ScreenPoint[];
}

const RANGES = [
  { key: '30min', label: 'חצי שעה' },
  { key: '24h', label: '24 שעות' },
  { key: '7d', label: '7 ימים' },
  { key: '30d', label: '30 ימים' },
] as const;
type Range = (typeof RANGES)[number]['key'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number) {
  return new Intl.NumberFormat('he-IL').format(n);
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function rangeSubLabel(range: Range): string {
  switch (range) {
    case '30min': return 'היום (GA4 מגבלה)';
    case '24h': return 'היום';
    case '7d': return '7 הימים האחרונים';
    case '30d': return '30 הימים האחרונים';
  }
}

const EVENT_LABELS: Record<string, string> = {
  calculator_open: 'פתיחת מחשבון',
  calculator_use: 'שימוש במחשבון',
  department_nav: 'ניווט למחלקה',
  drug_search: 'חיפוש תרופה',
  protocol_view: 'צפייה בפרוטוקול',
  checklist_complete: 'השלמת צ\'קליסט',
  emergency_alert: 'התראת חירום',
  form_submit: 'שליחת טופס',
  login: 'כניסה למערכת',
  sign_up: 'הרשמה',
  search: 'חיפוש',
  purchase: 'רכישה',
  add_to_cart: 'הוספה לסל',
  share: 'שיתוף',
  tutorial_begin: 'התחלת הדרכה',
  tutorial_complete: 'סיום הדרכה',
  level_up: 'שדרוג רמה',
  unlock_achievement: 'פתיחת הישג',
  select_content: 'בחירת תוכן',
  view_item: 'צפייה בפריט',
  view_item_list: 'צפייה ברשימה',
  begin_checkout: 'התחלת תשלום',
  generate_lead: 'יצירת ליד',
  // חובש+ specific features
  feature_interaction: 'אינטראקציה עם פיצ\'ר',
  modal_view: 'צפייה בחלונית',
  language_select: 'בחירת שפה',
  translation_started: 'תחילת תרגום',
  metronome_start: 'הפעלת מטרונום (החייאה)',
  translator_update: 'עדכון תרגום',
  vitals_recorded: 'רישום מדדים',
  burn_body_part_toggle: 'סימון חלקי גוף (כוויות)',
  sign_language_selected: 'בחירת שפת סימנים',
  contact_translator: 'צור קשר עם מתרגם',
};

// Hebrew translations for Israeli city names returned by GA4
const CITY_LABELS: Record<string, string> = {
  'Tel Aviv': 'תל אביב-יפו',
  'Tel Aviv-Yafo': 'תל אביב-יפו',
  'Tel Aviv-Jaffa': 'תל אביב-יפו',
  'Petah Tikva': 'פתח תקווה',
  'Petah Tiqwa': 'פתח תקווה',
  'Netanya': 'נתניה',
  'Beit Shemesh': 'בית שמש',
  'Jerusalem': 'ירושלים',
  'Haifa': 'חיפה',
  'Rishon LeZion': 'ראשון לציון',
  'Rishon Leziyyon': 'ראשון לציון',
  'Ashdod': 'אשדוד',
  'Beer Sheva': 'באר שבע',
  'Beersheba': 'באר שבע',
  "Be'er Sheva": 'באר שבע',
  'Ramat Gan': 'רמת גן',
  'Holon': 'חולון',
  'Bnei Brak': 'בני ברק',
  'Rehovot': 'רחובות',
  'Bat Yam': 'בת ים',
  'Kfar Saba': 'כפר סבא',
  'Herzliya': 'הרצליה',
  'Modiin': 'מודיעין',
  "Modi'in": 'מודיעין',
  'Lod': 'לוד',
  'Ramla': 'רמלה',
  'Nazareth': 'נצרת',
  'Nahariya': 'נהריה',
  'Tiberias': 'טבריה',
  'Eilat': 'אילת',
  'Acre': 'עכו',
  'Akko': 'עכו',
  "Ra'anana": 'רעננה',
  'Givatayim': 'גבעתיים',
  'Kiryat Gat': 'קריית גת',
  'Sderot': 'שדרות',
  'Or Yehuda': 'אור יהודה',
  'Yavne': 'יבנה',
  'Ashkelon': 'אשקלון',
  'Kiryat Ata': 'קריית אתא',
  'Kiryat Bialik': 'קריית ביאליק',
  'Kiryat Motzkin': 'קריית מוצקין',
  'Kiryat Shmona': 'קריית שמונה',
  'Kiryat Yam': 'קריית ים',
  'Kiryat Ono': 'קריית אונו',
  'Tzfat': 'צפת',
  'Safed': 'צפת',
  'Dimona': 'דימונה',
};

function hebrewCity(name: string) {
  return CITY_LABELS[name] ?? name;
}

const PLATFORM_LABELS: Record<string, string> = {
  'iOS': 'iOS',
  'Android': 'אנדרואיד',
  'Windows': 'ווינדוס',
  'Macintosh': 'מק',
  'Linux': 'לינוקס',
  'ChromeOS': 'Chrome OS',
  'web': 'ווב',
};

function hebrewEvent(name: string) {
  if (EVENT_LABELS[name]) return EVENT_LABELS[name];
  const readable = name.replace(/_/g, ' ');
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

function hebrewPlatform(name: string) {
  return PLATFORM_LABELS[name] ?? name;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: 'easeOut' as const },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: { duration: 0.5, delay: i * 0.06 },
  }),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassCard({
  children,
  className = '',
  index = 0,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${className}`}
    >
      {children}
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  index,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  index: number;
}) {
  return (
    <GlassCard
      index={index}
      className="p-5 flex flex-col gap-3 hover:bg-white/10 transition-colors duration-300"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/60 leading-tight">{label}</span>
        <div className={`p-2 rounded-xl ${accent} shrink-0`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
      {sub && <p className="text-xs text-white/40 leading-tight">{sub}</p>}
    </GlassCard>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md px-4 py-3 text-sm shadow-xl">
      <p className="font-semibold text-white/80 mb-1.5">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }} className="leading-relaxed">
          {p.name === 'sessions' ? 'סשנים' : 'משתמשים'}: <span className="font-bold">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md px-4 py-3 text-sm shadow-xl">
      <p className="font-semibold text-white/80 mb-1">{label}</p>
      <p className="text-indigo-300">
        סשנים: <span className="font-bold">{formatNumber(payload[0].value)}</span>
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="h-3 w-20 rounded bg-white/10" />
        <div className="h-7 w-7 rounded-xl bg-white/10" />
      </div>
      <div className="h-8 w-28 rounded bg-white/10 mb-2" />
      <div className="h-2.5 w-16 rounded bg-white/10" />
    </div>
  );
}

function RankedList({
  items,
  labelFn,
  valueFn,
  accentColor,
  emptyText,
  loading,
  itemDir,
}: {
  items: { id: string; label: string; value: number }[];
  labelFn?: (label: string) => string;
  valueFn?: (v: number) => string;
  accentColor: string;
  emptyText: string;
  loading: boolean;
  itemDir?: 'rtl' | 'ltr';
}) {
  const maxValue = items[0]?.value ?? 1;
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-white/30 text-center py-8">{emptyText}</p>;
  }
  return (
    <ol className="flex flex-col gap-2 overflow-y-auto max-h-64 xl:max-h-none">
      {items.map((item, i) => {
        const pct = Math.round((item.value / maxValue) * 100);
        const displayLabel = labelFn ? labelFn(item.label) : item.label;
        const displayValue = valueFn ? valueFn(item.value) : formatNumber(item.value);
        return (
          <motion.li
            key={item.id}
            custom={i}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="group relative rounded-xl border border-white/5 bg-white/5 px-4 py-3 overflow-hidden hover:bg-white/10 transition-all duration-300"
            style={{ ['--hover-border' as string]: accentColor }}
          >
            <div
              className="absolute inset-y-0 right-0 transition-all duration-500"
              style={{ width: `${pct}%`, background: accentColor, opacity: 0.12 }}
            />
            <div
              className="relative flex items-center justify-between gap-3"
              dir={itemDir}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs font-bold text-white/30 w-4 shrink-0 text-center">{i + 1}</span>
                <span className="text-sm font-medium text-white/80 break-words leading-snug min-w-0">{displayLabel}</span>
              </div>
              <span className="text-sm font-bold shrink-0 tabular-nums" style={{ color: accentColor }}>
                {displayValue}
              </span>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [range, setRange] = useState<Range>('30min');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?range=${range}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `שגיאת שרת: ${res.status}`);
      }
      const json: AnalyticsData = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  const maxHourlySessions = Math.max(...(data?.hourlyData ?? []).map((h) => h.sessions), 1);

  const chartTitle =
    data?.chartType === 'hourly' ? 'פעילות לפי שעה היום' : 'כניסות לאפליקציה';
  const chartSub =
    data?.chartType === 'hourly' ? 'שעות 00:00 – 23:00' : rangeSubLabel(range);

  const cityItems = (data?.cityData ?? []).map((c) => ({ id: c.city, label: hebrewCity(c.city), value: c.users }));
  const featureItems = (data?.featureEvents ?? []).map((e) => ({ id: e.name, label: e.name, value: e.count }));
  const platformItems = (data?.platformData ?? []).map((p) => ({ id: p.platform, label: p.platform, value: p.users }));
  const screenItems = (data?.screenData ?? []).map((s) => ({ id: s.screen, label: s.screen, value: s.views }));

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#06071a] text-white">
      {/* Background gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute top-1/3 -left-40 h-[500px] w-[500px] rounded-full bg-violet-700/15 blur-[120px]" />
        <div className="absolute bottom-0 right-1/3 h-[400px] w-[400px] rounded-full bg-blue-700/10 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                חובש<span className="text-indigo-400">+</span>
              </h1>
              <p className="mt-1 text-sm text-white/50">לוח מחוונים אנליטיקס</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {lastUpdated && (
                <span className="text-xs text-white/30 hidden sm:block">
                  עודכן: {lastUpdated.toLocaleTimeString('he-IL')}
                </span>
              )}
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                רענן
              </button>
            </div>
          </div>

          {/* ── Time Range Picker ── */}
          <div className="mt-5 grid grid-cols-4 gap-2">
            {RANGES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`
                  rounded-xl px-2 py-2 text-sm font-semibold transition-all duration-200 text-center w-full
                  ${range === key
                    ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                    : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </motion.header>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300"
            >
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stat cards (6) ── */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                index={0}
                icon={Users}
                label="משתמשים פעילים"
                value={formatNumber(data?.summaryStats.activeUsers ?? 0)}
                sub={rangeSubLabel(range)}
                accent="bg-indigo-500/30"
              />
              <StatCard
                index={1}
                icon={Activity}
                label="פעילים עכשיו"
                value={formatNumber(data?.realtimeUsers ?? 0)}
                sub="30 דקות אחרונות"
                accent="bg-emerald-500/30"
              />
              <StatCard
                index={2}
                icon={TrendingUp}
                label="סשנים"
                value={formatNumber(data?.summaryStats.sessions ?? 0)}
                sub={rangeSubLabel(range)}
                accent="bg-violet-500/30"
              />
              <StatCard
                index={3}
                icon={UserPlus}
                label="משתמשים חדשים"
                value={formatNumber(data?.summaryStats.newUsers ?? 0)}
                sub={rangeSubLabel(range)}
                accent="bg-sky-500/30"
              />
              <StatCard
                index={4}
                icon={Clock}
                label="זמן שהייה ממוצע"
                value={formatDuration(data?.summaryStats.avgSessionDuration ?? 0)}
                sub="דקות:שניות לסשן"
                accent="bg-amber-500/30"
              />
              <StatCard
                index={5}
                icon={Download}
                label="סה״כ התקנות"
                value={formatNumber(data?.totalInstalls ?? 0)}
                sub="מאז תחילת האפליקציה"
                accent="bg-rose-500/30"
              />
            </>
          )}
        </section>

        {/* ── Main chart + Feature events ── */}
        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* Sessions/Users chart – 2/3 */}
          <GlassCard index={6} className="col-span-1 xl:col-span-2 p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20">
                <BarChart2 size={18} className="text-indigo-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">{chartTitle}</h2>
                <p className="text-xs text-white/40">{chartSub}</p>
              </div>
            </div>

            {loading ? (
              <div className="h-56 animate-pulse rounded-xl bg-white/5" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={data?.chartData ?? []}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<AreaTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#gradSessions)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#6366f1' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#gradUsers)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#8b5cf6' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {!loading && (
              <div className="mt-4 flex items-center gap-5 justify-end text-xs text-white/40">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-4 rounded-full bg-indigo-500" />
                  סשנים
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-4 rounded-full bg-violet-500" />
                  משתמשים
                </span>
              </div>
            )}
          </GlassCard>

          {/* Feature events – 1/3 */}
          <GlassCard index={7} className="col-span-1 p-6 flex flex-col">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20">
                <Zap size={18} className="text-amber-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">פיצ&apos;רים בשימוש</h2>
                <p className="text-xs text-white/40">אירועי אפליקציה בלבד</p>
              </div>
            </div>
            <RankedList
              items={featureItems}
              labelFn={hebrewEvent}
              accentColor="#f59e0b"
              emptyText="אין אירועי פיצ'ר בטווח זה"
              loading={loading}
              itemDir="rtl"
            />
          </GlassCard>
        </div>

        {/* ── Hourly heatmap + Cities ── */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Peak hours bar chart */}
          <GlassCard index={8} className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/20">
                <Activity size={18} className="text-violet-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">שעות עומס</h2>
                <p className="text-xs text-white/40">פעילות לפי שעות היממה</p>
              </div>
            </div>

            {loading ? (
              <div className="h-48 animate-pulse rounded-xl bg-white/5" />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  data={data?.hourlyData ?? []}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="sessions" radius={[4, 4, 0, 0]}>
                    {(data?.hourlyData ?? []).map((entry) => {
                      const intensity = entry.sessions / maxHourlySessions;
                      const opacity = 0.3 + intensity * 0.7;
                      return (
                        <Cell
                          key={entry.hour}
                          fill={`rgba(139,92,246,${opacity})`}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlassCard>

          {/* Geographic: top cities */}
          <GlassCard index={9} className="p-6 flex flex-col">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20">
                <MapPin size={18} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">ניתוח גאוגרפי</h2>
                <p className="text-xs text-white/40">ערים עם הכי הרבה משתמשים</p>
              </div>
            </div>
            <RankedList
              items={cityItems}
              accentColor="#10b981"
              emptyText="אין נתוני עיר זמינים"
              loading={loading}
            />
          </GlassCard>
        </div>

        {/* ── Platform breakdown + Top screens ── */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Platform / OS */}
          <GlassCard index={10} className="p-6 flex flex-col">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/20">
                <Smartphone size={18} className="text-sky-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">פלטפורמות</h2>
                <p className="text-xs text-white/40">פילוח לפי מערכת הפעלה</p>
              </div>
            </div>
            <RankedList
              items={platformItems}
              labelFn={hebrewPlatform}
              accentColor="#38bdf8"
              emptyText="אין נתוני פלטפורמה זמינים"
              loading={loading}
            />
          </GlassCard>

          {/* Top screens */}
          <GlassCard index={11} className="p-6 flex flex-col">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-pink-500/20">
                <Monitor size={18} className="text-pink-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">מסכים פופולריים</h2>
                <p className="text-xs text-white/40">הדפים / מסכים עם הכי הרבה צפיות</p>
              </div>
            </div>
            <RankedList
              items={screenItems}
              accentColor="#f472b6"
              emptyText="אין נתוני מסכים זמינים"
              loading={loading}
            />
          </GlassCard>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-4 text-center text-xs text-white/20"
        >
          חובש+ Analytics Dashboard &copy; {new Date().getFullYear()}
        </motion.footer>
      </div>
    </main>
  );
}
