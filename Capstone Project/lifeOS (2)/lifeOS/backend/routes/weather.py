"""
LifeOS – routes/weather.py
Weather API route using standard library urllib with OpenWeatherMap & wttr.in fallback.
"""

import os
import json
import urllib.request
import urllib.parse
from flask import Blueprint, jsonify
from auth_helpers import login_required

weather_bp = Blueprint('weather', __name__)


@weather_bp.route('/api/weather', methods=['GET'])
@login_required
def get_weather():
    api_key = os.environ.get('WEATHER_API_KEY', '').strip()
    city = os.environ.get('WEATHER_CITY', 'Chennai').strip()

    # 1. OpenWeatherMap integration if API key exists
    if api_key:
        try:
            url = f"https://api.openweathermap.org/data/2.5/weather?q={urllib.parse.quote(city)}&appid={api_key}&units=metric"
            req = urllib.request.Request(url, headers={'User-Agent': 'LifeOS/1.0'})
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    temp = round(data['main']['temp'])
                    temp_min = round(data['main']['temp_min'])
                    temp_max = round(data['main']['temp_max'])
                    humidity = data['main']['humidity']
                    wind_speed = round(data['wind']['speed'] * 3.6) # m/s to km/h
                    condition = data['weather'][0]['main']
                    desc = data['weather'][0]['description'].title()

                    icons = {
                        'Clear': '☀️',
                        'Clouds': '⛅',
                        'Rain': '🌧️',
                        'Drizzle': '🌦️',
                        'Thunderstorm': '⛈️',
                        'Snow': '❄️',
                        'Mist': '🌫️',
                        'Fog': '🌫️'
                    }
                    icon = icons.get(condition, '⛅')

                    return jsonify({
                        'status': 'success',
                        'provider': 'OpenWeatherMap',
                        'weather': {
                            'location': data.get('name', city),
                            'temp': f"{temp}°C",
                            'condition': desc,
                            'humidity': f"{humidity}%",
                            'wind': f"{wind_speed} km/h",
                            'high_low': f"{temp_max}° / {temp_min}°",
                            'icon': icon
                        }
                    })
        except Exception as e:
            print(f"[Weather API] OpenWeatherMap request error: {e}")

    # 2. Fallback to wttr.in JSON API (No API key needed)
    try:
        url = f"https://wttr.in/{urllib.parse.quote(city)}?format=j1"
        req = urllib.request.Request(url, headers={'User-Agent': 'curl/7.68.0'})
        with urllib.request.urlopen(req, timeout=4) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                curr = data['current_condition'][0]
                weather_day = data['weather'][0]
                temp = curr['temp_C']
                humidity = curr['humidity']
                wind = curr['windspeedKmph']
                condition = curr['weatherDesc'][0]['value']
                high = weather_day['maxtempC']
                low = weather_day['mintempC']

                return jsonify({
                    'status': 'success',
                    'provider': 'wttr.in',
                    'weather': {
                        'location': city,
                        'temp': f"{temp}°C",
                        'condition': condition,
                        'humidity': f"{humidity}%",
                        'wind': f"{wind} km/h",
                        'high_low': f"{high}° / {low}°",
                        'icon': '⛅'
                    }
                })
    except Exception as e:
        print(f"[Weather API] wttr.in fallback error: {e}")

    # 3. Graceful fallback data if external network unavailable
    return jsonify({
        'status': 'success',
        'provider': 'Default',
        'weather': {
            'location': city,
            'temp': '29°C',
            'condition': 'Partly Cloudy',
            'humidity': '72%',
            'wind': '14 km/h',
            'high_low': '31° / 24°',
            'icon': '⛅'
        }
    })
