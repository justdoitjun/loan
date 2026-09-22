#!/usr/bin/env node
/* 노원구 아파트 실거래 → src/data/units.json.
   앱은 이 파일을 import하지 않는다. 시세 갱신 = JSON 교체 후 재배포.
   GitHub Actions 예:
     node scripts/fetch-units.mjs --from 202601 --to 202606
     env: DATA_GO_KR_KEY  (디코딩 키. secrets로) */

import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(root, "src/data/units.json");
const TMP_PATH = join(root, "src/data/units.json.tmp");

const ENDPOINT = "http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
/* 서울특별시 노원구. 행정표준코드관리시스템(code.go.kr)에서 확인 — 법정동코드 앞 5자리. */
const LAWD_CD = "11350";
const NUM_OF_ROWS = 100;
const REQUEST_GAP_MS = 300;
const RECENT_FOR_PRICE = 3;
const AREA_BANDS_M2 = [20, 25, 30, 33, 36, 39, 41, 46, 49, 52, 55, 59, 64, 68, 74, 79, 84, 85, 99, 114, 135, 168];

/* 상세 API(RTMSDataSvcAptTradeDev) 태그.
   일반 API는 국문 태그(아파트·거래금액·해제사유발생일)라서 여기 쓰지 않는다.
   실제 응답은 --probe 로 확인한 뒤 여기만 고친다. */
const TAG = {
  name: "aptNm",
  dong: "umdNm",
  area: "excluUseAr",
  price: "dealAmount",
  floor: "floor",
  year: "dealYear",
  month: "dealMonth",
  day: "dealDay",
  cancelDay: "cdealDay",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad2 = (n) => String(n).padStart(2, "0");
const todayKst = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function loadDotEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  process.loadEnvFile(envPath);
}

function usage(msg) {
  if (msg) console.error(msg);
  console.error("사용법:");
  console.error("  node scripts/fetch-units.mjs --from YYYYMM --to YYYYMM");
  console.error("  node scripts/fetch-units.mjs --probe --from YYYYMM");
  process.exit(1);
}

function parseArgs(argv) {
  const out = { probe: false, from: null, to: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (!v || v.startsWith("-")) usage(`값 없음: ${a}`);
      return v;
    };
    if (a === "--probe") out.probe = true;
    else if (a === "--from") out.from = next();
    else if (a === "--to") out.to = next();
    else if (a.startsWith("--from=")) out.from = a.slice("--from=".length);
    else if (a.startsWith("--to=")) out.to = a.slice("--to=".length);
    else usage(`알 수 없는 인자: ${a}`);
  }
  const ym = /^\d{6}$/;
  if (!out.from || !ym.test(out.from)) usage("--from YYYYMM 이 필요합니다.");
  if (out.probe) {
    out.to = out.from;
    return out;
  }
  if (!out.to || !ym.test(out.to)) usage("--to YYYYMM 이 필요합니다.");
  if (out.from > out.to) usage("--from 이 --to 보다 늦습니다.");
  const month = (s) => {
    const m = Number(s.slice(4, 6));
    if (m < 1 || m > 12) usage(`월이 잘못됨: ${s}`);
  };
  month(out.from);
  month(out.to);
  return out;
}

function monthsBetween(from, to) {
  const out = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(4, 6));
  const ey = Number(to.slice(0, 4));
  const em = Number(to.slice(4, 6));
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}${pad2(m)}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tagText(xml, name) {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`);
  const m = xml.match(re);
  return m ? decodeEntities(m[1]) : null;
}

function allTags(block) {
  const found = [];
  const re = /<([A-Za-z_][\w.-]*)>[^<]*<\/\1>/g;
  let m;
  while ((m = re.exec(block))) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
}

function itemBlocks(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
}

function apiError(xml) {
  const auth = (tagText(xml, "returnAuthMsg") || tagText(xml, "errMsg") || "").trim();
  if (auth) {
    const code = (tagText(xml, "returnReasonCode") || "").trim();
    return code ? `${code} ${auth}` : auth;
  }
  const code = (tagText(xml, "resultCode") || "").trim();
  const msg = (tagText(xml, "resultMsg") || "").trim();
  if (code && code !== "00" && code !== "000") return `${code} ${msg}`.trim();
  return null;
}

function serviceKey() {
  const key = (process.env.DATA_GO_KR_KEY || "").trim();
  if (!key) {
    console.error("DATA_GO_KR_KEY 가 없습니다. .env 에 디코딩 키를 넣거나 환경변수로 넘기세요.");
    console.error("인코딩 키를 넣으면 이중 인코딩되어 실패합니다.");
    process.exit(1);
  }
  return key;
}

function buildUrl({ key, dealYmd, pageNo }) {
  const q = new URLSearchParams({
    LAWD_CD,
    DEAL_YMD: dealYmd,
    pageNo: String(pageNo),
    numOfRows: String(NUM_OF_ROWS),
  });
  return `${ENDPOINT}?serviceKey=${encodeURIComponent(key)}&${q}`;
}

async function fetchXml(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/xml" } });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
      return text;
    } catch (e) {
      last = e;
      await sleep(500 * (i + 1));
    }
  }
  throw last;
}

function areaBand(m2) {
  let best = AREA_BANDS_M2[0];
  let dist = Math.abs(m2 - best);
  for (const b of AREA_BANDS_M2) {
    const d = Math.abs(m2 - b);
    if (d < dist || (d === dist && b < best)) {
      best = b;
      dist = d;
    }
  }
  return best;
}

function parseManwon(raw) {
  const n = Number(String(raw).replace(/[,\s]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`거래금액 파싱 실패: ${JSON.stringify(raw)}`);
  return Math.round(n);
}

function parseDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (![y, m, d].every(Number.isFinite) || m < 1 || m > 12 || d < 1 || d > 31) {
    throw new Error(`계약일 파싱 실패: ${year}-${month}-${day}`);
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function median(nums) {
  const a = [...nums].sort((x, y) => x - y);
  const n = a.length;
  if (n === 0) return null;
  if (n % 2) return a[(n - 1) / 2];
  return Math.round((a[n / 2 - 1] + a[n / 2]) / 2);
}

function medianFloat(nums) {
  const a = [...nums].sort((x, y) => x - y);
  const n = a.length;
  if (n === 0) return null;
  if (n % 2) return a[(n - 1) / 2];
  return (a[n / 2 - 1] + a[n / 2]) / 2;
}

function itemMap(block) {
  const row = {};
  const re = /<([A-Za-z_][\w.-]*)>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(block))) row[m[1]] = decodeEntities(m[2]);
  return row;
}

function assertKnownTags(xml) {
  const blocks = itemBlocks(xml);
  if (!blocks.length) return;
  const found = allTags(blocks[0]);
  const required = [TAG.name, TAG.dong, TAG.area, TAG.price, TAG.year, TAG.month, TAG.day];
  const missing = required.filter((t) => !found.includes(t));
  if (missing.length) {
    throw new Error(
      `응답에 없는 태그: ${missing.join(", ")}\n발견된 태그: ${found.join(", ") || "(없음)"}\n--probe 로 원본 XML을 확인하세요.`,
    );
  }
}

function parseTrade(block) {
  const row = itemMap(block);
  const cancel = (row[TAG.cancelDay] || "").trim();
  if (cancel) return { cancelled: true };
  const name = (row[TAG.name] || "").trim();
  const dong = (row[TAG.dong] || "").trim();
  const areaRaw = (row[TAG.area] || "").trim();
  const priceRaw = row[TAG.price];
  const year = (row[TAG.year] || "").trim();
  const month = (row[TAG.month] || "").trim();
  const day = (row[TAG.day] || "").trim();
  const floor = (row[TAG.floor] || "").trim();
  if (!name || !dong || !areaRaw || priceRaw == null || !year || !month || !day) {
    return { skipped: true, found: Object.keys(row) };
  }
  const area = Number(areaRaw.replace(/,/g, ""));
  if (!Number.isFinite(area) || area <= 0) return { skipped: true, found: Object.keys(row) };
  return {
    name,
    dong,
    area,
    price: parseManwon(priceRaw),
    floor: floor ? Number(floor) : null,
    date: parseDate(year, month, day),
  };
}

function groupTrades(trades) {
  const groups = new Map();
  for (const t of trades) {
    const band = areaBand(t.area);
    const id = `${t.dong}|${t.name}|${band}`;
    if (!groups.has(id)) groups.set(id, { id, name: t.name, dong: t.dong, band, trades: [] });
    groups.get(id).trades.push(t);
  }
  const units = [];
  for (const g of groups.values()) {
    const sorted = [...g.trades].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.price !== b.price) return a.price - b.price;
      return (a.floor ?? 0) - (b.floor ?? 0);
    });
    const recent = sorted.slice(0, RECENT_FOR_PRICE);
    const 전용 = round1(medianFloat(g.trades.map((t) => t.area)));
    const 최근거래일 = sorted[0].date;
    units.push({
      id: g.id,
      이름: g.name,
      동: g.dong,
      전용,
      면적대: g.band,
      가격: median(recent.map((t) => t.price)),
      거래건수: g.trades.length,
      최근거래일,
    });
  }
  units.sort((a, b) => a.동.localeCompare(b.동, "ko") || a.이름.localeCompare(b.이름, "ko") || a.면적대 - b.면적대);
  return units;
}

function atomicWrite(path, tmp, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path);
}

function printSummary({ from, to, rawCount, cancelled, skipped, units }) {
  const complexes = new Set(units.map((u) => `${u.동}|${u.이름}`)).size;
  const thin = units.filter((u) => u.거래건수 <= 2).length;
  console.log(`수집 기간: ${from}~${to}  노원구(${LAWD_CD})`);
  console.log(`원거래 ${rawCount}건  취소 ${cancelled}건  스킵 ${skipped}건  사용 ${rawCount - cancelled - skipped}건`);
  console.log(`단지 ${complexes}개  그룹(단지+면적대) ${units.length}개  거래건수 1~2건 ${thin}개`);
  console.log(`기록: ${OUT_PATH}`);
  console.log("상위 10개 (가격순, 만원):");
  const top = [...units].sort((a, b) => b.가격 - a.가격 || a.이름.localeCompare(b.이름, "ko")).slice(0, 10);
  for (const u of top) {
    console.log(
      `  ${String(u.가격).padStart(7)}  ${u.이름}  ${u.동}  ${u.전용}㎡(대 ${u.면적대})  ${u.거래건수}건  ${u.최근거래일}`,
    );
  }
}

async function fetchMonth(key, dealYmd, { probe }) {
  const pages = [];
  let pageNo = 1;
  let totalCount = null;
  while (true) {
    if (pages.length) await sleep(REQUEST_GAP_MS);
    const xml = await fetchXml(buildUrl({ key, dealYmd, pageNo }));
    const err = apiError(xml);
    if (probe) return { xml, err };
    if (err) throw new Error(`${dealYmd} p${pageNo}: ${err}`);
    if (totalCount == null) {
      const t = tagText(xml, "totalCount");
      totalCount = t ? Number(t.trim()) : itemBlocks(xml).length;
      if (itemBlocks(xml).length) assertKnownTags(xml);
    }
    pages.push(xml);
    const got = pages.reduce((n, p) => n + itemBlocks(p).length, 0);
    if (!totalCount || got >= totalCount || itemBlocks(xml).length === 0) break;
    pageNo += 1;
  }
  return { pages };
}

async function main() {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const key = serviceKey();
  const months = monthsBetween(args.from, args.to);

  if (args.probe) {
    const dealYmd = months[0];
    console.error(`[probe] LAWD_CD=${LAWD_CD} DEAL_YMD=${dealYmd} pageNo=1 numOfRows=${NUM_OF_ROWS}`);
    console.error("[probe] 한 달 1페이지만 원본 출력하고 멈춥니다. 태그 확인 후 파서를 확정하세요.");
    const { xml, err } = await fetchMonth(key, dealYmd, { probe: true });
    const blocks = itemBlocks(xml);
    const tags = blocks.length ? allTags(blocks[0]) : [];
    if (err) console.error(`[probe] API 오류: ${err}`);
    else {
      console.error(`[probe] item ${blocks.length}건  totalCount=${(tagText(xml, "totalCount") || "?").trim()}`);
      console.error(`[probe] 발견된 태그: ${tags.join(", ") || "(item 없음)"}`);
    }
    process.stdout.write(xml.endsWith("\n") ? xml : xml + "\n");
    if (err) process.exit(1);
    return;
  }

  const trades = [];
  let rawCount = 0;
  let cancelled = 0;
  let skipped = 0;
  for (let i = 0; i < months.length; i++) {
    if (i) await sleep(REQUEST_GAP_MS);
    const ymd = months[i];
    process.stderr.write(`수집 ${ymd} … `);
    const { pages } = await fetchMonth(key, ymd, { probe: false });
    let monthN = 0;
    for (const xml of pages) {
      for (const block of itemBlocks(xml)) {
        rawCount += 1;
        monthN += 1;
        const t = parseTrade(block);
        if (t.cancelled) cancelled += 1;
        else if (t.skipped) skipped += 1;
        else trades.push(t);
      }
    }
    process.stderr.write(`${monthN}건\n`);
  }

  const units = groupTrades(trades);
  const json = JSON.stringify(
    {
      생성일: todayKst(),
      출처: `국토부 실거래가 API, 조회기간 ${args.from}~${args.to}`,
      units,
    },
    null,
    2,
  ) + "\n";
  atomicWrite(OUT_PATH, TMP_PATH, json);
  printSummary({ from: args.from, to: args.to, rawCount, cancelled, skipped, units });
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
