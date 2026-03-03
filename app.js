/* QR Generator - Static Web App (GitHub Pages)
 * - qr-code-styling
 * - Logo
 * - Text Overlay (1/2 lines) composited in canvas for preview + PNG download + Copy PNG
 * - SVG download with overlay: measures text width accurately via Canvas after fonts are ready
 */

const $ = (id) => document.getElementById(id);

const els = {
  inputData: $("inputData"),
  mode: $("mode"),
  noteWrap: $("noteWrap"),
  note: $("note"),
  caption: $("caption"),

  dotStyle: $("dotStyle"),
  ecc: $("ecc"),
  colorDots: $("colorDots"),
  colorBg: $("colorBg"),
  size: $("size"),

  logoInput: $("logoInput"),
  dropzone: $("dropzone"),
  logoSize: $("logoSize"),
  logoSizeVal: $("logoSizeVal"),
  btnClearLogo: $("btnClearLogo"),

  // overlay
  overlayEnabled: $("overlayEnabled"),
  overlayWrap: $("overlayWrap"),
  overlayText: $("overlayText"),
  overlayLines: $("overlayLines"),
  overlaySubWrap: $("overlaySubWrap"),
  overlaySubText: $("overlaySubText"),
  overlayPos: $("overlayPos"),
  overlayFont: $("overlayFont"),
  overlayFontVal: $("overlayFontVal"),
  overlayTextColor: $("overlayTextColor"),
  overlayBgColor: $("overlayBgColor"),
  overlayBgOpacity: $("overlayBgOpacity"),
  overlayBgOpacityVal: $("overlayBgOpacityVal"),
  overlayPad: $("overlayPad"),
  overlayPadVal: $("overlayPadVal"),
  overlayRadius: $("overlayRadius"),
  overlayRadiusVal: $("overlayRadiusVal"),

  qrCanvas: $("qrCanvas"),
  captionView: $("captionView"),
  previewSub: $("previewSub"),

  btnDownload: $("btnDownload"),
  btnDownloadSvg: $("btnDownloadSvg"),
  btnCopyPng: $("btnCopyPng"),
  btnCopyText: $("btnCopyText"),
  btnRandom: $("btnRandom"),
  btnUpdate: $("btnUpdate"),

  year: $("year"),
};

els.year.textContent = new Date().getFullYear();

let currentLogoDataUrl = null;

function safeTrim(v) {
  return (v ?? "").toString().trim();
}
function toInt(v, def) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function buildEncodedText() {
  const data = safeTrim(els.inputData.value);
  const note = safeTrim(els.note.value);
  if (!data) return "";

  if (els.mode.value === "urlPlusNote" && note) {
    return `${data}\n${note}`;
  }
  return data;
}

function updateNoteVisibility() {
  const show = els.mode.value === "urlPlusNote";
  els.noteWrap.style.display = show ? "flex" : "none";
}

function updateOverlayVisibility() {
  const on = !!els.overlayEnabled.checked;
  els.overlayWrap.style.display = on ? "flex" : "none";

  const lines = els.overlayLines?.value || "1";
  if (els.overlaySubWrap) {
    els.overlaySubWrap.style.display = (on && lines === "2") ? "flex" : "none";
  }

  if (on && !safeTrim(els.overlayText.value) && safeTrim(els.caption.value)) {
    els.overlayText.value = safeTrim(els.caption.value);
  }
}

function inferPreviewSubtitle(encoded) {
  if (!encoded) return "ยังไม่มีข้อมูล";
  const firstLine = encoded.split("\n")[0];
  return firstLine.length > 48 ? firstLine.slice(0, 48) + "…" : firstLine;
}

function syncOverlayLabels() {
  els.overlayFontVal.textContent = String(toInt(els.overlayFont.value, 18));
  els.overlayBgOpacityVal.textContent = String(toInt(els.overlayBgOpacity.value, 85));
  els.overlayPadVal.textContent = String(toInt(els.overlayPad.value, 12));
  els.overlayRadiusVal.textContent = String(toInt(els.overlayRadius.value, 14));
}

function overlayIsOn() {
  const on = !!els.overlayEnabled.checked;
  if (!on) return false;
  const title = safeTrim(els.overlayText.value);
  const sub = safeTrim(els.overlaySubText.value);
  return (els.overlayLines.value === "2") ? (!!title || !!sub) : !!title;
}

const qr = new QRCodeStyling({
  width: 360,
  height: 360,
  type: "canvas",
  data: "https://example.com",
  margin: 12,
  qrOptions: { errorCorrectionLevel: "Q" },
  dotsOptions: { type: "rounded", color: "#0b1020" },
  backgroundOptions: { color: "#ffffff" },
  imageOptions: { crossOrigin: "anonymous", margin: 8, imageSize: 0.35 },
});

qr.append(els.qrCanvas);
// Ensure preview shows immediately once the library creates the canvas
ensureBaseCanvasAttached();

// --- Overlay canvas layer (for preview + PNG + clipboard) ---
let baseCanvas = null;
let overlayCanvas = document.createElement("canvas");
overlayCanvas.setAttribute("aria-label", "QR code with overlay");
overlayCanvas.style.maxWidth = "100%";
overlayCanvas.style.display = "block";

function findBaseCanvas() {
  baseCanvas = els.qrCanvas.querySelector("canvas");
  if (baseCanvas) {
    baseCanvas.style.display = "none";
    if (!overlayCanvas.parentElement) els.qrCanvas.appendChild(overlayCanvas);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = clamp(r, 0, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function computeOverlayLines() {
  const linesMode = els.overlayLines?.value || "1";
  const title = safeTrim(els.overlayText.value);
  const sub = safeTrim(els.overlaySubText.value);

  const lines = [];
  if (title) lines.push({ kind: "title", text: title });
  if (linesMode === "2" && sub) lines.push({ kind: "sub", text: sub });

  if (linesMode === "2" && !title && sub) {
    return [{ kind: "title", text: sub }]; // fallback single line
  }
  return lines.length ? lines : [];
}

// Shared font measurement context for "accurate 100%" SVG box width
const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d", { willReadFrequently: false });

function setMeasureFont(kind, px) {
  // Must match SVG font-family + weight used in renderOverlay.
  if (kind === "sub") {
    measureCtx.font = `700 ${px}px Inter, system-ui, sans-serif`;
  } else {
    measureCtx.font = `800 ${px}px Inter, system-ui, sans-serif`;
  }
}

async function ensureFontsReady() {
  // Wait until Inter font is ready (important for accurate width)
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
      // Also "touch" a font load to reduce race on some browsers
      await document.fonts.load("800 18px Inter");
      await document.fonts.load("700 14px Inter");
    }
  } catch {
    // ignore
  }
}

function computeOverlayLayout(size) {
  // Returns null if no overlay text
  const enabled = !!els.overlayEnabled.checked;
  if (!enabled) return null;

  const lines = computeOverlayLines();
  if (!lines.length) return null;

  const pos = els.overlayPos.value;
  const pad = clamp(toInt(els.overlayPad.value, 12), 6, 28);
  const radius = clamp(toInt(els.overlayRadius.value, 14), 0, 22);
  const fg = els.overlayTextColor.value;
  const bg = els.overlayBgColor.value;
  const bgOpacity = clamp(toInt(els.overlayBgOpacity.value, 85), 0, 100) / 100;

  const safeMargin = Math.round(size * 0.06);
  const maxW = size - safeMargin * 2;

  const baseTitlePx = clamp(toInt(els.overlayFont.value, 18), 10, 40);
  const lineGap = Math.max(2, Math.round(baseTitlePx * 0.22));

  let titlePx = baseTitlePx;
  let subPx = Math.max(10, Math.round(titlePx * 0.78));

  const measureMaxLineWidth = () => {
    let w = 0;
    for (const ln of lines) {
      const px = (ln.kind === "sub") ? subPx : titlePx;
      setMeasureFont(ln.kind, px);
      w = Math.max(w, measureCtx.measureText(ln.text).width);
    }
    return w;
  };

  let maxLineW = measureMaxLineWidth();
  while (maxLineW > (maxW - pad * 2) && titlePx > 12) {
    titlePx -= 1;
    subPx = Math.max(10, Math.round(titlePx * 0.78));
    maxLineW = measureMaxLineWidth();
  }

  const titleH = Math.round(titlePx * 1.15);
  const subH = Math.round(subPx * 1.10);
  const contentH = (lines.length <= 1) ? titleH : (titleH + lineGap + subH);

  const boxW = clamp(Math.round(maxLineW + pad * 2), 0, maxW);
  const boxH = Math.round(contentH + pad * 1.2);

  const x = Math.round((size - boxW) / 2);
  let y;
  if (pos === "top") y = safeMargin;
  else if (pos === "center") y = Math.round((size - boxH) / 2);
  else y = size - safeMargin - boxH;

  // Text baselines
  const topY = y + Math.round(boxH / 2) - Math.round(contentH / 2);

  return {
    lines,
    pos,
    pad,
    radius,
    fg,
    bg,
    bgOpacity,
    safeMargin,
    maxW,
    titlePx,
    subPx,
    lineGap,
    box: { x, y, w: boxW, h: boxH },
    content: { topY, contentH, titleH, subH },
  };
}

function renderOverlay() {
  findBaseCanvas();
  if (!baseCanvas) return;

  const size = baseCanvas.width;
  overlayCanvas.width = size;
  overlayCanvas.height = size;

  const ctx = overlayCanvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  ctx.drawImage(baseCanvas, 0, 0);

  const layout = computeOverlayLayout(size);
  if (!layout) return;

  const { box, fg, bg, bgOpacity, radius, lines, titlePx, subPx, lineGap, content } = layout;

  ctx.save();
  ctx.globalAlpha = bgOpacity;
  ctx.fillStyle = bg;
  roundRect(ctx, box.x, box.y, box.w, box.h, radius);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cx = Math.round(size / 2);

  if (lines.length <= 1) {
    ctx.font = `800 ${titlePx}px Inter, system-ui, sans-serif`;
    ctx.fillText(lines[0].text, cx, Math.round(content.topY + content.contentH / 2));
  } else {
    ctx.font = `800 ${titlePx}px Inter, system-ui, sans-serif`;
    ctx.fillText(lines[0].text, cx, Math.round(content.topY + content.titleH / 2));

    ctx.font = `700 ${subPx}px Inter, system-ui, sans-serif`;
    ctx.fillText(lines[1].text, cx, Math.round(content.topY + content.titleH + lineGap + content.subH / 2));
  }
}


function scheduleOverlayRender() {
  // qr-code-styling renders asynchronously; do a double-rAF + fallback timeout
  requestAnimationFrame(() => {
    scheduleOverlayRender();
  });
  setTimeout(() => renderOverlay(), 60);
}

// Wait for base canvas to exist (first render) then ensure overlay canvas is shown
function ensureBaseCanvasAttached() {
  const tryAttach = () => {
    findBaseCanvas();
    if (baseCanvas) {
      scheduleOverlayRender();
      return true;
    }
    return false;
  };

  if (tryAttach()) return;

  let tries = 0;
  const t = setInterval(() => {
    tries += 1;
    if (tryAttach() || tries > 50) clearInterval(t); // ~2.5s max
  }, 50);
}

function applyQR() {
  const encoded = buildEncodedText();
  const caption = safeTrim(els.caption.value);

  const size = clamp(toInt(els.size.value, 360), 240, 1024);
  els.size.value = String(size);

  const dotStyle = els.dotStyle.value;
  const ecc = els.ecc.value;
  const colorDots = els.colorDots.value;
  const colorBg = els.colorBg.value;

  const logoPct = clamp(toInt(els.logoSize.value, 22), 0, 60);
  els.logoSizeVal.textContent = String(logoPct);

  els.captionView.textContent = caption;
  els.previewSub.textContent = inferPreviewSubtitle(encoded);

  const imageSize = Math.min(Math.max(logoPct / 100, 0), 0.6);

  qr.update({
    width: size,
    height: size,
    data: encoded || " ",
    dotsOptions: { type: dotStyle, color: colorDots },
    backgroundOptions: { color: colorBg },
    qrOptions: { errorCorrectionLevel: ecc },
    image: currentLogoDataUrl || undefined,
    imageOptions: {
      crossOrigin: "anonymous",
      margin: currentLogoDataUrl ? 10 : 0,
      imageSize: currentLogoDataUrl ? imageSize : 0,
    },
  });

  scheduleOverlayRender();
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function handleLogoFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น (PNG/JPG/SVG)");
    return;
  }
  currentLogoDataUrl = await readFileAsDataURL(file);
  applyQR();
}

function clearLogo() {
  currentLogoDataUrl = null;
  if (toInt(els.logoSize.value, 22) > 28) els.logoSize.value = "22";
  applyQR();
}

/* ---------- PNG download (with overlay if enabled) ---------- */
function downloadPNG() {
  const encoded = buildEncodedText();
  if (!encoded) {
    alert("กรุณาใส่ Link / Text ก่อนดาวน์โหลด");
    els.inputData.focus();
    return;
  }

  renderOverlay();

  if (overlayIsOn() && overlayCanvas.width > 0) {
    const a = document.createElement("a");
    a.download = "qr-code.png";
    a.href = overlayCanvas.toDataURL("image/png");
    a.click();
    return;
  }

  qr.download({ name: "qr-code", extension: "png" });
}

/* ---------- Copy PNG to clipboard ---------- */
async function copyPNGToClipboard() {
  const encoded = buildEncodedText();
  if (!encoded) {
    alert("กรุณาใส่ Link / Text ก่อนทำ Copy PNG");
    els.inputData.focus();
    return;
  }

  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    alert("Browser นี้ไม่รองรับ Copy รูปภาพไป clipboard (แนะนำ Chrome/Edge ล่าสุด)");
    return;
  }

  try {
    let blob;

    if (overlayIsOn()) {
      renderOverlay();
      blob = await new Promise((resolve) => overlayCanvas.toBlob(resolve, "image/png"));
    } else {
      blob = await qr.getRawData("png");
    }

    if (!blob) throw new Error("PNG blob not available");

    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

    const old = els.btnCopyPng.textContent;
    els.btnCopyPng.textContent = "Copied!";
    setTimeout(() => (els.btnCopyPng.textContent = old), 900);
  } catch (e) {
    console.error(e);
    alert("Copy PNG ไม่สำเร็จ (บางระบบต้องอนุญาต clipboard หรือใช้ HTTPS เท่านั้น)");
  }
}

/* ---------- SVG download (overlay width measured accurately) ---------- */
function hexToRgb(hex) {
  const h = (hex || "").replace("#", "").trim();
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function escapeXml(s) {
  return (s ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function downloadSVG() {
  const encoded = buildEncodedText();
  if (!encoded) {
    alert("กรุณาใส่ Link / Text ก่อนดาวน์โหลด SVG");
    els.inputData.focus();
    return;
  }

  try {
    await ensureFontsReady();

    const svgBlob = await qr.getRawData("svg");
    const svgText = await svgBlob.text();

    // No overlay: download as-is
    if (!overlayIsOn()) {
      const out = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.download = "qr-code.svg";
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const size = clamp(toInt(els.size.value, 360), 240, 1024);
    const layout = computeOverlayLayout(size);
    if (!layout) {
      const out = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.download = "qr-code.svg";
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svg = doc.documentElement;

    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    if (!svg.getAttribute("viewBox")) {
      svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    }

    const ns = "http://www.w3.org/2000/svg";
    const gOverlay = doc.createElementNS(ns, "g");
    gOverlay.setAttribute("id", "overlay");

    // background rect
    const rect = doc.createElementNS(ns, "rect");
    rect.setAttribute("x", String(layout.box.x));
    rect.setAttribute("y", String(layout.box.y));
    rect.setAttribute("width", String(layout.box.w));
    rect.setAttribute("height", String(layout.box.h));
    rect.setAttribute("rx", String(layout.radius));
    rect.setAttribute("ry", String(layout.radius));

    const { r, g, b } = hexToRgb(layout.bg);
    rect.setAttribute("fill", `rgba(${r},${g},${b},${layout.bgOpacity})`);
    gOverlay.appendChild(rect);

    // text nodes
    const makeText = (text, x, y, fontSize, fontWeight) => {
      const t = doc.createElementNS(ns, "text");
      t.setAttribute("x", String(x));
      t.setAttribute("y", String(y));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "middle");
      t.setAttribute("fill", layout.fg);
      t.setAttribute("font-family", "Inter, system-ui, sans-serif");
      t.setAttribute("font-size", String(fontSize));
      t.setAttribute("font-weight", String(fontWeight));
      t.textContent = text;
      return t;
    };

    const cx = Math.round(size / 2);
    if (layout.lines.length <= 1) {
      const y = Math.round(layout.content.topY + layout.content.contentH / 2);
      gOverlay.appendChild(makeText(layout.lines[0].text, cx, y, layout.titlePx, 800));
    } else {
      const y1 = Math.round(layout.content.topY + layout.content.titleH / 2);
      const y2 = Math.round(layout.content.topY + layout.content.titleH + layout.lineGap + layout.content.subH / 2);
      gOverlay.appendChild(makeText(layout.lines[0].text, cx, y1, layout.titlePx, 800));
      gOverlay.appendChild(makeText(layout.lines[1].text, cx, y2, layout.subPx, 700));
    }

    svg.appendChild(gOverlay);

    const serializer = new XMLSerializer();
    const outText = serializer.serializeToString(svg);
    const out = new Blob([outText], { type: "image/svg+xml" });

    const url = URL.createObjectURL(out);
    const a = document.createElement("a");
    a.download = "qr-code.svg";
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("ดาวน์โหลด SVG ไม่สำเร็จ");
  }
}

/* ---------- Copy encoded text ---------- */
async function copyEncoded() {
  const encoded = buildEncodedText();
  if (!encoded) {
    alert("ยังไม่มีข้อความสำหรับคัดลอก");
    return;
  }
  try {
    await navigator.clipboard.writeText(encoded);
    const old = els.btnCopyText.textContent;
    els.btnCopyText.textContent = "Copied!";
    setTimeout(() => (els.btnCopyText.textContent = old), 900);
  } catch {
    prompt("คัดลอกข้อความนี้:", encoded);
  }
}

function fillExample() {
  els.inputData.value = "https://drive.google.com/file/d/xxxxxxxxxxxxxxxx/view";
  els.mode.value = "urlPlusNote";
  els.note.value = "แนวทางการใช้ยา (อัปเดตล่าสุด)\nติดต่อ: แผนกเภสัช";
  els.caption.value = "เอกสารแนวทางการใช้ยา";

  els.overlayEnabled.checked = true;
  els.overlayLines.value = "2";
  els.overlayText.value = "แนวทางการใช้ยา";
  els.overlaySubText.value = "Updated: 2026-03-03";
  els.overlayPos.value = "bottom";

  updateNoteVisibility();
  updateOverlayVisibility();
  syncOverlayLabels();
  applyQR();
}

// Wire events
[
  els.inputData,
  els.mode,
  els.note,
  els.caption,
  els.dotStyle,
  els.ecc,
  els.colorDots,
  els.colorBg,
  els.size,
  els.logoSize,

  els.overlayEnabled,
  els.overlayText,
  els.overlayLines,
  els.overlaySubText,
  els.overlayPos,
  els.overlayFont,
  els.overlayTextColor,
  els.overlayBgColor,
  els.overlayBgOpacity,
  els.overlayPad,
  els.overlayRadius,
].forEach((el) => {
  el.addEventListener("input", () => {
    if (el === els.mode) updateNoteVisibility();
    if (el === els.overlayEnabled || el === els.overlayLines) updateOverlayVisibility();
    syncOverlayLabels();
    applyQR();
  });
});


// Extra listeners: make preview update immediately on paste / change / keyup (some mobile browsers)
[els.inputData, els.note, els.caption, els.overlayText, els.overlaySubText].forEach((el) => {
  el.addEventListener("change", () => applyQR());
  el.addEventListener("keyup", () => applyQR());
  el.addEventListener("paste", () => {
    // allow pasted text to land first
    setTimeout(() => applyQR(), 0);
  });
});

// When user picks a suggestion/autofill, some browsers may skip 'input'
els.inputData.addEventListener("blur", () => applyQR());

// Logo upload
els.logoInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  await handleLogoFile(file);
  e.target.value = "";
});

els.dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  els.dropzone.style.borderColor = "rgba(124,92,255,.7)";
});
els.dropzone.addEventListener("dragleave", () => {
  els.dropzone.style.borderColor = "rgba(255,255,255,.18)";
});
els.dropzone.addEventListener("drop", async (e) => {
  e.preventDefault();
  els.dropzone.style.borderColor = "rgba(255,255,255,.18)";
  const file = e.dataTransfer?.files?.[0];
  await handleLogoFile(file);
});

els.btnClearLogo.addEventListener("click", clearLogo);

// Buttons
els.btnDownload.addEventListener("click", downloadPNG);
els.btnDownloadSvg.addEventListener("click", downloadSVG);
els.btnCopyPng.addEventListener("click", copyPNGToClipboard);
els.btnCopyText.addEventListener("click", copyEncoded);
els.btnRandom.addEventListener("click", fillExample);
els.btnUpdate.addEventListener("click", () => {
  // Manual update button
  syncOverlayLabels();
  updateNoteVisibility();
  updateOverlayVisibility();
  applyQR();
});

// Init
(async function init(){
  updateNoteVisibility();
  updateOverlayVisibility();
  syncOverlayLabels();
  await ensureFontsReady();
  applyQR();
})();
