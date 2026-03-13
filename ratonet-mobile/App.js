import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, StatusBar, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, get } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut } from "firebase/auth";
import { GoogleSignin } from '@react-native-google-signin/google-signin';

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

GoogleSignin.configure({
  webClientId: '675538092831-cei7389fk88ceeho7i2dh7ce3383akc1.apps.googleusercontent.com',
});

// Estilo de Mapa Noturno (Profissional)
const mapDarkStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
];

export default function App() {
  useKeepAwake();
  const [user, setUser] = useState(null);
  const [codigoSala, setCodigoSala] = useState('');
  const [salaAtiva, setSalaAtiva] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [minhaPosicao, setMinhaPosicao] = useState(null);
  const [comboio, setComboio] = useState({});

  // --- 1. LOGIN ---
  const signInGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken || userInfo?.idToken;
      
      if (!idToken) return Alert.alert("Erro", "Falha ao obter Token do Google.");

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCred = await signInWithCredential(auth, googleCredential);
      
      setUser(userCred.user);
      set(ref(db, `usuarios/${userCred.user.uid}`), {
        nome: userCred.user.displayName,
        foto: userCred.user.photoURL,
        role: 'viajante'
      });
    } catch (error) {
      Alert.alert("Erro no Login", error.message);
    }
  };

  // --- LOGOUT SEGURO ---
  const handleSignOut = async () => {
    Alert.alert(
      "Sair da Conta",
      "Tem a certeza que deseja desligar a transmissão e sair?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sair", 
          style: "destructive",
          onPress: async () => {
            try {
              if (isLive) setIsLive(false);
              await auth.signOut();
              await GoogleSignin.signOut();
              setUser(null);
              setSalaAtiva(null);
              setCodigoSala('');
              setMinhaPosicao(null);
              setComboio({});
            } catch (error) {
              Alert.alert("Erro", "Falha ao sair da conta.");
            }
          }
        }
      ]
    );
  };

  // --- 2. SALA ---
  const entrarNaSala = async () => {
    if (codigoSala.length < 5) return Alert.alert("Ops!", "Código inválido.");
    const salaRef = ref(db, `salas/${codigoSala.toUpperCase()}`);
    const snapshot = await get(salaRef);

    if (snapshot.exists()) {
      setSalaAtiva(codigoSala.toUpperCase());
    } else {
      Alert.alert("Erro", "Sala não encontrada.");
    }
  };

  // --- BUSCAR LOCALIZAÇÃO INICIAL (Para colocar a sua foto logo no mapa) ---
  useEffect(() => {
    if (salaAtiva && !minhaPosicao) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setMinhaPosicao({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      })();
    }
  }, [salaAtiva]);

  // --- 3. OUVIR O COMBOIO ---
  useEffect(() => {
    if (!salaAtiva) return;
    const telemetriaRef = ref(db, `telemetria/${salaAtiva}`);
    
    const unsubscribe = onValue(telemetriaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setComboio(data);
    });
    return () => unsubscribe();
  }, [salaAtiva]);

  // --- 4. RASTREIO GPS (A TRANSMISSÃO) ---
  const toggleTracking = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (isLive) {
      setIsLive(false);
      setSpeed(0);
      return;
    }

    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Permissão negada", "Ative o GPS.");

    setIsLive(true);
    await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
      (loc) => {
        const kmh = loc.coords.speed * 3.6;
        setSpeed(kmh > 0 ? kmh : 0);
        setMinhaPosicao({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        
        // Transmite para os outros verem!
        set(ref(db, `telemetria/${salaAtiva}/${user.uid}`), {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed: kmh > 0 ? kmh : 0,
          nome: user.displayName.split(' ')[0],
          foto: user.photoURL,
          timestamp: Date.now()
        });
      }
    );
  };

  // --- TELAS ---
  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.title}>RATONET<Text style={{color: '#fff'}}> MOBILE</Text></Text>
        <Text style={styles.subtitle}>Radar de Viagem</Text>
        <TouchableOpacity style={styles.googleBtn} onPress={signInGoogle}>
          <Ionicons name="logo-google" size={24} color="#fff" />
          <Text style={styles.googleText}> Entrar com Google</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!salaAtiva) {
    return (
      <View style={styles.centerContainer}>
        <Image source={{ uri: user.photoURL }} style={styles.avatar} />
        <Text style={styles.welcomeText}>Olá, {user.displayName.split(' ')[0]}</Text>
        <View style={styles.inputCard}>
          <Text style={styles.label}>CÓDIGO DA MISSÃO (SALA)</Text>
          <TextInput 
            style={styles.input}
            placeholder="EX: A1B2C"
            placeholderTextColor="#555"
            value={codigoSala}
            onChangeText={setCodigoSala}
            autoCapitalize="characters"
            maxLength={6}
          />
          <TouchableOpacity style={styles.connectBtn} onPress={entrarNaSala}>
            <Text style={styles.connectBtnText}>CONECTAR AO RADAR</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutTextBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#e74c3c" />
          <Text style={styles.logoutText}>Sair da Conta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      {/* MAPA INTERATIVO */}
      <MapView 
        style={styles.map}
        customMapStyle={mapDarkStyle}
        showsUserLocation={false} /* Desativamos o ponto azul padrão para usar a foto */
        followsUserLocation={isLive}
        initialRegion={minhaPosicao ? {
          latitude: minhaPosicao.latitude,
          longitude: minhaPosicao.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        } : null}
      >
        
        {/* O SEU MARCADOR (FOTO DO GOOGLE) */}
        {minhaPosicao && (
          <Marker 
            coordinate={minhaPosicao}
            title="Você"
            description={isLive ? `Transmitindo a ${Math.round(speed)} km/h` : 'Modo Fantasma (Invisível)'}
            zIndex={999}
          >
            <View style={styles.markerContainer}>
              <Image source={{ uri: user.photoURL }} style={styles.myMarkerAvatar} />
              {isLive && (
                <View style={[styles.markerSpeed, { backgroundColor: '#00ffcc', borderColor: '#000' }]}>
                  <Text style={[styles.markerSpeedText, { color: '#000' }]}>{Math.round(speed)}</Text>
                </View>
              )}
            </View>
          </Marker>
        )}

        {/* OUTROS CARROS DO COMBOIO */}
        {Object.keys(comboio).map((uid) => {
          const carro = comboio[uid];
          // Ignora o próprio usuário na lista do Firebase para não duplicar marcadores
          if (uid === user.uid) return null;
          
          return (
            <Marker 
              key={uid} 
              coordinate={{ latitude: carro.latitude, longitude: carro.longitude }}
              title={carro.nome}
              description={`${Math.round(carro.speed)} km/h`}
              zIndex={100}
            >
              <View style={styles.markerContainer}>
                <Image source={{ uri: carro.foto }} style={styles.markerAvatar} />
                <View style={styles.markerSpeed}><Text style={styles.markerSpeedText}>{Math.round(carro.speed)}</Text></View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* PAINEL FLUTUANTE */}
      <View style={styles.bottomPanel}>
        <View style={styles.panelHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.salaTag}>SALA: {salaAtiva}</Text>
            <TouchableOpacity onPress={handleSignOut} style={styles.exitIcon}>
              <Ionicons name="power" size={24} color="#e74c3c" />
            </TouchableOpacity>
          </View>

          <View style={styles.speedDisplay}>
            <Text style={styles.speedValue}>{Math.round(speed)}</Text>
            <Text style={styles.speedUnit}>KM/H</Text>
          </View>
        </View>

        {/* BOTÃO DE INICIAR/PARAR TRANSMISSÃO */}
        <TouchableOpacity 
          style={[styles.mainBtn, { backgroundColor: isLive ? '#e74c3c' : '#00ffcc' }]} 
          onPress={toggleTracking}
        >
          <Ionicons name={isLive ? "radio" : "radio-outline"} size={24} color={isLive ? "#fff" : "#000"} />
          <Text style={[styles.btnText, { color: isLive ? '#fff' : '#000' }]}>
            {isLive ? " PARAR TRANSMISSÃO" : " INICIAR TRANSMISSÃO"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 20 },
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  title: { fontSize: 32, fontWeight: '900', color: '#00ffcc', letterSpacing: 2 },
  subtitle: { color: '#888', letterSpacing: 3, marginBottom: 50 },
  googleBtn: { flexDirection: 'row', backgroundColor: '#4285F4', padding: 15, borderRadius: 10, alignItems: 'center', width: '80%', justifyContent: 'center' },
  googleText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#00ffcc', marginBottom: 20 },
  welcomeText: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 40 },
  inputCard: { width: '100%', backgroundColor: '#111', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
  label: { color: '#888', fontSize: 12, letterSpacing: 2, marginBottom: 10 },
  input: { backgroundColor: '#000', color: '#00ffcc', fontSize: 24, padding: 15, borderRadius: 10, textAlign: 'center', letterSpacing: 5, borderWidth: 1, borderColor: '#333', marginBottom: 20 },
  connectBtn: { backgroundColor: '#00ffcc', padding: 15, borderRadius: 10, alignItems: 'center' },
  connectBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  logoutTextBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 30, padding: 10 },
  logoutText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  bottomPanel: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: 'rgba(15,15,15,0.95)', padding: 20, borderRadius: 25, borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.5, shadowRadius: 10, elevation: 15 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  salaTag: { color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 2, backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10 },
  exitIcon: { marginLeft: 15, backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: 8, borderRadius: 10 },
  speedDisplay: { alignItems: 'flex-end' },
  speedValue: { fontSize: 40, fontWeight: '900', color: '#00ffcc', lineHeight: 45 },
  speedUnit: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  mainBtn: { flexDirection: 'row', width: '100%', padding: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  myMarkerAvatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: '#00ffcc' }, // O SEU AVATAR É MAIOR E NEON
  markerAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 3, borderColor: '#e67e22' },   // OUTROS SÃO MENORES E LARANJAS
  markerSpeed: { position: 'absolute', bottom: -10, backgroundColor: '#e67e22', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#fff' },
  markerSpeedText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});