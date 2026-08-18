import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

export class Keychain3DViewer {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.modelGroup = null;
    this.animationFrameId = null;

    this.init();
  }

  init() {
    // Clear container
    this.container.innerHTML = '';

    const width = this.container.clientWidth || 240;
    const height = this.container.clientHeight || 200;

    // Scene
    this.scene = new THREE.Scene();
    // Dark background matching document preview theme
    this.scene.background = new THREE.Color(0x050714);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 100);

    // Renderer - preserveDrawingBuffer: true is required for PDF snapshot export!
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;

    // Lighting - Soft Hemisphere + Directional Lights for Vibrant Colors
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x333333, 1.2);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight1.position.set(50, 80, 100);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight2.position.set(-50, -50, -50);
    this.scene.add(dirLight2);

    // Group for 3D model
    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    // Resize observer
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);

    // Start render loop
    this.animate();
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || 240;
    const height = this.container.clientHeight || 200;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  load3MF(arrayBuffer, customColor = null) {
    return new Promise((resolve, reject) => {
      try {
        const loader = new ThreeMFLoader();
        const object = loader.parse(arrayBuffer);

        // Clear existing models
        while (this.modelGroup.children.length > 0) {
          const child = this.modelGroup.children[0];
          this.modelGroup.remove(child);
        }

        let hasNativeColors = false;

        // Traverse mesh to inspect and fix materials/colors
        object.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const hasVertexColors = child.geometry && child.geometry.attributes && child.geometry.attributes.color;

            if (customColor) {
              // User specified a custom color override
              child.material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(customColor),
                metalness: 0.2,
                roughness: 0.4
              });
            } else if (hasVertexColors) {
              // 3MF contains vertex color attribute
              hasNativeColors = true;
              child.material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                metalness: 0.1,
                roughness: 0.5
              });
            } else if (child.material) {
              // 3MF loader assigned material(s)
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  mat.side = THREE.DoubleSide;
                  if (mat.color && mat.color.getHex() !== 0xffffff && mat.color.getHex() !== 0x000000) {
                    hasNativeColors = true;
                  }
                });
              } else {
                child.material.side = THREE.DoubleSide;
                if (child.material.color && child.material.color.getHex() !== 0xffffff && child.material.color.getHex() !== 0x000000) {
                  hasNativeColors = true;
                }
              }
            } else {
              // Fallback material if 3MF has no materials defined
              child.material = new THREE.MeshStandardMaterial({
                color: 0xff1b49,
                metalness: 0.2,
                roughness: 0.4
              });
            }
          }
        });

        // Center and scale object
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        object.position.sub(center); // Center geometry

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetDim = 45; // Scale to fit camera view nicely
        if (maxDim > 0) {
          const scale = targetDim / maxDim;
          object.scale.set(scale, scale, scale);
        }

        this.modelGroup.add(object);

        // Reset camera position to view object
        this.camera.position.set(0, 0, 70);
        this.controls.reset();
        this.controls.target.set(0, 0, 0);

        resolve({ object, hasNativeColors });
      } catch (err) {
        console.error('Error parsing 3MF model:', err);
        reject(err);
      }
    });
  }

  setModelColor(colorHex) {
    if (!this.modelGroup) return;
    this.modelGroup.traverse((child) => {
      if (child.isMesh) {
        if (colorHex) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorHex),
            metalness: 0.2,
            roughness: 0.4
          });
        }
      }
    });
  }

  getSnapshotDataURL() {
    if (!this.renderer || !this.scene || !this.camera) return null;
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
    }
  }
}
