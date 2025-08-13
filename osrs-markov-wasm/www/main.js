import init, {
  weapon_and_thrall_kill_times,
  distribution_of_hits_to_kill
} from "./pkg/osrs_markov_wasm.js";

const el = (id) => document.getElementById(id);

function plotTicks(x, y) {
  const trace = {
    x,
    y,
    mode: "lines+markers",
    name: "P(dead) by tick",
    hovertemplate: "Tick %{x}<br>P(dead) %{y:.6f}<extra></extra>"
  };
  const layout = {
    paper_bgcolor: "#111",
    plot_bgcolor: "#111",
    font: { color: "#eaeaea" },
    margin: { l: 50, r: 20, t: 10, b: 40 },
    xaxis: { title: "Tick", gridcolor: "#303030", zerolinecolor: "#303030" },
    yaxis: { title: "P(dead)", gridcolor: "#303030", zerolinecolor: "#303030", range: [0, 1] }
  };
  Plotly.newPlot("tick-chart", [trace], layout, { displayModeBar: false, responsive: true });
}

function plotHits(x, y) {
  const trace = {
    x,
    y,
    mode: "lines+markers",
    name: "P(dead) after N hits",
    hovertemplate: "Hits %{x}<br>P(dead) %{y:.6f}<extra></extra>"
  };
  const layout = {
    paper_bgcolor: "#1b1b1b",
    plot_bgcolor: "#1b1b1b",
    font: { color: "#eaeaea" },
    margin: { l: 50, r: 20, t: 10, b: 40 },
    xaxis: { title: "Hits", gridcolor: "#303030", zerolinecolor: "#303030" },
    yaxis: { title: "P(dead)", gridcolor: "#303030", zerolinecolor: "#303030", range: [0, 1] }
  };
  Plotly.newPlot("hits-chart", [trace], layout, { displayModeBar: false, responsive: true });
}

function summarize(ticks) {
  const capIndex = ticks.findIndex((p) => p >= Math.max(...ticks));
  const firstCross = ticks.findIndex((p) => p >= parseFloat(el("cap").value));
  const p95 = ticks.findIndex((p) => p >= 0.95);
  const p99 = ticks.findIndex((p) => p >= 0.99);

  const fmt = (n) => (n >= 0 ? (n + 1).toString() : "—"); // ticks are 1-based in your printout
  return [
    `Ticks generated: ${ticks.length}`,
    `First tick where P(dead) ≥ cap: ${fmt(firstCross)}`,
    `Tick where P(dead) ≥ 95%: ${fmt(p95)}`,
    `Tick where P(dead) ≥ 99%: ${fmt(p99)}`
  ].join("\n");
}

async function runOnce() {
  const hp = parseInt(el("hp").value, 10);
  const maxhit = parseInt(el("maxhit").value, 10);
  const acc = parseFloat(el("acc").value);
  const cap = parseFloat(el("cap").value);

  // ticks curve
  const ticksArr = weapon_and_thrall_kill_times(hp, maxhit, acc, cap);
  const xTicks = ticksArr.map((_, i) => i + 1);
  plotTicks(xTicks, ticksArr);
  el("summary").textContent = summarize(ticksArr);

  // optional: hits curve (same params but without thrall timing)
  const hitsArr = distribution_of_hits_to_kill(hp, maxhit, acc, Math.min(0.999, Math.max(cap, 0.99)));
  const xHits = hitsArr.map((_, i) => i); // 0-based: after N hits
  plotHits(xHits, hitsArr);
}

(async () => {
  await init(); // load wasm

  // initial render with defaults from the form
  await runOnce();

  // re-run on button click
  el("run").addEventListener("click", () => runOnce());
})();
