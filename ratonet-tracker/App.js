import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar, Image } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
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

export default function App() {
  const [user, setUser] = useState(null);
  const [salaAtiva, setSalaAtiva] = useState(null);
  const [comboio, setComboio] = useState({});

  // --- 1. LOGIN ADMIN ---
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
        role: 'admin'
      });
    } catch (error) {
      Alert.alert("Erro", "Falha no login do Admin.");
    }
  };

  // --- 2. CRIAR SALA ---
  const criarSala = () => {
    const novoCodigo = Math.random().toString(36).substring(2, 7).toUpperCase();
    set(ref(db, `salas/${novoCodigo}`), { criador: user.displayName, data: Date.now() });
    setSalaAtiva(novoCodigo);
    Alert.alert("🟢 SALA CRIADA!", `Código: ${novoCodigo}\n\nEnvie este código aos viajantes.`);
  };

  // --- 3. OUVIR A TELEMETRIA DA SALA ---
  useEffect(() => {
    if (!salaAtiva) return;
    
    const telemetriaRef = ref(db, `telemetria/${salaAtiva}`);
    const unsubscribe = onValue(telemetriaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setComboio(data);
      } else {
        setComboio({});
      }
    });
    
    return () => unsubscribe();
  }, [salaAtiva]);

  // --- TELAS ---
  if (!user) {
    return (
      <View style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.title}>CENTRO DE<Text style={{color: '#fff'}}> COMANDO</Text></Text>
        <Text style={styles.subtitle}>Gestão de Frota</Text>
        <TouchableOpacity style={styles.googleBtn} onPress={signInGoogle}>
          <Ionicons name="logo-google" size={24} color="#fff" />
          <Text style={styles.googleText}> Login Admin</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      <MapView 
        style={styles.map} 
        // Coordenadas iniciais focadas em Morrinhos - GO
        initialRegion={{ latitude: -17.7314, longitude: -49.1009, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
      >
        {/* RENDERIZA OS MARCADORES DE CADA CARRO */}
        {Object.keys(comboio).map((uid) => {
          const carro = comboio[uid];
          
          // PROTEÇÃO: Só mostra no mapa se o carro tiver enviado a latitude e longitude
          if (!carro.latitude || !carro.longitude) return null;

          return (
            <Marker 
              key={uid} 
              coordinate={{ latitude: carro.latitude, longitude: carro.longitude }}
              title={carro.nome}
              description={`${Math.round(carro.speed || 0)} km/h`}
              zIndex={100}
            >
              <View style={styles.carMarker}>
                <Image source={{ uri: carro.foto }} style={styles.driverPic} />
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{carro.nome} - {Math.round(carro.speed || 0)} km/h</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.glassPanel}>
        <View style={styles.adminHeader}>
          <Image source={{uri: user.photoURL}} style={styles.avatar} />
          <Text style={styles.adminName}>Cmdt. {user.displayName.split(' ')[0]}</Text>
        </View>

        {!salaAtiva ? (
          <TouchableOpacity style={styles.createBtn} onPress={criarSala}>
            <Text style={styles.btnText}>🌐 GERAR CÓDIGO DA MISSÃO</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>CÓDIGO ATIVO:</Text>
            <Text style={styles.infoValue}>{salaAtiva}</Text>
            <Text style={styles.veiculosCount}>🚗 {Object.keys(comboio).length} Veículos Conectados</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loginContainer: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: '#e67e22', letterSpacing: 2 },
  subtitle: { color: '#888', marginBottom: 50, letterSpacing: 3 },
  googleBtn: { flexDirection: 'row', backgroundColor: '#e67e22', padding: 15, borderRadius: 10, alignItems: 'center', width: '80%', justifyContent: 'center' },
  googleText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  container: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0a0a0a' },
  map: { ...StyleSheet.absoluteFillObject },
  glassPanel: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: 'rgba(10,10,10,0.95)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#333', elevation: 10 },
  adminHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: '#333', paddingBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15, borderWidth: 2, borderColor: '#e67e22' },
  adminName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  createBtn: { backgroundColor: '#e67e22', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  infoBox: { backgroundColor: '#111', padding: 15, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  infoLabel: { color: '#888', fontSize: 10, letterSpacing: 1 },
  infoValue: { color: '#e67e22', fontSize: 32, fontWeight: '900', letterSpacing: 5 },
  veiculosCount: { color: '#00ffcc', marginTop: 10, fontWeight: 'bold' },
  carMarker: { alignItems: 'center' },
  driverPic: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#fff' },
  tag: { backgroundColor: '#e67e22', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginTop: -5, borderWidth: 1, borderColor: '#fff' },
  tagText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});