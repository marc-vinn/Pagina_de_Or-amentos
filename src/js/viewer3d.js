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
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(fileOrBuffer);

  let filamentColors = [];
  const partColorMap = {}; // { partId: "#HEXCOLOR" }
  let orderedPartIds = []; // Ordem dos componentes no 3dmodel.model

  // -------------------------------------------------------------
  // 1. Extrai a paleta de filamentos (Metadata/project_settings.config)
  // -------------------------------------------------------------
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
      console.warn('[3MF Color] Não foi possível ler project_settings.config:', e);
    }
  }

  // -------------------------------------------------------------
  // 2. Mapeia cada parte/objeto para o seu extrusor (Metadata/model_settings.config)
  // -------------------------------------------------------------
  const modelSettingsFile = loadedZip.file('Metadata/model_settings.config');
  if (modelSettingsFile) {
    try {
      const xmlText = await modelSettingsFile.async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      const parts = xmlDoc.querySelectorAll('part');
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
      console.warn('[3MF Color] Não foi possível ler model_settings.config:', e);
    }
  }

  // -------------------------------------------------------------
  // 3. Lê a ordem dos componentes no 3D/3dmodel.model
  //    O 3MFLoader do Three.js cria meshes na mesma ordem dos <component>
  // -------------------------------------------------------------
  const mainModelFile = loadedZip.file('3D/3dmodel.model');
  if (mainModelFile) {
    try {
      const xmlText = await mainModelFile.async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Extrai objectid de cada <component> na ordem em que aparecem
      const components = xmlDoc.querySelectorAll('component');
      components.forEach(comp => {
        const objectid = comp.getAttribute('objectid');
        if (objectid) {
          orderedPartIds.push(objectid);
        }
      });

      // Fallback: Checa colorgroup/basematerials para 3MF padrão
      if (Object.keys(partColorMap).length === 0) {
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
      }
    } catch (e) {
      console.warn('[3MF Color] Não foi possível ler 3dmodel.model:', e);
    }
  }

  // Se não encontrou componentes no modelo principal, tenta nos sub-modelos
  if (orderedPartIds.length === 0) {
    const modelFiles = Object.keys(loadedZip.files).filter(n => n.endsWith('.model'));
    for (const modelPath of modelFiles) {
      try {
        const xmlText = await loadedZip.file(modelPath).async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const components = xmlDoc.querySelectorAll('component');
        components.forEach(comp => {
          const objectid = comp.getAttribute('objectid');
          if (objectid) orderedPartIds.push(objectid);
        });
        if (orderedPartIds.length > 0) break;
      } catch (e) { /* skip */ }
    }
  }

  console.log('[3MF Color] Ordem dos componentes:', orderedPartIds);
  console.log('[3MF Color] partColorMap:', partColorMap);
  console.log('[3MF Color] filamentColors:', filamentColors);

  // Cor padrão caso alguma parte não tenha cor mapeada
  const DEFAULT_COLOR = '#CCCCCC';

  // -------------------------------------------------------------
  // 4. Retorna os dados e um helper para aplicar direto no Three.js
  // -------------------------------------------------------------
  return {
    filamentColors,
    partColorMap,
    orderedPartIds,
    /**
     * Aplica as cores diretamente no modelo Three.js retornado pelo 3MFLoader.
     * Como o 3MFLoader não preserva nomes/IDs das partes, usa a ORDEM
     * dos componentes no 3dmodel.model para mapear meshes por índice.
     * @param {THREE.Group} threeGroup 
     */
    applyToThreeGroup: (threeGroup) => {
      let appliedCount = 0;
      let meshIndex = 0;

      // Coleta todas as meshes na ordem de travessia
      const meshes = [];
      threeGroup.traverse((child) => {
        if (child.isMesh) {
          meshes.push(child);
        }
      });

      console.log(`[3MF Color] ${meshes.length} meshes encontradas, ${orderedPartIds.length} componentes ordenados`);

      meshes.forEach((child, idx) => {
        let hexColor = null;

        // Estratégia principal: mapear mesh por índice -> orderedPartIds -> partColorMap
        if (idx < orderedPartIds.length) {
          const partId = orderedPartIds[idx];
          if (partColorMap[partId]) {
            hexColor = partColorMap[partId];
          }
        }

        // Fallback por nome (caso algum loader preserve nomes)
        if (!hexColor) {
          const name = child.name || (child.parent && child.parent.name) || '';
          const matchedId = name.match(/\d+/)?.[0];
          if (matchedId && partColorMap[matchedId]) {
            hexColor = partColorMap[matchedId];
          }
        }

        // Fallback por userData
        if (!hexColor && child.userData && child.userData.partId && partColorMap[child.userData.partId]) {
          hexColor = partColorMap[child.userData.partId];
        }

        // Computa normais — essencial para MeshStandardMaterial calcular iluminação
        if (child.geometry && !child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
        child.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(hexColor || DEFAULT_COLOR),
          roughness: 0.4,
          metalness: 0.1,
          side: THREE.DoubleSide
        });
        appliedCount++;
        console.log(`[3MF Color] ✅ Mesh[${idx}] -> Part ${orderedPartIds[idx] || '?'} -> ${hexColor || DEFAULT_COLOR}`);
      });

      console.log(`[3MF Color] Total meshes coloridas: ${appliedCount}`);
      return appliedCount > 0;
    }
  };
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

    // Scene - same background as the page
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
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.container.appendChild(this.renderer.domElement);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;

    // Lighting
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

    const dirLight3 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight3.position.set(0, -80, 50);
    this.scene.add(dirLight3);

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

      // Extract color metadata from 3MF slicer configs
      const colorData = await extract3MFColors(arrayBuffer);
      let appliedExtractedColors = false;

      if (customColor) {
        // User specified a custom color override — apply to all meshes
        object.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.geometry && !child.geometry.attributes.normal) {
              child.geometry.computeVertexNormals();
            }
            child.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(customColor),
              metalness: 0.2,
              roughness: 0.4,
              side: THREE.DoubleSide
            });
          }
        });
      } else if (colorData && typeof colorData.applyToThreeGroup === 'function') {
        // Apply extracted colors from the 3MF metadata
        appliedExtractedColors = colorData.applyToThreeGroup(object);
        
        // Ensure castShadow/receiveShadow and normals on all meshes
        object.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.geometry && !child.geometry.attributes.normal) {
              child.geometry.computeVertexNormals();
            }
          }
        });
      }
      
      // If no colors were applied, apply fallback brand color
      if (!customColor && !appliedExtractedColors) {
        object.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.geometry && !child.geometry.attributes.normal) {
              child.geometry.computeVertexNormals();
            }
            child.material = new THREE.MeshStandardMaterial({
              color: 0xff1b49,
              metalness: 0.2,
              roughness: 0.4,
              side: THREE.DoubleSide
            });
          }
        });
      }

      // Orient Z-up slicer models correctly
      object.rotation.x = -Math.PI / 2;

      // Center and scale object
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      object.position.sub(center);

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
