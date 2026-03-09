const ECOBEE_BUZZ_CARD_VERSION = '2.2.0';
console.log(`Ecobee Buzz Card v${ECOBEE_BUZZ_CARD_VERSION}: Script loading started...`);

class EcobeeBuzzCard extends HTMLElement {
  constructor() {
    super();
    console.log('Ecobee Buzz Card: Constructor called');
    this.attachShadow({ mode: 'open' });
    this.activeEntity = null;
    this.viewMode = 'thermostat';
    this.isAdjusting = false; // Flag to prevent updates during adjustment
  }

  setConfig(config) {
    console.log('Ecobee Buzz Card: setConfig called', config);

    // Backwards compat: migrate old thermostats array to new single-entity config
    let entity = config.entity;
    let dehumidifier_entity = config.dehumidifier_entity;
    let erv_entity = config.erv_entity;

    if (!entity && config.thermostats && config.thermostats.length > 0) {
      console.warn('Ecobee Buzz Card: "thermostats" array is deprecated. Use "entity", "dehumidifier_entity", and "erv_entity" instead.');
      const climateEntry = config.thermostats.find(t => t.entity.startsWith('climate.'));
      entity = climateEntry ? climateEntry.entity : config.thermostats[0].entity;
      const dehumEntry = config.thermostats.find(t => t.entity.includes('dehumidifier'));
      if (dehumEntry) dehumidifier_entity = dehumEntry.entity;
    }

    if (!entity) {
      throw new Error('You need to define an "entity" (climate entity ID)');
    }

    this.config = {
      entity: entity,
      dehumidifier_entity: dehumidifier_entity || null,
      erv_entity: erv_entity || null,
      hold_status_entity: config.hold_status_entity || null,
      clear_hold_entity: config.clear_hold_entity || null,
      boost_polling_entity: config.boost_polling_entity || null,
      refresh_now_entity: config.refresh_now_entity || null,
      outdoor_humidity: config.outdoor_humidity || 'sensor.thermostat_outdoor_humidity',
      outdoor_temperature: config.outdoor_temperature || 'sensor.thermostat_outdoor_temperature',
      weather_entity: config.weather_entity || 'weather.pirateweather',
      name: config.name || 'Thermostat',
      bottom_buttons: config.bottom_buttons || [],
      indoor_heat_index: config.indoor_heat_index || null,
      outdoor_heat_index: config.outdoor_heat_index || null,
    };

    this.activeEntity = this.config.entity;
    console.log('Ecobee Buzz Card: Active entity set to', this.activeEntity);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.render();
      this.triggerRefreshNow();
    }
    this.update();
  }

  getCardSize() {
    return 4;
  }

  static getStubConfig() {
    return {
      name: 'Thermostat',
      entity: 'climate.thermostat'
    };
  }

  static getLayoutOptions() {
    return {
      grid_columns: 2,
      grid_min_columns: 2,
      grid_max_columns: 2,
      grid_rows: 4
    };
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          min-width: 0;
          contain: layout style paint;
          overflow: hidden;
        }
        
        @media (max-width: 700px) {
          :host {
            min-width: unset;
          }
          
          .header {
            flex-wrap: wrap;
          }
          
          .room-name {
            flex: 1 1 100%;
            margin-bottom: 10px;
          }
          
          .datetime {
            order: 3;
            flex: 1 1 50%;
            text-align: left;
          }
          
          .header-buttons {
            order: 2;
            flex: 0 1 auto;
          }
        }
        
        @media (max-width: 500px) {
          :host {
            min-width: 0;
          }

          .main-content {
            grid-template-columns: 1fr !important;
            gap: 10px;
          }

          .right-section {
            display: contents;
          }

          .side-controls {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px currentColor; }
          50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
        }
        
        @keyframes buttonPress {
          0% { transform: scale(1); }
          50% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        
        .card-container {
          background: linear-gradient(165deg, #1e5a7d 0%, #0f3049 50%, #0a1f2e 100%);
          border-radius: 12px;
          padding: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: white;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
          position: relative;
          overflow: hidden;
        }
        
        .card-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0;
          padding-bottom: 10px;
          gap: 10px;
        }
        
        .room-name {
          font-size: 16px;
          font-weight: 300;
          letter-spacing: 0.4px;
          flex: 0 0 auto;
        }
        
        .datetime {
          font-size: 12px;
          opacity: 0.9;
          font-weight: 500;
          flex: 1 1 auto;
          text-align: center;
        }
        
        .header-buttons {
          display: flex;
          gap: 8px;
          flex: 0 0 auto;
        }
        
        .header-btn {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.15);
          padding: 6px 12px;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          white-space: nowrap;
        }
        
        .header-btn:hover {
          background: rgba(255,255,255,0.2);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        .header-btn:active {
          animation: buttonPress 0.2s ease;
        }
        
        .header-btn.active {
          background: rgba(100,180,255,0.35);
          border-color: rgba(100,180,255,0.4);
        }
        
        .main-content {
          display: grid;
          grid-template-columns: minmax(160px, 1fr) minmax(120px, 0.7fr) minmax(120px, 1fr);
          gap: 12px;
          margin: 0 -12px;
          padding: 12px 12px 10px 12px;
          background: linear-gradient(165deg, rgba(5,15,35,0.9) 0%, rgba(0,8,25,0.95) 100%);
          box-shadow: 
            inset 0 2px 15px rgba(0,0,0,0.5), 
            0 4px 20px rgba(0,0,0,0.3);
          border: none;
          position: relative;
          min-height: 260px;
        }
        
        .main-content::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 30px;
          background: linear-gradient(to bottom, 
            rgba(30,90,125,0.4) 0%, 
            rgba(20,60,90,0.3) 25%,
            rgba(10,40,70,0.2) 50%,
            rgba(5,25,50,0.1) 75%,
            transparent 100%);
          pointer-events: none;
        }
        
        .main-content::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 30px;
          background: linear-gradient(to top, 
            rgba(30,90,125,0.4) 0%, 
            rgba(20,60,90,0.3) 25%,
            rgba(10,40,70,0.2) 50%,
            rgba(5,25,50,0.1) 75%,
            transparent 100%);
          pointer-events: none;
        }
        
        @media (max-width: 650px) {
          .main-content {
            grid-template-columns: 1fr;
          }
          
          :host {
            max-width: 100%;
          }
        }
        
        @media (min-width: 651px) and (max-width: 900px) {
          .main-content {
            grid-template-columns: minmax(140px, 1fr) minmax(100px, 0.6fr) minmax(100px, 0.8fr);
          }
        }
        
        .temp-section {
          grid-column: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .temp-display {
          flex: 1;
          background: linear-gradient(165deg, rgba(10,25,50,0.7) 0%, rgba(5,15,35,0.85) 100%);
          border-radius: 12px;
          padding: 14px;
          border: 1px solid rgba(100,180,255,0.18);
          box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .outdoor-display {
          flex: 1;
          background: linear-gradient(165deg, rgba(15,35,65,0.7) 0%, rgba(10,25,50,0.85) 100%);
          border-radius: 12px;
          padding: 14px;
          border: 1px solid rgba(100,180,255,0.18);
          box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .current-temp {
          font-size: 56px;
          font-weight: 200;
          line-height: 0.9;
          letter-spacing: -2px;
          text-shadow: 0 2px 12px rgba(0,0,0,0.5);
        }
        
        .temp-unit {
          font-size: 28px;
          font-weight: 300;
          opacity: 0.9;
        }
        
        .section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.8px;
          opacity: 0.7;
          text-transform: uppercase;
          margin-bottom: 2px;
        }

        .detail-group {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .detail-line {
          font-size: 11px;
          opacity: 0.85;
          font-weight: 500;
          line-height: 1.3;
        }

        .outdoor-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .outdoor-temp {
          font-size: 28px;
          font-weight: 200;
          line-height: 0.9;
          letter-spacing: -1px;
        }

        .outdoor-label {
          font-size: 10px;
          opacity: 0.75;
          font-weight: 500;
          letter-spacing: 0.5px;
        }
        
        .mode-fan-controls {
          display: flex;
          gap: 8px;
          margin-top: auto;
        }
        
        .mode-fan-btn {
          flex: 1;
          background: linear-gradient(145deg, rgba(30,90,125,0.4), rgba(20,60,90,0.3));
          border: 1px solid rgba(100,180,255,0.25);
          border-radius: 8px;
          padding: 8px;
          color: white;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
          display: flex;
          flex-direction: column;
          gap: 3px;
          align-items: center;
        }
        
        .mode-fan-btn:hover {
          background: linear-gradient(145deg, rgba(30,90,125,0.5), rgba(20,60,90,0.4));
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        
        .mode-fan-btn:active {
          animation: buttonPress 0.15s ease;
        }
        
        .mode-fan-btn.active {
          background: linear-gradient(145deg, rgba(66, 135, 245, 0.5), rgba(66, 135, 245, 0.3));
          border-color: rgba(66, 135, 245, 0.6);
          box-shadow: 0 4px 16px rgba(66, 135, 245, 0.3), inset 0 1px 0 rgba(255,255,255,0.2);
        }
        
        .mode-fan-btn-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.8px;
          opacity: 0.9;
        }
        
        .mode-fan-btn-value {
          font-size: 11px;
          font-weight: 600;
        }
        
        .hold-status-btn {
          background: linear-gradient(145deg, rgba(34,120,74,0.4), rgba(24,80,54,0.3));
          border: 1px solid rgba(74,222,128,0.3);
          border-radius: 12px;
          padding: 10px 12px;
          color: white;
          cursor: default;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          margin-top: 10px;
          text-align: center;
        }

        .hold-status-btn.has-hold {
          background: linear-gradient(145deg, rgba(140,120,30,0.4), rgba(100,85,20,0.3));
          border: 1px solid rgba(234,200,70,0.3);
          cursor: pointer;
          flex-direction: column;
          gap: 2px;
        }

        .hold-status-btn.clearing {
          background: linear-gradient(145deg, rgba(80,80,80,0.4), rgba(60,60,60,0.3));
          border: 1px solid rgba(150,150,150,0.3);
          cursor: default;
          pointer-events: none;
          opacity: 0.6;
          flex-direction: column;
          gap: 2px;
        }

        .hold-mode-text {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .has-hold .hold-mode-text {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .hold-line1 {
          display: block;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .hold-line2 {
          display: block;
          font-size: 10px;
          opacity: 0.85;
        }

        .hold-confirm-overlay {
          display: none;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          border-radius: 16px;
          z-index: 100;
          align-items: center;
          justify-content: center;
        }

        .hold-confirm-overlay.visible {
          display: flex;
        }

        .hold-confirm-dialog {
          background: linear-gradient(145deg, rgba(20,50,80,0.95), rgba(10,30,55,0.95));
          border: 1px solid rgba(100,180,255,0.3);
          border-radius: 12px;
          padding: 16px 20px;
          text-align: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }

        .hold-confirm-text {
          font-size: 13px;
          color: rgba(255,255,255,0.9);
          margin-bottom: 12px;
        }

        .hold-confirm-buttons {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .hold-confirm-yes {
          background: linear-gradient(145deg, rgba(34,120,74,0.6), rgba(24,80,54,0.5));
          border: 1px solid rgba(74,222,128,0.4);
          border-radius: 8px;
          padding: 8px 20px;
          color: rgba(255,255,255,0.95);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.5px;
        }

        .hold-confirm-cancel {
          background: linear-gradient(145deg, rgba(60,60,70,0.5), rgba(40,40,50,0.4));
          border: 1px solid rgba(150,150,160,0.3);
          border-radius: 8px;
          padding: 8px 20px;
          color: rgba(255,255,255,0.7);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.5px;
        }

        .controls {
          grid-column: 2;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-start;
          min-height: 200px;
          position: relative;
        }
        
        .heat-cool {
          display: flex;
          gap: 8px;
          width: 100%;
        }
        
        .temp-control {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        
        .temp-control-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          opacity: 0.8;
        }
        
        .temp-control-value {
          font-size: 36px;
          font-weight: 200;
          margin: 3px 0;
          text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        
        .temp-control-value.heat {
          color: #ff9999;
        }
        
        .temp-control-value.cool {
          color: #99ccff;
        }
        
        .temp-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(145deg, rgba(30,90,125,0.5), rgba(20,60,90,0.4));
          border: 1px solid rgba(100,180,255,0.3);
          color: white;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .temp-btn:hover {
          background: linear-gradient(145deg, rgba(30,90,125,0.6), rgba(20,60,90,0.5));
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        
        .temp-btn:active {
          transform: scale(0.95);
        }
        
        .right-section {
          grid-column: 3;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .side-controls {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: auto;
          align-items: stretch;
        }
        
        .side-btn {
          background: linear-gradient(145deg, rgba(30,90,125,0.4), rgba(20,60,90,0.3));
          border: 1px solid rgba(100,180,255,0.25);
          border-radius: 12px;
          padding: 10px 12px;
          color: white;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 52px;
          position: relative;
        }
        
        .side-btn::after {
          content: '';
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          transition: all 0.3s ease;
        }
        
        .side-btn.active::after {
          background: #4ade80;
          box-shadow: 0 0 8px #4ade80, 0 0 16px rgba(74,222,128,0.4);
          animation: pulse 2s ease-in-out infinite;
        }
        
        .side-btn:hover {
          background: linear-gradient(145deg, rgba(30,90,125,0.5), rgba(20,60,90,0.4));
          transform: translateX(-3px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        
        .side-btn:active {
          animation: buttonPress 0.15s ease;
        }
        
        .side-btn.active {
          background: linear-gradient(145deg, rgba(66, 135, 245, 0.5), rgba(66, 135, 245, 0.3));
          border-color: rgba(66, 135, 245, 0.6);
          box-shadow: 0 4px 16px rgba(66, 135, 245, 0.3), inset 0 1px 0 rgba(255,255,255,0.2);
        }
        
        .side-btn.humidity {
          background: linear-gradient(145deg, rgba(66, 135, 245, 0.4), rgba(50, 110, 200, 0.3));
          border-color: rgba(66, 135, 245, 0.35);
        }
        
        .side-btn.humidity:hover {
          background: linear-gradient(145deg, rgba(66, 135, 245, 0.5), rgba(50, 110, 200, 0.4));
        }
        
        .side-btn.thermostat-3 {
          background: linear-gradient(145deg, rgba(168, 85, 247, 0.4), rgba(130, 65, 200, 0.3));
          border-color: rgba(168, 85, 247, 0.35);
        }

        .side-btn.thermostat-3:hover {
          background: linear-gradient(145deg, rgba(168, 85, 247, 0.5), rgba(130, 65, 200, 0.4));
        }

        .side-btn.erv {
          background: linear-gradient(145deg, rgba(82, 183, 136, 0.4), rgba(60, 150, 110, 0.3));
          border-color: rgba(82, 183, 136, 0.35);
        }

        .side-btn.erv:hover {
          background: linear-gradient(145deg, rgba(82, 183, 136, 0.5), rgba(60, 150, 110, 0.4));
        }
        
        .side-btn-icon {
          font-size: 16px;
          flex-shrink: 0;
        }
        
        .side-btn-text {
          flex: 1;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.3px;
          line-height: 1.4;
        }
        
        .side-btn-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.5px;
          opacity: 0.7;
          text-transform: uppercase;
        }
        
        .bottom-nav {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          margin-top: 8px;
        }
        
        .nav-btn {
          background: linear-gradient(145deg, rgba(30,90,125,0.3), rgba(20,60,90,0.25));
          border: 1px solid rgba(100,180,255,0.2);
          border-radius: 10px;
          padding: 10px 6px;
          color: white;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          position: relative;
          min-height: 52px;
        }
        
        .nav-btn::after {
          content: '';
          position: absolute;
          bottom: 6px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          transition: all 0.3s ease;
        }
        
        .nav-btn.status-on::after {
          background: #4ade80;
          box-shadow: 0 0 8px #4ade80, 0 0 16px rgba(74,222,128,0.4);
          animation: pulse 2s ease-in-out infinite;
        }
        
        .nav-btn:hover {
          background: linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.1));
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        
        .nav-btn:active {
          animation: buttonPress 0.15s ease;
        }
        
        .nav-btn.active {
          background: linear-gradient(145deg, rgba(66, 135, 245, 0.5), rgba(66, 135, 245, 0.3));
          border-color: rgba(66, 135, 245, 0.6);
          box-shadow: 0 4px 16px rgba(66, 135, 245, 0.3), inset 0 1px 0 rgba(255,255,255,0.2);
        }
        
        .nav-btn-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.4px;
        }
        
        .nav-btn-value {
          font-size: 9px;
          opacity: 0.85;
          font-weight: 500;
        }
        
        .nav-btn-icon {
          font-size: 16px;
          margin-bottom: 2px;
        }
        
        .nav-btn.status-on {
          background: linear-gradient(145deg, rgba(74, 222, 128, 0.3), rgba(34, 197, 94, 0.2));
          border-color: rgba(74, 222, 128, 0.4);
        }
        
        .nav-btn.status-warning {
          background: linear-gradient(145deg, rgba(251, 191, 36, 0.3), rgba(245, 158, 11, 0.2));
          border-color: rgba(251, 191, 36, 0.4);
        }
        
        .nav-btn.status-critical {
          background: linear-gradient(145deg, rgba(239, 68, 68, 0.3), rgba(220, 38, 38, 0.2));
          border-color: rgba(239, 68, 68, 0.4);
          animation: pulse-critical 2s ease-in-out infinite;
        }
        
        @keyframes pulse-critical {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .weather-forecast {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(65px, 1fr));
          gap: 10px;
          padding: 10px 0;
          width: 100%;
        }
        
        .forecast-day {
          background: linear-gradient(165deg, rgba(10,25,50,0.7) 0%, rgba(5,15,35,0.85) 100%);
          border-radius: 10px;
          padding: 10px 8px;
          text-align: center;
          border: 1px solid rgba(100,180,255,0.18);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .forecast-day-name {
          font-size: 10px;
          font-weight: 600;
          opacity: 0.9;
        }
        
        .forecast-icon {
          font-size: 26px;
          margin: 3px 0;
        }
        
        .forecast-temp {
          font-size: 18px;
          font-weight: 200;
        }
        
        .forecast-condition {
          font-size: 9px;
          opacity: 0.8;
          text-transform: capitalize;
        }
        
        .dehumidifier-control {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        
        .dehumidifier-target {
          font-size: 48px;
          font-weight: 200;
          color: #99d6ff;
          text-shadow: 0 2px 12px rgba(0,0,0,0.5);
        }
        
        .dehumidifier-label {
          font-size: 12px;
          opacity: 0.9;
          letter-spacing: 1px;
          font-weight: 600;
        }
        
        .dehumidifier-buttons {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }
        
        .view-hidden {
          display: none !important;
        }
        
        .weather-current {
          font-size: 13px;
          opacity: 0.8;
          text-transform: capitalize;
        }
      </style>
      
      <div class="card-container">
        <div class="header">
          <div class="room-name">${this.config.name}</div>
          <div class="datetime" id="datetime"></div>
          <div class="header-buttons">
            <button class="header-btn" id="weather-toggle-btn">Weather</button>
          </div>
        </div>
        
        <div class="main-content">
          <div class="temp-section">
            <div class="temp-display" id="temp-display">
              <div class="current-temp">
                <span id="current-temp">--</span><span class="temp-unit">°</span>
              </div>
              <div class="detail-group">
                <div class="section-label" id="location-label">Indoor</div>
                <div class="detail-line" id="humidity">Humidity: --%</div>
                <div class="detail-line" id="indoor-feels-like">Feels Like: --°</div>
              </div>
            </div>

            <div class="mode-fan-controls">
              <button class="mode-fan-btn active" id="mode-btn">
                <div class="mode-fan-btn-label">MODE</div>
                <div class="mode-fan-btn-value" id="mode-value">AUTO</div>
              </button>
              <button class="mode-fan-btn" id="fan-btn">
                <div class="mode-fan-btn-label">FAN</div>
                <div class="mode-fan-btn-value" id="fan-value">CIRC</div>
              </button>
            </div>
          </div>
          
          <div class="controls" id="thermostat-controls">
            <div class="heat-cool">
              <div class="temp-control">
                <div class="temp-control-label">HEAT</div>
                <div class="temp-control-value heat" id="heat-temp">--</div>
                <button class="temp-btn" id="heat-up-btn">▲</button>
                <button class="temp-btn" id="heat-down-btn">▼</button>
              </div>
              <div class="temp-control">
                <div class="temp-control-label">COOL</div>
                <div class="temp-control-value cool" id="cool-temp">--</div>
                <button class="temp-btn" id="cool-up-btn">▲</button>
                <button class="temp-btn" id="cool-down-btn">▼</button>
              </div>
            </div>
            <div class="hold-status-btn" id="hold-status-btn">
              <span class="hold-mode-text" id="hold-mode-text">--</span>
            </div>
            <div class="hold-confirm-overlay" id="hold-confirm-overlay">
              <div class="hold-confirm-dialog">
                <div class="hold-confirm-text">Clear hold and resume schedule?</div>
                <div class="hold-confirm-buttons">
                  <button class="hold-confirm-yes" id="hold-confirm-yes">YES</button>
                  <button class="hold-confirm-cancel" id="hold-confirm-cancel">Cancel</button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="controls view-hidden" id="weather-view">
            <div class="weather-forecast" id="weather-forecast"></div>
          </div>
          
          <div class="controls view-hidden" id="dehumidifier-view">
            <div class="dehumidifier-control">
              <div class="dehumidifier-label">TARGET HUMIDITY</div>
              <div class="dehumidifier-target"><span id="dehumidifier-target">--</span>%</div>
              <div class="dehumidifier-buttons">
                <button class="temp-btn" id="dehum-up-btn">▲</button>
                <button class="temp-btn" id="dehum-down-btn">▼</button>
              </div>
            </div>
          </div>
          
          <div class="right-section">
            <div class="outdoor-display" id="outdoor-display">
              <div class="outdoor-section">
                <div class="outdoor-temp">
                  <span id="outdoor-temp">--</span><span class="temp-unit" style="font-size: 14px;">°</span>
                </div>
                <div class="detail-group">
                  <div class="section-label" id="outdoor-label">Outdoor</div>
                  <div class="detail-line" id="outdoor-humidity">Humidity: --%</div>
                  <div class="detail-line" id="outdoor-feels-like">Feels Like: --°</div>
                </div>
              </div>
            </div>
            <div class="side-controls" id="side-controls"></div>
          </div>
        </div>
        
        <div class="bottom-nav" id="bottom-nav"></div>
      </div>
    `;
    
    console.log('Ecobee Buzz Card: Render complete');
    this.content = this.shadowRoot.querySelector('.card-container');
    this.renderSideControls();
    this.renderBottomButtons();
    this.setupEventListeners();
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 60000);
  }

  setupEventListeners() {
    // Weather button - open more-info popup
    const weatherBtn = this.shadowRoot.getElementById('weather-toggle-btn');
    if (weatherBtn && this.config.weather_entity) {
      weatherBtn.addEventListener('click', () => {
        const event = new Event('hass-more-info', {
          bubbles: true,
          composed: true
        });
        event.detail = { entityId: this.config.weather_entity };
        this.dispatchEvent(event);
      });
    }
    
    // Mode button
    const modeBtn = this.shadowRoot.getElementById('mode-btn');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => this.cycleMode());
    }
    
    // Fan button
    const fanBtn = this.shadowRoot.getElementById('fan-btn');
    if (fanBtn) {
      fanBtn.addEventListener('click', () => this.cycleFan());
    }
    
    // Temperature adjustment buttons
    const heatUpBtn = this.shadowRoot.getElementById('heat-up-btn');
    const heatDownBtn = this.shadowRoot.getElementById('heat-down-btn');
    const coolUpBtn = this.shadowRoot.getElementById('cool-up-btn');
    const coolDownBtn = this.shadowRoot.getElementById('cool-down-btn');
    
    if (heatUpBtn) heatUpBtn.addEventListener('click', () => this.adjustTemp('heat', 1));
    if (heatDownBtn) heatDownBtn.addEventListener('click', () => this.adjustTemp('heat', -1));
    if (coolUpBtn) coolUpBtn.addEventListener('click', () => this.adjustTemp('cool', 1));
    if (coolDownBtn) coolDownBtn.addEventListener('click', () => this.adjustTemp('cool', -1));
    
    // Dehumidifier adjustment buttons
    const dehumUpBtn = this.shadowRoot.getElementById('dehum-up-btn');
    const dehumDownBtn = this.shadowRoot.getElementById('dehum-down-btn');

    if (dehumUpBtn) dehumUpBtn.addEventListener('click', () => this.adjustDehumidifier(5));
    if (dehumDownBtn) dehumDownBtn.addEventListener('click', () => this.adjustDehumidifier(-5));

    // Hold status button
    const holdBtn = this.shadowRoot.getElementById('hold-status-btn');
    if (holdBtn) {
      holdBtn.addEventListener('click', () => {
        if (!this.config.clear_hold_entity) return;
        if (!holdBtn.classList.contains('has-hold')) return;
        const overlay = this.shadowRoot.getElementById('hold-confirm-overlay');
        if (overlay) overlay.classList.add('visible');
      });
    }

    // Hold confirmation - YES
    const holdYes = this.shadowRoot.getElementById('hold-confirm-yes');
    if (holdYes) {
      holdYes.addEventListener('click', () => this.clearHold());
    }

    // Hold confirmation - Cancel
    const holdCancel = this.shadowRoot.getElementById('hold-confirm-cancel');
    if (holdCancel) {
      holdCancel.addEventListener('click', () => {
        const overlay = this.shadowRoot.getElementById('hold-confirm-overlay');
        if (overlay) overlay.classList.remove('visible');
      });
    }
  }

  renderSideControls() {
    const sideControls = this.shadowRoot.getElementById('side-controls');
    if (!sideControls) return;

    let html = '';
    const hvacAction = this._hass && this._hass.states[this.config.entity]
      ? this._hass.states[this.config.entity].attributes.hvac_action || 'idle'
      : 'idle';

    // 1. HVAC Status button (always shown)
    html += `
      <button class="side-btn thermostat-3" id="hvac-status-btn">
        <span class="side-btn-icon">🌡️</span>
        <span class="side-btn-text">${this.config.name}<br/><span class="side-btn-label" id="hvac-action-label">${hvacAction}</span></span>
      </button>
    `;

    // 2. Dehumidifier button (if configured)
    if (this.config.dehumidifier_entity) {
      html += `
        <button class="side-btn humidity" id="dehumidifier-btn">
          <span class="side-btn-icon">💧</span>
          <span class="side-btn-text">Dehumidifier<br/><span class="side-btn-label" id="dehumidifier-status-label">Control</span></span>
        </button>
      `;
    }

    // 3. ERV button (if configured)
    if (this.config.erv_entity) {
      const ervState = this._hass && this._hass.states[this.config.erv_entity]
        ? this._hass.states[this.config.erv_entity].state
        : 'unknown';
      html += `
        <button class="side-btn erv" id="erv-btn">
          <span class="side-btn-icon">💨</span>
          <span class="side-btn-text">ERV<br/><span class="side-btn-label" id="erv-status-label">${ervState}</span></span>
        </button>
      `;
    }

    sideControls.innerHTML = html;

    // Event listeners
    const hvacBtn = this.shadowRoot.getElementById('hvac-status-btn');
    if (hvacBtn) {
      hvacBtn.addEventListener('click', () => {
        const event = new Event('hass-more-info', { bubbles: true, composed: true });
        event.detail = { entityId: this.config.entity };
        this.dispatchEvent(event);
      });
    }

    if (this.config.dehumidifier_entity) {
      const dehumBtn = this.shadowRoot.getElementById('dehumidifier-btn');
      if (dehumBtn) {
        dehumBtn.addEventListener('click', () => this.toggleDehumidifier());
      }
    }

    if (this.config.erv_entity) {
      const ervBtn = this.shadowRoot.getElementById('erv-btn');
      if (ervBtn) {
        ervBtn.addEventListener('click', () => {
          const event = new Event('hass-more-info', { bubbles: true, composed: true });
          event.detail = { entityId: this.config.erv_entity };
          this.dispatchEvent(event);
        });
      }
    }
  }

  renderBottomButtons() {
    const bottomNav = this.shadowRoot.getElementById('bottom-nav');
    if (!bottomNav) return;
    
    let html = '';
    const buttons = this.config.bottom_buttons || [];
    const totalButtons = 5;
    
    for (let i = 0; i < totalButtons; i++) {
      const button = buttons[i];
      if (button) {
        const icon = button.icon || '';
        html += `
          <button class="nav-btn" id="bottom-btn-${i}">
            ${icon ? `<div class="nav-btn-icon">${icon}</div>` : ''}
            <div class="nav-btn-label">${button.label || 'BUTTON ' + (i + 1)}</div>
            <div class="nav-btn-value" id="bottom-btn-${i}-value">--</div>
          </button>
        `;
      } else {
        html += `
          <button class="nav-btn" id="bottom-btn-${i}" style="opacity: 0.3;">
            <div class="nav-btn-label">EMPTY</div>
            <div class="nav-btn-value">--</div>
          </button>
        `;
      }
    }
    
    bottomNav.innerHTML = html;
    
    // Add event listeners for bottom buttons
    for (let i = 0; i < totalButtons; i++) {
      if (buttons[i]) {
        const btn = this.shadowRoot.getElementById(`bottom-btn-${i}`);
        if (btn) {
          btn.addEventListener('click', () => this.handleBottomButton(i));
        }
      }
    }
  }

  updateDateTime() {
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
    const formatted = now.toLocaleString('en-US', options);
    const datetimeEl = this.shadowRoot.getElementById('datetime');
    if (datetimeEl) {
      datetimeEl.textContent = formatted;
    }
  }

  update() {
    if (!this._hass) return;
    console.log('Main update called - viewMode:', this.viewMode, 'isAdjusting:', this.isAdjusting);
    this.updateThermostat();
    this.updateHoldStatus();
    this.updateDehumidifier();
    this.updateWeather();
    this.updateBottomButtons();
  }

  updateThermostat() {
    if (!this.activeEntity) return;
    const entity = this._hass.states[this.activeEntity];
    if (!entity) return;
    
    const currentTempEl = this.shadowRoot.getElementById('current-temp');
    const heatTempEl = this.shadowRoot.getElementById('heat-temp');
    const coolTempEl = this.shadowRoot.getElementById('cool-temp');
    const humidityEl = this.shadowRoot.getElementById('humidity');
    const modeValueEl = this.shadowRoot.getElementById('mode-value');
    const fanValueEl = this.shadowRoot.getElementById('fan-value');
    const outdoorTempEl = this.shadowRoot.getElementById('outdoor-temp');
    const outdoorHumidityEl = this.shadowRoot.getElementById('outdoor-humidity');
    const modeBtnEl = this.shadowRoot.getElementById('mode-btn');
    const fanBtnEl = this.shadowRoot.getElementById('fan-btn');
    
    if (currentTempEl) currentTempEl.textContent = Math.round(entity.attributes.current_temperature || 0);
    
    // Handle temperature display based on mode
    const currentMode = entity.state;
    if (currentMode === 'heat_cool' || currentMode === 'auto') {
      if (heatTempEl) heatTempEl.textContent = Math.round(entity.attributes.target_temp_low || 70);
      if (coolTempEl) coolTempEl.textContent = Math.round(entity.attributes.target_temp_high || 75);
    } else if (currentMode === 'heat') {
      if (heatTempEl) heatTempEl.textContent = Math.round(entity.attributes.temperature || entity.attributes.target_temp_low || 70);
      if (coolTempEl) coolTempEl.textContent = '--';
    } else if (currentMode === 'cool') {
      if (heatTempEl) heatTempEl.textContent = '--';
      if (coolTempEl) coolTempEl.textContent = Math.round(entity.attributes.temperature || entity.attributes.target_temp_high || 75);
    } else {
      if (heatTempEl) heatTempEl.textContent = '--';
      if (coolTempEl) coolTempEl.textContent = '--';
    }
    
    if (humidityEl && entity.attributes.current_humidity) humidityEl.textContent = `Humidity: ${entity.attributes.current_humidity}%`;

    const fanMode = entity.attributes.fan_mode || 'auto';
    const hvacMode = entity.state || 'off';
    if (modeValueEl) modeValueEl.textContent = hvacMode.toUpperCase().replace('_', ' ');
    if (fanValueEl) fanValueEl.textContent = fanMode.toUpperCase();
    
    if (modeBtnEl) {
      modeBtnEl.classList.toggle('active', hvacMode !== 'off');
    }
    
    const outdoorTempEntity = this._hass.states[this.config.outdoor_temperature];
    const outdoorHumidityEntity = this._hass.states[this.config.outdoor_humidity];
    
    if (outdoorTempEl && outdoorTempEntity) {
      outdoorTempEl.textContent = Math.round(parseFloat(outdoorTempEntity.state));
    }
    if (outdoorHumidityEl && outdoorHumidityEntity) {
      outdoorHumidityEl.textContent = `Humidity: ${Math.round(parseFloat(outdoorHumidityEntity.state))}%`;
    }
    
    // Update feels-like temperatures
    const indoorFeelsLikeEl = this.shadowRoot.getElementById('indoor-feels-like');
    const outdoorFeelsLikeEl = this.shadowRoot.getElementById('outdoor-feels-like');
    
    if (indoorFeelsLikeEl && this.config.indoor_heat_index) {
      const indoorHeatIndexEntity = this._hass.states[this.config.indoor_heat_index];
      if (indoorHeatIndexEntity) {
        indoorFeelsLikeEl.textContent = `Feels Like: ${Math.round(parseFloat(indoorHeatIndexEntity.state))}°`;
      }
    }
    
    if (outdoorFeelsLikeEl && this.config.outdoor_heat_index) {
      const outdoorHeatIndexEntity = this._hass.states[this.config.outdoor_heat_index];
      if (outdoorHeatIndexEntity && outdoorHeatIndexEntity.state && outdoorHeatIndexEntity.state !== 'unavailable' && !isNaN(outdoorHeatIndexEntity.state)) {
        outdoorFeelsLikeEl.textContent = `Feels Like: ${Math.round(parseFloat(outdoorHeatIndexEntity.state))}°`;
      } else {
        outdoorFeelsLikeEl.textContent = 'Feels Like: --°';
      }
    }
    
    // Update HVAC status side button
    const hvacActionLabel = this.shadowRoot.getElementById('hvac-action-label');
    if (hvacActionLabel) {
      const hvacAction = entity.attributes.hvac_action || 'idle';
      hvacActionLabel.textContent = hvacAction;
      const hvacBtn = this.shadowRoot.getElementById('hvac-status-btn');
      if (hvacBtn) {
        hvacBtn.classList.toggle('active', hvacAction !== 'idle');
      }
    }

    // Update ERV status if configured
    if (this.config.erv_entity) {
      const ervEntity = this._hass.states[this.config.erv_entity];
      const ervLabel = this.shadowRoot.getElementById('erv-status-label');
      if (ervLabel && ervEntity) {
        ervLabel.textContent = ervEntity.state;
      }
      const ervBtn = this.shadowRoot.getElementById('erv-btn');
      if (ervBtn && ervEntity) {
        ervBtn.classList.toggle('active', ervEntity.state === 'on');
      }
    }
  }

  updateHoldStatus() {
    const holdBtn = this.shadowRoot.getElementById('hold-status-btn');
    if (!holdBtn) return;

    const holdText = this.shadowRoot.getElementById('hold-mode-text');

    // If no hold_status_entity configured, just show PROGRAM
    if (!this.config.hold_status_entity) {
      holdBtn.className = 'hold-status-btn';
      if (holdText) holdText.textContent = 'PROGRAM';
      return;
    }

    const holdEntity = this._hass.states[this.config.hold_status_entity];

    if (!holdEntity || holdEntity.state === 'unavailable') {
      holdBtn.className = 'hold-status-btn';
      if (holdText) holdText.textContent = 'PROGRAM';
      this._clearingHold = false;
      return;
    }

    const isActive = holdEntity.attributes.active === true ||
      (holdEntity.state !== 'None' && holdEntity.state !== 'none' && holdEntity.state !== '');

    // If we're in clearing mode, stay greyed out until the hold state
    // actually changes — either the hold clears entirely, or the end
    // time changes (indicating beestat has synced new data)
    if (this._clearingHold) {
      const stateChanged = holdEntity.state !== this._holdSnapshotState;
      const endDateChanged = (holdEntity.attributes.end_date || null) !== this._holdSnapshotEndDate;
      const endTimeChanged = (holdEntity.attributes.end_time || null) !== this._holdSnapshotEndTime;
      const holdCleared = !isActive;

      if (holdCleared || stateChanged || endDateChanged || endTimeChanged) {
        // Hold status has changed — exit clearing mode
        this._clearingHold = false;
        this._holdSnapshotState = null;
        this._holdSnapshotEndDate = null;
        this._holdSnapshotEndTime = null;
      } else {
        // No change yet — keep the button greyed out
        holdBtn.className = 'hold-status-btn clearing';
        if (holdText) {
          holdText.innerHTML = '<span class="hold-line1">CLEARING...</span>';
        }
        return;
      }
    }

    if (isActive) {
      holdBtn.className = 'hold-status-btn has-hold';
      if (holdText) {
        const duration = this.formatHoldDuration(holdEntity);
        holdText.innerHTML = '<span class="hold-line1">HOLD</span><span class="hold-line2">' + duration + '</span>';
      }
    } else {
      holdBtn.className = 'hold-status-btn';
      if (holdText) holdText.textContent = 'PROGRAM';
    }
  }

  formatHoldDuration(holdEntity) {
    const attrs = holdEntity.attributes || {};

    // Check indefinite attribute first
    if (attrs.indefinite === true) {
      return 'Indefinite';
    }

    // Combine end_date + end_time from BuzzBridge attributes
    if (attrs.end_date && attrs.end_time) {
      const end = new Date(`${attrs.end_date}T${attrs.end_time}`);
      const diffMs = end - new Date();
      if (diffMs <= 0) return 'Expiring';
      return this.formatDuration(diffMs);
    }

    // Check for single end time attribute
    const endTime = attrs.hold_until || attrs.expires || null;
    if (endTime) {
      const end = new Date(endTime);
      if (!isNaN(end)) {
        const diffMs = end - new Date();
        if (diffMs <= 0) return 'Expiring';
        return this.formatDuration(diffMs);
      }
    }

    // Strip "hold" prefix from state for fallback display
    const cleaned = holdEntity.state.replace(/^hold\s*/i, '').trim();
    const lower = cleaned.toLowerCase();
    if (lower === 'permanent' || lower === 'indefinite' || lower === 'true' || lower === '') {
      return 'Indefinite';
    }

    return cleaned || 'Indefinite';
  }

  formatDuration(ms) {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const days = Math.round(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''}`;
  }

  // ---------------------------------------------------------------------------
  // Clear Hold — Data Update Timing
  // ---------------------------------------------------------------------------
  // IMPORTANT: BuzzBridge data is NOT real-time. Unlike the HomeKit climate
  // entity (which updates temperature, HVAC mode, etc. locally in near
  // real-time), BuzzBridge pulls data from the beestat.io API, which in turn
  // syncs from ecobee's cloud servers. This means there is an inherent delay
  // chain when something changes on the thermostat:
  //
  //   1. User clears hold via HomeKit button  (~instant)
  //   2. ecobee cloud registers the change    (~5-30 seconds)
  //   3. beestat.io syncs from ecobee         (~up to 3 minutes, server-side cache)
  //   4. BuzzBridge polls from beestat         (default every 5 min, boost every 60s)
  //   5. Hold status sensor updates in HA      (~instant after step 4)
  //
  // Total delay can be anywhere from ~30 seconds to ~8 minutes depending on
  // where each system is in its sync cycle. There is no way to force beestat
  // to update faster — it has a server-side cache of approximately 3 minutes.
  //
  // Strategy to minimize perceived delay:
  //   a) Immediately activate boost polling (60s intervals for 60 min) so
  //      BuzzBridge checks beestat frequently instead of every 5 minutes
  //   b) After 20 seconds, trigger a one-time full refresh — this gives
  //      ecobee and beestat time to sync, and catches the change on the
  //      first available window
  //   c) Even if the 20s refresh misses it, boost polling continues every
  //      60 seconds and will pick it up on a subsequent cycle
  //
  // The "CLEARING..." text shows immediately as visual feedback so the user
  // knows the action was received, even though the hold status sensor may
  // take up to a few minutes to reflect the change.
  // ---------------------------------------------------------------------------

  clearHold() {
    const overlay = this.shadowRoot.getElementById('hold-confirm-overlay');
    if (overlay) overlay.classList.remove('visible');

    if (!this._hass || !this.config.clear_hold_entity) return;

    // Snapshot current hold state so updateHoldStatus() can detect when
    // the hold actually changes (cleared, or end time differs)
    const holdEntity = this._hass.states[this.config.hold_status_entity];
    if (holdEntity) {
      this._clearingHold = true;
      this._holdSnapshotState = holdEntity.state;
      this._holdSnapshotEndDate = holdEntity.attributes.end_date || null;
      this._holdSnapshotEndTime = holdEntity.attributes.end_time || null;
    }

    // Step 1: Press the HomeKit clear hold button on the thermostat
    this._hass.callService('button', 'press', {
      entity_id: this.config.clear_hold_entity
    });

    // Step 2: Activate BuzzBridge boost polling (every 60s for 60 min)
    // This ensures frequent checks against beestat so we catch the
    // change as soon as beestat's cache refreshes
    this.triggerBoostPolling();

    // Step 3: After 20 seconds, trigger a full one-time data refresh
    // 20s allows time for ecobee cloud to register the change and for
    // beestat's cache to potentially expire — this is our best-case shot
    // at catching it quickly. If missed, boost polling retries every 60s.
    setTimeout(() => this.triggerRefreshNow(), 20000);

    // Grey out the button and disable interaction until hold status changes
    const holdBtn = this.shadowRoot.getElementById('hold-status-btn');
    if (holdBtn) holdBtn.className = 'hold-status-btn clearing';

    const holdText = this.shadowRoot.getElementById('hold-mode-text');
    if (holdText) {
      holdText.innerHTML = '<span class="hold-line1">CLEARING...</span>';
    }
  }

  triggerBoostPolling() {
    if (!this._hass || !this.config.boost_polling_entity) return;
    // Activates BuzzBridge fast polling — switches from the default 5-min
    // interval to every 60 seconds for 60 minutes, then auto-reverts.
    // Pressing again while already boosted resets the 60-minute timer.
    this._hass.callService('button', 'press', {
      entity_id: this.config.boost_polling_entity
    });
  }

  triggerRefreshNow() {
    if (!this._hass || !this.config.refresh_now_entity) return;
    // Triggers an immediate one-time refresh of ALL BuzzBridge data
    // (both fast and slow poll data) without changing polling intervals.
    // Note: This fetches whatever beestat currently has cached — if
    // beestat hasn't synced from ecobee yet, the data will be stale.
    this._hass.callService('button', 'press', {
      entity_id: this.config.refresh_now_entity
    });
  }

  updateDehumidifier() {
    if (!this.config.dehumidifier_entity) return;
    
    const entity = this._hass.states[this.config.dehumidifier_entity];
    if (!entity) return;
    
    console.log('updateDehumidifier called, isAdjusting:', this.isAdjusting, 'entity humidity:', entity.attributes.humidity);
    
    // Skip update if we're currently adjusting to prevent conflicts
    if (this.isAdjusting) {
      console.log('Skipping update - adjustment in progress');
      return;
    }
    
    const statusLabelEl = this.shadowRoot.getElementById('dehumidifier-status-label');
    const dehumidifierBtn = this.shadowRoot.getElementById('dehumidifier-btn');
    const targetEl = this.shadowRoot.getElementById('dehumidifier-target');
    
    if (statusLabelEl) {
      statusLabelEl.textContent = entity.state === 'on' ? 'ON' : 'Control';
    }
    
    if (dehumidifierBtn) {
      if (entity.state === 'on') {
        dehumidifierBtn.classList.add('active');
      } else {
        dehumidifierBtn.classList.remove('active');
      }
    }
    
    // Check for both possible attribute names
    const targetHumidity = entity.attributes.humidity || entity.attributes.target_humidity;
    if (targetEl && targetHumidity) {
      console.log('Setting target display to:', targetHumidity);
      targetEl.textContent = targetHumidity;
    }
    
    if (this.viewMode === 'dehumidifier') {
      const currentTempEl = this.shadowRoot.getElementById('current-temp');
      const humidityEl = this.shadowRoot.getElementById('humidity');
      const locationLabel = this.shadowRoot.getElementById('location-label');
      
      const currentHumidity = entity.attributes.current_humidity || entity.attributes.humidity;
      if (currentTempEl && currentHumidity) currentTempEl.textContent = Math.round(currentHumidity);
      if (humidityEl && targetHumidity) humidityEl.textContent = `Target: ${targetHumidity}%`;
      if (locationLabel) locationLabel.textContent = 'Dehumidifier';
    }
  }

  updateWeather() {
    console.log('updateWeather called, viewMode:', this.viewMode);
    
    const weatherEntity = this._hass.states[this.config.weather_entity];
    console.log('Weather entity:', this.config.weather_entity, weatherEntity);
    
    if (!weatherEntity) {
      console.error('Weather entity not found:', this.config.weather_entity);
      return;
    }
    
    if (this.viewMode === 'weather') {
      // Update left panel with current weather
      const currentTempEl = this.shadowRoot.getElementById('current-temp');
      const humidityEl = this.shadowRoot.getElementById('humidity');
      const indoorFeelsLikeEl = this.shadowRoot.getElementById('indoor-feels-like');
      const locationLabel = this.shadowRoot.getElementById('location-label');
      const outdoorLabel = this.shadowRoot.getElementById('outdoor-label');

      if (currentTempEl && weatherEntity.attributes.temperature) {
        currentTempEl.textContent = Math.round(weatherEntity.attributes.temperature);
      }
      if (humidityEl && weatherEntity.attributes.humidity) {
        humidityEl.textContent = `Humidity: ${weatherEntity.attributes.humidity}%`;
      }
      if (indoorFeelsLikeEl && weatherEntity.state) {
        indoorFeelsLikeEl.textContent = weatherEntity.state.charAt(0).toUpperCase() + weatherEntity.state.slice(1).replace('-', ' ');
      }
      if (locationLabel) {
        locationLabel.textContent = 'Current Weather';
      }
      if (outdoorLabel && weatherEntity.attributes.attribution) {
        outdoorLabel.textContent = 'Pirate weather';
      }
      
      // Update forecast in center panel
      if (!weatherEntity.attributes.forecast) {
        console.error('No forecast data in weather entity:', weatherEntity);
        return;
      }
      
      const forecastContainer = this.shadowRoot.getElementById('weather-forecast');
      if (!forecastContainer) {
        console.error('Weather forecast container not found');
        return;
      }
      
      let html = '';
      const forecast = weatherEntity.attributes.forecast.slice(0, 7);
      console.log('Rendering forecast for', forecast.length, 'days');
      
      forecast.forEach(day => {
        const date = new Date(day.datetime);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const icon = this.getWeatherIcon(day.condition);
        
        html += `
          <div class="forecast-day">
            <div class="forecast-day-name">${dayName}</div>
            <div class="forecast-icon">${icon}</div>
            <div class="forecast-temp">${Math.round(day.temperature)}°</div>
            <div class="forecast-condition">${day.condition.replace('-', ' ')}</div>
          </div>
        `;
      });
      
      forecastContainer.innerHTML = html;
      console.log('Weather forecast rendered');
    }
  }

  getWeatherIcon(condition) {
    const icons = {
      'clear-night': '🌙', 'cloudy': '☁️', 'fog': '🌫️', 'hail': '🧊',
      'lightning': '⚡', 'lightning-rainy': '⛈️', 'partlycloudy': '⛅',
      'pouring': '🌧️', 'rainy': '🌦️', 'snowy': '🌨️',
      'snowy-rainy': '🌨️', 'sunny': '☀️', 'windy': '💨',
      'windy-variant': '💨', 'exceptional': '⚠️'
    };
    return icons[condition] || '🌤️';
  }

  updateBottomButtons() {
    const buttons = this.config.bottom_buttons || [];
    buttons.forEach((button, index) => {
      if (!button.entity) return;
      
      const valueEl = this.shadowRoot.getElementById(`bottom-btn-${index}-value`);
      const btnEl = this.shadowRoot.getElementById(`bottom-btn-${index}`);
      if (!valueEl || !btnEl) return;
      
      const entity = this._hass.states[button.entity];
      if (!entity) {
        valueEl.textContent = '--';
        btnEl.style.background = '';
        return;
      }
      
      // Get value from attribute or state
      let rawValue = button.attribute ? entity.attributes[button.attribute] : entity.state;
      let displayValue = rawValue;
      
      // Format numeric values
      if (!isNaN(rawValue)) {
        const numValue = parseFloat(rawValue);
        displayValue = button.decimal_places !== undefined 
          ? numValue.toFixed(button.decimal_places)
          : Math.round(numValue);
      }
      
      // Add unit if specified
      if (button.unit) {
        displayValue = `${displayValue}${button.unit}`;
      }
      
      // Update display
      valueEl.textContent = displayValue.toUpperCase ? displayValue.toUpperCase() : displayValue;
      
      // Apply color thresholds
      btnEl.style.background = '';
      btnEl.classList.remove('status-on', 'status-warning', 'status-critical');
      
      if (button.thresholds && !isNaN(rawValue)) {
        const numValue = parseFloat(rawValue);
        const thresholds = button.thresholds;
        
        if (thresholds.critical_low !== undefined && numValue <= thresholds.critical_low) {
          btnEl.classList.add('status-critical');
        } else if (thresholds.critical_high !== undefined && numValue >= thresholds.critical_high) {
          btnEl.classList.add('status-critical');
        } else if (thresholds.warning_low !== undefined && numValue <= thresholds.warning_low) {
          btnEl.classList.add('status-warning');
        } else if (thresholds.warning_high !== undefined && numValue >= thresholds.warning_high) {
          btnEl.classList.add('status-warning');
        } else {
          btnEl.classList.add('status-on');
        }
      } else if (entity.state === 'on') {
        btnEl.classList.add('status-on');
      }
    });
  }

  toggleWeather() {
    console.log('Weather toggle clicked, current mode:', this.viewMode);
    const weatherView = this.shadowRoot.getElementById('weather-view');
    const thermostatControls = this.shadowRoot.getElementById('thermostat-controls');
    const dehumidifierView = this.shadowRoot.getElementById('dehumidifier-view');
    const weatherBtn = this.shadowRoot.getElementById('weather-toggle-btn');
    
    console.log('Elements found:', {
      weatherView: !!weatherView,
      thermostatControls: !!thermostatControls,
      dehumidifierView: !!dehumidifierView,
      weatherBtn: !!weatherBtn
    });
    
    if (this.viewMode === 'weather') {
      console.log('Switching back to thermostat');
      this.viewMode = 'thermostat';
      weatherView.classList.add('view-hidden');
      thermostatControls.classList.remove('view-hidden');
      dehumidifierView.classList.add('view-hidden');
      weatherBtn.classList.remove('active');
      const locationLabel = this.shadowRoot.getElementById('location-label');
      const outdoorLabel = this.shadowRoot.getElementById('outdoor-label');
      if (locationLabel) locationLabel.textContent = 'Indoor';
      if (outdoorLabel) outdoorLabel.textContent = 'Outdoor';
      this.updateThermostat();
    } else {
      console.log('Switching to weather');
      this.viewMode = 'weather';
      weatherView.classList.remove('view-hidden');
      thermostatControls.classList.add('view-hidden');
      dehumidifierView.classList.add('view-hidden');
      weatherBtn.classList.add('active');
      this.updateWeather();
    }
  }

  toggleDehumidifier() {
    if (!this.config.dehumidifier_entity) return;
    
    const weatherView = this.shadowRoot.getElementById('weather-view');
    const thermostatControls = this.shadowRoot.getElementById('thermostat-controls');
    const dehumidifierView = this.shadowRoot.getElementById('dehumidifier-view');
    const weatherBtn = this.shadowRoot.getElementById('weather-toggle-btn');
    
    if (this.viewMode === 'dehumidifier') {
      this.viewMode = 'thermostat';
      weatherView.classList.add('view-hidden');
      thermostatControls.classList.remove('view-hidden');
      dehumidifierView.classList.add('view-hidden');
      weatherBtn.classList.remove('active');
      const locationLabel = this.shadowRoot.getElementById('location-label');
      const outdoorLabel = this.shadowRoot.getElementById('outdoor-label');
      if (locationLabel) locationLabel.textContent = 'Indoor';
      if (outdoorLabel) outdoorLabel.textContent = 'Outdoor';
      this.updateThermostat();
    } else {
      this.viewMode = 'dehumidifier';
      weatherView.classList.add('view-hidden');
      thermostatControls.classList.add('view-hidden');
      dehumidifierView.classList.remove('view-hidden');
      weatherBtn.classList.remove('active');
      this.updateDehumidifier();
    }
  }

  adjustDehumidifier(delta) {
    console.log('🔴 BUTTON CLICKED! adjustDehumidifier called with delta:', delta);
    
    if (!this.config.dehumidifier_entity) {
      console.error('No dehumidifier entity configured');
      return;
    }

    const entity = this._hass.states[this.config.dehumidifier_entity];
    if (!entity) {
      console.error('Dehumidifier entity not found:', this.config.dehumidifier_entity);
      return;
    }
    
    console.log('=== ADJUST DEHUMIDIFIER STARTED ===');
    console.log('Dehumidifier entity state:', entity);
    
    // Get current humidity from entity attributes
    const currentHumidity = entity.attributes.humidity || entity.attributes.target_humidity || 50;
    
    // Use the entity's min/max values instead of hardcoded limits
    const minHumidity = entity.attributes.min_humidity || 30;
    const maxHumidity = entity.attributes.max_humidity || 80;
    
    const newHumidity = Math.max(minHumidity, Math.min(maxHumidity, currentHumidity + delta));
    
    console.log('Adjusting dehumidifier:', {
      entity_id: this.config.dehumidifier_entity,
      current: currentHumidity,
      min: minHumidity,
      max: maxHumidity,
      new: newHumidity,
      delta: delta
    });
    
    // Set flag to prevent update conflicts
    this.isAdjusting = true;
    
    // Use the EXACT same format as the working climate service calls
    console.log('🔵 About to call service with data:', {
      domain: 'humidifier',
      service: 'set_humidity',
      entity_id: this.config.dehumidifier_entity,
      humidity: newHumidity
    });
    
    console.log('🔵 Current value in entity:', entity.attributes.humidity);
    console.log('🔵 New value to set:', newHumidity);
    console.log('🔵 Change amount:', newHumidity - currentHumidity);
    
    this._hass.callService('humidifier', 'set_humidity', {
      entity_id: this.config.dehumidifier_entity,
      humidity: newHumidity
    });
    
    console.log('🔵 Service call dispatched, waiting for entity to update...');
    
    // Update display after delay
    setTimeout(() => {
      const updatedEntity = this._hass.states[this.config.dehumidifier_entity];
      console.log('🔵 After 2 seconds, entity humidity is:', updatedEntity ? updatedEntity.attributes.humidity : 'entity not found');
      console.log('Updating display after service call');
      this.isAdjusting = false;
      this.updateDehumidifier();
    }, 2000);
  }

  handleBottomButton(index) {
    const button = this.config.bottom_buttons[index];
    if (!button) return;
    
    // Handle more-info action (opens entity popup)
    if (button.tap_action && button.tap_action.action === 'more-info') {
      const event = new Event('hass-more-info', {
        bubbles: true,
        composed: true
      });
      event.detail = { entityId: button.entity };
      this.dispatchEvent(event);
      return;
    }
    
    // Handle call-service action
    if (button.tap_action && button.tap_action.action === 'call-service') {
      const serviceParts = button.tap_action.service.split('.');
      this._hass.callService(serviceParts[0], serviceParts[1], button.tap_action.service_data || {});
      return;
    }
    
    // Default: toggle the entity
    if (button.entity) {
      const entity = this._hass.states[button.entity];
      if (!entity) return;
      const domain = button.entity.split('.')[0];
      this._hass.callService(domain, 'toggle', { entity_id: button.entity });
    }
  }

  adjustTemp(type, delta) {
    if (!this._hass || !this.activeEntity) {
      console.error('Cannot adjust temp: _hass or activeEntity missing');
      return;
    }
    
    const entity = this._hass.states[this.activeEntity];
    if (!entity) {
      console.error('Cannot adjust temp: entity not found', this.activeEntity);
      return;
    }
    
    const currentMode = entity.state;
    console.log('Adjusting temp:', { type, delta, currentMode, entity: this.activeEntity });
    
    // For auto/heat_cool mode, we need to send both temperatures
    if (currentMode === 'heat_cool' || currentMode === 'auto') {
      const currentHeat = entity.attributes.target_temp_low || entity.attributes.temperature || 70;
      const currentCool = entity.attributes.target_temp_high || entity.attributes.temperature || 75;
      
      console.log('Auto mode adjustment:', { currentHeat, currentCool, type, delta });
      
      if (type === 'heat') {
        const newHeat = currentHeat + delta;
        console.log('Setting heat to:', newHeat, 'keeping cool at:', currentCool);
        this._hass.callService('climate', 'set_temperature', {
          entity_id: this.activeEntity,
          target_temp_low: newHeat,
          target_temp_high: currentCool
        }).catch(err => console.error('Heat adjustment failed:', err));
      } else if (type === 'cool') {
        const newCool = currentCool + delta;
        console.log('Setting cool to:', newCool, 'keeping heat at:', currentHeat);
        this._hass.callService('climate', 'set_temperature', {
          entity_id: this.activeEntity,
          target_temp_low: currentHeat,
          target_temp_high: newCool
        }).catch(err => console.error('Cool adjustment failed:', err));
      }
    } else {
      // For heat or cool only mode, just send temperature
      if (type === 'heat' && currentMode === 'heat') {
        const currentTemp = entity.attributes.temperature || entity.attributes.target_temp_low || 70;
        const newTemp = currentTemp + delta;
        console.log('Heat-only mode, setting temp to:', newTemp);
        this._hass.callService('climate', 'set_temperature', {
          entity_id: this.activeEntity,
          temperature: newTemp
        }).catch(err => console.error('Heat-only adjustment failed:', err));
      } else if (type === 'cool' && currentMode === 'cool') {
        const currentTemp = entity.attributes.temperature || entity.attributes.target_temp_high || 75;
        const newTemp = currentTemp + delta;
        console.log('Cool-only mode, setting temp to:', newTemp);
        this._hass.callService('climate', 'set_temperature', {
          entity_id: this.activeEntity,
          temperature: newTemp
        }).catch(err => console.error('Cool-only adjustment failed:', err));
      } else {
        console.warn('Temperature adjustment ignored: mode is', currentMode, 'but trying to adjust', type);
      }
    }
  }

  cycleMode() {
    if (!this._hass || !this.activeEntity) return;
    const entity = this._hass.states[this.activeEntity];
    if (!entity) return;
    
    const modes = entity.attributes.hvac_modes || ['off', 'heat', 'cool', 'auto'];
    const currentMode = entity.state;
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    
    this._hass.callService('climate', 'set_hvac_mode', {
      entity_id: this.activeEntity,
      hvac_mode: nextMode
    });
  }

  cycleFan() {
    if (!this._hass || !this.activeEntity) return;
    
    const entity = this._hass.states[this.activeEntity];
    if (!entity) return;
    
    const fanModes = entity.attributes.fan_modes || ['auto', 'on'];
    const currentFan = entity.attributes.fan_mode || 'auto';
    const currentIndex = fanModes.indexOf(currentFan);
    const nextFan = fanModes[(currentIndex + 1) % fanModes.length];
    
    this._hass.callService('climate', 'set_fan_mode', {
      entity_id: this.activeEntity,
      fan_mode: nextFan
    });
  }
}

console.log('Ecobee Buzz Card: Defining custom element...');
customElements.define('ecobee-buzz-card', EcobeeBuzzCard);
console.log('Ecobee Buzz Card: Custom element defined successfully!');

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ecobee-buzz-card',
  name: 'Ecobee Buzz Card',
  description: 'Climate control card for ecobee thermostats with HomeKit and BuzzBridge integration'
});
console.log('Ecobee Buzz Card: Registered with Home Assistant');
