initMapbox();

/* Mapbox renders maps and map tiles with Web Mercator projection 
using the EPSG:3857 projected coordinate system 
(sometimes called EPSG:900913)*/
function initMapbox() {
  mapboxgl.accessToken =
    'pk.eyJ1Ijoibmljby1hcmVsbGFubyIsImEiOiJjbGRkNzV1aDcwMHE5M3ZtcTA4OHZvdnZ2In0.62n_DqnBfOYRz2lNakP8IA';
  const map = new mapboxgl.Map({
    container: 'mapboxContainer', // container ID
    style: '/bim2gis/styles/satellite-flat.json',
    center: [-98.74, 56.415], // starting position [lng, lat]
    zoom: 3.5, // starting zoom
    antialias: true,
    projection: 'globe', // display the map as a 3D globe
  });
  // Day sky
  map.on('style.load', () => {
    map.setFog({}); // Set the default atmosphere style
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
      flyTo(map, -98.74, 56.415, 1.5, 0);
    }
    toggleGoTo = !toggleGoTo;
  };

  // Map Style
  // Toggle Map view
  const mapView = document.getElementById('map-view');
  let toggleMapView = true;
  mapView.onclick = function () {
    if (toggleMapView) {
      const mapIcon = document.getElementById('map-icon');
      // mapIcon.setAttribute('d');
      this.setAttribute('title', 'Satellite view');
      map.setStyle('/bim2gis/styles/streets.json');
    } else {
      const mapIcon = document.getElementById('map-icon');
      this.setAttribute('title', 'Map view');
      map.setStyle('/bim2gis/styles/satellite-flat.json');
    }
    toggleMapView = !toggleMapView;
  };
}

// FUNCTIONS _____________________________________________________________________________________________________

function flyTo(map, lng, lat, zoom = 15, pitch = 50) {
  map.flyTo({
    center: [lng, lat],
    zoom: zoom,
    pitch: pitch,
    duration: 2000,
  });
}
