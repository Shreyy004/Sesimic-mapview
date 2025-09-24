import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import axios from "axios";

export default function MapView() {
  const [gridData, setGridData] = useState({ inlines: [], xlines: [] });
  const [boundary, setBoundary] = useState([]);
  const [surveyData, setSurveyData] = useState(null);

  useEffect(() => {
    axios.get("http://127.0.0.1:5000/grid-data").then((res) => setGridData(res.data));
    axios.get("http://127.0.0.1:5000/survey-boundary").then((res) => {
      setBoundary(res.data.boundary);
      setSurveyData(res.data);
    });
  }, []);

  // Build grid traces (inline blue, xline red)
  const inlineTraces = gridData.inlines.map((il) => ({
    x: il.points.map((p) => p[0]),
    y: il.points.map((p) => p[1]),
    mode: "lines",
    line: { color: "blue", width: 1 },
    hoverinfo: "text",
    text: il.points.map(
      (p) => `INLINE: ${il.inline}<br>X: ${p[0]}<br>Y: ${p[1]}`
    ),
    showlegend: false,
  }));

  const xlineTraces = gridData.xlines.map((xl) => ({
    x: xl.points.map((p) => p[0]),
    y: xl.points.map((p) => p[1]),
    mode: "lines",
    line: { color: "red", width: 1 },
    hoverinfo: "text",
    text: xl.points.map(
      (p) => `XLINE: ${xl.xline}<br>X: ${p[0]}<br>Y: ${p[1]}`
    ),
    showlegend: false,
  }));

  // Survey boundary trace
  const boundaryX = boundary.map((p) => p[0]);
  const boundaryY = boundary.map((p) => p[1]);

  const boundaryTrace = {
    x: [...boundaryX, boundaryX[0]],
    y: [...boundaryY, boundaryY[0]],
    mode: "lines+markers",
    line: { color: "green", width: 2 },
    marker: { size: 6, color: "green" },
    hoverinfo: "skip",
    showlegend: false,
  };

  // Compute extents
  const allX = [
    ...boundaryX,
    ...gridData.inlines.flatMap(il => il.points.map(p => p[0])),
    ...gridData.xlines.flatMap(xl => xl.points.map(p => p[0]))
  ];
  const allY = [
    ...boundaryY,
    ...gridData.inlines.flatMap(il => il.points.map(p => p[1])),
    ...gridData.xlines.flatMap(xl => xl.points.map(p => p[1]))
  ];

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  // Add padding for visualization
  const paddingX = (maxX - minX) * 0.05;
  const paddingY = (maxY - minY) * 0.05;
  const plotMinX = minX - paddingX;
  const plotMaxX = maxX + paddingX;
  const plotMinY = minY - paddingY;
  const plotMaxY = maxY + paddingY;

  // Outer grid coordinates and axis labels (all in white)
  const numTicks = 7;
  const xStep = (maxX - minX) / (numTicks - 1);
  const yStep = (maxY - minY) / (numTicks - 1);

  const xTicks = Array.from({length: numTicks}, (_, i) => Math.round(minX + i * xStep));
  const yTicks = Array.from({length: numTicks}, (_, i) => Math.round(minY + i * yStep));

  const gridAnnotations = [
    ...xTicks.map(val => ({
      x: val,
      y: maxY,
      text: val.toString(),
      showarrow: false,
      font: { color: "white", size: 13, family: "Arial" },
      yshift: 30,
      xanchor: "center"
    })),
    ...xTicks.map(val => ({
      x: val,
      y: minY,
      text: val.toString(),
      showarrow: false,
      font: { color: "white", size: 13, family: "Arial" },
      yshift: -30,
      xanchor: "center"
    })),
    ...yTicks.map(val => ({
      x: minX,
      y: val,
      text: val.toString(),
      showarrow: false,
      font: { color: "white", size: 13, family: "Arial" },
      xshift: -50,
      yanchor: "middle"
    })),
    ...yTicks.map(val => ({
      x: maxX,
      y: val,
      text: val.toString(),
      showarrow: false,
      font: { color: "white", size: 13, family: "Arial" },
      xshift: 50,
      yanchor: "middle"
    })),
    {
      x: (minX + maxX) / 2,
      y: maxY,
      text: "X-axis",
      showarrow: false,
      font: { color: "white", size: 15, family: "Arial" },
      yshift: 55,
      xanchor: "center"
    },
    {
      x: (minX + maxX) / 2,
      y: minY,
      text: "X-axis",
      showarrow: false,
      font: { color: "white", size: 15, family: "Arial" },
      yshift: -55,
      xanchor: "center"
    },
    {
      x: minX,
      y: (minY + maxY) / 2,
      text: "Y-axis",
      showarrow: false,
      font: { color: "white", size: 15, family: "Arial" },
      xshift: -75,
      yanchor: "middle",
      textangle: -90
    },
    {
      x: maxX,
      y: (minY + maxY) / 2,
      text: "Y-axis",
      showarrow: false,
      font: { color: "white", size: 15, family: "Arial" },
      xshift: 75,
      yanchor: "middle",
      textangle: -90
    }
  ];

  // --- IL/XL label annotation functions ---
  function getEdges(boundary) {
    const edges = [];
    for (let i = 0; i < boundary.length - 1; i++) {
      edges.push([boundary[i], boundary[i + 1]]);
    }
    return edges;
  }

  function normalOffset(edge, magnitude = 28) {
    const [x1, y1] = edge[0];
    const [x2, y2] = edge[1];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    let nx = -dy / len, ny = dx / len;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const dot = (mx - cx) * nx + (my - cy) * ny;
    if (dot < 0) { nx = -nx; ny = -ny; }
    return [nx * magnitude, ny * magnitude];
  }

  let boundaryAnnotations = [];
  if (surveyData && boundary.length > 0 && surveyData.iline_cood && surveyData.xline_cood) {
    const edges = getEdges(boundary);
    for (let i = 0; i < surveyData.iline_cood.length; i++) {
      const [x, y] = boundary[i];
      const prevEdge = edges[(i - 1 + edges.length) % edges.length];
      const edge = edges[i % edges.length];
      const [nx1, ny1] = normalOffset(prevEdge, 32);
      const [nx2, ny2] = normalOffset(edge, 32);
      const nx = (nx1 + nx2) / 2, ny = (ny1 + ny2) / 2;
      boundaryAnnotations.push({
        x: x + nx, y: y + ny + 13,
        text: `IL${surveyData.iline_cood[i]}`,
        showarrow: false,
        font: { color: "blue", size: 13, family: "Arial" },
        xanchor: "center", yanchor: "middle",
        bgcolor: "rgba(0,0,0,0.95)",
        bordercolor: "blue", borderwidth: 1, borderpad: 3,
      });
      boundaryAnnotations.push({
        x: x + nx, y: y + ny - 13,
        text: `XL${surveyData.xline_cood[i]}`,
        showarrow: false,
        font: { color: "red", size: 13, family: "Arial" },
        xanchor: "center", yanchor: "middle",
        bgcolor: "rgba(0,0,0,0.95)",
        bordercolor: "red", borderwidth: 1, borderpad: 3,
      });
    }
  }

  // IL/XL along boundary edges (IL blue, XL red)
  const edges = getEdges(boundary);
  let edgeLabelAnnotations = [];
  if (gridData.inlines.length > 0 && gridData.xlines.length > 0) {
    edges.forEach((edge, edgeIdx) => {
      const isVertical = Math.abs(edge[0][0] - edge[1][0]) < Math.abs(edge[0][1] - edge[1][1]);
      let labels;
      if (isVertical) {
        const edgeX = (edge[0][0] + edge[1][0]) / 2;
        labels = gridData.xlines.filter(xl =>
          xl.points.some(pt =>
            Math.abs(pt[0] - edgeX) < (Math.abs(edge[0][0] - edge[1][0]) / 10 + 10)
          )
        ).map(xl => ({ num: xl.xline, type: "XL" }));
      } else {
        const edgeY = (edge[0][1] + edge[1][1]) / 2;
        labels = gridData.inlines.filter(il =>
          il.points.some(pt =>
            Math.abs(pt[1] - edgeY) < (Math.abs(edge[0][1] - edge[1][1]) / 10 + 10)
          )
        ).map(il => ({ num: il.inline, type: "IL" }));
      }
      const labelCount = Math.min(labels.length, 4);
      for (let i = 1; i <= labelCount; ++i) {
        const t = i / (labelCount + 1);
        const lx = edge[0][0] + t * (edge[1][0] - edge[0][0]);
        const ly = edge[0][1] + t * (edge[1][1] - edge[0][1]);
        const [nx, ny] = normalOffset(edge, 28);
        const label = labels[Math.floor((i - 1) * labels.length / labelCount)];
        const labelColor = label.type === "IL" ? "blue" : "red";
        edgeLabelAnnotations.push({
          x: lx + nx,
          y: ly + ny,
          text: `${label.type}${label.num}`,
          showarrow: false,
          font: { color: labelColor, size: 13, family: "Arial" },
          xanchor: "center",
          yanchor: "middle",
          bgcolor: "rgba(0,0,0,0.95)",
          bordercolor: labelColor, borderwidth: 1, borderpad: 3,
        });
      }
    });
  }

  // Compose all annotations in the required order
  const annotations = [
    {
      xref: "paper", yref: "paper",
      x: 0.96, y: 0.96,
      text: "↑<br>N",
      showarrow: false,
      font: { color: "lime", size: 17 },
      bgcolor: "rgba(0,0,0,0.8)",
      bordercolor: "lime",
      borderwidth: 1,
    },
    ...gridAnnotations,
    ...boundaryAnnotations,
    ...edgeLabelAnnotations,
  ];

  return (
    <Plot
      data={[...inlineTraces, ...xlineTraces, boundaryTrace]}
      layout={{
        title: {
          text: "Seismic Map Viewer",
          font: { color: "white", size: 17 },
        },
        width: 1400,
        height: 750,
        paper_bgcolor: "black",
        plot_bgcolor: "black",
        font: { color: "white" },
        hoverlabel: { bgcolor: "black", font: { color: "white" } },
        xaxis: {
          title: "",
          showgrid: true,
          gridcolor: "rgba(128,128,128,0.35)",
          zeroline: false,
          tickformat: ",.0f",
          mirror: "allticks",
          range: [plotMinX, plotMaxX],
          constrain: "domain",
          automargin: true,
          showticklabels: false,
          ticks: ""
        },
        yaxis: {
          title: "",
          showgrid: true,
          gridcolor: "rgba(128,128,128,0.35)",
          zeroline: false,
          tickformat: ",.0f",
          mirror: "allticks",
          range: [plotMinY, plotMaxY],
          scaleanchor: "x",
          automargin: true,
          showticklabels: false,
          ticks: ""
        },
        shapes: [],
        annotations: annotations,
        margin: { l: 105, r: 105, t: 90, b: 90 },
        showlegend: false,
      }}
      config={{
        responsive: true,
        displayModeBar: true,
      }}
      style={{ width: "100%", height: "90vh" }}
    />
  );
}
