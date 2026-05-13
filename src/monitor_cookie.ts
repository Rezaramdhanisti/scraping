import axios from 'axios';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Muat `.env` di root project (bukan cwd), supaya env terbaca saat `tsx src/monitor_cookie.ts` */
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'),
});

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const apiKey = process.env.API_KEY;

const RUN_ON_START = true;

if (!SLACK_WEBHOOK_URL || !apiKey) {
  console.error('[monitor_cookie] Set SLACK_WEBHOOK_URL and API_KEY in .env');
  process.exit(1);
}

const config = {
  method: 'get',
  maxBodyLength: Infinity,
  url: 'https://trip.api.scraper.mrscraper.com/api/count-tiktok-cookie-low-empty-room',
  headers: {
    'x-api-key': apiKey,
  },
};

/** Ms sampai titik jam berikutnya (menit & detik = 00), zona waktu lokal */
function msUntilNextTopOfHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setMilliseconds(0);
  if (next.getTime() <= now.getTime()) {
    next.setHours(next.getHours() + 1);
  }
  return next.getTime() - now.getTime();
}

let nextRun = Date.now();

function formatMs(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

async function runJob() {
  try {
    console.log(`[JOB] Running at ${new Date().toISOString()}`);

    const response = await axios.get(config.url, {
      headers: config.headers,
    });

    const data = response.data;
    const count = data?.count;

    const text = [
      ':warning: *TikTok cookie monitor*',
      `Active cookie count: ${count ?? 'unknown'}`,
      `_Checked at ${new Date().toISOString()}_`,
    ].join('\n');

    await axios.post(
      SLACK_WEBHOOK_URL,
      { text },
      { headers: { 'Content-Type': 'application/json' } },
    );

    console.log('[JOB] Slack notification sent');
  } catch (err) {
    console.error('[JOB] Failed:', err);
  }
}

function scheduleNextTopOfHour() {
  const delay = msUntilNextTopOfHour();
  nextRun = Date.now() + delay;
  console.log(
    `[SCHEDULE] Next run at top of hour in ${formatMs(delay)} (${new Date(nextRun).toLocaleString()})`,
  );
  setTimeout(async () => {
    await runJob();
    scheduleNextTopOfHour();
  }, delay);
}

if (RUN_ON_START) {
  void runJob().then(() => scheduleNextTopOfHour());
} else {
  scheduleNextTopOfHour();
}

// countdown logger tiap detik
setInterval(() => {
  const remaining = nextRun - Date.now();
  process.stdout.write(
    `\rNext run in: ${formatMs(remaining)} (${new Date(nextRun).toLocaleTimeString()})   `,
  );
}, 1000);
