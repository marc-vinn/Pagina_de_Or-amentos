import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import JSZip from 'jszip';

/**
 * Extrai todas as informações de cores e mapeamento de partes de um arquivo .3MF
 * Compatível com: Bambu Studio, PrusaSlicer, OrcaSlicer, MakerLab e 3MF Padrão.
 * 
 * @param {File | Blob | ArrayBuffer} fileOrBuffer
 */
export async function extract3MFColors(fileOrBuffer) {
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(fileOrBuffer);

    let filamentColors = [];
    const partColorMap = {}; // { partId: "#HEXCOLOR" }

    // 1. Extrai a paleta de filamentos (Metadata/project_settings.config)
    const projectSettingsFile = loadedZip.file('Metadata/project_settings.config');
    if (projectSettingsFile) {
      try {
        const jsonText = await projectSettingsFile.async('string');
        const projectData = JSON.parse(jsonText);

        if (Array.isArray(projectData.filament_colour)) {
          filamentColors = projectData.filament_colour.map(c => 
            c.startsWith('#') ? c : `#${c}`
          );
        }
      } catch (e) {
        console.warn('Não foi possível ler project_settings.config:', e);
      }
    }

    // 2. Mapeia cada parte/objeto para o seu extrusor (Metadata/model_settings.config)
    const modelSettingsFile = loadedZip.file('Metadata/model_settings.config');
    if (modelSettingsFile) {
      try {
        const xmlText = await modelSettingsFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const parts = xmlDoc.querySelectorAll('part, object');
        parts.forEach(part => {
          const id = part.getAttribute('id');
          const extruderMeta = part.querySelector('metadata[key="extruder"]');
          
          if (id && extruderMeta) {
            const extruderIndex = parseInt(extruderMeta.getAttribute('value'), 10) - 1;
            if (filamentColors[extruderIndex]) {
              partColorMap[id] = filamentColors[extruderIndex];
            }
          }
        });
      } catch (e) {
        console.warn('Não foi possível ler model_settings.config:', e);
      }
    }

    // 3. Fallback: Checa o padrão 3MF tradicional (<colorgroup> em 3D/3dmodel.model)
    const mainModelFile = loadedZip.file('3D/3dmodel.model') || loadedZip.file('3D/Objects/object-304.model');
    if (mainModelFile && Object.keys(partColorMap).length === 0) {
      try {
        const xmlText = await mainModelFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const colorGroups = xmlDoc.querySelectorAll('colorgroup, basematerials');
        colorGroups.forEach(group => {
          const colors = group.querySelectorAll('color, base');
          colors.forEach((c, idx) => {
            const hex = c.getAttribute('color') || c.getAttribute('displaycolor');
            if (hex) {
              partColorMap[idx + 1] = hex.substring(0, 7);
            }
          });
        });
      } catch (e) {
        console.warn('Não foi possível ler 3dmodel.model:', e);
      }
    }

    return {
      filamentColors,
      partColorMap,
      applyToThreeGroup: (threeGroup) => {
        let appliedCount = 0;
        threeGroup.traverse((child) => {
          if (child.isMesh) {
            const name = child.name || (child.parent && child.parent.name) || '';
            const matchedId = name.match(/\d+/)?.[0];
            
            let hexColor = null;

            if (matchedId && partColorMap[matchedId]) {
              hexColor = partColorMap[matchedId];
            } else if (child.userData && child.userData.partId && partColorMap[child.userData.partId]) {
              hexColor = partColorMap[child.userData.partId];
            }

            if (hexColor) {
              child.material = new THREE.MeshStandardMaterial({
                color: hexColor,
                roughness: 0.4,
                metalness: 0.1,
                side: THREE.DoubleSide
              });
              appliedCount++;
            }
          }
        });
        return appliedCount > 0;
      }
    };
  } catch (err) {
    console.warn('Erro na extração de cores 3MF:', err);
    return null;
  }
}

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
    this.container.innerHTML = '';

    const width = this.container.clientWidth || 280;
    const height = this.container.clientHeight || 240;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050714);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 100);

    // Renderer - preserveDrawingBuffer: true for PDF export
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

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x333333, 1.2);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight1.position.set(50, 80, 100);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight2.position.set(-50, -50, -50);
    this.scene.add(dirLight2);

    // Group for 3D model
    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);

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
    const width = this.container.clientWidth || 280;
    const height = this.container.clientHeight || 240;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  async load3MF(arrayBuffer, customColor = null) {
    try {
      const loader = new ThreeMFLoader();
      const object = loader.parse(arrayBuffer);

      // Clear existing models
      while (this.modelGroup.children.length > 0) {
        const child = this.modelGroup.children[0];
        this.modelGroup.remove(child);
      }

      // Try extract color metadata from 3MF slicer config using extract3MFColors
      const colorData = await extract3MFColors(arrayBuffer);
      let appliedExtractedColors = false;

      if (!customColor && colorData && typeof colorData.applyToThreeGroup === 'function') {
        appliedExtractedColors = colorData.applyToThreeGroup(object);
      }

      // Traverse mesh to apply customColor or fallback material if no colors were extracted
      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          const hasVertexColors = child.geometry && child.geometry.attributes && child.geometry.attributes.color;

          if (customColor) {
            child.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(customColor),
              metalness: 0.2,
              roughness: 0.4,
              side: THREE.DoubleSide
            });
          } else if (hasVertexColors) {
            child.material = new THREE.MeshStandardMaterial({
              vertexColors: true,
              metalness: 0.1,
              roughness: 0.5,
              side: THREE.DoubleSide
            });
          } else if (!appliedExtractedColors) {
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => { mat.side = THREE.DoubleSide; });
              } else {
                child.material.side = THREE.DoubleSide;
              }
            } else {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xff1b49,
                metalness: 0.2,
                roughness: 0.4,
                side: THREE.DoubleSide
              });
            }
          }
        }
      });

      // Center and scale object
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      object.position.sub(center); // Center geometry

      const maxDim = Math.max(size.x, size.y, size.z);
      const targetDim = 54;
      if (maxDim > 0) {
        const scale = targetDim / maxDim;
        object.scale.set(scale, scale, scale);
      }

      this.modelGroup.add(object);

      this.camera.position.set(0, 0, 70);
      this.controls.reset();
      this.controls.target.set(0, 0, 0);

      return { object, colorData };
    } catch (err) {
      console.error('Error parsing 3MF model:', err);
      throw err;
    }
  }

  setModelColor(colorHex) {
    if (!this.modelGroup) return;
    this.modelGroup.traverse((child) => {
      if (child.isMesh) {
        if (colorHex) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorHex),
            metalness: 0.2,
            roughness: 0.4,
            side: THREE.DoubleSide
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
