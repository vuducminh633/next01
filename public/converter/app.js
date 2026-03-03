// Import Three.js modules
import * as THREE from 'three';
import { OrbitControls } from './three/controls/OrbitControls.js';

// Three.js Scene Setup
let scene, camera, renderer, controls;
let meshGroup, wireframeGroup, axesHelper, gridHelper;
let currentObjContent = '';

// API Configuration - dynamically use current host
const API_URL = window.location.origin;

// Initialize Three.js Scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Setup camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        10000
    );
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);

    // Setup renderer
    const container = document.getElementById('canvas-container');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Add OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 5000;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(100, 100, 50);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-100, -100, -50);
    scene.add(directionalLight2);

    // Add helpers
    axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Create mesh groups
    meshGroup = new THREE.Group();
    scene.add(meshGroup);

    wireframeGroup = new THREE.Group();
    scene.add(wireframeGroup);

    // Window resize handler
    window.addEventListener('resize', onWindowResize, false);

    // Start animation loop
    animate();

    // Setup UI event listeners
    setupEventListeners();

    // Load existing mesh if available
    loadExistingMesh();
}

// Start polling for new mesh data
function startMeshPolling() {
    // Check immediately
    checkForMeshUpdates();
    
    // Then check every 2 seconds
    pollingInterval = setInterval(checkForMeshUpdates, 2000);
}

// Check if there's a new mesh available
async function checkForMeshUpdates() {
    try {
        const response = await fetch(`${API_URL}/api/mesh`);
        
        if (response.ok) {
            const result = await response.json();
            
            console.log('Mesh check:', {
                hasContent: !!result.objContent,
                vertices: result.parsed?.vertices?.length || 0,
                faces: result.parsed?.faces?.length || 0,
                isNew: result.objContent !== currentObjContent
            });
            
            // Check if this is new content
            if (result.objContent !== currentObjContent) {
                console.log('NEW MESH DETECTED - Rendering...');
                currentObjContent = result.objContent;
                renderMeshFromParsed(result.parsed);
                updateStatus('Đã tải lưới mới!', 'success');
            }
        }
    } catch (error) {
        // Silently fail - server might not be ready yet
        console.log('Polling check failed:', error.message);
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Window resize handler
function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Setup UI Event Listeners
function setupEventListeners() {
    document.getElementById('uploadBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('processBtn').addEventListener('click', processMesh);
    document.getElementById('loadSampleBtn').addEventListener('click', loadSampleData);
    document.getElementById('wireframeToggle').addEventListener('change', toggleWireframe);
    document.getElementById('axesToggle').addEventListener('change', toggleAxes);
    document.getElementById('gridToggle').addEventListener('change', toggleGrid);
    document.getElementById('resetViewBtn').addEventListener('click', resetView);
    document.getElementById('topViewBtn').addEventListener('click', topView);
    document.getElementById('exportObjBtn').addEventListener('click', exportOBJ);
}

// Handle file upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        updateStatus('Vui lòng tải lên tệp JSON', 'error');
        return;
    }
    
    try {
        updateStatus('Đang đọc tệp...', 'info');
        const text = await file.text();
        const jsonData = JSON.parse(text);
        
        updateStatus('Đang tải lên máy chủ...', 'info');
        
        const response = await fetch(`${API_URL}/api/cad-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(jsonData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Processing failed');
        }

        currentObjContent = result.objContent;
        updateStatus('Mesh processed successfully! Rendering...', 'success');
        
        // Render the mesh
        renderMeshFromParsed(result.parsed);
        
        console.log('Binary output:', result.stdout);

    } catch (error) {
        console.error('Error:', error);
        updateStatus(`Lỗi: ${error.message}`, 'error');
    }
}

// Process mesh through C++ binary
async function processMesh() {
    const jsonInput = document.getElementById('jsonInput').value;
    
    if (!jsonInput.trim()) {
        updateStatus('Vui lòng cung cấp dữ liệu JSON', 'error');
        return;
    }

    try {
        updateStatus('Đang phân tích JSON...', 'info');
        const inputData = JSON.parse(jsonInput);

        updateStatus('Đang xử lý lưới bằng C++...', 'info');
        
        const response = await fetch(`${API_URL}/api/cad-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(inputData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Xử lý thất bại');
        }

        currentObjContent = result.objContent;
        updateStatus('Xử lý lưới thành công! Đang hiển thị...', 'success');
        
        // Render the mesh
        renderMeshFromParsed(result.parsed);
        
        console.log('Binary output:', result.stdout);

    } catch (error) {
        console.error('Error:', error);
        updateStatus(`Lỗi: ${error.message}`, 'error');
    }
}

// Load existing mesh from server
async function loadExistingMesh() {
    try {
        const response = await fetch(`${API_URL}/api/mesh`);
        
        if (response.ok) {
            const result = await response.json();
            currentObjContent = result.objContent;
            renderMeshFromParsed(result.parsed);
            updateStatus('Đã tải lưới - Đang theo dõi cập nhật...', 'success');
        } else {
            updateStatus('Sẵn sàng - Đang chờ tải dữ liệu lên...', 'info');
        }
    } catch (error) {
        updateStatus('Sẵn sàng - Đang chờ tải dữ liệu lên...', 'info');
    }
}

// Render mesh from parsed data
function renderMeshFromParsed(parsed) {
    console.log('renderMeshFromParsed called with:', parsed);
    
    // Clear existing meshes
    clearMeshes();

    const { vertices, faces } = parsed;

    if (!vertices || !faces) {
        console.error('Missing vertices or faces in parsed data');
        updateStatus('Dữ liệu lưới không hợp lệ', 'error');
        return;
    }

    if (vertices.length === 0 || faces.length === 0) {
        console.warn('Empty geometry');
        updateStatus('Không có hình học để hiển thị', 'warning');
        return;
    }

    console.log(`Rendering: ${vertices.length} vertices, ${faces.length} faces`);

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    
    // Convert vertices to Float32Array
    const positions = new Float32Array(vertices.length * 3);
    vertices.forEach((v, i) => {
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
    });
    
    // Convert faces to index array
    const indices = new Uint32Array(faces.length * 3);
    faces.forEach((f, i) => {
        indices[i * 3] = f.a;
        indices[i * 3 + 1] = f.b;
        indices[i * 3 + 2] = f.c;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    // Create solid mesh
    const material = new THREE.MeshPhongMaterial({
        color: 0x00a8ff,
        side: THREE.DoubleSide,
        flatShading: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    meshGroup.add(mesh);

    // Create wireframe
    const wireframeMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffffff, 
        linewidth: 1 
    });
    const wireframe = new THREE.LineSegments(
        new THREE.WireframeGeometry(geometry),
        wireframeMaterial
    );
    wireframeGroup.add(wireframe);

    // Update stats
    updateStats(vertices.length, faces.length);

    // Center and fit camera
    fitCameraToMesh(mesh);

    updateStatus('Hiển thị lưới thành công', 'success');
}

// Clear all meshes from scene
function clearMeshes() {
    while (meshGroup.children.length > 0) {
        const child = meshGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        meshGroup.remove(child);
    }
    
    while (wireframeGroup.children.length > 0) {
        const child = wireframeGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        wireframeGroup.remove(child);
    }
}

// Fit camera to mesh
function fitCameraToMesh(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 2; // Add some padding
    
    camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
}

// Load sample data
function loadSampleData() {
    const sampleData = [
        {
            "GroupName": "SamplePolygon",
            "FlattenedVertices": [
                [0, 0],
                [100, 0],
                [100, 100],
                [50, 150],
                [0, 100]
            ]
        },
        {
            "GroupName": "Triangle",
            "FlattenedVertices": [
                [150, 0],
                [200, 0],
                [175, 50]
            ]
        }
    ];
    
    document.getElementById('jsonInput').value = JSON.stringify(sampleData, null, 2);
    updateStatus('Đã tải dữ liệu mẫu', 'info');
}

// Toggle wireframe visibility
function toggleWireframe(e) {
    wireframeGroup.visible = e.target.checked;
}

// Toggle axes visibility
function toggleAxes(e) {
    axesHelper.visible = e.target.checked;
}

// Toggle grid visibility
function toggleGrid(e) {
    gridHelper.visible = e.target.checked;
}

// Reset camera view
function resetView() {
    if (meshGroup.children.length > 0) {
        fitCameraToMesh(meshGroup.children[0]);
    } else {
        camera.position.set(100, 100, 100);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

// Top view
function topView() {
    const target = controls.target;
    camera.position.set(target.x, target.y + 200, target.z);
    camera.lookAt(target);
    controls.update();
}

// Export OBJ file
function exportOBJ() {
    if (!currentObjContent) {
        updateStatus('Không có lưới để xuất', 'warning');
        return;
    }
    
    const blob = new Blob([currentObjContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mesh_export.obj';
    a.click();
    URL.revokeObjectURL(url);
    
    updateStatus('Đã xuất tệp OBJ', 'success');
}

// Update mesh statistics
function updateStats(vertexCount, triangleCount) {
    document.getElementById('vertexCount').textContent = vertexCount;
    document.getElementById('triangleCount').textContent = triangleCount;
    document.getElementById('objectCount').textContent = meshGroup.children.length;
}

// Update status message
function updateStatus(message, type = 'info') {
    const statusText = document.getElementById('statusText');
    statusText.textContent = message;
    statusText.className = type;
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);
