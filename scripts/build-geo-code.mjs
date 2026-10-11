#!/usr/bin/env node
/* ../openapi_data/code_geo_seoul.csv (원본, utf-8) → src/data/geo/geo_code.js
   CSV 열: 법정동코드,법정동명,폐지여부   예) 1111010100,서울특별시 종로구 청운동,존재
   시·구 단위 행(법정동명이 3단어가 아닌 행)은 넣지 않는다. 동 단위만.
   하나라도 이상한 행이 있으면 아무것도 쓰지 않고 실패한다. */

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "../openapi_data/code_geo_seoul.csv");
const OUT = join(root, "src/data/geo/geo_code.js");
const CITY = "서울특별시";
const EXIST = { 존재: true, 폐지: false };

const lines = readFileSync(SRC, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
const header = lines.shift();
if (header.trim() !== "법정동코드,법정동명,폐지여부") throw new Error(`헤더가 다름: ${header}`);

const rows = [];
const seen = new Set();
for (const [i, line] of lines.entries()) {
  const where = `${i + 2}행: ${line}`;
  const [code, name, status, ...rest] = line.split(",").map((s) => s.trim());
  if (rest.length || !/^\d{10}$/.test(code) || !(status in EXIST)) throw new Error(`형식 오류 ${where}`);
  if (seen.has(code)) throw new Error(`코드 중복 ${where}`);
  seen.add(code);
  const parts = name.split(/\s+/);
  if (parts[0] !== CITY) throw new Error(`서울 아님 ${where}`);
  if (parts.length !== 3) continue;
  rows.push({ code, gu: parts[1], dong: parts[2], exist: EXIST[status] });
}
rows.sort((a, b) => (a.code < b.code ? -1 : 1));

const body = rows
  .map((r) => `  "${r.code}": { city: "${CITY}", gu: "${r.gu}", dong: "${r.dong}", exist: ${r.exist} },`)
  .join("\n");
const text = `/* 서울 법정동 코드표. scripts/build-geo-code.mjs 가 생성 — 손으로 고치지 말 것. 로직(함수) 금지.
   원본: ../openapi_data/code_geo_seoul.csv (법정동코드,법정동명,폐지여부)
   key = 법정동코드 10자리. exist = 폐지여부가 '존재'. 시·구 단위 행은 넣지 않는다.
   화면용 구·동 목록은 src/geo.js 가 여기서 만든다. */
export const CITY = "${CITY}";

export const GEO_CODE = {
${body}
};
`;

writeFileSync(OUT + ".tmp", text, "utf8");
renameSync(OUT + ".tmp", OUT);
const live = rows.filter((r) => r.exist).length;
console.log(`${OUT}\n동 ${rows.length}개 (존재 ${live} · 폐지 ${rows.length - live}) · 구 ${new Set(rows.map((r) => r.gu)).size}개`);
