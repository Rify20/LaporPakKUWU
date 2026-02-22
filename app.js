/* app.js - Lapor Pak Kuwu Admin Dashboard (Static, GitHub Pages friendly)
   No frameworks, no build step. All logic runs in browser.
*/

(() => {
  "use strict";

  // ========= 1) Demo dataset (GANTI KE API NANTI kalau sudah siap backend) =========
  // ISO date untuk aman parsing lintas browser.
  const REPORTS = [
    {
      id: "RPT-0001",
      title: "Pothole on Jalan Melati",
      category: "Infrastructure",
      reporter: "Budi Santoso",
      status: "In Progress",
      createdAt: "2024-06-18T08:20:00Z",
      resolvedAt: null,
      responseTimeDays: 1.2,
      location: { village: "Desa Maju Jaya", area: "Kecamatan Sukamakmur" },
      priority: "Normal",
    },
    {
      id: "RPT-0002",
      title: "Broken Street Light RT 05",
      category: "Public Service",
      reporter: "Siti Aminah",
      status: "Pending",
      createdAt: "2024-06-18T05:10:00Z",
      resolvedAt: null,
      responseTimeDays: 2.1,
      location: { village: "Desa Maju Jaya", area: "Kecamatan Sukamakmur" },
      priority: "High",
    },
    {
      id: "RPT-0003",
      title: "Waste Overflow Market Area",
      category: "Waste Management",
      reporter: "Iwan Fals",
      status: "Resolved",
      createdAt: "2024-06-17T03:30:00Z",
      resolvedAt: "2024-06-18T03:30:00Z",
      responseTimeDays: 1.0,
      location: { village: "Desa Maju Jaya", area: "Kecamatan Sukamakmur" },
      priority: "Normal",
    },
    {
      id: "RPT-0004",
      title: "Illegal Dumping near River",
      category: "Environment",
      reporter: "Rina Wati",
      status: "Urgent",
      createdAt: "2024-06-17T02:10:00Z",
      resolvedAt: null,
      responseTimeDays: 0.6,
      location: { village: "Desa Maju Jaya", area: "Kecamatan Sukamakmur" },
      priority: "Critical",
    },

    // tambahan data supaya trend dan KPI realistis
    ...seedHistoricalReports(2024, 1, 6, 214), // Jan-Jun 2024
    ...seedHistoricalReports(2023, 1, 12, 980), // tahun 2023 full
  ];

  // ========= 2) DOM helpers =========
  const $ = (sel) => document.querySelector(sel);

  const els = {
    yearSelect: $("#yearSelect"),
    trendArea: $("#trendArea"),
    trendLine: $("#trendLine"),
    trendMonths: $("#trendMonths"),

    categoryList: $("#categoryList"),
    recentBody: $("#recentReportsBody"),

    searchInput: $("#searchInput"),
    btnExport: $("#btnExport"),

    notifDot: $("#notifDot"),

    kpiTotalValue: $("#kpiTotalValue"),
    kpiTotalDelta: $("#kpiTotalDelta"),
    kpiTotalNote: $("#kpiTotalNote"),

    kpiPendingValue: $("#kpiPendingValue"),
    kpiPendingDelta: $("#kpiPendingDelta"),
    kpiPendingNote: $("#kpiPendingNote"),

    kpiResolvedValue: $("#kpiResolvedValue"),
    kpiResolvedDelta: $("#kpiResolvedDelta"),
    kpiResolvedNote: $("#kpiResolvedNote"),

    kpiRespValue: $("#kpiRespValue"),
    kpiRespDelta: $("#kpiRespDelta"),
    kpiRespNote: $("#kpiRespNote"),

    villageName: $("#villageName"),
    villageArea: $("#villageArea"),

    btnExpandMap: $("#btnExpandMap"),
    btnSettings: $("#btnSettings"),
    btnCategoryBreakdown: $("#btnCategoryBreakdown"),
    btnNotifications: $("#btnNotifications"),
  };

  // ========= 3) State =========
  const state = {
    selectedYear: 2024,
    searchQuery: "",
  };

  // ========= 4) Init =========
  function init() {
    // Safety guard
    if (!els.yearSelect || !els.recentBody || !els.categoryList) return;

    // Year select default
    state.selectedYear = parseInt(els.yearSelect.value, 10) || 2024;

    // Basic location (ambil dari report terbaru yang punya location)
    const loc = latestLocation(REPORTS);
    if (loc && els.villageName && els.villageArea) {
      els.villageName.textContent = loc.village;
      els.villageArea.textContent = loc.area;
    }

    bindEvents();
    renderAll();
  }

  function bindEvents() {
    els.yearSelect.addEventListener("change", () => {
      state.selectedYear = parseInt(els.yearSelect.value, 10) || 2024;
      renderTrend();
      renderKpis();
      renderCategories();
      renderRecentReports(); // supaya konsisten dengan filter tahun jika perlu
    });

    els.searchInput.addEventListener("input", () => {
      state.searchQuery = (els.searchInput.value || "").trim();
      renderRecentReports();
    });

    els.btnExport.addEventListener("click", () => {
      exportData(REPORTS);
    });

    // Tombol yang ada: kita beri aksi minimal non-UI (alert) tanpa mengubah desain.
    els.btnExpandMap?.addEventListener("click", () => {
      alert("Map expand placeholder. Hubungkan ke halaman peta / modal map ketika backend siap.");
    });

    els.btnSettings?.addEventListener("click", () => {
      alert("Settings placeholder. Nanti bisa isi: dark mode toggle, profile, API endpoint, dsb.");
    });

    els.btnCategoryBreakdown?.addEventListener("click", () => {
      alert("Category breakdown placeholder. Nanti bisa diarahkan ke halaman analitik kategori.");
    });

    els.btnNotifications?.addEventListener("click", () => {
      const urgent = REPORTS.filter((r) => r.status === "Urgent").length;
      const pending = REPORTS.filter((r) => r.status === "Pending").length;
      alert(`Notifications:\n- Urgent: ${urgent}\n- Pending: ${pending}`);
    });
  }

  function renderAll() {
    renderTrend();
    renderKpis();
    renderCategories();
    renderRecentReports();
    renderNotifications();
  }

  // ========= 5) Rendering =========

  function renderKpis() {
    const y = state.selectedYear;

    // Definisi "bulan ini" untuk KPI: ambil bulan terbaru yang ada di tahun tersebut.
    const allInYear = REPORTS.filter((r) => yearOf(r.createdAt) === y);
    const { latestMonth, previousMonth } = findLatestMonthPair(allInYear);

    const monthNow = allInYear.filter((r) => monthOf(r.createdAt) === latestMonth);
    const monthPrev = allInYear.filter((r) => monthOf(r.createdAt) === previousMonth);

    // Total
    const totalNow = monthNow.length;
    const totalPrev = monthPrev.length;

    // Pending tasks = Pending + Urgent + In Progress (anggap butuh tindakan)
    const pendingNow = monthNow.filter((r) =>
      ["Pending", "Urgent", "In Progress"].includes(r.status)
    ).length;
    const pendingPrev = monthPrev.filter((r) =>
      ["Pending", "Urgent", "In Progress"].includes(r.status)
    ).length;

    // Resolved
    const resolvedNow = monthNow.filter((r) => r.status === "Resolved").length;
    const resolvedPrev = monthPrev.filter((r) => r.status === "Resolved").length;

    // Avg response time (hari) - gunakan responseTimeDays (demo)
    const avgRespNow = average(monthNow.map((r) => r.responseTimeDays).filter(isFiniteNumber));
    const avgRespPrev = average(monthPrev.map((r) => r.responseTimeDays).filter(isFiniteNumber));

    // Success rate = resolved / total
    const successRate = totalNow > 0 ? (resolvedNow / totalNow) * 100 : 0;

    // Update DOM
    setText(els.kpiTotalValue, formatInt(totalNow));
    setText(els.kpiTotalNote, `vs ${formatInt(totalPrev)} last month`);
    setDeltaBadge(els.kpiTotalDelta, pctChange(totalPrev, totalNow));

    setText(els.kpiPendingValue, formatInt(pendingNow));
    setText(els.kpiPendingNote, pendingNow > 0 ? "Critical urgency level" : "No pending tasks");
    setDeltaBadge(els.kpiPendingDelta, pctChange(pendingPrev, pendingNow), { invertColor: false });

    setText(els.kpiResolvedValue, formatInt(resolvedNow));
    setText(els.kpiResolvedNote, `${successRate.toFixed(1)}% success rate`);
    setDeltaBadge(els.kpiResolvedDelta, pctChange(resolvedPrev, resolvedNow));

    const avgText = `${(avgRespNow || 0).toFixed(1)} Days`;
    setText(els.kpiRespValue, avgText);

    const prevText = (avgRespPrev || 0).toFixed(1);
    setText(els.kpiRespNote, `Improved from ${prevText} days`);

    // Untuk response time: lebih kecil lebih baik → delta positif kalau turun.
    const respDelta = pctChange(avgRespPrev || 0, avgRespNow || 0);
    // invert = true artinya nilai turun dianggap "baik"
    setDeltaBadge(els.kpiRespDelta, respDelta, { invertColor: true });
  }

  function renderTrend() {
    const y = state.selectedYear;

    // Ambil 6 bulan terakhir yang tersedia pada tahun itu, fallback Jan-Jun
    const monthlyCounts = countReportsByMonth(REPORTS, y); // array 12
    const { months, values } = lastNMonthsWithValues(monthlyCounts, 6);

    // Render labels
    els.trendMonths.innerHTML = months
      .map((m) => `<span>${monthLabel(m)}</span>`)
      .join("");

    // Build SVG paths in 0..100 x 0..40 coordinate
    // y=40 bottom, y kecil ke atas
    const maxVal = Math.max(1, ...values);
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const yCoord = 35 - (v / maxVal) * 30; // 35..5
      return { x: round2(x), y: round2(yCoord) };
    });

    const lineD = svgSmoothPath(points);
    const areaD = `${lineD} L100 40 L0 40 Z`;

    els.trendLine.setAttribute("d", lineD);
    els.trendArea.setAttribute("d", areaD);
  }

  function renderCategories() {
    const y = state.selectedYear;

    const reportsInYear = REPORTS.filter((r) => yearOf(r.createdAt) === y);
    const byCat = groupCount(reportsInYear, (r) => normalizeCategory(r.category));

    // Convert to sorted array
    const entries = Object.entries(byCat)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const total = entries.reduce((s, e) => s + e.count, 0) || 1;

    // Render exactly like your UI bars (tanpa ubah layout)
    els.categoryList.innerHTML = entries
      .map((e, idx) => {
        const pct = Math.round((e.count / total) * 100);
        const barClass = categoryBarClass(idx, e.name);
        return `
          <div class="space-y-2">
            <div class="flex justify-between text-xs font-bold uppercase tracking-wider">
              <span>${escapeHtml(e.name)}</span>
              <span>${pct}%</span>
            </div>
            <div class="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full ${barClass} rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderRecentReports() {
    // Filter by year + search
    let list = REPORTS.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Optional: hanya tampilkan tahun terpilih agar nyambung dengan dashboard
    list = list.filter((r) => yearOf(r.createdAt) === state.selectedYear);

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter((r) => {
        return (
          (r.title || "").toLowerCase().includes(q) ||
          (r.reporter || "").toLowerCase().includes(q) ||
          (r.category || "").toLowerCase().includes(q) ||
          (r.status || "").toLowerCase().includes(q) ||
          (r.id || "").toLowerCase().includes(q)
        );
      });
    }

    // Tampilkan 8 terbaru (biar rapih)
    const shown = list.slice(0, 8);

    els.recentBody.innerHTML = shown
      .map((r) => {
        const statusPill = statusBadge(r.status);
        const when = relativeTimeFromNow(r.createdAt);
        return `
          <tr>
            <td class="px-6 py-4">
              <p class="font-bold truncate max-w-[200px]">${escapeHtml(r.title)}</p>
              <p class="text-xs text-slate-500">${escapeHtml(shortCategory(r.category))}</p>
            </td>
            <td class="px-6 py-4">${escapeHtml(r.reporter)}</td>
            <td class="px-6 py-4">
              ${statusPill}
            </td>
            <td class="px-6 py-4 text-xs text-slate-500">${escapeHtml(when)}</td>
          </tr>
        `;
      })
      .join("");

    if (shown.length === 0) {
      els.recentBody.innerHTML = `
        <tr>
          <td class="px-6 py-6 text-sm text-slate-500" colspan="4">
            No reports found for the selected filters.
          </td>
        </tr>
      `;
    }
  }

  function renderNotifications() {
    const hasAlerts = REPORTS.some((r) => r.status === "Urgent" || r.status === "Pending");
    if (els.notifDot) {
      els.notifDot.style.display = hasAlerts ? "block" : "none";
    }
  }

  // ========= 6) Export =========
  function exportData(allReports) {
    // Export 2 file: CSV + JSON
    const safe = allReports.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      reporter: r.reporter,
      status: r.status,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt || "",
      responseTimeDays: r.responseTimeDays,
      priority: r.priority,
      village: r.location?.village || "",
      area: r.location?.area || "",
    }));

    // JSON
    downloadBlob(
      new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" }),
      `lapor-pak-kuwu-reports.json`
    );

    // CSV
    const csv = toCSV(safe);
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `lapor-pak-kuwu-reports.csv`
    );
  }

  // ========= 7) Utilities =========

  function seedHistoricalReports(year, monthStart, monthEnd, totalCount) {
    // Membagi totalCount secara pseudo-random ke range bulan.
    const cats = [
      "Infrastructure",
      "Waste Management",
      "Public Security",
      "Public Service",
      "Environment",
      "Others",
    ];
    const statuses = ["Resolved", "Pending", "In Progress"];
    const names = ["Andi", "Budi", "Siti", "Rina", "Dewi", "Agus", "Bayu", "Tono", "Wati"];

    const months = [];
    for (let m = monthStart; m <= monthEnd; m++) months.push(m);

    const weights = months.map((m, idx) => 1 + idx * 0.25); // trend naik sedikit
    const sumW = weights.reduce((a, b) => a + b, 0);

    const perMonth = months.map((m, idx) => Math.round((weights[idx] / sumW) * totalCount));
    // adjust rounding difference
    let diff = totalCount - perMonth.reduce((a, b) => a + b, 0);
    for (let i = 0; diff !== 0 && i < perMonth.length; i++) {
      perMonth[i] += diff > 0 ? 1 : -1;
      diff += diff > 0 ? -1 : 1;
    }

    const out = [];
    let seq = 10000 + Math.floor(Math.random() * 9999);

    months.forEach((m, idx) => {
      const count = perMonth[idx];
      for (let i = 0; i < count; i++) {
        const day = 1 + Math.floor(Math.random() * 27);
        const hour = Math.floor(Math.random() * 23);
        const min = Math.floor(Math.random() * 59);
        const createdAt = new Date(Date.UTC(year, m - 1, day, hour, min, 0)).toISOString();

        const status = pickWeighted(statuses, [0.75, 0.12, 0.13]);
        const responseTimeDays =
          status === "Resolved"
            ? round2(0.5 + Math.random() * 2.2)
            : round2(0.2 + Math.random() * 3.5);

        const resolvedAt =
          status === "Resolved"
            ? new Date(Date.parse(createdAt) + responseTimeDays * 86400000).toISOString()
            : null;

        const cat = pickWeighted(cats, [0.42, 0.28, 0.12, 0.08, 0.06, 0.04]);

        out.push({
          id: `RPT-${seq++}`,
          title: `${cat} issue #${i + 1}`,
          category: cat,
          reporter: `${names[Math.floor(Math.random() * names.length)]} ${
            names[Math.floor(Math.random() * names.length)]
          }`,
          status,
          createdAt,
          resolvedAt,
          responseTimeDays,
          location: { village: "Desa Maju Jaya", area: "Kecamatan Sukamakmur" },
          priority: status === "Pending" ? "High" : "Normal",
        });
      }
    });

    return out;
  }

  function findLatestMonthPair(reportsInYear) {
    if (!reportsInYear.length) return { latestMonth: 1, previousMonth: 12 };

    const months = [...new Set(reportsInYear.map((r) => monthOf(r.createdAt)))].sort((a, b) => a - b);
    const latestMonth = months[months.length - 1] || 1;

    // previous month: cari month yang < latestMonth, kalau ga ada pakai latestMonth (delta 0)
    const prevCandidates = months.filter((m) => m < latestMonth);
    const previousMonth = prevCandidates.length ? prevCandidates[prevCandidates.length - 1] : latestMonth;

    return { latestMonth, previousMonth };
  }

  function countReportsByMonth(reports, year) {
    const arr = new Array(12).fill(0);
    reports.forEach((r) => {
      if (yearOf(r.createdAt) !== year) return;
      const m = monthOf(r.createdAt);
      if (m >= 1 && m <= 12) arr[m - 1] += 1;
    });
    return arr;
  }

  function lastNMonthsWithValues(monthlyCounts, n) {
    // monthlyCounts = 12 array. cari bulan terakhir yang ada data, fallback 6 pertama.
    const lastIndex = (() => {
      for (let i = 11; i >= 0; i--) {
        if (monthlyCounts[i] > 0) return i;
      }
      return 5;
    })();

    const start = Math.max(0, lastIndex - (n - 1));
    const months = [];
    const values = [];
    for (let i = start; i <= lastIndex; i++) {
      months.push(i + 1);
      values.push(monthlyCounts[i]);
    }

    // kalau kurang dari n (misal data minim), pad kiri dengan bulan sebelumnya
    while (months.length < n) {
      const first = months[0] || 1;
      const prev = first > 1 ? first - 1 : 1;
      months.unshift(prev);
      values.unshift(monthlyCounts[prev - 1] || 0);
    }

    return { months, values };
  }

  function svgSmoothPath(points) {
    // Simple smooth-ish path: pakai quadratic bezier midpoints
    if (!points.length) return "";
    if (points.length === 1) return `M${points[0].x} ${points[0].y}`;

    let d = `M${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const midX = (prev.x + cur.x) / 2;
      const midY = (prev.y + cur.y) / 2;
      d += ` Q${prev.x} ${prev.y} ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    d += ` T${last.x} ${last.y}`;
    return d;
  }

  function statusBadge(status) {
    // match gaya pill kamu (warna tailwind sama)
    const s = String(status || "");
    if (s === "Resolved") {
      return `<span class="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold rounded uppercase">Resolved</span>`;
    }
    if (s === "Pending") {
      return `<span class="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold rounded uppercase">Pending</span>`;
    }
    if (s === "Urgent") {
      return `<span class="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded uppercase">Urgent</span>`;
    }
    // In Progress default
    return `<span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded uppercase">In Progress</span>`;
  }

  function setDeltaBadge(el, valuePct, opts = {}) {
    if (!el) return;

    const invertColor = !!opts.invertColor;

    // valuePct: number, bisa negative/positive
    // tampil: +12.3% atau -4.2%
    const display = `${valuePct >= 0 ? "+" : ""}${valuePct.toFixed(1)}%`;
    el.textContent = display;

    // color rules:
    // - normal KPI: positive = green, negative = red
    // - invert KPI (response time): negative (turun) = green, positive (naik) = red
    const isGood = invertColor ? valuePct <= 0 : valuePct >= 0;

    el.classList.remove(
      "text-green-500",
      "bg-green-50",
      "dark:bg-green-900/20",
      "text-red-500",
      "bg-red-50",
      "dark:bg-red-900/20"
    );

    if (isGood) {
      el.classList.add("text-green-500", "bg-green-50", "dark:bg-green-900/20");
    } else {
      el.classList.add("text-red-500", "bg-red-50", "dark:bg-red-900/20");
    }
  }

  function pctChange(prev, now) {
    // handle prev=0
    if (!isFiniteNumber(prev) || prev === 0) {
      if (!isFiniteNumber(now) || now === 0) return 0;
      return 100;
    }
    return ((now - prev) / prev) * 100;
  }

  function groupCount(list, keyFn) {
    const out = Object.create(null);
    list.forEach((x) => {
      const k = keyFn(x);
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  function normalizeCategory(c) {
    const s = String(c || "").trim();
    return s || "Others";
  }

  function shortCategory(c) {
    // biar mirip contoh kamu (“Waste Mgmt”)
    const s = String(c || "");
    if (s.toLowerCase() === "waste management") return "Waste Mgmt";
    return s;
  }

  function categoryBarClass(idx, name) {
    // Menjaga feel sama seperti mock kamu (primary, green, red, slate)
    const n = String(name || "").toLowerCase();
    if (n.includes("infrastructure")) return "bg-primary";
    if (n.includes("waste")) return "bg-green-500";
    if (n.includes("security")) return "bg-red-500";
    if (idx === 0) return "bg-primary";
    if (idx === 1) return "bg-green-500";
    if (idx === 2) return "bg-red-500";
    return "bg-slate-400";
  }

  function monthLabel(m) {
    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return labels[m - 1] || "N/A";
  }

  function yearOf(iso) {
    return new Date(iso).getUTCFullYear();
  }

  function monthOf(iso) {
    return new Date(iso).getUTCMonth() + 1;
  }

  function average(nums) {
    if (!nums.length) return 0;
    const sum = nums.reduce((a, b) => a + b, 0);
    return sum / nums.length;
  }

  function isFiniteNumber(x) {
    return typeof x === "number" && Number.isFinite(x);
  }

  function formatInt(n) {
    const v = Number.isFinite(n) ? Math.round(n) : 0;
    return v.toLocaleString("en-US");
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = String(text);
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function latestLocation(reports) {
    const sorted = reports
      .filter((r) => r && r.location && r.location.village && r.location.area)
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted[0]?.location || null;
  }

  function relativeTimeFromNow(iso) {
    const now = Date.now();
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "—";

    const diffMs = now - t;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 0) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return "Yesterday";
    return `${diffDay}d ago`;
  }

  function pickWeighted(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    const r = Math.random() * total;
    let cum = 0;
    for (let i = 0; i < items.length; i++) {
      cum += weights[i] || 0;
      if (r <= cum) return items[i];
    }
    return items[items.length - 1];
  }

  function toCSV(rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const lines = [];
    lines.push(headers.map(csvCell).join(","));
    rows.forEach((r) => {
      lines.push(headers.map((h) => csvCell(r[h])).join(","));
    });
    return lines.join("\n");
  }

  function csvCell(v) {
    const s = String(v ?? "");
    // Escape double quotes by doubling them; wrap if contains comma/newline/quote
    const escaped = s.replaceAll('"', '""');
    if (/[",\n]/.test(escaped)) return `"${escaped}"`;
    return escaped;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ========= Start =========
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
