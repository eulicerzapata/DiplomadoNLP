let map;
let userLat = 6.2442;  // Medellín centro
let userLng = -75.5812;
let containerMarkers = [];

// Event listeners
document.getElementById('show-map-btn')?.addEventListener('click', () => {
    document.getElementById('map-modal').classList.remove('hidden');
    if (!map) {
        initializeMap();
    }
    loadNearbyContainers();
});

document.getElementById('close-map-btn')?.addEventListener('click', () => {
    document.getElementById('map-modal').classList.add('hidden');
});

function initializeMap() {
    // Create map centered on Medellín
    map = L.map('map').setView([userLat, userLng], 14);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Try to get user location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLat = position.coords.latitude;
                userLng = position.coords.longitude;
                
                // Center map on user
                map.setView([userLat, userLng], 15);
                
                // Add user marker
                L.marker([userLat, userLng], {
                    icon: L.divIcon({
                        className: 'user-marker',
                        html: '<div style="background: #3498db; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>',
                        iconSize: [20, 20]
                    })
                }).addTo(map).bindPopup('Tu ubicación');
                
                loadNearbyContainers();
            },
            () => {
                // Use default location if geolocation fails
                L.marker([userLat, userLng], {
                    icon: L.divIcon({
                        className: 'user-marker',
                        html: '<div style="background: #3498db; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>',
                        iconSize: [20, 20]
                    })
                }).addTo(map).bindPopup('Ubicación predeterminada (Medellín)');
            }
        );
    }
}

async function loadNearbyContainers() {
    try {
        const response = await fetch(`/api/nearby-containers?lat=${userLat}&lon=${userLng}`);
        const data = await response.json();
        
        displayContainers(data.containers);
    } catch (error) {
        console.error('Error loading containers:', error);
    }
}

function displayContainers(containers) {
    // Clear previous markers
    containerMarkers.forEach(marker => map.removeLayer(marker));
    containerMarkers = [];
    
    const listContainer = document.getElementById('containers-list');
    listContainer.innerHTML = '';

    containers.forEach((container, index) => {
        // Create marker
        const marker = L.marker([container.lat, container.lng], {
            icon: L.divIcon({
                className: 'container-marker',
                html: `<div style="background: #2ecc71; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${index + 1}</div>`,
                iconSize: [30, 30]
            })
        }).addTo(map);

        marker.bindPopup(`
            <b>${container.name}</b><br>
            ${container.location}<br>
            <i class="fa-solid fa-walking"></i> ${container.distance_m}m
        `);

        marker.on('click', () => {
            drawRoute(container.lat, container.lng);
        });

        containerMarkers.push(marker);

        // Create list item
        const item = document.createElement('div');
        item.className = 'container-item';
        item.innerHTML = `
            <div class="container-info">
                <h4>${container.name}</h4>
                <p><i class="fa-solid fa-location-dot"></i> ${container.location}</p>
            </div>
            <div class="container-distance">
                <i class="fa-solid fa-walking"></i> ${container.distance_m}m
            </div>
        `;
        
        item.addEventListener('click', () => {
            map.setView([container.lat, container.lng], 16);
            marker.openPopup();
            drawRoute(container.lat, container.lng);
        });
        
        listContainer.appendChild(item);
    });

    // Draw route to closest container automatically
    if (containers.length > 0) {
        drawRoute(containers[0].lat, containers[0].lng);
    }
}

let routeLine = null;

function drawRoute(destLat, destLng) {
    // Remove previous route
    if (routeLine) {
        map.removeLayer(routeLine);
    }

    // Draw a straight line (for demo purposes - real routing would need Leaflet Routing Machine)
    routeLine = L.polyline(
        [[userLat, userLng], [destLat, destLng]],
        {
            color: '#2ecc71',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 5'
        }
    ).addTo(map);

    // Fit map to show both points
    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
}
