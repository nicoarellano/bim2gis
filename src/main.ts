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

// 📂 Loading Fragments Models
let models: FRAGS.FragmentsModel[] = [];
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

  console.log('Data: ', data);
});

/* At any point, you can retrieve the binary data of a loaded model for exporting. This is particularly useful when models are loaded automatically from a remote source, but you want to provide an option to download the data locally for further use:
 */

const getBinaryData = async (id: string) => {
  const model = fragments.models.list.get(id);
  if (!model) return null;
  const buffer = await model.getBuffer(false);
  return { name: model.modelId, buffer };
};

/* Helper function to retrieve these IDs. This will make it easier to manage models, such as loading, disposing, or performing other operations on them. */

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
    model = await convertIFC(file);
  }
  if (file.name.endsWith('.frag')) {
    model = await fragments.load(buffer, {
      modelId: file.name.replace('.frag', ''),
    });
  }
  if (!model) return;
  loadModel(model);
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
  style: '../resources/styles/satellite.json',
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

/*
let building = buildings.find((building) => building.id === 'PA');
if (!building || !building.location) {
  throw new Error("Building with id 'AA' not found or location is undefined.");
}
  */

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

  const image = await maplibre.loadImage('../resources/images/ifc-logo.png');
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

// const ids = getModelsIds();
const loadModel = async (model: FRAGS.FragmentsModel) => {
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
  maplibre.getCanvas().style.cursor = 'crosshair';
  holdPopup = true;

  /*
  const items = await model.getItemsOfCategory('IFCMAPCONVERSION');
  const ifcSite = await model.getItemsOfCategory('IFCSITE');

  const localIds = (
    await Promise.all(
      items.map((item) => {
        console.log('Item: ', item);
        return item.getLocalId();
      })
    )
  ).filter((localId) => localId !== null) as number[];

  for (const localId of localIds) {
    const data = await model.getItemsData([localId], {
      relations: {
        attribute: {
          attributes: true,
          relations: true,
        },
      },
    });
    console.log('Data: ', data);
  }

  console.log('IFC SITE: ', items);

  for (const [_, data] of Object.entries(items)) {
    console.log('Data: ', data);
    if (!data) continue;

    const { RefLatitude, RefLongitude, RefElevation } = data;

    if (!RefLatitude || !RefLongitude || !RefElevation) continue;

    console.log('RefLatitude: ', RefLatitude);
    console.log('RefLongitude: ', RefLongitude);
    // const latitude = this.convertDMStoDecimal(RefLatitude);
    // const longitude = this.convertDMStoDecimal(RefLongitude);
  }
  */
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
let coords = {
  lng: -75.69835199446455,
  lat: 45.38152527897171,
};

let sceneOrigin = new maplibregl.LngLat(coords.lng, coords.lat);
let modelLocation = new maplibregl.LngLat(coords.lng, coords.lat);

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
  console.log(`Model ${model.modelId} loaded: `, model);
  // if (model.modelId.endsWith('map')) await model.useCamera(mapCamera);
  // else await model.useCamera(world.camera.three);
  model.useCamera(currentCamera);
  const geometry = model.object;
  world.scene.three.add(geometry);
  fragments.update(true);
});

let bimCamera = world.camera.three;
let currentCamera = bimCamera;

async function loadModelToMap(coords: Coords) {
  // if (!building) return;
  mapElevation = maplibre.queryTerrainElevation(coords) ?? 0;
  // modelElevation = building?.location.elevation + mapElevation;
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

// Sample UTM coordinate in Ottawa (EPSG:26918)
// const utmCoord = [445325.701, 5025571.622]; // [Easting, Northing] Paterson Hall
const utmCoord = [445518.6, 5026017.2]; // [Easting, Northing] Center of Carleton University

// Transform to WGS84 (EPSG:4326)
const wgs84Coord = proj4(`EPSG:269${zone}`, 'EPSG:4326', utmCoord);
const crsReport = `Current map longitude: ${lng}, 
UTM Zone: ${zone} → EPSG:269${zone} 
UTM Coords: ${utmCoord} 
WGS84 Coordinates:, ${wgs84Coord}`;
// console.log(crsReport);

const serializer = new FRAGS.IfcImporter();
serializer.wasm = { absolute: true, path: 'https://unpkg.com/web-ifc@0.0.68/' };
let fragmentBytes: ArrayBuffer | null = null;
let onConversionFinish = () => {};

export const convertIFC = async (file: File) => {
  const ifcBuffer = await file.arrayBuffer();
  const ifcBytes = new Uint8Array(ifcBuffer);
  fragmentBytes = await serializer.process({ bytes: ifcBytes });
  if (!fragmentBytes) return;
  const modelId = file.name.replace('.ifc', '');
  const model = await fragments.load(fragmentBytes, { modelId });
  onConversionFinish();
  return model;
};
