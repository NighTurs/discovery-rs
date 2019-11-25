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
const getColor = (function getColorFunc() {
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

  return (point, fromFilter) => {
    if (fromFilter && searchColorFindingsInp.checked) {
      return findingsColor;
    }
    return colorFromNormNumeric(point[colorFieldInp.value]);
  };
}());

function toRGB(scaledColor) {
  return `${d3.rgb(scaledColor[0] * 255, scaledColor[1] * 255, scaledColor[2] * 255)}`;
}

function applyFilter(item) {
  return filterInp.value <= item[filterFieldInp.value];
}

function proceedWithDataset(items, index) {
  const flags = new class Flags {
    constructor() {
      this.lsFlagsItem = `${dsName}-flags`;
      let json = window.localStorage.getItem(this.lsFlagsItem);
      if (!json) {
        json = '{}';
      }
      this.container = JSON.parse(json);
    }

    static updateItemInIndex(item) {
      index.remove(item);
      item.t_flags = item.flags.join(', ');
      if (item.t_flags.length === 0) {
        delete item.t_flags;
      }
      index.add(item);
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
      Flags.updateItemInIndex(item, index);
      this.updateLocalStorage();
      this.updateDatalist();
    }

    applyFlagsToItems() {
      Object.keys(this.container).forEach((flag) => {
        this.container[flag].forEach((idx) => {
          const item = items[idx];
          item.flags.push(flag);
          Flags.updateItemInIndex(item, index);
        });
      });
      this.updateDatalist();
    }

    updateLocalStorage() {
      window.localStorage.setItem(this.lsFlagsItem, JSON.stringify(this.container));
    }
  }();
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

  const pointsContainer = new THREE.Object3D();
  const searchContainer = new THREE.Object3D();
  three.scene.add(pointsContainer);
  three.scene.add(searchContainer);

  function addPoints() {
    pointsContainer.remove(...pointsContainer.children);
    const geometry = new THREE.BufferGeometry();
    const colors = new Float32Array(3 * items.length);
    const vertices = new Float32Array(3 * items.length);
    let aIdx = 0;
    const idxs = [];
    items.forEach((datum, idx) => {
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

  three.animate();

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
        const item = items[idx];
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
      const color = getColor(items[idx], true);
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
      const color = getColor(items[idx], false);
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
    raycaster.setFromCamera(mouseVector, three.camera);
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
      const datum = items[idx];
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

  const hoverContainer = new THREE.Object3D();
  three.scene.add(hoverContainer);

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
    flags.applyFlagToItem(flag, datum, index);
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
