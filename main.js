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
    generateId: true, // Needed for feature state (hover effects)
    attribution: '<a href="https://mrdata.usgs.gov/geology/pr/" target="_blank">Geology Data © USGS</a>'
  });

  // We add the Municipios GeoJSON source
  map.addSource('municipios', {
    type: 'geojson',
    data: import.meta.env.BASE_URL + 'municipios.geojson'
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

  // Mask layer to dim everything EXCEPT the selected municipio
  map.addLayer({
    id: 'municipios-mask',
    type: 'fill',
    source: 'municipios',
    filter: ['!=', 'municipio', ''],
    paint: {
      'fill-color': '#2c2c28', // Carbón
      'fill-opacity': 0.0 // Initially hidden
    }
  });

  // Make the mask act like a clickable background
  map.on('mouseenter', 'municipios-mask', () => {
    if (map.getPaintProperty('municipios-mask', 'fill-opacity') > 0) {
      map.getCanvas().style.cursor = 'pointer';
    }
  });
  map.on('mouseleave', 'municipios-mask', () => {
    map.getCanvas().style.cursor = '';
  });

  // Click on mask to intuitively clear the focus
  map.on('click', 'municipios-mask', (e) => {
    if (map.getPaintProperty('municipios-mask', 'fill-opacity') > 0) {
      // Prevent geology click from firing underneath
      e.preventDefault(); 
      const select = document.getElementById('municipio-select');
      if (select) {
        select.value = '';
        select.dispatchEvent(new Event('change'));
      }
    }
  });

  // Stroke layer for the selected municipio
  map.addLayer({
    id: 'municipios-stroke',
    type: 'line',
    source: 'municipios',
    filter: ['==', 'municipio', ''],
    paint: {
      'line-color': '#ffffff', // Pure white stroke
      'line-width': 3,
      'line-opacity': 0.0 // Initially hidden
    }
  });

  // Fetch and populate the Dropdown
  fetch(import.meta.env.BASE_URL + 'municipios.geojson')
    .then(res => res.json())
    .then(data => {
      const select = document.getElementById('municipio-select');
      if (!select) return;
      
      const names = new Set();
      data.features.forEach(f => {
        if (f.properties && f.properties.municipio) {
          names.add(f.properties.municipio);
        }
      });
      
      Array.from(names).sort().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.innerText = m;
        select.appendChild(opt);
      });

      select.addEventListener('change', (e) => {
        const selected = e.target.value;
        if (!selected) {
          map.setPaintProperty('municipios-mask', 'fill-opacity', 0);
          map.setPaintProperty('municipios-stroke', 'line-opacity', 0);
          map.flyTo({ center: [-66.45, 18.2], zoom: 8 });
          return;
        }
        
        // Update layers to show mask and stroke
        map.setFilter('municipios-mask', ['!=', 'municipio', selected]);
        map.setPaintProperty('municipios-mask', 'fill-opacity', 0.85); // Darken others heavily
        
        map.setFilter('municipios-stroke', ['==', 'municipio', selected]);
        map.setPaintProperty('municipios-stroke', 'line-opacity', 1.0);
        
        // Find feature and calculate bounds
        const feature = data.features.find(f => f.properties.municipio === selected);
        if (feature) {
          let coords = [];
          if (feature.geometry.type === 'MultiPolygon') {
             coords = feature.geometry.coordinates.flat(2);
          } else if (feature.geometry.type === 'Polygon') {
             coords = feature.geometry.coordinates.flat(1);
          }
          
          if (coords.length > 0) {
            let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
            coords.forEach(c => {
              if (c[0] < minLng) minLng = c[0];
              if (c[0] > maxLng) maxLng = c[0];
              if (c[1] < minLat) minLat = c[1];
              if (c[1] > maxLat) maxLat = c[1];
            });
            map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50 });
          }
        }
      });
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

  // Side Panel logic
  const infoPanel = document.getElementById('info-panel');
  const infoContent = document.getElementById('info-content');
  const closeBtn = document.getElementById('close-panel');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      infoPanel.classList.add('closed');
    });
  }

  let currentAnimation = null;

  function runAnimationAndShowData(feature, durationMs) {
    if (infoPanel) infoPanel.classList.remove('closed');
    
    if (currentAnimation) clearInterval(currentAnimation);

    if (infoContent) {
      infoContent.innerHTML = `
        <div class="scan-container">
          <h3 style="font-family: var(--font-hanken); margin: 0; color: var(--primary);">Analizando Terreno</h3>
          <div class="scan-progress-bar">
            <div id="scan-fill" class="scan-progress-fill"></div>
          </div>
          <div style="font-family: var(--font-mono); font-size: 24px; font-weight: bold; color: var(--secondary);" id="scan-pct">0%</div>
        </div>
      `;
    }

    let progress = 0;
    const ticks = 50;
    const intervalMs = durationMs / ticks;

    currentAnimation = setInterval(() => {
      progress += 2;
      const pctEl = document.getElementById('scan-pct');
      const fillEl = document.getElementById('scan-fill');
      
      if (pctEl && fillEl) {
        pctEl.innerText = Math.floor(progress) + '%';
        fillEl.style.width = progress + '%';
      }

      if (progress >= 100) {
        clearInterval(currentAnimation);
        currentAnimation = null;
        renderFeatureData(feature);
      }
    }, intervalMs);
  }

  // Helper to render data in the side panel
  function renderFeatureData(feature) {
    if (!infoContent) return;
    
    if (!feature) {
      infoContent.innerHTML = '<div class="geology-data"><h3>Sin Datos</h3><p class="body-sm">No se encontraron datos geológicos aquí.</p></div>';
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

    infoContent.innerHTML = `
      <div class="geology-data">
        <h3>${name}</h3>
        ${description}
      </div>
    `;
  }

  // Click on geology
  map.on('click', 'geology-fill', (e) => {
    // If mask is active and we clicked on it, we shouldn't trigger geology
    if (e.defaultPrevented) return;
    
    // 2-second animation for normal map clicks
    runAnimationAndShowData(e.features[0], 2000);
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
        
        // 6-second animation for GPS scan
        runAnimationAndShowData(null, 6000);
        
        setTimeout(() => {
          scanBtn.disabled = false;
          scanBtn.innerText = 'Escanear Mi Ubicación';
          const point = map.project(coords);
          const features = map.queryRenderedFeatures(point, { layers: ['geology-fill'] });
          if (features.length > 0 && !currentAnimation) {
             renderFeatureData(features[0]);
          } else if (features.length > 0) {
             // Let the animation finish and use the feature
             clearInterval(currentAnimation);
             runAnimationAndShowData(features[0], 0); // instantly show
          }
        }, 6100);
        
      }, (err) => {
        alert('No pudimos obtener tu ubicación. Asegúrate de dar permisos de GPS al navegador.');
        scanBtn.disabled = false;
        scanBtn.innerText = 'Escanear Mi Ubicación';
      }, { enableHighAccuracy: true });
    });
  }

  // OpenStreetMap Nominatim Search Bar Logic
  const placeSearch = document.getElementById('place-search');
  const searchResults = document.getElementById('search-results');
  let searchTimeout = null;

  if (placeSearch && searchResults) {
    placeSearch.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      if (searchTimeout) clearTimeout(searchTimeout);
      
      if (query.length < 3) {
        searchResults.innerHTML = '';
        searchResults.classList.add('hidden');
        return;
      }
      
      // Debounce the API call to avoid hitting rate limits
      searchTimeout = setTimeout(() => {
        // Fetch from Nominatim restricted to Puerto Rico
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=pr&limit=5`;
        
        fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'PuertoRicoGeologyExplorer/1.0' // Nominatim asks for User-Agent
          }
        })
          .then(res => res.json())
          .then(data => {
            searchResults.innerHTML = '';
            
            if (data.length === 0) {
              const li = document.createElement('li');
              li.innerText = 'No se encontraron resultados';
              li.style.color = 'var(--on-surface-variant)';
              li.style.cursor = 'default';
              searchResults.appendChild(li);
              searchResults.classList.remove('hidden');
              return;
            }
            
            data.forEach(item => {
              const li = document.createElement('li');
              li.innerText = item.display_name;
              li.addEventListener('click', () => {
                // Clear any active masks
                const select = document.getElementById('municipio-select');
                if (select && select.value !== '') {
                  select.value = '';
                  select.dispatchEvent(new Event('change'));
                }
                
                // Fly to the coordinates
                map.flyTo({ center: [parseFloat(item.lon), parseFloat(item.lat)], zoom: 15, speed: 1.2 });
                
                // Clear the search UI
                placeSearch.value = item.display_name.split(',')[0]; // Just show the short name
                searchResults.innerHTML = '';
                searchResults.classList.add('hidden');
              });
              searchResults.appendChild(li);
            });
            
            searchResults.classList.remove('hidden');
          })
          .catch(err => {
            console.error('Search error:', err);
          });
      }, 500); // 500ms debounce
    });

    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
      if (!placeSearch.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
      }
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
