# Lagoa Santa - Sistema de Localização Tática

Este projeto é um sistema de rastreamento GPS em tempo real, dividido em duas partes principais: o **Transmissor (Mobile)** usado pelos agentes/viajantes e o **Centro de Comando (Admin)** usado para monitoramento.

## Como Usar o Sistema

O funcionamento do sistema baseia-se numa comunicação simples entre quem transmite a localização e quem a monitora no mapa.

### 1. Instruções para o Viajante (Transmissor)

Acesse a tela principal (`index.html`). Esta interface foi desenhada idealmente para ser usada no celular durante o percurso.

1. **Identificação**: Na tela inicial, insira o seu "Nome de Agente" (ex: Valdineia) e clique em **CONECTAR AO SERVIDOR**.
2. **O Seu Código Único**: O sistema vai gerar um código de 5 caracteres. **Envie ou informe este código para o Administrador** que fará o monitoramento.
3. **Iniciar Transmissão**: Para começar a enviar os dados, clique em **INICIAR TRANSMISSÃO**. O seu celular pedirá permissão para acessar a localização GPS (Latitude, Longitude e Velocidade) — é obrigatório permitir.

### 2. Instruções para o Administrador (Centro de Comando)

Acesso restrito através da página de painel (`admin.html`) para monitorizar as posições no mapa global.

1. **Autenticação**: Faça login usando o seu Email Operacional e Palavra-passe definidos no sistema (Firebase).
2. **Adicionar Viajante**: No painel lateral da tela, localize o campo "Adicionar Radar de Viajante".
3. **Buscar Radar**: Insira o **Código Único** que o viajante lhe enviou e clique no botão de radar (mira cruzada).
4. **Monitorização em Tempo Real**: O dispositivo do viajante será adicionado à lista de "Radares Ativos" e você poderá acompanhar a sua posição, status e velocidade pelo mapa instantaneamente.

---

**⚠️ Notas Importantes:**

* O rastreamento só funciona se a página do Transmissor estiver aberta e com o GPS ativo.
* O sistema depende de conexão contínua com a internet para atualizar as coordenadas em tempo real.
