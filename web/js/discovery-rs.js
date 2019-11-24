const datasetInp = document.querySelector('#dataset');

const pointsSizeInp = document.querySelector('#points-size');
const pointsSizeVal = document.querySelector('#points-size-value');
const pointsOpacityInp = document.querySelector('#points-opacity');
const pointsOpacityVal = document.querySelector('#points-opacity-value');

const colorFieldInp = document.querySelector('#color-field');
const colorBalanceInp = document.querySelector('#color-balance');
const colorBalanceVal = document.querySelector('#color-balance-value');

const filterFieldInp = document.querySelector('#filter-field');
const filterInp = document.querySelector('#filter');
const filterVal = document.querySelector('#filter-value');

const searchFieldInp = document.querySelector('#search-field');
const searchInp = document.querySelector('#search');
const searchHideOthersInp = document.querySelector('#search-hide-others');
const searchColorFindingsInp = document.querySelector('#search-color-findings');

const flagNameInp = document.querySelector('#flag-name');
const flagNameDatalist = document.querySelector('#flag-name-datalist');
const recServerInp = document.querySelector('#rec-server');
const recButton = document.querySelector('#rec-button');
const recStatus = document.querySelector('#rec-status');

const findingsColor = [0.15, 0.68, 1]; // blue

let width = window.innerWidth;
let height = window.innerHeight;
const fov = 20;
const near = 2;
const far = 600;

const [camera, renderer] = (function setupThree() {
  const lCamera = new THREE.PerspectiveCamera(
    fov,
    width / height,
    near,
    far + 1,
  );
  const lRenderer = new THREE.WebGLRenderer();
  lRenderer.setSize(width, height);
  document.body.appendChild(lRenderer.domElement);
  return [lCamera, lRenderer];
}());

const view = d3.select(renderer.domElement);

(function setupZoom() {
  function toRadians(angle) {
    return angle * (Math.PI / 180);
  }

  function getScaleFromZ(cameraZPosition) {
    const halfFov = fov / 2;
    const halfFovRadians = toRadians(halfFov);
    const halfFovHeight = Math.tan(halfFovRadians) * cameraZPosition;
    const fovHeight = halfFovHeight * 2;
    // Divide visualization height by height derived from field of view
    const scale = height / fovHeight;
    return scale;
  }

  function getZFromScale(scale) {
    const halfFov = fov / 2;
    const halfFovRadians = toRadians(halfFov);
    const scaleHeight = height / scale;
    const cameraZPosition = scaleHeight / (2 * Math.tan(halfFovRadians));
    return cameraZPosition;
  }

  function zoomHandler(d3Transform) {
    const scale = d3Transform.k;
    const x = -(d3Transform.x - width / 2) / scale;
    const y = (d3Transform.y - height / 2) / scale;
    const z = getZFromScale(scale);
    camera.position.set(x, y, z);
  }

  const zoom = d3.zoom()
    .on('zoom', () => {
      const d3Transform = d3.event.transform;
      zoomHandler(d3Transform);
    });

  function initZoom() {
    zoom.scaleExtent([getScaleFromZ(far), getScaleFromZ(near + 1)]);
    view.call(zoom).on('dblclick.zoom', null);
    const initialScale = getScaleFromZ(far);
    const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(initialScale);
    zoom.transform(view, initialTransform);
    camera.position.set(0, 0, far);
  }
  initZoom();

  window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;

    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Resets zoom to default
    initZoom();
  });
}());

const circleSprite = new THREE.TextureLoader().load(
  'res/circle-sprite.png',
);

function datasetRedirect() {
  window.location = `${window.location.origin + window.location.pathname}?ds=${datasetInp.value}`;
}

datasetInp.addEventListener('change', () => datasetRedirect());

const urlParams = new URLSearchParams(window.location.search);

function parseDatasetName() {
  let ds = urlParams.get('ds');

  if (!ds) {
    ds = datasetInp.value;
  }

  if (datasetInp.value !== ds) {
    datasetInp.value = ds;
  }
  return ds;
}

const ds = parseDatasetName();
const lsFlagsItem = `${ds}-flags`;

let flags = window.localStorage.getItem(lsFlagsItem);
if (!flags) {
  flags = '{}';
}
flags = JSON.parse(flags);

let generatedPoints = null;
let index = null;
let loadingInc = 0;

function updateFlagInIndex(item) {
  index.remove(item);
  item.t_flags = item.flags.join(', ');
  if (item.t_flags.length === 0) {
    delete item.t_flags;
  }
  index.add(item);
}

function updateFlagsDatalist() {
  flagNameDatalist.innerHTML = '';
  Object.keys(flags).forEach((flag) => {
    const opt = document.createElement('option');
    opt.value = flag;
    flagNameDatalist.appendChild(opt);
  });
}

function applyFlagsFromLS() {
  Object.keys(flags).forEach((flag) => {
    flags[flag].forEach((idx) => {
      const item = generatedPoints[idx];
      item.flags.push(flag);
      updateFlagInIndex(item);
    });
  });
  updateFlagsDatalist();
}

function checkIfLoading() {
  if (loadingInc === 2) {
    applyFlagsFromLS();
    document.querySelector('#loader-outer').style.display = 'none';
  }
}

function loadIndex(json) {
  const data = JSON.parse(json);
  const fields = Object.keys(data.fieldIds);
  index = MiniSearch.loadJS(data, { fields, idField: 'idx' });
  // eslint-disable-next-line no-underscore-dangle
  Object.keys(index._fieldIds).forEach((field) => {
    const opt = document.createElement('option');
    opt.value = field;
    opt.innerHTML = field.substr(2);
    searchFieldInp.appendChild(opt);
  });
  loadingInc++;
  checkIfLoading();
}

function loadPoints() {
  Object.keys(generatedPoints[0]).forEach((field) => {
    if (field.startsWith('n_')) {
      const opt = document.createElement('option');
      opt.value = field;
      opt.innerHTML = field.substr(2);
      colorFieldInp.appendChild(opt);
      filterFieldInp.appendChild(opt.cloneNode(true));
    }
  });

  function interpolateColors(colors) {
    const n = colors.length;
    let r = new Array(n);
    let g = new Array(n);
    let b = new Array(n);
    let color = null;
    for (let i = 0; i < n; ++i) {
      color = d3.rgb(colors[i]);
      r[i] = (color.r / 255) || 0;
      g[i] = (color.g / 255) || 0;
      b[i] = (color.b / 255) || 0;
    }
    r = d3.interpolateBasis(r);
    g = d3.interpolateBasis(g);
    b = d3.interpolateBasis(b);
    return (t) => [r(t), g(t), b(t)];
  }

  const interpolateOranges = interpolateColors(d3.schemeOranges[9]);

  function colorFromPct(v) {
    const balance = colorBalanceInp.value;
    let p = 0;
    if (v >= balance) {
      p = 1 - balance;
    } else {
      p = balance;
    }
    return interpolateOranges(1 - (0.5 + ((v - balance) * 0.5) / p));
  }

  function getColor(point, fromFilter) {
    if (fromFilter && searchColorFindingsInp.checked) {
      return findingsColor;
    }
    return colorFromPct(point[colorFieldInp.value]);
  }

  function toRGB(color) {
    return `${d3.rgb(color[0] * 255, color[1] * 255, color[2] * 255)}`;
  }

  function applyFilter(point) {
    return filterInp.value <= point[filterFieldInp.value];
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0000000);
  const pointsContainer = new THREE.Object3D();
  const searchContainer = new THREE.Object3D();
  scene.add(pointsContainer);
  scene.add(searchContainer);

  function addPoints() {
    pointsContainer.remove(...pointsContainer.children);
    const geometry = new THREE.BufferGeometry();
    const colors = new Float32Array(3 * generatedPoints.length);
    const vertices = new Float32Array(3 * generatedPoints.length);
    let aIdx = 0;
    const idxs = [];
    generatedPoints.forEach((datum, idx) => {
      if (!applyFilter(datum)) {
        return;
      }
      vertices[aIdx++] = datum.position[0];
      vertices[aIdx++] = datum.position[1];
      vertices[aIdx++] = 0;
      const color = getColor(datum, false);
      colors[aIdx - 3] = color[0];
      colors[aIdx - 2] = color[1];
      colors[aIdx - 1] = color[2];
      idxs.push(idx);
    });
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices.slice(0, aIdx), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, aIdx), 3));

    const pointsMaterial = new THREE.PointsMaterial({
      size: pointsSizeInp.value,
      sizeAttenuation: false,
      vertexColors: THREE.VertexColors,
      map: circleSprite,
      opacity: pointsOpacityInp.value,
      transparent: true,
    });

    const points = new THREE.Points(geometry, pointsMaterial);
    points.idxs = idxs;
    pointsContainer.add(points);
  }

  addPoints();

  // Three.js render loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  function pointsSizeInputHandler(newVal) {
    pointsSizeInp.value = newVal;
    pointsSizeVal.innerHTML = newVal;
    pointsContainer.children[0].material.size = newVal;
    if (searchContainer.children.length > 0) {
      searchContainer.children[0].material.size = newVal;
    }
  }

  pointsSizeInp.addEventListener('input', (event) => pointsSizeInputHandler(+event.target.value));

  function pointsOpacityInputHandler(newVal) {
    pointsOpacityInp.value = newVal;
    pointsOpacityVal.innerHTML = newVal;
    pointsContainer.children[0].material.opacity = newVal;
    if (searchContainer.children.length > 0) {
      searchContainer.children[0].material.opacity = newVal;
    }
  }

  pointsOpacityInp.addEventListener('input', (event) => pointsOpacityInputHandler(+event.target.value));

  function switchHideOthers(newVal) {
    pointsContainer.visible = !newVal;
    searchHideOthersInp.checked = newVal;
  }

  function searchHideOthersInputHandler() {
    switchHideOthers(searchHideOthersInp.checked);
  }

  searchHideOthersInp.addEventListener('input', () => searchHideOthersInputHandler());

  function addSearchPoints() {
    const searchQuery = searchInp.value;
    searchContainer.remove(...searchContainer.children);
    if (!searchQuery) {
      return;
    }
    const searchOpt = { fields: [searchFieldInp.value], combineWith: 'AND' };
    const found = index.search(searchQuery, searchOpt);
    if (found.length > 0) {
      const geometry = new THREE.BufferGeometry();
      const colors = new Float32Array(3 * found.length);
      const vertices = new Float32Array(3 * found.length);
      let aIdx = 0;
      const idxs = [];
      found.forEach((datum) => {
        const idx = +datum.id;
        const item = generatedPoints[idx];
        if (!applyFilter(item)) {
          return;
        }
        idxs.push(idx);
        vertices[aIdx++] = item.position[0];
        vertices[aIdx++] = item.position[1];
        vertices[aIdx++] = 0;
        const color = getColor(item, true);
        colors[aIdx - 3] = color[0];
        colors[aIdx - 2] = color[1];
        colors[aIdx - 1] = color[2];
      });
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices.slice(0, aIdx), 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, aIdx), 3));

      const material = new THREE.PointsMaterial({
        size: pointsSizeInp.value,
        sizeAttenuation: false,
        vertexColors: THREE.VertexColors,
        map: circleSprite,
        opacity: pointsOpacityInp.value,
        transparent: true,
      });

      const pointsObj = new THREE.Points(geometry, material);
      pointsObj.idxs = idxs;
      searchContainer.add(pointsObj);
    }
  }

  function searchInputHandler() {
    const newVal = searchInp.value;
    if (newVal) {
      addSearchPoints();
      switchHideOthers(true);
    } else {
      switchHideOthers(false);
      searchContainer.remove(...searchContainer.children);
    }
  }

  searchInp.addEventListener('input', () => searchInputHandler());
  searchFieldInp.addEventListener('input', () => searchInputHandler());

  function filterInputHandler() {
    const newVal = filterInp.value;
    filterVal.innerHTML = newVal;
    addPoints();
    addSearchPoints();
  }

  filterInp.addEventListener('input', () => filterInputHandler());
  filterFieldInp.addEventListener('input', () => filterInputHandler());

  function colorFilterResults() {
    if (searchContainer.children.length === 0) {
      return;
    }
    const points = searchContainer.children[0];
    const colors = points.geometry.getAttribute('color').array;

    for (let i = 0; i < points.idxs.length; i++) {
      const idx = points.idxs[i];
      const color = getColor(generatedPoints[idx], true);
      colors[i * 3] = color[0];
      colors[i * 3 + 1] = color[1];
      colors[i * 3 + 2] = color[2];
    }
    points.geometry.getAttribute('color').needsUpdate = true;
  }

  searchColorFindingsInp.addEventListener('input', () => colorFilterResults());

  function updateColors() {
    colorFilterResults();
    const points = pointsContainer.children[0];
    const colors = points.geometry.getAttribute('color').array;
    for (let i = 0; i < points.idxs.length; i++) {
      const idx = points.idxs[i];
      const color = getColor(generatedPoints[idx], false);
      colors[i * 3] = color[0];
      colors[i * 3 + 1] = color[1];
      colors[i * 3 + 2] = color[2];
    }
    points.geometry.getAttribute('color').needsUpdate = true;
  }

  colorFieldInp.addEventListener('input', () => updateColors());

  function colorBalanceInputHandler() {
    const newVal = colorBalanceInp.value;
    colorBalanceVal.innerHTML = newVal;
    updateColors();
  }

  colorBalanceInp.addEventListener('input', () => colorBalanceInputHandler());

  function updateRecButtonStatus() {
    if (flagNameInp.value.length > 0
      && Object.prototype.hasOwnProperty.call(flags, flagNameInp.value)
      && recServerInp.value.length > 0
      && recServerInp.checkValidity()) {
      recButton.disabled = false;
    } else {
      recButton.disabled = true;
    }
  }

  flagNameInp.addEventListener('input', () => updateRecButtonStatus());

  // Hover and tooltip interaction

  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 10;

  function mouseToThree(mouseX, mouseY) {
    return new THREE.Vector3(
      (mouseX / width) * 2 - 1,
      -(mouseY / height) * 2 + 1,
      1,
    );
  }

  function sortIntersectsByDistanceToRay(intersects) {
    const res = intersects.slice();
    res.sort((a, b) => {
      if (a.distanceToRay > b.distanceToRay) {
        return 1;
      }
      return (b.distanceToRay > a.distanceToRay) ? -1 : 0;
    });
    return res;
  }

  function getIntersect(mousePosition) {
    const mouseVector = mouseToThree(...mousePosition);
    raycaster.setFromCamera(mouseVector, camera);
    let pointsObj = null;
    let fromFilter = false;
    if (pointsContainer.visible === true) {
      pointsObj = pointsContainer.children[0];
    } else {
      pointsObj = searchContainer.children[0];
      fromFilter = true;
    }
    const intersects = raycaster.intersectObject(pointsObj);

    if (intersects[0]) {
      const sortedIntersects = sortIntersectsByDistanceToRay(intersects);
      const intersect = sortedIntersects[0];
      const idx = pointsObj.idxs[intersect.index];
      const datum = generatedPoints[idx];
      return [datum, fromFilter];
    }
    return [null, fromFilter];
  }

  view.on('click', () => {
    const [mouseX, mouseY] = d3.mouse(view.node());
    const mousePosition = [mouseX, mouseY];
    const [datum] = getIntersect(mousePosition);
    if (datum) {
      const textArea = document.createElement('textarea');
      document.body.appendChild(textArea);
      textArea.value = datum.t_name;
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  });

  function updateFlagsLocalStorage() {
    window.localStorage.setItem(lsFlagsItem, JSON.stringify(flags));
  }

  function setRecStatus(color, msg) {
    recStatus.innerHTML = msg;
    recStatus.style.color = color;
    window.setTimeout(() => { recStatus.innerHTML = ''; }, 3000);
  }

  recButton.onclick = () => {
    const recField = `${flagNameInp.value}_recommend`;
    fetch(recServerInp.value, {
      method: 'POST',
      body: JSON.stringify({ ds, idxs: flags[flagNameInp.value] }),
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    }).then((response) => {
      if (response.ok) {
        response.json().then((data) => {
          for (let i = 0; i < generatedPoints.length; i++) {
            generatedPoints[i][recField] = data.recs[i];
          }
          let found = false;
          [...colorFieldInp.children].forEach((opt) => {
            if (opt.value === recField) {
              found = true;
            }
          });
          if (!found) {
            const opt = document.createElement('option');
            opt.value = recField;
            opt.innerHTML = recField;
            colorFieldInp.appendChild(opt);
            filterFieldInp.appendChild(opt.cloneNode(true));
          }
          colorFieldInp.value = recField;
          updateColors();
          filterFieldInp.value = recField;
          filterInputHandler();
          setRecStatus('green', 'Success');
        });
      } else {
        setRecStatus('red', `HTTP-Error: ${response.status}`);
      }
    }).catch((error) => {
      setRecStatus('red', 'Error');
      throw error;
    });
  };

  const hoverContainer = new THREE.Object3D();
  scene.add(hoverContainer);

  function removeHighlights() {
    hoverContainer.remove(...hoverContainer.children);
  }

  function highlightPoint(datum, fromFilter) {
    removeHighlights();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array([datum.position[0], datum.position[1], 0]), 3));
    const color = getColor(datum, fromFilter);
    geometry.setAttribute('color',
      new THREE.BufferAttribute(new Float32Array([color[0], color[1], color[2]]), 3));

    const material = new THREE.PointsMaterial({
      size: 26,
      sizeAttenuation: false,
      vertexColors: THREE.VertexColors,
      map: circleSprite,
      transparent: true,
    });

    const point = new THREE.Points(geometry, material);
    hoverContainer.add(point);
  }

  // Initial tooltip state
  const tooltipState = { display: 'none', data: {} };

  const tooltipTemplate = document.createRange().createContextualFragment('<div id="tooltip" style="display: none; position: absolute; pointer-events: none; font-size: 13px; width: 200px; text-align: center; line-height: 1; padding: 6px; background: white; font-family: sans-serif;"/>');
  document.body.append(tooltipTemplate);

  const $tooltip = document.querySelector('#tooltip');

  function updateTooltip() {
    $tooltip.style.display = tooltipState.display;
    while ($tooltip.firstChild) {
      $tooltip.removeChild($tooltip.firstChild);
    }
    $tooltip.innerHTML += `<div style="padding: 4px; margin-bottom: 4px; background: ${toRGB(getColor(tooltipState.data, tooltipState.fromFilter))};"><b>${tooltipState.data.t_name}</b></div>`;
    Object.keys(tooltipState.data).forEach((field) => {
      if (field === 't_name' || field === 'flags') {
        return;
      }
      let key = field;
      if (key.startsWith('n_') || key.startsWith('t_')) {
        key = key.substr(2);
      }
      let val = tooltipState.data[field];
      // Format floats
      if (Number(val) === val && val % 1 !== 0) {
        val = val.toFixed(4);
      }
      if (field === 'position') {
        val = [val[0].toFixed(4), val[1].toFixed(4)];
      }
      $tooltip.innerHTML += `<div style="padding: 4px;">${key}: ${val}</div>`;
    });
    $tooltip.style.left = `${tooltipState.left}px`;
    $tooltip.style.top = `${tooltipState.top}px`;
  }

  function showTooltip(mousePosition, datum, fromFilter) {
    const tooltipWidth = 200;
    const xOffset = -tooltipWidth / 2;
    const yOffset = 30;
    tooltipState.display = 'block';
    tooltipState.left = mousePosition[0] + xOffset;
    tooltipState.top = mousePosition[1] + yOffset;
    tooltipState.data = datum;
    tooltipState.fromFilter = fromFilter;
    updateTooltip();
  }

  function hideTooltip() {
    tooltipState.display = 'none';
    updateTooltip();
  }

  view.on('mouseleave', () => {
    removeHighlights();
    hideTooltip();
  });

  view.on('mousemove', () => {
    const [mouseX, mouseY] = d3.mouse(view.node());
    const mousePosition = [mouseX, mouseY];
    const [datum, fromFilter] = getIntersect(mousePosition);
    if (datum) {
      highlightPoint(datum, fromFilter);
      showTooltip(mousePosition, datum, fromFilter);
    } else {
      removeHighlights();
      hideTooltip();
    }
  });

  view.on('dblclick', () => {
    const flag = flagNameInp.value;
    if (flag.length === 0) {
      return;
    }
    const [mouseX, mouseY] = d3.mouse(view.node());
    const mousePosition = [mouseX, mouseY];
    const [datum] = getIntersect(mousePosition);
    if (!datum) {
      return;
    }
    if (datum.flags.includes(flag)) {
      datum.flags = datum.flags.filter((x) => x !== flag);
      flags[flag] = flags[flag].filter((x) => x !== datum.idx);
      if (flags[flag].length === 0) {
        delete flags[flag];
      }
    } else {
      datum.flags.push(flag);
      if (!Object.prototype.hasOwnProperty.call(flags, flag)) {
        flags[flag] = [];
      }
      flags[flag].push(datum.idx);
    }
    updateFlagInIndex(datum);
    updateFlagsLocalStorage();
    updateFlagsDatalist();
    updateTooltip();
    updateRecButtonStatus();
  });

  loadingInc++;
  checkIfLoading();
}

JSZipUtils.getBinaryContent(`data/${ds}.zip`, (err, data) => {
  if (err) {
    throw err;
  }
  JSZip.loadAsync(data).then((zip) => {
    zip.file('web.csv').async('string').then((dsCsv) => {
      generatedPoints = d3.csvParse(dsCsv, (row) => {
        row.idx = +row.idx;
        row.position = [+row.x, +row.y];
        delete row.x;
        delete row.y;
        Object.keys(row).forEach((field) => {
          if (field.startsWith('n_')) {
            row[field] = +row[field];
          }
        });
        row.flags = [];
        return row;
      });
      loadPoints();
    });
    zip.file('web_index.json').async('string').then((indexStr) => {
      loadIndex(indexStr);
    });
  });
});
