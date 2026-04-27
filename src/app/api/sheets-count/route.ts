import { NextResponse } from 'next/server';

const SPREADSHEET_ID = '1DiNuIOnOhrMU1GVbPrCd5s2XcIRvPnvIpfiyQnouS28';
const GID = '893573067';

export async function GET() {
  try {
    const csvUrl =
      `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

    const res = await fetch(csvUrl, { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json(
        { rowCount: 0, error: 'שגיאה בגישה לגיליון' },
        { status: 502 }
      );
    }

    const text = await res.text();
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const rowCount = Math.max(0, lines.length - 1); // subtract header row

    return NextResponse.json({ rowCount }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ rowCount: 0, error: String(e) }, { status: 500 });
  }
}
