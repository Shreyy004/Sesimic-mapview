from flask import Flask, jsonify, request
import segyio
import pandas as pd
import numpy as np
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SEGY_FILE = 'data/cropped_coherent_energy_Penobscot_kxky_pass2_median_working.segy'

# ----------------------
# Read metadata
# ----------------------
def read_segy_metadata():
    with segyio.open(SEGY_FILE, "r", ignore_geometry=False) as f:
        inlines = f.attributes(segyio.TraceField.INLINE_3D)[:]
        xlines = f.attributes(segyio.TraceField.CROSSLINE_3D)[:]
        x_coords = f.attributes(segyio.TraceField.CDP_X)[:]
        y_coords = f.attributes(segyio.TraceField.CDP_Y)[:]

    df = pd.DataFrame({
        'INLINE': inlines,
        'XLINE': xlines,
        'X': x_coords,
        'Y': y_coords
    }).drop_duplicates(subset=['INLINE', 'XLINE'])
    return df

# ----------------------
# Map data for frontend
# ----------------------
@app.route('/map-data')
def map_data():
    df = read_segy_metadata()
    return jsonify(df.to_dict(orient='records'))

# ----------------------
# Survey Boundary 
# ----------------------
@app.route('/survey-boundary')
def survey_boundary():
    with segyio.open(SEGY_FILE, "r", ignore_geometry=False) as segy_3d:
        i_line = segyio.TraceField.INLINE_3D
        x_line = segyio.TraceField.CROSSLINE_3D
        dp_x = segyio.TraceField.CDP_X
        dp_y = segyio.TraceField.CDP_Y

        # Scaling factor (sgs)
        sgs = segy_3d.header[0][71]
        if sgs == 0:
            sgs = 1.0
        if sgs < 0:
            scale_func = lambda x: x / abs(sgs)
        else:
            scale_func = lambda x: x * sgs

        # Four corner coordinates 
        cdpx = [
            segy_3d.header[0][dp_x],
            segy_3d.header[-(len(segy_3d.xlines))][dp_x],
            segy_3d.header[-1][dp_x],
            segy_3d.header[len(segy_3d.xlines) - 1][dp_x]
        ]
        cdpy = [
            segy_3d.header[0][dp_y],
            segy_3d.header[-(len(segy_3d.xlines))][dp_y],
            segy_3d.header[-1][dp_y],
            segy_3d.header[len(segy_3d.xlines) - 1][dp_y]
        ]

        # Scale coordinates
        cdpx_scaled = [scale_func(x) for x in cdpx]
        cdpy_scaled = [scale_func(y) for y in cdpy]

        # Inline & Xline coordinates at corners 
        iline_cood = [
            segy_3d.header[0][i_line],
            segy_3d.header[-(len(segy_3d.xlines))][i_line],
            segy_3d.header[-1][i_line],
            segy_3d.header[len(segy_3d.xlines) - 1][i_line]
        ]
        xline_cood = [
            segy_3d.header[0][x_line],
            segy_3d.header[-(len(segy_3d.xlines))][x_line],
            segy_3d.header[-1][x_line],
            segy_3d.header[len(segy_3d.xlines) - 1][x_line]
        ]

        # Order corners clockwise and close polygon
        boundary_points = [
            [cdpx_scaled[0], cdpy_scaled[0]],
            [cdpx_scaled[1], cdpy_scaled[1]],
            [cdpx_scaled[2], cdpy_scaled[2]],
            [cdpx_scaled[3], cdpy_scaled[3]],
            [cdpx_scaled[0], cdpy_scaled[0]]  # close
        ]

        # Compute min/max for extent
        x_min, x_max = float(min(cdpx_scaled)), float(max(cdpx_scaled))
        y_min, y_max = float(min(cdpy_scaled)), float(max(cdpy_scaled))

    return jsonify({
        'boundary': boundary_points,
        'iline_cood': iline_cood,
        'xline_cood': xline_cood,
        'x_min': x_min,
        'x_max': x_max,
        'y_min': y_min,
        'y_max': y_max,
        'sgs': sgs
    })


@app.route('/grid-data-all')
def grid_data_all():
    """
    Returns all inlines and xlines but in an optimized format
    to prevent frontend overload, with hover information
    """
    df = read_segy_metadata()
    
    # Get all unique inlines and xlines
    all_inlines = sorted(df['INLINE'].unique())
    all_xlines = sorted(df['XLINE'].unique())
    
    # For inlines: group by inline and get all points with hover info
    inline_data = []
    for il in all_inlines:
        il_data = df[df['INLINE'] == il]
        if len(il_data) >= 2:
            points = il_data[['X', 'Y']].values.tolist()
            # Create hover info for each point
            hover_info = []
            for _, row in il_data.iterrows():
                hover_info.append(f"INLINE: {int(row['INLINE'])}<br>X: {row['X']:.2f}<br>Y: {row['Y']:.2f}")
            
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
            points = xl_data[['X', 'Y']].values.tolist()
            # Create hover info for each point
            hover_info = []
            for _, row in xl_data.iterrows():
                hover_info.append(f"XLINE: {int(row['XLINE'])}<br>X: {row['X']:.2f}<br>Y: {row['Y']:.2f}")
            
            xline_data.append({
                'xline': int(xl),
                'points': points,
                'hover_info': hover_info
            })
    
    return jsonify({
        'inlines': inline_data,
        'xlines': xline_data,
        'total_inlines': len(inline_data),
        'total_xlines': len(xline_data)
    })


@app.route('/grid-data-optimized')
def grid_data_optimized():
    """
    Returns all inlines and xlines using segments for maximum performance
    """
    df = read_segy_metadata()
    
    # Get all unique inlines and xlines
    all_inlines = sorted(df['INLINE'].unique())
    all_xlines = sorted(df['XLINE'].unique())
    
    # For inlines: create segments with midpoint hover info
    inline_segments = []
    for il in all_inlines:
        il_data = df[df['INLINE'] == il]
        if len(il_data) >= 2:
            points = il_data[['X', 'Y']].values
            # Use first and last point to create a segment
            start_x, start_y = float(points[0][0]), float(points[0][1])
            end_x, end_y = float(points[-1][0]), float(points[-1][1])
            mid_x = (start_x + end_x) / 2
            mid_y = (start_y + end_y) / 2
            
            inline_segments.append({
                'inline': int(il),
                'start': [start_x, start_y],
                'end': [end_x, end_y],
                'midpoint': [mid_x, mid_y],
                'hover_info': f"INLINE: {int(il)}<br>X: {mid_x:.2f}<br>Y: {mid_y:.2f}"
            })
    
    # For xlines: create segments with midpoint hover info
    xline_segments = []
    for xl in all_xlines:
        xl_data = df[df['XLINE'] == xl]
        if len(xl_data) >= 2:
            points = xl_data[['X', 'Y']].values
            # Use first and last point to create a segment
            start_x, start_y = float(points[0][0]), float(points[0][1])
            end_x, end_y = float(points[-1][0]), float(points[-1][1])
            mid_x = (start_x + end_x) / 2
            mid_y = (start_y + end_y) / 2
            
            xline_segments.append({
                'xline': int(xl),
                'start': [start_x, start_y],
                'end': [end_x, end_y],
                'midpoint': [mid_x, mid_y],
                'hover_info': f"XLINE: {int(xl)}<br>X: {mid_x:.2f}<br>Y: {mid_y:.2f}"
            })
    
    return jsonify({
        'inlines': inline_segments,
        'xlines': xline_segments,
        'total_inlines': len(inline_segments),
        'total_xlines': len(xline_segments)
    })


@app.route('/grid-coordinates')
def grid_coordinates():
    """
    Returns grid coordinate labels for all 4 sides of the plot
    """
    df = read_segy_metadata()
    
    # Get extent
    x_min, x_max = df['X'].min(), df['X'].max()
    y_min, y_max = df['Y'].min(), df['Y'].max()
    
    # Generate coordinate ticks
    num_ticks = 6  # Number of ticks per side
    x_ticks = np.linspace(x_min, x_max, num_ticks)
    y_ticks = np.linspace(y_min, y_max, num_ticks)
    
    grid_coords = {
        'x_ticks': [{'value': float(x), 'label': f"{int(x)}"} for x in x_ticks],
        'y_ticks': [{'value': float(y), 'label': f"{int(y)}"} for y in y_ticks],
        'extent': {
            'x_min': float(x_min),
            'x_max': float(x_max), 
            'y_min': float(y_min),
            'y_max': float(y_max)
        }
    }
    
    return jsonify(grid_coords)


@app.route('/get_survey_data')
def get_survey_data():
    """
    Combines survey boundary and grid data into one response
    for React frontend.
    """
    # Boundary
    with app.test_request_context():
        boundary_json = survey_boundary().json

    # Grid data (using optimized version with hover info)
    with app.test_request_context():
        grid_json = grid_data_all().json

    # Convert for frontend
    boundary_list = [{'x': x, 'y': y} for x, y in boundary_json['boundary']]

    return jsonify({
        'coords': [],  # optional raw coords
        'boundary': boundary_list,
        'inlines': grid_json['inlines'],
        'xlines': grid_json['xlines'],
        'total_inlines': grid_json['total_inlines'],
        'total_xlines': grid_json['total_xlines']
    })

if __name__ == '__main__':
    app.run(debug=True)

