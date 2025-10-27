import React, { useEffect, useState, useCallback, useMemo } from "react";
import Plot from "react-plotly.js";
import axios from "axios";

export default function MapView({
  onLineSelect,
  externalSelectedLine,
  seismicSectionData,
}) {
  const [gridData, setGridData] = useState({ inlines: [], xlines: [] });
  const [boundary, setBoundary] = useState([]);
  const [surveyData, setSurveyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLine, setSelectedLine] = useState(null);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [viewMode, setViewMode] = useState("both");
  const [currentLayout, setCurrentLayout] = useState(null);
  const [boundaryEdgeLines, setBoundaryEdgeLines] = useState(null);

  const lineDensity = 50;

  // Fetch boundary-edge-lines
  useEffect(() => {
    const fetchBoundaryEdgeLines = async () => {
      try {
        const response = await axios.get(
          "http://127.0.0.1:5000/boundary-edge-lines"
        );
        setBoundaryEdgeLines(response.data);
      } catch (err) {
        console.error("Error fetching boundary edge lines:", err);
        setBoundaryEdgeLines(null);
      }
    };
    fetchBoundaryEdgeLines();
  }, []);

  // Handle external selection from seismic section
  useEffect(() => {
    if (externalSelectedLine) {
      const newSelectedLine = {
        type: externalSelectedLine.lineType,
        number: externalSelectedLine.lineNumber.toString(),
        name: `${
          externalSelectedLine.lineType === "INLINE" ? "IL" : "XL"
        }${externalSelectedLine.lineNumber}`,
      };
      setSelectedLine(newSelectedLine);
    }
  }, [externalSelectedLine]);

  useEffect(() => {
    if (
      seismicSectionData &&
      seismicSectionData.lineNumber &&
      seismicSectionData.lineType
    ) {
      const externalLine = {
        type: seismicSectionData.lineType,
        number: seismicSectionData.lineNumber.toString(),
        name: `${
          seismicSectionData.lineType === "INLINE" ? "IL" : "XL"
        }${seismicSectionData.lineNumber}`,
      };
      setSelectedLine(externalLine);
    }
  }, [seismicSectionData]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const gridResponse = await axios.get(
          "http://127.0.0.1:5000/grid-data-all"
        );
        setGridData(gridResponse.data);
        const boundaryResponse = await axios.get(
          "http://127.0.0.1:5000/survey-boundary"
        );
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

  const handlePlotClick = useCallback(
    (event) => {
      if (event.points && event.points.length > 0) {
        const clickedPoint = event.points[0];
        const lineName = clickedPoint.data.name;
        if (lineName) {
          const lineType = lineName.startsWith("IL") ? "INLINE" : "XLINE";
          const lineNumber = lineName.replace("IL", "").replace("XL", "");
          const newSelectedLine = {
            type: lineType,
            number: lineNumber,
            name: lineName,
            data: clickedPoint.data,
            point: clickedPoint,
          };
          setSelectedLine(newSelectedLine);
          if (onLineSelect) {
            onLineSelect({
              lineType: lineType,
              lineNumber: parseInt(lineNumber),
              coordinates: {
                x: clickedPoint.x,
                y: clickedPoint.y,
              },
              fullData: newSelectedLine,
            });
          }
        }
      }
    },
    [onLineSelect]
  );

  const handlePlotHover = useCallback((event) => {
    if (event.points && event.points.length > 0) {
      const hoveredPoint = event.points[0];
      const lineName = hoveredPoint.data.name;
      if (lineName) {
        const lineType = lineName.startsWith("IL") ? "INLINE" : "XLINE";
        const lineNumber = lineName.replace("IL", "").replace("XL", "");
        setHoveredLine({
          type: lineType,
          number: lineNumber,
          name: lineName,
          coordinates: { x: hoveredPoint.x, y: hoveredPoint.y },
        });
      }
    } else {
      setHoveredLine(null);
    }
  }, []);

  const handlePlotUnhover = useCallback(() => {
    setHoveredLine(null);
  }, []);

  const handlePlotRelayout = useCallback((event) => {
    setCurrentLayout(event);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLine(null);
    if (onLineSelect) {
      onLineSelect(null);
    }
  }, [onLineSelect]);

  const filterLinesByDensity = useCallback(
    (lines, lineType) => {
      if (lineDensity <= 1) return lines;
      return lines.filter((line) => {
        const lineNumber = lineType === "inlines" ? line.inline : line.xline;
        return lineNumber % lineDensity === 0;
      });
    },
    [lineDensity]
  );

  const prepareTraces = useCallback(() => {
    const traces = [];
    const filteredInlines = filterLinesByDensity(gridData.inlines, "inlines");
    const filteredXlines = filterLinesByDensity(gridData.xlines, "xlines");

    if (viewMode === "both" || viewMode === "inlines") {
      filteredInlines.forEach((il) => {
        const isSelected =
          selectedLine &&
          selectedLine.type === "INLINE" &&
          parseInt(selectedLine.number) === il.inline;
        const isHovered =
          hoveredLine &&
          hoveredLine.type === "INLINE" &&
          parseInt(hoveredLine.number) === il.inline;
        let lineColor = "#00FFFF";
        let lineWidth = 2;
        if (isSelected) {
          lineColor = "#FFFFFF";
          lineWidth = 4;
        } else if (isHovered) {
          lineColor = "#FFFF00";
          lineWidth = 3;
        }
        traces.push({
          x: il.points.map((p) => p[0]),
          y: il.points.map((p) => p[1]),
          mode: "lines",
          type: "scatter",
          line: {
            color: lineColor,
            width: lineWidth,
          },
          name: `IL${il.inline}`,
          hoverinfo: "text",
          text: il.hover_info,
          hovertemplate: "<b>%{text}</b><extra></extra>",
          showlegend: false,
        });
      });
    }

    if (viewMode === "both" || viewMode === "xlines") {
      filteredXlines.forEach((xl) => {
        const isSelected =
          selectedLine &&
          selectedLine.type === "XLINE" &&
          parseInt(selectedLine.number) === xl.xline;
        const isHovered =
          hoveredLine &&
          hoveredLine.type === "XLINE" &&
          parseInt(hoveredLine.number) === xl.xline;
        let lineColor = "#FF69B4";
        let lineWidth = 2;
        if (isSelected) {
          lineColor = "#FFFFFF";
          lineWidth = 4;
        } else if (isHovered) {
          lineColor = "#FFFF00";
          lineWidth = 3;
        }
        traces.push({
          x: xl.points.map((p) => p[0]),
          y: xl.points.map((p) => p[1]),
          mode: "lines",
          type: "scatter",
          line: {
            color: lineColor,
            width: lineWidth,
          },
          name: `XL${xl.xline}`,
          hoverinfo: "text",
          text: xl.hover_info,
          hovertemplate: "<b>%{text}</b><extra></extra>",
          showlegend: false,
        });
      });
    }

    const boundaryX = boundary.map((p) => p[0]);
    const boundaryY = boundary.map((p) => p[1]);
    traces.push({
      x: [...boundaryX, boundaryX[0]],
      y: [...boundaryY, boundaryY[0]],
      mode: "lines+markers",
      type: "scatter",
      line: {
        color: "#00FF00",
        width: 3,
      },
      marker: {
        size: 6,
        color: "#00FF00",
      },
      hoverinfo: "skip",
      showlegend: false,
      name: "Survey Boundary",
    });

    return traces;
  }, [
    gridData,
    boundary,
    viewMode,
    selectedLine,
    hoveredLine,
    lineDensity,
    filterLinesByDensity,
  ]);

  // --- START: DYNAMIC COORDINATE LOGIC ---

  // 1. Calculate base ranges (only when boundary data changes)
  const { minX, maxX, minY, maxY, paddingX, paddingY } = useMemo(() => {
    const boundaryX = boundary.map((p) => p[0]);
    const boundaryY = boundary.map((p) => p[1]);
    const minX = boundaryX.length > 0 ? Math.min(...boundaryX) : 0;
    const maxX = boundaryX.length > 0 ? Math.max(...boundaryX) : 1000;
    const minY = boundaryY.length > 0 ? Math.min(...boundaryY) : 0;
    const maxY = boundaryY.length > 0 ? Math.max(...boundaryY) : 1000;
    const paddingX = (maxX - minX) * 0.05;
    const paddingY = (maxY - minY) * 0.05;
    return { minX, maxX, minY, maxY, paddingX, paddingY };
  }, [boundary]);

  // 2. Get current visible ranges (updates when layout state changes)
  const currentRanges = useMemo(() => {
    if (currentLayout) {
      if (
        currentLayout["xaxis.range[0]"] !== undefined &&
        currentLayout["xaxis.range[1]"] !== undefined
      ) {
        return {
          xrange: [
            currentLayout["xaxis.range[0]"],
            currentLayout["xaxis.range[1]"],
          ],
          yrange: [
            currentLayout["yaxis.range[0]"],
            currentLayout["yaxis.range[1]"],
          ],
        };
      } else if (currentLayout["xaxis.range"] !== undefined) {
        return {
          xrange: currentLayout["xaxis.range"],
          yrange: currentLayout["yaxis.range"],
        };
      }
    }
    // Default case
    return {
      xrange: [minX - paddingX, maxX + paddingX],
      yrange: [minY - paddingY, maxY + paddingY],
    };
  }, [currentLayout, minX, maxX, minY, maxY, paddingX, paddingY]);

  // 3. Memoize the boundary edge labels (your existing logic, just wrapped)
  const getBoundaryEdgeLabels = useMemo(() => {
    if (
      !boundaryEdgeLines ||
      !boundary ||
      boundary.length < 4 ||
      !gridData.inlines.length
    ) {
      return [];
    }

    const inlineMap = new Map(gridData.inlines.map((il) => [il.inline, il]));
    const xlineMap = new Map(gridData.xlines.map((xl) => [xl.xline, xl]));

    const edgeLabels = [];
    const labelOffset = 60;

    const getEdgeNormal = (p1, p2) => {
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const norm = Math.sqrt(dx * dx + dy * dy);
      return [-dy / norm, dx / norm];
    };

    const pointToLineDistance = (point, lineStart, lineEnd) => {
      const [x, y] = point;
      const [x1, y1] = lineStart;
      const [x2, y2] = lineEnd;
      const A = x - x1,
        B = y - y1,
        C = x2 - x1,
        D = y2 - y1;
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;
      let xx, yy;
      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }
      return Math.hypot(x - xx, y - yy);
    };

    for (let edgeIdx = 0; edgeIdx < 4; edgeIdx++) {
      const p1 = boundary[edgeIdx];
      const p2 = boundary[(edgeIdx + 1) % 4];
      const normal = getEdgeNormal(p1, p2);

      const allInlinesOnEdge = boundaryEdgeLines[edgeIdx]?.inlines || [];
      const displayedInlinesOnEdge = allInlinesOnEdge.filter(
        (lineNum) => lineNum % lineDensity === 0
      );

      displayedInlinesOnEdge.forEach((lineNum) => {
        const lineData = inlineMap.get(lineNum);
        if (!lineData || lineData.points.length < 2) return;

        const firstPoint = lineData.points[0];
        const lastPoint = lineData.points[lineData.points.length - 1];
        const dist1 = pointToLineDistance(firstPoint, p1, p2);
        const dist2 = pointToLineDistance(lastPoint, p1, p2);
        const intersectionPoint = dist1 < dist2 ? firstPoint : lastPoint;

        const isAtCorner = boundary
          .slice(0, 4)
          .some(
            (corner) =>
              Math.hypot(
                corner[0] - intersectionPoint[0],
                corner[1] - intersectionPoint[1]
              ) < 1.0
          );

        if (!isAtCorner) {
          const x = intersectionPoint[0] + normal[0] * labelOffset;
          const y = intersectionPoint[1] + normal[1] * labelOffset;

          edgeLabels.push({
            x,
            y,
            text: `IL ${lineNum}`,
            font: {
              color: "#00FFFF",
              size: 10,
              family: "Arial",
              weight: "bold",
            },
          });
        }
      });

      const allXlinesOnEdge = boundaryEdgeLines[edgeIdx]?.xlines || [];
      const displayedXlinesOnEdge = allXlinesOnEdge.filter(
        (lineNum) => lineNum % lineDensity === 0
      );

      displayedXlinesOnEdge.forEach((lineNum) => {
        const lineData = xlineMap.get(lineNum);
        if (!lineData || lineData.points.length < 2) return;

        const firstPoint = lineData.points[0];
        const lastPoint = lineData.points[lineData.points.length - 1];
        const dist1 = pointToLineDistance(firstPoint, p1, p2);
        const dist2 = pointToLineDistance(lastPoint, p1, p2);
        const intersectionPoint = dist1 < dist2 ? firstPoint : lastPoint;

        const isAtCorner = boundary
          .slice(0, 4)
          .some(
            (corner) =>
              Math.hypot(
                corner[0] - intersectionPoint[0],
                corner[1] - intersectionPoint[1]
              ) < 1.0
          );

        if (!isAtCorner) {
          const x = intersectionPoint[0] + normal[0] * labelOffset;
          const y = intersectionPoint[1] + normal[1] * labelOffset;

          edgeLabels.push({
            x,
            y,
            text: `XL ${lineNum}`,
            font: {
              color: "#FF69B4",
              size: 10,
              family: "Arial",
              weight: "bold",
            },
          });
        }
      });
    }

    return edgeLabels.map((lab) => ({
      ...lab,
      showarrow: false,
      bgcolor: "rgba(0,0,0,0.85)",
      bordercolor: lab.font.color,
      borderwidth: 1,
      borderpad: 2,
      xanchor: "center",
      yanchor: "middle",
    }));
  }, [boundaryEdgeLines, boundary, gridData, lineDensity]);

  // 4. Calculate coordinate annotations (updates when currentRanges changes)
  const coordinateAnnotations = useMemo(() => {
    const { xrange, yrange } = currentRanges;
    if (!xrange || !yrange) return []; // Safety check

    const xSpan = xrange[1] - xrange[0];
    const ySpan = yrange[1] - yrange[0];
    
    // Use your existing logic for tick calculation
    const numTicks = Math.max(
      3,
      Math.min(8, Math.floor(Math.max(xSpan, ySpan) / 100))
    );
    const xStep = xSpan / (numTicks - 1);
    const yStep = ySpan / (numTicks - 1);

    const xTicks = Array.from({ length: numTicks }, (_, i) => {
      const val = xrange[0] + i * xStep;
      return Math.round(val / 10) * 10; // Round to nearest 10
    });
    const yTicks = Array.from({ length: numTicks }, (_, i) => {
      const val = yrange[0] + i * yStep;
      return Math.round(val / 10) * 10; // Round to nearest 10
    });

    const annotations = [];

    // Add X-axis ticks (top and bottom)
    xTicks.forEach((val) => {
      if (val >= xrange[0] && val <= xrange[1]) {
        annotations.push({
          x: val,
          y: yrange[1],
          text: val.toLocaleString(),
          showarrow: false,
          font: { color: "white", size: 11, family: "Arial" },
          yshift: 25,
          xanchor: "center",
          bgcolor: "rgba(0,0,0,0.8)",
          bordercolor: "rgba(255,255,255,0.5)",
          borderwidth: 1,
          borderpad: 4,
        });
        annotations.push({
          x: val,
          y: yrange[0],
          text: val.toLocaleString(),
          showarrow: false,
          font: { color: "white", size: 11, family: "Arial" },
          yshift: -25,
          xanchor: "center",
          bgcolor: "rgba(0,0,0,0.8)",
          bordercolor: "rgba(255,255,255,0.5)",
          borderwidth: 1,
          borderpad: 4,
        });
      }
    });

    // Add Y-axis ticks (left and right)
    yTicks.forEach((val) => {
      if (val >= yrange[0] && val <= yrange[1]) {
        annotations.push({
          x: xrange[0],
          y: val,
          text: val.toLocaleString(),
          showarrow: false,
          font: { color: "white", size: 11, family: "Arial" },
          xshift: -40,
          yanchor: "middle",
          bgcolor: "rgba(0,0,0,0.8)",
          bordercolor: "rgba(255,255,255,0.5)",
          borderwidth: 1,
          borderpad: 4,
        });
        annotations.push({
          x: xrange[1],
          y: val,
          text: val.toLocaleString(),
          showarrow: false,
          font: { color: "white", size: 11, family: "Arial" },
          xshift: 40,
          yanchor: "middle",
          bgcolor: "rgba(0,0,0,0.8)",
          bordercolor: "rgba(255,255,255,0.5)",
          borderwidth: 1,
          borderpad: 4,
        });
      }
    });

    // Add axis labels (also dynamic to new ranges)
    annotations.push(
      {
        x: (xrange[0] + xrange[1]) / 2,
        y: yrange[1],
        text: "X Coordinate",
        showarrow: false,
        font: { color: "white", size: 12, family: "Arial", weight: "bold" },
        yshift: 45,
        xanchor: "center",
        bgcolor: "rgba(0,0,0,0.9)",
        bordercolor: "white",
        borderwidth: 1,
      },
      {
        x: (xrange[0] + xrange[1]) / 2,
        y: yrange[0],
        text: "X Coordinate",
        showarrow: false,
        font: { color: "white", size: 12, family: "Arial", weight: "bold" },
        yshift: -45,
        xanchor: "center",
        bgcolor: "rgba(0,0,0,0.9)",
        bordercolor: "white",
        borderwidth: 1,
      },
      {
        x: xrange[0],
        y: (yrange[0] + yrange[1]) / 2,
        text: "Y Coordinate",
        showarrow: false,
        font: { color: "white", size: 12, family: "Arial", weight: "bold" },
        xshift: -60,
        yanchor: "middle",
        textangle: -90,
        bgcolor: "rgba(0,0,0,0.9)",
        bordercolor: "white",
        borderwidth: 1,
      },
      {
        x: xrange[1],
        y: (yrange[0] + yrange[1]) / 2,
        text: "Y Coordinate",
        showarrow: false,
        font: { color: "white", size: 12, family: "Arial", weight: "bold" },
        xshift: 60,
        yanchor: "middle",
        textangle: -90,
        bgcolor: "rgba(0,0,0,0.9)",
        bordercolor: "white",
        borderwidth: 1,
      }
    );

    return annotations;
  }, [currentRanges]); // <-- THIS IS THE KEY: depends on currentRanges

  // 5. Finally, combine all annotations (updates when dependencies change)
  const traces = prepareTraces();
  const allAnnotations = useMemo(
    () => [
      // North Arrow
      {
        xref: "paper",
        yref: "paper",
        x: 0.95,
        y: 0.98,
        text: "N",
        showarrow: false,
        font: { color: "white", size: 16, weight: "bold" },
        bgcolor: "rgba(0,0,0,0.8)",
        bordercolor: "white",
        borderwidth: 2,
        borderpad: 6,
      },
      {
        xref: "paper",
        yref: "paper",
        x: 0.95,
        y: 0.90,
        text: "↑",
        showarrow: false,
        font: { color: "white", size: 20, weight: "bold" },
        bgcolor: "rgba(0,0,0,0.8)",
        bordercolor: "white",
        borderwidth: 2,
        borderpad: 4,
      },
      // Dynamic annotations
      ...coordinateAnnotations,
      ...getBoundaryEdgeLabels,
    ],
    [coordinateAnnotations, getBoundaryEdgeLabels]
  );

  // --- END: DYNAMIC COORDINATE LOGIC ---

  return (
    <div>
      <div
        style={{
          color: "white",
          backgroundColor: "black",
          padding: "10px",
          fontSize: "14px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            marginBottom: "10px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <span>View Mode:</span>
          <button
            onClick={() => setViewMode("both")}
            style={{
              backgroundColor: viewMode === "both" ? "#00FF00" : "#333",
              color: "white",
              border: "1px solid #00FF00",
              padding: "5px 15px",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Both
          </button>
          <button
            onClick={() => setViewMode("inlines")}
            style={{
              backgroundColor: viewMode === "inlines" ? "#00FFFF" : "#333",
              color: "white",
              border: "1px solid #00FFFF",
              padding: "5px 15px",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Inlines Only
          </button>
          <button
            onClick={() => setViewMode("xlines")}
            style={{
              backgroundColor: viewMode === "xlines" ? "#FF69B4" : "#333",
              color: "white",
              border: "1px solid #FF69B4",
              padding: "5px 15px",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Xlines Only
          </button>
        </div>
        {selectedLine && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#333",
              borderRadius: "5px",
              border: "2px solid #00FF00",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>
                Selected: {selectedLine.type} {selectedLine.number}
              </strong>
            </div>
            <button
              onClick={clearSelection}
              style={{
                backgroundColor: "#ff4444",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>
      <Plot
        data={traces}
        layout={{
          title: {
            text: `Seismic Survey Map - ${
              viewMode === "both"
                ? "Inlines & Crosslines"
                : viewMode === "inlines"
                ? "Inlines Only"
                : "Crosslines Only"
            } (Showing every 50th line)`,
            font: { color: "white", size: 16 },
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
            align: "left",
          },
          xaxis: {
            title: "",
            showgrid: true,
            gridcolor: "rgba(128,128,128,0.3)",
            zeroline: true,
            zerolinecolor: "rgba(128,128,128,0.5)",
            zerolinewidth: 1,
            showticklabels: false,
            range: currentRanges.xrange, // <-- Controlled range
            fixedrange: false,
            constrain: "domain",
            automargin: true,
          },
          yaxis: {
            title: "",
            showgrid: true,
            gridcolor: "rgba(128,128,128,0.3)",
            zeroline: true,
            zerolinecolor: "rgba(128,128,128,0.5)",
            zerolinewidth: 1,
            showticklabels: false,
            range: currentRanges.yrange, // <-- Controlled range
            fixedrange: false,
            scaleanchor: "x",
            scaleratio: 1,
            automargin: true,
          },
          shapes: [],
          annotations: allAnnotations, // <-- Use the dynamic annotations
          margin: { l: 80, r: 80, t: 80, b: 80 },
          showlegend: false,
          dragmode: "zoom",
        }}
        config={{
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
          modeBarButtonsToAdd: ["zoomIn2d", "zoomOut2d", "autoScale2d"],
          toImageButtonOptions: {
            format: "png",
            filename: "seismic_survey_map",
          },
          scrollZoom: true,
          doubleClick: "reset",
        }}
        style={{ width: "100%", height: "90vh" }}
        onClick={handlePlotClick}
        onHover={handlePlotHover}
        onUnhover={handlePlotUnhover}
        onRelayout={handlePlotRelayout} 
        useResizeHandler={true}
      />
    </div>
  );
}
