import { Keychain3DViewer } from './viewer3d.js';
import { exportToPDF } from './pdf-export.js';

// Application State
const state = {
  clientName: '7 Mares PV',
  clientLogoUrl: null,
  items: [
    {
      id: 1,
      title: 'Chaveiro Emborrachado 3D',
      mediaType: '2d',
      mediaUrl: null,
      arrayBuffer3D: null,
      customColor: null,
      specs: 'Tamanho: 50x50mm | Relevo 3D em 4 cores | Argola metálica com corrente',
      rows: [
        { id: 101, qnt: 100, vt: 850.00, vun: 8.50 },
        { id: 102, qnt: 250, vt: 1875.00, vun: 7.50 },
        { id: 103, qnt: 500, vt: 3250.00, vun: 6.50 }
      ]
    }
  ]
};

// Map to track active 3D Viewers per item
const active3DViewers = new Map();

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  bindGlobalEvents();
  renderEditor();
  renderPreview();
}

function bindGlobalEvents() {
  // Client Name Input
  const clientNameInput = document.getElementById('client-name-input');
  if (clientNameInput) {
    clientNameInput.value = state.clientName;
    clientNameInput.addEventListener('input', (e) => {
      state.clientName = e.target.value;
      updatePreviewHeader();
    });
  }

  // Client Logo Upload
  const clientLogoInput = document.getElementById('client-logo-input');
  if (clientLogoInput) {
    clientLogoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          state.clientLogoUrl = event.target.result;
          updatePreviewHeader();
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Add New Item Button
  const addItemBtn = document.getElementById('add-item-btn');
  if (addItemBtn) {
    addItemBtn.addEventListener('click', () => {
      addNewItem();
    });
  }

  // Export PDF Button
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      const pdfDoc = document.getElementById('pdf-document');
      exportToPDF(pdfDoc, state.clientName);
    });
  }

  // Load Demo Data Button
  const demoDataBtn = document.getElementById('load-demo-btn');
  if (demoDataBtn) {
    demoDataBtn.addEventListener('click', () => {
      loadDemoData();
    });
  }
}

function addNewItem() {
  const newItemId = Date.now();
  state.items.push({
    id: newItemId,
    title: `Chaveiro Modelo ${state.items.length + 1}`,
    mediaType: '2d',
    mediaUrl: null,
    arrayBuffer3D: null,
    customColor: null,
    specs: 'Tamanho: 45x45mm | Acabamento Premium | Corrente + Argola',
    rows: [
      { id: Date.now() + 1, qnt: 100, vt: 800.00, vun: 8.00 },
      { id: Date.now() + 2, qnt: 300, vt: 2100.00, vun: 7.00 }
    ]
  });
  renderEditor();
  renderPreview();
}

function removeItem(id) {
  if (state.items.length <= 1) {
    alert('O orçamento deve conter pelo menos 1 tabela.');
    return;
  }
  if (active3DViewers.has(id)) {
    active3DViewers.get(id).destroy();
    active3DViewers.delete(id);
  }
  state.items = state.items.filter(item => item.id !== id);
  renderEditor();
  renderPreview();
}

function addNewRow(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const lastRow = item.rows[item.rows.length - 1];
  const newQnt = lastRow ? lastRow.qnt * 2 : 100;
  const newVun = lastRow ? Math.max(1, lastRow.vun * 0.9) : 8.50;

  item.rows.push({
    id: Date.now(),
    qnt: newQnt,
    vun: parseFloat(newVun.toFixed(2)),
    vt: parseFloat((newQnt * newVun).toFixed(2))
  });

  renderEditor();
  renderPreview();
}

function removeRow(itemId, rowId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item || item.rows.length <= 1) return;

  item.rows = item.rows.filter(r => r.id !== rowId);
  renderEditor();
  renderPreview();
}

function renderEditor() {
  const container = document.getElementById('items-editor-container');
  if (!container) return;

  container.innerHTML = '';

  state.items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'item-editor-card';

    const is3D = item.mediaType === '3d';

    card.innerHTML = `
      <div class="item-editor-header">
        <span class="item-title">#${index + 1} - ${escapeHtml(item.title)}</span>
        <button class="btn btn-outline-danger btn-sm remove-item-btn" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Remover Tabela
        </button>
      </div>

      <div class="form-group">
        <label class="form-label">Nome/Modelo do Chaveiro</label>
        <input type="text" class="form-control item-title-input" data-id="${item.id}" value="${escapeHtml(item.title)}">
      </div>

      <div class="file-dropzone" data-id="${item.id}">
        <p>📁 Clique ou arraste uma <strong>Imagem 2D (PNG, JPG)</strong> ou arquivo <strong>.3MF (3D)</strong></p>
        <span class="media-type-badge">${is3D ? '📦 Modelo 3D (.3MF)' : '🖼️ Imagem 2D'}</span>
        <input type="file" class="hidden item-file-input" data-id="${item.id}" accept=".png,.jpg,.jpeg,.webp,.svg,.3mf">
      </div>

      ${is3D ? `
      <div class="form-group color-selector-group">
        <label class="form-label">🎨 Cor do Modelo 3D</label>
        <div class="color-options-row">
          <button type="button" class="color-chip ${!item.customColor ? 'active' : ''}" data-id="${item.id}" data-color="">Original 3MF</button>
          <button type="button" class="color-chip ${item.customColor === '#ff1b49' ? 'active' : ''}" data-id="${item.id}" data-color="#ff1b49" style="background:#ff1b49;"></button>
          <button type="button" class="color-chip ${item.customColor === '#ff6b1b' ? 'active' : ''}" data-id="${item.id}" data-color="#ff6b1b" style="background:#ff6b1b;"></button>
          <button type="button" class="color-chip ${item.customColor === '#f1c40f' ? 'active' : ''}" data-id="${item.id}" data-color="#f1c40f" style="background:#f1c40f;"></button>
          <button type="button" class="color-chip ${item.customColor === '#00d2ff' ? 'active' : ''}" data-id="${item.id}" data-color="#00d2ff" style="background:#00d2ff;"></button>
          <button type="button" class="color-chip ${item.customColor === '#ffffff' ? 'active' : ''}" data-id="${item.id}" data-color="#ffffff" style="background:#ffffff;"></button>
          <input type="color" class="item-color-picker" data-id="${item.id}" value="${item.customColor || '#ff1b49'}" title="Escolher cor personalizada">
        </div>
      </div>
      ` : ''}

      <!-- Multi-row Tier Pricing Section -->
      <div class="table-rows-editor">
        <div class="table-rows-header">
          <label>📊 Linhas de Preço & Quantidades</label>
          <button type="button" class="btn btn-secondary btn-sm add-row-btn" data-item-id="${item.id}">
            + Adicionar Linha
          </button>
        </div>

        ${item.rows.map((row) => `
          <div class="tier-row-item" data-item-id="${item.id}" data-row-id="${row.id}">
            <div>
              <label class="form-label" style="font-size:0.7rem;">Quantidade</label>
              <input type="number" class="form-control tier-qnt-input" data-item-id="${item.id}" data-row-id="${row.id}" value="${row.qnt}" min="1">
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Valor Total (R$)</label>
              <input type="number" step="0.01" class="form-control tier-vt-input" data-item-id="${item.id}" data-row-id="${row.id}" value="${row.vt.toFixed(2)}">
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Valor Unit. (R$)</label>
              <input type="number" step="0.01" class="form-control tier-vun-input" data-item-id="${item.id}" data-row-id="${row.id}" value="${row.vun.toFixed(2)}">
            </div>
            <div style="padding-top: 1.2rem;">
              ${item.rows.length > 1 ? `
                <button type="button" class="btn-icon-danger remove-row-btn" data-item-id="${item.id}" data-row-id="${row.id}" title="Remover linha">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="form-group">
        <label class="form-label">Especificações Técnicas</label>
        <input type="text" class="form-control item-specs-input" data-id="${item.id}" value="${escapeHtml(item.specs)}">
      </div>
    `;

    container.appendChild(card);
  });

  bindEditorCardEvents();
}

function bindEditorCardEvents() {
  // Remove Item
  document.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.dataset.id);
      removeItem(id);
    });
  });

  // Add Row button
  document.querySelectorAll('.add-row-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = parseInt(e.currentTarget.dataset.itemId);
      addNewRow(itemId);
    });
  });

  // Remove Row button
  document.querySelectorAll('.remove-row-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = parseInt(e.currentTarget.dataset.itemId);
      const rowId = parseInt(e.currentTarget.dataset.rowId);
      removeRow(itemId, rowId);
    });
  });

  // Title inputs
  document.querySelectorAll('.item-title-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.id);
      const item = state.items.find(i => i.id === id);
      if (item) {
        item.title = e.target.value;
        renderEditorHeaderTitles();
        renderPreview();
      }
    });
  });

  // Dropzone click & file inputs
  document.querySelectorAll('.file-dropzone').forEach(dropzone => {
    const id = parseInt(dropzone.dataset.id);
    const fileInput = dropzone.querySelector('.item-file-input');

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleMediaFileUpload(id, file);
    });
  });

  // Financial inputs per row (Qnt, Vt, V.Un)
  document.querySelectorAll('.tier-qnt-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const itemId = parseInt(e.target.dataset.itemId);
      const rowId = parseInt(e.target.dataset.rowId);
      const item = state.items.find(i => i.id === itemId);
      if (item) {
        const row = item.rows.find(r => r.id === rowId);
        if (row) {
          row.qnt = parseFloat(e.target.value) || 0;
          row.vt = parseFloat((row.qnt * row.vun).toFixed(2));
          updateRowFinancialInputs(itemId, rowId);
          renderPreview();
        }
      }
    });
  });

  document.querySelectorAll('.tier-vt-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const itemId = parseInt(e.target.dataset.itemId);
      const rowId = parseInt(e.target.dataset.rowId);
      const item = state.items.find(i => i.id === itemId);
      if (item) {
        const row = item.rows.find(r => r.id === rowId);
        if (row) {
          row.vt = parseFloat(e.target.value) || 0;
          row.vun = row.qnt > 0 ? parseFloat((row.vt / row.qnt).toFixed(2)) : 0;
          updateRowFinancialInputs(itemId, rowId);
          renderPreview();
        }
      }
    });
  });

  document.querySelectorAll('.tier-vun-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const itemId = parseInt(e.target.dataset.itemId);
      const rowId = parseInt(e.target.dataset.rowId);
      const item = state.items.find(i => i.id === itemId);
      if (item) {
        const row = item.rows.find(r => r.id === rowId);
        if (row) {
          row.vun = parseFloat(e.target.value) || 0;
          row.vt = parseFloat((row.qnt * row.vun).toFixed(2));
          updateRowFinancialInputs(itemId, rowId);
          renderPreview();
        }
      }
    });
  });

  // Specs inputs
  document.querySelectorAll('.item-specs-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.id);
      const item = state.items.find(i => i.id === id);
      if (item) {
        item.specs = e.target.value;
        renderPreview();
      }
    });
  });

  // Color chips for 3D model
  document.querySelectorAll('.color-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.dataset.id);
      const color = e.currentTarget.dataset.color || null;
      const item = state.items.find(i => i.id === id);
      if (item) {
        item.customColor = color;
        renderEditor();
        if (active3DViewers.has(id)) {
          active3DViewers.get(id).setModelColor(color);
        } else {
          renderPreview();
        }
      }
    });
  });

  // Custom color picker input for 3D model
  document.querySelectorAll('.item-color-picker').forEach(picker => {
    picker.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.id);
      const color = e.target.value;
      const item = state.items.find(i => i.id === id);
      if (item) {
        item.customColor = color;
        if (active3DViewers.has(id)) {
          active3DViewers.get(id).setModelColor(color);
        }
      }
    });
  });
}

function handleMediaFileUpload(itemId, file) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const fileNameLower = file.name.toLowerCase();

  if (fileNameLower.endsWith('.3mf')) {
    // 3D .3mf file processing
    item.mediaType = '3d';
    const reader = new FileReader();
    reader.onload = (e) => {
      item.arrayBuffer3D = e.target.result;
      renderEditor();
      renderPreview();
    };
    reader.readAsArrayBuffer(file);
  } else {
    // 2D Image file processing
    item.mediaType = '2d';
    const reader = new FileReader();
    reader.onload = (e) => {
      item.mediaUrl = e.target.result;
      renderEditor();
      renderPreview();
    };
    reader.readAsDataURL(file);
  }
}

function updateRowFinancialInputs(itemId, rowId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  const row = item.rows.find(r => r.id === rowId);
  if (!row) return;

  const vtInput = document.querySelector(`.tier-vt-input[data-item-id="${itemId}"][data-row-id="${rowId}"]`);
  const vunInput = document.querySelector(`.tier-vun-input[data-item-id="${itemId}"][data-row-id="${rowId}"]`);

  if (vtInput && document.activeElement !== vtInput) {
    vtInput.value = row.vt.toFixed(2);
  }
  if (vunInput && document.activeElement !== vunInput) {
    vunInput.value = row.vun.toFixed(2);
  }
}

function renderEditorHeaderTitles() {
  state.items.forEach((item, index) => {
    const cardTitle = document.querySelector(`.item-editor-card .item-title[data-id="${item.id}"]`);
    if (cardTitle) {
      cardTitle.textContent = `#${index + 1} - ${item.title}`;
    }
  });
}

function updatePreviewHeader() {
  const clientNameDisplay = document.getElementById('doc-client-name-display');
  if (clientNameDisplay) {
    clientNameDisplay.textContent = state.clientName || 'Cliente';
  }

  const clientLogoDisplay = document.getElementById('doc-client-logo-display');
  if (clientLogoDisplay) {
    if (state.clientLogoUrl) {
      clientLogoDisplay.src = state.clientLogoUrl;
      clientLogoDisplay.classList.remove('hidden');
    } else {
      clientLogoDisplay.classList.add('hidden');
    }
  }
}

function renderPreview() {
  updatePreviewHeader();

  const previewContainer = document.getElementById('doc-items-preview-container');
  if (!previewContainer) return;

  previewContainer.innerHTML = '';

  let grandTotal = 0;

  state.items.forEach((item) => {
    // Add total of first pricing tier or highest tier to grand total calculation
    if (item.rows && item.rows.length > 0) {
      grandTotal += item.rows[0].vt;
    }

    const row = document.createElement('div');
    row.className = 'doc-item-row';

    // Media Column (2D Image or 3D Canvas)
    let mediaHTML = '';
    if (item.mediaType === '3d') {
      mediaHTML = `
        <div class="doc-keychain-media">
          <div class="doc-keychain-canvas-wrapper" id="canvas-wrapper-${item.id}">
            <span class="canvas-hint">🖱️ Clique e arraste 3D</span>
          </div>
        </div>
      `;
    } else {
      const defaultKeychainSVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
          <circle cx="100" cy="100" r="85" fill="#090d20" stroke="#ff1b49" stroke-width="8"/>
          <circle cx="100" cy="100" r="60" fill="none" stroke="#ffffff" stroke-width="6"/>
          <polygon points="65,100 135,70 135,130" fill="#ff1b49"/>
          <circle cx="100" cy="20" r="12" fill="none" stroke="#ff1b49" stroke-width="5"/>
        </svg>
      `)}`;

      const imgSrc = item.mediaUrl || defaultKeychainSVG;

      mediaHTML = `
        <div class="doc-keychain-media">
          <img class="doc-keychain-img" src="${imgSrc}" alt="${escapeHtml(item.title)}">
        </div>
      `;
    }

    // Budget Table Column with Multiple Rows
    row.innerHTML = `
      ${mediaHTML}
      <div class="doc-table-container">
        <table class="doc-table">
          <thead>
            <tr>
              <th>Quantidade</th>
              <th>Valor Total</th>
              <th>Valor Unitário</th>
            </tr>
          </thead>
          <tbody>
            ${item.rows.map(r => `
              <tr>
                <td>${r.qnt}</td>
                <td>R$ ${formatCurrency(r.vt)}</td>
                <td>R$ ${formatCurrency(r.vun)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${item.specs ? `<div class="doc-specs-box"><strong>ESPECIFICAÇÕES:</strong> ${escapeHtml(item.specs)}</div>` : ''}
      </div>
    `;

    previewContainer.appendChild(row);

    // Initialize 3D Viewer if item is 3D
    if (item.mediaType === '3d' && item.arrayBuffer3D) {
      setTimeout(() => {
        setup3DViewerForItem(item);
      }, 50);
    }
  });

  // Update Grand Total Footer
  const totalDisplay = document.getElementById('doc-grand-total-display');
  if (totalDisplay) {
    totalDisplay.textContent = `R$ ${formatCurrency(grandTotal)}`;
  }
}

function setup3DViewerForItem(item) {
  const wrapper = document.getElementById(`canvas-wrapper-${item.id}`);
  if (!wrapper) return;

  if (active3DViewers.has(item.id)) {
    active3DViewers.get(item.id).destroy();
    active3DViewers.delete(item.id);
  }

  try {
    const viewer = new Keychain3DViewer(wrapper);
    viewer.load3MF(item.arrayBuffer3D, item.customColor);
    active3DViewers.set(item.id, viewer);
  } catch (e) {
    console.error(`Error rendering 3D viewer for item ${item.id}:`, e);
  }
}

function loadDemoData() {
  state.clientName = '7 Mares PV';
  state.clientLogoUrl = null;
  state.items = [
    {
      id: 101,
      title: 'Chaveiro 3D Logo 7 Mares',
      mediaType: '2d',
      mediaUrl: null,
      arrayBuffer3D: null,
      customColor: null,
      specs: 'Tamanho: 55mm x 55mm | Relevo emborrachado em 3 cores | Argola com corrente giratória',
      rows: [
        { id: 1, qnt: 100, vt: 850.00, vun: 8.50 },
        { id: 2, qnt: 250, vt: 1875.00, vun: 7.50 },
        { id: 3, qnt: 500, vt: 3250.00, vun: 6.50 }
      ]
    },
    {
      id: 102,
      title: 'Chaveiro Metálico Premium',
      mediaType: '2d',
      mediaUrl: null,
      arrayBuffer3D: null,
      customColor: null,
      specs: 'Tamanho: 40mm x 40mm | Gravação a laser em alta definição | Argola de aço inox',
      rows: [
        { id: 4, qnt: 250, vt: 1625.00, vun: 6.50 },
        { id: 5, qnt: 500, vt: 2750.00, vun: 5.50 }
      ]
    }
  ];

  const clientNameInput = document.getElementById('client-name-input');
  if (clientNameInput) clientNameInput.value = state.clientName;

  renderEditor();
  renderPreview();
}

function formatCurrency(val) {
  return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}
