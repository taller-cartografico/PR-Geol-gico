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
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#a0522d', // Terracota on hover
        '#b8c4bc'  // Niebla (muted slate) for base
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.8,
        0.4
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

  // Click popup
  map.on('click', 'geology-fill', (e) => {
    const feature = e.features[0];
    const coordinates = e.lngLat;
    
    // Feature properties from KML conversion
    const name = feature.properties.name || 'Unknown Unit';
    // The KML description has HTML. We'll extract it or just embed it.
    let description = '';
    if (typeof feature.properties.description === 'string') {
      description = feature.properties.description;
    } else if (feature.properties.description && feature.properties.description.value) {
      description = feature.properties.description.value;
    }

    // Remove the inline styling and let CSS handle it
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

    new maplibregl.Popup()
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);
  });

  // Change cursor to pointer
  map.on('mouseenter', 'geology-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'geology-fill', () => {
    map.getCanvas().style.cursor = '';
  });
});
