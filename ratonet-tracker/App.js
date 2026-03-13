import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { Ionicons } from '@expo/vector-icons';

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

export default function App() {
  const mapRef = useRef(null);
  const [rota, setRota] = useState([]);
  const [currentData, setCurrentData] = useState(null);
  
  const [modoDesenho, setModoDesenho] = useState(false);
  const [rotaPlanejada, setRotaPlanejada] = useState([]);
  const [codigoSala, setCodigoSala] = useState('');

  useEffect(() => {
    if (!codigoSala) {
      setRota([]);
      setCurrentData(null);
      return;
    }
    const rotaRef = ref(db, `telemetria/${codigoSala}/carro1`);
    return onValue(rotaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const path = Object.values(data);
        setRota(path);
        setCurrentData(path[path.length - 1]);
      } else {
        setRota([]);
        setCurrentData(null);
      }
    });
  }, [codigoSala]);

  const criarSala = () => {
    const novoCodigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    setCodigoSala(novoCodigo);
    setRotaPlanejada([]);
    setRota([]);
    setCurrentData(null);
    set(ref(db, `salas/${novoCodigo}`), { criador: 'Admin', ativa: true });
    Alert.alert("Sala Criada!", `Código da Sala: ${novoCodigo}\nPasse isso para o Creta.`);
  };

  const handleMapPress = (e) => {
    if (!modoDesenho) return;
    const novaCoordenada = e.nativeEvent.coordinate;
    const novaRota = [...rotaPlanejada, novaCoordenada];
    setRotaPlanejada(novaRota);
    
    // Salva a rota no Firebase na sala atual
    if (codigoSala) {
      set(ref(db, `salas/${codigoSala}/rotaPlanejada`), novaRota);
    }
  };

  const centerOnCar = () => {
    if (currentData && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentData.latitude,
        longitude: currentData.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ latitude: -17.745, longitude: -49.101, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
        onPress={handleMapPress}
      >
        {rotaPlanejada.length > 0 && (
          <Polyline coordinates={rotaPlanejada} strokeColor="#e67e22" strokeWidth={4} lineDashPattern={[10, 10]} />
        )}
        {rota.length > 0 && <Polyline coordinates={rota} strokeColor="#00ffcc" strokeWidth={6} />}
        
        {currentData && (
          <Marker coordinate={currentData} anchor={{x: 0.5, y: 0.5}}>
            <View style={styles.markerRing}>
              <View style={styles.markerCore} />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.topPanel}>
        <TouchableOpacity style={styles.btnTop} onPress={criarSala}>
          <Text style={styles.btnTopText}>1. CRIAR NOVA SALA</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btnTop, { backgroundColor: modoDesenho ? '#e74c3c' : '#3498db', marginTop: 10 }]} 
          onPress={() => {
            if (!codigoSala) {
              Alert.alert("Atenção", "Crie uma sala primeiro!");
              return;
            }
            setModoDesenho(!modoDesenho);
          }}
        >
          <Text style={styles.btnTopText}>{modoDesenho ? "2. PARAR DE DESENHAR" : "2. DESENHAR ROTA Laranja"}</Text>
        </TouchableOpacity>
        {codigoSala ? (
           <Text style={styles.roomCodeText}>SALA ATIVA: {codigoSala}</Text>
        ) : null}
      </View>

      <View style={styles.glassPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.targetName}>ALVO {codigoSala ? `(SALA ${codigoSala})` : ''}</Text>
          <View style={[styles.statusDot, { backgroundColor: currentData ? '#00ffcc' : '#e74c3c' }]} />
        </View>

        <View style={styles.dataRow}>
          <View>
            <Text style={styles.label}>VELOCIDADE</Text>
            <Text style={styles.value}>{currentData ? Math.round(currentData.speed || 0) : '--'} <Text style={styles.unit}>km/h</Text></Text>
          </View>
          
          <TouchableOpacity style={styles.centerBtn} onPress={centerOnCar}>
            <Ionicons name="locate" size={24} color="#00ffcc" />
            <Text style={{color: '#00ffcc', fontSize: 10, marginTop: 2}}>FOCAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  markerRing: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0, 255, 204, 0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#00ffcc' },
  markerCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#00ffcc' },
  topPanel: { position: 'absolute', top: 50, left: 20, right: 20 },
  btnTop: { backgroundColor: '#1a1a1a', padding: 15, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  btnTopText: { color: '#fff', fontWeight: 'bold' },
  roomCodeText: { color: '#e67e22', textAlign: 'center', marginTop: 10, fontWeight: '900', fontSize: 16, textShadowColor: '#000', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 2 },
  glassPanel: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: 'rgba(10, 10, 10, 0.85)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333' },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#333', paddingBottom: 10, marginBottom: 15 },
  targetName: { color: '#888', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5, shadowColor: '#00ffcc', shadowOpacity: 0.8, shadowRadius: 5 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  label: { color: '#666', fontSize: 10, letterSpacing: 1 },
  value: { color: '#fff', fontSize: 36, fontWeight: '900' },
  unit: { fontSize: 14, color: '#00ffcc' },
  centerBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#333' }
});