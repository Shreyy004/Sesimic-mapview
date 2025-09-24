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

# ----------------------
# Grid data
# ----------------------
@app.route('/grid-data')
def grid_data():
    df = read_segy_metadata()
    spacing = int(request.args.get('spacing', 1))

    inlines = sorted(df['INLINE'].unique())[::spacing]
    xlines = sorted(df['XLINE'].unique())[::spacing]

    inline_lines = [
        {'inline': int(il), 'points': df[df['INLINE'] == il][['X', 'Y']].values.tolist()}
        for il in inlines
    ]
    xline_lines = [
        {'xline': int(xl), 'points': df[df['XLINE'] == xl][['X', 'Y']].values.tolist()}
        for xl in xlines
    ]

    return jsonify({'inlines': inline_lines, 'xlines': xline_lines})

# ----------------------
# Grid coordinates endpoint
# ----------------------
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

# ----------------------
# NEW endpoint to combine everything for React
# ----------------------
@app.route('/get_survey_data')
def get_survey_data():
    """
    Combines survey boundary and grid data into one response
    for React frontend.
    """
    # Boundary
    with app.test_request_context():
        boundary_json = survey_boundary().json

    # Grid
    with app.test_request_context():
        grid_json = grid_data().json

    # Convert for frontend
    boundary_list = [{'x': x, 'y': y} for x, y in boundary_json['boundary']]

    # Convert inline/xline to start & end points
    inline_segments = []
    for il in grid_json['inlines']:
        pts = il['points']
        if len(pts) >= 2:
            inline_segments.append([pts[0][0], pts[0][1], pts[-1][0], pts[-1][1]])

    xline_segments = []
    for xl in grid_json['xlines']:
        pts = xl['points']
        if len(pts) >= 2:
            xline_segments.append([pts[0][0], pts[0][1], pts[-1][0], pts[-1][1]])

    return jsonify({
        'coords': [],  # optional raw coords
        'boundary': boundary_list,
        'inlines': inline_segments,
        'xlines': xline_segments
    })

if __name__ == '__main__':
    app.run(debug=True)