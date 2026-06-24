import './style.css';
import maplibregl from 'maplibre-gl';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', // A neutral, scientific basemap
  center: [-66.4, 18.2], // Center of Puerto Rico
  zoom: 8,
  pitch: 0,
  maxZoom: 18
});

// Add Geolocation Control
const geolocate = new maplibregl.GeolocateControl({
  positionOptions: {
    enableHighAccuracy: true
  },
  trackUserLocation: true,
  showUserHeading: true
});
map.addControl(geolocate, 'bottom-right');

// Add Navigation Control
map.addControl(new maplibregl.NavigationControl({
  showCompass: true,
  showZoom: true
}), 'bottom-right');

map.on('load', () => {
  // We add the GeoJSON source
  // The file is created by convert-kml.js
  map.addSource('geology', {
    type: 'geojson',
    data: import.meta.env.BASE_URL + 'prgeol.geojson',
    generateId: true // Needed for feature state (hover effects)
  });

  // Fill layer for geology
  map.addLayer({
    id: 'geology-fill',
    type: 'fill',
    source: 'geology',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.8,
        0.6
      ]
    }
  }); // Removed invalid beforeId

  // Outline layer for geology
  map.addLayer({
    id: 'geology-outline',
    type: 'line',
    source: 'geology',
    paint: {
      'line-color': '#2c2c28', // Carbón
      'line-width': 1,
      'line-opacity': 0.3
    }
  });

  let hoveredStateId = null;

  // Hover effect
  map.on('mousemove', 'geology-fill', (e) => {
    if (e.features.length > 0) {
      if (hoveredStateId !== null) {
        map.setFeatureState(
          { source: 'geology', id: hoveredStateId },
          { hover: false }
        );
      }
      hoveredStateId = e.features[0].id;
      map.setFeatureState(
        { source: 'geology', id: hoveredStateId },
        { hover: true }
      );
    }
  });

  map.on('mouseleave', 'geology-fill', () => {
    if (hoveredStateId !== null) {
      map.setFeatureState(
        { source: 'geology', id: hoveredStateId },
        { hover: false }
      );
    }
    hoveredStateId = null;
  });

  // Helper to render popup
  function renderFeaturePopup(feature, coordinates, popup) {
    if (!feature) {
      popup.setHTML('<div class="geology-popup"><h3>Sin Datos</h3><p class="body-sm">No se encontraron datos geológicos aquí.</p></div>');
      return;
    }
    const name = feature.properties.name || 'Unknown Unit';
    let description = '';
    if (typeof feature.properties.description === 'string') {
      try {
        const parsed = JSON.parse(feature.properties.description);
        if (parsed && parsed.value) {
          description = parsed.value;
        } else {
          description = feature.properties.description;
        }
      } catch (err) {
        description = feature.properties.description;
      }
    } else if (feature.properties.description && feature.properties.description.value) {
      description = feature.properties.description.value;
    }
    description = description.replace(/bgcolor="[^"]*"/g, '');
    description = description.replace(/border="0"/g, '');
    description = description.replace(/cellpadding="4"/g, '');
    description = description.replace(/cellspacing="0"/g, '');

    const popupContent = `
      <div class="geology-popup">
        <h3>${name}</h3>
        ${description}
      </div>
    `;
    popup.setHTML(popupContent);
  }

  // Click popup
  map.on('click', 'geology-fill', (e) => {
    const popup = new maplibregl.Popup().setLngLat(e.lngLat).addTo(map);
    renderFeaturePopup(e.features[0], e.lngLat, popup);
  });

  // Animated Scan Button Logic
  const scanBtn = document.getElementById('scan-btn');
  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      scanBtn.disabled = true;
      scanBtn.innerText = 'Escaneando...';
      
      navigator.geolocation.getCurrentPosition((position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        
        // Fly to location
        map.flyTo({ center: coords, zoom: 14, speed: 1.2 });
        
        // Create animated popup
        const popup = new maplibregl.Popup({ closeOnClick: false })
          .setLngLat(coords)
          .setHTML(`
            <div class="scan-container">
              <h3 style="font-family: var(--font-hanken); margin: 0; color: var(--primary);">Analizando Terreno</h3>
              <div class="scan-progress-bar">
                <div id="scan-fill" class="scan-progress-fill"></div>
              </div>
              <div id="scan-msg" class="scan-message">Iniciando escáner...</div>
              <div style="font-family: var(--font-mono); font-size: 24px; font-weight: bold; color: var(--secondary);" id="scan-pct">0%</div>
            </div>
          `)
          .addTo(map);
          
        let progress = 0;
        const messages = ["Extrayendo muestras...", "Analizando estratos...", "Calculando edad geológica...", "Compilando reporte..."];
        
        const interval = setInterval(() => {
          progress += 2; // 50 ticks to 100%
          const pctEl = document.getElementById('scan-pct');
          const fillEl = document.getElementById('scan-fill');
          const msgEl = document.getElementById('scan-msg');
          
          if (pctEl && fillEl && msgEl) {
            pctEl.innerText = Math.floor(progress) + '%';
            fillEl.style.width = progress + '%';
            
            if (progress === 20) msgEl.innerText = messages[0];
            if (progress === 40) msgEl.innerText = messages[1];
            if (progress === 60) msgEl.innerText = messages[2];
            if (progress === 80) msgEl.innerText = messages[3];
          }
          
          if (progress >= 100) {
            clearInterval(interval);
            scanBtn.disabled = false;
            scanBtn.innerText = 'Escanear Mi Ubicación';
            
            // MapLibre needs a frame to render the features at the new location
            setTimeout(() => {
              const point = map.project(coords);
              const features = map.queryRenderedFeatures(point, { layers: ['geology-fill'] });
              renderFeaturePopup(features[0], coords, popup);
            }, 100);
          }
        }, 120); // 120ms * 50 = 6000ms = 6 seconds
        
      }, (err) => {
        alert('No pudimos obtener tu ubicación. Asegúrate de dar permisos de GPS al navegador.');
        scanBtn.disabled = false;
        scanBtn.innerText = 'Escanear Mi Ubicación';
      }, { enableHighAccuracy: true });
    });
  }

  // Change cursor to pointer
  map.on('mouseenter', 'geology-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'geology-fill', () => {
    map.getCanvas().style.cursor = '';
  });
});
