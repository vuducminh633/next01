"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function VanillaSurfaceViewer({ 
  meshes, 
  onMultiSelect 
}: { 
  meshes: any[], 
  onMultiSelect?: (ids: Set<number>) => void 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);

  // 1. INITIALIZE SCENE (Run once)
  useEffect(() => {
    if (!containerRef.current) return;

    // --- YOUR APP.JS INIT CODE GOES HERE ---
    
    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e); // Your background color
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 10000);
    camera.position.set(100, 100, 100);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Lighting (Matched to your app.js)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(100, 100, 50);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-100, -100, -50);
    scene.add(dirLight2);

    // Helpers (Grid & Axes)
    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    const gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Groups
    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    // Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  // 2. UPDATE MESHES (Run when data changes)
  useEffect(() => {
    const group = meshGroupRef.current;
    if (!group) return;

    // Clear old meshes
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      if ((child.material as THREE.Material).dispose) (child.material as THREE.Material).dispose();
      group.remove(child);
    }

    if (!meshes || meshes.length === 0) return;

    console.log(`[Viewer] Rendering ${meshes.length} meshes...`);

    meshes.forEach((meshData) => {
      if (!meshData.vertices || !meshData.indices) return;

      // Create Geometry (Your bridge returns flat arrays, so we use BufferGeometry)
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(meshData.vertices), 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(meshData.indices), 1));
      geometry.computeVertexNormals();

      // Material (Your Blue Color)
      const material = new THREE.MeshPhongMaterial({
        color: 0x00a8ff,
        side: THREE.DoubleSide,
        flatShading: false,
        shininess: 30
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      // Wireframe Overlay
      const wireframe = new THREE.LineSegments(
        new THREE.WireframeGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1, opacity: 0.3, transparent: true })
      );
      
      mesh.add(wireframe);
      group.add(mesh);
    });

    // Fit Camera to Mesh (Optional but helpful)
    if (group.children.length > 0 && cameraRef.current && controlsRef.current) {
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = cameraRef.current.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2; 

        // Only re-center if it's the first load or drastic change
        // cameraRef.current.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
        // cameraRef.current.lookAt(center);
        // controlsRef.current.target.copy(center);
    }

  }, [meshes]);

  return <div ref={containerRef} className="w-full h-full relative" />;
}