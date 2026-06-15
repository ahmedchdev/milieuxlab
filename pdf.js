/* ============================================================
   MilieuXlab — pdf.js
   Vanilla PDF 1.4 generator. No dependencies, fully offline.
   Exposes window.PDF class.

   Uses the PDF standard 14 fonts (Helvetica family) which are
   built into every PDF viewer.
   ============================================================ */

(function () {
  'use strict';

  const PAGE_SIZES = {
    A4: { portrait: { w: 595, h: 842 }, landscape: { w: 842, h: 595 } },
  };

  /* Adobe Helvetica AFM character widths (1/1000 em units) */
  const HELV_REGULAR = {
    0x20: 278, 0x21: 278, 0x22: 355, 0x23: 556, 0x24: 556, 0x25: 889,
    0x26: 667, 0x27: 191, 0x28: 333, 0x29: 333, 0x2A: 389, 0x2B: 584,
    0x2C: 278, 0x2D: 333, 0x2E: 278, 0x2F: 278,
    0x30: 556, 0x31: 556, 0x32: 556, 0x33: 556, 0x34: 556, 0x35: 556,
    0x36: 556, 0x37: 556, 0x38: 556, 0x39: 556,
    0x3A: 278, 0x3B: 278, 0x3C: 584, 0x3D: 584, 0x3E: 584, 0x3F: 556,
    0x40: 1015, 0x41: 667, 0x42: 667, 0x43: 722, 0x44: 722, 0x45: 667,
    0x46: 611, 0x47: 778, 0x48: 722, 0x49: 278, 0x4A: 500, 0x4B: 667,
    0x4C: 556, 0x4D: 833, 0x4E: 722, 0x4F: 778, 0x50: 667, 0x51: 778,
    0x52: 722, 0x53: 667, 0x54: 611, 0x55: 722, 0x56: 667, 0x57: 944,
    0x58: 667, 0x59: 667, 0x5A: 611,
    0x5B: 278, 0x5C: 278, 0x5D: 278, 0x5E: 469, 0x5F: 556, 0x60: 333,
    0x61: 556, 0x62: 556, 0x63: 500, 0x64: 556, 0x65: 556, 0x66: 278,
    0x67: 556, 0x68: 556, 0x69: 222, 0x6A: 222, 0x6B: 500, 0x6C: 222,
    0x6D: 833, 0x6E: 556, 0x6F: 556, 0x70: 556, 0x71: 556, 0x72: 333,
    0x73: 500, 0x74: 278, 0x75: 556, 0x76: 500, 0x77: 722, 0x78: 500,
    0x79: 500, 0x7A: 500,
    0x7B: 334, 0x7C: 260, 0x7D: 334, 0x7E: 584,
    0xA0: 278, 0xA1: 333, 0xA2: 556, 0xA3: 556, 0xA4: 556, 0xA5: 556,
    0xA6: 260, 0xA7: 556, 0xA8: 333, 0xA9: 737, 0xAA: 370, 0xAB: 556,
    0xAC: 584, 0xAD: 278, 0xAE: 737, 0xAF: 333,
    0xB0: 400, 0xB1: 584, 0xB2: 333, 0xB3: 333, 0xB4: 333, 0xB5: 556,
    0xB6: 537, 0xB7: 278, 0xB8: 333, 0xB9: 333, 0xBA: 365, 0xBB: 556,
    0xBC: 834, 0xBD: 834, 0xBE: 834, 0xBF: 611,
    0xC0: 556, 0xC1: 556, 0xC2: 556, 0xC3: 556, 0xC4: 556, 0xC5: 556,
    0xC6: 889, 0xC7: 500, 0xC8: 556, 0xC9: 556, 0xCA: 556, 0xCB: 556,
    0xCC: 278, 0xCD: 278, 0xCE: 278, 0xCF: 278,
    0xD0: 556, 0xD1: 556, 0xD2: 556, 0xD3: 556, 0xD4: 556, 0xD5: 556,
    0xD6: 556, 0xD7: 584, 0xD8: 556, 0xD9: 556, 0xDA: 556, 0xDB: 556,
    0xDC: 556, 0xDD: 500, 0xDE: 556, 0xDF: 611,
    0xE0: 556, 0xE1: 556, 0xE2: 556, 0xE3: 556, 0xE4: 556, 0xE5: 556,
    0xE6: 889, 0xE7: 500, 0xE8: 556, 0xE9: 556, 0xEA: 556, 0xEB: 556,
    0xEC: 278, 0xED: 278, 0xEE: 278, 0xEF: 278,
    0xF0: 556, 0xF1: 556, 0xF2: 556, 0xF3: 556, 0xF4: 556, 0xF5: 556,
    0xF6: 556, 0xF7: 584, 0xF8: 556, 0xF9: 556, 0xFA: 556, 0xFB: 556,
    0xFC: 556, 0xFD: 500, 0xFE: 556, 0xFF: 500,
    0x80: 1000, 0x82: 333, 0x83: 500, 0x84: 556, 0x85: 1000,
    0x86: 556, 0x87: 556, 0x88: 333, 0x89: 1000, 0x8A: 667,
    0x8B: 556, 0x8C: 944, 0x8E: 611, 0x91: 333, 0x92: 333,
    0x93: 500, 0x94: 500, 0x95: 278, 0x96: 500, 0x97: 1000,
    0x98: 333, 0x99: 737, 0x9A: 500, 0x9B: 556, 0x9C: 889,
    0x9E: 500, 0x9F: 500,
  };

  // Bold is slightly wider than regular
  const HELV_BOLD = Object.assign({}, HELV_REGULAR, {
    0x21: 333, 0x22: 474, 0x23: 556, 0x24: 556, 0x25: 1000, 0x26: 722,
    0x27: 238, 0x28: 333, 0x29: 333, 0x2A: 389, 0x2B: 584, 0x2C: 333,
    0x2D: 333, 0x2E: 333, 0x2F: 278,
    0x30: 556, 0x31: 556, 0x32: 556, 0x33: 556, 0x34: 556, 0x35: 556,
    0x36: 556, 0x37: 556, 0x38: 556, 0x39: 556,
    0x3A: 333, 0x3B: 333, 0x3C: 584, 0x3D: 584, 0x3E: 584, 0x3F: 611,
    0x40: 1000, 0x41: 722, 0x42: 722, 0x43: 722, 0x44: 722, 0x45: 667,
    0x46: 611, 0x47: 778, 0x48: 722, 0x49: 333, 0x4A: 556, 0x4B: 722,
    0x4C: 611, 0x4D: 833, 0x4E: 722, 0x4F: 778, 0x50: 667, 0x51: 778,
    0x52: 722, 0x53: 667, 0x54: 611, 0x55: 722, 0x56: 667, 0x57: 944,
    0x58: 667, 0x59: 667, 0x5A: 611,
    0x5B: 333, 0x5C: 333, 0x5D: 333, 0x5E: 584, 0x5F: 556, 0x60: 333,
    0x61: 611, 0x62: 611, 0x63: 556, 0x64: 611, 0x65: 611, 0x66: 333,
    0x67: 611, 0x68: 611, 0x69: 278, 0x6A: 278, 0x6B: 556, 0x6C: 278,
    0x6D: 889, 0x6E: 611, 0x6F: 611, 0x70: 611, 0x71: 611, 0x72: 389,
    0x73: 556, 0x74: 333, 0x75: 611, 0x76: 556, 0x77: 778, 0x78: 556,
    0x79: 556, 0x7A: 500,
    0x7B: 389, 0x7C: 280, 0x7D: 389, 0x7E: 584,
    0xA0: 333, 0xA1: 333, 0xA2: 556, 0xA3: 556, 0xA4: 556, 0xA5: 556,
    0xA6: 280, 0xA7: 556, 0xA8: 333, 0xA9: 737, 0xAA: 370, 0xAB: 556,
    0xAC: 584, 0xAD: 333, 0xAE: 737, 0xAF: 333,
    0xB0: 400, 0xB1: 584, 0xB2: 333, 0xB3: 333, 0xB4: 333, 0xB5: 611,
    0xB6: 556, 0xB7: 333, 0xB8: 333, 0xB9: 333, 0xBA: 365, 0xBB: 556,
    0xBC: 834, 0xBD: 834, 0xBE: 834, 0xBF: 611,
    0xC0: 722, 0xC1: 722, 0xC2: 722, 0xC3: 722, 0xC4: 722, 0xC5: 722,
    0xC6: 944, 0xC7: 722, 0xC8: 667, 0xC9: 667, 0xCA: 667, 0xCB: 667,
    0xCC: 333, 0xCD: 333, 0xCE: 333, 0xCF: 333,
    0xD0: 722, 0xD1: 722, 0xD2: 778, 0xD3: 778, 0xD4: 778, 0xD5: 778,
    0xD6: 778, 0xD7: 584, 0xD8: 778, 0xD9: 722, 0xDA: 722, 0xDB: 722,
    0xDC: 722, 0xDD: 667, 0xDE: 667, 0xDF: 611,
    0xE0: 611, 0xE1: 611, 0xE2: 611, 0xE3: 611, 0xE4: 611, 0xE5: 611,
    0xE6: 944, 0xE7: 556, 0xE8: 611, 0xE9: 611, 0xEA: 611, 0xEB: 611,
    0xEC: 333, 0xED: 333, 0xEE: 333, 0xEF: 333,
    0xF0: 611, 0xF1: 611, 0xF2: 611, 0xF3: 611, 0xF4: 611, 0xF5: 611,
    0xF6: 611, 0xF7: 584, 0xF8: 611, 0xF9: 611, 0xFA: 611, 0xFB: 611,
    0xFC: 611, 0xFD: 556, 0xFE: 556, 0xFF: 556,
    0x80: 1000, 0x82: 333, 0x83: 500, 0x84: 556, 0x85: 1000,
    0x86: 556, 0x87: 556, 0x88: 333, 0x89: 1000, 0x8A: 667,
    0x8B: 556, 0x8C: 944, 0x8E: 611, 0x91: 333, 0x92: 333,
    0x93: 500, 0x94: 500, 0x95: 333, 0x96: 500, 0x97: 1000,
    0x98: 333, 0x99: 737, 0x9A: 500, 0x9B: 556, 0x9C: 889,
    0x9E: 500, 0x9F: 500,
  });

  const DEFAULT_W = 500;
  function charWidth(code, isBold) {
    const t = isBold ? HELV_BOLD : HELV_REGULAR;
    return t[code] != null ? t[code] : DEFAULT_W;
  }
  function textWidth(str, size, isBold) {
    let total = 0;
    for (let i = 0; i < str.length; i++) total += charWidth(str.charCodeAt(i), isBold);
    return total * size / 1000;
  }

  function truncate(str, size, maxWidth, isBold) {
    if (textWidth(str, size, isBold) <= maxWidth) return str;
    const ellW = charWidth(0x85, isBold) * size / 1000;
    let out = '';
    for (let i = 0; i < str.length; i++) {
      const next = out + str[i];
      if (textWidth(next, size, isBold) + ellW > maxWidth) break;
      out = next;
    }
    return out + '…';
  }

  const WIN_ANSI_MAP = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F,
  };
  function encodeWinAnsi(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c < 0x100) bytes.push(c);
      else if (WIN_ANSI_MAP[c] != null) bytes.push(WIN_ANSI_MAP[c]);
      else bytes.push(0x3F);
    }
    return bytes;
  }
  function escapePdfString(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b === 0x28) out += '\\(';
      else if (b === 0x29) out += '\\)';
      else if (b === 0x5C) out += '\\\\';
      else if (b < 0x20 || b > 0x7E) {
        out += '\\' + b.toString(8).padStart(3, '0');
      } else {
        out += String.fromCharCode(b);
      }
    }
    return out;
  }
  function hexColor(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) / 255,
            parseInt(h.slice(2, 4), 16) / 255,
            parseInt(h.slice(4, 6), 16) / 255];
  }
  function colorStr(hex) {
    const [r, g, b] = hexColor(hex);
    return r.toFixed(4) + ' ' + g.toFixed(4) + ' ' + b.toFixed(4);
  }

  function strToBytes(s) {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xFF;
    return out;
  }
  function concatBytes(...arrs) {
    let len = 0;
    for (const a of arrs) len += a.length;
    const out = new Uint8Array(len);
    let off = 0;
    for (const a of arrs) { out.set(a, off); off += a.length; }
    return out;
  }

  class PDF {
    constructor(opts) {
      opts = opts || {};
      const size = (opts.size || 'A4').toUpperCase();
      const orient = opts.orientation || 'portrait';
      const ps = PAGE_SIZES[size] && PAGE_SIZES[size][orient];
      if (!ps) throw new Error('Unsupported page size: ' + size);
      this.w = ps.w;
      this.h = ps.h;
      const m = opts.margin || {};
      this.margin = {
        top:    m.top    != null ? m.top    : 42,
        right:  m.right  != null ? m.right  : 42,
        bottom: m.bottom != null ? m.bottom : 51,
        left:   m.left   != null ? m.left   : 42,
      };
      this.pages = [];
      this._newPage();
      this._footerCb = null;
    }
    _newPage() {
      this.pages.push({ ops: '', contentBytes: null });
    }
    addPage() {
      this.pages.push({ ops: '', contentBytes: null });
    }

    /* text(): draw at top-left coords (x, y). y is measured from the TOP descending.
       If width is given, text is truncated to fit (with 30% safety margin). */
    text(str, x, y, opts) {
      opts = opts || {};
      const size = opts.size != null ? opts.size : 10;
      const isBold = !!opts.bold;
      const color = opts.color || '#0A0E14';
      const align = opts.align || 'left';
      const width = opts.width;

      let text = String(str);
      if (width != null) {
        const truncated = truncate(text, size, width, isBold);
        text = truncated;
      }

      // For right/center align with a given width, x is the LEFT edge of the box.
      // For right/center align WITHOUT width, x is the RIGHT edge (x of trailing char).
      // Real Helvetica in PDF viewers renders ~10% wider than AFM nominal, so we
      // shift right-aligned text left by 10% of the text width to avoid edge clipping.
      const measuredW = textWidth(text, size, isBold);
      const RIGHT_ALIGN_BIAS_RATIO = 0.10;
      let xText;
      if (align === 'right') {
        xText = (width != null) ? (x + width - measuredW) : (x - measuredW * (1 + RIGHT_ALIGN_BIAS_RATIO));
      } else if (align === 'center') {
        xText = (width != null) ? (x + width / 2 - measuredW / 2) : (x - measuredW / 2);
      } else {
        xText = x;
      }

      // If we have a width, truncate to fit; if no width but right-aligned, we cannot
      // shrink — but we should still guard by warning in console.
      // (No-op for now; the right-align above measures the final, possibly-truncated text.)

      // yBottom: top-left y → bottom-up y, accounting for baseline offset
      const yBottom = this.h - y - 0.78 * size;
      const bytes = encodeWinAnsi(text);
      const escaped = escapePdfString(bytes);
      const fontRef = isBold ? 'F2' : 'F1';

      const op = 'BT /' + fontRef + ' ' + size + ' Tf ' + colorStr(color) + ' rg ' +
                 xText.toFixed(2) + ' ' + yBottom.toFixed(2) + ' Td (' + escaped + ') Tj ET\n';
      this._op(op);
    }

    rect(x, y, w, h, opts) {
      opts = opts || {};
      const yBottom = this.h - y - h;
      let cmd = '';
      if (opts.fill) cmd += colorStr(opts.fill) + ' rg\n';
      if (opts.stroke) {
        cmd += colorStr(opts.stroke) + ' RG\n';
        if (opts.strokeWidth != null) cmd += opts.strokeWidth + ' w\n';
      }
      cmd += x.toFixed(2) + ' ' + yBottom.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re\n';
      if (opts.fill && opts.stroke) cmd += 'B\n';
      else if (opts.fill) cmd += 'f\n';
      else if (opts.stroke) cmd += 'S\n';
      this._op(cmd);
    }

    line(x1, y1, x2, y2, opts) {
      opts = opts || {};
      const color = opts.color || '#0A0E14';
      const width = opts.width != null ? opts.width : 0.5;
      const y1Bottom = this.h - y1;
      const y2Bottom = this.h - y2;
      const op = colorStr(color) + ' RG ' + width + ' w ' +
                 x1.toFixed(2) + ' ' + y1Bottom.toFixed(2) + ' m ' +
                 x2.toFixed(2) + ' ' + y2Bottom.toFixed(2) + ' l S\n';
      this._op(op);
    }

    _op(s) { this.pages[this.pages.length - 1].ops += s; }
    table(specs) { return new Table(this, specs); }
    footer(fn) { this._footerCb = fn; }

    _buildFooterOps(text) {
      if (!text) return '';
      const x = this.margin.left;
      const xRight = this.w - this.margin.right;
      const yLineBottom = this.h - (this.margin.bottom - 6);
      const yTextBottom = this.h - (this.margin.bottom - 4);
      const size = 8;
      const bytes = encodeWinAnsi(text);
      const escaped = escapePdfString(bytes);
      return (
        colorStr('#C7D2DD') + ' RG 0.5 w\n' +
        x.toFixed(2) + ' ' + yLineBottom.toFixed(2) + ' m ' +
        xRight.toFixed(2) + ' ' + yLineBottom.toFixed(2) + ' l S\n' +
        'BT /F1 ' + size + ' Tf ' + colorStr('#5A7A99') + ' rg ' +
        x.toFixed(2) + ' ' + yTextBottom.toFixed(2) + ' Td (' + escaped + ') Tj ET\n'
      );
    }

    download(filename) {
      const total = this.pages.length;
      for (let i = 0; i < total; i++) {
        const page = this.pages[i];
        let footerOps = '';
        if (this._footerCb) {
          const text = this._footerCb(i, total);
          footerOps = this._buildFooterOps(text);
        }
        page.contentBytes = strToBytes(page.ops + footerOps);
      }
      const bytes = assemblePdf(this);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch (e) {}
        URL.revokeObjectURL(url);
      }, 100);
    }
  }

  class Table {
    constructor(pdf, specs) {
      this.pdf = pdf;
      this.x = specs.x;
      this.y = specs.y;
      this.widths = specs.widths;
      this.rowHeight = specs.rowHeight || 18;
      this.headerHeight = specs.headerHeight || this.rowHeight;
      this.headerRepeat = specs.headerRepeat !== false;
      this.headerCells = null;
      this.headerOpts = null;
      this.cursorY = specs.y;
    }

    _checkPageBreak(neededHeight) {
      const pageBottom = this.pdf.h - this.pdf.margin.bottom - 30;
      if (this.cursorY + neededHeight > pageBottom) {
        this.pdf.addPage();
        this.cursorY = this.pdf.margin.top;
        if (this.headerRepeat && this.headerCells) {
          this._renderRow(this.headerCells, this.headerOpts, this.headerHeight, true);
        }
      }
    }

    _renderRow(cells, opts, height, isHeader) {
      const pdf = this.pdf;
      const pad = 4;
      const totalW = this.widths.reduce((a, b) => a + b, 0);
      const y = this.cursorY;

      // 1. Background fill
      if (opts && opts.bg) {
        pdf.rect(this.x, y, totalW, height, { fill: opts.bg });
      }

      // 2. Cell text
      const size = (opts && opts.size) || (isHeader ? 7 : 9);
      const isBold = (opts && opts.bold) || isHeader;
      const color = (opts && opts.textColor) || '#0A0E14';
      const yText = y + (height - size) / 2;  // top-left y of the text line

      let cx = this.x;
      for (let i = 0; i < cells.length; i++) {
        const w = this.widths[i];
        const cellText = String(cells[i] != null ? cells[i] : '');
        pdf.text(cellText, cx + pad, yText, {
          size, bold: isBold, color, width: w - 2 * pad,
        });
        cx += w;
      }

      // 3. Borders
      if (isHeader) {
        // Defer header bottom border so it draws on top of the first data row's bg
        this._deferredHeaderBorders = this._deferredHeaderBorders || [];
        this._deferredHeaderBorders.push([this.x, y + height, this.x + totalW, y + height, '#0A0E14', 1.5]);
      } else {
        // Thin top border on this row's bg (separates from row above)
        pdf.line(this.x, y, this.x + totalW, y, { color: '#E2E8F0', width: 0.5 });
      }

      this.cursorY += height;
    }

    end() {
      if (this._deferredHeaderBorders && this._deferredHeaderBorders.length) {
        for (const b of this._deferredHeaderBorders) {
          this.pdf.line(b[0], b[1], b[2], b[3], { color: b[4], width: b[5] });
        }
        this._deferredHeaderBorders = [];
      }
      return this.pdf;
    }

    header(cells, opts) {
      opts = opts || {};
      this.headerCells = cells;
      this.headerOpts = opts;
      this._checkPageBreak(this.headerHeight);
      this._renderRow(cells, opts, this.headerHeight, true);
    }

    row(cells, opts) {
      opts = opts || {};
      this._checkPageBreak(this.rowHeight);
      this._renderRow(cells, opts, this.rowHeight, false);
    }
  }

  function assemblePdf(pdf) {
    const N = pdf.pages.length;
    const idH  = 3 + 2 * N;
    const idB  = idH + 1;
    const idO  = idH + 2;
    const idBO = idH + 3;
    const totalObjs = idBO + 1;

    const chunks = [];
    const offsets = [0];
    let cursor = 0;

    function writeStr(s) {
      const b = strToBytes(s);
      chunks.push(b);
      cursor += b.length;
    }
    function writeBytes(b) {
      chunks.push(b);
      cursor += b.length;
    }
    function writeObj(id, body) {
      offsets[id] = cursor;
      writeStr(id + ' 0 obj\n' + body + '\nendobj\n');
    }
    function writeStreamObj(id, header, bytes) {
      offsets[id] = cursor;
      const all = concatBytes(strToBytes(header), bytes, strToBytes('\nendstream\nendobj\n'));
      chunks.push(all);
      cursor += all.length;
    }

    writeStr('%PDF-1.4\n');
    writeBytes(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

    writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const kids = [];
    for (let i = 0; i < N; i++) kids.push((3 + 2 * i) + ' 0 R');
    writeObj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + N + ' >>');

    for (let i = 0; i < N; i++) {
      const pageId = 3 + 2 * i;
      const contentId = pageId + 1;
      const res = '<< /Font << /F1 ' + idH + ' 0 R /F2 ' + idB + ' 0 R /F3 ' + idO + ' 0 R /F4 ' + idBO + ' 0 R >> >>';
      writeObj(pageId, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pdf.w + ' ' + pdf.h + '] /Resources ' + res + ' /Contents ' + contentId + ' 0 R >>');
      const streamBytes = pdf.pages[i].contentBytes;
      writeStreamObj(contentId, contentId + ' 0 obj\n<< /Length ' + streamBytes.length + ' >>\nstream\n', streamBytes);
    }

    const fonts = [
      ['Helvetica',            idH ],
      ['Helvetica-Bold',       idB ],
      ['Helvetica-Oblique',    idO ],
      ['Helvetica-BoldOblique',idBO],
    ];
    for (const [name, id] of fonts) {
      writeObj(id, '<< /Type /Font /Subtype /Type1 /BaseFont /' + name + ' /Encoding /WinAnsiEncoding >>');
    }

    const xrefOffset = cursor;
    writeStr('xref\n0 ' + totalObjs + '\n');
    writeStr('0000000000 65535 f \r\n');
    for (let i = 1; i < totalObjs; i++) {
      const off = String(offsets[i] || 0).padStart(10, '0');
      writeStr(off + ' 00000 n \r\n');
    }
    writeStr('trailer\n<< /Size ' + totalObjs + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n');

    const flat = new Uint8Array(cursor);
    let off = 0;
    for (const c of chunks) { flat.set(c, off); off += c.length; }
    return flat;
  }

  window.PDF = PDF;
})();
