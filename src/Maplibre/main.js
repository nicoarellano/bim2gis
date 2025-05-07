import maplibregl from 'maplibre-gl';

/* Mapbox renders maps and map tiles with Web Mercator projection 
using the EPSG:3857 projected coordinate system 
(sometimes called EPSG:900913)*/

const map = new maplibregl.Map({
  container: 'maplibreContainer', // container ID
  style: '/bim2gis/styles//satellite-flat.json',
  center: [-98.74, 56.415], // starting position [lng, lat]
  zoom: 3, // starting zoom
  antialias: true,
  maplibreLogo: true,
});

// Go To Site 🏢
const goTo = document.getElementById('go-to');
let toggleGoTo = true;
goTo.onclick = function () {
  if (toggleGoTo) {
    this.setAttribute('title', 'Go to Canada');
    // Fly to Carleton
    flyTo(map, -75.697, 45.384);
  } else {
    this.setAttribute('title', 'Go to site');
    // Fly to Canada
    flyTo(map, -98.74, 56.415, 3, 0);
  }
  toggleGoTo = !toggleGoTo;
};

map.on('style.load', () => {
  map.setProjection({
    type: 'globe', // Set projection to globe
  });
});

// Map Style
// Toggle Map view
const mapView = document.getElementById('map-view');
let toggleMapView = true;
mapView.onclick = function () {
  if (toggleMapView) {
    this.setAttribute('title', 'Satellite view');
    map.setStyle('/bim2gis/styles/streets.json');
  } else {
    this.setAttribute('title', 'Map view');
    map.setStyle('/bim2gis/styles/satellite-flat.json');
  }
  toggleMapView = !toggleMapView;
};

// FUNCTIONS _____________________________________________________________________________________________________

function flyTo(map, lng, lat, zoom = 15, pitch = 50) {
  map.flyTo({
    center: [lng, lat],
    zoom: zoom,
    pitch: pitch,
    duration: 2000,
  });
}
