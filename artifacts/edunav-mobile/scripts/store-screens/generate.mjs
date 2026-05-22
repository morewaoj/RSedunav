#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COL, SCREEN_TAGLINES } from "./brand.mjs";
import {
  generateFeatureGraphic,
  generateIcon512,
} from "./generate-play-extras.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const OUT_IOS = join(ROOT, "assets", "store", "ios");
const OUT_ANDROID = join(ROOT, "assets", "store", "android");
mkdirSync(OUT_IOS, { recursive: true });
mkdirSync(OUT_ANDROID, { recursive: true });

// ---------- helpers ----------
const escape = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function statusBar(W, top, time = "9:41") {
  // Compact, real-looking iOS-style status bar drawn entirely from SVG shapes.
  const padX = W * 0.06;
  const cy = top * 0.55;
  const fs = Math.max(top * 0.36, 28);
  // Right-side icons
  const iconY = cy - top * 0.20;
  const iconH = top * 0.40;
  // Battery box
  const batW = iconH * 2.0;
  const batX = W - padX - batW;
  // Wifi (3 arcs) center
  const wifiR = iconH * 0.55;
  const wifiCx = batX - iconH * 1.6;
  const wifiCy = iconY + iconH * 0.85;
  // Signal bars
  const barUnit = iconH * 0.18;
  const sigX = wifiCx - wifiR * 2 - iconH * 1.2;
  let sb = "";
  for (let i = 0; i < 4; i++) {
    const bh = (i + 1) * (iconH / 4);
    sb += `<rect x="${sigX + i * (barUnit + 4)}" y="${iconY + iconH - bh}" width="${barUnit}" height="${bh}" rx="2" fill="${COL.fg}"/>`;
  }
  // Wifi arcs
  const wifi = `
    <path d="M ${wifiCx - wifiR} ${wifiCy - wifiR * 0.5} A ${wifiR} ${wifiR} 0 0 1 ${wifiCx + wifiR} ${wifiCy - wifiR * 0.5}" stroke="${COL.fg}" stroke-width="${iconH * 0.12}" fill="none" stroke-linecap="round"/>
    <path d="M ${wifiCx - wifiR * 0.6} ${wifiCy - wifiR * 0.15} A ${wifiR * 0.6} ${wifiR * 0.6} 0 0 1 ${wifiCx + wifiR * 0.6} ${wifiCy - wifiR * 0.15}" stroke="${COL.fg}" stroke-width="${iconH * 0.12}" fill="none" stroke-linecap="round"/>
    <circle cx="${wifiCx}" cy="${wifiCy}" r="${iconH * 0.10}" fill="${COL.fg}"/>`;
  // Battery
  const bat = `
    <rect x="${batX}" y="${iconY + iconH * 0.10}" width="${batW}" height="${iconH * 0.80}" rx="${iconH * 0.18}" fill="none" stroke="${COL.fg}" stroke-width="${iconH * 0.08}"/>
    <rect x="${batX + batW + 2}" y="${iconY + iconH * 0.32}" width="${iconH * 0.10}" height="${iconH * 0.36}" rx="${iconH * 0.04}" fill="${COL.fg}"/>
    <rect x="${batX + iconH * 0.12}" y="${iconY + iconH * 0.22}" width="${(batW - iconH * 0.24) * 0.85}" height="${iconH * 0.56}" rx="${iconH * 0.10}" fill="${COL.fg}"/>`;
  return `
  <g font-family="-apple-system, system-ui, Roboto, Helvetica" fill="${COL.fg}">
    <text x="${padX}" y="${cy + fs * 0.35}" font-size="${fs}" font-weight="600">${time}</text>
    ${sb}
    ${wifi}
    ${bat}
  </g>`;
}

// ---- Inline SVG icon helpers (no emoji font dependency) ----
function iconBriefcase(cx, cy, size, color) {
  const w = size, h = size * 0.78;
  const x = cx - w / 2, y = cy - h / 2;
  const handleW = w * 0.34, handleH = h * 0.18;
  const handleX = cx - handleW / 2, handleY = y - handleH * 0.5;
  return `
    <rect x="${handleX}" y="${handleY}" width="${handleW}" height="${handleH * 1.4}" rx="${handleH * 0.4}" fill="none" stroke="${color}" stroke-width="${size * 0.08}"/>
    <rect x="${x}" y="${y + handleH * 0.6}" width="${w}" height="${h}" rx="${size * 0.10}" fill="${color}"/>
    <rect x="${x + w * 0.10}" y="${y + h * 0.55}" width="${w * 0.80}" height="${h * 0.10}" rx="2" fill="#FFFFFF" fill-opacity="0.45"/>`;
}
function iconCap(cx, cy, size, color) {
  // Graduation cap
  const half = size / 2;
  const top = cy - half * 0.55;
  return `
    <polygon points="${cx - half},${top + half * 0.30} ${cx},${top} ${cx + half},${top + half * 0.30} ${cx},${top + half * 0.60}" fill="${color}"/>
    <path d="M ${cx - half * 0.65} ${top + half * 0.45} L ${cx - half * 0.65} ${top + half * 0.95} Q ${cx} ${top + half * 1.30} ${cx + half * 0.65} ${top + half * 0.95} L ${cx + half * 0.65} ${top + half * 0.45}" fill="${color}" fill-opacity="0.85"/>
    <line x1="${cx + half}" y1="${top + half * 0.30}" x2="${cx + half}" y2="${top + half * 1.05}" stroke="${color}" stroke-width="${size * 0.05}"/>
    <circle cx="${cx + half}" cy="${top + half * 1.10}" r="${size * 0.07}" fill="${color}"/>`;
}
function iconBell(cx, cy, size, color) {
  const w = size * 0.85, h = size * 0.85;
  const x = cx, y = cy;
  return `
    <path d="M ${x - w * 0.45} ${y + h * 0.10}
             Q ${x - w * 0.45} ${y - h * 0.55} ${x} ${y - h * 0.55}
             Q ${x + w * 0.45} ${y - h * 0.55} ${x + w * 0.45} ${y + h * 0.10}
             L ${x + w * 0.55} ${y + h * 0.30}
             L ${x - w * 0.55} ${y + h * 0.30} Z"
          fill="${color}"/>
    <circle cx="${x}" cy="${y + h * 0.45}" r="${w * 0.10}" fill="${color}"/>`;
}
function iconSearch(cx, cy, size, color) {
  const r = size * 0.36;
  return `
    <circle cx="${cx - size * 0.05}" cy="${cy - size * 0.05}" r="${r}" fill="none" stroke="${color}" stroke-width="${size * 0.10}"/>
    <line x1="${cx + r * 0.65}" y1="${cy + r * 0.65}" x2="${cx + r * 1.20}" y2="${cy + r * 1.20}" stroke="${color}" stroke-width="${size * 0.10}" stroke-linecap="round"/>`;
}
function iconUpload(cx, cy, size, color) {
  const w = size * 0.55;
  return `
    <line x1="${cx}" y1="${cy + w * 0.55}" x2="${cx}" y2="${cy - w * 0.55}" stroke="${color}" stroke-width="${size * 0.12}" stroke-linecap="round"/>
    <polyline points="${cx - w * 0.40},${cy - w * 0.15} ${cx},${cy - w * 0.55} ${cx + w * 0.40},${cy - w * 0.15}" fill="none" stroke="${color}" stroke-width="${size * 0.12}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function iconHeart(cx, cy, size, color) {
  const r = size * 0.30;
  return `
    <path d="M ${cx} ${cy + r * 0.95}
             C ${cx - r * 1.8} ${cy - r * 0.10}, ${cx - r * 1.4} ${cy - r * 1.55}, ${cx} ${cy - r * 0.40}
             C ${cx + r * 1.4} ${cy - r * 1.55}, ${cx + r * 1.8} ${cy - r * 0.10}, ${cx} ${cy + r * 0.95} Z"
          fill="${color}"/>`;
}
function iconStar(cx, cy, size, color) {
  // Five-point star
  const r1 = size * 0.45, r2 = size * 0.18;
  let pts = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts += `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r} `;
  }
  return `<polygon points="${pts.trim()}" fill="${color}"/>`;
}
function iconHome(cx, cy, size, color) {
  const w = size * 0.5;
  return `
    <polygon points="${cx - w},${cy} ${cx},${cy - w * 0.95} ${cx + w},${cy}" fill="${color}"/>
    <rect x="${cx - w * 0.78}" y="${cy - w * 0.05}" width="${w * 1.56}" height="${w * 0.85}" rx="${w * 0.10}" fill="${color}"/>`;
}
function iconBook(cx, cy, size, color) {
  const w = size * 0.55, h = size * 0.65;
  return `
    <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${w * 0.08}" fill="${color}"/>
    <rect x="${cx - w / 2 + w * 0.12}" y="${cy - h / 2 + h * 0.18}" width="${w * 0.76}" height="${h * 0.06}" fill="#FFFFFF" fill-opacity="0.6"/>
    <rect x="${cx - w / 2 + w * 0.12}" y="${cy - h / 2 + h * 0.36}" width="${w * 0.50}" height="${h * 0.06}" fill="#FFFFFF" fill-opacity="0.6"/>`;
}
function iconUser(cx, cy, size, color) {
  return `
    <circle cx="${cx}" cy="${cy - size * 0.18}" r="${size * 0.20}" fill="${color}"/>
    <path d="M ${cx - size * 0.36} ${cy + size * 0.36}
             Q ${cx} ${cy + size * 0.05} ${cx + size * 0.36} ${cy + size * 0.36}
             L ${cx + size * 0.36} ${cy + size * 0.46}
             Q ${cx} ${cy + size * 0.20} ${cx - size * 0.36} ${cy + size * 0.46} Z"
          fill="${color}"/>`;
}
function iconPencil(cx, cy, size, color) {
  const len = size * 0.9;
  return `
    <g transform="rotate(-35 ${cx} ${cy})">
      <rect x="${cx - len / 2}" y="${cy - size * 0.10}" width="${len * 0.78}" height="${size * 0.20}" fill="${color}"/>
      <polygon points="${cx + len / 2 - len * 0.22},${cy - size * 0.10} ${cx + len / 2},${cy} ${cx + len / 2 - len * 0.22},${cy + size * 0.10}" fill="${color}"/>
    </g>`;
}
function iconChevronRight(cx, cy, size, color) {
  return `<polyline points="${cx - size * 0.18},${cy - size * 0.30} ${cx + size * 0.18},${cy} ${cx - size * 0.18},${cy + size * 0.30}" fill="none" stroke="${color}" stroke-width="${size * 0.12}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function iconChevronLeft(cx, cy, size, color) {
  return `<polyline points="${cx + size * 0.18},${cy - size * 0.30} ${cx - size * 0.18},${cy} ${cx + size * 0.18},${cy + size * 0.30}" fill="none" stroke="${color}" stroke-width="${size * 0.12}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function iconCheck(cx, cy, size, color) {
  return `<polyline points="${cx - size * 0.30},${cy} ${cx - size * 0.05},${cy + size * 0.25} ${cx + size * 0.30},${cy - size * 0.25}" fill="none" stroke="${color}" stroke-width="${size * 0.16}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function tabBar(W, H, bottomSafe, active) {
  // Tabs match the real bottom navigation: Home, Careers, Colleges, Awards, Saved, Profile
  const labels = ["Home", "Careers", "Colleges", "Awards", "Saved", "Profile"];
  const iconFns = [iconHome, iconBriefcase, iconBook, iconStar, iconHeart, iconUser];
  const n = labels.length;
  const tabH = 200;
  const y = H - bottomSafe - tabH;
  const colW = W / n;
  let out = `<g>
    <rect x="0" y="${y}" width="${W}" height="${tabH + bottomSafe}" fill="${COL.bg}"/>
    <line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${COL.border}" stroke-width="2"/>`;
  for (let i = 0; i < n; i++) {
    const cx = colW * i + colW / 2;
    const isActive = labels[i].toLowerCase() === active.toLowerCase();
    const color = isActive ? COL.primary : COL.muted;
    out += iconFns[i](cx, y + 70, 64, color);
    out += `
      <text x="${cx}" y="${y + 150}" font-size="32" text-anchor="middle" fill="${color}" font-family="-apple-system, system-ui, Roboto" font-weight="${isActive ? 600 : 500}">${labels[i]}</text>`;
  }
  // Home indicator (only if there's safe-area room, i.e. iOS)
  if (bottomSafe > 40) {
    out += `<rect x="${W * 0.35}" y="${H - bottomSafe * 0.45}" width="${W * 0.3}" height="${bottomSafe * 0.10}" rx="${bottomSafe * 0.06}" fill="${COL.fg}"/>`;
  }
  out += `</g>`;
  return out;
}

function gradientDefs(id = "brand") {
  return `<defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COL.primary}"/>
      <stop offset="100%" stop-color="${COL.primaryEnd}"/>
    </linearGradient>
    <linearGradient id="${id}-soft" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${COL.primary}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${COL.primary}" stop-opacity="0.00"/>
    </linearGradient>
  </defs>`;
}

function pill(x, y, w, h, fill, stroke, text, textColor, fontSize = 28) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="2"` : ""}/>
    <text x="${x + w / 2}" y="${y + h / 2 + fontSize * 0.35}" font-size="${fontSize}" text-anchor="middle" fill="${textColor}" font-family="-apple-system, system-ui, Roboto" font-weight="600">${escape(text)}</text>`;
}

function card(x, y, w, h, radius = 28) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${COL.card}" stroke="${COL.border}" stroke-width="2"/>`;
}

// ---------- screen builders ----------
// Each builder returns SVG inner content given a layout {W,H,topSafe,bottomSafe}
// plus padding and a content area (W - 2*padX, H - topSafe - bottomSafe - tabBarH).

function header(W, x, y, title, subtitle) {
  let out = `<text x="${x}" y="${y + 70}" font-size="78" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui, Roboto">${escape(title)}</text>`;
  if (subtitle) {
    out += `<text x="${x}" y="${y + 130}" font-size="38" fill="${COL.muted}" font-family="-apple-system, system-ui, Roboto">${escape(subtitle)}</text>`;
  }
  return out;
}

function marketingHeadline(W, y, line1, line2) {
  return `
    <text x="${W / 2}" y="${y}" font-size="72" font-weight="800" fill="${COL.fg}" text-anchor="middle" font-family="-apple-system, system-ui, Roboto">${escape(line1)}</text>
    <text x="${W / 2}" y="${y + 88}" font-size="72" font-weight="800" fill="url(#brand)" text-anchor="middle" font-family="-apple-system, system-ui, Roboto">${escape(line2)}</text>`;
}

function buildHome({ W, H, topSafe, bottomSafe, tagline }) {
  const padX = 60;
  let y = topSafe + 30;
  let out = "";
  // Top header row: avatar, greeting, bell
  out += `<circle cx="${padX + 60}" cy="${y + 50}" r="60" fill="url(#brand)"/>`;
  out += `<text x="${padX + 60}" y="${y + 70}" text-anchor="middle" font-size="50" font-weight="700" fill="#fff" font-family="-apple-system, system-ui">A</text>`;
  out += `<text x="${padX + 150}" y="${y + 40}" font-size="34" fill="${COL.muted}" font-family="-apple-system, system-ui">Welcome back</text>`;
  out += `<text x="${padX + 150}" y="${y + 92}" font-size="50" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">Alex Rivera</text>`;
  out += `<circle cx="${W - padX - 60}" cy="${y + 60}" r="60" fill="${COL.mutedBg}"/>`;
  out += iconBell(W - padX - 60, y + 60, 56, COL.fg);
  y += 180;

  // Marketing headline
  out += marketingHeadline(W, y + 60, tagline[0], tagline[1]);
  y += 180;

  // Hero gradient card with CTA "Refresh recommendations"
  const heroH = 360;
  out += `<rect x="${padX}" y="${y}" width="${W - padX * 2}" height="${heroH}" rx="36" fill="url(#brand)"/>`;
  out += `<text x="${padX + 40}" y="${y + 90}" font-size="44" font-weight="700" fill="#fff" font-family="-apple-system, system-ui">Your AI study guide</text>`;
  out += `<text x="${padX + 40}" y="${y + 152}" font-size="32" fill="#F3E8FF" font-family="-apple-system, system-ui">Personalized to your goals,</text>`;
  out += `<text x="${padX + 40}" y="${y + 196}" font-size="32" fill="#F3E8FF" font-family="-apple-system, system-ui">refreshed from your resume.</text>`;
  out += pill(padX + 40, y + 240, 480, 92, "#FFFFFF", null, "Upload your resume", COL.primary, 34);
  // Decorative circles
  out += `<circle cx="${W - padX - 80}" cy="${y + 100}" r="120" fill="#FFFFFF" fill-opacity="0.10"/>`;
  out += `<circle cx="${W - padX - 40}" cy="${y + 240}" r="60" fill="#FFFFFF" fill-opacity="0.14"/>`;
  y += heroH + 60;

  // Section: Top career matches
  out += `<text x="${padX}" y="${y + 50}" font-size="44" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">Top career matches</text>`;
  out += `<text x="${W - padX - 100}" y="${y + 50}" font-size="32" fill="${COL.primary}" text-anchor="end" font-family="-apple-system, system-ui" font-weight="600">See all</text>`;
  y += 90;

  const cardData = [
    { title: "Software Engineer", sub: "$95K · High demand", tag: "Top match" },
    { title: "UX Designer", sub: "$78K · Growing", tag: "Strong fit" },
    { title: "Data Analyst", sub: "$72K · High demand", tag: "Strong fit" },
  ];
  for (const c of cardData) {
    out += card(padX, y, W - padX * 2, 200, 28);
    // icon tile
    out += `<rect x="${padX + 32}" y="${y + 36}" width="128" height="128" rx="28" fill="${COL.accent}"/>`;
    out += iconBriefcase(padX + 96, y + 100, 76, COL.primary);
    out += `<text x="${padX + 192}" y="${y + 80}" font-size="42" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">${escape(c.title)}</text>`;
    out += `<text x="${padX + 192}" y="${y + 130}" font-size="32" fill="${COL.muted}" font-family="-apple-system, system-ui">${escape(c.sub)}</text>`;
    // tag pill on right
    const isTop = c.tag === "Top match";
    const pw = 240;
    out += pill(W - padX - pw - 32, y + 60, pw, 72, isTop ? COL.accent : COL.greenBg, null, c.tag, isTop ? COL.accentFg : COL.green, 28);
    y += 230;
  }

  return out;
}

function buildCareers({ W, H, topSafe, bottomSafe, tagline }) {
  const padX = 60;
  let y = topSafe + 30;
  let out = "";
  out += header(W, padX, y, "Career Match", "AI-ranked from your skills");
  y += 200;

  out += marketingHeadline(W, y + 60, tagline[0], tagline[1]);
  y += 180;

  // Filter chips row
  const chips = ["Tech", "Design", "Healthcare", "Business"];
  let cx = padX;
  for (let i = 0; i < chips.length; i++) {
    const isActive = i === 0;
    const w = 30 + chips[i].length * 22;
    out += pill(cx, y, w, 72, isActive ? COL.primary : COL.bg, isActive ? null : COL.border, chips[i], isActive ? "#fff" : COL.fg, 30);
    cx += w + 24;
  }
  y += 110;

  // Cards
  const cards = [
    { title: "Software Engineer", sub: "$95K · BLS High demand", reasons: ["Matches Python & React skills", "Aligns with problem-solving"], tag: "Top match" },
    { title: "Product Designer", sub: "$88K · Growing 13%", reasons: ["Matches Figma + UX research", "Aligns with creative interest"], tag: "Top match" },
    { title: "Data Scientist", sub: "$112K · Very high demand", reasons: ["Matches statistics & ML coursework"], tag: "Strong fit" },
  ];
  for (const c of cards) {
    const cardH = 280;
    out += card(padX, y, W - padX * 2, cardH, 28);
    out += `<text x="${padX + 40}" y="${y + 70}" font-size="44" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">${escape(c.title)}</text>`;
    const isTop = c.tag === "Top match";
    const pw = isTop ? 240 : 240;
    out += pill(W - padX - pw - 32, y + 30, pw, 72, isTop ? COL.accent : COL.greenBg, null, c.tag, isTop ? COL.accentFg : COL.green, 28);
    out += `<text x="${padX + 40}" y="${y + 124}" font-size="32" fill="${COL.muted}" font-family="-apple-system, system-ui">${escape(c.sub)}</text>`;
    let ry = y + 170;
    for (const r of c.reasons) {
      out += `<text x="${padX + 40}" y="${ry + 6}" font-size="30" fill="${COL.primary}" font-family="system-ui">●</text>`;
      out += `<text x="${padX + 76}" y="${ry + 12}" font-size="30" fill="${COL.fg}" font-family="-apple-system, system-ui">${escape(r)}</text>`;
      ry += 48;
    }
    y += cardH + 36;
  }
  return out;
}

function buildScholarships({ W, H, topSafe, bottomSafe, tagline }) {
  const padX = 60;
  let y = topSafe + 30;
  let out = "";
  out += header(W, padX, y, "Scholarships", "Awards you actually qualify for");
  y += 200;

  out += marketingHeadline(W, y + 60, tagline[0], tagline[1]);
  y += 180;

  // Search box
  out += `<rect x="${padX}" y="${y}" width="${W - padX * 2}" height="100" rx="24" fill="${COL.mutedBg}" stroke="${COL.border}" stroke-width="2"/>`;
  out += iconSearch(padX + 50, y + 50, 50, COL.muted);
  out += `<text x="${padX + 110}" y="${y + 64}" font-size="34" fill="${COL.muted}" font-family="-apple-system, system-ui">Search scholarships</text>`;
  y += 130;

  // Filter chips
  const chips = ["STEM", "Need-based", "First-gen", "Renewable"];
  let cx = padX;
  for (let i = 0; i < chips.length; i++) {
    const isActive = i === 0 || i === 2;
    const w = 30 + chips[i].length * 22;
    out += pill(cx, y, w, 72, isActive ? COL.primary : COL.bg, isActive ? null : COL.border, chips[i], isActive ? "#fff" : COL.fg, 30);
    cx += w + 24;
  }
  y += 110;

  const cards = [
    { name: "Gates Millennium Scholarship", amt: "Full tuition", deadline: "Jan 15", reasons: ["First-gen college student", "STEM major"], tag: "Top match" },
    { name: "Coca-Cola Scholars", amt: "$20,000", deadline: "Oct 31", reasons: ["High school senior", "Leadership focus"], tag: "Top match" },
    { name: "Hispanic Scholarship Fund", amt: "$5,000", deadline: "Feb 15", reasons: ["Heritage match", "GPA 3.5+"], tag: "Strong fit" },
  ];
  for (const s of cards) {
    const ch = 260;
    out += card(padX, y, W - padX * 2, ch, 28);
    out += `<text x="${padX + 40}" y="${y + 70}" font-size="40" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">${escape(s.name)}</text>`;
    out += `<text x="${padX + 40}" y="${y + 124}" font-size="36" font-weight="700" fill="${COL.primary}" font-family="-apple-system, system-ui">${escape(s.amt)}</text>`;
    out += `<text x="${padX + 320}" y="${y + 124}" font-size="32" fill="${COL.muted}" font-family="-apple-system, system-ui">Deadline ${escape(s.deadline)}</text>`;
    const isTop = s.tag === "Top match";
    const pw = 240;
    out += pill(W - padX - pw - 32, y + 30, pw, 72, isTop ? COL.accent : COL.greenBg, null, s.tag, isTop ? COL.accentFg : COL.green, 28);
    let ry = y + 170;
    for (const r of s.reasons) {
      out += `<text x="${padX + 40}" y="${ry + 6}" font-size="30" fill="${COL.primary}" font-family="system-ui">●</text>`;
      out += `<text x="${padX + 76}" y="${ry + 12}" font-size="30" fill="${COL.fg}" font-family="-apple-system, system-ui">${escape(r)}</text>`;
      ry += 44;
    }
    y += ch + 28;
  }
  return out;
}

function buildScholarshipDetail({ W, H, topSafe, bottomSafe, tagline }) {
  const padX = 60;
  let y = topSafe + 30;
  let out = "";
  // Back row
  out += iconChevronLeft(padX + 24, y + 50, 48, COL.fg);
  out += `<text x="${padX + 70}" y="${y + 64}" font-size="36" font-weight="600" fill="${COL.fg}" font-family="-apple-system, system-ui">Scholarship</text>`;
  // Save heart top right
  out += `<circle cx="${W - padX - 50}" cy="${y + 50}" r="60" fill="${COL.accent}"/>`;
  out += iconHeart(W - padX - 50, y + 50, 56, COL.primary);
  y += 140;

  out += marketingHeadline(W, y + 60, tagline[0], tagline[1]);
  y += 180;

  // Hero card with title and amount
  out += `<rect x="${padX}" y="${y}" width="${W - padX * 2}" height="380" rx="36" fill="url(#brand)"/>`;
  out += `<text x="${padX + 40}" y="${y + 90}" font-size="46" font-weight="700" fill="#fff" font-family="-apple-system, system-ui">Gates Millennium</text>`;
  out += `<text x="${padX + 40}" y="${y + 144}" font-size="46" font-weight="700" fill="#fff" font-family="-apple-system, system-ui">Scholarship</text>`;
  out += `<text x="${padX + 40}" y="${y + 230}" font-size="76" font-weight="800" fill="#fff" font-family="-apple-system, system-ui">Full tuition</text>`;
  out += `<text x="${padX + 40}" y="${y + 280}" font-size="32" fill="#F3E8FF" font-family="-apple-system, system-ui">Renewable up to 4 years</text>`;
  out += pill(padX + 40, y + 304, 240, 64, "#FFFFFF", null, "Top match", COL.primary, 28);
  y += 420;

  // Stats row
  const stats = [
    { l: "Deadline", v: "Jan 15" },
    { l: "GPA", v: "3.3+" },
    { l: "Type", v: "Merit" },
  ];
  const sw = (W - padX * 2 - 40) / 3;
  for (let i = 0; i < stats.length; i++) {
    const sx = padX + i * (sw + 20);
    out += card(sx, y, sw, 160, 24);
    out += `<text x="${sx + sw / 2}" y="${y + 80}" text-anchor="middle" font-size="42" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">${escape(stats[i].v)}</text>`;
    out += `<text x="${sx + sw / 2}" y="${y + 130}" text-anchor="middle" font-size="28" fill="${COL.muted}" font-family="-apple-system, system-ui">${escape(stats[i].l)}</text>`;
  }
  y += 200;

  // Why this matches
  out += `<text x="${padX}" y="${y + 50}" font-size="42" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">Why this matches you</text>`;
  y += 100;
  const reasons = [
    "First-generation college student",
    "STEM major (Computer Science)",
    "GPA 3.7 — exceeds requirement",
    "Demonstrated leadership in clubs",
  ];
  for (const r of reasons) {
    out += `<rect x="${padX}" y="${y}" width="64" height="64" rx="16" fill="${COL.greenBg}"/>`;
    out += iconCheck(padX + 32, y + 32, 40, COL.green);
    out += `<text x="${padX + 90}" y="${y + 46}" font-size="34" fill="${COL.fg}" font-family="-apple-system, system-ui">${escape(r)}</text>`;
    y += 84;
  }

  y += 30;
  // CTA buttons
  out += pill(padX, y, W - padX * 2, 110, "url(#brand)", null, "Save to My Plan", "#fff", 38);
  return out;
}

function buildCollegeDetail({ W, H, topSafe, bottomSafe, tagline }) {
  const padX = 60;
  let y = topSafe + 30;
  let out = "";
  // Back
  out += iconChevronLeft(padX + 24, y + 50, 48, COL.fg);
  out += `<text x="${padX + 70}" y="${y + 64}" font-size="36" font-weight="600" fill="${COL.fg}" font-family="-apple-system, system-ui">College</text>`;
  out += `<circle cx="${W - padX - 50}" cy="${y + 50}" r="60" fill="${COL.accent}"/>`;
  out += iconHeart(W - padX - 50, y + 50, 56, COL.primary);
  y += 140;

  out += marketingHeadline(W, y + 60, tagline[0], tagline[1]);
  y += 180;

  // Hero card
  out += `<rect x="${padX}" y="${y}" width="${W - padX * 2}" height="320" rx="36" fill="url(#brand)"/>`;
  out += `<rect x="${padX + 40}" y="${y + 40}" width="120" height="120" rx="28" fill="#FFFFFF"/>`;
  out += iconCap(padX + 100, y + 100, 86, COL.primary);
  out += `<text x="${padX + 200}" y="${y + 96}" font-size="46" font-weight="700" fill="#fff" font-family="-apple-system, system-ui">Stanford University</text>`;
  out += `<text x="${padX + 200}" y="${y + 144}" font-size="32" fill="#F3E8FF" font-family="-apple-system, system-ui">Stanford, California</text>`;
  // Rating row (5 stars drawn as polygons)
  for (let i = 0; i < 5; i++) {
    out += iconStar(padX + 60 + i * 70, y + 230, 64, "#FFFFFF");
  }
  out += `<text x="${padX + 420}" y="${y + 244}" font-size="32" fill="#F3E8FF" font-family="-apple-system, system-ui">4.9 · 12,400 reviews</text>`;
  out += pill(padX + 40, y + 270, 240, 64, "#FFFFFF", null, "Strong fit", COL.primary, 28);
  y += 360;

  // Stats grid 2x2
  const stats = [
    { l: "Acceptance", v: "4%" },
    { l: "Avg SAT", v: "1505" },
    { l: "Tuition / yr", v: "$56K" },
    { l: "Enrollment", v: "17,400" },
  ];
  const sw = (W - padX * 2 - 30) / 2;
  for (let i = 0; i < stats.length; i++) {
    const sx = padX + (i % 2) * (sw + 30);
    const sy = y + Math.floor(i / 2) * 180;
    out += card(sx, sy, sw, 160, 24);
    out += `<text x="${sx + 40}" y="${sy + 70}" font-size="48" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">${escape(stats[i].v)}</text>`;
    out += `<text x="${sx + 40}" y="${sy + 124}" font-size="30" fill="${COL.muted}" font-family="-apple-system, system-ui">${escape(stats[i].l)}</text>`;
  }
  y += 360;

  // Programs
  out += `<text x="${padX}" y="${y + 50}" font-size="42" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">Top programs</text>`;
  y += 90;
  const programs = ["Computer Science", "Engineering", "Economics", "Biology"];
  let cx = padX;
  let lineY = y;
  for (const p of programs) {
    const w = 30 + p.length * 22;
    if (cx + w > W - padX) {
      cx = padX;
      lineY += 90;
    }
    out += pill(cx, lineY, w, 72, COL.accent, null, p, COL.accentFg, 30);
    cx += w + 24;
  }
  return out;
}

function buildSaved({ W, H, topSafe, bottomSafe, tagline }) {
  const padX = 60;
  let y = topSafe + 30;
  let out = "";
  out += header(W, padX, y, "My Plan", "Everything you've saved");
  y += 200;

  out += marketingHeadline(W, y + 60, tagline[0], tagline[1]);
  y += 180;

  // Tabs
  const tabs = ["Careers (3)", "Colleges (2)", "Awards (4)"];
  let cx = padX;
  for (let i = 0; i < tabs.length; i++) {
    const isActive = i === 0;
    const w = 40 + tabs[i].length * 20;
    out += pill(cx, y, w, 80, isActive ? COL.primary : COL.bg, isActive ? null : COL.border, tabs[i], isActive ? "#fff" : COL.fg, 30);
    cx += w + 16;
  }
  y += 120;

  // Saved careers
  const items = [
    { title: "Software Engineer", sub: "$95K · Top match", note: "Apply summer internships" },
    { title: "Product Designer", sub: "$88K · Strong fit", note: "Build portfolio site" },
    { title: "Data Scientist", sub: "$112K · Top match", note: "Take Stats II next term" },
  ];
  for (const it of items) {
    const ch = 240;
    out += card(padX, y, W - padX * 2, ch, 28);
    out += `<rect x="${padX + 32}" y="${y + 32}" width="120" height="120" rx="28" fill="${COL.accent}"/>`;
    out += iconBriefcase(padX + 92, y + 92, 70, COL.primary);
    out += `<text x="${padX + 180}" y="${y + 80}" font-size="40" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">${escape(it.title)}</text>`;
    out += `<text x="${padX + 180}" y="${y + 130}" font-size="30" fill="${COL.muted}" font-family="-apple-system, system-ui">${escape(it.sub)}</text>`;
    // Note row
    out += `<rect x="${padX + 180}" y="${y + 156}" width="${W - padX * 2 - 220}" height="60" rx="14" fill="${COL.mutedBg}"/>`;
    out += iconPencil(padX + 210, y + 186, 28, COL.muted);
    out += `<text x="${padX + 240}" y="${y + 196}" font-size="28" fill="${COL.fg}" font-family="-apple-system, system-ui" font-style="italic">${escape(it.note)}</text>`;
    y += ch + 30;
  }
  return out;
}

function buildProfile({ W, H, topSafe, bottomSafe, tagline }) {
  const padX = 60;
  let y = topSafe + 30;
  let out = "";
  out += header(W, padX, y, "Profile", "Your goals & resume");
  y += 200;

  out += marketingHeadline(W, y + 60, tagline[0], tagline[1]);
  y += 200;

  // Avatar + name
  out += `<circle cx="${W / 2}" cy="${y + 110}" r="120" fill="url(#brand)"/>`;
  out += `<text x="${W / 2}" y="${y + 142}" text-anchor="middle" font-size="100" font-weight="800" fill="#fff" font-family="-apple-system, system-ui">A</text>`;
  out += `<text x="${W / 2}" y="${y + 290}" text-anchor="middle" font-size="50" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">Alex Rivera</text>`;
  out += `<text x="${W / 2}" y="${y + 340}" text-anchor="middle" font-size="32" fill="${COL.muted}" font-family="-apple-system, system-ui">Computer Science · Junior</text>`;
  y += 400;

  // Resume upload card
  out += `<rect x="${padX}" y="${y}" width="${W - padX * 2}" height="240" rx="32" fill="url(#brand-soft)" stroke="${COL.primary}" stroke-width="3" stroke-dasharray="14 10"/>`;
  out += `<rect x="${W / 2 - 60}" y="${y + 40}" width="120" height="120" rx="28" fill="${COL.accent}"/>`;
  out += iconUpload(W / 2, y + 100, 80, COL.primary);
  out += `<text x="${W / 2}" y="${y + 200}" text-anchor="middle" font-size="36" font-weight="700" fill="${COL.fg}" font-family="-apple-system, system-ui">Upload your resume</text>`;
  y += 280;

  // List rows
  const rows = [
    { l: "Interests", v: "AI, Design, Music" },
    { l: "Skills", v: "Python, Figma, Stats" },
    { l: "Location", v: "California" },
    { l: "Notifications", v: "On" },
  ];
  for (const r of rows) {
    const rh = 130;
    out += card(padX, y, W - padX * 2, rh, 24);
    out += `<text x="${padX + 40}" y="${y + 60}" font-size="32" fill="${COL.muted}" font-family="-apple-system, system-ui">${escape(r.l)}</text>`;
    out += `<text x="${padX + 40}" y="${y + 108}" font-size="38" font-weight="600" fill="${COL.fg}" font-family="-apple-system, system-ui">${escape(r.v)}</text>`;
    out += iconChevronRight(W - padX - 50, y + rh / 2, 36, COL.muted);
    y += rh + 20;
  }
  return out;
}

// ---------- screen registry ----------
// The route order, slugs, and active-tab labels live in routes.json — the
// single source of truth shared with capture-simulator.mjs, verify-screens.mjs,
// and the open-pr job in .github/workflows/store-screenshots.yml. Builders
// stay here because they reference local SVG helpers; we look each one up by
// slug so a route added in routes.json without a matching builder fails fast.
//
// Taglines live in `brand.mjs` (SCREEN_TAGLINES) so the phone screenshots and
// the Play Store feature graphic stay in sync when marketing copy changes.
const BUILDERS = {
  "01-home": buildHome,
  "02-career-match": buildCareers,
  "03-scholarships": buildScholarships,
  "04-scholarship-detail": buildScholarshipDetail,
  "05-college-detail": buildCollegeDetail,
  "06-my-plan": buildSaved,
  "07-profile": buildProfile,
};
const SCREENS = JSON.parse(
  readFileSync(join(__dirname, "routes.json"), "utf8"),
).map((r) => {
  const build = BUILDERS[r.slug];
  if (!build) {
    throw new Error(
      `No builder for "${r.slug}" — add it to BUILDERS in generate.mjs.`,
    );
  }
  return { name: r.slug, build, active: r.active };
});

// ---------- render pipeline ----------
function renderScreenSVG({ W, H, topSafe, bottomSafe, build, active, tagline }) {
  const inner = build({ W, H, topSafe, bottomSafe, tagline });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${gradientDefs("brand")}
  <rect width="${W}" height="${H}" fill="${COL.bg}"/>
  ${statusBar(W, topSafe)}
  ${inner}
  ${tabBar(W, H, bottomSafe, active)}
</svg>`;
}

function svgToPng(svgPath, pngPath, W, H) {
  // Use ImageMagick to convert SVG -> PNG at exact pixel dims
  execFileSync("magick", [
    "-background", "white",
    "-density", "300",
    svgPath,
    "-resize", `${W}x${H}!`,
    "-strip",
    pngPath,
  ], { stdio: ["ignore", "ignore", "inherit"] });
}

function renderAll() {
  const tmp = mkdtempSync(join(tmpdir(), "edunav-store-"));

  const targets = [
    { dir: OUT_IOS, label: "iOS", W: 1290, H: 2796, topSafe: 130, bottomSafe: 160 },
    { dir: OUT_ANDROID, label: "Android", W: 1080, H: 1920, topSafe: 80, bottomSafe: 0 },
  ];

  for (const t of targets) {
    for (const s of SCREENS) {
      const tagline = SCREEN_TAGLINES[s.name];
      if (!tagline) {
        throw new Error(`Missing SCREEN_TAGLINES entry for "${s.name}" in brand.mjs`);
      }
      const svg = renderScreenSVG({
        W: t.W,
        H: t.H,
        topSafe: t.topSafe,
        bottomSafe: t.bottomSafe,
        build: s.build,
        active: s.active,
        tagline,
      });
      const svgPath = join(tmp, `${t.label}-${s.name}.svg`);
      const pngPath = join(t.dir, `${s.name}.png`);
      writeFileSync(svgPath, svg);
      svgToPng(svgPath, pngPath, t.W, t.H);
      console.log(`  ${t.label}: ${pngPath}`);
    }
  }

  // ----- Non-screenshot Play Store assets (feature graphic + 512×512 icon) -----
  // Delegated to generate-play-extras.mjs so the Store-screenshots workflow
  // can refresh those two assets independently of the simulator captures.
  console.log(`  Android: ${generateFeatureGraphic({ outDir: OUT_ANDROID, tmpDir: tmp })}`);
  console.log(`  Android: ${generateIcon512({ outDir: OUT_ANDROID })}`);

  console.log("\nAll store assets generated.");
}

renderAll();
