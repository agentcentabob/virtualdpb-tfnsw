from flask import Flask, render_template, jsonify, request
import requests
from datetime import datetime
import pytz
import os
from dotenv import load_dotenv


load_dotenv()

app = Flask(__name__)

API_KEY = os.getenv('TFNSW_API_KEY')
API_BASE_URL = 'https://api.transport.nsw.gov.au/v1/tp'


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/design/<board_name>")
def board(board_name):
    return render_template(f"design/{board_name}.html")


@app.route('/api/departures', methods=['GET'])
def get_departures():
    stop_id = request.args.get('stop_id')

    if not stop_id:
        return jsonify({'error': 'stop_id is required'}), 400

    # get current date and time in sydney timezone
    sydney_tz = pytz.timezone('Australia/Sydney')
    now = datetime.now(sydney_tz)
    itd_date = now.strftime('%Y%m%d')
    itd_time = now.strftime('%H%M')

    # build tfnsw api request
    params = {
        'outputFormat': 'rapidJSON',
        'coordOutputFormat': 'EPSG:4326',
        'mode': 'direct',
        'type_dm': 'stop',
        'name_dm': stop_id,
        'depArrMacro': 'dep',
        'itdDate': itd_date,
        'itdTime': itd_time,
        'TfNSWTR': 'true'
    }

    headers = {
        'Authorization': f'apikey {API_KEY}'
    }

    try:
        response = requests.get(
            f'{API_BASE_URL}/departure_mon',
            params=params,
            headers=headers
        )
        response.raise_for_status()
        return jsonify(response.json())

    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


if __name__ == "__main__":
    if not API_KEY:
        print("error: api key not found in variables")
        exit(1)

    print("server running on http://localhost:5001")
    app.run(debug=True, host="0.0.0.0", port=5001)
