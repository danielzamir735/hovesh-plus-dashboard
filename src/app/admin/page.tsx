'use client';

import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Activity,
  Sun,
  Moon,
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
  Calculator,
  Stethoscope,
  Wrench,
  AlertTriangle,
  ExternalLink,
  Radio,
  Building2,
  CalendarDays,
  Info,
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

// ─── Theme ───────────────────────────────────────────────────────────────────

type ThemeMode = 'dark' | 'light';
const ThemeCtx = createContext<ThemeMode>('dark');
const useTheme = () => useContext(ThemeCtx);

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummaryStats {
  activeUsers: number;
  sessions: number;
  newUsers: number;
  avgSessionDuration: number;
}
interface ChartPoint   { label: string; sessions: number; users: number }
interface EventPoint   { name: string;  count: number }
interface CityPoint    { city: string;  users: number }
interface HourlyPoint  { hour: number;  label: string; sessions: number }
interface PlatformPoint { platform: string; users: number }
interface ScreenPoint  { screen: string; views: number }
interface HospitalPoint { name: string; users: number }

interface RealtimeInteractions {
  byCategory: Record<string, number>;
  byFeature: Array<{ name: string; count: number }>;
  hospitalData?: HospitalPoint[];
}

interface FeatureEventDetail { eventName: string; featureName: string; count: number }

interface RealtimeFast {
  activeUsers5min: number;
  activeUsers30min: number;
  screens5min:   { screen: string; users: number }[];
  events5min:    { name: string; count: number }[];
  features5min:  { name: string; count: number }[];
  cities5min:    { city: string; users: number }[];
  devices5min:   { device: string; users: number }[];
  hospitals5min: { name: string; users: number }[];
  timeline5min:  { minutesAgo: number; users: number }[];
  timeline30min: { minutesAgo: number; users: number }[];
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
  realtimeInteractions: RealtimeInteractions;
  todayActiveUsers: number;
  activeUsers5min: number;
  featureEventsDetail: FeatureEventDetail[];
}

const RANGES = [
  { key: '30min',  label: 'חצי שעה' },
  { key: '2h',     label: '2 שעות'  },
  { key: '6h',     label: '6 שעות'  },
  { key: '24h',    label: '24 שעות' },
  { key: '7d',     label: '7 ימים'  },
  { key: '30d',    label: '30 ימים' },
  { key: 'custom', label: 'מותאם'   },
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
    case '30min':  return 'חצי שעה אחרונה';
    case '2h':     return '2 שעות גלגול (חוצה חצות)';
    case '6h':     return '6 שעות אחרונות';
    case '24h':    return 'היום';
    case '7d':     return '7 הימים האחרונים';
    case '30d':    return '30 הימים האחרונים';
    case 'custom': return 'טווח מותאם';
  }
}

function neonPulseClass(value: number, low: number, high: number): string {
  if (value <= 0)    return '';
  if (value < low)   return 'neon-low';
  if (value < high)  return 'neon-mid';
  return 'neon-high';
}

// ─── Translation maps ─────────────────────────────────────────────────────────

const FEATURE_NAME_LABELS: Record<string, string> = {
  // ── Main features ──────────────────────────────────────────────────────────
  'whatsapp-community':   'קהילת חובש +',
  'kit-standards':        'תקנים לתיקי כונן',
  'realtime-translate':   'תרגום רפואי',
  'medication-scanner':   'מידע על תרופות',
  burn_calculator:        'מחשבון כוויות',
  hospitals:              'מידע בתי חולים',
  simulators:             'סימולטורים ללמידה',
  // ── Simulator / quiz ───────────────────────────────────────────────────────
  answered:               'תשובה בסימולטור',
  question_answered:      'תשובה בסימולטור',
  quiz_answered:          'תשובה בסימולטור',
  complete:               'השלמת מודול',
  completed:              'השלמת מודול',
  quiz_complete:          'סיום חידון',
  simulation_complete:    'סיום סימולציה',
  action_start:           'התחלת פעולה',
  interaction_start:      'התחלת אינטראקציה',
  quiz:                   'חידון',
  quiz_start:             'התחלת חידון',
  lesson:                 'שיעור',
  lesson_start:           'התחלת שיעור',
  lesson_complete:        'סיום שיעור',
  module:                 'מודול',
  module_start:           'התחלת מודול',
  scenario:               'תרחיש',
  scenario_start:         'התחלת תרחיש',
  scenario_complete:      'סיום תרחיש',
  // ── Daily / challenge ─────────────────────────────────────────────────────
  daily_challenge:        'האתגר היומי',
  challenge:              'האתגר היומי',
  challenge_start:        'התחלת אתגר',
  challenge_complete:     'סיום אתגר',
  // ── Tools & vitals ────────────────────────────────────────────────────────
  vitals:                 'טבלת מדדים',
  vitals_table:           'טבלת מדדים',
  vitals_recorded:        'רישום מדדים',
  tools:                  'כלי עזר',
  tool:                   'כלי עזר',
  metronome:              'מטרונום החייאה',
  metronome_start:        'הפעלת מטרונום',
  // ── Medical knowledge ─────────────────────────────────────────────────────
  background_diseases:    'מחלות רקע',
  diseases:               'מחלות רקע',
  disease:                'מחלת רקע',
  protocol:               'פרוטוקול',
  protocols:              'פרוטוקולים',
  checklist:              'צ\'קליסט',
  emergency:              'חירום',
  // ── Medication scanner ────────────────────────────────────────────────────
  concentration:          'ריכוז תרופה',
  dose:                   'מינון',
  dosage:                 'מינון',
  drug:                   'תרופה',
  medication:             'תרופה',
  indication:             'אינדיקציה',
  contraindication:       'התוויית נגד',
  side_effect:            'תופעת לוואי',
  side_effects:           'תופעות לוואי',
  mechanism:              'מנגנון פעולה',
  overdose:               'מנת יתר',
  barcode_scan:           'סריקת ברקוד',
  scan:                   'סריקה',
  // ── Actions ───────────────────────────────────────────────────────────────
  start:                  'התחלה',
  begin:                  'התחלה',
  end:                    'סיום',
  stop:                   'עצירה',
  pause:                  'השהייה',
  resume:                 'המשך',
  use:                    'שימוש',
  view:                   'צפייה',
  show:                   'הצגה',
  hide:                   'הסתרה',
  open:                   'פתיחה',
  close:                  'סגירה',
  search:                 'חיפוש',
  filter:                 'סינון',
  sort:                   'מיון',
  select:                 'בחירה',
  add:                    'הוספה',
  remove:                 'הסרה',
  save:                   'שמירה',
  delete:                 'מחיקה',
  edit:                   'עריכה',
  update:                 'עדכון',
  submit:                 'שליחה',
  cancel:                 'ביטול',
  confirm:                'אישור',
  reset:                  'איפוס',
  copy:                   'העתקה',
  share:                  'שיתוף',
  send:                   'שליחה',
  download:               'הורדה',
  calculate:              'חישוב',
  click:                  'לחיצה',
  tap:                    'הקשה',
  swipe:                  'החלקה',
  // ── Screen / navigation ───────────────────────────────────────────────────
  home:                   'דף הבית',
  menu:                   'תפריט',
  profile:                'פרופיל',
  settings:               'הגדרות',
  help:                   'עזרה',
  feedback:               'משוב',
  notification:           'התראה',
  alert:                  'התראה',
  result:                 'תוצאה',
  results:                'תוצאות',
  details:                'פרטים',
  info:                   'מידע',
  information:            'מידע',
  content:                'תוכן',
  language:               'שפה',
  translate:              'תרגום',
  translation:            'תרגום',
  community:              'קהילה',
  onboarding:             'הכנסה למערכת',
  rating:                 'דירוג',
  // ── Misc ──────────────────────────────────────────────────────────────────
  selected:               'בחירת תוכן',
  opened:                 'פתיחה',
  modal_opened:           'פתיחת חלונית',
  tutorial_opened:        'פתיחת הדרכה',
  interaction:            'אינטראקציה',
  feature_interaction:    'שימוש בפיצ\'ר',
  // ── Compound feature names from GA4 ───────────────────────────────────────
  daily_selected:         'האתגר היומי',
  challenge_selected:     'האתגר היומי',
  whatsapp_selected:      'קהילת חובש +',
  community_selected:     'קהילת חובש +',
  hospital_selected:      'מידע בתי חולים',
  drug_selected:          'מידע על תרופות',
  medication_selected:    'מידע על תרופות',
  burn_selected:          'מחשבון כוויות',
  simulator_selected:     'סימולטורים ללמידה',
  kit_selected:           'תקנים לתיקי כונן',
  translate_selected:     'תרגום רפואי',
  vitals_selected:        'טבלת מדדים',
  tools_selected:         'כלי עזר',
  disease_selected:       'מחלות רקע',
  // ── Action+feature combos ─────────────────────────────────────────────────
  tutorial_start:         'התחלת הדרכה',
  tutorial_complete:      'סיום הדרכה',
  modal_open:             'פתיחת חלונית',
  modal_close:            'סגירת חלונית',
  screen_view:            'צפייה במסך',
  page_view:              'צפייה בדף',
  button_click:           'לחיצה על כפתור',
  link_click:             'לחיצה על קישור',
  card_click:             'לחיצה על כרטיס',
  item_click:             'לחיצה על פריט',
  item_view:              'צפייה בפריט',
  item_select:            'בחירת פריט',
  category_select:        'בחירת קטגוריה',
  tab_select:             'בחירת לשונית',
  tab_click:              'בחירת לשונית',
  form_open:              'פתיחת טופס',
  form_submit:            'שליחת טופס',
  error_view:             'הצגת שגיאה',
  success_view:           'הצגת הצלחה',
  notification_tap:       'הקשה על התראה',
  back_pressed:           'לחיצת חזרה',
  menu_open:              'פתיחת תפריט',
  search_performed:       'ביצוע חיפוש',
  result_selected:        'בחירת תוצאה',
  // ── Single English words that GA4 might send ─────────────────────────────
  answer:                 'תשובה',
  question:               'שאלה',
  correct:                'תשובה נכונה',
  wrong:                  'תשובה שגויה',
  incorrect:              'תשובה שגויה',
  skip:                   'דילוג',
  next:                   'הבא',
  previous:               'הקודם',
  back:                   'חזרה',
  finish:                 'סיום',
  retry:                  'נסה שוב',
  play:                   'הפעלה',
  level:                  'רמה',
  score:                  'ניקוד',
  timer:                  'טיימר',
  countdown:              'ספירה לאחור',
  unlock:                 'פתיחה',
  lock:                   'נעילה',
  favorite:               'מועדף',
  bookmark:               'סימניה',
  read:                   'קריאה',
  write:                  'כתיבה',
  record:                 'הקלטה',
  photo:                  'תמונה',
  video:                  'וידאו',
  audio:                  'שמע',
  map:                    'מפה',
  location:               'מיקום',
  contact:                'יצירת קשר',
  call:                   'שיחה',
  chat:                   'צ\'אט',
  post:                   'פרסום',
  comment:                'תגובה',
  like:                   'לייק',
  report:                 'דיווח',
  block:                  'חסימה',
  follow:                 'מעקב',
  join:                   'הצטרפות',
  leave:                  'יציאה',
  connect:                'חיבור',
  disconnect:             'ניתוק',
  verify:                 'אימות',
  register:               'הרשמה',
  login:                  'כניסה',
  logout:                 'יציאה מהמערכת',
  pay:                    'תשלום',
  purchase:               'רכישה',
  refund:                 'החזר',
  subscribe:              'מנוי',
  upgrade:                'שדרוג',
  install:                'התקנה',
  uninstall:              'הסרת התקנה',
};

const EVENT_LABELS: Record<string, string> = {
  calculator_open:         'פתיחת מחשבון',
  calculator_use:          'שימוש במחשבון',
  department_nav:          'ניווט למחלקה',
  drug_search:             'חיפוש תרופה',
  protocol_view:           'צפייה בפרוטוקול',
  checklist_complete:      'השלמת צ\'קליסט',
  emergency_alert:         'התראת חירום',
  form_submit:             'שליחת טופס',
  login:                   'כניסה למערכת',
  sign_up:                 'הרשמה',
  search:                  'חיפוש',
  purchase:                'רכישה',
  add_to_cart:             'הוספה לסל',
  share:                   'שיתוף',
  tutorial_begin:          'התחלת הדרכה',
  tutorial_complete:       'סיום הדרכה',
  level_up:                'שדרוג רמה',
  unlock_achievement:      'פתיחת הישג',
  select_content:          'בחירת תוכן',
  view_item:               'צפייה בפריט',
  view_item_list:          'צפייה ברשימה',
  begin_checkout:          'התחלת תשלום',
  generate_lead:           'יצירת ליד',
  feature_interaction:     'אינטראקציה עם פיצ\'ר',
  modal_view:              'צפייה בחלונית',
  language_select:         'בחירת שפה',
  translation_started:     'תחילת תרגום',
  metronome_start:         'הפעלת מטרונום (החייאה)',
  translator_update:       'עדכון תרגום',
  vitals_recorded:         'רישום מדדים',
  burn_body_part_toggle:   'סימון חלקי גוף (כוויות)',
  sign_language_selected:  'בחירת שפת סימנים',
  contact_translator:      'צור קשר עם מתרגם',
};

const CITY_LABELS: Record<string, string> = {
  'Tel Aviv': 'תל אביב-יפו', 'Tel Aviv-Yafo': 'תל אביב-יפו', 'Tel Aviv-Jaffa': 'תל אביב-יפו',
  'Petah Tikva': 'פתח תקווה', 'Petah Tiqwa': 'פתח תקווה',
  'Netanya': 'נתניה', 'Beit Shemesh': 'בית שמש', 'Jerusalem': 'ירושלים',
  'Haifa': 'חיפה', 'Rishon LeZion': 'ראשון לציון', 'Rishon Leziyyon': 'ראשון לציון',
  'Ashdod': 'אשדוד', 'Beer Sheva': 'באר שבע', 'Beersheba': 'באר שבע',
  "Be'er Sheva": 'באר שבע', 'Ramat Gan': 'רמת גן', 'Holon': 'חולון',
  'Bnei Brak': 'בני ברק', 'Rehovot': 'רחובות', 'Bat Yam': 'בת ים',
  'Kfar Saba': 'כפר סבא', 'Herzliya': 'הרצליה', 'Modiin': 'מודיעין',
  "Modi'in": 'מודיעין', 'Lod': 'לוד', 'Ramla': 'רמלה', 'Nazareth': 'נצרת',
  'Nahariya': 'נהריה', 'Tiberias': 'טבריה', 'Eilat': 'אילת',
  'Acre': 'עכו', 'Akko': 'עכו', "Ra'anana": 'רעננה', 'Givatayim': 'גבעתיים',
  'Kiryat Gat': 'קריית גת', 'Sderot': 'שדרות', 'Or Yehuda': 'אור יהודה',
  'Yavne': 'יבנה', 'Ashkelon': 'אשקלון', 'Kiryat Ata': 'קריית אתא',
  'Kiryat Bialik': 'קריית ביאליק', 'Kiryat Motzkin': 'קריית מוצקין',
  'Kiryat Shmona': 'קריית שמונה', 'Kiryat Yam': 'קריית ים', 'Kiryat Ono': 'קריית אונו',
  'Tzfat': 'צפת', 'Safed': 'צפת', 'Dimona': 'דימונה',
};

// Per-word fallback so unknown compound keys (e.g. "daily selected") still render Hebrew
const WORD_HEB: Record<string, string> = {
  // verbs / states
  start:'התחלה', begin:'התחלה', end:'סיום', stop:'עצירה', complete:'השלמה',
  completed:'הושלם', finish:'סיום', open:'פתיחה', opened:'נפתח', close:'סגירה',
  closed:'נסגר', select:'בחירה', selected:'נבחר', view:'צפייה', viewed:'נצפה',
  click:'לחיצה', tap:'הקשה', answer:'תשובה', answered:'נענה', submit:'שליחה',
  use:'שימוש', add:'הוספה', remove:'הסרה', save:'שמירה', delete:'מחיקה',
  edit:'עריכה', search:'חיפוש', filter:'סינון', sort:'מיון', share:'שיתוף',
  send:'שליחה', cancel:'ביטול', confirm:'אישור', reset:'איפוס', skip:'דילוג',
  back:'חזרה', next:'הבא', play:'הפעלה', scan:'סריקה', download:'הורדה',
  upload:'העלאה', calculate:'חישוב', show:'הצגה', hide:'הסתרה', record:'הקלטה',
  // nouns – app features
  daily:'יומי', challenge:'אתגר', tutorial:'הדרכה', modal:'חלונית',
  quiz:'חידון', simulation:'סימולציה', simulator:'סימולטור', lesson:'שיעור',
  module:'מודול', scenario:'תרחיש', action:'פעולה', interaction:'אינטראקציה',
  feature:'פיצ\'ר', screen:'מסך', page:'דף', button:'כפתור', link:'קישור',
  card:'כרטיס', item:'פריט', list:'רשימה', category:'קטגוריה', tab:'לשונית',
  menu:'תפריט', form:'טופס', result:'תוצאה', notification:'התראה',
  // medical
  drug:'תרופה', medication:'תרופה', dose:'מינון', hospital:'בית חולים',
  disease:'מחלה', protocol:'פרוטוקול', checklist:'צ\'קליסט', burn:'כוויה',
  concentration:'ריכוז', emergency:'חירום', translate:'תרגום', community:'קהילה',
  kit:'ציוד', standard:'תקן', tool:'כלי', vitals:'מדדים',
};

function hebrewCity(name: string) { return CITY_LABELS[name] ?? name; }

function hebrewEvent(name: string): string {
  if (!name || name === '(not set)') return 'לא ידוע';
  // Build multiple normalized forms to maximise map hits
  const lower    = name.toLowerCase();
  const withUs   = lower.replace(/[\s\-]+/g, '_');   // spaces/hyphens → underscores
  const withHyph = lower.replace(/[\s_]+/g,  '-');   // spaces/underscores → hyphens
  for (const key of [name, lower, withUs, withHyph]) {
    if (FEATURE_NAME_LABELS[key]) return FEATURE_NAME_LABELS[key];
    if (EVENT_LABELS[key])        return EVENT_LABELS[key];
  }
  // Try first token alone: "concentration_view" → "concentration"
  const parts = withUs.split('_').filter(Boolean);
  if (parts.length > 1) {
    const first      = parts[0];
    const firstHyph  = parts[0];
    for (const k of [first, firstHyph, first + 's']) {
      if (FEATURE_NAME_LABELS[k]) return FEATURE_NAME_LABELS[k];
      if (EVENT_LABELS[k])        return EVENT_LABELS[k];
    }
  }
  // Word-by-word translation — guaranteed Hebrew output
  return parts.map(w => WORD_HEB[w] ?? w).join(' ');
}

function buildDetailLabel(eventName: string, featureName: string): string {
  const featRaw = featureName && featureName !== '(not set)' ? featureName : null;
  const feat = featRaw
    ? (FEATURE_NAME_LABELS[featRaw]
        ?? FEATURE_NAME_LABELS[featRaw.toLowerCase()]
        ?? hebrewEvent(featRaw))
    : null;
  const eventHeb = EVENT_LABELS[eventName] ?? EVENT_LABELS[eventName.toLowerCase()] ?? null;
  if (feat && eventHeb) return `${eventHeb} · ${feat}`;
  if (feat) return feat;
  return hebrewEvent(eventName);
}

const PLATFORM_LABELS: Record<string, string> = {
  iOS: 'iOS', Android: 'אנדרואיד', Windows: 'ווינדוס',
  Macintosh: 'מק', Linux: 'לינוקס', ChromeOS: 'Chrome OS', web: 'ווב',
};
function hebrewPlatform(name: string) { return PLATFORM_LABELS[name] ?? name; }

// ─── Category config ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'calculators',      label: 'מחשבונים',   icon: Calculator,    color: '#f97316', bg: 'bg-orange-500/15' },
  { key: 'medical_knowledge',label: 'ידע רפואי',   icon: Stethoscope,   color: '#06b6d4', bg: 'bg-cyan-500/15'   },
  { key: 'tools',            label: 'כלים',        icon: Wrench,        color: '#a855f7', bg: 'bg-purple-500/15' },
  { key: 'emergency_info',   label: 'מידע חירום',  icon: AlertTriangle, color: '#ef4444', bg: 'bg-red-500/15'    },
] as const;

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: 'easeOut' as const },
  }),
};

const fadeIn = {
  hidden:  { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: { duration: 0.45, delay: i * 0.055 },
  }),
};

// ─── AnimatedNumber ───────────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  format: fmt = formatNumber,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  return <span className="tabular-nums inline-block">{fmt(value)}</span>;
}

// ─── GlassCard ────────────────────────────────────────────────────────────────

function GlassCard({
  children,
  className = '',
  index = 0,
  neonColor,
  pulseClass,
  style: extStyle,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
  neonColor?: string;
  pulseClass?: string;
  style?: React.CSSProperties;
}) {
  const theme = useTheme();
  const isDark = theme === 'dark';

  const baseStyle: React.CSSProperties = isDark
    ? (neonColor
        ? {
            borderColor: neonColor + '28',
            boxShadow: `0 0 28px ${neonColor}14, inset 0 1px 0 rgba(255,255,255,0.06)`,
            '--neon': neonColor,
            ...extStyle,
          } as React.CSSProperties
        : {
            borderColor: 'rgba(255,255,255,0.07)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            ...extStyle,
          })
    : {
        background: '#ffffff',
        borderColor: 'rgba(100,116,139,0.15)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        ...extStyle,
      };

  const cardCls = isDark
    ? `relative rounded-2xl border bg-white/[0.04] backdrop-blur-2xl ${pulseClass ?? ''} ${className}`
    : `relative rounded-2xl border bg-white ${pulseClass ?? ''} ${className}`;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardCls}
      style={baseStyle}
    >
      {children}
    </motion.div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  rawValue,
  rawFormat,
  staticValue,
  sub,
  accentBg,
  accentText,
  index,
  neonColor,
  pulseClass,
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  rawValue?: number;
  rawFormat?: (n: number) => string;
  staticValue?: string;
  sub?: string;
  accentBg: string;
  accentText: string;
  index: number;
  neonColor?: string;
  pulseClass?: string;
  tooltip?: string;
}) {
  return (
    <GlassCard
      index={index}
      className="p-5 flex flex-col gap-3 hover:bg-white/[0.07] transition-colors duration-300"
      neonColor={neonColor}
      pulseClass={pulseClass}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-slate-400 leading-tight truncate">{label}</span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <div className={`p-2 rounded-xl ${accentBg} shrink-0`}>
          <Icon size={15} className={accentText} />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
        {rawValue !== undefined ? (
          <AnimatedNumber value={rawValue} format={rawFormat} />
        ) : (
          staticValue ?? '—'
        )}
      </p>
      {sub && <p className="text-xs text-slate-500 leading-tight">{sub}</p>}
    </GlassCard>
  );
}

// ─── Dark chart tooltips ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md px-4 py-3 text-sm shadow-2xl">
      <p className="font-semibold text-slate-200 mb-1.5">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }} className="leading-relaxed">
          {p.name === 'sessions' ? 'סשנים' : 'משתמשים'}:{' '}
          <span className="font-bold">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md px-4 py-3 text-sm shadow-2xl">
      <p className="font-semibold text-slate-200 mb-1">{label}</p>
      <p style={{ color: '#a78bfa' }}>
        סשנים: <span className="font-bold">{formatNumber(payload[0].value)}</span>
      </p>
    </div>
  );
}

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  const isDark = useTheme() === 'dark';
  const bg  = isDark ? 'bg-white/[0.03] border-white/[0.06]'  : 'bg-slate-100 border-slate-200';
  const el  = isDark ? 'bg-white/[0.06]'                       : 'bg-slate-200/70';
  return (
    <div className={`rounded-2xl border ${bg} p-5 overflow-hidden relative`}>
      <div className="absolute inset-0 shimmer" />
      <div className="relative flex justify-between mb-4">
        <div className={`h-3 w-20 rounded-lg ${el}`} />
        <div className={`h-7 w-7 rounded-xl ${el}`} />
      </div>
      <div className={`relative h-8 w-28 rounded-lg ${el} mb-2`} />
      <div className={`relative h-2.5 w-16 rounded-lg ${el}`} />
    </div>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  const isDark = useTheme() === 'dark';
  const bg = isDark ? 'bg-white/[0.03] border-white/[0.05]' : 'bg-slate-100 border-slate-200';
  return (
    <div className={`rounded-xl overflow-hidden relative border ${bg} ${className}`}>
      <div className="absolute inset-0 shimmer" />
    </div>
  );
}

// ─── InfoTooltip ──────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-flex items-center">
      <Info size={11} className="text-slate-600 cursor-help hover:text-slate-400 transition-colors" />
      <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-52 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md px-3 py-2 text-[11px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-2xl z-50 leading-relaxed">
        {text}
      </div>
    </div>
  );
}

// ─── TileGrid ─────────────────────────────────────────────────────────────────

function TileGrid({
  items,
  countColor,
  emptyText,
  loading,
  labelFn,
  tileClass = '',
  noScroll = false,
}: {
  items: { id: string; label: string; value: number }[];
  countColor: string;
  emptyText: string;
  loading: boolean;
  labelFn?: (label: string) => string;
  tileClass?: string;
  noScroll?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-20" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-8">{emptyText}</p>;
  }
  return (
    <div className={`grid grid-cols-3 gap-2 ${noScroll ? '' : 'overflow-y-auto max-h-72'}`}>
      {items.map((item, i) => {
        const displayLabel = labelFn ? labelFn(item.label) : item.label;
        return (
          <motion.div
            key={item.id}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 text-center min-h-[5rem] justify-center transition-all duration-300 ${tileClass}`}
          >
            <span
              className="text-lg font-bold tabular-nums leading-tight"
              style={{ color: countColor }}
            >
              {formatNumber(item.value)}
            </span>
            <span
              className="text-[11px] text-slate-400 leading-snug break-words w-full"
              title={displayLabel}
            >
              {displayLabel}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── RankedList ───────────────────────────────────────────────────────────────

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
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-10" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-8">{emptyText}</p>;
  }
  return (
    <AnimatePresence mode="popLayout">
      <ol className="flex flex-col gap-2 overflow-y-auto max-h-80">
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
              exit={{ opacity: 0, y: -4 }}
              className="relative rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 overflow-hidden hover:bg-white/[0.06] transition-colors duration-200"
            >
              <div
                className="absolute inset-y-0 right-0 transition-all duration-500 rounded-r-xl"
                style={{ width: `${pct}%`, background: accentColor, opacity: 0.12 }}
              />
              <div className="relative flex items-center justify-between gap-3" dir={itemDir}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-600 w-4 shrink-0 text-center">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-300 break-words leading-snug min-w-0">
                    {displayLabel}
                  </span>
                </div>
                <span className="text-sm font-bold shrink-0 tabular-nums" style={{ color: accentColor }}>
                  {displayValue}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </AnimatePresence>
  );
}

// ─── RealtimePanel ───────────────────────────────────────────────────────────

const AUTO_EVENT_NAMES = new Set([
  'page_view','scroll','session_start','first_visit','user_engagement',
  'click','file_download','video_start','video_progress','video_complete',
  'first_open','app_update','os_update','notification_open',
  'notification_receive','notification_dismiss','firebase_campaign',
]);

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'מובייל', tablet: 'טאבלט', desktop: 'מחשב',
};

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div
      className="flex-1 min-w-0 rounded-t"
      style={{ height: `${pct * 0.36}rem`, background: color, opacity: value ? 0.85 : 0.15 }}
    />
  );
}

function RealtimePanel({ rt }: { rt: RealtimeFast }) {
  const { activeUsers5min, activeUsers30min, screens5min, events5min, features5min,
          cities5min, devices5min, hospitals5min, timeline5min, timeline30min } = rt;

  const maxTl5  = Math.max(...timeline5min.map(t => t.users),  1);
  const maxTl30 = Math.max(...timeline30min.map(t => t.users), 1);

  // Filter auto-events out of event list
  const customEvents5 = events5min.filter(e => !AUTO_EVENT_NAMES.has(e.name));

  return (
    <GlassCard index={13} className="p-6" neonColor="#34d399">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="live-ring absolute h-3 w-3 rounded-full bg-emerald-400 opacity-60" />
            <span className="live-dot relative h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white text-sm">רגע זה – 5 דקות אחרונות</h2>
            <p className="text-[11px] text-slate-500">כמו GA4 Realtime · מתעדכן כל 30 שניות</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">{activeUsers5min}</p>
            <p className="text-[10px] text-slate-500">פעילים 5 דק׳</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <p className="text-2xl font-bold text-teal-400 tabular-nums">{activeUsers30min}</p>
            <p className="text-[10px] text-slate-500">פעילים 30 דק׳</p>
          </div>
        </div>
      </div>

      {/* Timelines */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 5-min timeline */}
        <div>
          <p className="text-[10px] text-slate-600 mb-2">פעילות לפי דקה (5 דק׳ אחרונות)</p>
          <div className="flex items-end gap-0.5 h-16 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2 overflow-hidden">
            {[...timeline5min].reverse().map((t) => (
              <MiniBar key={t.minutesAgo} value={t.users} max={maxTl5} color="#34d399" />
            ))}
            {timeline5min.length === 0 && (
              <span className="text-xs text-slate-600 m-auto">אין נתונים</span>
            )}
          </div>
          <div className="flex justify-between text-[9px] text-slate-700 mt-1 px-1">
            <span>4 דק׳ אחורה</span><span>עכשיו</span>
          </div>
        </div>

        {/* 30-min timeline */}
        <div>
          <p className="text-[10px] text-slate-600 mb-2">פעילות לפי דקה (30 דק׳ אחרונות)</p>
          <div className="flex items-end gap-px h-16 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2 overflow-hidden">
            {[...timeline30min].reverse().map((t) => (
              <MiniBar key={t.minutesAgo} value={t.users} max={maxTl30} color="#2dd4bf" />
            ))}
            {timeline30min.length === 0 && (
              <span className="text-xs text-slate-600 m-auto">אין נתונים</span>
            )}
          </div>
          <div className="flex justify-between text-[9px] text-slate-700 mt-1 px-1">
            <span>30 דק׳ אחורה</span><span>עכשיו</span>
          </div>
        </div>
      </div>

      {/* Main 3-column breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Screens */}
        <div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">מסכים פעילים</p>
          {screens5min.length === 0 ? (
            <p className="text-xs text-slate-600">אין נתונים</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {screens5min.slice(0, 6).map((s) => (
                <div key={s.screen} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-300 truncate flex-1 leading-snug">{s.screen}</span>
                  <span className="text-xs font-bold text-emerald-400 tabular-nums shrink-0">{s.users}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">פיצ׳רים בשימוש</p>
          {features5min.length === 0 ? (
            <p className="text-xs text-slate-600">אין אינטראקציות</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {features5min.slice(0, 6).map((f) => (
                <div key={f.name} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-300 truncate flex-1 leading-snug">{hebrewEvent(f.name)}</span>
                  <span className="text-xs font-bold text-amber-400 tabular-nums shrink-0">{f.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Events */}
        <div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">אירועים (ללא אוטו)</p>
          {customEvents5.length === 0 ? (
            <p className="text-xs text-slate-600">אין אירועים</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {customEvents5.slice(0, 6).map((e) => (
                <div key={e.name} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-300 truncate flex-1 leading-snug">{hebrewEvent(e.name)}</span>
                  <span className="text-xs font-bold text-violet-400 tabular-nums shrink-0">{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom strip: cities + devices + hospitals */}
      {(cities5min.length > 0 || devices5min.length > 0 || hospitals5min.length > 0) && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-4">

          {cities5min.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-600 shrink-0">ערים:</span>
              {cities5min.map((c) => (
                <span key={c.city} className="flex items-center gap-1 rounded-lg border border-teal-400/20 bg-teal-400/[0.06] px-2 py-0.5 text-[11px]">
                  <span className="font-semibold text-teal-400">{c.users}</span>
                  <span className="text-slate-400">{hebrewCity(c.city)}</span>
                </span>
              ))}
            </div>
          )}

          {devices5min.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-600 shrink-0">מכשירים:</span>
              {devices5min.map((d) => (
                <span key={d.device} className="flex items-center gap-1 rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-2 py-0.5 text-[11px]">
                  <span className="font-semibold text-sky-400">{d.users}</span>
                  <span className="text-slate-400">{DEVICE_LABELS[d.device] ?? d.device}</span>
                </span>
              ))}
            </div>
          )}

          {hospitals5min.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-600 shrink-0">ב״ח:</span>
              {hospitals5min.map((h) => (
                <span key={h.name} className="flex items-center gap-1 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-2 py-0.5 text-[11px]">
                  <span className="font-semibold text-rose-400">{h.users}</span>
                  <span className="text-slate-400">{h.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

// ─── Live Feed ────────────────────────────────────────────────────────────────

function LiveFeed({
  data,
  loading,
  liveUsers,
  live5min,
}: {
  data: AnalyticsData | null;
  loading: boolean;
  liveUsers: number;
  live5min: number;
}) {
  const interactions  = data?.realtimeInteractions;
  const total         = Object.values(interactions?.byCategory ?? {}).reduce((a, b) => a + b, 0);
  const activeNow     = liveUsers;
  const topFeatureRaw = interactions?.byFeature?.[0]?.name ?? null;
  const topFeature    = topFeatureRaw ? hebrewEvent(topFeatureRaw) : null;
  const topCity       = data?.cityData?.[0]?.city ? hebrewCity(data.cityData[0].city) : null;
  const hospitalData  = interactions?.hospitalData ?? [];
  const topHospital   = hospitalData[0]?.name ?? null;

  return (
    <GlassCard index={12} className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* Live badge */}
          <div className="relative flex items-center justify-center">
            <span className="live-ring absolute h-3 w-3 rounded-full bg-emerald-400 opacity-60" />
            <span className="live-dot relative h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-emerald-400" />
            <h2 className="font-semibold text-white">Live Feed</h2>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 tracking-wider">
              LIVE
            </span>
          </div>
        </div>
        {!loading && (
          <div className="text-left">
            <p className="text-xs text-slate-500">סה&quot;כ פעולות</p>
            <p className="text-xl font-bold text-white"><AnimatedNumber value={total} /></p>
          </div>
        )}
      </div>

      {/* 4 summary tiles */}
      {loading ? (
        <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Active now – shows both 5-min and 30-min */}
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-center flex flex-col justify-center min-h-[5rem]">
            <p className="text-xl font-bold text-emerald-400"><AnimatedNumber value={live5min} /></p>
            <p className="text-[10px] text-slate-500 leading-tight">5 דק׳</p>
            <p className="text-sm font-semibold text-teal-400 mt-1"><AnimatedNumber value={activeNow} /></p>
            <p className="text-[10px] text-slate-500 leading-tight">30 דק׳</p>
          </div>
          {/* Top feature */}
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-center flex flex-col justify-center min-h-[5rem]">
            <p className="text-sm font-bold text-amber-400 leading-snug break-words">{topFeature ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-1 leading-tight">פיצ&apos;ר<br />מוביל</p>
          </div>
          {/* Top city */}
          <div className="rounded-xl border border-teal-400/20 bg-teal-400/[0.06] p-3 text-center flex flex-col justify-center min-h-[5rem]">
            <p className="text-sm font-bold text-teal-400 leading-snug break-words">{topCity ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-1 leading-tight">עיר<br />פעילה</p>
          </div>
          {/* Top hospital */}
          <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3 text-center flex flex-col justify-center min-h-[5rem]">
            <p className="text-sm font-bold text-sky-400 leading-snug break-words">{topHospital ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-1 leading-tight">בית חולים<br />פעיל</p>
          </div>
        </div>
      )}

      {/* Category tiles */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CATEGORIES.map(({ key, label, icon: Icon, color, bg }, i) => {
            const count  = interactions?.byCategory?.[key] ?? 0;
            const active = count > 0;
            return (
              <motion.div
                key={key}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="rounded-xl border p-4 flex flex-col items-center gap-2 text-center transition-all duration-500"
                style={{
                  borderColor: active ? `${color}35` : 'rgba(255,255,255,0.06)',
                  background:  active ? `${color}0c` : 'rgba(255,255,255,0.02)',
                  boxShadow:   active ? `0 0 20px ${color}18` : undefined,
                }}
              >
                <div className={`p-2.5 rounded-xl ${bg}`}>
                  <Icon size={18} style={{ color }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: active ? color : 'rgba(255,255,255,0.15)' }}>
                  <AnimatedNumber value={count} />
                </p>
                <p className="text-xs text-slate-400 leading-tight">{label}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Feature-level breakdown */}
      {!loading && (interactions?.byFeature ?? []).length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/[0.06]">
          <p className="text-xs text-slate-500 mb-3">פירוט לפי פיצ&apos;ר:</p>
          <AnimatePresence mode="popLayout">
            {interactions!.byFeature.map((f, i) => (
              <motion.div
                key={f.name}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className="flex items-center justify-between py-1.5 border-b border-white/[0.05] last:border-0"
              >
                <span className="text-sm text-slate-300">{hebrewEvent(f.name)}</span>
                <span className="text-sm font-bold text-slate-500 tabular-nums">{formatNumber(f.count)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Hospital breakdown */}
      {!loading && hospitalData.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={14} className="text-sky-400" />
            <p className="text-xs text-slate-500">חובשים בבתי חולים:</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hospitalData.map((h) => (
              <div
                key={h.name}
                className="flex items-center gap-1.5 rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-1.5"
              >
                <span className="text-xs font-semibold text-sky-400">{h.users}</span>
                <span className="text-xs text-slate-400">{h.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && (interactions?.byFeature ?? []).length === 0 && (
        <p className="mt-4 text-sm text-slate-500 text-center">
          אין אינטראקציות בחצי שעה האחרונה
        </p>
      )}
    </GlassCard>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data,         setData]         = useState<AnalyticsData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [range,        setRange]        = useState<Range>('30min');
  const [customStart,  setCustomStart]  = useState('');
  const [customEnd,    setCustomEnd]    = useState('');
  const [sheetRowCount, setSheetRowCount] = useState(0);
  const [sheetsBadge,   setSheetsBadge]  = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [realtimeFast, setRealtimeFast] = useState<RealtimeFast>({
    activeUsers5min: 0,
    activeUsers30min: 0,
    screens5min: [], events5min: [], features5min: [],
    cities5min: [], devices5min: [], hospitals5min: [],
    timeline5min: [], timeline30min: [],
  });

  // Persist theme to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dashboard_theme') as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') setTheme(saved);
  }, []);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('dashboard_theme', next);
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    if (range === 'custom' && (!customStart || !customEnd)) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ range });
    if (range === 'custom') {
      params.set('startDate', customStart);
      params.set('endDate',   customEnd);
    }
    const url = `/api/analytics?${params}`;

    const RETRIES    = 3;
    const TIMEOUT_MS = 25_000;
    let lastErr: Error | null = null;

    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          cache:     'no-store',
          signal:    controller.signal,
          keepalive: true,
        });
        clearTimeout(timer);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `שגיאת שרת: ${res.status}`);
        }
        const json: AnalyticsData = await res.json();
        setData({
          ...json,
          todayActiveUsers: json.todayActiveUsers ?? 0,
          activeUsers5min:  json.activeUsers5min  ?? 0,
          featureEventsDetail: json.featureEventsDetail ?? [],
          realtimeInteractions: json.realtimeInteractions ?? {
            byCategory: { calculators: 0, medical_knowledge: 0, tools: 0, emergency_info: 0 },
            byFeature: [],
            hospitalData: [],
          },
        });
        setLastUpdated(new Date());
        setLoading(false);
        return;
      } catch (e) {
        clearTimeout(timer);
        const isAbort   = e instanceof Error && e.name === 'AbortError';
        const isNetwork = e instanceof TypeError; // "Failed to fetch" / status-0
        console.error(`[analytics] fetch attempt ${attempt}/${RETRIES} failed`, { url, error: e });
        lastErr = isAbort
          ? new Error('הבקשה נקטעה בשל timeout – הנתונים יתרעננו אוטומטית')
          : e instanceof Error
          ? e
          : new Error('שגיאה לא ידועה');
        // Only retry on transient network errors (TypeError); give up on timeout or server errors
        if (isNetwork && attempt < RETRIES) {
          await new Promise<void>((r) => setTimeout(r, attempt * 2_000));
        } else {
          break;
        }
      }
    }

    setError(lastErr?.message ?? 'שגיאה לא ידועה');
    setLoading(false);
  }, [range, customStart, customEnd]);

  useEffect(() => {
    if (range === 'custom') return;
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData, range]);

  // Fast-poll realtime metrics every 30 seconds without triggering full reload
  useEffect(() => {
    async function fetchRealtime() {
      try {
        const res = await fetch('/api/analytics/realtime', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        setRealtimeFast({
          activeUsers5min:  json.activeUsers5min  ?? 0,
          activeUsers30min: json.activeUsers30min ?? 0,
          screens5min:   json.screens5min   ?? [],
          events5min:    json.events5min    ?? [],
          features5min:  json.features5min  ?? [],
          cities5min:    json.cities5min    ?? [],
          devices5min:   json.devices5min   ?? [],
          hospitals5min: json.hospitals5min ?? [],
          timeline5min:  json.timeline5min  ?? [],
          timeline30min: json.timeline30min ?? [],
        });
      } catch {}
    }
    fetchRealtime();
    const id = setInterval(fetchRealtime, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function checkSheets() {
      try {
        const res = await fetch('/api/sheets-count');
        if (!res.ok) return;
        const { rowCount } = await res.json();
        const stored = parseInt(localStorage.getItem('last_seen_count') ?? '0', 10);
        setSheetRowCount(rowCount);
        setSheetsBadge(rowCount > stored);
      } catch {}
    }
    checkSheets();
    const id = setInterval(checkSheets, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const maxHourlySessions = Math.max(...(data?.hourlyData ?? []).map((h) => h.sessions), 1);

  const chartTitle = data?.chartType === 'hourly' ? 'פעילות לפי שעה' : 'כניסות לאפליקציה';
  const chartSub   = data?.chartType === 'hourly' ? 'שעות היממה' : rangeSubLabel(range);

  const cityItems = (data?.cityData ?? []).map((c) => ({ id: c.city, label: hebrewCity(c.city), value: c.users }));
  const featureItems = (() => {
    const detail = data?.featureEventsDetail ?? [];
    if (detail.length > 0) {
      const grouped = new Map<string, number>();
      for (const e of detail) {
        const key = e.featureName && e.featureName !== '(not set)' ? e.featureName : e.eventName;
        grouped.set(key, (grouped.get(key) ?? 0) + e.count);
      }
      return Array.from(grouped.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({
          id: key,
          label: hebrewEvent(key),
          value: count,
        }));
    }
    return (data?.featureEvents ?? []).map((e) => ({
      id: e.name,
      label: hebrewEvent(e.name),
      value: e.count,
    }));
  })();
  const platformItems = (data?.platformData  ?? []).map((p) => ({ id: p.platform,label: p.platform,         value: p.users }));
  const screenItems   = (data?.screenData    ?? []).map((s) => ({ id: s.screen,  label: s.screen,           value: s.views }));

  // Use fast-polled realtime values when available (updated every 30s)
  const liveUsers  = Math.max(realtimeFast.activeUsers30min, data?.realtimeUsers ?? 0);
  const live5min   = Math.max(realtimeFast.activeUsers5min,  data?.activeUsers5min ?? 0);
  const todayUsers = Math.max(data?.todayActiveUsers ?? 0, liveUsers);
  const newUsers   = data?.summaryStats.newUsers ?? 0;
  const livePulse  = neonPulseClass(liveUsers, 3, 10);
  const pulse5min  = neonPulseClass(live5min,  2,  8);
  const newPulse   = neonPulseClass(newUsers,  5, 20);

  const isDark = theme === 'dark';

  return (
    <ThemeCtx.Provider value={theme}>
    <main
      dir="rtl"
      className={`relative min-h-screen overflow-x-hidden ${isDark ? 'text-slate-100' : 'text-slate-900 dashboard-light'}`}
      style={{ background: isDark ? '#020617' : '#f1f5f9' }}
    >
      {/* Background blobs */}
      {isDark ? (
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
          <div className="absolute -top-60 -right-60 h-[700px] w-[700px] rounded-full bg-teal-500/[0.07] blur-[140px]" />
          <div className="absolute top-1/3 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-500/[0.07] blur-[140px]" />
          <div className="absolute bottom-0 right-1/3 h-[500px] w-[500px] rounded-full bg-violet-500/[0.05] blur-[120px]" />
        </div>
      ) : (
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
          <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-teal-300/20 blur-[120px]" />
          <div className="absolute top-1/2 -left-40 h-[500px] w-[500px] rounded-full bg-indigo-300/20 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-violet-300/15 blur-[100px]" />
        </div>
      )}

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
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                חובש<span
                  className="text-teal-400"
                  style={{ textShadow: '0 0 20px rgba(45,212,191,0.6)' }}
                >+</span>
              </h1>
              <p className="mt-1 text-sm text-slate-500">לוח בקרה · GA4 Real-Time Analytics</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {lastUpdated && (
                <span className="text-xs text-slate-600 hidden sm:block">
                  {lastUpdated.toLocaleTimeString('he-IL')}
                </span>
              )}
              <div className="relative">
                <a
                  href="https://docs.google.com/spreadsheets/d/1DiNuIOnOhrMU1GVbPrCd5s2XcIRvPnvIpfiyQnouS28/edit?resourcekey=&gid=893573067#gid=893573067"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    localStorage.setItem('last_seen_count', sheetRowCount.toString());
                    setSheetsBadge(false);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-teal-400/25 bg-teal-400/[0.08] px-4 py-2 text-sm font-semibold text-teal-400 backdrop-blur-md transition-all hover:bg-teal-400/[0.14] hover:border-teal-400/40"
                  style={{ boxShadow: '0 0 14px rgba(45,212,191,0.12)' }}
                >
                  <ExternalLink size={14} />
                  ערוץ
                </a>
                {sheetsBadge && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-slate-900 animate-pulse" />
                )}
              </div>
              <button
                onClick={toggleTheme}
                title={isDark ? 'עבור לתצוגה בהירה' : 'עבור לתצוגה כהה'}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium backdrop-blur-md transition-all
                  ${isDark
                    ? 'border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm'}`}
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
                {isDark ? 'יום' : 'לילה'}
              </button>
              <button
                onClick={fetchData}
                disabled={loading}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium backdrop-blur-md transition-all disabled:opacity-40
                  ${isDark
                    ? 'border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm'}`}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                רענן
              </button>
            </div>
          </div>

          {/* Time Range Picker */}
          <div className="mt-5 grid grid-cols-4 sm:grid-cols-7 gap-2">
            {RANGES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`
                  rounded-xl px-1 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 text-center w-full whitespace-nowrap overflow-hidden text-ellipsis
                  ${range === key
                    ? (isDark ? 'bg-teal-500/80 text-white border border-teal-400/50' : 'bg-teal-600 text-white border border-teal-600')
                    : (isDark
                        ? 'border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                        : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-sm')
                  }
                `}
                style={range === key ? { boxShadow: '0 0 18px rgba(45,212,191,0.28)' } : undefined}
              >
                {key === 'custom' && <CalendarDays size={13} className="inline mr-1 mb-0.5" />}
                {label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          <AnimatePresence>
            {range === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 flex flex-wrap gap-3 items-end"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">מתאריך</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-teal-400/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">עד תאריך</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-teal-400/50"
                  />
                </div>
                <button
                  onClick={fetchData}
                  disabled={!customStart || !customEnd || loading}
                  className="rounded-xl border border-teal-400/30 bg-teal-400/10 px-5 py-2 text-sm font-semibold text-teal-400 transition-all hover:bg-teal-400/20 disabled:opacity-40"
                >
                  טען נתונים
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 flex items-center gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.07] px-5 py-4 text-sm text-red-400"
            >
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bento Stat Cards ── */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {loading ? (
            Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                index={0}
                icon={Users}
                label="סה״כ היום"
                rawValue={todayUsers}
                sub="ממידנוח (שעון ישראל)"
                accentBg="bg-indigo-500/20"
                accentText="text-indigo-400"
                neonColor="#818cf8"
                tooltip="משתמשים ייחודיים (לפי מזהה מכשיר) שהיו פעילים מאז 00:00 שעון ישראל. לעולם לא יהיה נמוך ממספר הפעילים ב-30 דקות."
              />
              <StatCard
                index={1}
                icon={Activity}
                label="פעילים – 5 דק׳"
                rawValue={live5min}
                sub="5 דקות אחרונות"
                accentBg="bg-emerald-500/20"
                accentText="text-emerald-400"
                neonColor="#34d399"
                pulseClass={pulse5min}
                tooltip="משתמשים ייחודיים שביצעו פעולה כלשהי ב-5 הדקות האחרונות. מתעדכן כל 30 שניות."
              />
              <StatCard
                index={2}
                icon={Activity}
                label="פעילים – 30 דק׳"
                rawValue={liveUsers}
                sub="חצי שעה אחרונה"
                accentBg="bg-teal-500/20"
                accentText="text-teal-400"
                neonColor="#2dd4bf"
                pulseClass={livePulse}
                tooltip="משתמשים ייחודיים שביצעו פעולה כלשהי ב-30 הדקות האחרונות. מתעדכן כל 30 שניות."
              />
              <StatCard
                index={3}
                icon={TrendingUp}
                label="סשנים"
                rawValue={data?.summaryStats.sessions ?? 0}
                sub={rangeSubLabel(range)}
                accentBg="bg-violet-500/20"
                accentText="text-violet-400"
                neonColor="#a78bfa"
                tooltip="מספר הסשנים הכולל — משתמש אחד יכול לפתוח כמה סשנים. אינו זהה למספר המשתמשים הייחודיים."
              />
              <StatCard
                index={4}
                icon={UserPlus}
                label="מכשירים חדשים"
                rawValue={newUsers}
                sub="first_open בטווח זה"
                accentBg="bg-sky-500/20"
                accentText="text-sky-400"
                neonColor="#38bdf8"
                pulseClass={newPulse}
                tooltip="מכשירים שפתחו את האפליקציה לראשונה (אירוע first_open). מייצג התקנות חדשות בטווח הנבחר."
              />
              <StatCard
                index={5}
                icon={Clock}
                label="זמן שהייה"
                rawValue={data?.summaryStats.avgSessionDuration ?? 0}
                rawFormat={formatDuration}
                sub="דקות:שניות לסשן"
                accentBg="bg-amber-500/20"
                accentText="text-amber-400"
              />
              <StatCard
                index={6}
                icon={Download}
                label='סה"כ התקנות'
                rawValue={data?.totalInstalls ?? 0}
                sub="מאז הפעלת האפליקציה"
                accentBg="bg-rose-500/20"
                accentText="text-rose-400"
                tooltip="סך כל המכשירים שהתקינו את האפליקציה מאז ינואר 2023 (אירוע newUsers מצטבר)."
              />
            </>
          )}
        </section>

        {/* ── Realtime 5-min Panel ── */}
        <div className="mb-6">
          <RealtimePanel rt={realtimeFast} />
        </div>

        {/* ── Live Feed (30-min breakdown) ── */}
        <div className="mb-6">
          <LiveFeed data={data} loading={loading} liveUsers={liveUsers} live5min={live5min} />
        </div>

        {/* ── Main chart + Features ── */}
        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* Sessions/Users chart – 2/3 */}
          <GlassCard index={6} className="col-span-1 xl:col-span-2 p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/15">
                <BarChart2 size={17} className="text-indigo-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">{chartTitle}</h2>
                <p className="text-xs text-slate-500">{chartSub}</p>
              </div>
            </div>

            {loading ? (
              <SkeletonBlock className="h-56" />
            ) : (
              <div className="w-full" style={{ minHeight: 0 }}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.chartData ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<AreaTooltip />} />
                  <Area type="monotone" dataKey="sessions" stroke="#6366f1" strokeWidth={2} fill="url(#gSessions)" dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                  <Area type="monotone" dataKey="users"    stroke="#8b5cf6" strokeWidth={2} fill="url(#gUsers)"    dot={false} activeDot={{ r: 5, fill: '#8b5cf6' }} />
                </AreaChart>
              </ResponsiveContainer>
              </div>
            )}

            {!loading && (
              <div className="mt-4 flex items-center gap-5 justify-end text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-4 rounded-full bg-indigo-500" />
                  סשנים
                  <InfoTooltip text="כניסות לאפליקציה — משתמש אחד יכול לפתוח מספר סשנים." />
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-4 rounded-full bg-violet-500" />
                  משתמשים ייחודיים
                  <InfoTooltip text="מכשירים ייחודיים (activeUsers) — כל מכשיר נספר פעם אחת, ללא קשר לכמה סשנים פתח." />
                </span>
              </div>
            )}
          </GlassCard>

          {/* Features TileGrid – 1/3 */}
          <GlassCard index={7} className="col-span-1 p-6 flex flex-col min-h-0">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15">
                <Zap size={17} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-white">פיצ&apos;רים בשימוש</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-slate-500">סה&quot;כ פעולות (לא משתמשים ייחודיים)</p>
                  <InfoTooltip text="המספרים מייצגים סך הפעולות (eventCount) — לא משתמשים ייחודיים. משתמש שפתח פיצ׳ר 3 פעמים נספר 3." />
                </div>
              </div>
            </div>
            <TileGrid
              items={featureItems}
              countColor="#fbbf24"
              emptyText="אין אירועי פיצ'ר בטווח זה"
              loading={loading}
              tileClass="border-amber-400/15 bg-amber-400/[0.05] hover:border-amber-400/30 hover:bg-amber-400/[0.08]"
            />
          </GlassCard>
        </div>

        {/* ── Hourly heatmap + Cities ── */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Peak hours bar chart */}
          <GlassCard index={8} className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/15">
                <Activity size={17} className="text-violet-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">שעות עומס</h2>
                <p className="text-xs text-slate-500">פעילות לפי שעות היממה</p>
              </div>
            </div>

            {loading ? (
              <SkeletonBlock className="h-48" />
            ) : (
              <div className="w-full" style={{ minHeight: 0 }}>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={data?.hourlyData ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="sessions" radius={[4, 4, 0, 0]}>
                    {(data?.hourlyData ?? []).map((entry) => {
                      const intensity = entry.sessions / maxHourlySessions;
                      return (
                        <Cell key={entry.hour} fill={`rgba(167,139,250,${0.25 + intensity * 0.75})`} />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            )}
          </GlassCard>

          {/* Geographic cities TileGrid */}
          <GlassCard index={9} className="p-6 flex flex-col">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-teal-500/15">
                <MapPin size={17} className="text-teal-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">ניתוח גאוגרפי</h2>
                <p className="text-xs text-slate-500">ערים עם הכי הרבה משתמשים</p>
              </div>
            </div>
            <TileGrid
              items={cityItems}
              countColor="#2dd4bf"
              emptyText="אין נתוני עיר זמינים"
              loading={loading}
              noScroll
              tileClass="border-teal-400/15 bg-teal-400/[0.05] hover:border-teal-400/30 hover:bg-teal-400/[0.08]"
            />
          </GlassCard>
        </div>

        {/* ── Platform + Top screens ── */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

          <GlassCard index={10} className="p-6 flex flex-col">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/15">
                <Smartphone size={17} className="text-sky-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">פלטפורמות</h2>
                <p className="text-xs text-slate-500">פילוח לפי מערכת הפעלה</p>
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

          <GlassCard index={11} className="p-6 flex flex-col">
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-pink-500/15">
                <Monitor size={17} className="text-pink-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">מסכים פופולריים</h2>
                <p className="text-xs text-slate-500">הדפים עם הכי הרבה צפיות</p>
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
          className="mt-4 text-center text-xs text-slate-700"
        >
          חובש+ Analytics Dashboard &copy; {new Date().getFullYear()}
        </motion.footer>

      </div>
    </main>
    </ThemeCtx.Provider>
  );
}
