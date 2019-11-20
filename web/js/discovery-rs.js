const pointsSizeInp = document.querySelector('#points-size');
const pointsSizeVal = document.querySelector('#points-size-value');

const pointsOpacityInp = document.querySelector('#points-opacity');
const pointsOpacityVal = document.querySelector('#points-opacity-value');

const colorBalanceInp = document.querySelector('#color-balance');
const colorBalanceVal = document.querySelector('#color-balance-value');

const filterInp = document.querySelector('#filter-range');
const filterVal = document.querySelector('#filter-value');

const searchInp = document.querySelector('#search');
const searchHideOthersInp = document.querySelector('#hide-others');
const searchColorFindingsInp = document.querySelector('#color-findings');

const searchFieldInp = document.querySelector('#search-field');
const colorFieldInp = document.querySelector('#color-field');
const datasetFieldInp = document.querySelector('#dataset-field');
const filterFieldInp = document.querySelector('#filter-field');

const flagNameInp = document.querySelector("#flag-name");
const flagNameDatalistInp = document.querySelector("#flag-name-datalist");

const recServerInp = document.querySelector("#rec-server");
const recButton = document.querySelector("#rec-button");

const initPointsSize = 3
const initPointsOpacity = 1.0

const findingsColor = '#28aefc'

filterInp.value = 0
filterVal.innerHTML = 0
colorBalanceInp.value = 0.5
colorBalanceVal.innerHTML = 0.5

let width = window.innerWidth;
let viz_width = width;
let height = window.innerHeight;

let fov = 20;
let near = 2;
let far = 800;

// Set up camera and scene
let camera = new THREE.PerspectiveCamera(
    fov,
    width / height,
    near,
    far + 1
);

window.addEventListener('resize', () => {
    width = window.innerWidth;
    viz_width = width;
    height = window.innerHeight;

    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
})

// Add canvas
let renderer = new THREE.WebGLRenderer();
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

let zoom = d3.zoom()
    .scaleExtent([getScaleFromZ(far), getScaleFromZ(near + 1)])
    .on('zoom', () => {
        let d3_transform = d3.event.transform;
        zoomHandler(d3_transform);
    });

view = d3.select(renderer.domElement);
function setUpZoom() {
    view.call(zoom).on("dblclick.zoom", null);
    let initial_scale = getScaleFromZ(far);
    var initial_transform = d3.zoomIdentity.translate(viz_width / 2, height / 2).scale(initial_scale);
    zoom.transform(view, initial_transform);
    camera.position.set(0, 0, far);
}
setUpZoom();

circle_sprite = new THREE.TextureLoader().load(
    "res/circle-sprite.png"
)

function zoomHandler(d3_transform) {
    let scale = d3_transform.k;
    let x = -(d3_transform.x - viz_width / 2) / scale;
    let y = (d3_transform.y - height / 2) / scale;
    let z = getZFromScale(scale);
    camera.position.set(x, y, z);
}

function getScaleFromZ(camera_z_position) {
    let half_fov = fov / 2;
    let half_fov_radians = toRadians(half_fov);
    let half_fov_height = Math.tan(half_fov_radians) * camera_z_position;
    let fov_height = half_fov_height * 2;
    let scale = height / fov_height; // Divide visualization height by height derived from field of view
    return scale;
}

function getZFromScale(scale) {
    let half_fov = fov / 2;
    let half_fov_radians = toRadians(half_fov);
    let scale_height = height / scale;
    let camera_z_position = scale_height / (2 * Math.tan(half_fov_radians));
    return camera_z_position;
}

function toRadians(angle) {
    return angle * (Math.PI / 180);
}

function datasetRedirect() {
    window.location = window.location.origin + window.location.pathname + "?ds=" + datasetFieldInp.value
}

datasetFieldInp.addEventListener('change', event => datasetRedirect());

const urlParams = new URLSearchParams(window.location.search);

function parseDatasetName() {
    let ds = urlParams.get('ds');

    if (!ds) {
        ds = datasetFieldInp.value;
    }

    if (datasetFieldInp.value != ds) {
        datasetFieldInp.value = ds;
    }
    return ds;
}

const ds = parseDatasetName();
const lsFlagsItem = ds + '-flags';

let flags = window.localStorage.getItem(lsFlagsItem);
if (!flags) {
    flags = "{}";
}
flags = JSON.parse(flags);

let generated_points = null;
let index = null;
let loadingInc = 0;

JSZipUtils.getBinaryContent(`data/${ds}.zip`, function (err, data) {
    if (err) {
        throw err;
    }
    JSZip.loadAsync(data).then(function (zip) {
        zip.file("web.csv").async("string").then(function (ds_csv) {
            generated_points = d3.csvParse(ds_csv, function (d) {
                d.idx = +d.idx;
                d.position = [+d.x, +d.y];
                delete d.x;
                delete d.y;
                for (field in d) {
                    if (field.startsWith('n_')) {
                        d[field] = +d[field];
                    }
                }
                d['flags'] = [];
                return d;
            });
            loadPoints();
        });
        zip.file("web_index.json").async("string").then(function (index_str) {
            loadIndex(index_str)
        });
    });
});

function checkIfLoading() {
    if (loadingInc == 2) {
        applyFlagsFromLS();
        document.querySelector('#loader-outer').style.display = "none";
    }
}

function updateFlagInIndex(item) {
    index.remove(item);
    item["t_flags"] = item.flags.join(separator = ", ");
    if (item.t_flags.length == 0) {
        delete item.t_flags;
    }
    index.add(item);
}

function updateFlagsDatalist() {
    flagNameDatalistInp.innerHTML = '';
    for (let flag in flags) {
        var opt = document.createElement('option');
        opt.value = flag;
        flagNameDatalistInp.appendChild(opt);
    }
}

function applyFlagsFromLS() {
    for (let flag in flags) {
        for (let idx of flags[flag]) {
            let item = generated_points[idx];
            item.flags.push(flag);
            updateFlagInIndex(item);
        }
    }
    updateFlagsDatalist();
}

function loadIndex(data) {
    let fields = Object.keys(JSON.parse(data).fieldIds);
    index = MiniSearch.loadJSON(data, { fields: fields, idField: 'idx' });
    for (let field in index._fieldIds) {
        var opt = document.createElement('option');
        opt.value = field;
        opt.innerHTML = field.substr(2);
        searchFieldInp.appendChild(opt);
    }
    loadingInc++;
    checkIfLoading();
}

function loadPoints() {

    for (field in generated_points[0]) {
        if (field.startsWith('n_')) {
            var opt = document.createElement('option');
            opt.value = field;
            opt.innerHTML = field.substr(2);
            colorFieldInp.appendChild(opt);
            filterFieldInp.appendChild(opt.cloneNode(true));
        }
    }

    function colorFromPct(v) {
        let balance = colorBalanceInp.value;
        let p = 0;
        if (v >= balance) {
            p = 1 - balance;
        } else {
            p = balance;
        }
        return d3.interpolateOranges(1 - (0.5 + (v - balance) * 0.5 / p));
    }

    function getColor(point, fromFilter) {
        if (fromFilter && searchColorFindingsInp.checked) {
            return findingsColor;
        } else {
            return colorFromPct(point[colorFieldInp.value]);
        }
    }

    function applyFilter(point) {
        return filterInp.value <= point[filterFieldInp.value];
    }

    let scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0000000);
    pointsContainer = new THREE.Object3D();
    searchContainer = new THREE.Object3D();
    scene.add(pointsContainer);
    scene.add(searchContainer);

    function addPoints() {
        pointsContainer.remove(...pointsContainer.children);
        let pointsGeometry = new THREE.Geometry();
        let colors = [];
        let idxs = [];
        let idx = -1;
        for (let datum of generated_points) {
            idx++;
            if (!applyFilter(datum)) {
                continue;
            }
            // Set vector coordinates from data
            let vertex = new THREE.Vector3(datum.position[0], datum.position[1], 0);
            pointsGeometry.vertices.push(vertex);
            let color = new THREE.Color(getColor(datum, false));
            colors.push(color);
            idxs.push(idx);
        }
        pointsGeometry.colors = colors;

        let pointsMaterial = new THREE.PointsMaterial({
            size: pointsSizeInp.value,
            sizeAttenuation: false,
            vertexColors: THREE.VertexColors,
            map: circle_sprite,
            opacity: pointsOpacityInp.value,
            transparent: true
        });

        let points = new THREE.Points(pointsGeometry, pointsMaterial);
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

    pointsSizeInputHandler(initPointsSize)
    pointsSizeInp.addEventListener('input', event => pointsSizeInputHandler(+event.target.value));

    function pointsOpacityInputHandler(newVal) {
        pointsOpacityInp.value = newVal;
        pointsOpacityVal.innerHTML = newVal;
        pointsContainer.children[0].material.opacity = newVal;
        if (searchContainer.children.length > 0) {
            searchContainer.children[0].material.opacity = newVal;
        }
    }

    pointsOpacityInputHandler(initPointsOpacity)
    pointsOpacityInp.addEventListener('input', event => pointsOpacityInputHandler(+event.target.value));

    function switchHideOthers(newVal) {
        pointsContainer.visible = !newVal;
        searchHideOthersInp.checked = newVal;
    }

    function searchHideOthersInputHandler() {
        switchHideOthers(searchHideOthersInp.checked);
    }

    searchHideOthersInp.addEventListener('input', event => searchHideOthersInputHandler());

    function addSearchPoints() {
        let searchQuery = searchInp.value;
        searchContainer.remove(...searchContainer.children);
        if (!searchQuery) {
            return;
        }
        searchOpt = { fields: [searchFieldInp.value], combineWith: 'AND' }
        found = index.search(searchQuery, searchOpt);
        if (found.length > 0) {
            let geometry = new THREE.Geometry();
            let colors = [];
            let idxs = [];
            for (let datum of found) {
                let idx = +datum.id;
                let item = generated_points[idx];
                if (!applyFilter(item)) {
                    continue;
                }
                idxs.push(idx);
                geometry.vertices.push(
                    new THREE.Vector3(
                        item.position[0],
                        item.position[1],
                        0
                    )
                );
                colors.push(new THREE.Color(getColor(item, true)))
            }
            geometry.colors = colors;

            let material = new THREE.PointsMaterial({
                size: pointsSizeInp.value,
                sizeAttenuation: false,
                vertexColors: THREE.VertexColors,
                map: circle_sprite,
                opacity: pointsOpacityInp.value,
                transparent: true
            });

            let pointsObj = new THREE.Points(geometry, material);
            pointsObj.idxs = idxs;
            searchContainer.add(pointsObj);
        }
    }

    function searchInputHandler() {
        let newVal = searchInp.value;
        if (newVal) {
            addSearchPoints();
            switchHideOthers(true);
        } else {
            switchHideOthers(false);
            searchContainer.remove(...searchContainer.children);
        }
    }

    searchInp.addEventListener('input', event => searchInputHandler());
    searchFieldInp.addEventListener('input', event => searchInputHandler());

    function filterInputHandler() {
        let newVal = filterInp.value;
        filterVal.innerHTML = newVal;
        addPoints()
        addSearchPoints()
    }

    filterInp.addEventListener('input', event => filterInputHandler());
    filterFieldInp.addEventListener('input', event => filterInputHandler());

    function colorFilterResults() {
        if (searchContainer.children.length == 0) {
            return;
        }
        let pointsObj = searchContainer.children[0];

        for (let i = 0; i < pointsObj.idxs.length; i++) {
            let idx = pointsObj.idxs[i];
            let color = getColor(generated_points[idx], true);
            pointsObj.geometry.colors[i] = new THREE.Color(color);
        }
        pointsObj.geometry.colorsNeedUpdate = true;
    }

    searchColorFindingsInp.addEventListener('input', event => colorFilterResults());

    function updateColors() {
        colorFilterResults();
        let points = pointsContainer.children[0]
        for (let i = 0; i < points.idxs.length; i++) {
            let idx = points.idxs[i];
            let color = new THREE.Color(getColor(generated_points[idx], false));
            points.geometry.colors[i] = color;
        }
        points.geometry.colorsNeedUpdate = true;
    }

    colorFieldInp.addEventListener('input', event => updateColors());

    function colorBalanceInputHandler() {
        let newVal = colorBalanceInp.value;
        colorBalanceVal.innerHTML = newVal;
        updateColors();
    }

    colorBalanceInp.addEventListener('input', event => colorBalanceInputHandler());

    // Hover and tooltip interaction

    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 10;

    view.on("mousemove", () => {
        let [mouseX, mouseY] = d3.mouse(view.node());
        let mouse_position = [mouseX, mouseY];
        const [datum, fromFilter] = getIntersect(mouse_position);
        if (datum) {
            highlightPoint(datum, fromFilter);
            showTooltip(mouse_position, datum, fromFilter);
        } else {
            removeHighlights();
            hideTooltip();
        }
    });

    view.on("click", () => {
        let [mouseX, mouseY] = d3.mouse(view.node());
        let mouse_position = [mouseX, mouseY];
        const [datum, fromFilter] = getIntersect(mouse_position);
        if (datum) {
            let textArea = document.createElement("textarea");
            document.body.appendChild(textArea);
            textArea.value = datum['t_name'];
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
        }
    })

    function updateFlagsLocalStorage() {
        window.localStorage.setItem(lsFlagsItem, JSON.stringify(flags));
    }

    view.on("dblclick", () => {
        let flag = flagNameInp.value;
        if (flag.length == 0) {
            return;
        }
        let [mouseX, mouseY] = d3.mouse(view.node());
        let mouse_position = [mouseX, mouseY];
        const [datum, fromFilter] = getIntersect(mouse_position);
        if (!datum) {
            return;
        }
        if (datum.flags.includes(flag)) {
            datum.flags = datum.flags.filter(x => x !== flag);
            flags[flag] = flags[flag].filter(x => x !== datum.idx);
            if (flags[flag].length == 0) {
                delete flags[flag];
            }
        } else {
            datum.flags.push(flag);
            if (!flags.hasOwnProperty(flag)) {
                flags[flag] = [];
            }
            flags[flag].push(datum.idx);
        }
        updateFlagInIndex(datum);
        updateFlagsLocalStorage();
        updateFlagsDatalist();
        updateTooltip();
    });

    recButton.onclick = () => {
        if (recServerInp.value.length == 0 || flagNameDatalistInp.value == 0) {
            return;
        }
        let recField = flagNameInp.value + '_recommend';
        fetch(recServerInp.value, {
            method: 'POST',
            body: JSON.stringify({ ds: ds, idxs: flags[flagNameInp.value] }),
            headers: new Headers({
                'Content-Type': 'application/json'
            })
        }).then(response => {
            return response.json();
        }).then(data => {
            for (let i = 0; i < generated_points.length; i++) {
                generated_points[i][recField] = data.recs[i];
            }
            let found = false;
            for (let opt of colorFieldInp.children) {
                if (opt.value == recField) {
                    found = true;
                }
            }
            if (!found) {
                var opt = document.createElement('option');
                opt.value = recField;
                opt.innerHTML = recField;
                colorFieldInp.appendChild(opt);
                filterFieldInp.appendChild(opt.cloneNode(true));
            }
            colorFieldInp.value = recField;
            updateColors();
            filterFieldInp.value = recField;
            filterInputHandler();
        })
        .catch(error => console.error(error));
    }

    function mouseToThree(mouseX, mouseY) {
        return new THREE.Vector3(
            mouseX / viz_width * 2 - 1,
            -(mouseY / height) * 2 + 1,
            1
        );
    }

    function getIntersect(mouse_position) {
        let mouse_vector = mouseToThree(...mouse_position);
        raycaster.setFromCamera(mouse_vector, camera);
        let pointsObj = null;
        let fromFilter = false;
        if (pointsContainer.visible == true) {
            pointsObj = pointsContainer.children[0];
        } else {
            pointsObj = searchContainer.children[0];
            fromFilter = true;
        }
        let intersects = raycaster.intersectObject(pointsObj);

        if (intersects[0]) {
            let sorted_intersects = sortIntersectsByDistanceToRay(intersects);
            let intersect = sorted_intersects[0];
            let index = pointsObj.idxs[intersect.index];
            let datum = generated_points[index];
            return [datum, fromFilter];
        } else {
            return [null, fromFilter];
        }
    }

    function sortIntersectsByDistanceToRay(intersects) {
        let res = intersects.slice();
        res.sort((a, b) => (a.distanceToRay > b.distanceToRay) ? 1 : ((b.distanceToRay > a.distanceToRay) ? -1 : 0));
        return res;
    }

    hoverContainer = new THREE.Object3D()
    scene.add(hoverContainer);

    function highlightPoint(datum, fromFilter) {
        removeHighlights();

        let geometry = new THREE.Geometry();
        geometry.vertices.push(
            new THREE.Vector3(
                datum.position[0],
                datum.position[1],
                0
            )
        );
        geometry.colors = [new THREE.Color(getColor(datum, fromFilter))];

        let material = new THREE.PointsMaterial({
            size: 26,
            sizeAttenuation: false,
            vertexColors: THREE.VertexColors,
            map: circle_sprite,
            transparent: true
        });

        let point = new THREE.Points(geometry, material);
        hoverContainer.add(point);
    }

    function removeHighlights() {
        hoverContainer.remove(...hoverContainer.children);
    }

    view.on("mouseleave", () => {
        removeHighlights();
        hideTooltip();
    });

    // Initial tooltip state
    let tooltip_state = { display: "none", data: {} }

    let tooltip_template = document.createRange().createContextualFragment(`<div id="tooltip" style="display: none; position: absolute; pointer-events: none; font-size: 13px; width: 200px; text-align: center; line-height: 1; padding: 6px; background: white; font-family: sans-serif;"/>`);
    document.body.append(tooltip_template);

    let $tooltip = document.querySelector('#tooltip');

    function updateTooltip() {
        $tooltip.style.display = tooltip_state.display;
        while ($tooltip.firstChild) {
            $tooltip.removeChild($tooltip.firstChild);
        }
        $tooltip.innerHTML += `<div style="padding: 4px; margin-bottom: 4px; background: ${getColor(tooltip_state.data, tooltip_state.fromFilter)};"><b>${tooltip_state.data.t_name}</b></div>`;
        for (field in tooltip_state.data) {
            if (field == "t_name" || field == "flags") {
                continue;
            }
            let key = field;
            if (key.startsWith('n_') || key.startsWith('t_')) {
                key = key.substr(2);
            }
            let val = tooltip_state.data[field];
            // Format floats
            if (Number(val) === val && val % 1 !== 0) {
                val = val.toFixed(4);
            }
            if (field === "position") {
                val = [val[0].toFixed(4), val[1].toFixed(4)];
            }
            $tooltip.innerHTML += `<div style="padding: 4px;">${key}: ${val}</div>`;
        }
        $tooltip.style.left = tooltip_state.left + 'px';
        $tooltip.style.top = tooltip_state.top + 'px';
    }

    function showTooltip(mouse_position, datum, fromFilter) {
        let tooltip_width = 200;
        let x_offset = -tooltip_width / 2;
        let y_offset = 30;
        tooltip_state.display = "block";
        tooltip_state.left = mouse_position[0] + x_offset;
        tooltip_state.top = mouse_position[1] + y_offset;
        tooltip_state.data = datum;
        tooltip_state.fromFilter = fromFilter;
        updateTooltip();
    }

    function hideTooltip() {
        tooltip_state.display = "none";
        updateTooltip();
    }
    loadingInc++;
    checkIfLoading();
}