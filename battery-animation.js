(() => {
  const root = document.querySelector("[data-battery-demo]");
  const data = window.BATTERY_SOC_SOH_DATA;
  if (!root || !data) return;

  const ns = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs = {}, text = "") => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text) node.textContent = text;
    return node;
  };

  function animateChart(config) {
    const { svg, values, yForValue, tickLabels, xLabel, yLabel, yRange, clipId, duration, onFrame = () => {} } = config;
    const finalIndex = values.length - 1;
    let index = 0;
    let layout = null;
    let frame = 0;
    let startedAt = 0;

    function render() {
      if (!layout) return;
      const x = layout.xFor(index);
      layout.clipRect.setAttribute("width", Math.max(0, x - layout.left));
      layout.cursor.setAttribute("x1", x);
      layout.cursor.setAttribute("x2", x);
      layout.marker.setAttribute("cx", x);
      layout.marker.setAttribute("cy", layout.yFor(yForValue(values[index])));
      onFrame(values[index], index);
    }

    function build() {
      const width = Math.max(280, Math.round(svg.getBoundingClientRect().width));
      const height = 244;
      const left = 48;
      const right = width - 16;
      const top = 18;
      const bottom = height - 42;
      const plotWidth = right - left;
      const plotHeight = bottom - top;
      const yMin = yRange[0];
      const yMax = yRange[1];
      const xFor = (i) => left + (i / (finalIndex || 1)) * plotWidth;
      const yFor = (value) => top + ((yMax - value) / (yMax - yMin)) * plotHeight;

      svg.replaceChildren();
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.setAttribute("preserveAspectRatio", "none");
      const defs = svgEl("defs");
      const clip = svgEl("clipPath", { id: clipId });
      const clipRect = svgEl("rect", { x: left, y: top, width: 0, height: plotHeight });
      clip.append(clipRect);
      defs.append(clip);
      svg.append(defs);

      for (let step = 0; step <= 2; step += 1) {
        const value = yMin + ((yMax - yMin) * step) / 2;
        const y = yFor(value);
        svg.append(svgEl("line", { x1: left, y1: y, x2: right, y2: y, class: "battery-grid-line" }));
        svg.append(svgEl("text", { x: left - 8, y: y + 4, "text-anchor": "end", class: "battery-tick-label" }, `${value.toFixed(0)}%`));
      }
      svg.append(svgEl("line", { x1: left, y1: bottom, x2: right, y2: bottom, class: "battery-axis-line" }));
      tickLabels.forEach((tick) => {
        const x = xFor(tick.index);
        svg.append(svgEl("line", { x1: x, y1: bottom, x2: x, y2: bottom + 5, class: "battery-axis-line" }));
        svg.append(svgEl("text", { x, y: height - 17, "text-anchor": "middle", class: "battery-tick-label" }, tick.label));
      });
      svg.append(svgEl("text", { x: (left + right) / 2, y: height - 2, "text-anchor": "middle", class: "battery-axis-title" }, xLabel));
      svg.append(svgEl("text", { x: left, y: 12, class: "battery-axis-title" }, yLabel));

      let d = "";
      values.forEach((value, i) => {
        d += `${i === 0 ? "M" : "L"}${xFor(i).toFixed(2)},${yFor(yForValue(value)).toFixed(2)} `;
      });
      const trace = svgEl("path", { d, class: "battery-state-line", "clip-path": `url(#${clipId})` });
      const cursor = svgEl("line", { x1: left, y1: top, x2: left, y2: bottom, class: "battery-active-line" });
      const marker = svgEl("circle", { cx: left, cy: yFor(yForValue(values[0])), r: 4.5, class: "battery-state-marker" });
      svg.append(trace, cursor, marker);
      layout = { left, xFor, yFor, clipRect, cursor, marker };
      render();
    }

    function play(now) {
      if (!startedAt) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / duration);
      index = Math.min(finalIndex, Math.floor(progress * finalIndex));
      render();
      if (progress < 1) frame = requestAnimationFrame(play);
    }

    const observer = new ResizeObserver(build);
    observer.observe(svg);
    build();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      index = finalIndex;
      render();
    } else {
      frame = requestAnimationFrame(play);
    }
  }

  const socView = root.querySelector('[data-view="soc"]');
  const socValues = data.socSamples;
  const totalCapacityAh = socValues[socValues.length - 1][1];
  const socPct = (point) => Math.max(0, 100 * (1 - point[1] / totalCapacityAh));
  const socDurationHours = socValues[socValues.length - 1][0] / 3600;
  animateChart({
    svg: socView.querySelector(".battery-chart"),
    values: socValues,
    yForValue: socPct,
    yRange: [0, 100],
    clipId: "battery-soc-clip",
    xLabel: "Elapsed time in discharge segment (h)",
    yLabel: "Normalised SOC estimate",
    tickLabels: [{ index: 0, label: "0 h" }, { index: Math.round(socValues.length * (1 / socDurationHours)), label: "1 h" }, { index: socValues.length - 1, label: `${socDurationHours.toFixed(1)} h` }],
    duration: 19000,
    onFrame: (point) => {
      const pct = socPct(point);
      socView.querySelector(".battery-soc-value").textContent = `${Math.round(pct)}%`;
      socView.querySelector(".battery-icon-level").style.height = `${pct}%`;
      socView.querySelector(".battery-voltage-reading").textContent = `${point[2].toFixed(3)} V`;
      socView.querySelector(".battery-current-reading").textContent = `${point[3].toFixed(4)} A`;
      socView.querySelector(".battery-time").textContent = `${(point[0] / 3600).toFixed(2)} / ${socDurationHours.toFixed(2)} h`;
    },
  });

  const sohView = root.querySelector('[data-view="soh"]');
  const sohValues = data.sohCycles;
  animateChart({
    svg: sohView.querySelector(".battery-chart"),
    values: sohValues,
    yForValue: (point) => point.retentionPct,
    yRange: [96, 100],
    clipId: "battery-soh-clip",
    xLabel: "Completed cycle",
    yLabel: "Capacity retention",
    tickLabels: [{ index: 0, label: "1" }, { index: 4, label: "5" }, { index: sohValues.length - 1, label: String(sohValues.length) }],
    duration: 9000,
    onFrame: (point) => { sohView.querySelector(".battery-time").textContent = `Cycle ${point.cycle} / ${sohValues.length}`; },
  });
})();
