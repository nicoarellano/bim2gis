// Loading Fragment Models to Maplibre 🔼🌎
/* eslint-disable */
// cSpell: disable

import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import * as WEBIFC from 'web-ifc';
import Stats from 'stats.js';
// You have to import * as FRAGS from "@thatopen/fragments"
import maplibregl, {
  LayerSpecification,
  CustomLayerInterface,
  SourceSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import proj4 from 'proj4';

interface Coords {
  lng: number;
  lat: number;
  OrthogonalHeihgt?: number;
  rotation?: number;
}

// 🌎 Setting up a Simple Scene
const components = new OBC.Components();

const worlds = components.get(OBC.Worlds);
const world = worlds.create<
  OBC.SimpleScene,
  OBC.SimpleCamera,
  OBC.SimpleRenderer
>();

const axesHelper = new THREE.AxesHelper(1000);

world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = null;

const bimContainer = document.getElementById('bim-container') as HTMLElement;
const mapContainer = document.getElementById('map-container') as HTMLElement;
world.renderer = new OBC.SimpleRenderer(components, bimContainer);

world.camera = new OBC.SimpleCamera(components);
let mapCamera = new THREE.PerspectiveCamera();
world.camera.controls.setLookAt(183, 50, -102, 27, -52, -11); // convenient position for the model we will load

components.init();

const grids = components.get(OBC.Grids);
const grid = grids.create(world);
grid.visible = false;
let mapScene = world.scene.three.clone();
grid.visible = true;
world.scene.three.add(axesHelper);

const workerUrl =
  'https://thatopen.github.io/engine_fragment/resources/worker.mjs';
const fetchedWorker = await fetch(workerUrl);
const workerText = await fetchedWorker.text();
const workerFile = new File([new Blob([workerText])], 'worker.mjs', {
  type: 'text/javascript',
});
const url = URL.createObjectURL(workerFile);
const fragments = new FRAGS.FragmentsModels(url);

world.camera.controls.restThreshold = 0.005;
world.camera.controls.addEventListener('rest', () => fragments.update(true));
world.camera.controls.addEventListener('update', () => fragments.update());

interface MapConversions {
  Eastings: number | undefined;
  Northings: number | undefined;
  OrthogonalHeight?: number | undefined;
  XAxisAbscissa?: number | undefined;
  XAxisOrdinate?: number | undefined;
  rotation?: number | undefined;
}
interface IfcData {
  model: FRAGS.FragmentsModel;
  mapConversionValues?: MapConversions;
  epgsCode?: string | null;
  rotationDegrees?: number;
}

// 📂 Loading Fragments Models
let models: FRAGS.FragmentsModel[] = [];
let ifcData: IfcData | null = null;
let model: FRAGS.FragmentsModel;
let bbox: THREE.Box3;

const mouse = new THREE.Vector2();
bimContainer.addEventListener('click', async (event) => {
  if (!model) return;
  model.resetHighlight();
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  if (!model) return;
  const result = await model.raycast({
    mouse,
    camera: currentCamera,
    dom: world.renderer?.three.domElement!,
  });
  if (!result) return;
  const { localId } = result;

  model.highlight([localId], {
    color: new THREE.Color(0xcccc33),
    transparent: false,
    opacity: 1,
    renderedFaces: FRAGS.RenderedFaces.ONE,
  });
  fragments.update(true);
});

let holdPopup = false;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const relocateButton = document.getElementById('relocate') as HTMLButtonElement;
const inputX = document.getElementById('x-input') as HTMLInputElement;
const inputY = document.getElementById('y-input') as HTMLInputElement;

fileInput.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  if (file.name.endsWith('.ifc')) {
    const model = await convertIFC(file);
    if (!model) return;
    const modelData = await getMapConversionData(model);
    if (modelData) {
      const { mapConversionValues } = modelData;
      ifcData = {
        model,
        mapConversionValues,
        rotationDegrees: modelData.rotationDegrees || 0,
      };
    } else {
      console.error('Failed to convert IFC file.');
      return;
    }
  }
  if (file.name.endsWith('.frag')) {
    model = await fragments.load(buffer, {
      modelId: file.name.replace('.frag', ''),
    });
  }
  if (!ifcData) return;
  loadModel(ifcData);
});

const angleSlider = document.getElementById('angle-slider') as HTMLInputElement;
const anglelabel = document.getElementById('angle') as HTMLLabelElement;
const altitudeSlider = document.getElementById(
  'altitude-slider'
) as HTMLInputElement;
const altitudeInput = document.getElementById(
  'altitude-input'
) as HTMLInputElement;
let altitudeInputValue = 0;
altitudeInput?.addEventListener('input', () => {
  altitudeInputValue = parseFloat(altitudeInput.value) || 0;
});

let dynamicAltitude = 0;
let mapElevation = 0;
let modelElevation = 0;

const altitudeLabel = document.getElementById('altitude') as HTMLLabelElement;

const modelTools = document.getElementById('model-tools') as HTMLButtonElement;
const downloadFrag = document.getElementById(
  'download-frag'
) as HTMLButtonElement;

downloadFrag.addEventListener('click', async () => {
  onDownloadModel();
});

const onDownloadModel = async () => {
  const buffer = await model.getBuffer(false);
  const result = { name: model.modelId, buffer };
  if (result) {
    const { name, buffer } = result;
    const a = document.createElement('a');
    const file = new File([buffer], `${name}.frag`);
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
};

const clearUiInputs = () => {
  if (angleSlider) angleSlider.value = '0';
  if (altitudeSlider) altitudeSlider.value = '0';
  if (inputX) inputX.value = '';
  if (inputY) inputY.value = '';
  if (fileInput) fileInput.value = '';
  modelTools.style.display = 'none';
};

/* 🛡️ Prevent Memory Leaks
Here's a utility function to help you manage this effectively */
const disposeModels = async () => {
  clearUiInputs();
  models = [];
  removeModelFromMap();
  world.dispose();
  fragments.dispose();
  window.location.reload();
};

// MAPLIBRE 🌎🌎

const maplibre = new maplibregl.Map({
  container: 'map-container', // container id
  style: '/bim2gis/styles/satellite.json',
  center: [-75.69765955209732, 45.38389669263273], // AA Carleton
  // center: [-123.11, 49.257], // Vancouver
  zoom: 15,
  pitch: 45,
  bearing: 0,
  canvasContextAttributes: { antialias: true },
  attributionControl: false,
  maplibreLogo: true,
  doubleClickZoom: false,
});

async function setMarker(coords: Coords) {
  const source: SourceSpecification = {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {
        description: "<strong>Click to modify Model's coordinates</strong>",
      },
      geometry: {
        type: 'Point',
        coordinates: [coords.lng, coords.lat],
      },
    },
  };

  const image = await maplibre.loadImage(
    '/bim2gis/resources/images/ifc-logo.png'
  );
  if (maplibre.getImage('custom-marker')) maplibre.removeImage('custom-marker');
  maplibre.addImage('custom-marker', image.data);

  const layer: LayerSpecification = {
    id: 'places-layer',
    type: 'symbol',
    source: 'places-source',
    layout: {
      'icon-image': 'custom-marker',
      'icon-overlap': 'always',
      'icon-size': 0.2,
    },
  };
  if (maplibre.getLayer('places-layer')) {
    maplibre.removeLayer('places-layer');
    maplibre.removeSource('places-source');
  }
  maplibre.addSource('places-source', source);
  maplibre.addLayer(layer);
}

const removeModelFromMap = () => {
  maplibre.removeLayer('3d-model');
  maplibre.removeLayer('places-layer');
  maplibre.removeSource('places-source');
  maplibre.removeImage('custom-marker');
};

const loadModel = async (ifcData: IfcData) => {
  const { model, mapConversionValues, rotationDegrees } = ifcData;

  const modelId = model.modelId;

  bbox = model.box;
  await world.camera.controls.fitToBox(bbox, false);

  models.push(model);
  model.useCamera(currentCamera);
  world.scene.three.add(model.object);
  const mapBuffer = await model.getBuffer();
  const mapModel = await fragments.load(mapBuffer, {
    modelId: `${modelId}@map`,
  });
  mapScene.add(mapModel.object);

  fragments.update(true);

  if (mapConversionValues) {
    const { Eastings, Northings, OrthogonalHeight } = mapConversionValues;
    if (!(Eastings && Northings)) return;

    const wgs84Coord = proj4(`EPSG:2951`, 'EPSG:4326', [Eastings, Northings]);
    const [lng, lat] = wgs84Coord;
    coords = {
      lng,
      lat,
      OrthogonalHeihgt: OrthogonalHeight || 0,
      rotation: rotationDegrees || 0,
    };

    setMarker({ lng, lat });
    loadModelToMap(coords);
    modelTools.style.display = 'flex';

    modelElevation = mapConversionValues.OrthogonalHeight ?? 0;
  } else {
    maplibre.getCanvas().style.cursor = 'crosshair';
    holdPopup = true;
  }
};

const removeAll = document.getElementById('remove-all') as HTMLButtonElement;
removeAll.addEventListener('click', async () => {
  await disposeModels();
});

// ⏱️ Measuring the performance

const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.left = '0px';
stats.dom.style.zIndex = 'unset';
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());

let origin = {
  lng: -75.69835199446455,
  lat: 45.38152527897171,
};
let coords: Coords;

// Relocate button to set new coordinates
relocateButton.addEventListener('click', () => {
  const x = parseFloat(inputX.value);
  const y = parseFloat(inputY.value);
  if (!(x && y)) return;

  // Detect if the input coordinates are in longitude/latitude or another CRS
  const isLngLat = (x: number, y: number): boolean => {
    return x >= -180 && x <= 180 && y >= -90 && y <= 90;
  };

  if (isLngLat(x, y)) {
    coords = { lng: x, lat: y };
  } else {
    const [lng, lat] = proj4(`EPSG:2951`, 'EPSG:4326', [x, y]);
    coords = { lng, lat };
  }

  loadModelToMap(coords);
  setMarker(coords);
});

let sceneOrigin = new maplibregl.LngLat(origin.lng, origin.lat);

const layerRenderer = new THREE.WebGLRenderer({
  canvas: maplibre.getCanvas(),
  context: maplibre.getCanvas().getContext('webgl') as WebGLRenderingContext,
  alpha: true,
});

const popup = new maplibregl.Popup({
  closeButton: false,
  closeOnClick: false,
});

fragments.models.list.onItemSet.add(async ({ value: model }) => {
  model.useCamera(currentCamera);
  const geometry = model.object;
  world.scene.three.add(geometry);
  fragments.update(true);
});

let bimCamera = world.camera.three;
let currentCamera = bimCamera;

async function loadModelToMap(coords: Coords) {
  const { lng, lat, rotation, OrthogonalHeihgt: elevation } = coords;
  mapElevation = elevation ?? maplibre.queryTerrainElevation(coords) ?? 0;
  sceneOrigin = new maplibregl.LngLat(lng, lat);
  angleSlider.value = String(rotation) ?? 0;

  const modelAsMercatorCoordinate = maplibregl.MercatorCoordinate.fromLngLat(
    coords,
    mapElevation
  );

  if (maplibre.getLayer('3d-model')) {
    maplibre.removeLayer('3d-model');
  }

  maplibre.on('mousemove', () => {
    world.camera.three = mapCamera;
    fragments.update();
  });
  bimContainer.addEventListener('mouseenter', () => {
    currentCamera = bimCamera as THREE.PerspectiveCamera;
    world.camera.three = bimCamera;
  });
  maplibre.on('mouseenter', () => {
    world.camera.controls.setLookAt(183, 50, -102, 27, -52, -11);
    if (bbox) world.camera.controls.fitToBox(bbox, false);
    fragments.update();
  });

  const customLayer: CustomLayerInterface = {
    id: '3d-model',
    type: 'custom',
    renderingMode: '3d',

    onAdd() {
      layerRenderer.autoClear = false;
      angleSlider.value = rotation?.toString() ?? '0';
      anglelabel.textContent = angleSlider.value.toString();
      const terrainElevation = maplibre.queryTerrainElevation(coords) ?? 0;
      altitudeLabel.textContent = terrainElevation.toString();
    },

    render(_, matrix) {
      const angleNumber = parseFloat(angleSlider.value);
      const angleInRadians = (angleNumber * Math.PI) / -180;

      const altitudeValue = altitudeSlider.value;
      const altitudeNumber = parseFloat(altitudeValue);
      dynamicAltitude = altitudeNumber;

      const terrainElevation = maplibre.queryTerrainElevation(coords) ?? 0;
      let altitude = terrainElevation + dynamicAltitude;
      if (altitudeInputValue) altitude = altitudeInputValue;

      altitudeLabel.textContent = altitude.toFixed(2).toString();
      altitudeInput?.addEventListener('input', () => {
        altitude = parseFloat(altitudeInput.value) || 0;
      });

      const sceneOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(
        sceneOrigin,
        modelElevation
      );

      const sceneTransform = {
        translateX: modelAsMercatorCoordinate.x,
        translateY: modelAsMercatorCoordinate.y,
        translateZ: maplibregl.MercatorCoordinate.fromLngLat(coords, altitude)
          .z,
        scale: sceneOriginMercator.meterInMercatorCoordinateUnits(),
      };

      const rotationX = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2
      );
      const rotationY = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(0, 1, 0),
        angleInRadians
      );

      const m = new THREE.Matrix4().fromArray(
        matrix.defaultProjectionData.mainMatrix
      );
      const dynamicTransform = {
        x: sceneTransform.translateX,
        y: sceneTransform.translateY,
        z: sceneTransform.translateZ,
      };

      const l = new THREE.Matrix4()
        .makeTranslation(
          dynamicTransform.x,
          dynamicTransform.y,
          dynamicTransform.z
        )
        .scale(
          new THREE.Vector3(
            sceneTransform.scale,
            -sceneTransform.scale,
            sceneTransform.scale
          )
        )
        .multiply(rotationX)
        .multiply(rotationY);

      mapCamera.projectionMatrix = m.multiply(l);
      layerRenderer.resetState();

      layerRenderer.render(mapScene, mapCamera);
      maplibre.triggerRepaint();
    },
  };

  maplibre.addLayer(customLayer);

  if (!maplibre.getLayer('3d-model')) maplibre.addLayer(customLayer);

  maplibre.on('mouseenter', 'places-layer', (e) => {
    maplibre.getCanvas().style.cursor = 'pointer';
    if (!(e.features && 'properties' in e.features[0])) return;
    const properties = e.features[0].properties as { description: string };
    const description = properties.description;

    if (!holdPopup) {
      popup
        .setLngLat(e.lngLat)
        .setHTML(description as string)
        .addTo(maplibre);
    }
    maplibre.getCanvas().style.cursor = '';
  });

  maplibre.on('click', 'places-layer', (e) => {
    maplibre.getCanvas().style.cursor = 'crosshair';
    const description =
      '<strong>Double click on the map to set new coordinates</strong>';
    popup.setLngLat(e.lngLat).setHTML(description).addTo(maplibre);

    holdPopup = true;
  });

  maplibre.on('mouseleave', 'places-layer', () => {
    if (!holdPopup) {
      maplibre.getCanvas().style.cursor = '';
      popup.remove();
    }
  });

  // ✈️ Fly to the building location
  maplibre.flyTo({
    center: [coords.lng, coords.lat],
    zoom: 18.5,
    speed: 2, // Adjust the speed of the flyTo animation
    curve: 1.42, // Adjust the curve of the flyTo animation
    easing: (t) => t, // Linear easing
  });
}

maplibre.on('dblclick', (e) => {
  if (holdPopup) {
    loadModelToMap(e.lngLat);
    setMarker(e.lngLat);
    popup.remove();
    modelTools.style.display = 'flex';

    maplibre.getCanvas().style.cursor = '';

    holdPopup = false;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    holdPopup = false;
    maplibre.getCanvas().style.cursor = '';
  }
});

// Resizing the map and BIM canvas dynamically
let isResizing = false;
const slider = document.getElementById('canvas-slider') as HTMLElement;
slider.onmousedown = () => startResizing();

export function startResizing() {
  isResizing = true;
  document.addEventListener('mousemove', resize);
  document.addEventListener('mouseup', stopResizing);
}

function resize(event: MouseEvent): void {
  if (!(isResizing && bimContainer)) return;
  const totalWidth = bimContainer.parentElement!.offsetWidth;
  const newWidth = (event.clientX / totalWidth) * 100;
  bimContainer.style.width = `${newWidth}%`;
  mapContainer.style.width = `${100 - newWidth}%`;
  slider.style.left = `${newWidth}%`;
  updateWorldAspect();
}

function stopResizing(): void {
  isResizing = false;
  document.removeEventListener('mousemove', resize);
  document.removeEventListener('mouseup', stopResizing);
}

const bimViewerButton = document.getElementById(
  'bim-viewer'
) as HTMLButtonElement;
const mapViewerButton = document.getElementById(
  'map-viewer'
) as HTMLButtonElement;
const twoViewersButton = document.getElementById(
  'two-viewers'
) as HTMLButtonElement;

function updateWorldAspect() {
  setTimeout(() => world.camera.updateAspect(), 0);
}

bimViewerButton.addEventListener('click', () => {
  bimContainer.style.width = '100%';
  mapContainer.style.width = '0%';
  slider.style.left = '100%';
  updateWorldAspect();
});

mapViewerButton.addEventListener('click', () => {
  bimContainer.style.width = '0%';
  mapContainer.style.width = '100%';
  slider.style.left = '0%';
  updateWorldAspect();
});

twoViewersButton.addEventListener('click', () => {
  bimContainer.style.width = '1%';
  mapContainer.style.width = '99%';
  slider.style.left = '1%';
  updateWorldAspect();
});

// PROJ4 to convert between coordinate systems -------------------------------
// PROJ4 Definitions
const currentCoord = maplibre.getCenter();
const { lng } = currentCoord;
const zone = Math.floor((lng + 180) / 6) + 1;

proj4.defs(
  `EPSG:269${zone}`,
  `+proj=utm +zone=${zone} +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs`
);

proj4.defs(
  'EPSG:2951',
  '+proj=tmerc +lat_0=0 +lon_0=-76.5 +k=0.9999 +x_0=304800 +y_0=0 +ellps=GRS80 +towgs84=-0.991,1.9072,0.5129,-1.25033e-07,-4.6785e-08,-5.6529e-08,0 +units=m +no_defs +type=crs'
);

const serializer = new FRAGS.IfcImporter();
serializer.classes.abstract.add(WEBIFC.IFCMAPCONVERSION);

serializer.wasm = { absolute: true, path: 'https://unpkg.com/web-ifc@0.0.68/' };
let fragmentBytes: ArrayBuffer | null = null;
let onConversionFinish = () => {
  document.getElementById('loading')!.style.display = 'none';
};

async function convertIFC(file: File): Promise<FRAGS.FragmentsModel | null> {
  const ifcBuffer = await file.arrayBuffer();

  const ifcBytes = new Uint8Array(ifcBuffer);
  // @ts-ignore
  fragmentBytes = await serializer.process({ bytes: ifcBytes });
  const modelId = file.name.replace('.ifc', '');
  if (!fragmentBytes) return null;

  const model = await fragments.load(fragmentBytes, { modelId });
  return model;
}

const getMapConversionData = async (
  model: FRAGS.FragmentsModel
): Promise<IfcData | null> => {
  const ifcMapConversion = await model.getItemsOfCategory('IFCMAPCONVERSION');
  if (ifcMapConversion.length === 0) return { model };

  const localIds = (
    await Promise.all(ifcMapConversion.map((item) => item.getLocalId()))
  ).filter((localId) => localId !== null) as number[];
  if (localIds.length === 0) return null;

  const ifcMapConversionData = await model.getItemsData(localIds);

  let mapConversionValues: MapConversions = {} as MapConversions;

  const keys: (keyof MapConversions)[] = [
    'Eastings',
    'Northings',
    'OrthogonalHeight',
    'XAxisAbscissa',
    'XAxisOrdinate',
  ];

  for (const key of keys) {
    if (ifcMapConversionData[0][key]) {
      const attribute = ifcMapConversionData[0][key];
      if (attribute && !Array.isArray(attribute) && 'value' in attribute) {
        mapConversionValues[key] = attribute.value;
      }
    }
  }

  const rotation = ifcDirectionToDegrees(
    mapConversionValues.XAxisAbscissa,
    mapConversionValues.XAxisOrdinate
  );

  const rotationDegrees = rotation ?? 0;
  onConversionFinish();
  return { model, mapConversionValues, rotationDegrees };
};

export function ifcDirectionToDegrees(
  XAxisAbscissa?: number,
  XAxisOrdinate?: number
): number {
  if (XAxisAbscissa === undefined || XAxisOrdinate === undefined) {
    return 0;
  }

  const degrees = (Math.atan2(XAxisOrdinate, XAxisAbscissa) * 180) / Math.PI;
  return (degrees + 360) % 360; // Normalize to 0-360
}
