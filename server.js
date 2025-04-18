const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const geoip = require('geoip-lite');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

// Upload config
const upload = multer({ dest: 'public/uploads' });
const acessos = [];

// Página painel com mapa + upload
app.get('/painel', (req, res) => {
  const uploadId = req.query.upload;
  let lista = acessos.map(a => `
    <tr>
      <td>${a.data}</td>
      <td>${a.ip}</td>
      <td>${a.cidade}</td>
      <td>${a.pais}</td>
      <td>${a.coords.join(', ')}</td>
    </tr>
  `).join('');

  res.send(`
    <html>
      <head>
        <title>Painel de Rastreamento</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          #map { height: 400px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <h2>Painel de Rastreamento</h2>

        <form method="POST" enctype="multipart/form-data" action="/upload">
          <input type="file" name="imagem" required />
          <button type="submit">Enviar imagem</button>
        </form>

        ${uploadId ? `<p><strong>Link gerado:</strong> <a href="/imagem/${uploadId}" target="_blank">/imagem/${uploadId}</a></p>` : ''}

        <table>
          <tr>
            <th>Data</th><th>IP</th><th>Cidade</th><th>País</th><th>Coordenadas</th>
          </tr>
          ${lista}
        </table>

        <div id="map"></div>

        <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
        <script>
          const acessos = ${JSON.stringify(acessos)};
          const map = L.map('map').setView([-15, -55], 3);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data © OpenStreetMap'
          }).addTo(map);
          acessos.forEach(a => {
            if (a.coords.length) {
              L.marker(a.coords).addTo(map).bindPopup(\`\${a.cidade}, \${a.pais}<br>\${a.ip}\`);
            }
          });
        </script>
      </body>
    </html>
  `);
});

// Upload de imagem
app.post('/upload', upload.single('imagem'), (req, res) => {
  const novoNome = `img_${Date.now()}.jpg`;
  const destino = path.join(__dirname, 'public/uploads', novoNome);
  fs.renameSync(req.file.path, destino);
  res.redirect(`/painel?upload=${novoNome}`);
});

// Página de imagem rastreável
app.get('/imagem/:id', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /facebookexternalhit|Instagram|WhatsApp|twitterbot|discordbot|bot|crawler/i.test(userAgent);

  // Bloqueia bots
  if (isBot) {
    return res.status(403).send('Acesso negado');
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip);
  const acesso = {
    id: req.params.id,
    data: new Date().toISOString(),
    ip,
    cidade: geo?.city || 'Desconhecida',
    pais: geo?.country || 'Desconhecido',
    coords: geo?.ll || []
  };

  acessos.push(acesso);
  console.log('Novo acesso:', acesso);

  const imgPath = path.join(__dirname, 'public/uploads', req.params.id);
  if (fs.existsSync(imgPath)) {
    // Força o download em vez de exibir diretamente
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${req.params.id}"`);
    fs.createReadStream(imgPath).pipe(res);
  } else {
    res.status(404).send('Imagem não encontrada');
  }
});

// Inicializa servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
