# 📌 Projeto: Gerador de Orçamentos 3Degraus (Chaveiros Personalizados & Visualizador 3D .3MF)

Aplicação web interativa, moderna e responsiva desenvolvida para a **3Degraus** criar, gerenciar e exportar orçamentos de chaveiros personalizados em formato PDF de alta resolução, com suporte a **imagens 2D** e **modelos 3D (.3mf)** interativos, pronta para hospedagem na **Vercel**.

---

## 🎯 Objetivos do Sistema

- **Fidelidade Visual**: Interface e documento final em PDF inspirados na identidade do PDF de referência (`Orçamento Chaveiros.pdf`).
- **Visualizador 3D de Arquivos .3MF**: Permite ao usuário/cliente carregar modelos 3D `.3mf` de chaveiros, rotacionar, dar zoom e posicionar o modelo interativamente em 3D.
- **Captura de Ângulo para PDF**: O ângulo e a rotação ajustados no visualizador 3D são automaticamente capturados para a exportação do PDF.
- **Flexibilidade de Itens**: Criar 1 ou mais tabelas de orçamento em uma única proposta.
- **Cálculo Automático**: Preenchimento inteligente de Quantidade (`Qnt`), Valor Unitário (`V. Un`) e Valor Total (`Vt`).
- **Exportação em PDF**: Geração instantânea de PDF profissional com logo da 3Degraus no canto superior esquerdo e botão de exportação.

---

## 🎨 Identidade Visual & UI/UX

| Elemento | Especificação |
| :--- | :--- |
| **Tema Base** | Dark Mode Premium (`#050716` / `#0b0f26`) |
| **Cor Accent (Bordas/Linhas)** | Vermelho Vibrante 3Degraus (`#ff1b49`) |
| **Texto Interno & Células** | Branco puro (`#FFFFFF`) com fundo escuro/transparente |
| **Bordas das Tabelas** | Cantos arredondados (`border-radius: 12px` / `16px`) |
| **Logo Superior Esquerdo** | Logo oficial 3Degraus (`logo 3Degraus - sem fundo.png`) |
| **Tipografia** | Outfit / Inter (Google Fonts) para legibilidade impecável |

---

## 📋 Funcionalidades Principais

### 1. Cabeçalho do Cliente
- [x] Campo para **Nome do Cliente** (ex: *7 Mares PV*).
- [x] Upload/Seleção opcional da **Logo do Cliente**.
- [x] Data de emissão e validade do orçamento automática.

### 2. Tabelas Dinâmicas de Orçamento com 3D (.3mf)
- [x] Adicionar / Remover tabelas de chaveiros dinamicamente.
- [x] **Suporte Dual de Mídia**: Upload de imagem 2D (PNG, JPG, WebP) **OU** arquivo 3D (`.3mf`).
- [x] **Visualizador 3D Interativo (Three.js)**:
  - Renderização do arquivo `.3mf` via WebGL.
  - Órbita, Rotação 360°, Zoom e Pan com o mouse / touch.
  - Captura do snapshot em alta resolução no ângulo exato escolhido pelo usuário para incorporar no PDF.
- [x] **Tabela de Preços**:
  - `Qnt` (Quantidade)
  - `Vt` (Valor Total)
  - `V. Un` (Valor Unitário)
- [x] Especificações técnicas por chaveiro (Tamanho, Material, Argola, Cor, Observações).
- [x] Recálculo automático dos valores (ajuste de unitário ou total).

### 3. Visualização & Exportação
- [x] Painel com **Live Preview** (pré-visualização em tempo real exata de como ficará o documento final).
- [x] Botão **"Exportar PDF"** com renderização via `html2pdf.js` / `jspdf`.
- [x] Formatação ajustada para impressão e envio por WhatsApp / E-mail.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3 Vanilla**: Variáveis CSS, Flexbox/Grid para performance e customização total.
- **JavaScript (ES6+)**: Lógica reativa modular.
- **Three.js + 3MFLoader**: Para carregamento e renderização 3D de arquivos `.3mf` no navegador.
- **Vite**: Bundler ultra-rápido para desenvolvimento local e compilação de produção.
- **html2pdf.js / html2canvas & jsPDF**: Para conversão de HTML/DOM em PDF de alta qualidade.
- **Vercel**: Plataforma de hospedagem estática serverless com deploy contínuo.

---

## 🚀 Como Executar Localmente & Fazer Deploy

### Requisitos Prévios
- Node.js v18+ e NPM instalados.

### Passos para Rodar Localmente
```bash
# 1. Instalar dependências
npm install

# 2. Executar o servidor de desenvolvimento local
npm run dev
```

### Deploy na Vercel
1. Conecte o repositório no dashboard da [Vercel](https://vercel.com).
2. O Vercel detectará automaticamente a configuração do Vite.
3. Clique em **Deploy**. A aplicação estará online instantaneamente.
