// Inicializar Firebase DB e Auth
const db = firebase.firestore();
const auth = firebase.auth();

// Elementos de Login Admin
const loginView = document.getElementById('admin-login-view');
const appView = document.getElementById('admin-dashboard-view');
const loginForm = document.getElementById('admin-login-form');
const adminEmail = document.getElementById('admin-email');
const adminPassword = document.getElementById('admin-password');
const btnAdminLogin = document.getElementById('btn-admin-login');
const loginErrorMsg = document.getElementById('admin-error-msg');
const btnAdminLogout = document.getElementById('btn-admin-logout');

const ADMIN_UID = '18I0w58hlvM0KxnluFiqEAmiGvz1';

// Estado da Sala
let activeSalaId = null;

// Elementos UI de Salas
const salaCreateView = document.getElementById('sala-create-view');
const salaActiveView = document.getElementById('sala-active-view');
const salaNameInput = document.getElementById('sala-name-input');
const salaIdInput = document.getElementById('sala-id-input');
const btnCreateSala = document.getElementById('btn-create-sala');
const btnLoadSala = document.getElementById('btn-load-sala');
const btnCloseSala = document.getElementById('btn-close-sala');
const salaNameDisplay = document.getElementById('sala-name-display');
const salaIdDisplay = document.getElementById('sala-id-display');
const salaError = document.getElementById('sala-error');

// Elementos de Mobile UI
const menuToggle = document.getElementById('mobile-menu-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebar = document.getElementById('sidebar');

// --- LÓGICA DE ABAS (DESKTOP) ---
const tabBtns = document.querySelectorAll('.sidebar-tab-btn');
const tabContents = document.querySelectorAll('.sidebar-tab-content');

// --- PREMIUM UI (Context Menu & Toasts) ---
const contextMenu = document.getElementById('tactical-context-menu');
const contextTargetName = document.getElementById('context-target-name');
const contextTargetUid = document.getElementById('context-target-uid');
const ctxBtnCenter = document.getElementById('ctx-btn-center');
const ctxBtnClear = document.getElementById('ctx-btn-clear');
const ctxBtnKick = document.getElementById('ctx-btn-kick');
const ctxBtnReplay = document.getElementById('ctx-btn-replay');

const adminToastNotif = document.getElementById('admin-toast-notification');
const adminToastMsg = document.getElementById('admin-toast-message');

let currentContextUid = null;

// Fechar Menu de Contexto ao clicar fora
document.addEventListener('click', (e) => {
    if (e.button !== 2) {
        contextMenu.classList.add('hidden', 'scale-95', 'opacity-0', 'pointer-events-none');
        contextMenu.classList.remove('scale-100', 'opacity-100', 'pointer-events-auto');
    }
});

// Bloquear Menu Local na janela inteira
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Ações do Context Menu
if (ctxBtnCenter) {
    ctxBtnCenter.addEventListener('click', () => {
        if (currentContextUid) focusMapOnUser(currentContextUid);
        contextMenu.classList.add('hidden');
    });
}
if (ctxBtnClear) {
    ctxBtnClear.addEventListener('click', async () => {
        if (!currentContextUid) return;
        if (confirm("Tens a certeza que pretendes limpar a rota gravada deste Radar?")) {
            await db.collection('routes').doc(currentContextUid).update({ points: [] });
            if (trackedUsers[currentContextUid] && trackedUsers[currentContextUid].routeLine) {
                trackedUsers[currentContextUid].route = [];
                trackedUsers[currentContextUid].routeLine.setLatLngs([]);
                if (trackedUsers[currentContextUid].routeLineGlow) trackedUsers[currentContextUid].routeLineGlow.setLatLngs([]);
            }
        }
        contextMenu.classList.add('hidden');
    });
}
if (ctxBtnKick) {
    ctxBtnKick.addEventListener('click', () => {
        if (!currentContextUid) return;
        if (confirm("Forçar Desconexão? O radar será removido da sala atual.")) {
            // Remover da Sala se houver uma ativa
            if (activeSalaId) {
                db.collection('salas').doc(activeSalaId).update({
                    users: firebase.firestore.FieldValue.arrayRemove(currentContextUid)
                });
            } else {
                removeUser(currentContextUid); // Modo Solitário
            }
        }
        contextMenu.classList.add('hidden');
    });
}

if (ctxBtnReplay) {
    ctxBtnReplay.addEventListener('click', () => {
        if (!currentContextUid) return;
        const user = trackedUsers[currentContextUid];
        if (!user || user.route.length < 2) {
            alert("Não existem registos suficientes para simular o Replay deste viajante.");
            contextMenu.classList.add('hidden');
            return;
        }

        if (confirm("Deseja simular um Replay da viagem gravada para este radar? Vai parecer um radar fantasma roxo.")) {
            const latlngs = [...user.route];
            const ghostIcon = createUserIcon(user.photoURL, false, '#a855f7');
            const ghostMarker = L.marker(latlngs[0], { icon: ghostIcon }).addTo(map);
            let index = 1;
            const speed = 150; // ms

            const interval = setInterval(() => {
                if (index < latlngs.length) {
                    if (ghostMarker.slideTo) {
                        ghostMarker.slideTo(latlngs[index], { duration: speed });
                    } else {
                        ghostMarker.setLatLng(latlngs[index]);
                    }
                    index++;
                } else {
                    clearInterval(interval);
                    setTimeout(() => map.removeLayer(ghostMarker), 2500);
                    if (adminToastNotif && adminToastMsg) {
                        adminToastMsg.textContent = 'Replay Terminado!';
                        adminToastNotif.classList.remove('hidden', 'translate-y-[-150%]', 'opacity-0');
                        setTimeout(() => adminToastNotif.classList.add('hidden', 'translate-y-[-150%]', 'opacity-0'), 3000);
                    }
                }
            }, speed);
        }
        contextMenu.classList.add('hidden');
    });
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Desativar todas as abas
        tabBtns.forEach(b => {
            b.classList.remove('text-green-400', 'border-green-500');
            b.classList.add('text-slate-500', 'border-transparent');
        });
        tabContents.forEach(c => c.classList.add('hidden'));

        // Ativar Aba Clicada
        btn.classList.remove('text-slate-500', 'border-transparent');
        btn.classList.add('text-green-400', 'border-green-500');

        const targetId = btn.getAttribute('data-target');
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.classList.remove('hidden');
        }
    });
});

function toggleSidebar(force) {
    if (!sidebar) return;
    const isActive = force !== undefined ? force : !sidebar.classList.contains('active');
    if (isActive) {
        sidebar.classList.add('active');
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('hidden');
            setTimeout(() => sidebarOverlay.style.opacity = '1', 10);
            sidebarOverlay.style.pointerEvents = 'auto';
        }
    } else {
        sidebar.classList.remove('active');
        if (sidebarOverlay) {
            sidebarOverlay.style.opacity = '0';
            sidebarOverlay.style.pointerEvents = 'none';
            setTimeout(() => sidebarOverlay.classList.add('hidden'), 300);
        }
    }
    // Forçar Leaflet a recalcular o tamanho se o layout mudar
    if (map) setTimeout(() => map.invalidateSize(), 400);
}

// Resolver problemas de redimensionamento do mapa no Mobile
window.addEventListener('resize', () => {
    if (map) map.invalidateSize();
});

if (menuToggle) {
    menuToggle.addEventListener('click', () => toggleSidebar());
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        toggleSidebar(false);
        closeAllSheets(); // Also close sheets on desktop overlay click just in case
    });
}

// --- MOBILE BOTTOM SHEETS LOGIC ---
const mobileNavItems = document.querySelectorAll('.nav-item');
const mobileSheetOverlay = document.getElementById('mobile-sheet-overlay');
let activeSheetId = null;

function openSheet(sheetId) {
    closeAllSheets(); // Close others first
    const sheet = document.getElementById(sheetId);
    if (!sheet) return;

    sheet.classList.add('open');
    if (mobileSheetOverlay) {
        mobileSheetOverlay.classList.add('active');
    }
    activeSheetId = sheetId;

    // Update Nav Active State
    mobileNavItems.forEach(item => {
        if (item.getAttribute('data-target') === sheetId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function closeAllSheets() {
    document.querySelectorAll('.bottom-sheet.open').forEach(sheet => {
        sheet.classList.remove('open');
    });
    if (mobileSheetOverlay) mobileSheetOverlay.classList.remove('active');
    activeSheetId = null;

    // Reset Nav to Map
    mobileNavItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-target') === 'map') item.classList.add('active');
    });
}

if (mobileSheetOverlay) {
    mobileSheetOverlay.addEventListener('click', closeAllSheets);
}

mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        if (target === 'map') {
            closeAllSheets();
        } else if (target === 'sheet-profile') {
            // Profile uses traditional sidebar for now on mobile
            closeAllSheets();
            toggleSidebar(true);
        } else {
            openSheet(target);
        }
    });
});

// Move UI elements to sheets on mobile load
function setupMobileUI() {
    if (window.innerWidth < 1024) {
        // Móvel: Move os painéis criados para a Bottom Sheet do Mobile
        const radarListOriginal = document.getElementById('tab-monitor');
        const addRadarOriginal = document.getElementById('tab-conexao');
        const toolsOriginalCreate = document.getElementById('sala-create-view');
        // O active view contem a Tab de Ferramentas e o Header. Teremos que mover a UI em bloco ou separada.
        // Dado que a UI "Active" agora tem as TABS dentro, o Mobile tem que gerir diferentemente.
        const toolsOriginalActive = document.getElementById('sala-active-view');

        const sheetRadarsContainer = document.getElementById('mobile-radar-list-container');
        const sheetAddRadarContainer = document.getElementById('mobile-add-radar-container');
        const sheetToolsContainer = document.getElementById('mobile-tools-container');

        if (sheetRadarsContainer && radarListOriginal) {
            radarListOriginal.classList.remove('hidden'); // Força a visibilidade no mobile sheet
            sheetRadarsContainer.appendChild(radarListOriginal);
        }
        if (sheetAddRadarContainer && addRadarOriginal) {
            addRadarOriginal.classList.remove('hidden');
            sheetAddRadarContainer.appendChild(addRadarOriginal);
        }
        if (sheetToolsContainer) {
            if (toolsOriginalCreate) sheetToolsContainer.appendChild(toolsOriginalCreate);
            if (toolsOriginalActive) {
                toolsOriginalActive.classList.remove('hidden');
                // Revelar as Tab Ferramenta dentro da UI
                const tabF = document.getElementById('tab-ferramentas');
                if (tabF) tabF.classList.remove('hidden');
                sheetToolsContainer.appendChild(toolsOriginalActive);
            }
        }
    }
}
window.addEventListener('DOMContentLoaded', setupMobileUI);



// --- SALAS ---
function showSalaError(msg) {
    salaError.textContent = msg;
    salaError.classList.remove('hidden');
    setTimeout(() => salaError.classList.add('hidden'), 4000);
}

function generateSalaId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function openSala(salaId, name, uids) {
    activeSalaId = salaId;
    salaNameDisplay.textContent = name;
    salaIdDisplay.textContent = salaId;
    salaCreateView.classList.add('hidden');
    salaActiveView.classList.remove('hidden');

    // Remover todos os radares atuais antes de carregar os da sala
    Object.keys(trackedUsers).forEach(uid => removeUser(uid));

    let initialLoadComplete = false;

    // Carregar Rota Oficial Planeada (se existir)
    try {
        const salaSnap = await db.collection('salas').doc(salaId).get();
        if (salaSnap.exists && salaSnap.data().plannedRoute) {
            plannedWaypoints = salaSnap.data().plannedRoute;
            drawPlannedRoute();
        }
    } catch (e) { console.error('Erro ler Rota Planeada:', e); }

    // Listener Real-time da Sala (Substitui o antigo .get estático)
    db.collection('salas').doc(salaId).onSnapshot(async (docSnap) => {
        if (!docSnap.exists) return;
        const data = docSnap.data();
        const uids = data.users || [];

        // Identificar novos utilizadores e mostrar toast
        for (const uid of uids) {
            if (!trackedUsers[uid]) {
                try {
                    const userDoc = await db.collection('users').doc(uid).get();
                    if (userDoc.exists) {
                        const u = userDoc.data();

                        // Call toast APENAS para novos Utilizadores após o carregamento inicial da sala
                        if (initialLoadComplete) {
                            if (adminToastNotif && adminToastMsg) {
                                adminToastMsg.textContent = `${u.name} | ${u.uniqueCode}`;
                                adminToastNotif.classList.remove('hidden', 'translate-y-[-150%]', 'opacity-0');
                                setTimeout(() => {
                                    adminToastNotif.classList.add('translate-y-[-150%]', 'opacity-0');
                                    setTimeout(() => adminToastNotif.classList.add('hidden'), 500);
                                }, 5000);
                            }
                        }

                        // Começar stream tracker deste radar
                        startTrackingUser(uid, u.name, u.uniqueCode, u.photoURL);
                    }
                } catch (e) { console.error('Erro ao carregar viajante da sala:', e); }
            }
        }

        initialLoadComplete = true; // Marcar o fim do parse inicial
    });

    //Fechar sidebar no mobile após abrir sala
    if (window.innerWidth < 1024) toggleSidebar(false);
}

if (btnCreateSala) {
    btnCreateSala.addEventListener('click', async () => {
        const name = salaNameInput.value.trim();
        if (!name) { showSalaError('Insere um nome para a sala.'); return; }
        const salaId = generateSalaId();
        try {
            await db.collection('salas').doc(salaId).set({
                name,
                createdBy: auth.currentUser.uid,
                users: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            salaNameInput.value = '';
            await openSala(salaId, name, []);
        } catch (e) { showSalaError('Erro ao criar sala: ' + e.message); }
    });
}

if (btnLoadSala) {
    btnLoadSala.addEventListener('click', async () => {
        const salaId = salaIdInput.value.trim().toUpperCase();
        if (salaId.length < 4) { showSalaError('ID de sala inválido.'); return; }
        try {
            const snap = await db.collection('salas').doc(salaId).get();
            if (!snap.exists) { showSalaError('Sala não encontrada.'); return; }
            const data = snap.data();
            salaIdInput.value = '';
            await openSala(salaId, data.name, data.users || []);
        } catch (e) { showSalaError('Erro ao carregar sala: ' + e.message); }
    });
}

if (btnCloseSala) {
    btnCloseSala.addEventListener('click', () => {
        activeSalaId = null;
        salaCreateView.classList.remove('hidden');
        salaActiveView.classList.add('hidden');
        Object.keys(trackedUsers).forEach(uid => removeUser(uid));

        // Limpar Rota Planeada localmente
        plannedWaypoints = [];
        if (plannedRouteLayer) {
            map.removeLayer(plannedRouteLayer);
            plannedRouteLayer = null;
        }
        plannedMarkers.forEach(m => map.removeLayer(m));
        plannedMarkers = [];
        if (togglePlanning.checked) togglePlanning.click(); // Sair modo plan
    });
} // Fecho do if (btnCloseSala)

// --- PLANEAMENTO DE ROTA ---
let isPlanningRoute = false;
let plannedWaypoints = []; // [{lat, lng}] do OSRM
let plannedMarkers = []; // Leaflet markers dos cliques
let plannedRouteLayer = null;

const togglePlanning = document.getElementById('toggle-planning');
const planningTools = document.getElementById('planning-tools');
const planningInstruction = document.getElementById('planning-instruction');
const btnClearRoute = document.getElementById('btn-clear-route');
const btnSaveRoute = document.getElementById('btn-save-route');

if (togglePlanning) {
    togglePlanning.addEventListener('change', (e) => {
        isPlanningRoute = e.target.checked;
        if (isPlanningRoute) {
            planningTools.classList.remove('hidden');
            planningInstruction.classList.remove('hidden');
            map._container.style.cursor = 'crosshair';
        } else {
            planningTools.classList.add('hidden');
            planningInstruction.classList.add('hidden');
            map._container.style.cursor = '';
        }
    });
}

if (btnClearRoute) {
    btnClearRoute.addEventListener('click', () => {
        plannedWaypoints = [];
        plannedMarkers.forEach(m => map.removeLayer(m));
        plannedMarkers = [];
        if (plannedRouteLayer) {
            map.removeLayer(plannedRouteLayer);
            plannedRouteLayer = null;
        }
    });
}

if (btnSaveRoute) {
    btnSaveRoute.addEventListener('click', async () => {
        if (!activeSalaId) return;
        btnSaveRoute.textContent = 'A GRAVAR...';
        try {
            // Converter array multidimensional de Leaflet [lat,lng] para objetos JS compatíveis com Firestore
            const safeWaypoints = plannedWaypoints.map(wp => ({
                lat: typeof wp.lat === 'number' ? wp.lat : wp[0],
                lng: typeof wp.lng === 'number' ? wp.lng : wp[1]
            }));

            await db.collection('salas').doc(activeSalaId).update({
                plannedRoute: safeWaypoints
            });
            btnSaveRoute.textContent = 'GRAVADO!';
            btnSaveRoute.classList.replace('bg-purple-700/80', 'bg-green-600');
            setTimeout(() => {
                btnSaveRoute.textContent = 'Gravar Oficial';
                btnSaveRoute.classList.replace('bg-green-600', 'bg-purple-700/80');
                if (togglePlanning.checked) togglePlanning.click(); // Autoclose toggle se estiver checked
            }, 2000);
        } catch (e) {
            console.error("Erro a guardar rota:", e);
            btnSaveRoute.textContent = 'ERRO';
        }
    });
} // Fecho do if (btnSaveRoute)

// Desenhar a linha final com todos os pontos guardados
function drawPlannedRoute() {
    if (plannedRouteLayer) {
        map.removeLayer(plannedRouteLayer);
    }
    if (plannedWaypoints.length > 1) {
        plannedRouteLayer = L.polyline(plannedWaypoints, {
            color: '#00E5FF', // Ciano Tech
            weight: 4,
            opacity: 0.9,
            dashArray: '10,10',
            lineJoin: 'round'
        }).addTo(map);
    }
}

async function fetchOsrmRoute(start, end) {
    try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
            // Converter GeoJSON LngLat para Leaflet LatLng
            return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        }
    } catch (err) {
        console.error("OSRM Route Error", err);
    }
    // Fallback: Linha reta
    return [[start.lat, start.lng], [end.lat, end.lng]];
}

// Lidar com Autenticação (Controla as Divs)
auth.onAuthStateChanged((user) => {
    if (user) {
        if (user.uid === ADMIN_UID) {
            loginView.classList.add('hidden');
            appView.classList.remove('hidden');
            map.invalidateSize(); // Fix pro mapa Leaflet que inicia em container oculto
        } else {
            auth.signOut(); // Expulsa utilizadores da app mobile que tenham vindo parar aqui
            alert("Acesso Negado: A tua conta não tem credenciais Master de Administrador.");
            loginView.classList.remove('hidden');
            appView.classList.add('hidden');
        }
    } else {
        loginView.classList.remove('hidden');
        appView.classList.add('hidden');
    }
});

// Processar a entrada de Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorMsg.classList.add('hidden');
    btnAdminLogin.disabled = true;
    btnAdminLogin.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 mx-auto animate-spin"></i>';
    lucide.createIcons();

    try {
        await auth.signInWithEmailAndPassword(adminEmail.value.trim(), adminPassword.value);
    } catch (error) {
        console.error(error);
        loginErrorMsg.textContent = "Acesso Negado: Email ou password incorretos.";
        loginErrorMsg.classList.remove('hidden');
    } finally {
        btnAdminLogin.disabled = false;
        btnAdminLogin.textContent = "AUTENTICAR";
    }
});

// Processar Logout
if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => auth.signOut());
}

// Definir as Camadas Base
const layerTatico = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap Tracker',
    className: 'map-layer-tatico' // Filtro dark mode (CSS custom)
});

const layerSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
});

// Inicializar Mapa Leaflet (focado em Goiás, Brasil) com Tático por defeito
const map = L.map('map', {
    zoomControl: false, // Ocultar para manter o look limpo, depois adicionamos custom
    layers: [layerTatico]
}).setView([-17.9422, -50.9275], 6); // Foco próximo a Lagoa Santa, GO

// Adicionar a caixa rotineira de Geocoder (Pesquisa de Cidades/Ruas)
L.Control.geocoder({
    defaultMarkGeocode: false,
    placeholder: "Pesquisar Av. / Cidade...",
    position: "topleft"
}).on('markgeocode', function (e) {
    const bbox = e.geocode.bbox;
    const center = e.geocode.center;
    map.fitBounds(bbox);
    L.popup().setLatLng(center).setContent(e.geocode.name).openOn(map);
}).addTo(map);

// Adicionar controlo de camadas no canto superior direito
const baseMaps = {
    "Mapa Tático (Radar)": layerTatico,
    "Satélite Fotográfico": layerSatelite
};
L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

// Clique no Mapa - Lógica de Planeamento de Rota
map.on('click', async (e) => {
    if (!isPlanningRoute) return;

    const latlng = e.latlng;
    const marker = L.circleMarker(latlng, {
        radius: 4, color: '#white', fillColor: '#a855f7', fillOpacity: 1, weight: 2
    }).addTo(map);
    plannedMarkers.push(marker);

    if (plannedWaypoints.length === 0) {
        // Primeiro clique (Apenas guardar ponto)
        plannedWaypoints.push([latlng.lat, latlng.lng]);
    } else {
        // Obter último ponto traçado e pedir Rota OSRM com o novo ponto clicado
        const lastPoint = plannedWaypoints[plannedWaypoints.length - 1];
        const lastLatLng = { lat: lastPoint[0], lng: lastPoint[1] };

        planningInstruction.textContent = "A calcular rota...";
        const newSegment = await fetchOsrmRoute(lastLatLng, latlng);
        planningInstruction.textContent = "Clica no mapa para desenhar o percurso.";

        // Juntar segmento (ignorando o primeiro ponto para não duplicar overlap)
        if (newSegment.length > 0) {
            plannedWaypoints.push(...newSegment.slice(1));
        }
    }
    drawPlannedRoute();
});

// Controlos de zoom movidos para baixo à direita
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Ícones Customizados
const radarIconActive = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const radarIconStale = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Estado
const trackedUsers = {};
// trackedUsers[uid] = { name, uniqueCode, photoURL, route, routeLine, routeLineGlow, color, marker, unsubscribe }

// Geração de Cores HSL (Vibrantes no Dark Mode) em vez de array fixo
function nextRouteColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 85%, 65%)`;
}

// Elementos UI
const inputCode = document.getElementById('target-uid');
const btnAdd = document.getElementById('btn-add-radar');
const errorMsg = document.getElementById('radar-add-error');
const radarList = document.getElementById('radar-list');
const emptyState = document.getElementById('empty-state');
const countEl = document.getElementById('tracker-count');

const btnFixFernando = document.getElementById('btn-fix-fernando');
if (btnFixFernando) {
    btnFixFernando.addEventListener('click', async () => {
        const usersToFix = Object.values(trackedUsers);

        if (usersToFix.length === 0) {
            alert("Não existem viajantes a ser monitorizados nesta sessão/sala para reparar.");
            return;
        }

        if (!confirm(`Tencionas reparar as linhas de rota OSRM para TODOS os ${usersToFix.length} radar(es) ativos no telemóvel/sala?\nO processo poderá demorar alguns segundos por utilizador. Continuar?`)) {
            return;
        }

        btnFixFernando.disabled = true;

        for (const [index, userObj] of usersToFix.entries()) {
            // we don't have uid explicitly in trackedUsers values intuitively without the key, let's find it 
            // the object structure is trackedUsers[uid] = { name, uniqueCode, unsubscribe... }
            const uidStr = Object.keys(trackedUsers).find(k => trackedUsers[k].uniqueCode === userObj.uniqueCode);
            if (!uidStr) continue;

            btnFixFernando.textContent = `A REPARAR OSRM ÚTILIZADOR ${index + 1}/${usersToFix.length}...`;

            try {
                const routeDoc = await db.collection('routes').doc(uidStr).get();
                if (!routeDoc.exists || !routeDoc.data().points || routeDoc.data().points.length < 2) {
                    console.warn(`[REPARADOR] Sem rota suficiente para: ${userObj.name}`);
                    continue;
                }

                const allRaw = routeDoc.data().points;
                let rawPoints = [allRaw[0]];
                for (let i = 1; i < allRaw.length; i++) {
                    const p1 = rawPoints[rawPoints.length - 1];
                    const p2 = allRaw[i];
                    // Manter pontos apenas se a distância for maior do que uns metros ou for o último
                    const dist = map.distance([p1.lat, p1.lng], [p2.lat, p2.lng]);
                    if (dist > 100 || i === allRaw.length - 1) {
                        rawPoints.push(p2);
                    }
                }

                let finalStitchedPoints = [];
                const chunkSize = 15; // Menor para evitar erros da API
                const totalChunks = Math.ceil(rawPoints.length / (chunkSize - 1));
                let chunkNo = 0;

                for (let i = 0; i < rawPoints.length; i += (chunkSize - 1)) {
                    chunkNo++;
                    btnFixFernando.textContent = `A REPARAR ${userObj.name} (${Math.round((chunkNo / totalChunks) * 100)}%)...`;

                    let chunk = rawPoints.slice(i, i + chunkSize);
                    if (chunk.length < 2 && i > 0) break;

                    const coordsString = chunk.map(p => `${p.lng},${p.lat}`).join(';');
                    try {
                        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);

                        if (!res.ok) {
                            console.warn("OSRM Falhou HTTP:", res.status);
                            let slicePoints = chunk;
                            if (finalStitchedPoints.length > 0) slicePoints.shift();
                            finalStitchedPoints.push(...slicePoints);
                        } else {
                            const data = await res.json();
                            if (data.routes && data.routes.length > 0) {
                                let roadObjs = data.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
                                if (finalStitchedPoints.length > 0) roadObjs.shift(); // Evitar duplicar
                                finalStitchedPoints.push(...roadObjs);
                            } else {
                                let slicePoints = chunk;
                                if (finalStitchedPoints.length > 0) slicePoints.shift();
                                finalStitchedPoints.push(...slicePoints);
                            }
                        }
                    } catch (er) {
                        let slicePoints = chunk;
                        if (finalStitchedPoints.length > 0) slicePoints.shift();
                        finalStitchedPoints.push(...slicePoints);
                    }

                    // Throttle para public API (esperar 1.5s entre calls para não levar HTTP 429)
                    await new Promise(r => setTimeout(r, 1500));
                }

                btnFixFernando.textContent = `A GRAVAR ${userObj.name}...`;
                if (finalStitchedPoints.length > 3000) finalStitchedPoints.splice(0, finalStitchedPoints.length - 3000); // segurança extra
                await db.collection('routes').doc(uidStr).update({ points: finalStitchedPoints });

                // Recarrega o user no final de OSRM para o admin ver
                if (trackedUsers[uidStr]) {
                    removeUser(uidStr);
                    await startTrackingUser(uidStr, userObj.name, userObj.uniqueCode, userObj.photoURL || '');
                }

                // Dorme 2 segs antes do próximo para evitar abuso OSRM massivo
                await new Promise(r => setTimeout(r, 2000));

            } catch (e) {
                console.error(`Erro ao reparar ${userObj.name}:`, e);
            }
        } // end foreach user

        btnFixFernando.disabled = false;
        btnFixFernando.textContent = "⚙️ REPARAR ROTAS DA SALA";
        alert(`✅ Processo de Reparação OSRM Concluído para ${usersToFix.length} radar(es)!`);

    });
}

btnAdd.addEventListener('click', async () => {
    const codeEl = document.getElementById('target-uid') || inputCode;
    if (!codeEl) {
        showError("Erro interno: inputCode não encontrado no DOM. Recarregue a página.");
        return;
    }
    const code = codeEl.value.trim().toUpperCase();
    if (code.length !== 5) {
        showError("O código deve ter 5 caracteres.");
        return;
    }

    // Check if already tracking
    if (Object.values(trackedUsers).some(u => u.uniqueCode === code)) {
        showError("Este viajante já está a ser rastreado.");
        return;
    }

    errorMsg.classList.add('hidden');
    btnAdd.disabled = true;
    btnAdd.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>';
    lucide.createIcons();

    try {
        const querySnapshot = await db.collection('users').where('uniqueCode', '==', code).get();
        if (querySnapshot.empty) {
            showError("Código de agente inválido ou não encontrado.");
        } else {
            // Existe! Vamos buscar o uid
            const doc = querySnapshot.docs[0];
            const uid = doc.id;
            const userData = doc.data();

            startTrackingUser(uid, userData.name, userData.uniqueCode, userData.photoURL);
            inputCode.value = '';
        }
    } catch (err) {
        showError("Erro a contatar o satélite: " + err.message);
    } finally {
        btnAdd.disabled = false;
        btnAdd.innerHTML = '<i data-lucide="crosshair" class="w-5 h-5"></i>';
        lucide.createIcons();
    }
});

// Objeto de Estado: trackedUsers[uid] = { name, uniqueCode, unsubscribe, marker: null }

async function startTrackingUser(uid, name, uniqueCode, photoURL) {
    if (emptyState) emptyState.remove();

    // Carregar histórico de rota do Firestore e tentar obter a cor original
    let officialColor = nextRouteColor(); // Fallback genérico
    try {
        const uSnap = await db.collection('users').doc(uid).get();
        if (uSnap.exists && uSnap.data().color) {
            officialColor = uSnap.data().color;
        }
    } catch (err) { console.error('Erro ao ler cor user:', err); }

    trackedUsers[uid] = { name, uniqueCode, photoURL, color: officialColor, route: [], routeLine: null, routeLineGlow: null, unsubscribe: null, marker: null };
    countEl.textContent = Object.keys(trackedUsers).length;
    updateSidebarUI(uid, name, uniqueCode, photoURL, "A CONECTAR", 0);

    try {
        const routeSnap = await db.collection('routes').doc(uid).get();
        if (routeSnap.exists) {
            const data = routeSnap.data();
            const pts = data.points || [];
            if (data.color) trackedUsers[uid].color = data.color;

            if (pts.length > 0) {
                trackedUsers[uid].route = pts.map(p => [p.lat, p.lng]);

                trackedUsers[uid].routeLineGlow = L.polyline(trackedUsers[uid].route, {
                    color: trackedUsers[uid].color,
                    weight: 10,
                    opacity: 0.15,
                    lineJoin: 'round'
                }).addTo(map);

                trackedUsers[uid].routeLine = L.polyline(trackedUsers[uid].route, {
                    color: trackedUsers[uid].color,
                    weight: 3,
                    opacity: 1,
                    lineJoin: 'round'
                }).addTo(map);
            }
        }
    } catch (e) { console.error('Erro ao carregar rota:', e); }

    // Ouvir posição em tempo real
    const unsubscribe = db.collection('locations').doc(uid).onSnapshot((docSnap) => {
        if (!docSnap.exists) {
            updateSidebarUI(uid, name, uniqueCode, photoURL, "A AGUARDAR", 0);
            return;
        }
        const data = docSnap.data();
        const active = data.active;
        const lat = data.lat;
        const lng = data.lng;
        const heading = data.heading || 0;
        const speed = data.speed !== null && data.speed !== undefined ? (data.speed * 3.6).toFixed(0) : 0;
        const updateTime = data.updatedAt ? data.updatedAt.toDate() : new Date();
        const secondsAgo = (new Date() - updateTime) / 1000;
        const isStale = secondsAgo > 60;
        const statusLabel = active && !isStale ? "ONLINE" : (active && isStale ? "SEM SINAL" : "OFFLINE");
        updateMapMarker(uid, name, lat, lng, heading, active && !isStale, statusLabel);
        if (lat && lng && active && !isStale) {
            addRoutePoint(uid, lat, lng);

            // Check Comboio Distance
            Object.keys(trackedUsers).forEach(otherUid => {
                const otherUser = trackedUsers[otherUid];
                if (otherUid !== uid && otherUser.marker) {
                    const dist = map.distance([lat, lng], otherUser.marker.getLatLng());
                    if (dist > 1000) {
                        if (adminToastNotif && adminToastMsg) {
                            adminToastMsg.textContent = 'Afastamento Comboio: >1km detetado!';
                            adminToastNotif.classList.remove('hidden', 'translate-y-[-150%]', 'opacity-0');
                            setTimeout(() => adminToastNotif.classList.add('hidden', 'translate-y-[-150%]', 'opacity-0'), 4000);
                        }
                    }
                }
            });

            // Check Route Deviation
            if (plannedWaypoints && plannedWaypoints.length > 1) {
                let minPlannedDist = Infinity;
                for (let i = 0; i < plannedWaypoints.length; i++) {
                    const pw = plannedWaypoints[i];
                    let pLat = typeof pw.lat === 'number' ? pw.lat : pw[0];
                    let pLng = typeof pw.lng === 'number' ? pw.lng : pw[1];
                    // safe bounds check
                    if (pLat && pLng) {
                        const dist = map.distance([lat, lng], [pLat, pLng]);
                        if (dist < minPlannedDist) minPlannedDist = dist;
                    }
                }

                if (minPlannedDist > 1000) { // 1KM tolerance off official planned route
                    if (adminToastNotif && adminToastMsg) {
                        adminToastMsg.textContent = `Atenção: ${name} num raio exterior >1km da Rota Planeada!`;
                        adminToastNotif.classList.remove('hidden', 'translate-y-[-150%]', 'opacity-0');
                        setTimeout(() => adminToastNotif.classList.add('hidden', 'translate-y-[-150%]', 'opacity-0'), 4000);
                    }
                }
            }
        }
        updateSidebarUI(uid, name, uniqueCode, photoURL, statusLabel, speed);
    });
    trackedUsers[uid].unsubscribe = unsubscribe;

    // Ouvir mudanças de cor do viajante em tempo real
    db.collection('users').doc(uid).onSnapshot((userSnap) => {
        if (!userSnap.exists || !trackedUsers[uid]) return;

        const data = userSnap.data();

        // Atualizar perfil do utilizador para os popups
        trackedUsers[uid].profile = {
            phone: data.phone || 'N/D',
            plate: data.plate || 'N/D',
            vehicle: data.vehicle || 'N/D',
            blood: data.blood || 'N/D',
            cargo: data.cargo || 'N/D'
        };

        // Recarregar popup se já existir marcador
        if (trackedUsers[uid].marker) {
            updateMarkerPopup(uid, name, trackedUsers[uid].marker);
        }

        const newColor = data.color;
        if (newColor && newColor !== trackedUsers[uid].color) {
            trackedUsers[uid].color = newColor;
            // Atualizar cor da rota no mapa
            if (trackedUsers[uid].routeLine) {
                trackedUsers[uid].routeLine.setStyle({ color: newColor });
            }
            if (trackedUsers[uid].routeLineGlow) {
                trackedUsers[uid].routeLineGlow.setStyle({ color: newColor });
            }
            // Atualizar marcador com nova cor
            if (trackedUsers[uid].marker) {
                const icon = createUserIcon(trackedUsers[uid].photoURL, true, newColor);
                trackedUsers[uid].marker.setIcon(icon);
            }
        }
    });

    // Guardar utilizador na sala se houver sala ativa
    if (activeSalaId) {
        db.collection('salas').doc(activeSalaId).update({
            users: firebase.firestore.FieldValue.arrayUnion(uid)
        }).catch(e => console.error('Erro ao adicionar user à sala:', e));
    }

    // Fechar sidebar no mobile após adicionar radar se for ação manual (via código)
    if (window.innerWidth < 1024) toggleSidebar(false);
}

async function addRoutePoint(uid, lat, lng) {
    if (!trackedUsers[uid]) return;
    const user = trackedUsers[uid];
    const newPoint = [lat, lng];

    if (user.route.length > 0) {
        const lastPoint = user.route[user.route.length - 1];
        const dist = map.distance(lastPoint, newPoint);

        // Se o salto for maior que 500 metros, tenta rotear por estrada
        if (dist > 500 && dist < 50000) { // Limite de 50km para evitar abusos de API e erros absurdos
            const start = { lat: lastPoint[0], lng: lastPoint[1] };
            const end = { lat: lat, lng: lng };
            const segments = await fetchOsrmRoute(start, end);
            if (segments.length > 1) {
                user.route.push(...segments.slice(1));
            } else {
                user.route.push(newPoint);
            }
        } else {
            user.route.push(newPoint);
        }
    } else {
        user.route.push(newPoint);
    }

    if (user.routeLine) {
        user.routeLine.setLatLngs(user.route);
        if (user.routeLineGlow) user.routeLineGlow.setLatLngs(user.route);
    } else {
        user.routeLineGlow = L.polyline(user.route, {
            color: user.color,
            weight: 10,
            opacity: 0.15,
            lineJoin: 'round'
        }).addTo(map);

        user.routeLine = L.polyline(user.route, {
            color: user.color,
            weight: 3,
            opacity: 1,
            lineJoin: 'round'
        }).addTo(map);
    }
}

function createUserIcon(photoURL, isActive, color = '#22c55e') {
    const borderColor = isActive ? color : '#6b7280';
    const glowColor = isActive ? `${color}80` : 'transparent';
    const imgHtml = photoURL
        ? `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;">👤</div>`;
    return L.divIcon({
        className: '',
        html: `
            <div style="
                width: 44px; height: 44px;
                border-radius: 50%;
                border: 3px solid ${borderColor};
                box-shadow: 0 0 10px ${glowColor}, 0 2px 8px rgba(0,0,0,0.6);
                background: #111;
                overflow: hidden;
                position: relative;
            ">${imgHtml}
            <div style="
                position:absolute; bottom:-8px; left:50%; transform:translateX(-50%);
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 8px solid ${borderColor};
            "></div></div>`,
        iconSize: [44, 52],
        iconAnchor: [22, 52],
        popupAnchor: [0, -54]
    });
}

function updateMarkerPopup(uid, name, markerInstance, statusLabel = null) {
    const user = trackedUsers[uid];
    if (!user) return;

    // Se não passamos um label, tenta calcular/usar o ultimo, senão assume o default
    let label = statusLabel;
    if (!label) {
        // Obter popup html se existir para nao perder status ou ignorar por agora, assumindo ONLINE ou usando algo guardado.
        // Simplificação: apenas ler as propriedades atuais.
        label = "ONLINE"; // Fallback simplificado (em real seria puxado do state mas vai atualizar logo no proximo location pop)
    }

    let statusDot = '⚪';
    if (label === 'ONLINE') statusDot = '🟢';
    else if (label === 'SEM SINAL') statusDot = '🔴';

    let profileHtml = '';
    if (user.profile) {
        const p = user.profile;
        if (p.vehicle !== 'N/D' || p.phone !== 'N/D') {
            profileHtml = `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 11px; line-height: 1.4;">
                ${p.vehicle !== 'N/D' ? `<b>Viatura:</b> ${p.vehicle} (${p.plate})<br>` : ''}
                ${p.phone !== 'N/D' ? `<b>Tel:</b> ${p.phone}<br>` : ''}
                ${p.blood !== 'N/D' ? `<b>Sangue:</b> ${p.blood}<br>` : ''}
                ${p.cargo !== 'N/D' ? `<b>Carga:</b> ${p.cargo}` : ''}
            </div>`;
        }
    }

    markerInstance.setPopupContent(`<b>${name}</b><br>${statusDot} ${label}${profileHtml}`);
}

function updateMapMarker(uid, name, lat, lng, heading, isActive, statusLabel = "OFFLINE") {
    if (!lat || !lng) return;
    const user = trackedUsers[uid];
    const photoURL = user ? user.photoURL : null;
    const color = user ? user.color : '#22c55e';
    const icon = createUserIcon(photoURL, isActive, color);

    if (!trackedUsers[uid].marker) {
        const marker = L.marker([lat, lng], { icon, rotationAngle: heading }).addTo(map);
        trackedUsers[uid].marker = marker;
        updateMarkerPopup(uid, name, marker, statusLabel);
        map.setView([lat, lng], 13);
    } else {
        if (trackedUsers[uid].marker.slideTo) {
            trackedUsers[uid].marker.slideTo([lat, lng], { duration: 1000 });
        } else {
            trackedUsers[uid].marker.setLatLng([lat, lng]);
        }
        if (trackedUsers[uid].marker.setRotationAngle) {
            trackedUsers[uid].marker.setRotationAngle(heading);
        }
        trackedUsers[uid].marker.setIcon(icon);
        updateMarkerPopup(uid, name, trackedUsers[uid].marker, statusLabel);
    }
}

function focusMapOnUser(uid) {
    if (trackedUsers[uid] && trackedUsers[uid].marker) {
        const latLng = trackedUsers[uid].marker.getLatLng();
        map.setView(latLng, 15, { animate: true, duration: 1 });
        trackedUsers[uid].marker.openPopup();
    }
}

function updateSidebarUI(uid, name, code, photoURL, status, speed) {
    let el = document.getElementById('radar-' + uid);

    let statusColor = "text-slate-500";
    let pulse = "";
    if (status === "ONLINE") { statusColor = "text-green-400"; pulse = "animate-pulse"; }
    else if (status === "SEM SINAL" || status === "OFFLINE") { statusColor = "text-red-400"; }
    else if (status === "A CONECTAR") { statusColor = "text-yellow-400"; pulse = "animate-pulse"; }

    if (!el) {
        // Novo item na sidebar (Glassmorphism look)
        el = document.createElement('div');
        el.id = 'radar-' + uid;
        el.className = "bg-black/60 border border-white/10 p-4 rounded-2xl flex items-center justify-between relative group cursor-pointer hover:bg-black/80 hover:border-green-500/30 transition-all shadow-[0_4px_15px_rgba(0,0,0,0.5)]";
        el.title = "Clica para focar o satélite neste radar";
        el.onclick = () => focusMapOnUser(uid);

        // Listeners for Custom Context Menu
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();

            currentContextUid = uid;
            contextTargetName.textContent = name;
            contextTargetUid.textContent = code;

            const menuWidth = 224;
            const menuHeight = 150;
            let posX = e.clientX;
            let posY = e.clientY;

            if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
            if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;

            contextMenu.style.left = `${posX}px`;
            contextMenu.style.top = `${posY}px`;

            contextMenu.classList.remove('hidden', 'scale-95', 'opacity-0', 'pointer-events-none');
            contextMenu.classList.add('scale-100', 'opacity-100', 'pointer-events-auto');
        });

        radarList.appendChild(el);
    }

    const userHsl = trackedUsers[uid] ? trackedUsers[uid].color : '#22c55e';

    const avatarHtml = photoURL
        ? `<img src="${photoURL}" class="w-10 h-10 rounded-full border-[2px] shadow-lg mr-4 shrink-0 object-cover transition-colors" style="border-color: ${userHsl}; box-shadow: 0 0 15px ${userHsl}40;" alt="${name}">`
        : `<div class="w-10 h-10 rounded-full border-[2px] bg-slate-900 flex items-center justify-center shadow-lg mr-4 shrink-0 transition-colors" style="border-color: ${userHsl}; box-shadow: 0 0 15px ${userHsl}40;"><i data-lucide="user" class="w-5 h-5" style="color: ${userHsl};"></i></div>`;

    el.innerHTML = `
        <button onclick="event.stopPropagation(); removeUser('${uid}')" title="Desconectar Radar" class="absolute -top-2 -right-2 bg-red-900/90 text-white p-2 rounded-full border border-red-500/50 hover:bg-red-600 hover:scale-110 transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] opacity-0 group-hover:opacity-100 z-10 w-7 h-7 flex items-center justify-center">
            <i data-lucide="wifi-off" class="w-4 h-4 text-red-100"></i>
        </button>
        <div class="flex items-center flex-1 min-w-0 pr-2">
            ${avatarHtml}
            <div class="truncate">
                <p class="font-black text-sm text-white truncate drop-shadow-md">${name}</p>
                <p class="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-[0.2em] mt-0.5">${code}</p>
            </div>
        </div>
        <div class="text-right shrink-0 border-l border-white/5 pl-4 ml-2">
            <p class="text-[10px] font-black uppercase tracking-widest ${statusColor} ${pulse}">${status}</p>
            <p class="text-lg font-black text-white font-mono mt-1">${speed}<span class="text-[9px] text-slate-500 font-sans tracking-normal ml-0.5">km/h</span></p>
        </div>
    `;

    lucide.createIcons(); // Garante o re-render sempre porque o innerHTML foi alterado (incluindo o botão de fechar)
}

function removeUser(uid) {
    if (!trackedUsers[uid]) return;

    // 1. Parar de escutar Firebase
    if (typeof trackedUsers[uid].unsubscribe === 'function') {
        trackedUsers[uid].unsubscribe();
    }

    // 2. Remover do Mapa (marcador e rota)
    if (trackedUsers[uid].marker) {
        map.removeLayer(trackedUsers[uid].marker);
    }
    if (trackedUsers[uid].routeLine) {
        map.removeLayer(trackedUsers[uid].routeLine);
    }
    if (trackedUsers[uid].routeLineGlow) {
        map.removeLayer(trackedUsers[uid].routeLineGlow);
    }

    // 3. Remover do Estado
    delete trackedUsers[uid];
    countEl.textContent = Object.keys(trackedUsers).length;

    // 4. Remover Div Visual
    const el = document.getElementById('radar-' + uid);
    if (el) el.remove();

    // 5. Devolver estado vazio se tiver a 0
    if (Object.keys(trackedUsers).length === 0) {
        if (!document.getElementById('empty-state')) {
            radarList.innerHTML = `<p class="text-xs text-gray-600 text-center mt-10 italic" id="empty-state">Nenhum viajante localizado. Insira um código UUID para começar.</p>`;
        }
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}
