const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const cameraBtn = document.getElementById('camera-btn');
const captureBtn = document.getElementById('capture-btn');
const imagePreview = document.getElementById('image-preview');
const cameraFeed = document.getElementById('camera-feed');
const placeholder = document.getElementById('placeholder');
const resultSection = document.getElementById('result-section');
const loader = document.getElementById('loader');
const resultContent = document.getElementById('result-content');

let stream = null;

// Event Listeners
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
cameraBtn.addEventListener('click', toggleCamera);
captureBtn.addEventListener('click', captureImage);

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.querySelector('.preview-container').classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    document.querySelector('.preview-container').classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    document.querySelector('.preview-container').classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

function handleFileSelect(e) {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    stopCamera();
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        cameraFeed.classList.add('hidden');
        captureBtn.classList.add('hidden');
        
        classifyImage(file);
    };
    reader.readAsDataURL(file);
}

async function toggleCamera() {
    if (stream) {
        stopCamera();
        return;
    }

    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        cameraFeed.srcObject = stream;
        cameraFeed.classList.remove('hidden');
        imagePreview.classList.add('hidden');
        placeholder.classList.add('hidden');
        captureBtn.classList.remove('hidden');
        cameraBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cerrar Cámara';
    } catch (err) {
        alert("No se pudo acceder a la cámara: " + err);
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        cameraFeed.classList.add('hidden');
        captureBtn.classList.add('hidden');
        cameraBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Usar Cámara';
        if (!imagePreview.src) placeholder.classList.remove('hidden');
    }
}

function captureImage() {
    const canvas = document.createElement('canvas');
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    canvas.getContext('2d').drawImage(cameraFeed, 0, 0);
    
    canvas.toBlob(blob => {
        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
        handleFile(file);
    }, 'image/jpeg');
}

async function classifyImage(file) {
    // UI Reset
    resultSection.classList.remove('hidden');
    loader.classList.remove('hidden');
    resultContent.classList.add('hidden');
    resultSection.className = 'result-section'; // Reset colors

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/classify', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showResult(data);
        } else {
            alert('Error en clasificación: ' + data.error);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión con el servidor.');
    } finally {
        loader.classList.add('hidden');
    }
}

function showResult(data) {
    resultContent.classList.remove('hidden');
    
    const title = document.getElementById('waste-type-title');
    const objectName = document.getElementById('waste-object');
    const instruction = document.getElementById('waste-instruction');
    const confidenceFill = document.getElementById('confidence-fill');
    const confidenceText = document.getElementById('confidence-text');
    
    // Reset Bins
    document.querySelectorAll('.bin').forEach(bin => bin.classList.remove('active'));
    
    title.textContent = data.waste_type;
    objectName.textContent = `Objeto detectado: ${data.object_detected}`;
    instruction.textContent = data.message;
    
    const confidencePercent = Math.round(data.confidence * 100);
    confidenceFill.style.width = `${confidencePercent}%`;
    confidenceText.textContent = `${confidencePercent}%`;
    
    // CASO ESPECIAL: Si no va en ningún contenedor (none)
    if (data.container_color === 'none') {
        // Ocultar contenedores o mostrar solo el mensaje de advertencia
        document.querySelector('.bins-display').style.opacity = '0.2';
        instruction.style.backgroundColor = 'rgba(255, 165, 0, 0.2)';
        instruction.style.borderLeft = '4px solid orange';
        instruction.style.padding = '15px';
        instruction.style.fontSize = '1.1rem';
        return; // No ejecutar animación
    }
    
    // Restaurar visibilidad de contenedores si estaba opaca
    document.querySelector('.bins-display').style.opacity = '1';
    instruction.style.backgroundColor = '';
    instruction.style.borderLeft = '';
    instruction.style.padding = '';
    instruction.style.fontSize = '';
    
    // Determine Target Bin
    let targetBinId = '';
    if (data.container_color === 'green') targetBinId = 'bin-green';
    else if (data.container_color === 'white') targetBinId = 'bin-white';
    else if (data.container_color === 'red') targetBinId = 'bin-red';
    else targetBinId = 'bin-black';
    
    const targetBin = document.getElementById(targetBinId);
    
    // Trigger Animation
    animateTrash(targetBin);
}

function animateTrash(targetBin) {
    const flyingTrash = document.getElementById('flying-trash');
    const sourceImage = document.getElementById('image-preview');
    
    // 1. Setup initial position (at the preview image)
    const startRect = sourceImage.getBoundingClientRect();
    const endRect = targetBin.getBoundingClientRect();
    
    flyingTrash.style.backgroundImage = `url(${sourceImage.src})`;
    flyingTrash.style.top = `${startRect.top + startRect.height/2 - 30}px`;
    flyingTrash.style.left = `${startRect.left + startRect.width/2 - 30}px`;
    flyingTrash.classList.remove('hidden');
    
    // Force reflow
    void flyingTrash.offsetWidth;
    
    // 2. Animate to target bin
    flyingTrash.style.top = `${endRect.top + 20}px`; // Aim for the opening
    flyingTrash.style.left = `${endRect.left + endRect.width/2 - 30}px`;
    flyingTrash.style.transform = 'scale(0.2)'; // Shrink as it goes in
    
    // 3. On finish
    setTimeout(() => {
        flyingTrash.classList.add('hidden');
        flyingTrash.style.transform = 'scale(1)'; // Reset scale
        targetBin.classList.add('active'); // Highlight bin
    }, 1000); // Match CSS transition duration
}
