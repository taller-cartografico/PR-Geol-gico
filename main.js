import './style.css';
import maplibregl from 'maplibre-gl';

const rockImages = {
  basalt: { label: 'Basalto', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Basalt_Rock_Formation_-_geograph.org.uk_-_180882.jpg' },
  limestone: { label: 'Caliza', url: 'https://upload.wikimedia.org/wikipedia/commons/1/14/Limestone_from_Ohio.jpg' },
  sandstone: { label: 'Arenisca', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Sandstone_%281%29.jpg' },
  tuff: { label: 'Toba', url: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Tuff_%28volcanic_ash%29.jpg' },
  breccia: { label: 'Brecha', url: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Basalt_breccia.jpg' },
  andesite: { label: 'Andesita', url: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Andesite_close.jpg' },
  mudstone: { label: 'Lodolita', url: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Mudstone.JPG' },
  granodiorite: { label: 'Granodiorita', url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Granodiorite_-_Half_Dome_California.jpg' },
  diorite: { label: 'Diorita', url: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Diorite.jpg' },
  serpentinite: { label: 'Serpentinita', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Serpentinite.jpg' },
  marble: { label: 'Mármol', url: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Marble_rock.jpg' },
  siltstone: { label: 'Limolita', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Siltstone.jpg' },
  conglomerate: { label: 'Conglomerado', url: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Conglomerate_rock.jpg' },
  sand: { label: 'Arena', url: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Sand_from_Gobi_Desert.jpg' },
  clay: { label: 'Arcilla', url: 'https://upload.wikimedia.org/wikipedia/commons/1/18/Clay_-_Quaternary_%2834375053896%29.jpg' }
};

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

let geologyUnits = {};
fetch(import.meta.env.BASE_URL + 'geology_units.json')
  .then(res => res.json())
  .then(data => { geologyUnits = data; })
  .catch(err => console.error('Error loading geology units:', err));

map.on('load', () => {
  // We add the GeoJSON source
  // The file is created by convert-kml.js
  map.addSource('geology', {
    type: 'geojson',
    data: import.meta.env.BASE_URL + 'prgeol_simplified.geojson',
    generateId: true, // Needed for feature state (hover effects)
    attribution: '<a href="https://mrdata.usgs.gov/geology/pr/" target="_blank">Geology Data © USGS</a>'
  });

  // We add the Municipios GeoJSON source
  map.addSource('municipios', {
    type: 'geojson',
    data: import.meta.env.BASE_URL + 'municipios_simplified.geojson'
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

  // Expand/Collapse Header Logic
  const mainHeader = document.getElementById('main-header');
  const collapseBtn = document.getElementById('collapse-btn');
  const expandBtn = document.getElementById('expand-btn');

  function collapseMenu() {
    if (mainHeader && expandBtn) {
      mainHeader.classList.add('collapsed');
      expandBtn.classList.remove('hidden');
    }
  }

  function expandMenu() {
    if (mainHeader && expandBtn) {
      mainHeader.classList.remove('collapsed');
      expandBtn.classList.add('hidden');
    }
  }

  if (collapseBtn) {
    collapseBtn.addEventListener('click', collapseMenu);
  }
  
  if (expandBtn) {
    expandBtn.addEventListener('click', expandMenu);
  }

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
      expandMenu(); // Auto-expand when clearing focus
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
  fetch(import.meta.env.BASE_URL + 'municipios_simplified.geojson')
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
        
        // Auto-collapse menu to save space
        collapseMenu();
        
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
    
    if (!feature || !feature.properties || !feature.properties.s) {
      infoContent.innerHTML = '<div class="geology-data"><h3>Sin Datos</h3><p class="body-sm">No se encontraron datos geológicos aquí.</p></div>';
      return;
    }
    
    const symbol = feature.properties.s;
    const unit = geologyUnits[symbol];
    
    if (!unit) {
      infoContent.innerHTML = '<div class="geology-data"><h3>Sin Datos</h3><p class="body-sm">No se encontraron datos geológicos aquí.</p></div>';
      return;
    }
    
    const name = `${unit.map_symbol}: ${unit.unit_name}, ${unit.geologic_age}`;
    let tableHtml = `
      <table border="0" cellpadding="4" cellspacing="0" style="width: 100%; text-align: left; border-collapse: collapse;">
        <tr valign="top" style="border-bottom: 1px solid var(--carbon-10);">
          <th style="background-color: var(--surface-variant); color: var(--on-surface); padding: 8px; width: 35%;">Unit name</th>
          <td style="padding: 8px;">${unit.unit_name}</td>
        </tr>
        <tr valign="top" style="border-bottom: 1px solid var(--carbon-10);">
          <th style="background-color: var(--surface-variant); color: var(--on-surface); padding: 8px;">Map symbol</th>
          <td style="padding: 8px;"><a href="https://mrdata.usgs.gov/geology/pr/prgeo-unit.php?unit=${unit.map_symbol}" target="_blank" title="opens in a new window" style="color: var(--primary); font-weight: bold;">${unit.map_symbol}</a></td>
        </tr>
        <tr valign="top" style="border-bottom: 1px solid var(--carbon-10);">
          <th style="background-color: var(--surface-variant); color: var(--on-surface); padding: 8px;">Geologic age</th>
          <td style="padding: 8px;">${unit.geologic_age}</td>
        </tr>
    `;
    if (unit.description) {
      tableHtml += `
        <tr valign="top">
          <th style="background-color: var(--surface-variant); color: var(--on-surface); padding: 8px;">Description</th>
          <td style="padding: 8px; font-size: 0.9em; line-height: 1.4;">${unit.description}</td>
        </tr>
      `;
    }
    tableHtml += `</table>`;

    // Detect rock types from description and unit_name
    let galleryHtml = '';
    const textToSearch = ((unit.unit_name || '') + ' ' + (unit.description || '')).toLowerCase();
    const matchedRocks = [];
    
    for (const [key, data] of Object.entries(rockImages)) {
      if (textToSearch.includes(key)) {
        matchedRocks.push(data);
      }
    }
    
    if (matchedRocks.length > 0) {
      let cardsHtml = matchedRocks.map(rock => `
        <div class="rock-image-card">
          <img src="${rock.url}" alt="${rock.label}" loading="lazy" />
          <div class="rock-label">${rock.label}</div>
        </div>
      `).join('');

      galleryHtml = `
        <div class="rock-gallery-container">
          <div class="rock-gallery-title">Tipos de Rocas Mencionadas</div>
          <div class="rock-gallery-scroll">
            ${cardsHtml}
          </div>
        </div>
      `;
    }

    infoContent.innerHTML = `
      <div class="geology-data">
        <h3>${name}</h3>
        ${tableHtml}
        ${galleryHtml}
        <p class="body-sm" style="margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--carbon-10); color: var(--on-surface-variant); text-align: center;">
          Fuente: United States Geological Survey
        </p>
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
        alert('No pudimos obtener tu ubicación. Asegúrate de dar permisos de GPS al navegador.\\n\\nSi no funciona: Abrir Link en Chrome o Safari para activar ubicación');
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

// Loading Overlay Logic (10 seconds)
const loadingOverlay = document.getElementById('loading-overlay');
const loadingPct = document.getElementById('loading-pct');
const loadingFill = document.getElementById('loading-progress-fill');

if (loadingOverlay) {
  let progress = 0;
  const durationMs = 10000; // 10 seconds
  const intervalMs = 100; // update every 100ms
  const totalTicks = durationMs / intervalMs;
  const increment = 100 / totalTicks;

  const loaderInterval = setInterval(() => {
    progress += increment;
    if (progress > 100) progress = 100;
    
    if (loadingPct && loadingFill) {
      loadingPct.innerText = Math.floor(progress) + '%';
      loadingFill.style.width = progress + '%';
    }

    if (progress === 100) {
      clearInterval(loaderInterval);
      setTimeout(() => {
        loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
          if (loadingOverlay.parentNode) {
            loadingOverlay.parentNode.removeChild(loadingOverlay);
          }
        }, 500); // Wait for CSS transition
      }, 200); // Short pause at 100%
    }
  }, intervalMs);
}
