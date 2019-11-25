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

let width = window.innerWidth;
let height = window.innerHeight;
const fov = 20;
const near = 2;
const far = 600;

const dsName = (function resolveDataset() {
  const urlParams = new URLSearchParams(window.location.search);
  let ds = urlParams.get('ds');

  if (!ds) {
    ds = datasetInp.value;
  }

  if (datasetInp.value !== ds) {
    datasetInp.value = ds;
  }
  return ds;
}());

datasetInp.addEventListener('change', () => {
  // Reload with ds param set
  window.location = `${window.location.origin + window.location.pathname}?ds=${datasetInp.value}`;
});

const three = new class {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      fov,
      width / height,
      near,
      far + 1,
    );
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(width, height);
    document.body.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0000000);
  }

  // Three.js render loop
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.renderer.render(this.scene, this.camera);
  }
}();

const view = d3.select(three.renderer.domElement);

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
    three.camera.position.set(x, y, z);
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
    three.camera.position.set(0, 0, far);
  }
  initZoom();

  window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;

    three.renderer.setSize(width, height);
    three.camera.aspect = width / height;
    three.camera.updateProjectionMatrix();
    // Resets zoom to default
    initZoom();
  });
}());

const circleSprite = new THREE.TextureLoader().load(
  'res/circle-sprite.png',
);

function appendOption(element, value, html) {
  const opt = document.createElement('option');
  opt.value = value;
  if (html) {
    opt.innerHTML = html;
  }
  element.appendChild(opt);
}

function unprefixField(field) {
  return field.substr(2);
}

function isNormNumericField(field) {
  return field.startsWith('n_');
}

function isSearchField(field) {
  return field.startsWith('t_');
}

// Returns [r, g, b] array, but values scaled to [0:1]
const itemColor = (function itemColorFunc() {
  const interpolateOranges = (function interpolateColors(colors) {
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
  }(d3.schemeOranges[9]));

  function adjustBalance(v) {
    const balance = colorBalanceInp.value;
    let p = 0;
    if (v >= balance) {
      p = 1 - balance;
    } else {
      p = balance;
    }
    return 0.5 + ((v - balance) * 0.5) / p;
  }

  function colorFromNormNumeric(v) {
    return interpolateOranges(1 - adjustBalance(v));
  }

  return (item) => colorFromNormNumeric(item[colorFieldInp.value]);
}());

function searchItemColor(item) {
  if (searchColorFindingsInp.checked) {
    return [0.15, 0.68, 1]; // blue
  }
  return itemColor(item);
}

function toRGB(scaledColor) {
  return `${d3.rgb(scaledColor[0] * 255, scaledColor[1] * 255, scaledColor[2] * 255)}`;
}

class Points {
  constructor(items, colorFunc, sprite) {
    this.obj3D = new THREE.Object3D();
    this.items = items;
    this.colorFunc = colorFunc;
    this.sprite = sprite;
    this.itemIdxs = [];
  }

  addToScene(scene) {
    scene.add(this.obj3D);
  }

  fill(itemIdxs, opacity, size) {
    this.clear();
    const geometry = new THREE.BufferGeometry();
    const colors = new Float32Array(3 * itemIdxs.length);
    const vertices = new Float32Array(3 * itemIdxs.length);
    let i = 0;
    itemIdxs.forEach((idx) => {
      const item = this.items[idx];
      vertices[i++] = item.position[0];
      vertices[i++] = item.position[1];
      vertices[i++] = 0;
      const color = this.colorFunc(item);
      colors[i - 3] = color[0];
      colors[i - 2] = color[1];
      colors[i - 1] = color[2];
    });
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pointsMaterial = new THREE.PointsMaterial({
      size,
      sizeAttenuation: false,
      vertexColors: THREE.VertexColors,
      map: this.sprite,
      opacity,
      transparent: true,
    });

    const points = new THREE.Points(geometry, pointsMaterial);
    this.itemIdxs = itemIdxs;
    this.obj3D.add(points);
  }

  clear() {
    this.obj3D.remove(...this.obj3D.children);
  }

  isFilled() {
    return this.obj3D.children.length > 0;
  }

  getPoints() {
    if (!this.isFilled()) {
      return null;
    }
    return this.obj3D.children[0];
  }

  updateColors() {
    if (!this.isFilled()) {
      return;
    }
    const points = this.getPoints();
    const colors = points.geometry.getAttribute('color').array;
    for (let i = 0; i < this.itemIdxs.length; i++) {
      const idx = this.itemIdxs[i];
      const color = this.colorFunc(this.items[idx]);
      colors[i * 3] = color[0];
      colors[i * 3 + 1] = color[1];
      colors[i * 3 + 2] = color[2];
    }
    points.geometry.getAttribute('color').needsUpdate = true;
  }

  updateSize(value) {
    if (this.isFilled()) {
      this.getPoints().material.size = value;
    }
  }

  updateOpacity(value) {
    if (this.isFilled()) {
      this.getPoints().material.opacity = value;
    }
  }

  updateVisible(value) {
    this.obj3D.visible = value;
  }

  isVisible() {
    return this.obj3D.visible;
  }

  static mouseToThree(mouseX, mouseY) {
    return new THREE.Vector3(
      (mouseX / width) * 2 - 1,
      -(mouseY / height) * 2 + 1,
      1,
    );
  }

  static sortIntersectsByDistanceToRay(intersects) {
    const res = intersects.slice();
    res.sort((a, b) => {
      if (a.distanceToRay > b.distanceToRay) {
        return 1;
      }
      return (b.distanceToRay > a.distanceToRay) ? -1 : 0;
    });
    return res;
  }

  getIntersect(raycaster, mousePosition) {
    if (!this.isFilled()) {
      return null;
    }
    const mouseVector = Points.mouseToThree(...mousePosition);
    raycaster.setFromCamera(mouseVector, three.camera);
    const intersects = raycaster.intersectObject(this.getPoints());

    if (intersects[0]) {
      const sortedIntersects = Points.sortIntersectsByDistanceToRay(intersects);
      const intersect = sortedIntersects[0];
      const idx = this.itemIdxs[intersect.index];
      return idx;
    }
    return null;
  }
}

class Flags {
  constructor(items, index) {
    this.items = items;
    this.index = index;
    this.lsFlagsItem = `${dsName}-flags`;
    let json = window.localStorage.getItem(this.lsFlagsItem);
    if (!json) {
      json = '{}';
    }
    this.container = JSON.parse(json);
  }

  updateItemInIndex(item) {
    this.index.remove(item);
    item.t_flags = item.flags.join(', ');
    if (item.t_flags.length === 0) {
      delete item.t_flags;
    }
    this.index.add(item);
  }

  updateDatalist() {
    flagNameDatalist.innerHTML = '';
    Object.keys(this.container).forEach((flag) => {
      appendOption(flagNameDatalist, flag, null);
    });
  }

  applyFlagToItem(flag, item) {
    if (item.flags.includes(flag)) {
      item.flags = item.flags.filter((x) => x !== flag);
      this.container[flag] = this.container[flag].filter((x) => x !== item.idx);
      if (this.container[flag].length === 0) {
        delete this.container[flag];
      }
    } else {
      item.flags.push(flag);
      if (!Object.prototype.hasOwnProperty.call(this.container, flag)) {
        this.container[flag] = [];
      }
      this.container[flag].push(item.idx);
    }
    this.updateItemInIndex(item);
    this.updateLocalStorage();
    this.updateDatalist();
  }

  applyFlagsToItems() {
    Object.keys(this.container).forEach((flag) => {
      this.container[flag].forEach((idx) => {
        const item = this.items[idx];
        item.flags.push(flag);
        this.updateItemInIndex(item);
      });
    });
    this.updateDatalist();
  }

  updateLocalStorage() {
    window.localStorage.setItem(this.lsFlagsItem, JSON.stringify(this.container));
  }
}

function proceedWithDataset(items, index) {
  const flags = new Flags(items, index);
  flags.applyFlagsToItems(items);

  // Hide loader
  document.querySelector('#loader-outer').style.display = 'none';

  // Fill search field select options
  // eslint-disable-next-line no-underscore-dangle
  Object.keys(index._fieldIds).forEach((field) => {
    appendOption(searchFieldInp, field, unprefixField(field));
  });

  // Fill color field select options
  Object.keys(items[0]).forEach((field) => {
    if (isNormNumericField(field)) {
      appendOption(colorFieldInp, field, unprefixField(field));
      appendOption(filterFieldInp, field, unprefixField(field));
    }
  });

  function applyFilter(item) {
    return filterInp.value <= item[filterFieldInp.value];
  }

  const allPoints = new Points(items, itemColor, circleSprite);
  allPoints.addToScene(three.scene);
  const searchPoints = new Points(items, searchItemColor, circleSprite);
  searchPoints.addToScene(three.scene);
  const highlightPoint = new Points(items, itemColor, circleSprite);
  highlightPoint.addToScene(three.scene);

  function fillAllPoints() {
    allPoints.fill(
      [...Array(items.length).keys()].filter((x) => applyFilter(items[x])),
      pointsOpacityInp.value,
      pointsSizeInp.value,
    );
  }

  fillAllPoints();
  three.animate();

  pointsSizeInp.addEventListener('input', () => {
    const newVal = pointsSizeInp.value;
    pointsSizeVal.innerHTML = newVal;
    allPoints.updateSize(newVal);
    searchPoints.updateSize(newVal);
  });

  pointsOpacityInp.addEventListener('input', () => {
    const newVal = pointsOpacityInp.value;
    pointsOpacityVal.innerHTML = newVal;
    allPoints.updateOpacity(newVal);
    searchPoints.updateOpacity(newVal);
  });

  function switchHideOthers(newVal) {
    allPoints.updateVisible(!newVal);
    searchHideOthersInp.checked = newVal;
  }

  function updateSearchPoints() {
    const searchQuery = searchInp.value;
    searchPoints.clear();
    if (!searchQuery) {
      return;
    }
    const searchOpt = { fields: [searchFieldInp.value], combineWith: 'AND' };
    const found = index.search(searchQuery, searchOpt);
    if (found.length > 0) {
      searchPoints.fill(
        found.map((x) => +x.id).filter((x) => applyFilter(items[x])),
        pointsOpacityInp.value,
        pointsSizeInp.value,
      );
    }
  }

  function searchInputHandler() {
    if (searchInp.value) {
      updateSearchPoints();
      switchHideOthers(true);
    } else {
      switchHideOthers(false);
      searchPoints.clear();
    }
  }

  searchInp.addEventListener('input', () => searchInputHandler());
  searchFieldInp.addEventListener('input', () => searchInputHandler());
  searchHideOthersInp.addEventListener('input', () => {
    switchHideOthers(searchHideOthersInp.checked);
  });
  searchColorFindingsInp.addEventListener('input', () => searchPoints.updateColors());

  function filterInputHandler() {
    filterVal.innerHTML = filterInp.value;
    fillAllPoints();
    updateSearchPoints();
  }

  filterInp.addEventListener('input', () => filterInputHandler());
  filterFieldInp.addEventListener('input', () => filterInputHandler());

  colorFieldInp.addEventListener('input', () => {
    searchPoints.updateColors();
    allPoints.updateColors();
  });

  colorBalanceInp.addEventListener('input', () => {
    colorBalanceVal.innerHTML = colorBalanceInp.value;
    searchPoints.updateColors();
    allPoints.updateColors();
  });

  function updateRecButtonStatus() {
    if (flagNameInp.value.length > 0
      && Object.prototype.hasOwnProperty.call(flags.container, flagNameInp.value)
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

  function getIntersect(mousePosition) {
    const allIdx = allPoints.getIntersect(raycaster, mousePosition);
    const searchIdx = searchPoints.getIntersect(raycaster, mousePosition);
    if (!allPoints.isVisible() || allIdx === searchIdx) {
      return [searchIdx, true];
    } else {
      return [allIdx, false];
    }
  }

  view.on('click', () => {
    const [mouseX, mouseY] = d3.mouse(view.node());
    const mousePosition = [mouseX, mouseY];
    const [itemIdx] = getIntersect(mousePosition);
    if (itemIdx) {
      const textArea = document.createElement('textarea');
      document.body.appendChild(textArea);
      textArea.value = items[itemIdx].t_name;
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  });

  function setRecStatus(color, msg) {
    recStatus.innerHTML = msg;
    recStatus.style.color = color;
    window.setTimeout(() => { recStatus.innerHTML = ''; }, 3000);
  }

  recButton.onclick = () => {
    const recField = `${flagNameInp.value}_recommend`;
    fetch(recServerInp.value, {
      method: 'POST',
      body: JSON.stringify({ ds: dsName, idxs: flags.container[flagNameInp.value] }),
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    }).then((response) => {
      if (response.ok) {
        response.json().then((data) => {
          for (let i = 0; i < items.length; i++) {
            items[i][recField] = data.recs[i];
          }
          let found = false;
          [...colorFieldInp.children].forEach((opt) => {
            if (opt.value === recField) {
              found = true;
            }
          });
          if (!found) {
            appendOption(colorFieldInp, recField, recField);
            appendOption(filterFieldInp, recField, recField);
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

  function removeHighlights() {
    highlightPoint.clear();
  }

  function highlightItem(itemIdx, fromFilter) {
    removeHighlights();
    if (fromFilter) {
      highlightPoint.colorFunc = searchItemColor;
    } else {
      highlightPoint.colorFunc = itemColor;
    }
    highlightPoint.fill([itemIdx], 1, 26);
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
    $tooltip.innerHTML += `<div style="padding: 4px; margin-bottom: 4px; background: ${toRGB(itemColor(tooltipState.data, tooltipState.fromFilter))};"><b>${tooltipState.data.t_name}</b></div>`;
    Object.keys(tooltipState.data).forEach((field) => {
      if (field === 't_name' || field === 'flags') {
        return;
      }
      let key = field;
      if (isNormNumericField(key) || isSearchField(key)) {
        key = unprefixField(key);
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
    const [itemIdx, fromFilter] = getIntersect(mousePosition);
    if (itemIdx) {
      highlightItem(itemIdx, fromFilter);
      showTooltip(mousePosition, items[itemIdx], fromFilter);
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
    const [itemIdx] = getIntersect(mousePosition);
    if (!itemIdx) {
      return;
    }
    flags.applyFlagToItem(flag, items[itemIdx], index);
    updateTooltip();
    updateRecButtonStatus();
  });
}

JSZipUtils.getBinaryContent(`data/${dsName}.zip`, (err, data) => {
  if (err) {
    throw err;
  }
  JSZip.loadAsync(data).then((zip) => {
    const items = zip.file('web.csv').async('string').then((dsCsv) => {
      const lItems = d3.csvParse(dsCsv, (row) => {
        row.idx = +row.idx;
        row.position = [+row.x, +row.y];
        delete row.x;
        delete row.y;
        Object.keys(row).forEach((field) => {
          if (isNormNumericField(field)) {
            row[field] = +row[field];
          }
        });
        row.flags = [];
        return row;
      });
      return lItems;
    });
    const index = zip.file('web_index.json').async('string').then((json) => {
      const js = JSON.parse(json);
      const fields = Object.keys(js.fieldIds);
      const lIndex = MiniSearch.loadJS(js, { fields, idField: 'idx' });
      return lIndex;
    });
    Promise.all([items, index]).then((ds) => { proceedWithDataset(...ds); });
  });
});
