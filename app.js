/* QR Generator - Static Web App (GitHub Pages)
 * - Uses qr-code-styling library
 * - Supports: URL, URL+Note in QR, caption under QR, logo overlay, styling
 * - Adds Text Overlay (1 or 2 lines) composited via a top canvas for preview + download
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
  btnCopyText: $("btnCopyText"),
  btnRandom: $("btnRandom"),

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

  // default title = caption (ถ้าเปิด overlay แล้ว title ยังว่าง)
  if (on && !safeTrim(els.overlayText.value) && safeTrim(els.caption.value)) {
    els.overlayText.value = safeTrim(els.caption.value);
  }
}

function inferPreviewSubtitle(encoded) {
  if (!encoded) return "ยังไม่มีข้อมูล";
  const firstLine = encoded.split("\n")[0];
  return firstLine.length > 48 ? firstLine.slice(0, 48) + "…" : firstLine;
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

// --- Overlay canvas layer ---
let baseCanvas = null;
let overlayCanvas = document.createElement("canvas");
overlayCanvas.setAttribute("aria-label", "QR code with overlay");
overlayCanvas.style.maxWidth = "100%";
overlayCanvas.style.display = "block";

function findBaseCanvas() {
  baseCanvas = els.qrCanvas.querySelector("canvas");
  if (baseCanvas) {
    // Hide base QR canvas, show overlay canvas instead
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

function renderOverlay() {
  findBaseCanvas();
  if (!baseCanvas) return;

  const enabled = !!els.overlayEnabled.checked;
  const linesMode = els.overlayLines?.value || "1";

  const title = safeTrim(els.overlayText.value);
  const sub = safeTrim(els.overlaySubText?.value);

  const hasText = linesMode === "2" ? (!!title || !!sub) : !!title;

  const size = baseCanvas.width;
  overlayCanvas.width = size;
  overlayCanvas.height = size;

  const ctx = overlayCanvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  // Draw base QR first
  ctx.drawImage(baseCanvas, 0, 0);

  if (!enabled || !hasText) return;

  // Overlay params
  const pos = els.overlayPos.value; // bottom/top/center
  const pad = clamp(toInt(els.overlayPad.value, 12), 6, 28);
  const radius = clamp(toInt(els.overlayRadius.value, 14), 0, 22);
  const fg = els.overlayTextColor.value;
  const bg = els.overlayBgColor.value;
  const bgOpacity = clamp(toInt(els.overlayBgOpacity.value, 85), 0, 100) / 100;

  // Safe margin from edges
  const safeMargin = Math.round(size * 0.06); // 6%
  const maxW = size - safeMargin * 2;

  // Typography
  const baseTitlePx = clamp(toInt(els.overlayFont.value, 18), 10, 40);
  const lineGap = Math.max(2, Math.round(baseTitlePx * 0.22));

  const setTitleFont = (px) => { ctx.font = `800 ${px}px Inter, system-ui, sans-serif`; };
  const setSubFont = (px) => { ctx.font = `700 ${px}px Inter, system-ui, sans-serif`; };

  // Build lines
  const lines = [];
  if (title) lines.push({ kind: "title", text: title });

  if (linesMode === "2" && sub) {
    lines.push({ kind: "sub", text: sub });
  }

  // If user selected 2 lines but provided only subtitle, render it anyway.
  if (linesMode === "2" && !title && sub) {
    lines.unshift({ kind: "title", text: sub }); // render as title style for better readability
    lines.pop(); // ensure single line if only subtitle
  }

  // Autoshrink: ensure longest line fits maxW - pad*2
  let titlePx = baseTitlePx;
  let subPx = Math.max(10, Math.round(titlePx * 0.78));

  function measureMaxLineWidth() {
    let w = 0;
    for (const ln of lines) {
      if (ln.kind === "title") setTitleFont(titlePx);
      else setSubFont(subPx);
      w = Math.max(w, ctx.measureText(ln.text).width);
    }
    return w;
  }

  let maxLineW = measureMaxLineWidth();
  while (maxLineW > (maxW - pad * 2) && titlePx > 12) {
    titlePx -= 1;
    subPx = Math.max(10, Math.round(titlePx * 0.78));
    maxLineW = measureMaxLineWidth();
  }

  // Compute content height
  const titleH = Math.round(titlePx * 1.15);
  const subH = Math.round(subPx * 1.10);

  let contentH = 0;
  if (lines.length <= 1) {
    contentH = titleH;
  } else {
    contentH = titleH + lineGap + subH;
  }

  const boxW = clamp(Math.round(maxLineW + pad * 2), 0, maxW);
  const boxH = Math.round(contentH + pad * 1.2);

  const x = Math.round((size - boxW) / 2);
  let y;
  if (pos === "top") y = safeMargin;
  else if (pos === "center") y = Math.round((size - boxH) / 2);
  else y = size - safeMargin - boxH;

  // Background
  ctx.save();
  ctx.globalAlpha = bgOpacity;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, boxW, boxH, radius);
  ctx.fill();
  ctx.restore();

  // Text
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cx = Math.round(size / 2);
  const topY = y + Math.round(boxH / 2) - Math.round(contentH / 2);

  if (lines.length <= 1) {
    setTitleFont(titlePx);
    const yy = Math.round(topY + contentH / 2);
    ctx.fillText(lines[0]?.text || title, cx, yy);
  } else {
    setTitleFont(titlePx);
    const y1 = Math.round(topY + titleH / 2);
    ctx.fillText(lines[0].text, cx, y1);

    setSubFont(subPx);
    const y2 = Math.round(topY + titleH + lineGap + subH / 2);
    ctx.fillText(lines[1].text, cx, y2);
  }
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

  // imageSize fraction (0..0.6)
  const imageSize = Math.min(Math.max(logoPct / 100, 0), 0.6);

  qr.update({
    width: size,
    height: size,
    data: encoded || " ", // avoid empty
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

  // Render overlay in next frame after base canvas updated
  requestAnimationFrame(() => renderOverlay());
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
  const dataUrl = await readFileAsDataURL(file);
  currentLogoDataUrl = dataUrl;
  applyQR();
}

function clearLogo() {
  currentLogoDataUrl = null;
  if (toInt(els.logoSize.value, 22) > 28) els.logoSize.value = "22";
  applyQR();
}

function downloadPNG() {
  const encoded = buildEncodedText();
  if (!encoded) {
    alert("กรุณาใส่ Link / Text ก่อนดาวน์โหลด");
    els.inputData.focus();
    return;
  }

  // Ensure latest composite
  renderOverlay();

  const overlayOn = !!els.overlayEnabled.checked && (
    safeTrim(els.overlayText.value) ||
    (els.overlayLines.value === "2" && safeTrim(els.overlaySubText.value))
  );

  if (overlayOn && overlayCanvas.width > 0) {
    const a = document.createElement("a");
    a.download = "qr-code.png";
    a.href = overlayCanvas.toDataURL("image/png");
    a.click();
    return;
  }

  // fallback: original library download
  qr.download({ name: "qr-code", extension: "png" });
}

async function copyEncoded() {
  const encoded = buildEncodedText();
  if (!encoded) {
    alert("ยังไม่มีข้อความสำหรับคัดลอก");
    return;
  }
  try {
    await navigator.clipboard.writeText(encoded);
    els.btnCopyText.textContent = "Copied!";
    setTimeout(() => (els.btnCopyText.textContent = "Copy"), 900);
  } catch {
    prompt("คัดลอกข้อความนี้:", encoded);
  }
}

function fillExample() {
  els.inputData.value = "https://drive.google.com/file/d/xxxxxxxxxxxxxxxx/view";
  els.mode.value = "urlPlusNote";
  els.note.value = "แนวทางการใช้ยา (อัปเดตล่าสุด)\nติดต่อ: แผนกเภสัช";
  els.caption.value = "เอกสารแนวทางการใช้ยา";

  // overlay example
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

function syncOverlayLabels() {
  els.overlayFontVal.textContent = String(toInt(els.overlayFont.value, 18));
  els.overlayBgOpacityVal.textContent = String(toInt(els.overlayBgOpacity.value, 85));
  els.overlayPadVal.textContent = String(toInt(els.overlayPad.value, 12));
  els.overlayRadiusVal.textContent = String(toInt(els.overlayRadius.value, 14));
}

// Wire events (single place)
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

  // overlay controls
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
els.btnDownload.addEventListener("click", downloadPNG);
els.btnCopyText.addEventListener("click", copyEncoded);
els.btnRandom.addEventListener("click", fillExample);

// Init
updateNoteVisibility();
updateOverlayVisibility();
syncOverlayLabels();
applyQR();
