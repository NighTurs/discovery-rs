const pointsSizeInp = document.querySelector('#points-size');
const pointsSizeVal = document.querySelector('#points-size-value');

const pointsOpacityInp = document.querySelector('#points-opacity');
const pointsOpacityVal = document.querySelector('#points-opacity-value');

const searchInp = document.querySelector('#search');
const searchHideOthersInp = document.querySelector('#hide-others');
const searchColorFindingsInp = document.querySelector('#color-findings');

const searchFieldInp = document.querySelector('#search-field');
const colorFieldInp = document.querySelector('#color-field');

const initPointsSize = 3
const initPointsOpacity = 1.0

const findingsColor = '#28aefc'

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
    view.call(zoom);
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

JSZipUtils.getBinaryContent('data/data.zip', function (err, data) {
    if (err) {
        throw err;
    }
    JSZip.loadAsync(data).then(function (zip) {
        zip.file("ds.csv").async("string").then(function (ds_csv) {
            let generated_points = d3.csvParse(ds_csv, function (d) {
                d.idx = +d.idx;
                d.position = [+d.x, +d.y];
                delete d.x;
                delete d.y;
                for (field in d) {
                    if (field.startsWith('n_')) {
                        d[field] = +d[field];
                    }
                }
                return d;
            });
            loadPoints(generated_points);
        });
        zip.file("ds_index.json").async("string").then(function (index_str) {
            loadIndex(JSON.parse(index_str))
        });
    });
});

let loadingInc = 0;

function checkIfLoading() {
    if (loadingInc == 2) {
        document.querySelector('#loader-outer').style.display = "none";
    }
}

let index = null;
    
function loadIndex(data) {
    index = elasticlunr.Index.load(data);
    for (let field of index.getFields()) {
        var opt = document.createElement('option');
        opt.value = field;
        opt.innerHTML = field.substr(2);
        searchFieldInp.appendChild(opt);
    }
    loadingInc++;
    checkIfLoading();
}

function loadPoints(generated_points) {
    for (field in generated_points[0]) {
        if (field.startsWith('n_')) {
            var opt = document.createElement('option');
            opt.value = field;
            opt.innerHTML = field.substr(2);
            colorFieldInp.appendChild(opt);
        }
    }

    let pointsGeometry = new THREE.Geometry();

    function colorFromPct(v) {
        return d3.interpolateOranges(1 - v)
    }

    function getColor(point, fromFilter) {
        if (fromFilter && searchColorFindingsInp.checked) {
            return findingsColor;
        } else {
            return colorFromPct(point[colorFieldInp.value]);
        }
    }

    let colors = [];
    let idxs = [];
    let idx = 0;
    for (let datum of generated_points) {
        // Set vector coordinates from data
        let vertex = new THREE.Vector3(datum.position[0], datum.position[1], 0);
        pointsGeometry.vertices.push(vertex);
        let color = new THREE.Color(getColor(datum, false));
        colors.push(color);
        idxs.push(idx++);
    }
    pointsGeometry.colors = colors;

    let pointsMaterial = new THREE.PointsMaterial({
        size: initPointsSize,
        sizeAttenuation: false,
        vertexColors: THREE.VertexColors,
        map: circle_sprite,
        opacity: 1,
        transparent: true
    });

    let points = new THREE.Points(pointsGeometry, pointsMaterial);
    points.idxs = idxs;

    let scene = new THREE.Scene();
    scene.add(points);
    scene.background = new THREE.Color(0x0000000);

    filterContainer = new THREE.Object3D()
    scene.add(filterContainer);

    // Three.js render loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    function pointsSizeInputHandler(newVal) {
        pointsSizeInp.value = newVal;
        pointsSizeVal.innerHTML = newVal;
        points.material.size = newVal;
        if (filterContainer.children.length > 0) {
            filterContainer.children[0].material.size = newVal;
        }
    }

    pointsSizeInputHandler(initPointsSize)
    pointsSizeInp.addEventListener('input', event => pointsSizeInputHandler(+event.target.value));

    function pointsOpacityInputHandler(newVal) {
        pointsOpacityInp.value = newVal;
        pointsOpacityVal.innerHTML = newVal;
        points.material.opacity = newVal;
        if (filterContainer.children.length > 0) {
            filterContainer.children[0].material.opacity = newVal;
        }
    }

    pointsOpacityInputHandler(initPointsOpacity)
    pointsOpacityInp.addEventListener('input', event => pointsOpacityInputHandler(+event.target.value));

    function switchHideOthers(newVal) {
        points.visible = !newVal;
        searchHideOthersInp.checked = newVal;
    }

    function searchHideOthersInputHandler() {
        switchHideOthers(searchHideOthersInp.checked);
    }

    searchHideOthersInp.addEventListener('input', event => searchHideOthersInputHandler());

    function searchInputHandler() {
        newVal = searchInp.value;
        if (newVal) {
            filterContainer.remove(...filterContainer.children);
            searchOpt = { fields: {} }
            searchOpt.fields[searchFieldInp.value] = { bool: "AND" }
            found = index.search(newVal, searchOpt);
            if (found.length > 0) {
                let geometry = new THREE.Geometry();
                let colors = [];
                let idxs = [];
                for (let datum of found) {
                    let idx = +datum.ref;
                    let item = generated_points[idx];
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
                filterContainer.add(pointsObj);
                switchHideOthers(true);
            }
        } else {
            switchHideOthers(false);
            filterContainer.remove(...filterContainer.children);
        }
    }

    searchInp.addEventListener('input', event => searchInputHandler());
    searchFieldInp.addEventListener('input', event => searchInputHandler());

    function colorFilterResults() {
        if (filterContainer.children.length == 0) {
            return;
        }
        let pointsObj = filterContainer.children[0];

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
        for (let i = 0; i < generated_points.length; i++) {
            let color = new THREE.Color(getColor(generated_points[i], false));
            pointsGeometry.colors[i] = color;
        }
        pointsGeometry.colorsNeedUpdate = true;
    }

    colorFieldInp.addEventListener('input', event => updateColors());

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
        if (points.visible == true) {
            pointsObj = points;
        } else {
            pointsObj = filterContainer.children[0];
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
        return _.sortBy(intersects, "distanceToRay");
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

    let tooltip_template = document.createRange().createContextualFragment(`<div id="tooltip" style="display: none; position: absolute; pointer-events: none; font-size: 13px; width: 150px; text-align: center; line-height: 1; padding: 6px; background: white; font-family: sans-serif;"/>`);
    document.body.append(tooltip_template);

    let $tooltip = document.querySelector('#tooltip');

    function updateTooltip() {
        $tooltip.style.display = tooltip_state.display;
        while ($tooltip.firstChild) {
            $tooltip.removeChild($tooltip.firstChild);
        }
        $tooltip.innerHTML += `<div style="padding: 4px; margin-bottom: 4px; background: ${getColor(tooltip_state.data, tooltip_state.fromFilter)};"><b>${tooltip_state.data.t_name}</b></div>`;
        for (field in tooltip_state.data) {
            if (field == "t_name") {
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
        let tooltip_width = 150;
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