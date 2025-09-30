import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import axios from "axios";

export default function MapView() {
  const [gridData, setGridData] = useState({ inlines: [], xlines: [] });
  const [boundary, setBoundary] = useState([]);
  const [surveyData, setSurveyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        const gridResponse = await axios.get("http://127.0.0.1:5000/grid-data-all");
        setGridData(gridResponse.data);
        
        const boundaryResponse = await axios.get("http://127.0.0.1:5000/survey-boundary");
        setBoundary(boundaryResponse.data.boundary);
        setSurveyData(boundaryResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '90vh',
        color: 'white',
        backgroundColor: 'black',
        fontSize: '18px'
      }}>
        Loading seismic survey data...
      </div>
    );
  }

  // Build grid traces with enhanced colors and hover info
  const inlineTraces = gridData.inlines.map((il) => {
    const x = il.points.map(p => p[0]);
    const y = il.points.map(p => p[1]);
    
    // Cyan color for inlines (contrasts well with red)
    return {
      x: x,
      y: y,
      mode: "lines",
      line: { 
        color: "#00FFFF", // Bright cyan
        width: 1,
        opacity: 0.8
      },
      hoverinfo: "text",
      text: il.hover_info,
      showlegend: false,
      name: `IL${il.inline}`,
      hovertemplate: '<b>%{text}</b><extra></extra>',
      hoverlabel: {
        bgcolor: "black",
        bordercolor: "#00FFFF",
        font: { color: "white", size: 12 }
      }
    };
  });

  const xlineTraces = gridData.xlines.map((xl) => {
    const x = xl.points.map(p => p[0]);
    const y = xl.points.map(p => p[1]);
    
    // Red color for xlines
    return {
      x: x,
      y: y,
      mode: "lines",
      line: { 
        color: "red", // Red
        width: 1,
        opacity: 0.8
      },
      hoverinfo: "text",
      text: xl.hover_info,
      showlegend: false,
      name: `XL${xl.xline}`,
      hovertemplate: '<b>%{text}</b><extra></extra>',
      hoverlabel: {
        bgcolor: "black",
        bordercolor: "red",
        font: { color: "white", size: 12 }
      }
    };
  });

  // Survey boundary trace
  const boundaryX = boundary.map((p) => p[0]);
  const boundaryY = boundary.map((p) => p[1]);

  const boundaryTrace = {
    x: [...boundaryX, boundaryX[0]],
    y: [...boundaryY, boundaryY[0]],
    mode: "lines+markers",
    line: { color: "#00FF00", width: 3 }, // Bright green
    marker: { size: 8, color: "#00FF00" },
    hoverinfo: "skip",
    showlegend: false,
    name: "Survey Boundary"
  };

  // Compute extents from boundary
  const minX = Math.min(...boundaryX);
  const maxX = Math.max(...boundaryX);
  const minY = Math.min(...boundaryY);
  const maxY = Math.max(...boundaryY);

  // Add padding for visualization
  const paddingX = (maxX - minX) * 0.05;
  const paddingY = (maxY - minY) * 0.05;
  const plotMinX = minX - paddingX;
  const plotMaxX = maxX + paddingX;
  const plotMinY = minY - paddingY;
  const plotMaxY = maxY + paddingY;

  // Outer grid coordinates and axis labels 
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
        font: { color: "#00FFFF", size: 13, family: "Arial", weight: "bold" },
        xanchor: "center", yanchor: "middle",
        bgcolor: "rgba(0,0,0,0.95)",
        bordercolor: "#00FFFF", borderwidth: 2, borderpad: 3,
      });
      boundaryAnnotations.push({
        x: x + nx, y: y + ny - 13,
        text: `XL${surveyData.xline_cood[i]}`,
        showarrow: false,
        font: { color: "red", size: 13, family: "Arial", weight: "bold" },
        xanchor: "center", yanchor: "middle",
        bgcolor: "rgba(0,0,0,0.95)",
        bordercolor: "red", borderwidth: 2, borderpad: 3,
      });
    }
  }

  // IL/XL along boundary edges (IL cyan, XL red)
  const edges = getEdges(boundary);
  let edgeLabelAnnotations = [];
  if (gridData.inlines.length > 0 && gridData.xlines.length > 0) {
    edges.forEach((edge, edgeIdx) => {
      const isVertical = Math.abs(edge[0][0] - edge[1][0]) < Math.abs(edge[0][1] - edge[1][1]);
      let labels;
      if (isVertical) {
        const edgeX = (edge[0][0] + edge[1][0]) / 2;
        // Sample a few xlines for this edge
        const sampleSize = Math.min(4, gridData.xlines.length);
        const step = Math.max(1, Math.floor(gridData.xlines.length / sampleSize));
        labels = gridData.xlines
          .filter((_, index) => index % step === 0)
          .slice(0, sampleSize)
          .map(xl => ({ num: xl.xline, type: "XL" }));
      } else {
        const edgeY = (edge[0][1] + edge[1][1]) / 2;
        // Sample a few inlines for this edge
        const sampleSize = Math.min(4, gridData.inlines.length);
        const step = Math.max(1, Math.floor(gridData.inlines.length / sampleSize));
        labels = gridData.inlines
          .filter((_, index) => index % step === 0)
          .slice(0, sampleSize)
          .map(il => ({ num: il.inline, type: "IL" }));
      }
      
      const labelCount = Math.min(labels.length, 4);
      for (let i = 1; i <= labelCount; ++i) {
        const t = i / (labelCount + 1);
        const lx = edge[0][0] + t * (edge[1][0] - edge[0][0]);
        const ly = edge[0][1] + t * (edge[1][1] - edge[0][1]);
        const [nx, ny] = normalOffset(edge, 28);
        const label = labels[Math.floor((i - 1) * labels.length / labelCount)];
        const labelColor = label.type === "IL" ? "#00FFFF" : "red";
        edgeLabelAnnotations.push({
          x: lx + nx,
          y: ly + ny,
          text: `${label.type}${label.num}`,
          showarrow: false,
          font: { color: labelColor, size: 13, family: "Arial", weight: "bold" },
          xanchor: "center",
          yanchor: "middle",
          bgcolor: "rgba(0,0,0,0.95)",
          bordercolor: labelColor, borderwidth: 2, borderpad: 3,
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
      font: { color: "lime", size: 17, weight: "bold" },
      bgcolor: "rgba(0,0,0,0.8)",
      bordercolor: "lime",
      borderwidth: 2,
    },
    ...gridAnnotations,
    ...boundaryAnnotations,
    ...edgeLabelAnnotations,
  ];

  return (
    <div>
      <div style={{ 
        color: 'white', 
        backgroundColor: 'black', 
        padding: '10px',
        fontSize: '14px',
        textAlign: 'center'
      }}>
        Displaying all {gridData.total_inlines} inlines and {gridData.total_xlines} xlines
      </div>
      <Plot
        data={[...inlineTraces, ...xlineTraces, boundaryTrace]}
        layout={{
          title: {
            text: "Seismic Map Viewer - All Inlines & Xlines",
            font: { color: "white", size: 17 },
          },
          width: 1400,
          height: 750,
          paper_bgcolor: "black",
          plot_bgcolor: "black",
          font: { color: "white" },
          hoverlabel: { 
            bgcolor: "black", 
            bordercolor: "white",
            font: { color: "white", size: 12 },
            align: "left"
          },
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
          displaylogo: false,
          modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
          toImageButtonOptions: {
            format: 'png',
            filename: 'seismic_survey_map',
          }
        }}
        style={{ width: "100%", height: "90vh" }}
      />
      <div style={{ 
        color: 'white', 
        backgroundColor: 'black', 
        padding: '10px',
        fontSize: '12px',
        textAlign: 'center'
      }}>
        <span style={{ color: '#00FFFF', marginRight: '20px' }}>■ Inlines (IL)</span>
        <span style={{ color: 'red', marginRight: '20px' }}>■ Crosslines (XL)</span>
        <span style={{ color: '#00FF00' }}>■ Survey Boundary</span>
      </div>
    </div>
  );
}
