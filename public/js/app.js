// Variáveis Globais
const auth = firebase.auth();
const db = firebase.firestore();



// Elementos da UI
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLogout = document.getElementById('btn-logout');
const displayName = document.getElementById('display-name');
const displayCode = document.getElementById('display-code');
const displayPhoto = document.getElementById('display-photo'); // Nova Imagem

// Tracker Elements
const btnRadar = document.getElementById('btn-toggle-radar');
const statusBadge = document.getElementById('gps-status');
const speedEl = document.getElementById('tracker-speed');
const coordsEl = document.getElementById('tracker-coords');
const errorEl = document.getElementById('tracker-error');
const signalBeat = document.getElementById('signal-beat'); // Novo

let isTracking = false;
let watchId = null;
let wakeLock = null; // Para manter o ecrã ligado


// Elementos de Sincronização de Sala e Rota
const toggleSaveRoute = document.getElementById('toggle-save-route');
const toggleStatus = document.getElementById('toggle-status'); // Novo rótulo do gravador
const btnClearRoute = document.getElementById('btn-clear-route');
const inputSalaId = document.getElementById('mobile-sala-id');
const btnSyncSala = document.getElementById('btn-sync-sala');

// Variáveis de Mapa Mobile
let mobileMap = null;
let userMarkers = {}; // {uid: marker}
let currentSalaId = "";
let locationUnsubscribe = null;

// Novas Camadas de Rota
let plannedRouteLayer = null;
let historyRouteLayer = null;
let historyPoints = [];
let offlinePointsQueue = []; // Filas de pontos sem internet

// Premium UI: Seletor de Cores e Toast
const toastNotification = document.getElementById('toast-notification');
const colorBtns = document.querySelectorAll('.color-btn');

// Elementos do Formulário de Perfil
const profilePhone = document.getElementById('profile-phone');
const profilePlate = document.getElementById('profile-plate');
const profileVehicle = document.getElementById('profile-vehicle');
const profileBlood = document.getElementById('profile-blood');
const profileCargo = document.getElementById('profile-cargo');
const btnSaveProfile = document.getElementById('btn-save-profile');

const ADMIN_UID = '18I0w58hlvM0KxnluFiqEAmiGvz1';
let selectedColor = localStorage.getItem('userVehicleColor') || 'hsl(200, 85%, 65%)';


// Função geradora de Código Único de 5 caracteres
function generateUniqueCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Escutar estado da Autenticação
auth.onAuthStateChanged(async (user) => {
    if (user && !user.isAnonymous) {
        // Obter os dados do utilizador do Firestore
        const docRef = db.collection('users').doc(user.uid);
        const docSnap = await docRef.get();

        let uniqueCode;
        if (docSnap.exists) {
            const data = docSnap.data();
            uniqueCode = data.uniqueCode;
        } else {
            // Conta nova: Gera código e guarda na BD
            uniqueCode = generateUniqueCode();
            await docRef.set({
                name: user.displayName || "Agente Secreto",
                photoURL: user.photoURL || "",
                uniqueCode: uniqueCode,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // Atualiza UI
        displayName.textContent = user.displayName || "Agente Secreto";
        displayCode.textContent = uniqueCode;

        if (user.photoURL) {
            displayPhoto.src = user.photoURL;
            displayPhoto.classList.remove('hidden');
            const noPhoto = document.getElementById('no-photo-avatar');
            if (noPhoto) noPhoto.classList.add('hidden');
        }

        // Carregar dados adicionais do perfil
        if (docSnap.exists) {
            const data = docSnap.data();
            if (profilePhone) profilePhone.value = data.phone || '';
            if (profilePlate) profilePlate.value = data.plate || '';
            if (profileVehicle) profileVehicle.value = data.vehicle || '';
            if (profileBlood) profileBlood.value = data.blood || '';
            if (profileCargo) profileCargo.value = data.cargo || '';
            if (data.color) {
                selectedColor = data.color;
                updateColorPickerUI();
            }
        }

        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');

        // Mostrar a Bottom Navigation no Mobile
        const bottomNav = document.getElementById('mobile-bottom-nav');
        if (bottomNav) bottomNav.classList.remove('hidden');

        // Inicializar Mapa e corrigir tamanho
        initMobileMap();
        if (mobileMap) {
            setTimeout(() => {
                mobileMap.invalidateSize();
            }, 500);
        }
    } else {
        if (user && user.isAnonymous) auth.signOut(); // Força logout se era anónimo
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');

        const bottomNav = document.getElementById('mobile-bottom-nav');
        if (bottomNav) bottomNav.classList.add('hidden');
    }
});

// Login com Google
btnLoginGoogle.addEventListener('click', async () => {
    btnLoginGoogle.disabled = true;
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        await auth.signInWithPopup(provider);
        // O onAuthStateChanged tratará do resto (redirecionar views)
    } catch (error) {
        console.error("Erro no Google Auth:", error);
        alert("Falha ao iniciar sessão com o Google: " + error.message);
        btnLoginGoogle.disabled = false;
    }
});

// Logout
btnLogout.addEventListener('click', () => {
    if (isTracking) stopTracking();
    auth.signOut();
});

// Save Profile Form
if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async () => {
        if (!auth.currentUser) return;

        btnSaveProfile.disabled = true;
        const originalText = btnSaveProfile.innerHTML;
        btnSaveProfile.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 mr-2 animate-spin"></i> A Gravar...';
        lucide.createIcons();

        try {
            await db.collection('users').doc(auth.currentUser.uid).update({
                phone: profilePhone.value.trim(),
                plate: profilePlate.value.trim().toUpperCase(),
                vehicle: profileVehicle.value.trim(),
                blood: profileBlood.value,
                cargo: profileCargo.value.trim()
            });

            btnSaveProfile.innerHTML = '<i data-lucide="check" class="w-4 h-4 mr-2"></i> Guardado!';
            btnSaveProfile.classList.replace('text-green-400', 'text-white');
            btnSaveProfile.classList.replace('bg-green-500/10', 'bg-green-500');

            setTimeout(() => {
                btnSaveProfile.innerHTML = originalText;
                btnSaveProfile.classList.replace('text-white', 'text-green-400');
                btnSaveProfile.classList.replace('bg-green-500', 'bg-green-500/10');
                btnSaveProfile.disabled = false;
                lucide.createIcons();
            }, 3000);

        } catch (e) {
            console.error('Erro a guardar perfil:', e);
            alert('Erro a guardar: ' + e.message);
            btnSaveProfile.innerHTML = originalText;
            btnSaveProfile.disabled = false;
            lucide.createIcons();
        }
    });
}

// Clear Route
if (btnClearRoute) {
    btnClearRoute.addEventListener('click', async () => {
        if (!auth.currentUser) return;
        if (!confirm("Tem a certeza que deseja limpar todo o rasto do mapa? Esta ação refletir-se-á no Centro de Comando instantaneamente e não pode ser revertida.")) return;

        const uid = auth.currentUser.uid;
        try {
            btnClearRoute.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 mr-2 animate-spin"></i> A limpar...';
            lucide.createIcons();

            await db.collection('routes').doc(uid).update({
                points: [],
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            historyPoints = [];
            offlinePointsQueue = [];

            if (historyRouteLayer) historyRouteLayer.setLatLngs([]);

            alert("Rasto limpo com sucesso!");
        } catch (error) {
            console.error("Erro ao limpar:", error);
            alert("Erro ao limpar rasto: " + error.message);
        } finally {
            btnClearRoute.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4 mr-2"></i> Limpar O Meu Rasto';
            lucide.createIcons();
        }
    });
}

// Sincronizar Sala no Mobile
btnSyncSala.addEventListener('click', () => {
    const salaId = inputSalaId.value.trim().toUpperCase();
    if (!salaId) return;

    currentSalaId = salaId;
    listenToSalaMembers(salaId);
});

// Inicialização de UI: Color Picker
function updateColorPickerUI() {
    colorBtns.forEach(btn => {
        if (btn.dataset.color === selectedColor) {
            btn.style.transform = 'scale(1.3)';
            btn.style.borderColor = '#ffffff';
            btn.style.boxShadow = '0 0 12px rgba(255,255,255,0.6), 0 0 4px ' + selectedColor;
        } else {
            btn.style.transform = 'scale(1)';
            btn.style.borderColor = 'transparent';
            btn.style.boxShadow = 'none';
        }
    });

    // Atualizar no Firestore se autenticado
    if (auth.currentUser) {
        db.collection('users').doc(auth.currentUser.uid).update({ color: selectedColor })
            .catch(err => console.error("Erro ao guardar cor: ", err));
    }
}

colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        selectedColor = btn.dataset.color;
        localStorage.setItem('userVehicleColor', selectedColor);
        updateColorPickerUI();
    });
});
updateColorPickerUI();

function showToast() {
    if (!toastNotification) return;
    toastNotification.classList.remove('hidden', 'translate-y-[-150%]', 'opacity-0');
    setTimeout(() => {
        toastNotification.classList.add('translate-y-[-150%]', 'opacity-0');
        setTimeout(() => toastNotification.classList.add('hidden'), 500);
    }, 4000);
}

function initMobileMap() {
    if (mobileMap) return;

    mobileMap = L.map('mobile-map', {
        zoomControl: false,
        attributionControl: false
    }).setView([-17.747, -49.102], 13); // Caldas Novas default

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mobileMap);
}

// --- LÓGICA DA MOBILE BOTTOM NAVIGATION ---
const navTabBtns = document.querySelectorAll('.nav-tab-btn');
const mobileNavViews = document.querySelectorAll('.mobile-nav-view');

// Set initial active state (Telemetria is usually default or depending on HTML order)
// But we can just rely on clicks. Let's make sure the default one gets .active.
// Actually, Telemetria is visually prominent, but let's let the HTML class do it, or reset it.

navTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-view');

        // Esconder todos os painéis
        mobileNavViews.forEach(v => v.classList.add('hidden'));

        // Reset Estilos dos Botões (Remove active class)
        navTabBtns.forEach(b => {
            b.classList.remove('active');
        });

        // Ativar botão clicado
        btn.classList.add('active');

        // Mostrar Secção Escolhida
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.classList.remove('hidden');
            // Forçar Leaflet map resize se navegar para Sala Tab
            if (targetId === 'nav-sala' && mobileMap) {
                setTimeout(() => mobileMap.invalidateSize(), 150);
            }
        }
    });
});

// Lógica de UI do Toggle Gravador
if (toggleSaveRoute && toggleStatus) {
    toggleSaveRoute.addEventListener('change', (e) => {
        if (e.target.checked) {
            toggleStatus.textContent = "ATIVO";
            toggleStatus.className = "px-2 py-0.5 bg-green-900/20 text-green-400 text-[9px] font-bold uppercase tracking-wider rounded border border-green-500/20";
        } else {
            toggleStatus.textContent = "INATIVO";
            toggleStatus.className = "px-2 py-0.5 bg-red-900/20 text-red-400 text-[9px] font-bold uppercase tracking-wider rounded border border-red-500/20";
        }
    });
}

async function listenToSalaMembers(salaId) {
    if (locationUnsubscribe) locationUnsubscribe();

    // Feedback visual de carregamento
    btnSyncSala.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>';
    lucide.createIcons();

    try {
        const salaRef = db.collection('salas').doc(salaId);
        const salaSnap = await salaRef.get();

        if (!salaSnap.exists) {
            alert("Sala não encontrada. Verifica o código!");
            resetSyncButton();
            return;
        }

        // Adicionar o condutor ativo à sala do Centro de Comando
        if (auth.currentUser) {
            await salaRef.update({
                users: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
            });
        }

        // Limpar marcadores antigos
        Object.values(userMarkers).forEach(m => mobileMap.removeLayer(m));
        userMarkers = {};

        // Ouvir alterações na sala (quem entra/sai)
        locationUnsubscribe = salaRef.onSnapshot(async (doc) => {
            if (!doc.exists) return;
            const userIds = doc.data().users || [];

            // Ouvir cada utilizador da lista
            userIds.forEach(uid => {
                db.collection('locations').doc(uid).onSnapshot(locSnap => {
                    if (!locSnap.exists) return;
                    const data = locSnap.data();
                    if (!data.active) {
                        if (userMarkers[uid]) {
                            mobileMap.removeLayer(userMarkers[uid]);
                            delete userMarkers[uid];
                        }
                        return;
                    }

                    // Procurar cor oficial do veículo neste snapshot para o utilizador da sala
                    db.collection('users').doc(uid).get().then(uDoc => {
                        const officialColor = uDoc.exists ? uDoc.data().color || '#3b82f6' : '#3b82f6';
                        updateMobileMarker(uid, data.name || "Viajante", data.lat, data.lng, data.heading || 0, uid === auth.currentUser.uid, officialColor);
                    });
                });
            });

            // Carregar e desenhar Rota Planeada da Sala
            const salaData = doc.data();
            if (salaData.plannedRoute) {
                drawPlannedRoute(salaData.plannedRoute);
            }
        });

        btnSyncSala.classList.replace('bg-blue-600', 'bg-green-600');
        showToast();

        setTimeout(resetSyncButton, 2000);

    } catch (err) {
        console.error("Erro ao sincronizar sala:", err);
        resetSyncButton();
    }
}

function resetSyncButton() {
    btnSyncSala.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i>';
    btnSyncSala.classList.remove('bg-green-600');
    lucide.createIcons();
}

function updateMobileMarker(uid, name, lat, lng, heading, isMe, officialColor = '#3b82f6') {
    if (!mobileMap) return;

    if (!userMarkers[uid]) {
        const color = isMe ? selectedColor : officialColor;
        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
        userMarkers[uid] = L.marker([lat, lng], { icon, rotationAngle: heading || 0 }).addTo(mobileMap);
        userMarkers[uid].bindPopup(name);

        if (isMe) mobileMap.setView([lat, lng], 15);
    } else {
        if (userMarkers[uid].slideTo) {
            userMarkers[uid].slideTo([lat, lng], { duration: 1000 });
        } else {
            userMarkers[uid].setLatLng([lat, lng]);
        }
        if (userMarkers[uid].setRotationAngle) {
            userMarkers[uid].setRotationAngle(heading || 0);
        }
    }
}

// Iniciar/Parar Rastreador
btnRadar.addEventListener('click', () => {
    if (!auth.currentUser) return;

    if (isTracking) {
        stopTracking();
    } else {
        startTracking();
    }
});

function startTracking() {
    if (!("geolocation" in navigator)) {
        showError("Módulo GPS não suportado neste dispositivo.");
        return;
    }

    errorEl.classList.add('hidden');
    statusBadge.textContent = "A CONECTAR";
    statusBadge.className = "px-2.5 py-1 bg-yellow-500/20 text-yellow-400 text-[10px] uppercase font-black tracking-wider rounded-md border border-yellow-500/30 animate-pulse";

    btnRadar.innerHTML = `
        <div class="absolute inset-0 bg-gradient-to-r from-red-600 via-red-500 to-red-600 transition-all opacity-80 z-0"></div>
        <div class="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10 rounded-t-[24px]"></div>
        <div class="flex items-center justify-center relative z-20 w-full tracking-[0.25em] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            <i data-lucide="square" class="w-6 h-6 mr-3 text-red-100 animate-pulse"></i> 
            <span class="text-base font-black">FINALIZAR VIAGEM</span>
        </div>`;
    btnRadar.className = "w-full relative overflow-hidden py-6 rounded-[24px] font-black text-white shadow-[0_15px_30px_rgba(239,68,68,0.4)] transition-all ease-out duration-300 active:scale-95 border border-red-500/50 group bg-[#0a0f14]/80";
    lucide.createIcons();

    isTracking = true;
    requestWakeLock(); // Ativar Wake Lock
    loadAndDrawHistory(); // Carregar percurso já feito


    watchId = navigator.geolocation.watchPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const speedMps = position.coords.speed; // metros por segundo
            const heading = position.coords.heading; // direcao

            // Atualizar UI de Telemetria
            if (speedEl) {
                const speedKmh = speedMps ? Math.round(speedMps * 3.6) : 0;
                speedEl.textContent = speedKmh.toString().padStart(2, '0');
            }
            if (statusBadge) {
                statusBadge.textContent = "SINAL OK";
                statusBadge.classList.replace('text-slate-400', 'text-green-500');
            }
            // Pulsar sinal
            if (signalBeat) {
                signalBeat.className = "ml-3 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_#22c55e]";
                setTimeout(() => {
                    signalBeat.className = "ml-3 w-2 h-2 rounded-full bg-slate-700 transition-colors";
                }, 400);
            }


            // Ui Update
            statusBadge.textContent = "TRANSMITINDO";
            statusBadge.className = "px-2.5 py-1 bg-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-wider rounded-md border border-green-500/30 pulse-active";
            coordsEl.innerHTML = `${lat.toFixed(6)}<br>${lng.toFixed(6)}`;


            // Enviar para Firebase
            try {
                // Modo Offline: Guardar na Fila e desenhar linha reta temporária local
                if (!navigator.onLine) {
                    offlinePointsQueue.push({ lat, lng });
                    const localSaved = JSON.parse(localStorage.getItem('offlinePoints') || '[]');
                    localSaved.push({ lat, lng, time: Date.now() });
                    localStorage.setItem('offlinePoints', JSON.stringify(localSaved));

                    statusBadge.textContent = "OFFLINE - GRAVANDO LOCAL";
                    statusBadge.classList.replace('text-green-500', 'text-yellow-500');
                    if (signalBeat) signalBeat.className = "ml-3 w-2 h-2 rounded-full bg-yellow-400";

                    historyPoints.push([lat, lng]);
                    updateHistoryLayer();

                    // Continua a gravar no Firestore (o SDK lida com o caching offline de escritas)
                    await db.collection('locations').doc(auth.currentUser.uid).set({
                        lat: lat, lng: lng, speed: speedMps, heading: heading || 0, active: true,
                        name: auth.currentUser.displayName || "Viajante",
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    return; // Aborta processamento síncrono da OSRM até haver rede
                }

                // 1. Snap-to-road via OSRM (cola o ponto final à rua mais próxima)
                let snappedLat = lat, snappedLng = lng;
                try {
                    const osrmRes = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}`);
                    const osrmData = await osrmRes.json();
                    if (osrmData.waypoints && osrmData.waypoints.length > 0) {
                        snappedLng = osrmData.waypoints[0].location[0];
                        snappedLat = osrmData.waypoints[0].location[1];
                    }
                } catch (_) { /* se falhar, usa original */ }

                const newPointObj = { lat: snappedLat, lng: snappedLng };
                const newPointArr = [snappedLat, snappedLng];
                let pointsToAddArr = [newPointArr];
                let pointsToAddObj = [newPointObj];

                // 2. Preencher a rota de estrada se houver um salto (OSRM Route API)
                if (historyPoints.length > 0) {
                    try {
                        let osrmCoords = [];

                        // Obter ponto seguro anterior antes do corte de rede
                        // Como a offlineQueue retém tudo que falhou, o nosso último ponto VÁLIDO no OSRM será `historyPoints[historyPoints.length - 1 - offlinePointsQueue.length]`.
                        let lastValidIndex = historyPoints.length - 1 - offlinePointsQueue.length;
                        if (lastValidIndex < 0) lastValidIndex = 0;
                        const lastPoint = historyPoints[lastValidIndex];

                        osrmCoords.push(`${lastPoint[1]},${lastPoint[0]}`); // START

                        // Juntar até 50 pontos que ficaram offline para forçar as curvas que eles fizeram no mato
                        if (offlinePointsQueue.length > 0) {
                            const maxOffline = offlinePointsQueue.slice(-50); // OSRM URLs tem limite, 50 waypoints estáveis
                            maxOffline.forEach(p => osrmCoords.push(`${p.lng},${p.lat}`));
                        }

                        osrmCoords.push(`${snappedLng},${snappedLat}`); // END

                        const coordsString = osrmCoords.join(';');
                        const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
                        const routeData = await routeRes.json();

                        if (routeData.routes && routeData.routes.length > 0) {
                            // Extrair o array de coords [Lng, Lat] que formam a estrada intermédia
                            const coords = routeData.routes[0].geometry.coordinates;
                            if (coords.length > 1) {
                                // Converter GeoJSON (Lng, Lat) para Leaflet/Firebase (Lat, Lng) ignorando o ponto de origem (índice 0)
                                pointsToAddArr = coords.slice(1).map(c => [c[1], c[0]]);
                                pointsToAddObj = coords.slice(1).map(c => ({ lat: c[1], lng: c[0] }));
                            }
                        }
                    } catch (e) {
                        console.log('Erro de preenchimento de estrada OSRM:', e);
                    }

                    // Limpar fila offline independentemente de falhar (para não repisar) se tivermos rede
                    offlinePointsQueue = [];
                }

                // 3. Atualizar rasto visual (Localmente primeiro)
                // Substituir os tracinhos retos do desenho visual do modo offline pelas rodovias
                if (pointsToAddArr.length > 1) {
                    historyPoints.splice(historyPoints.length - pointsToAddArr.length, pointsToAddArr.length);
                }
                historyPoints.push(...pointsToAddArr);
                updateHistoryLayer();

                // 4. Guardar a última posição fixa do carro (marcador local)
                await db.collection('locations').doc(auth.currentUser.uid).set({
                    lat: snappedLat, // Apenas a última posição interessa para o marcador
                    lng: snappedLng,
                    speed: speedMps,
                    heading: heading || 0,
                    active: true,
                    name: auth.currentUser.displayName || "Viajante",
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });


                // 5. Acrescentar caminho de estrada à rota persistida (APENAS SE TOGGLE ATIVO)
                if (toggleSaveRoute.checked) {
                    const routeRef = db.collection('routes').doc(auth.currentUser.uid);
                    const routeSnap = await routeRef.get();
                    const existingPoints = routeSnap.exists ? (routeSnap.data().points || []) : [];

                    let userColor = routeSnap.exists ? routeSnap.data().color : null;
                    if (!userColor) {
                        const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];
                        userColor = colors[Math.floor(Math.random() * colors.length)];
                    }

                    // Append do troço novo traçado com as estradas reais
                    const newPoints = [...existingPoints, ...pointsToAddObj];

                    // Limite superior a ~2000 pontos para não estragar a RAM móvel c/ rotas imensamente complexas (1 ponto OSRM ~= alguns metros de estrada sinuosa)
                    if (newPoints.length > 2000) newPoints.splice(0, newPoints.length - 2000);

                    await routeRef.set({
                        points: newPoints,
                        color: userColor,
                        name: displayName.textContent,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

            } catch (err) {
                console.error("Erro a enviar para firestore:", err);
            }

        },
        (error) => {
            showError("Erro a obter a localização do satélite: " + error.message);
            stopTracking();
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
}

function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    isTracking = false;

    // Atualizar no Firebase
    if (auth.currentUser) {
        db.collection('locations').doc(auth.currentUser.uid).update({
            active: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(e => console.log(e));
    }

    // Ui Update
    btnRadar.innerHTML = `
        <div class="absolute inset-0 bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 transition-all opacity-80 z-0"></div>
        <div class="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10 rounded-t-[24px]"></div>
        <div class="flex items-center justify-center relative z-20 w-full tracking-[0.25em] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            <i data-lucide="car" class="w-6 h-6 mr-3"></i> 
            <span class="text-base font-black">INICIAR VIAGEM</span>
        </div>`;
    btnRadar.className = "w-full relative overflow-hidden py-6 rounded-[24px] font-black text-white shadow-[0_15px_30px_rgba(0,0,0,0.6)] transition-all ease-out duration-300 active:scale-95 border border-white/10 group bg-[#0a0f14]/80";

    statusBadge.textContent = "INATIVO";
    statusBadge.className = "px-2.5 py-1 bg-slate-800/80 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-md border border-white/5";
    coordsEl.innerHTML = "--<br>--";
    speedEl.innerHTML = "00";

    lucide.createIcons();
}

function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
}

// --- DESENHO DE ROTAS ---

function drawPlannedRoute(waypoints) {
    if (!mobileMap || !waypoints || waypoints.length < 2) return;

    if (plannedRouteLayer) mobileMap.removeLayer(plannedRouteLayer);

    const latlngs = waypoints.map(w => [w.lat, w.lng]);
    plannedRouteLayer = L.polyline(latlngs, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.6,
        dashArray: '10, 10',
        lineJoin: 'round'
    }).addTo(mobileMap);

    // Ajustar vista para mostrar a rota se for a primeira vez
    // mobileMap.fitBounds(plannedRouteLayer.getBounds(), { padding: [50, 50] });
}

async function loadAndDrawHistory() {
    if (!auth.currentUser || !mobileMap) return;

    try {
        const routeDoc = await db.collection('routes').doc(auth.currentUser.uid).get();
        if (routeDoc.exists) {
            const data = routeDoc.data();
            if (data.points && data.points.length > 0) {
                historyPoints = data.points.map(p => [p.lat, p.lng]);
                updateHistoryLayer();
            }
        }
    } catch (e) { console.log("Erro carregar histórico:", e); }
}

function updateHistoryLayer() {
    if (!mobileMap || historyPoints.length < 2) return;

    if (historyRouteLayer) {
        historyRouteLayer.setLatLngs(historyPoints);
    } else {
        historyRouteLayer = L.polyline(historyPoints, {
            color: '#22c55e',
            weight: 5,
            opacity: 0.8,
            lineJoin: 'round',
            shadowBlur: 10,
            shadowColor: '#22c55e'
        }).addTo(mobileMap);
    }
}


// HELPER: Manter Ecrã Ligado (Wake Lock API)
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("Sistema Mãos-Livres: Ecrã bloqueado para permanência ativa");
        }
    } catch (err) {
        console.error("Wake Lock Falhou:", err);
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => {
            wakeLock = null;
            console.log("Ecrã libertado para modo normal");
        });
    }
}

// Re-vincular se a aba voltar a ficar visível
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
    }
});

window.addEventListener('online', async () => {
    const saved = JSON.parse(localStorage.getItem('offlinePoints') || '[]');
    if (saved.length > 0 && auth.currentUser) {
        try {
            const routeRef = db.collection('routes').doc(auth.currentUser.uid);
            const routeSnap = await routeRef.get();
            const existingPoints = routeSnap.exists ? (routeSnap.data().points || []) : [];
            const newPoints = [...existingPoints, ...saved.map(p => ({ lat: p.lat, lng: p.lng }))];
            if (newPoints.length > 2000) newPoints.splice(0, newPoints.length - 2000);

            await routeRef.update({
                points: newPoints,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            localStorage.removeItem('offlinePoints');
            if (toastNotification) {
                toastNotification.querySelector('span').textContent = "SINCRONIZADO COM SUCESSO";
                showToast();
            }
        } catch (e) {
            console.error("Erro ao sincronizar offline points:", e);
        }
    }
});

// Inicialização
lucide.createIcons();
