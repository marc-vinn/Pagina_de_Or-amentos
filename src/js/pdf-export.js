import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function exportToPDF(pdfElement, clientName = 'Cliente') {
  if (!pdfElement) return;

  const originalCanvasElements = pdfElement.querySelectorAll('.doc-keychain-canvas-wrapper canvas');
  const tempImgReplacements = [];

  // Convert WebGL 3D Canvas views into temporary crisp 2D Images for PDF rendering
  originalCanvasElements.forEach((canvas) => {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.className = 'temp-pdf-3d-snapshot';

      const wrapper = canvas.parentElement;
      canvas.style.display = 'none';
      wrapper.appendChild(img);

      tempImgReplacements.push({ canvas, img });
    } catch (e) {
      console.warn('Could not capture WebGL snapshot for PDF:', e);
    }
  });

  const formattedDate = new Date().toISOString().split('T')[0];
  const cleanClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Cliente';
  const filename = `Orcamento_3Degraus_${cleanClientName}_${formattedDate}.pdf`;

  try {
    // Render the DOM element with exact dark theme background (#030614) and high resolution scaling
    const canvas = await html2canvas(pdfElement, {
      scale: 2.75, // Scale 900px preview up to ~2480px high definition resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#030614',
      logging: false,
      scrollX: 0,
      scrollY: 0
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // Create 2480x3508 px Portrait PDF with exact full-bleed dimensions
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [2480, 3508],
      hotfixes: ['px_scaling']
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, 2480, 3508);
    pdf.save(filename);
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    alert('Ocorreu um erro ao gerar o PDF. Acionando janela de impressão...');
    window.print();
  } finally {
    // Restore WebGL Canvas viewports
    tempImgReplacements.forEach(({ canvas, img }) => {
      img.remove();
      canvas.style.display = 'block';
    });
  }
}
