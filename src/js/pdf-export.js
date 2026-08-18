import html2pdf from 'html2pdf.js';

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

  const opt = {
    margin: [10, 10, 10, 10],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#030614',
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  try {
    await html2pdf().set(opt).from(pdfElement).save();
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    alert('Ocorreu um erro ao gerar o PDF. Tentando acionar caixa de impressão do navegador...');
    window.print();
  } finally {
    // Restore WebGL Canvas viewports
    tempImgReplacements.forEach(({ canvas, img }) => {
      img.remove();
      canvas.style.display = 'block';
    });
  }
}
