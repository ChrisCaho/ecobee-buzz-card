# Ecobee Buzz Card

> **WORK IN PROGRESS — NOT TESTED**
> This card is under active development and has not been fully tested. Use at your own risk.

A Home Assistant custom card for ecobee thermostat control that integrates local ecobee data available via HomeKit with advanced ecobee metrics from [Beestat](https://beestat.io/) / [BuzzBridge](https://github.com/ChrisCaho/BuzzBridge).

Forked from [HA Total Climate Card](https://github.com/Mystic369/ha-total-climate-card) by **Traci S Aaron (Mystic369)**. Thank you to Traci for creating the original card and making it open source — this fork builds on that excellent foundation.

## What's Changed (from original)

### v2.1.9 — Improved Clear Hold Responsiveness
- **Boost polling on clear hold** — clearing a hold now immediately activates BuzzBridge boost polling (every 60s for 60min) so the integration checks for changes frequently instead of waiting for the default 5-minute poll cycle
- **Delayed full refresh** — a full one-time data refresh fires 20 seconds after clearing the hold, giving ecobee's cloud and beestat's server-side cache (~3 min) time to sync the change
- **Boost as safety net** — even if the 20-second refresh doesn't catch it (beestat cache hasn't expired yet), boost polling retries every 60 seconds and will pick up the cleared hold on a subsequent cycle
- **Note on timing**: BuzzBridge data is **not real-time** — it relies on the beestat.io API which syncs from ecobee's cloud servers with a ~3-minute server-side cache. Unlike HomeKit climate entities (which update locally in near real-time), hold status changes can take 30 seconds to several minutes to propagate through the ecobee → beestat → BuzzBridge chain. The "CLEARING..." indicator shows immediately as visual feedback while the data syncs in the background

### v2.1.8 — Hold Status & BuzzBridge Integration
- **Hold status button** below center controls — shows "PROGRAM" (green) when following schedule, or "HOLD" with duration (yellow) when a hold is active
- **Clear hold with confirmation** — tap the hold button to clear hold and resume schedule, with YES/Cancel confirmation dialog
- **Auto-refresh on load** — card triggers BuzzBridge Refresh Now on dashboard open for fresh data
- **Auto-refresh on clear hold** — triggers immediate refresh plus a second refresh 5 seconds later to catch delayed state updates
- **BuzzBridge integration** — reads hold status from BuzzBridge sensors, supports timed holds (shows remaining minutes/hours/days) and indefinite holds
- **Dynamic fan modes** — fan mode cycling now reads available modes from the entity instead of hardcoding
- **Improved temp display** — indoor/outdoor split into separate boxes with different shading, labels below temps, tighter spacing
- **Center controls alignment** — control panel top-aligned with indoor temp box
- **New config options**: `hold_status_entity`, `clear_hold_entity`, `boost_polling_entity`, `refresh_now_entity`

### v2.0.0 — Single-Thermostat Refactor
- **Single thermostat per card** — Each card now controls one climate entity via the `entity` config key. Use separate cards for multiple thermostats/zones. The old `thermostats` array config is still accepted for backwards compatibility but is deprecated.
- **HVAC status side button** — The side panel now shows a single status button displaying the real-time HVAC action (cooling, heating, fan, idle). Tap to open the climate entity's detail popup.
- **Optional dehumidifier support** — Add `dehumidifier_entity` to show a dehumidifier control button in the side panel.
- **Optional ERV support** — Add `erv_entity` to show an Energy Recovery Ventilator status button in the side panel. Tap to open the ERV entity's detail popup.
- **Removed multi-thermostat switching** — No longer uses side buttons to switch between thermostats. This fixes the overflow issue when 3+ thermostats were configured.

### v1.0.0 — Initial Fork
- **Renamed** from `aprilaire-thermostat-card` / `ha-total-climate-card` to `ecobee-buzz-card`
- **HVAC action display** on thermostat side buttons — shows cooling, heating, or idle status in real-time
- **CSS overflow fix** — card no longer overflows its container in HA sections layout
- **Removed Real Feel / Smart Comfort** feature (not needed with BuzzBridge comfort index)

## Installation

### HACS (Recommended)
1. Open HACS -> Frontend -> 3 dots -> Custom repositories
2. Add `https://github.com/ChrisCaho/ecobee-buzz-card` as a Lovelace plugin
3. Search for "Ecobee Buzz Card" and install
4. Restart Home Assistant

### Manual
1. Download `ecobee-buzz-card.js`
2. Copy to `/config/www/ecobee-buzz-card.js`
3. Add to Lovelace resources:
   ```yaml
   resources:
     - url: /local/ecobee-buzz-card.js
       type: module
   ```
4. Restart Home Assistant

## Configuration

### Card Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `type` | string | Yes | | Must be `custom:ecobee-buzz-card` |
| `entity` | string | Yes | | Climate entity ID (e.g., `climate.thermostat`) |
| `name` | string | No | `Thermostat` | Card title |
| `weather_entity` | string | No | `weather.pirateweather` | Weather entity for forecast |
| `outdoor_temperature` | string | No | | Outdoor temperature sensor |
| `outdoor_humidity` | string | No | | Outdoor humidity sensor |
| `indoor_heat_index` | string | No | | Indoor thermal comfort sensor |
| `outdoor_heat_index` | string | No | | Outdoor thermal comfort sensor |
| `dehumidifier_entity` | string | No | | Dehumidifier entity ID |
| `erv_entity` | string | No | | ERV entity ID (fan or switch domain) |
| `hold_status_entity` | string | No | | BuzzBridge hold status sensor |
| `clear_hold_entity` | string | No | | HomeKit clear hold button entity |
| `boost_polling_entity` | string | No | | BuzzBridge boost polling button |
| `refresh_now_entity` | string | No | | BuzzBridge refresh now button |
| `bottom_buttons` | list | No | | Custom monitoring buttons (up to 5) |

### Minimal Configuration

```yaml
type: custom:ecobee-buzz-card
name: Living Room
entity: climate.thermostat
weather_entity: weather.home
```

### With BuzzBridge Hold Status

```yaml
type: custom:ecobee-buzz-card
name: Home
entity: climate.ecob_home
weather_entity: weather.home
hold_status_entity: sensor.buzzbridge_thermostat_home_hold_status
clear_hold_entity: button.ecob_home_clear_hold
boost_polling_entity: button.buzzbridge_thermostat_home_boost_polling
refresh_now_entity: button.buzzbridge_thermostat_home_refresh_now
```

### With Dehumidifier and ERV

```yaml
type: custom:ecobee-buzz-card
name: Home
entity: climate.thermostat
dehumidifier_entity: humidifier.whole_house_dehumidifier
erv_entity: fan.erv
weather_entity: weather.home
outdoor_temperature: sensor.outdoor_temp
outdoor_humidity: sensor.outdoor_humidity
```

### Full Example with Bottom Buttons

```yaml
type: custom:ecobee-buzz-card
name: Home
entity: climate.thermostat
weather_entity: weather.openweathermap
outdoor_temperature: sensor.openweathermap_temperature
outdoor_humidity: sensor.openweathermap_humidity
indoor_heat_index: sensor.thermal_comfort_heat_index
outdoor_heat_index: sensor.outdoor_feels_like
bottom_buttons:
  - label: HUMIDITY
    icon: "\U0001F4A7"
    entity: climate.thermostat
    attribute: current_humidity
    unit: "%"
    thresholds:
      warning_low: 35
      warning_high: 65
      critical_low: 25
      critical_high: 75
    tap_action:
      action: more-info
  - label: UV INDEX
    icon: "\u2600\uFE0F"
    entity: sensor.openweathermap_uv_index
    unit: ""
    thresholds:
      warning_high: 6
      critical_high: 10
    tap_action:
      action: more-info
  - label: PRESSURE
    icon: "\U0001F321"
    entity: weather.openweathermap
    attribute: pressure
    unit: " inHg"
    decimal_places: 1
    thresholds:
      warning_low: 29.5
      warning_high: 30.2
      critical_low: 29
      critical_high: 30.5
    tap_action:
      action: more-info
  - label: WIND
    icon: "\U0001F4A8"
    entity: weather.openweathermap
    attribute: wind_speed
    unit: " MPh"
    thresholds:
      warning_high: 25
      critical_high: 40
    tap_action:
      action: more-info
  - label: RAIN
    icon: "\U0001F327"
    entity: sensor.openweathermap_rain
    unit: " In/Hr"
    thresholds:
      warning_high: 1
      critical_high: 2
    tap_action:
      action: more-info
```

### Migrating from v1 (thermostats array)

The old `thermostats` array config still works but is deprecated. To migrate:

**Before:**
```yaml
thermostats:
  - entity: climate.thermostat
    name: Home
  - entity: humidifier.dehumidifier
    name: Dehumidifier
```

**After:**
```yaml
entity: climate.thermostat
dehumidifier_entity: humidifier.dehumidifier
```

If you had multiple thermostats in one card, create a separate card for each thermostat.

See [example-config.yaml](example-config.yaml) for more configuration examples including bottom button thresholds and tap actions.

---

# Original Documentation (HA Total Climate Card)

> The following documentation is from the original project by Traci S Aaron (Mystic369).

## Features

### 🌡️ **Thermal Comfort Monitoring**
- **Real "Feels Like" Temperature** - Indoor and outdoor heat index display
- Actual perceived temperature based on temp + humidity
- Perfect for migraine sufferers and comfort optimization

### 🏠 **Multi-Zone Climate Control**
- Control multiple thermostats from one card
- Independent zone management (Upstairs/Downstairs)
- Real-time temperature and humidity display
- Mode switching (Heat, Cool, Auto, Off)
- Fan control (Auto, On, Circulate)

### 💧 **Dehumidifier Integration**
- Dedicated dehumidifier control
- Target humidity adjustment (5% increments)
- Current vs target humidity display
- Respects entity min/max limits

### 📊 **Environmental Monitoring Buttons**
Smart bottom buttons with color-coded thresholds:
- **Barometric Pressure** - Migraine tracking with alerts
- **Indoor Humidity** - Comfort level monitoring
- **Filter Life** - Days remaining tracker with warnings
- **Air Quality** - Placeholder for CO2/VOC sensors
- **Emergency Heat** - Backup heating control

### 🎨 **Color-Coded Alerts**
- **Green** - Optimal conditions
- **Yellow** - Warning thresholds
- **Red** - Critical levels (with pulsing animation)

### 📱 **Mobile Compatible**
- Works on Home Assistant mobile app
- Responsive design for all screen sizes
- Touch-optimized controls

### ☁️ **Weather Integration**
- Current conditions display
- 7-day forecast
- One-click access to detailed weather popup

## Installation

### Method 1: HACS (Recommended)
1. Open HACS in Home Assistant
2. Click on "Frontend"
3. Click the 3 dots menu (top right)
4. Select "Custom repositories"
5. Add this repository URL
6. Click "Install"
7. Restart Home Assistant

### Method 2: Manual Installation
1. Download `ha-total-climate-card.js`
2. Copy to `/config/www/ha-total-climate-card.js`
3. Add to your Lovelace resources:
   ```yaml
   resources:
     - url: /local/ha-total-climate-card.js
       type: module
   ```
4. Restart Home Assistant

## Requirements

### Required Integrations
- **Home Assistant Climate Integration** (thermostats)
- **Weather Integration** (any - Pirate Weather, Met.no, etc.)

### Recommended Integrations
- **[Thermal Comfort](https://github.com/dolezsa/thermal_comfort)** - For "feels like" temperature calculation
- **Humidifier/Dehumidifier Integration** - For humidity control

## Configuration

### Basic Configuration

```yaml
type: custom:ha-total-climate-card
name: Family Room
thermostats:
  - entity: climate.upstairs_thermostat
    name: Upstairs
  - entity: climate.downstairs_thermostat
    name: Downstairs
  - entity: humidifier.dehumidifier
    name: Dehumidifier Control
weather_entity: weather.home
outdoor_temperature: sensor.outdoor_temperature
outdoor_humidity: sensor.outdoor_humidity
```

### Full Configuration with All Features

```yaml
type: custom:ha-total-climate-card
name: Total Climate Control
thermostats:
  - entity: climate.upstairs_thermostat
    name: Upstairs
  - entity: climate.downstairs_thermostat
    name: Downstairs
  - entity: humidifier.dehumidifier
    name: Dehumidifier Control
weather_entity: weather.pirateweather
outdoor_temperature: sensor.outdoor_temperature
outdoor_humidity: sensor.outdoor_humidity
indoor_heat_index: sensor.thermal_comfort_heat_index
outdoor_heat_index: sensor.thermal_comfort_heat_index_2
bottom_buttons:
  - label: PRESSURE
    icon: 🌡️
    entity: weather.pirateweather
    attribute: pressure
    unit: " inHg"
    decimal_places: 2
    thresholds:
      warning_low: 29.5
      warning_high: 30.2
      critical_low: 29.0
      critical_high: 30.5
    tap_action:
      action: more-info
  - label: HUMIDITY
    icon: 💧
    entity: climate.upstairs_thermostat
    attribute: current_humidity
    unit: "%"
    thresholds:
      warning_low: 35
      warning_high: 65
      critical_low: 25
      critical_high: 75
    tap_action:
      action: more-info
  - label: FILTER
    icon: 🔧
    entity: input_number.filter_days_remaining
    unit: " days"
    thresholds:
      warning_low: 30
      critical_low: 15
    tap_action:
      action: call-service
      service: input_number.set_value
      service_data:
        entity_id: input_number.filter_days_remaining
        value: 90
  - label: AIR QUAL
    icon: 💨
    entity: sensor.co2_sensor
  - label: EMERG HEAT
    icon: 🔥
    entity: switch.emergency_heat
cards:
  - show_current: true
    show_forecast: true
    type: weather-forecast
    entity: weather.pirateweather
    forecast_type: twice_daily
```

### Configuration Options

#### Card Options
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | string | Yes | Must be `custom:ha-total-climate-card` |
| `name` | string | Yes | Card title |
| `thermostats` | list | Yes | List of climate entities |
| `weather_entity` | string | Yes | Weather entity for forecast |
| `outdoor_temperature` | string | No | Outdoor temperature sensor |
| `outdoor_humidity` | string | No | Outdoor humidity sensor |
| `indoor_heat_index` | string | No | Indoor thermal comfort sensor |
| `outdoor_heat_index` | string | No | Outdoor thermal comfort sensor |
| `bottom_buttons` | list | No | Custom monitoring buttons |
| `cards` | list | No | Weather forecast card config |

#### Bottom Button Options
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `label` | string | Yes | Button label text |
| `icon` | string | No | Emoji or icon |
| `entity` | string | Yes | Entity to monitor |
| `attribute` | string | No | Specific attribute to display |
| `unit` | string | No | Unit suffix (e.g., " °F", "%") |
| `decimal_places` | number | No | Decimal precision |
| `thresholds` | object | No | Color threshold settings |
| `tap_action` | object | No | Action on button click |

#### Threshold Options
```yaml
thresholds:
  warning_low: 30      # Yellow below this value
  warning_high: 70     # Yellow above this value
  critical_low: 20     # Red below this value
  critical_high: 80    # Red above this value
```

## Optional Automations

The `automations/` folder contains optional automation YAML files you can import:

### Smart Comfort Control
Automatically maintains your target "feels like" temperature based on thermal comfort sensors.

**Features:**
- Runs 6pm-6am automatically
- Adjusts thermostat based on actual comfort level
- Voice control compatible
- Manual override switch

[See automations/smart-comfort-control.yaml](automations/smart-comfort-control.yaml)

### Filter Life Tracker
Tracks HVAC filter life with countdown and replacement reminders.

**Features:**
- Daily automatic countdown
- Color-coded warnings (90 days = green, 30 days = yellow, 15 days = red)
- One-click reset after filter replacement

[See automations/filter-life-tracker.yaml](automations/filter-life-tracker.yaml)

## Thermal Comfort Setup

For "feels like" temperature displays, install the Thermal Comfort custom integration:

1. Install via HACS or manually from: https://github.com/dolezsa/thermal_comfort
2. Add to `configuration.yaml`:

```yaml
sensor:
  - platform: thermal_comfort
    sensors:
      indoor_comfort:
        friendly_name: Indoor Thermal Comfort
        temperature_sensor: sensor.indoor_temperature
        humidity_sensor: sensor.indoor_humidity
      
      outdoor_comfort:
        friendly_name: Outdoor Thermal Comfort
        temperature_sensor: sensor.outdoor_temperature
        humidity_sensor: sensor.outdoor_humidity
```

3. Restart Home Assistant
4. Add entity IDs to card config

## Troubleshooting

### Card Not Loading
- Verify the JS file is in `/config/www/`
- Check browser console (F12) for errors
- Clear browser cache (Ctrl+Shift+R)
- Verify resource is added to Lovelace

### Mobile App Not Working
- Clear mobile app cache: Settings → Companion App → Reset Frontend Cache
- Ensure you're using event listeners (not inline onclick handlers)

### "Feels Like" Shows "--"
- Verify Thermal Comfort integration is installed
- Check entity IDs match your configuration
- Ensure temperature and humidity sensors are working

### Buttons Not Changing Color
- Verify thresholds are configured correctly
- Check entity is returning numeric values
- Review threshold logic in configuration

## Credits

Created by **Traci S Aaron (Mystic369)**

Built with collaboration and assistance from Claude (Anthropic).

Special thanks to the Home Assistant community for testing and feedback!

## Support

- 🐛 [Report Issues](https://github.com/Mystic369/ha-total-climate-card/issues)
- 💬 [Home Assistant Community Forum](https://community.home-assistant.io/)
- 📘 [Home Assistant Facebook Group](https://www.facebook.com/groups/HomeAssistant/)

## License

MIT License - Feel free to use, modify, and share!

## Changelog

### v1.0.0 (January 2026)
- Initial release
- Multi-zone thermostat control
- Thermal comfort monitoring
- Dehumidifier control
- Smart bottom buttons with thresholds
- Mobile app compatibility
- Weather integration
