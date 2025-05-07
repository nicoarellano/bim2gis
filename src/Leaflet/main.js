initLeaflet();

function initLeaflet() {
  let map = L.map('leaflet-map').setView([56.415, -98.74], 4);

  let satellite = L.tileLayer(
    'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    {
      maxZoom: 24,
      attribution: 'Google Satellite',
    }
  );

  let streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });

  satellite.addTo(map);

  // Go To Site 🏢
  const goTo = document.getElementById('go-to');
  let toggleGoTo = true;
  goTo.onclick = function () {
    if (toggleGoTo) {
      this.setAttribute('title', 'Go to Canada');
      // Fly to Carleton
      map.flyTo([45.384, -75.697], 15);
    } else {
      this.setAttribute('title', 'Go to site');
      // Fly to Canada
      map.flyTo([56.415, -98.74], 5);
    }
    toggleGoTo = !toggleGoTo;
  };

  // Map Style
  // Toggle Map view
  const mapView = document.getElementById('map-view');
  let toggleMapView = true;
  mapView.onclick = function () {
    if (toggleMapView) {
      map.removeLayer(satellite);
      const mapIcon = document.getElementById('map-icon');
      this.setAttribute('title', 'Satellite view');
      streets.addTo(map);
    } else {
      map.removeLayer(streets);
      const mapIcon = document.getElementById('map-icon');
      this.setAttribute('title', 'Map view');
      satellite.addTo(map);
    }
    toggleMapView = !toggleMapView;
  };
}
