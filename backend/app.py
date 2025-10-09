from flask import Flask, jsonify, request
import segyio
import pandas as pd
import numpy as np
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SEGY_FILE = 'data/cropped_coherent_energy_Penobscot_kxky_pass2_median_working.segy'


def convert_to_native(obj):
    if isinstance(obj, (np.integer, np.int32, np.int64, np.intc)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float32, np.float64)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_to_native(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_native(item) for item in obj]
    else:
        return obj


def apply_sgs_scaling(value, sgs):
    """Apply SGS scaling"""
    if sgs == 0:
        return value
    elif sgs < 0:
        return value / abs(sgs)
    else:
        return value * sgs

def read_segy_metadata():
    """Read SEGY metadata"""
    with segyio.open(SEGY_FILE, "r") as segy_3d:
        i_line = segyio.TraceField.INLINE_3D
        x_line = segyio.TraceField.CROSSLINE_3D
        dp_x = segyio.TraceField.CDP_X
        dp_y = segyio.TraceField.CDP_Y
        
        # Get SGS factor 
        sgs = segy_3d.header[0][71]
        if sgs == 0:
            sgs = 1.0
        
        # Extract coordinates from the four corners of the survey 
        corners = [
            segy_3d.header[0],                      # First trace-top-left corner
            segy_3d.header[-1],                     # Last trace-bottom-right corner
            segy_3d.header[-(len(segy_3d.xlines))],  # bottom-left corner (last row, first inline of that row)
            segy_3d.header[len(segy_3d.xlines) - 1]   # top-right corner (first row, last crossline)
        ]
        
        # Extract corner data with SGS scaling applied -> Stores raw & scaled coordinates, inline, crossline, corner index
        corner_data = []
        for i, header in enumerate(corners):
            x_raw = header[dp_x]
            y_raw = header[dp_y]
            
            # Apply SGS scaling
            x_scaled = apply_sgs_scaling(x_raw, sgs)
            y_scaled = apply_sgs_scaling(y_raw, sgs)
            
            corner_data.append({
                'X': x_scaled,
                'Y': y_scaled,
                'X_RAW': x_raw,
                'Y_RAW': y_raw,
                'INLINE': header[i_line],
                'XLINE': header[x_line],
                'corner_index': i,
                'sgs': sgs
            })
        
        return pd.DataFrame(corner_data)


def read_all_segy_metadata():
    """Read all SEGY metadata for grid lines display with SGS scaling"""
    with segyio.open(SEGY_FILE, "r", ignore_geometry=False) as f:
        inlines = f.attributes(segyio.TraceField.INLINE_3D)[:]
        xlines = f.attributes(segyio.TraceField.CROSSLINE_3D)[:]
        x_coords = f.attributes(segyio.TraceField.CDP_X)[:]
        y_coords = f.attributes(segyio.TraceField.CDP_Y)[:]
        
        # Get SGS factor from first trace
        sgs = f.header[0][71]
        if sgs == 0:
            sgs = 1.0

    # Apply SGS scaling to all coordinates
    x_coords_scaled = [apply_sgs_scaling(x, sgs) for x in x_coords]
    y_coords_scaled = [apply_sgs_scaling(y, sgs) for y in y_coords]

    df = pd.DataFrame({
        'INLINE': inlines,
        'XLINE': xlines,
        'X': x_coords_scaled,
        'Y': y_coords_scaled,
        'X_RAW': x_coords,
        'Y_RAW': y_coords
    }).drop_duplicates(subset=['INLINE', 'XLINE'])
    return df


@app.route('/map-data')
def map_data():
    df = read_all_segy_metadata()
    return jsonify(convert_to_native(df.to_dict(orient='records')))


@app.route('/survey-boundary')
def survey_boundary():
    df = read_segy_metadata()  
    
    # Extract boundary points and line numbers from corner data
    boundary_points = []
    iline_cood = []
    xline_cood = []
    
    # Sort corners to maintain proper polygon order 
    corner_order = [0, 3, 1, 2]  # Adjusted to match typical polygon winding order 
    
    for corner_idx in corner_order:
        corner_df = df[df['corner_index'] == corner_idx]
        if not corner_df.empty:
            row = corner_df.iloc[0]
            boundary_points.append([float(row['X']), float(row['Y'])])
            iline_cood.append(int(row['INLINE']))
            xline_cood.append(int(row['XLINE']))
    
    # Close the polygon
    if boundary_points:
        boundary_points.append(boundary_points[0])
    
    # Get all inlines and xlines for additional context
    all_df = read_all_segy_metadata()
    all_inlines = sorted([int(il) for il in all_df['INLINE'].unique()])
    all_xlines = sorted([int(xl) for xl in all_df['XLINE'].unique()])
    
    # Compute min/max for extent (using scaled coordinates)
    x_coords = [p[0] for p in boundary_points[:-1]]
    y_coords = [p[1] for p in boundary_points[:-1]]
    x_min, x_max = float(min(x_coords)), float(max(x_coords))
    y_min, y_max = float(min(y_coords)), float(max(y_coords))

    # Calculate additional metrics
    with segyio.open(SEGY_FILE, "r") as segy_3d:
        i_line = segyio.TraceField.INLINE_3D
        x_line = segyio.TraceField.CROSSLINE_3D
        dp_x = segyio.TraceField.CDP_X
        dp_y = segyio.TraceField.CDP_Y
        
        sgs = segy_3d.header[0][71]
        if sgs == 0:
            sgs = 1.0
        
        # Extract coordinates for calculations
        cdpx = [
            segy_3d.header[0][dp_x],
            segy_3d.header[-1][dp_x],
            segy_3d.header[-(len(segy_3d.xlines))][dp_x],
            segy_3d.header[len(segy_3d.xlines) - 1][dp_x]
        ]
        cdpy = [
            segy_3d.header[0][dp_y],
            segy_3d.header[-1][dp_y],
            segy_3d.header[-(len(segy_3d.xlines))][dp_y],
            segy_3d.header[len(segy_3d.xlines) - 1][dp_y]
        ]
        
        # Apply SGS scaling for calculations
        cdpx_scaled = [apply_sgs_scaling(x, sgs) for x in cdpx]
        cdpy_scaled = [apply_sgs_scaling(y, sgs) for y in cdpy]
        
        # Calculate lengths and area  - using scaled coordinates
        len1 = (((cdpx_scaled[0] - cdpx_scaled[3]) ** 2) + ((cdpy_scaled[0] - cdpy_scaled[3]) ** 2)) ** 0.5
        len2 = (((cdpx_scaled[0] - cdpx_scaled[2]) ** 2) + ((cdpy_scaled[0] - cdpy_scaled[2]) ** 2)) ** 0.5
        
        # Calculate bin sizes 
        bin_size_il = round((len2 / (len(segy_3d.ilines) - 1)) / abs(sgs), 2) if len(segy_3d.ilines) > 1 else 0
        bin_size_xl = round((len1 / (len(segy_3d.xlines) - 1)) / abs(sgs), 2) if len(segy_3d.xlines) > 1 else 0
        
        area_sq_km = round((len1 * len2) / 1e6, 2)  # Already using scaled coordinates
        
        # Calculate orientation  - using scaled coordinates
        deg_1 = np.angle(complex((cdpx_scaled[3] - cdpx_scaled[0]), (cdpy_scaled[3] - cdpy_scaled[0])), deg=True)
        if deg_1 < 0:
            fin_deg = 270 + deg_1
        elif 0 <= deg_1 <= 90:
            fin_deg = 90 - deg_1
        else:
            fin_deg = 450 - deg_1

        # Get coordinate ranges (scaled)
        x_coord_range = f'{min(cdpx_scaled):.2f} - {max(cdpx_scaled):.2f}'
        y_coord_range = f'{min(cdpy_scaled):.2f} - {max(cdpy_scaled):.2f}'

    response_data = {
        'boundary': boundary_points,
        'iline_cood': iline_cood,
        'xline_cood': xline_cood,
        'all_inlines': all_inlines,
        'all_xlines': all_xlines,
        'x_min': x_min,
        'x_max': x_max,
        'y_min': y_min,
        'y_max': y_max,
        'sgs': float(sgs),
        'area_sq_km': area_sq_km,
        'orientation_degrees': round(fin_deg, 2),
        'ILINE_Range': f'{min(all_inlines)} - {max(all_inlines)}',
        'XLINE_Range': f'{min(all_xlines)} - {max(all_xlines)}',
        'bin_size_il': bin_size_il,
        'bin_size_xl': bin_size_xl,
        'X_COORDINATE_Range': x_coord_range,
        'Y_COORDINATE_Range': y_coord_range,
        'iline_range': f'{min(all_inlines)} - {max(all_inlines)}',
        'xline_range': f'{min(all_xlines)} - {max(all_xlines)}'
    }
    
    # Ensure all data is converted to native Python types
    response_data = convert_to_native(response_data)
    
    return jsonify(response_data)


@app.route('/grid-data-all')
def grid_data_all():
    """
    Returns all inlines and xlines but in an optimized format
    to prevent frontend overload, with hover information
    """
    df = read_all_segy_metadata()  # This now returns scaled coordinates
    
    # Get all unique inlines and xlines
    all_inlines = sorted([int(il) for il in df['INLINE'].unique()])
    all_xlines = sorted([int(xl) for xl in df['XLINE'].unique()])
    
    # For inlines: group by inline and get all points with hover info
    inline_data = []
    for il in all_inlines:
        il_data = df[df['INLINE'] == il]
        if len(il_data) >= 2:
            points = [[float(x), float(y)] for x, y in il_data[['X', 'Y']].values]
            # Create hover info for each point
            hover_info = []
            for _, row in il_data.iterrows():
                hover_info.append(f"INLINE: {int(row['INLINE'])}<br>X: {float(row['X']):.2f}<br>Y: {float(row['Y']):.2f}")
            
            inline_data.append({
                'inline': int(il),
                'points': points,
                'hover_info': hover_info
            })
    
    # For xlines: group by xline and get all points with hover info
    xline_data = []
    for xl in all_xlines:
        xl_data = df[df['XLINE'] == xl]
        if len(xl_data) >= 2:
            points = [[float(x), float(y)] for x, y in xl_data[['X', 'Y']].values]
            # Create hover info for each point
            hover_info = []
            for _, row in xl_data.iterrows():
                hover_info.append(f"XLINE: {int(row['XLINE'])}<br>X: {float(row['X']):.2f}<br>Y: {float(row['Y']):.2f}")
            
            xline_data.append({
                'xline': int(xl),
                'points': points,
                'hover_info': hover_info
            })
    
    response_data = {
        'inlines': inline_data,
        'xlines': xline_data,
        'total_inlines': len(inline_data),
        'total_xlines': len(xline_data)
    }
    
    # Ensure all data is converted to native Python types
    response_data = convert_to_native(response_data)
    
    return jsonify(response_data)


@app.route('/boundary-edge-lines')
def boundary_edge_lines():
    """
    Returns which inlines and xlines actually intersect with each boundary edge.
    This data is used to draw the labels on the frontend.
    """
    df = read_all_segy_metadata()  # Using scaled coordinates
    boundary_response = survey_boundary().get_json()
    boundary_points = boundary_response['boundary'][:-1]  # Remove closing point
    
    if len(boundary_points) < 4:
        return jsonify({})

    # Define the four edges of the survey boundary
    edges = [
        [boundary_points[0], boundary_points[1]],  # Top edge
        [boundary_points[1], boundary_points[2]],  # Right edge
        [boundary_points[2], boundary_points[3]],  # Bottom edge  
        [boundary_points[3], boundary_points[0]]   # Left edge
    ]
    
    edge_lines = {0: {'inlines': [], 'xlines': []}, 
                  1: {'inlines': [], 'xlines': []}, 
                  2: {'inlines': [], 'xlines': []}, 
                  3: {'inlines': [], 'xlines': []}}
    
    # Helper function to check the distance from a point to a line segment
    def point_to_line_distance(point, line_start, line_end):
        x, y = point
        x1, y1 = line_start
        x2, y2 = line_end
        
        A = x - x1
        B = y - y1
        C = x2 - x1
        D = y2 - y1

        dot = A * C + B * D
        len_sq = C * C + D * D
        param = -1
        if len_sq != 0:
            param = dot / len_sq

        if param < 0:
            xx, yy = x1, y1
        elif param > 1:
            xx, yy = x2, y2
        else:
            xx = x1 + param * C
            yy = y1 + param * D

        dx = x - xx
        dy = y - yy
        return np.sqrt(dx * dx + dy * dy)
    
    # A tolerance to determine if a line is "on" an edge
    tolerance = 50 
    
    # Check inlines against each edge
    for il in df['INLINE'].unique():
        il_data = df[df['INLINE'] == il]
        points = il_data[['X', 'Y']].values
        
        for edge_idx, edge in enumerate(edges):
            for point in points:
                if point_to_line_distance(point, edge[0], edge[1]) < tolerance:
                    if il not in edge_lines[edge_idx]['inlines']:
                        edge_lines[edge_idx]['inlines'].append(int(il))
                    break # Move to the next edge once an intersection is found
    
    # Check xlines against each edge
    for xl in df['XLINE'].unique():
        xl_data = df[df['XLINE'] == xl]
        points = xl_data[['X', 'Y']].values
        
        for edge_idx, edge in enumerate(edges):
            for point in points:
                if point_to_line_distance(point, edge[0], edge[1]) < tolerance:
                    if xl not in edge_lines[edge_idx]['xlines']:
                        edge_lines[edge_idx]['xlines'].append(int(xl))
                    break # Move to the next edge
    
    # Sort all line numbers for consistent ordering
    for edge_idx in edge_lines:
        edge_lines[edge_idx]['inlines'].sort()
        edge_lines[edge_idx]['xlines'].sort()
    
    return jsonify(convert_to_native(edge_lines))


if __name__ == '__main__':
    app.run(debug=True)
