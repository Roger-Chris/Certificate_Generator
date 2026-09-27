import { BRAND_ASSETS } from "./brand";
import { DEFAULT_EMAIL, type Design, type DesignElement, type ImageElement, type ShapeElement, type TextElement } from "./design";

/**
 * Editable HTML recreations of the original Canva certificates. Positions come from the original
 * 2000×1414 (Designathon: 1920×1080) exports; backgrounds are those exports with all text removed.
 */

let seq = 0;
const id = () => `s${(++seq).toString(36)}`;

const image = (src: string, x: number, y: number, w: number, h: number, name?: string): ImageElement => ({
  type: "image", id: id(), name, src, x, y, w, h, fit: "contain",
});

const logo = (file: string, x: number, y: number, scale = 1): ImageElement => {
  const a = BRAND_ASSETS.find((b) => b.src.endsWith(`/${file}.png`));
  if (!a) throw new Error(`Unknown brand asset ${file}`);
  return image(a.src, x, y, Math.round(a.w * scale), Math.round(a.h * scale), a.name);
};

const text = (html: string, x: number, y: number, w: number, h: number, style: Partial<TextElement> = {}, name?: string): TextElement => ({
  type: "text", id: id(), name, html, x, y, w, h,
  fontFamily: "Lora", fontSize: 40, fontWeight: 400, color: "#1a1a1a", align: "center", valign: "top", lineHeight: 1.3, autoFit: true,
  ...style,
});

const rule = (x: number, y: number, w: number, h: number, fill: string): ShapeElement => ({
  type: "shape", id: id(), name: "Line", shape: "rect", x, y, w, h, fill,
});

/** A fill-in field: bold, with a coloured underline like the blank lines on the Canva originals. */
const field = (name: string, line = "#c8912e") =>
  `<span style="font-weight: 700; text-decoration-line: underline; text-decoration-color: ${line}; text-decoration-thickness: 2px; text-underline-offset: 8px">{${name}}</span>`;

const signatureBlock = (
  sig: string, sigScale: number, cx: number, top: number,
  name: string, role: string,
  o: { lineW: number; lineColor: string; font: string; nameColor: string; roleColor: string; nameSize: number; roleSize: number; roleItalic?: boolean; gap?: number },
): DesignElement[] => {
  const a = BRAND_ASSETS.find((b) => b.src.endsWith(`/${sig}.png`))!;
  const w = Math.round(a.w * sigScale);
  const h = Math.round(a.h * sigScale);
  const lineY = top + h + (o.gap ?? 2);
  return [
    image(a.src, Math.round(cx - w / 2), top, w, h, a.name),
    rule(Math.round(cx - o.lineW / 2), lineY, o.lineW, 3, o.lineColor),
    text(name, cx - 300, lineY + 12, 600, o.nameSize * 1.3, { fontFamily: o.font, fontSize: o.nameSize, fontWeight: 700, color: o.nameColor }, "Signatory name"),
    text(role, cx - 300, lineY + 12 + o.nameSize * 1.3, 600, o.roleSize * 1.3, { fontFamily: o.font, fontSize: o.roleSize, color: o.roleColor, italic: o.roleItalic }, "Signatory role"),
  ];
};

const design = (name: string, event: string, bg: string, width: number, height: number, elements: DesignElement[]): Design => ({
  id: "", name, event, width, height, background: "#ffffff", backgroundImage: `/assets/backgrounds/${bg}.jpg`, elements,
  fields: {}, email: { ...DEFAULT_EMAIL },
});

// ------------------------------------------------------------------ World IP Day

function ipDay(): Design {
  const navy = "#1f2f5c";
  const gold = "#c8912e";
  return design("World IP Day — Intellectual Award", "World IP Day 2026", "ip-day", 2000, 1414, [
    logo("rit-logo", 503, 75), logo("nba", 957, 75), logo("naac", 1135, 70), logo("iic", 1325, 72),
    text("WORLD IP DAY", 450, 196, 1100, 84, { fontFamily: "Russo One", fontSize: 66, color: navy, letterSpacing: 3 }, "Heading"),
    text("RIT INTELLECTUAL AWARD 2026", 250, 288, 1500, 64, { fontFamily: "Space Mono", fontSize: 46, fontWeight: 700, color: navy, letterSpacing: 14 }, "Sub-heading"),
    logo("gold-medal", 599, 378),
    text("CERTIFICATE", 728, 385, 640, 104, { fontFamily: "Playfair Display", fontSize: 88, fontWeight: 800, color: navy }, "Title"),
    text("OF APPRECIATION", 728, 474, 640, 62, { fontFamily: "Playfair Display", fontSize: 44, fontWeight: 700, color: gold }, "Subtitle"),
    text(
      `This is to certify that <b>Dr./Mr./Ms.</b> ${field("Name")} from ${field("Department")} is recognized for the achievement of Copyright Registration / Patent Publication<br>` +
        `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Title:</b> ${field("Title")}<br>` +
        `during the academic year <b>2025-2026</b>. In appreciation of the valuable contribution towards IP development, <b>Rajalakshmi Institute of Technology</b> proudly presents this award.`,
      168, 578, 1680, 310, { fontSize: 40, align: "left", lineHeight: 1.52, autoFit: true }, "Body",
    ),
    text(`<b>Date:</b> <span style="text-decoration-line: underline; text-decoration-color: ${gold}; text-underline-offset: 8px">29.04.2026</span>`, 255, 892, 420, 58, { fontSize: 38, align: "left" }, "Date"),
    text(`<b>Place:</b> <span style="text-decoration-line: underline; text-decoration-color: ${gold}; text-underline-offset: 8px">Chennai</span>`, 1420, 892, 380, 58, { fontSize: 38, align: "left" }, "Place"),
    ...signatureBlock("signature-maheswari", 1, 1000, 1058, "Dr. R. Maheswari", "Principal", {
      lineW: 425, lineColor: "#111111", font: "Lora", nameColor: "#1a1a1a", roleColor: "#1a1a1a", nameSize: 36, roleSize: 30,
    }),
  ]);
}

// ------------------------------------------------------------------ Freshathon 2.0 (blue)

function freshBlue(kind: "winner" | "participation" | "volunteer"): Design {
  const blue = "#0d4f96";
  const dates = "<b>11<sup>th</sup> May 2026 &amp; 12<sup>th</sup> May 2026</b>";
  const domain = "<b>(Institution Management System / Sustainable Development Goals)</b>";
  const body = {
    winner: `This is to certify that <b>Mr./Ms.</b> ${field("Name", blue)} from ${field("Department", blue)} department has secured ${field("Position", blue)} place in <b>Freshathon 2.0</b>, under the domain ${domain}, held on ${dates} at <b>Rajalakshmi Institute of Technology, Chennai.</b>`,
    participation: `This is to certify that <b>Mr./Ms.</b> ${field("Name", blue)} from ${field("Department", blue)} department has participated in <b>Freshathon 2.0</b>, under the domain ${domain}, held on ${dates} at <b>Rajalakshmi Institute of Technology, Chennai.</b>`,
    volunteer: `This is presented to <b>Mr./Ms.</b> ${field("Name", blue)} from ${field("Department", blue)} department in recognition of their valuable service and active contribution as a <b>Volunteer</b> in <b>Freshathon 2.0</b>, held on ${dates} at <b>Rajalakshmi Institute of Technology, Chennai.</b>`,
  }[kind];
  const label = { winner: "Winner", participation: "Participation", volunteer: "Volunteer" }[kind];
  return design(`Freshathon 2.0 — ${label} (blue)`, "Freshathon 2.0", "freshathon-blue", 2000, 1414, [
    logo("rit-logo", 418, 165), logo("nba", 873, 165), logo("naac", 1050, 160), logo("iic", 1240, 163), logo("sdg-wheel", 1495, 160),
    logo("freshathon-2-title", 791, 341),
    text("CERTIFICATE", 450, 450, 1100, 125, { fontFamily: "Playfair Display", fontSize: 112, fontWeight: 800, color: blue }, "Title"),
    text(kind === "participation" ? "OF PARTICIPATION" : "OF APPRECIATION", 500, 566, 1000, 70, {
      fontFamily: "Playfair Display", fontSize: 56, fontWeight: 700, color: "#c8871d", gradient: ["#b87a17", "#f2c552"],
    }, "Subtitle"),
    text(body, 197, 662, 1605, 250, { fontSize: 40, color: blue, align: "justify", lineHeight: 1.45, autoFit: true }, "Body"),
    ...signatureBlock("signature-maheswari", 1, 1000, 1003, "Dr. R. Maheswari", "Principal", {
      lineW: 430, lineColor: blue, font: "Lora", nameColor: "#a08660", roleColor: blue, nameSize: 42, roleSize: 38,
    }),
  ]);
}

// ------------------------------------------------------------------ Freshathon 2.0 (gold)

function freshGold(watermark: boolean): Design {
  const brown = "#9b6414";
  const ink = "#10213f";
  const els: DesignElement[] = [];
  if (watermark) els.push({ ...logo("sdg-wheel", 780, 520), w: 440, h: 444, opacity: 0.4, name: "SDG watermark" });
  els.push(
    logo("rit-logo", 409, 222), logo("nba", 864, 221), logo("naac", 1043, 217), logo("iic", 1232, 219),
    ...(watermark ? [] : [logo("sdg-wheel", 1482, 212)]),
    logo("ribbon-seal", 1614, 231),
    text("CERTIFICATE", 520, 330, 960, 130, { fontFamily: "DM Serif Display", fontSize: 124, color: brown }, "Title"),
    text("OF APPRECIATION", 560, 448, 880, 76, { fontFamily: "Cormorant Garamond", fontSize: 66, fontWeight: 600, color: brown, letterSpacing: 2 }, "Subtitle"),
    text(
      `This is to certify that Mr./Ms. ${field("Name")} from ${field("Department")} has secured ${field("Position")} in <b>Freshathon 2.0,</b> under the domain (<b>Institution Management System / Sustainable Development Goals</b>), held on <b>11<sup>th</sup> May 2026 &amp; 12<sup>th</sup> May 2026</b> at <b>Rajalakshmi Institute of Technology</b>, Chennai.`,
      205, 640, 1590, 260, { fontSize: 40, color: ink, align: "justify", lineHeight: 1.6, autoFit: true }, "Body",
    ),
    ...signatureBlock("signature-maheswari", 1, 1000, 1003, "Dr. R. Maheswari", "Principal", {
      lineW: 262, lineColor: "#c8962e", font: "Lora", nameColor: brown, roleColor: ink, nameSize: 36, roleSize: 30, roleItalic: true,
    }),
  );
  return design(`Freshathon 2.0 — Winner (gold${watermark ? ", SDG watermark" : ""})`, "Freshathon 2.0", "freshathon-gold", 2000, 1414, els);
}

// ------------------------------------------------------------------ Designathon 1.0 (1920×1080)

function designathon(kind: "winner" | "participation" | "volunteer"): Design {
  const blue = "#0d4f96";
  const dates = "<b>27<sup>th</sup> April 2026 &amp; 28<sup>th</sup> April 2026</b>";
  const tail = "<b>Rajalakshmi Institute of Technology, Chennai in association with Swadeshi Shodh Sansthan TN Chapter</b>.";
  const domain = "<b>(Institution Management System / Sustainable Development Goals)</b>";
  const body = {
    winner: `This is to certify that <b>Mr./Ms.</b> ${field("Name", blue)} from ${field("Department", blue)} has secured ${field("Position", blue)} in <b>Designathon 1.0</b>, under the domain ${domain}, held on ${dates} at ${tail}`,
    participation: `This is to certify that <b>Mr./Ms.</b> ${field("Name", blue)} from ${field("Department", blue)} has participated in <b>Designathon 1.0</b>, under the domain ${domain}, held on ${dates} at ${tail}`,
    volunteer: `This is presented to <b>Mr./Ms.</b> ${field("Name", blue)} from ${field("Department", blue)} in recognition of their valuable service and active contribution as a <b>Volunteer</b> in Designathon 1.0, held on ${dates} at ${tail}`,
  }[kind];
  const label = { winner: "Winner", participation: "Participation", volunteer: "Volunteer" }[kind];
  return design(`Designathon 1.0 — ${label}`, "Designathon 1.0", "designathon", 1920, 1080, [
    logo("rit-logo", 515, 127, 0.76), logo("nba", 862, 127, 0.76), logo("naac", 998, 124, 0.76), logo("iic", 1143, 125, 0.76),
    logo("swadeshi-shodh-sansthan", 1325, 111, 0.91),
    text(`<span style="color: #0d4f96">DESIGN</span><span style="color: #f07f23">ATHON</span> <span style="color: #1c2a4a">1.0</span>`, 560, 212, 800, 66, {
      fontFamily: "Poppins", fontSize: 50, fontWeight: 700,
    }, "Event name"),
    text("DESIGN. INNOVATE. CREATE.", 660, 272, 600, 32, { fontFamily: "Montserrat", fontSize: 20, fontWeight: 700, color: "#111111", letterSpacing: 1 }, "Tagline"),
    text("CERTIFICATE", 510, 335, 900, 100, { fontFamily: "Playfair Display", fontSize: 90, fontWeight: 800, color: blue }, "Title"),
    text(kind === "participation" ? "OF PARTICIPATION" : "OF APPRECIATION", 560, 428, 800, 58, {
      fontFamily: "Playfair Display", fontSize: 44, fontWeight: 700, color: "#c8871d", gradient: ["#b87a17", "#f2c552"],
    }, "Subtitle"),
    text(body, 345, 505, 1230, 230, { fontSize: 31, color: blue, align: "justify", lineHeight: 1.45, autoFit: true }, "Body"),
    ...signatureBlock("signature-maheswari", 0.76, 960, 768, "Dr. R. Maheswari", "Principal", {
      lineW: 330, lineColor: blue, font: "Lora", nameColor: "#a08660", roleColor: blue, nameSize: 32, roleSize: 30,
    }),
  ]);
}

// ------------------------------------------------------------------ Gameathon 2026

function gameathon(contest: "Chess Tournament" | "Hackathon"): Design {
  const ink = "#1b1b1b";
  const indigo = "#2e2f7f";
  const sig = { lineW: 302, lineColor: "#111111", font: "Hanken Grotesk", nameColor: ink, roleColor: ink, nameSize: 30, roleSize: 26 };
  return design(`Gameathon 2026 — ${contest}`, "Gameathon 2026", "gameathon", 2000, 1414, [
    logo("rit-logo", 262, 122, 1.23), logo("gameathon-logo", 820, 98), logo("revolution-games", 1389, 106),
    text("In Association with", 750, 262, 500, 45, { fontFamily: "Hanken Grotesk", fontSize: 28, fontWeight: 700, italic: true, color: "#111111" }),
    logo("8queens", 606, 326), logo("inspire", 898, 326), logo("distinct", 1191, 320),
    text("CERTIFICATE", 400, 455, 1200, 110, { fontFamily: "Playfair Display", fontSize: 96, fontWeight: 700, color: indigo, letterSpacing: 22 }, "Title"),
    text("OF PARTICIPATION", 400, 560, 1200, 78, { fontFamily: "Playfair Display", fontSize: 60, fontWeight: 700, color: indigo, letterSpacing: 14 }, "Subtitle"),
    text(
      `This is to certify that <b>Mr./Ms.</b> ${field("Name", indigo)} from ${field("Department", indigo)} has participated in the <b>${contest}</b> conducted as a part of <b>GAMEATHON 2026</b> – A National-Level Algorithm-Based Game Development Challenge, organised by the <b>Department of Computer Science &amp; Business Systems</b>, conducted on <b>April 9 &amp; 10, 2026</b>, and hosted by <b>Rajalakshmi Institute of Technology, Chennai.</b>`,
      86, 705, 1830, 310, { fontFamily: "Hanken Grotesk", fontSize: 40, color: ink, align: "justify", lineHeight: 1.48, autoFit: true }, "Body",
    ),
    ...signatureBlock("signature-sathiya", 1, 560, 1132, "Mrs. B. Sathiya", "Co-ordinator", sig),
    ...signatureBlock("signature-vidhushavarshini", 1, 1000, 1137, "Dr. S. Vidhushavarshini", "Head of Department CSBS", sig),
    ...signatureBlock("signature-maheswari", 0.9, 1443, 1120, "Dr. R. Maheswari", "Principal", sig),
  ]);
}

// ------------------------------------------------------------------ FUTUREPRENEUR 2025-26

function futurepreneur(kind: "winner" | "participation", day: "19-20" | "21"): Design {
  const ink = "#111111";
  const gold: [string, string] = ["#b07d12", "#f3cf6a"];
  const when =
    day === "19-20"
      ? "<b>19<sup>th</sup> &amp; 20<sup>th</sup> November 2025, Andaman and Nicobar Islands.</b>"
      : "<b>21<sup>st</sup> November 2025, Andaman and Nicobar.</b>";
  const org = `organized by <b>Rajalakshmi Institute of Technology, Chennai.</b> in association with <b>EDII (Entrepreneurship Development and Innovation Institute) Thiruvallur, Tamil Nadu &amp; SSS TN Chapter</b> held on ${when}`;
  const body =
    kind === "winner"
      ? `This is to certify that <b>Mr./Ms.</b> ${field("Name", ink)} from ${field("Department", ink)} has secured the ${field("Position", ink)} position in <b>FUTUREPRENEUR 2025-26 Port Blair</b>, ${org} We recognize your outstanding participation, dedication, and entrepreneurial spirit.`
      : `This is to certify that <b>Mr./Ms.</b> ${field("Name", ink)} from ${field("Department", ink)} has participated in the <b>FUTUREPRENEUR 2025-26 Port Blair,</b> ${org} Your enthusiasm, dedication, and commitment to showcasing innovative ideas are appreciated.`;
  const sig = { lineW: 323, lineColor: ink, font: "Roboto", nameColor: ink, roleColor: ink, nameSize: 30, roleSize: 26 };
  return design(
    `FUTUREPRENEUR — ${kind === "winner" ? "Winner" : "Participation"} (${day === "19-20" ? "19 & 20 Nov" : "21 Nov"})`,
    "FUTUREPRENEUR 2025-26", "futurepreneur", 2000, 1414,
    [
      logo("rit-logo-tagline", 227, 115), logo("tn-emblem", 659, 111), logo("edii-tn", 850, 97),
      logo("nba", 1090, 115, 1.24), logo("naac", 1315, 110, 1.25), logo("iic", 1550, 115, 1.26),
      text("CERTIFICATE", 450, 258, 1100, 105, { fontFamily: "Cinzel", fontSize: 92, fontWeight: 700, color: gold[0], gradient: gold, letterSpacing: 20 }, "Title"),
      text(kind === "winner" ? "OF APPRECIATION" : "OF PARTICIPATION", 500, 356, 1000, 64, { fontFamily: "Playfair Display", fontSize: 52, fontWeight: 700, color: gold[0], gradient: gold }, "Subtitle"),
      text("FUTUREPRENEUR 2025-26", 450, 436, 1100, 76, { fontFamily: "Montserrat", fontSize: 62, fontWeight: 600, color: ink }, "Event name"),
      text(body, 162, 548, 1676, 400, { fontFamily: "Montserrat", fontSize: 32, color: ink, align: "justify", lineHeight: 2.05, letterSpacing: 1.5, autoFit: true }, "Body"),
      ...signatureBlock("signature-manimaran", 1, 450, 1051, "Dr. B. Manimaran", "Co-ordinator", sig),
      ...signatureBlock("signature-shanmuga", 1, 1000, 1107, "Mr. U. Shanmuga Mariappan", "EDII District Program Manager Thiruvallur", sig),
      ...signatureBlock("signature-maheswari", 0.95, 1545, 1060, "Dr. R. Maheswari", "Principal", sig),
    ],
  );
}

// ------------------------------------------------------------------ National Foundation Day of Japan

function japan(): Design {
  const ink = "#222222";
  return design("National Foundation Day of Japan — Winner", "National Foundation Day of Japan", "japan", 2000, 1414, [
    logo("rit-logo", 718, 88, 1.48),
    text("RAJALAKSHMI INSTITUTE OF TECHNOLOGY", 300, 280, 1400, 72, { fontFamily: "Audiowide", fontSize: 54, color: "#111111" }, "Heading"),
    text("NATIONAL FOUNDATION DAY OF JAPAN", 150, 436, 1700, 96, { fontFamily: "Audiowide", fontSize: 74, color: "#2b2b2b" }, "Title"),
    text(
      `This is to certify that <b>Mr./Ms.</b> ${field("Name", ink)} from ${field("Department", ink)} has secured ${field("Position", ink)} position in the event ${field("Event", ink)}, conducted as part of the <b>National Foundation Day of Japan</b> organized by <b>Rajalakshmi Institute of Technology</b> on <b>11<sup>th</sup> February 2026.</b>`,
      94, 600, 1812, 290, { fontFamily: "Montserrat", fontSize: 34, color: ink, align: "justify", lineHeight: 2.1, letterSpacing: 1.5, autoFit: true }, "Body",
    ),
    ...signatureBlock("signature-maheswari", 1, 1000, 988, "Dr. R. Maheswari", "Principal", {
      lineW: 350, lineColor: "#111111", font: "Roboto", nameColor: "#111111", roleColor: "#111111", nameSize: 32, roleSize: 26,
    }),
  ]);
}

export const STARTERS: Design[] = [
  ipDay(),
  freshBlue("winner"), freshBlue("participation"), freshBlue("volunteer"),
  freshGold(false), freshGold(true),
  designathon("winner"), designathon("participation"), designathon("volunteer"),
  gameathon("Chess Tournament"), gameathon("Hackathon"),
  futurepreneur("winner", "19-20"), futurepreneur("participation", "19-20"),
  futurepreneur("winner", "21"), futurepreneur("participation", "21"),
  japan(),
];

/** A blank A4 design with RIT basics, for "New design". */
export function blankDesign(width = 2000, height = 1414): Design {
  return {
    id: "", name: "Untitled certificate", event: "", width, height, background: "#ffffff", backgroundImage: null, fields: {}, email: { ...DEFAULT_EMAIL },
    elements: [
      logo("rit-logo", Math.round(width / 2 - 191), 90),
      text("CERTIFICATE", width / 2 - 600, 280, 1200, 130, { fontFamily: "Playfair Display", fontSize: 110, fontWeight: 800, color: "#1f2f5c" }, "Title"),
      text("OF APPRECIATION", width / 2 - 500, 410, 1000, 70, { fontFamily: "Playfair Display", fontSize: 50, fontWeight: 700, color: "#c8912e" }, "Subtitle"),
      text(
        `This is to certify that <b>Dr./Mr./Ms.</b> ${field("Name")} from ${field("Department")} has successfully participated in the programme organised by <b>Rajalakshmi Institute of Technology, Chennai</b>.`,
        200, 560, width - 400, 260, { fontSize: 42, align: "center", lineHeight: 1.6, autoFit: true }, "Body",
      ),
      ...signatureBlock("signature-maheswari", 1, width / 2, height - 400, "Dr. R. Maheswari", "Principal", {
        lineW: 420, lineColor: "#111111", font: "Lora", nameColor: "#1a1a1a", roleColor: "#1a1a1a", nameSize: 36, roleSize: 30,
      }),
    ],
  };
}
