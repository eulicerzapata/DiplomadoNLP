import os
# Suprimir logs de TensorFlow
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import io
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from PIL import Image
import tensorflow as tf
from transformers import CLIPProcessor, TFCLIPModel

app = FastAPI()

# Servir archivos estáticos
app.mount("/static", StaticFiles(directory="static"), name="static")

# Cargar modelo CLIP (Zero-Shot)
# Este modelo entiende "conceptos" y texto, no solo etiquetas fijas.
print("Cargando modelo CLIP (Zero-Shot)...")
MODEL_ID = "openai/clip-vit-base-patch32"
model = TFCLIPModel.from_pretrained(MODEL_ID)
processor = CLIPProcessor.from_pretrained(MODEL_ID)
print("Modelo CLIP cargado exitosamente.")

# Definimos un diccionario detallado de objetos específicos
# Clave: Texto para buscar en CLIP (Inglés)
# Valor: (Nombre en Español, Color Contenedor, Categoría/Mensaje)
KNOWN_ITEMS = {
    # ORGÁNICOS (Verde)
    "banana peel": ("Cáscara de banano", "green", "Residuo orgánico"),
    "apple core": ("Corazón de manzana", "green", "Residuo orgánico"),
    "food scraps": ("Sobras de comida", "green", "Residuo orgánico"),
    "vegetables": ("Vegetales", "green", "Residuo orgánico"),
    "fruit": ("Fruta", "green", "Residuo orgánico"),
    "bread": ("Pan", "green", "Residuo orgánico"),
    "leaves": ("Hojas secas", "green", "Residuo orgánico"),
    "flowers": ("Flores", "green", "Residuo orgánico"),
    "meat": ("Carne", "green", "Residuo orgánico"),
    "chicken bones": ("Huesos de pollo", "green", "Residuo orgánico"),

    # APROVECHABLES (Blanco)
    "plastic bottle": ("Botella de plástico", "white", "Material reciclable"),
    "glass bottle": ("Botella de vidrio", "white", "Material reciclable"),
    "cardboard box": ("Caja de cartón", "white", "Material reciclable"),
    "paper": ("Papel", "white", "Material reciclable"),
    "newspaper": ("Periódico", "white", "Material reciclable"),
    "soda can": ("Lata de refresco", "white", "Material reciclable"),
    "notebook": ("Cuaderno", "white", "Material reciclable"),
    "clean plastic bag": ("Bolsa plástica limpia", "white", "Material reciclable"),

    # PELIGROSOS (Rojo)
    "battery": ("Batería / Pila", "red", "Residuo peligroso"),
    "medical syringe": ("Jeringa médica", "red", "Residuo peligroso"),
    "pills": ("Pastillas / Medicamentos", "red", "Residuo peligroso"),
    "insecticide": ("Insecticida", "red", "Residuo peligroso"),
    "face mask": ("Tapabocas", "red", "Residuo peligroso"),

    # NO APROVECHABLES (Negro)
    "dirty napkin": ("Servilleta sucia", "black", "Basura no aprovechable"),
    "toilet paper": ("Papel higiénico", "black", "Basura no aprovechable"),
    "cigarette butt": ("Colilla de cigarrillo", "black", "Basura no aprovechable"),
    "candy wrapper": ("Envoltura de dulce", "black", "Basura no aprovechable"),
    "styrofoam": ("Icopor", "black", "Basura no aprovechable"),
    "dirty plastic": ("Plástico sucio", "black", "Basura no aprovechable"),

    # OBJETOS QUE NO VAN EN CONTENEDORES (Alertas)
    "living animal": ("Animal vivo", "none", "¡Cuidado! Esto es un ser vivo."),
    "cat": ("Gato", "none", "¡Es un gato! No lo tires a la basura."),
    "dog": ("Perro", "none", "¡Es un perro! No lo tires a la basura."),
    "person": ("Persona", "none", "¡Es una persona!"),
    "water": ("Agua líquida", "none", "El agua no se tira aquí, vacíala en un desagüe."),
    "mobile phone": ("Teléfono celular", "none", "Residuo electrónico (RAEE). Busca un punto especial."),
    "laptop": ("Computador portátil", "none", "Residuo electrónico (RAEE). Busca un punto especial.")
}

# Lista de búsqueda para CLIP
SEARCH_LABELS = list(KNOWN_ITEMS.keys())

COLOR_TRANSLATION = {
    "green": "Verde",
    "white": "Blanco",
    "red": "Rojo",
    "black": "Negro",
    "none": "Ninguno"
}

@app.post("/classify")
async def classify_image(file: UploadFile = File(...)):
    try:
        # Leer imagen
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Procesar con CLIP
        inputs = processor(
            text=SEARCH_LABELS, 
            images=image, 
            return_tensors="tf", 
            padding=True
        )
        
        outputs = model(**inputs)
        
        # Calcular probabilidades
        logits_per_image = outputs.logits_per_image
        probs = tf.nn.softmax(logits_per_image, axis=1)
        probs_np = probs.numpy()[0]
        
        # Obtener el mejor resultado
        predicted_index = np.argmax(probs_np)
        confidence = probs_np[predicted_index]
        
        # Recuperar datos del objeto detectado
        detected_key = SEARCH_LABELS[predicted_index]
        object_name_es, container_color, category_msg = KNOWN_ITEMS[detected_key]
        
        # Construir mensaje
        if container_color == "none":
            message = f"He detectado: {object_name_es}. ⚠️ {category_msg}"
        else:
            container_es = COLOR_TRANSLATION.get(container_color, container_color)
            message = f"He detectado: {object_name_es}. Va en el contenedor {container_es} ({category_msg})."
        
        return JSONResponse(content={
            "object_detected": object_name_es,
            "confidence": float(confidence),
            "waste_type": category_msg,
            "container_color": container_color,
            "message": message
        })
        
    except Exception as e:
        print(f"Error: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/")
async def read_index():
    from fastapi.responses import FileResponse
    return FileResponse('static/index.html')

@app.get("/api/nearby-containers")
async def get_nearby_containers(lat: float = 6.2442, lon: float = -75.5812):
    """
    Retorna contenedores simulados cercanos en Medellín.
    Parámetros: lat, lon (coordenadas del usuario)
    """
    import random
    import math
    
    # Punto central de Medellín (Parque Berrio aproximadamente)
    MEDELLIN_CENTER = (6.2442, -75.5812)
    
    # Generar 5 contenedores aleatorios alrededor de Medellín
    # Variación de ~0.02 grados ≈ 2km de radio
    containers = []
    for i in range(5):
        # Ubicaciones simuladas aleatorias
        container_lat = MEDELLIN_CENTER[0] + random.uniform(-0.02, 0.02)
        container_lon = MEDELLIN_CENTER[1] + random.uniform(-0.02, 0.02)
        
        # Calcular distancia usando fórmula de Haversine (simplificada)
        dlat = container_lat - lat
        dlon = container_lon - lon
        distance_km = math.sqrt(dlat**2 + dlon**2) * 111  # Aproximación: 1 grado ≈ 111km
        
        containers.append({
            "id": i + 1,
            "name": f"Contenedor #{i+1}",
            "location": f"Calle {random.randint(10, 100)} #{random.randint(10, 80)}-{random.randint(10, 99)}",
            "lat": container_lat,
            "lng": container_lon,
            "distance_m": round(distance_km * 1000),  # Convertir a metros
            "types": ["green", "white", "black", "red"]  # Todos los tipos
        })
    
    # Ordenar por distancia
    containers.sort(key=lambda x: x["distance_m"])
    
    return JSONResponse(content={"containers": containers})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
