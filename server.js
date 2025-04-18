const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.json());

// Banco de dados simples
const dbPath = "./data.json";
let acessos = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath)) : [];

// Salva no banco
function registrarAcesso(dado) {
  acessos.push(dado);
  fs.writeFileSync(dbPath, JSON.stringify(acessos, null, 2));
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const nome = Date.now() + "-" + file.originalname;
    cb(null, nome);
  }
});

const upload = multer({ storage });

// Página de upload
app.get("/painel", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "painel.html"));
});

app.post("/upload", upload.single("imagem"), (req, res) => {
  const link = `${req.protocol}://${req.get("host")}/imagem/${req.file.filename}`;
  res.send(`<p>Imagem enviada com sucesso!</p><p><a href="${link}" target="_blank">${link}</a></p>`);
});

// Quando acessam a imagem
app.get("/imagem/:nome", (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const nome = req.params.nome;
  const imagemPath = path.join(__dirname, "uploads", nome);

  if (!fs.existsSync(imagemPath)) {
    return res.status(404).send("Imagem não encontrada");
  }

  // Geo API
  https.get(`https://ipapi.co/${ip}/json/`, (apiRes) => {
    let dados = "";

    apiRes.on("data", chunk => dados += chunk);
    apiRes.on("end", () => {
      try {
        const info = JSON.parse(dados);
        registrarAcesso({
          imagem: nome,
          ip,
          cidade: info.city,
          estado: info.region,
          pais: info.country_name,
          provedor: info.org,
          data: new Date().toISOString()
        });
      } catch (err) {
        console.error("Erro ao processar geoIP");
      }
    });
  });

  res.sendFile(imagemPath);
});

// API para o painel
app.get("/api/acessos", (req, res) => {
  res.json(acessos.reverse()); // mais recentes primeiro
});

app.listen(PORT, () => {
  console.log(`✅ Painel rodando em http://localhost:${PORT}/painel`);
});
