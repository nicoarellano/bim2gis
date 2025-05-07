// Loading Fragment Models to Maplibre 🔼🌎
/* eslint-disable */
// cSpell: disable

import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
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
  elevation?: number;
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

interface IfcData {
  model: FRAGS.FragmentsModel;
  mapConversionValues?: { x: number; y: number; z: number } | null;
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

  const data = await model.getItemsData([localId], {
    relations: {
      IsDefinedBy: {
        attributes: true,
        relations: true,
      },
    },
  });

  // console.log('Data: ', data);
});

const getModelsIds = () => {
  const models = fragments.models.list.values();
  const ids = [...models].map((model) => model.modelId);
  return ids;
};

let holdPopup = false;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

fileInput.addEventListener('change', async (event) => {
  console.log('File input changed: ', event);
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  console.log('File: ', file);
  const buffer = await file.arrayBuffer();
  if (file.name.endsWith('.ifc')) {
    const convertedModel = await convertIFC(file);
    if (convertedModel) {
      model = convertedModel.model;
      ifcData = {
        model,
        mapConversionValues: convertedModel.mapConversionValues || null,
        epgsCode: convertedModel.epgsCode || null,
        rotationDegrees: convertedModel.rotationDegrees || 0,
      };
      console.log('IFC Data: ', ifcData);
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
const heightSlider = document.getElementById(
  'height-slider'
) as HTMLInputElement;
let altitude = 0;
let dynamicAltitude = 0;
let mapElevation = 0;
let modelElevation = 0;

const altitudeLabel = document.getElementById('height') as HTMLLabelElement;
heightSlider.addEventListener('input', () => {
  dynamicAltitude = parseFloat(heightSlider.value);
  altitudeLabel.textContent = dynamicAltitude.toString();
});
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
  if (heightSlider) heightSlider.value = '0';
  modelTools.style.display = 'none';
};

/* 🛡️ Prevent Memory Leaks
Here's a utility function to help you manage this effectively */
const disposeModels = async (ids = getModelsIds()) => {
  const promises = [];
  models = [];
  clearUiInputs();
  removeModelFromMap();

  for (const id of ids) promises.push(fragments.disposeModel(id));
  for (const id of ids) promises.push(fragments.disposeModel(`${id}@map`));
  await Promise.all(promises);
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

  console.log('Setting new marker: ', coords, layer, source);
}

const removeModelFromMap = () => {
  maplibre.removeLayer('3d-model');
  maplibre.removeLayer('places-layer');
  maplibre.removeSource('places-source');
  maplibre.removeImage('custom-marker');
};

const loadModel = async (ifcData: IfcData) => {
  const { model, epgsCode, mapConversionValues, rotationDegrees } = ifcData;

  const modelId = model.modelId;
  console.log('Loading model: ', modelId);

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
    const { x, y, z } = mapConversionValues;

    const wgs84Coord = proj4(`EPSG:2951`, 'EPSG:4326', [x, y]);
    const [lng, lat] = wgs84Coord;
    coords = { lng, lat, elevation: z, rotation: rotationDegrees };

    setMarker({ lng, lat });
    loadModelToMap(coords);
    modelTools.style.display = 'flex';

    modelElevation = mapConversionValues.z;
  } else {
    maplibre.getCanvas().style.cursor = 'crosshair';
    holdPopup = true;
  }
};

const removeAll = document.getElementById('remove-all') as HTMLButtonElement;
removeAll.addEventListener('click', async () => disposeModels());

// ⏱️ Measuring the performance

const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.left = '0px';
stats.dom.style.zIndex = 'unset';
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());

// const { coords } = building.location;
let origin = {
  lng: -75.69835199446455,
  lat: 45.38152527897171,
};
let coords: Coords;

let sceneOrigin = new maplibregl.LngLat(origin.lng, origin.lat);
let modelLocation = new maplibregl.LngLat(origin.lng, origin.lat);

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
  mapElevation = maplibre.queryTerrainElevation(coords) ?? 0;
  modelElevation = mapElevation;
  const { lng, lat } = coords;
  modelLocation = new maplibregl.LngLat(lng, lat);
  sceneOrigin = new maplibregl.LngLat(lng, lat);

  const modelAsMercatorCoordinate = maplibregl.MercatorCoordinate.fromLngLat(
    coords,
    modelElevation
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
  bimContainer.addEventListener('mouseleave', () => {
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
    },

    render(_, matrix) {
      const angleValue = angleSlider.value;
      const angleNumber = parseFloat(angleValue);
      const angleInRadians = (angleNumber * Math.PI) / -180;

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

      altitude =
        maplibre.queryTerrainElevation(modelLocation) !== null
          ? (maplibre.queryTerrainElevation(modelLocation) ?? 0) +
            dynamicAltitude
          : dynamicAltitude;

      altitudeLabel.textContent = altitude.toFixed(1).toString();

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
    speed: 1, // Adjust the speed of the flyTo animation
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
  world.camera.updateAspect();
}

function stopResizing(): void {
  isResizing = false;
  document.removeEventListener('mousemove', resize);
  document.removeEventListener('mouseup', stopResizing);
}

// PROJ4 to convert between coordinate systems

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

// Sample UTM coordinate in Ottawa (EPSG:26918)
// const utmCoord = [445325.701, 5025571.622]; // [Easting, Northing] Paterson Hall
// const utmCoord = [445518.6, 5026017.2]; // [Easting, Northing] Center of Carleton University
const utmCoord = [367931.6, 5027647]; // [Easting, Northing] Fire hydrant? coordinate system?
// const elevation = 59.1; // Elevation in meters (example value)
// const ifcDirection = [-0.707106781186548, 0.707106781186548];
// const ifcDirectionToDegree = ifcDirectionToDegrees({
//   DirectionRatios: ifcDirection,
// }).degrees;

// Transform to WGS84 (EPSG:4326)
// const wgs84Coord = proj4(`EPSG:269${zone}`, 'EPSG:4326', utmCoord);
const wgs84Coord = proj4(`EPSG:2951`, 'EPSG:4326', utmCoord);

// setMarker({ lng: wgs84Coord[0], lat: wgs84Coord[1] });

const crsReport = `Current map longitude: ${lng}, 
UTM Zone: ${zone} → EPSG:269${zone} 
MTM Zone 9: EPSG:2951 
UTM Coords: ${utmCoord} 
WGS84 Coordinates: ${wgs84Coord}
`;
// console.log(crsReport);

const serializer = new FRAGS.IfcImporter();
serializer.wasm = { absolute: true, path: 'https://unpkg.com/web-ifc@0.0.68/' };
let fragmentBytes: ArrayBuffer | null = null;
let onConversionFinish = () => {};

export const convertIFC = async (file: File): Promise<IfcData | null> => {
  const ifcBuffer = await file.arrayBuffer();
  const ifcLines = new TextDecoder().decode(ifcBuffer).split('\n');
  const mapConversionValues = extractMapConversionValues(ifcLines);
  const epgsCode = extractEPSGFromIFC(ifcLines);
  const rotation = getRotation(ifcLines);
  const rotationDegrees = rotation
    ? ifcDirectionToDegrees({ DirectionRatios: rotation }).degrees
    : 0;

  const ifcBytes = new Uint8Array(ifcBuffer);
  // @ts-ignore
  fragmentBytes = await serializer.process({ bytes: ifcBytes });
  const modelId = file.name.replace('.ifc', '');
  if (!fragmentBytes) return null;
  const model = await fragments.load(fragmentBytes, { modelId });
  onConversionFinish();
  return { model, mapConversionValues, epgsCode, rotationDegrees };
};

export function ifcDirectionToDegrees(direction: {
  DirectionRatios: number[];
}) {
  if (
    !direction ||
    !direction.DirectionRatios ||
    direction.DirectionRatios.length < 2
  ) {
    throw new Error('Invalid IFCDIRECTION object');
  }

  const [x, y] = direction.DirectionRatios;
  const radians = Math.atan2(x, y); // Invert the ratio by swapping x and y
  const degrees = (radians * 180) / Math.PI;

  return {
    degrees: (degrees + 360) % 360, // Normalize to 0-360
    radians,
  };
}

function extractEPSGFromIFC(lines: string[]): string | null {
  const epsgRegex = /EPSG:\d{4}/;
  const epsgMatches = lines
    .map((line) => line.match(epsgRegex))
    .filter((match) => match !== null);

  if (epsgMatches.length > 0) {
    const epsgCode = epsgMatches[0]![0];
    return epsgCode;
  } else {
    return null;
  }
}

function extractMapConversionValues(
  ifcLines: string[]
): { x: number; y: number; z: number } | null {
  const mapConversionRegex =
    /#\d+=IFCMAPCONVERSION\([^,]+,[^,]+,([\d.-]+),([\d.-]+),([\d.-]+)/;

  const mapConversionLine = ifcLines.find((line) =>
    mapConversionRegex.test(line)
  );

  if (!mapConversionLine) return null;

  const match = mapConversionLine.match(mapConversionRegex);
  if (!match || match.length < 4) return null;

  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  const z = parseFloat(match[3]);

  const result: { x: number; y: number; z: number } = { x, y, z };
  return result;
}

function getRotation(ifcLines: string[]): number[] | null {
  const contextRegex =
    /#\d+=IFCGEOMETRICREPRESENTATIONCONTEXT\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,(#[\d]+)\)/;

  const contextLine = ifcLines.find((line) => contextRegex.test(line));
  if (!contextLine) return null;

  const match = contextLine.match(contextRegex);
  if (!match || match.length < 2) return null;

  const directionId = match[1]; // Extract the direction ID (e.g., #71)
  const directionLine = ifcLines.find((line) =>
    line.startsWith(`${directionId}=`)
  );
  if (!directionLine) return null;

  const directionRegex = /IFCDIRECTION\(\((-?[\d.]+),(-?[\d.]+)\)\)/;
  const directionMatch = directionLine.match(directionRegex);
  if (!directionMatch || directionMatch.length < 3) return null;

  const x = parseFloat(directionMatch[1]);
  const y = parseFloat(directionMatch[2]);

  return [x, y]; // Return the array of two numbers
}
