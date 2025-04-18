const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para servir arquivos estáticos (como imagens)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static("public"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Página de upload
app.get("/painel", (req, res) => {
  res.send(`
    <h2>Upload de Imagem</h2>
    <form action="/upload" method="POST" enctype="multipart/form-data">
      <input type="file" name="imagem" />
      <button type="submit">Enviar</button>
    </form>
  `);
});

// Upload da imagem
app.post("/upload", upload.single("imagem"), (req, res) => {
  const imageUrl = `${req.protocol}://${req.get("host")}/imagem/${req.file.filename}`;
  res.send(`Imagem enviada! Link: <a href="${imageUrl}">${imageUrl}</a>`);
});

// Quando a imagem for acessada por alguém
app.get("/imagem/:nome", (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // Consulta na API ipapi.co
  https.get(`https://ipapi.co/${ip}/json/`, (apiRes) => {
    let data = "";

    apiRes.on("data", chunk => { data += chunk; });

    apiRes.on("end", () => {
      try {
        const info = JSON.parse(data);
        console.log("🧭 Localização aproximada:");
        console.log(`- IP: ${ip}`);
        console.log(`- Cidade: ${info.city}`);
        console.log(`- Região: ${info.region}`);
        console.log(`- País: ${info.country_name}`);
        console.log(`- Provedor: ${info.org}`);
      } catch (e) {
        console.log("Erro ao parsear dados da localização.");
      }
    });
  }).on("error", () => {
    console.log("Erro ao consultar a localização.");
  });

  const imagemPath = path.join(__dirname, "uploads", req.params.nome);
  if (fs.existsSync(imagemPath)) {
    res.sendFile(imagemPath);
  } else {
    res.status(404).send("Imagem não encontrada");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
