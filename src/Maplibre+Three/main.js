import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import maplibregl, { AttributionControl } from 'maplibre-gl';

const map = new maplibregl.Map({
  container: 'maplibreContainer',
  style: '../../resources/styles/satellite-flat.json',
  zoom: 3,
  center: [-98.74, 56.415],
  pitch: 0,
  canvasContextAttributes: { antialias: true }, // create the gl context with MSAA antialiasing, so custom layers are antialiased
});

// Go To Site 🏢
const goTo = document.getElementById('go-to');
let toggleGoTo = true;
goTo.onclick = function () {
  if (toggleGoTo) {
    this.setAttribute('title', 'Go to Canada');
    // Fly to Carleton
    flyTo(map, -75.697, 45.384, 15.5);
  } else {
    this.setAttribute('title', 'Go to site');
    // Fly to Canada
    flyTo(map, -98.74, 56.415, 3, 0);
  }
  toggleGoTo = !toggleGoTo;
};

// Map Style
// Toggle Map view
const mapView = document.getElementById('map-view');
let toggleMapView = true;
mapView.onclick = function () {
  if (toggleMapView) {
    this.setAttribute('title', 'Satellite view');
    map.setStyle('../../resources/styles/streets.json');
  } else {
    this.setAttribute('title', 'Map view');
    map.setStyle('../../resources/styles/satellite-flat.json');
  }
  toggleMapView = !toggleMapView;
};

// parameters to ensure the model is georeferenced correctly on the map
const modelOrigin = [-75.697, 45.384];
const modelAltitude = 0; // altitude in meters
const modelRotate = [Math.PI / 2, 0, 0];

const modelAsMercatorCoordinate = maplibregl.MercatorCoordinate.fromLngLat(
  modelOrigin,
  modelAltitude
);

// transformation parameters to position, rotate and scale the 3D model onto the map
const modelTransform = {
  translateX: modelAsMercatorCoordinate.x,
  translateY: modelAsMercatorCoordinate.y,
  translateZ: modelAsMercatorCoordinate.z,
  rotateX: modelRotate[0],
  rotateY: modelRotate[1],
  rotateZ: modelRotate[2],
  /* Since our 3D model is in real world meters, a scale transform needs to be
   * applied since the CustomLayerInterface expects units in MercatorCoordinates.
   */
  scale: modelAsMercatorCoordinate.meterInMercatorCoordinateUnits() * 2,
};

// configuration of the custom layer for a 3D model per the CustomLayerInterface
const customLayer = {
  id: '3d-model',
  type: 'custom',
  renderingMode: '3d',
  onAdd(map, gl) {
    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();

    // create two three.js lights to illuminate the model
    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(0, -70, 100).normalize();
    this.scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff);
    directionalLight2.position.set(0, 70, 100).normalize();
    this.scene.add(directionalLight2);

    // use the three.js GLTF loader to add the 3D model to the three.js scene
    const loader = new GLTFLoader();
    loader.load(
      'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
      (gltf) => {
        this.scene.add(gltf.scene);
      }
    );
    this.map = map;

    // use the MapLibre GL JS map canvas for three.js
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });

    this.renderer.autoClear = false;
  },
  render(gl, args) {
    const rotationX = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(1, 0, 0),
      modelTransform.rotateX
    );
    const rotationY = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(0, 1, 0),
      modelTransform.rotateY
    );
    const rotationZ = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(0, 0, 1),
      modelTransform.rotateZ
    );

    const m = new THREE.Matrix4().fromArray(
      args.defaultProjectionData.mainMatrix
    );
    const l = new THREE.Matrix4()
      .makeTranslation(
        modelTransform.translateX,
        modelTransform.translateY,
        modelTransform.translateZ
      )
      .scale(
        new THREE.Vector3(
          modelTransform.scale,
          -modelTransform.scale,
          modelTransform.scale
        )
      )
      .multiply(rotationX)
      .multiply(rotationY)
      .multiply(rotationZ);

    // Alternatively, you can use this API to get the correct model matrix.
    // It will work regardless of current projection.
    // Also see the example "globe-3d-model.html".
    //
    // const modelMatrix = args.getMatrixForModel(modelOrigin, modelAltitude);
    // const m = new THREE.Matrix4().fromArray(matrix);
    // const l = new THREE.Matrix4().fromArray(modelMatrix);

    this.camera.projectionMatrix = m.multiply(l);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  },
};

map.on('style.load', () => {
  map.setProjection({
    type: 'globe', // Set projection to globe
  });
  map.addLayer(customLayer);
});

// FUNCTIONS _____________________________________________________________________________________________________

function flyTo(map, lng, lat, zoom = 15, pitch = 50, bearing = 0) {
  map.flyTo({
    center: [lng, lat],
    zoom: zoom,
    pitch: pitch,
    duration: 2000,
  });
}
