import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, StatusBar, Image, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

// AS SUAS CHAVES DO FIREBASE (Intactas)
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

export default function App() {
  const [user, setUser] = useState(null);
  const [salaAtiva, setSalaAtiva] = useState(null);
  const [comboio, setComboio] = useState({});
  
  // Estados para o novo Login por E-mail
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  // --- 1. LOGIN POR E-MAIL E SENHA ---
  const handleAuth = async () => {
    if (!email || !password) {
      return Alert.alert("Atenção", "Preencha o e-mail e a senha.");
    }

    try {
      let userCred;
      if (isLoginMode) {
        // ENTRAR
        userCred = await signInWithEmailAndPassword(auth, email, password);
      } else {
        // REGISTAR NOVA CONTA
        userCred = await createUserWithEmailAndPassword(auth, email, password);
        // Salva os dados básicos do Admin no banco de dados
        set(ref(db, `usuarios/${userCred.user.uid}`), {
          nome: email.split('@')[0], // Pega o nome antes do @
          role: 'admin'
        });
        Alert.alert("Sucesso!", "Conta de Comandante criada com sucesso!");
      }
      setUser(userCred.user);
    } catch (error) {
      console.log("Erro de Autenticação:", error);
      let mensagem = "Falha na autenticação.";
      if (error.code === 'auth/invalid-email') mensagem = "E-mail inválido.";
      if (error.code === 'auth/user-not-found') mensagem = "Utilizador não encontrado. Registe-se primeiro.";
      if (error.code === 'auth/wrong-password') mensagem = "Senha incorreta.";
      if (error.code === 'auth/email-already-in-use') mensagem = "Este e-mail já está em uso.";
      Alert.alert("Erro", mensagem);
    }
  };

  // --- 2. CRIAR SALA ---
  const criarSala = () => {
    const novoCodigo = Math.random().toString(36).substring(2, 7).toUpperCase();
    const nomeExibicao = user.email.split('@')[0].toUpperCase();
    
    set(ref(db, `salas/${novoCodigo}`), { criador: nomeExibicao, data: Date.now() });
    setSalaAtiva(novoCodigo);
    Alert.alert("🟢 SALA CRIADA!", `Código: ${novoCodigo}\n\nEnvie este código aos viajantes.`);
  };

  // --- 3. OUVIR A TELEMETRIA ---
  useEffect(() => {
    if (!salaAtiva) return;
    const telemetriaRef = ref(db, `telemetria/${salaAtiva}`);
    const unsubscribe = onValue(telemetriaRef, (snapshot) => {
      if (snapshot.val()) setComboio(snapshot.val());
    });
    return () => unsubscribe();
  }, [salaAtiva]);

  // Avatar gerador automático (já que não temos a foto do Google)
  const avatarUrl = `https://ui-avatars.com/api/?name=${user?.email || 'Admin'}&background=e67e22&color=fff`;

  // --- TELAS ---
  if (!user) {
    return (
      <View style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.title}>CENTRO DE<Text style={{color: '#fff'}}> COMANDO</Text></Text>
        <Text style={styles.subtitle}>Gestão de Frota</Text>
        
        <View style={styles.formContainer}>
          <TextInput 
            style={styles.input} 
            placeholder="E-mail" 
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput 
            style={styles.input} 
            placeholder="Senha" 
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          
          <TouchableOpacity style={styles.authBtn} onPress={handleAuth}>
            <Text style={styles.authBtnText}>{isLoginMode ? "ENTRAR NO RADAR" : "CRIAR CONTA ADMIN"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)} style={{marginTop: 20}}>
            <Text style={styles.toggleText}>
              {isLoginMode ? "Não tem conta? Toque para Registar" : "Já tem conta? Toque para Entrar"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      <MapView style={styles.map} initialRegion={{ latitude: -17.745, longitude: -49.101, latitudeDelta: 0.5, longitudeDelta: 0.5 }}>
        {Object.keys(comboio).map((uid) => {
          const carro = comboio[uid];
          return (
            <Marker key={uid} coordinate={{ latitude: carro.latitude, longitude: carro.longitude }} zIndex={100}>
              <View style={styles.carMarker}>
                <Image source={{ uri: carro.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} style={styles.driverPic} />
                <View style={styles.tag}><Text style={styles.tagText}>{carro.nome} - {Math.round(carro.speed)} km/h</Text></View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.glassPanel}>
        <View style={styles.adminHeader}>
          <Image source={{uri: avatarUrl}} style={styles.avatar} />
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
            <Text style={styles.veiculosCount}>🚗 {Object.keys(comboio).length} Veículos Conectados</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loginContainer: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#e67e22', letterSpacing: 2 },
  subtitle: { color: '#888', marginBottom: 40, letterSpacing: 3 },
  formContainer: { width: '100%', backgroundColor: '#111', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
  input: { backgroundColor: '#000', color: '#fff', fontSize: 16, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginBottom: 15 },
  authBtn: { backgroundColor: '#e67e22', padding: 15, borderRadius: 10, alignItems: 'center' },
  authBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  toggleText: { color: '#e67e22', textAlign: 'center', fontSize: 14, fontWeight: 'bold' },
  container: { flex: 1 },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  glassPanel: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: 'rgba(10,10,10,0.95)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#333', elevation: 10 },
  adminHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: '#333', paddingBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15, borderWidth: 2, borderColor: '#e67e22' },
  adminName: { color: '#fff', fontSize: 18, fontWeight: 'bold', textTransform: 'capitalize' },
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