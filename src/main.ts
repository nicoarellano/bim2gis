// Loading Fragment Models to Maplibre 🔼🌎
/* eslint-disable */
// cSpell: disable

import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as BUI from '@thatopen/ui';
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

interface Location {
  coords: Coords;
  angle: number;
  elevation: number;
}

interface Bldg {
  id: string;
  name: string;
  location: Location;
}

// Hardcoding some buildings 🏢
const buildings: Bldg[] = [
  {
    id: 'AA',
    name: 'Architecture Building',
    location: {
      coords: { lng: -75.69765955209732, lat: 45.38389669263273 },
      angle: 0,
      elevation: -1,
    },
  },
  {
    id: 'BB',
    name: 'Bronson Substation',
    location: {
      coords: { lng: -75.69185223430395, lat: 45.38636213794322 },
      angle: 0,
      elevation: 3,
    },
  },
  // { id: 'CB', name: 'Canal Building' },
  // { id: 'NB', name: 'Nicol Building' },
  {
    id: 'PA',
    name: 'Paterson Hall',
    location: {
      coords: { lng: -75.69835199446455, lat: 45.38152527897171 },
      angle: 35,
      elevation: 5,
    },
  },
  // { id: 'VS', name: 'VISIM Building' },
];

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

const mouse = new THREE.Vector2();

const path = '../resources/frags/';
const loadFragmentFile = async (id: string) => {
  world.camera.updateAspect();
  const url = `${path}${id}.frag`;
  const file = await fetch(url);
  const mapFile = await fetch(url);
  const buffer = await file.arrayBuffer();
  const mapBuffer = await mapFile.arrayBuffer();
  const _model = await fragments.load(buffer, { modelId: id });
  const mapModel = await fragments.load(mapBuffer, { modelId: `${id}@map` });
  mapScene.add(mapModel.object);
  // world.scene.three.add(model.object);
  models.push(_model);
  if (!_model.modelId.endsWith('@map')) model = _model;
};

bimContainer.addEventListener('click', async (event) => {
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
  const model = await fragments.load(buffer, {
    modelId: file.name,
  });
  models.push(model);
  model.useCamera(currentCamera);
  world.scene.three.add(model.object);
  fragments.update(true);

  maplibre.getCanvas().style.cursor = 'crosshair';
  holdPopup = true;
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

const clearUiInputs = () => {
  if (angleSlider) angleSlider.value = '0';
  if (heightSlider) heightSlider.value = '0';
};

/* 🛡️ Prevent Memory Leaks
Here's a utility function to help you manage this effectively */
const disposeModels = async (ids = getModelsIds()) => {
  const promises = [];
  models = [];
  clearUiInputs();

  for (const id of ids) promises.push(fragments.disposeModel(id));
  for (const id of ids) promises.push(fragments.disposeModel(`${id}@map`));
  await Promise.all(promises);
};

/* 🧩 Adding User Interface 
  We will use the `@thatopen/ui` library to add some simple and cool UI elements to our app. First, we need to call the `init` method of the `BUI.Manager` class to initialize the library:
*/

BUI.Manager.init();

const maplibre = new maplibregl.Map({
  container: 'map-container', // container id
  style: '../resources/styles/satellite.json',
  center: buildings[0].location.coords,
  zoom: 15.5,
  pitch: 45,
  bearing: 0,
  canvasContextAttributes: { antialias: true },
  attributionControl: false,
  maplibreLogo: true,
  doubleClickZoom: false,
});

let building = buildings.find((building) => building.id === 'AA');
if (!building || !building.location) {
  throw new Error("Building with id 'AA' not found or location is undefined.");
}

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

const removeModelFromMap = (id: string) => {
  console.log('Removing model from map: ', id);
  maplibre.removeLayer('3d-model');
  maplibre.removeLayer('places-layer');
  maplibre.removeSource('places-source');
  maplibre.removeImage('custom-marker');
};

const [panel, updatePanel] = BUI.Component.create<BUI.PanelSection, any>(
  (_) => {
    const ids = getModelsIds();

    const onLoadModel = async ({ target }: { target: BUI.Button }) => {
      const id = target.getAttribute('data-name');
      if (!id) return;
      building = buildings.find((building) => building.id === id);
      if (!building) return;
      const { angle, coords, elevation } = building.location;
      const trueNorthInRadians = (angle ?? 0) * (Math.PI / 180);
      mapScene.rotateY(trueNorthInRadians);
      mapScene.position.setY(elevation ?? 0);

      target.loading = true;
      if (ids.includes(id)) {
        await disposeModels([id]);
        removeModelFromMap('3d-model');
      } else {
        setMarker(coords);
        loadModel(coords);
        await loadFragmentFile(id);
      }
      target.loading = false;
    };

    const onDisposeModels = () => {
      disposeModels();
      models = [];
    };

    const onDownloadModel = async ({ target }: { target: BUI.Button }) => {
      const name = target.getAttribute('data-name');
      if (!name) return;
      const id = name;
      target.loading = true;
      const result = await getBinaryData(id);
      if (result) {
        const { name, buffer } = result;

        const a = document.createElement('a');
        const file = new File([buffer], `${name}.frag`);
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      target.loading = false;
    };

    function onAddToMap() {
      console.log('Add to map');
    }

    return BUI.html`
      <bim-panel id="controls-panel" active label="Fragments Models" class="options-menu">
        <bim-panel-section label="Controls">
          ${buildings.map(({ id, name }) => {
            const isLoaded = ids.some((modelId) => modelId.includes(id));
            const label = isLoaded ? `Remove ${name}` : `Load ${name}`;
            return BUI.html`
              <div style="display: flex; gap: 0.25rem">
                <bim-button data-name=${id} label=${label} @click=${onLoadModel}></bim-button>
                ${
                  isLoaded
                    ? BUI.html`<bim-button data-name=${id} label="Download" @click=${onDownloadModel}></bim-button>`
                    : null
                }
              </div>
            `;
          })}
          <!-- <div style="display: flex; gap: 0.25rem">
                <bim-button data-name='MAP' label='Load in Map' icon='lucide:map-pinned' @click=${onAddToMap}></bim-button>
              </div> -->
          <bim-button ?disabled=${
            ids.length === 0
          } label="Remove All" @click=${onDisposeModels}></bim-button>
        </bim-panel-section>
      </bim-panel>
    `;
  },
  {}
);

fragments.models.list.onItemSet.add(() => updatePanel());
fragments.models.list.onItemDeleted.add(() => updatePanel());

document.body.append(panel);

/* MD
  And we will make some logic that adds a button to the screen when the user is visiting our app from their phone, allowing to show or hide the menu. Otherwise, the menu would make the app unusable.
*/

const button = BUI.Component.create<BUI.PanelSection>(() => {
  const onClick = () => {
    if (panel.classList.contains('options-menu-visible')) {
      panel.classList.remove('options-menu-visible');
    } else {
      panel.classList.add('options-menu-visible');
    }
  };

  return BUI.html`
    <bim-button class="phone-menu-toggler" icon="solar:settings-bold"
      @click=${onClick}>
    </bim-button>
  `;
});

document.body.append(button);

// ⏱️ Measuring the performance

const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.left = '0px';
stats.dom.style.zIndex = 'unset';
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());

const { coords } = building.location;

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

async function loadModel(coords: Coords) {
  if (!building) return;
  mapElevation = maplibre.queryTerrainElevation(coords) ?? 0;
  modelElevation = building?.location.elevation + mapElevation;
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
    world.camera.controls.fitToBox(bbox, false);
    fragments.update();
  });

  const customLayer: CustomLayerInterface = {
    id: '3d-model',
    type: 'custom',
    renderingMode: '3d',

    onAdd() {
      layerRenderer.autoClear = false;
    },

    // RAYCASTING: https://jsfiddle.net/5vpL7ays/7/
    // RAYCASTING: https://stackoverflow.com/questions/59163141/raycast-in-three-js-with-only-a-projection-matrix/61642776#61642776

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

  let bbox: THREE.Box3;

  fragments.onModelLoaded.add(async (model) => {
    if (model.box) {
      bbox = model.box;
      await world.camera.controls.fitToBox(bbox, false);
    }
  });

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
    loadModel(e.lngLat);
    setMarker(e.lngLat);
    popup.remove();

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

proj4.defs(
  'EPSG:26918',
  '+proj=utm +zone=18 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
);
// GOOGLE MERCATOR or just 'GOOGLE'
proj4.defs(
  'EPSG:900913',
  '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs'
);

// Sample UTM coordinate in Ottawa (EPSG:26918)
const utmCoord = [13567764.134119328, 183.22237601293259]; // [Easting, Northing]

// Transform to WGS84 (EPSG:4326)
const wgs84Coord = proj4('EPSG:26918', 'EPSG:3857', utmCoord);
console.log(wgs84Coord); // Should output: { lng: -75.69835199446455, lat: 45.38152527897171 } Paterson Hall
