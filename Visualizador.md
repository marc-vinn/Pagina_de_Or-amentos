atribua essa função ao visualizador 3d para captar as cores dos objetos. 3mf carregados e mostrar eles de forma coloridas: 

import JSZip from 'jszip';

/**
 * Extrai todas as informações de cores e mapeamento de partes de um arquivo .3MF
 * Compatible com: Bambu Studio, PrusaSlicer, OrcaSlicer, MakerLab e 3MF Padrão.
 * 
 * @param {File | Blob | ArrayBuffer} fileOrBuffer - O arquivo .3mf carregado pelo usuário
 * @returns {Promise<{
 *   filamentColors: string[],
 *   partColorMap: Record<string, string>,
 *   applyToThreeGroup: (group: THREE.Group) => void
 * }>}
 */
export async function extract3MFColors(fileOrBuffer) {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(fileOrBuffer);

  let filamentColors = [];
  const partColorMap = {}; // { partId: "#HEXCOLOR" }

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
      console.warn('Não foi possível ler project_settings.config:', e);
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

      // Procura por todas as partes e seus extrusores associados
      const parts = xmlDoc.querySelectorAll('part, object');
      parts.forEach(part => {
        const id = part.getAttribute('id');
        const extruderMeta = part.querySelector('metadata[key="extruder"]');
        
        if (id && extruderMeta) {
          const extruderIndex = parseInt(extruderMeta.getAttribute('value'), 10) - 1; // 1-indexed -> 0-indexed
          if (filamentColors[extruderIndex]) {
            partColorMap[id] = filamentColors[extruderIndex];
          }
        }
      });
    } catch (e) {
      console.warn('Não foi possível ler model_settings.config:', e);
    }
  }

  // -------------------------------------------------------------
  // 3. Fallback: Checa o padrão 3MF tradicional (<colorgroup> em 3D/3dmodel.model)
  // -------------------------------------------------------------
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
            partColorMap[idx + 1] = hex.substring(0, 7); // Trunca alfa #RRGGBBAA para #RRGGBB
          }
        });
      });
    } catch (e) {
      console.warn('Não foi possível ler 3dmodel.model:', e);
    }
  }

  // Cor padrão caso alguma parte não tenha cor mapeada
  const DEFAULT_COLOR = '#CCCCCC';

  // -------------------------------------------------------------
  // 4. Retorna os dados e um helper para aplicar direto no Three.js
  // -------------------------------------------------------------
  return {
    filamentColors,
    partColorMap,
    /**
     * Aplica as cores diretamente no modelo Three.js retornado pelo 3MFLoader
     * @param {THREE.Group} threeGroup 
     */
    applyToThreeGroup: (threeGroup) => {
      threeGroup.traverse((child) => {
        if (child.isMesh) {
          // O 3MFLoader atribui o ID da parte ao nome do filho ou no objeto pai/geometria
          const name = child.name || (child.parent && child.parent.name) || '';
          
          // Extrai os números do nome da malha (ex: "Default-337" -> "337")
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
              metalness: 0.1
            });
          }
        }
      });
    }
  };
}
