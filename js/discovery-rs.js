const pointsSizeInp = document.querySelector('#points-size');
const pointsSizeVal = document.querySelector('#points-size-value');

const pointsOpacityInp = document.querySelector('#points-opacity');
const pointsOpacityVal = document.querySelector('#points-opacity-value');

const searchInp = document.querySelector('#search');
const searchHideOthersInp = document.querySelector('#hide-others');
const searchColorFindingsInp = document.querySelector('#color-findings');

const searchFieldInp = document.querySelector('#search-field');

const initPointsSize = 3
const initPointsOpacity = 1.0

const findingsColor = '#28aefc'

let toolbarWidth = document.querySelector('#toolbar').clientWidth

let width = window.innerWidth - toolbarWidth;
let viz_width = width;
let height = window.innerHeight;

let fov = 40;
let near = 2;
let far = 400;

// Set up camera and scene
let camera = new THREE.PerspectiveCamera(
    fov,
    width / height,
    near,
    far + 1
);

window.addEventListener('resize', () => {
    width = window.innerWidth - toolbarWidth;
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
    .scaleExtent([getScaleFromZ(far), getScaleFromZ(near)])
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

let index = null;
d3.json('data/ds_index.json').then(function (d) {
    index = elasticlunr.Index.load(d);
    for (let field of index.getFields()) {
        var opt = document.createElement('option');
        opt.value = field;
        opt.innerHTML = field;
        searchFieldInp.appendChild(opt);
    }
});

d3.csv('data/ds.csv', function (d) {
    return {
        idx: +d.idx,
        position: [+d.x, +d.y],
        name: d.name,
        listeners: +d.listeners,
        tags: d.tags
    }
}).then(function (generated_points) {
    let maxListeners = 0
    let minListeners = generated_points[0].listeners

    for (let dat of generated_points) {
        if (maxListeners < dat.listeners) {
            maxListeners = dat.listeners
        }
        if (minListeners > dat.listeners) {
            minListeners = dat.listeners
        }
    }

    let pointsGeometry = new THREE.Geometry();

    function colorFromListeners(v) {
        return d3.interpolateOranges(1 - Math.log2(v - minListeners + 1) / Math.log2(maxListeners - minListeners + 1))
    }

    function getColor(point, fromFilter) {
        if (fromFilter && searchColorFindingsInp.checked) {
            return findingsColor;
        } else {
            return colorFromListeners(point.listeners);
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
            console.log(searchOpt);
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

    // Hover and tooltip interaction

    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 10;

    view.on("mousemove", () => {
        let [mouseX, mouseY] = d3.mouse(view.node());
        let mouse_position = [mouseX, mouseY];
        checkIntersects(mouse_position);
    });

    function mouseToThree(mouseX, mouseY) {
        return new THREE.Vector3(
            mouseX / viz_width * 2 - 1,
            -(mouseY / height) * 2 + 1,
            1
        );
    }

    function checkIntersects(mouse_position) {
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
            highlightPoint(datum, fromFilter);
            showTooltip(mouse_position, datum, fromFilter);
        } else {
            removeHighlights();
            hideTooltip();
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
        removeHighlights()
    });

    // Initial tooltip state
    let tooltip_state = { display: "none", data: {} }

    let tooltip_template = document.createRange().createContextualFragment(`<div id="tooltip" style="display: none; position: absolute; pointer-events: none; font-size: 13px; width: 120px; text-align: center; line-height: 1; padding: 6px; background: white; font-family: sans-serif;">
  <div id="point_tip" style="padding: 4px; margin-bottom: 4px;"></div>
  <div id="group_tip" style="padding: 4px;"></div>
  <div id="tags_tip" style="padding: 4px;"></div>
</div>`);
    document.body.append(tooltip_template);

    let $tooltip = document.querySelector('#tooltip');
    let $point_tip = document.querySelector('#point_tip');
    let $group_tip = document.querySelector('#group_tip');
    let $tags_tip = document.querySelector('#tags_tip');

    function updateTooltip() {
        $tooltip.style.display = tooltip_state.display;
        $tooltip.style.left = tooltip_state.left + 'px';
        $tooltip.style.top = tooltip_state.top + 'px';
        $point_tip.innerText = tooltip_state.data.name;
        $point_tip.style.background = getColor(tooltip_state.data, tooltip_state.fromFilter);
        $group_tip.innerText = `Listeners ${tooltip_state.data.listeners}`;
        $tags_tip.innerText = `Tags ${tooltip_state.data.tags}`;
    }

    function showTooltip(mouse_position, datum, fromFilter) {
        let tooltip_width = 120;
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
})