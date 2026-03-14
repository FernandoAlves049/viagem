import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, StatusBar, Image, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

// AS SUAS CHAVES DO FIREBASE (Intactas e Seguras)
const firebaseConfig = {
  apiKey: "AIzaSyChd-obj84ex3ICIR9-gXYaD73G4i2kClY",
  authDomain: "ratonet-tracker.firebaseapp.com",
  databaseURL: "https://ratonet-tracker-default-rtdb.firebaseio.com",
  projectId: "ratonet-tracker",
  storageBucket: "ratonet-tracker.firebasestorage.app",
  appId: "1:675538092831:web:4af8d3e86ddb1b392ea62a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- OPEN STREET MAP (LEAFLET HTML - TEMA DARK/RADAR) ---
// Totalmente independente de chaves de API do Google. Imune a crashes de licenciamento.
const leafletHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body { padding: 0; margin: 0; background: #050505; }
        html, body, #map { height: 100%; width: 100vw; }
        
        /* Estilo do Marcador do Carro (Ponto Laranja Neon) */
        .car-marker {
            background: #e67e22;
            border: 3px solid #fff;
            border-radius: 50%;
            box-shadow: 0 0 15px #e67e22;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }
        
        /* Estilo da Etiqueta de Velocidade */
        .leaflet-tooltip {
            background: rgba(10,10,10,0.9);
            color: #00ffcc;
            border: 1px solid #333;
            font-family: monospace;
            font-weight: bold;
            font-size: 14px;
            border-radius: 8px;
            padding: 5px 10px;
        }
        .leaflet-tooltip-top:before { border-top-color: rgba(10,10,10,0.9); }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        // Inicia o mapa centrado em Morrinhos - GO
        var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([-17.7314, -49.1009], 14);
        
        // Camada do Mapa CartoDB Dark Matter (Estilo Radar Noturno)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(map);

        var markers = {};
        var primeiroCarroAdicionado = false;

        // Função para receber os dados do React Native
        function updateMap(data) {
            try {
                var comboio = JSON.parse(data);
                
                for (var uid in comboio) {
                    var carro = comboio[uid];
                    
                    // Só desenha se tiver GPS válido
                    if(carro.latitude && carro.longitude) {
                        
                        var tooltipText = carro.nome + "<br>⚡ " + Math.round(carro.speed || 0) + " km/h";
                        var latLng = [carro.latitude, carro.longitude];
                        
                        if (markers[uid]) {
                            // Atualiza posição do carro que já existe
                            markers[uid].setLatLng(latLng);
                            markers[uid].setTooltipContent(tooltipText);
                        } else {
                            // Cria novo carro no mapa
                            var icon = L.divIcon({ className: 'car-marker', html: '🚘', iconSize: [30, 30], iconAnchor: [15, 15] });
                            markers[uid] = L.marker(latLng, {icon: icon})
                                .bindTooltip(tooltipText, {permanent: true, direction: 'top', offset: [0, -15]})
                                .addTo(map);
                            
                            // A câmera "persegue" o primeiro carro que aparecer
                            if(!primeiroCarroAdicionado) {
                                map.setView(latLng, 16);
                                primeiroCarroAdicionado = true;
                            }
                        }
                    }
                }
            } catch(e) {
                console.error("Erro ao processar dados do mapa:", e);
            }
        }

        // Event Listeners para Android e iOS receberem a mensagem do React Native
        document.addEventListener("message", function(event) { updateMap(event.data); });
        window.addEventListener("message", function(event) { updateMap(event.data); });
    </script>
</body>
</html>
`;

export default function App() {
  const [user, setUser] = useState(null);
  const [salaAtiva, setSalaAtiva] = useState(null);
  const [comboio, setComboio] = useState({});
  const webviewRef = useRef(null);

  // Estados para o novo Login por E-mail
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  // --- 1. LOGIN POR E-MAIL E SENHA ---
  const handleAuth = async () => {
    if (!email || !password) return Alert.alert("Atenção", "Preencha o e-mail e a senha.");

    try {
      let userCred;
      if (isLoginMode) {
        // ENTRAR
        userCred = await signInWithEmailAndPassword(auth, email, password);
      } else {
        // REGISTAR
        userCred = await createUserWithEmailAndPassword(auth, email, password);
        set(ref(db, `usuarios/${userCred.user.uid}`), {
          nome: email.split('@')[0],
          role: 'admin'
        });
        Alert.alert("Sucesso!", "Conta de Comandante criada com sucesso!");
      }
      setUser(userCred.user);
    } catch (error) {
      console.log("Erro Auth:", error);
      let mensagem = "Falha na autenticação.";
      if (error.code === 'auth/invalid-email') mensagem = "E-mail inválido.";
      if (error.code === 'auth/user-not-found') mensagem = "Usuário não encontrado. Registre-se primeiro.";
      if (error.code === 'auth/wrong-password') mensagem = "Senha incorreta.";
      if (error.code === 'auth/email-already-in-use') mensagem = "Este e-mail já está em uso.";
      Alert.alert("Erro de Acesso", mensagem);
    }
  };

  // --- 2. CRIAR SALA ---
  const criarSala = () => {
    const novoCodigo = Math.random().toString(36).substring(2, 7).toUpperCase();
    const nomeExibicao = user.email.split('@')[0].toUpperCase();

    set(ref(db, `salas/${novoCodigo}`), { criador: nomeExibicao, data: Date.now() });
    setSalaAtiva(novoCodigo);
    Alert.alert("🟢 RADAR ATIVADO!", `Código da Missão: ${novoCodigo}`);
  };

  // --- 3. OUVIR A TELEMETRIA (FIREBASE) ---
  useEffect(() => {
    if (!salaAtiva) return;

    const telemetriaRef = ref(db, `telemetria/${salaAtiva}`);
    const unsubscribe = onValue(telemetriaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setComboio(data);
    });

    return () => unsubscribe();
  }, [salaAtiva]);

  // --- 4. ENVIAR DADOS PARA O MAPA LIVRE (WEBVIEW) ---
  useEffect(() => {
    // Sempre que a variável "comboio" atualizar, enviamos o JSON para dentro do HTML do mapa
    if (webviewRef.current && salaAtiva && Object.keys(comboio).length > 0) {
      webviewRef.current.postMessage(JSON.stringify(comboio));
    }
  }, [comboio, salaAtiva]);

  // Avatar dinâmico baseado no e-mail
  const avatarUrl = `https://ui-avatars.com/api/?name=${user?.email || 'Admin'}&background=e67e22&color=fff&size=100`;

  // --- TELAS ---

  // TELA 1: LOGIN
  if (!user) {
    return (
      <View style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.title}>CENTRO DE<Text style={{ color: '#fff' }}> COMANDO</Text></Text>
        <Text style={styles.subtitle}>Gestão de Frota e Rastreio</Text>

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="E-mail Operacional"
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha de Acesso"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.authBtn} onPress={handleAuth}>
            <Text style={styles.authBtnText}>{isLoginMode ? "ENTRAR NO RADAR" : "CRIAR CONTA ADMIN"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)} style={{ marginTop: 25 }}>
            <Text style={styles.toggleText}>
              {isLoginMode ? "Não tem conta? Toque para Registrar" : "Já tem conta? Toque para Entrar"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // TELA 2: MAPA E PAINEL DE CONTROLE
  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* RENDERIZA O MAPA LIVRE OU O PAINEL DE ESPERA */}
      {salaAtiva ? (
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: leafletHTML }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          bounces={false}
        />
      ) : (
        <View style={styles.mapPlaceholder}>
          <Ionicons name="earth" size={80} color="#222" />
          <Text style={styles.placeholderText}>SISTEMA DE RASTREIO EM ESPERA</Text>
          <Text style={styles.placeholderSub}>Gere o código da missão para ativar o satélite militar.</Text>
        </View>
      )}

      {/* PAINEL DE COMANDO INFERIOR */}
      <View style={styles.glassPanel}>
        <View style={styles.adminHeader}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          <Text style={styles.adminName}>Cmdt. {user.email.split('@')[0]}</Text>
        </View>

        {!salaAtiva ? (
          <TouchableOpacity style={styles.createBtn} onPress={criarSala}>
            <Text style={styles.btnText}>🌐 GERAR CÓDIGO DA MISSÃO</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>CÓDIGO ATIVO:</Text>
            <Text style={styles.infoValue}>{salaAtiva}</Text>
            <Text style={styles.veiculosCount}>🚗 {Object.keys(comboio).length} Veículos Conectados no Radar</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loginContainer: { flex: 1, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#e67e22', letterSpacing: 2 },
  subtitle: { color: '#888', marginBottom: 40, letterSpacing: 1 },
  formContainer: { width: '100%', backgroundColor: '#111', padding: 25, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
  input: { backgroundColor: '#000', color: '#fff', fontSize: 16, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginBottom: 15 },
  authBtn: { backgroundColor: '#e67e22', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  authBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  toggleText: { color: '#e67e22', textAlign: 'center', fontSize: 14, fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#050505' },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height, backgroundColor: '#050505' },
  mapPlaceholder: { flex: 1, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  placeholderText: { color: '#e67e22', fontSize: 16, fontWeight: '900', marginTop: 20, letterSpacing: 1, textAlign: 'center' },
  placeholderSub: { color: '#666', fontSize: 12, marginTop: 10, textAlign: 'center', paddingHorizontal: 40 },
  glassPanel: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: 'rgba(10,10,10,0.95)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#333', elevation: 10 },
  adminHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: '#333', paddingBottom: 10 },
  avatar: { width: 45, height: 45, borderRadius: 25, marginRight: 15, borderWidth: 2, borderColor: '#e67e22' },
  adminName: { color: '#fff', fontSize: 18, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  createBtn: { backgroundColor: '#e67e22', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  infoBox: { backgroundColor: '#111', padding: 15, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  infoLabel: { color: '#888', fontSize: 10, letterSpacing: 1 },
  infoValue: { color: '#e67e22', fontSize: 36, fontWeight: '900', letterSpacing: 8 },
  veiculosCount: { color: '#00ffcc', marginTop: 10, fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }
});