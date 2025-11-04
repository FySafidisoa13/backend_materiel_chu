import express from "express";
import cors from "cors"; 
import categorie_router from "./routes/categorie_route.js";
import classe_router from "./routes/classe_route.js";
import donneur_router from "./routes/donneur_route.js";
import materiel_router from "./routes/materiel_route.js";
import lot_materiel_router from "./routes/lot_materiel_route.js";
import service_router from "./routes/service_route.js";
import personne_router from "./routes/personne_route.js";
import compte_router from "./routes/compte_route.js";
import consommable_router from "./routes/consommable_routes.js";
import lot_consommable_router from "./routes/lot_consommable_routes.js"
import pret_router from "./routes/pret_route.js";
import pret_consommable_router from "./routes/pret_consommable_route.js";
import authentification_routes from "./routes/authentification_routes.js";
import autre_user_materiel_router from "./routes/autre_user_materiel_route.js";
import dashboard_router from "./routes/dashboard_route.js";
import dotenv from "dotenv"; 
import isEpuise_router from "./routes/isEpuise_route.js";
import stock_router from "./routes/stock_route.js";
import inventaire_router from "./routes/inventaire_route.js";
import distribution_router from "./routes/materiel_distribution_route.js";
import standard_routes from "./routes/standard_route.js";
import notification_routes from "./routes/notification_route.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 1303;

app.use(cors()); 
app.use(express.json());

app.use("/api/categorie", categorie_router);
app.use("/api/pret", pret_router);
app.use("/api/pret_consommable", pret_consommable_router);
app.use("/api/classe", classe_router);
app.use("/api/materiel",materiel_router);
app.use("/api/lot",lot_materiel_router);
app.use("/api/compte", compte_router);
app.use("/api/stock", stock_router);
app.use("/api/lot_consommable", lot_consommable_router);
app.use("/api/consommable", consommable_router);
app.use("/api/epuise", isEpuise_router);
app.use("/api/donneur", donneur_router);
app.use("/api/service", service_router);
app.use("/api/login", authentification_routes);
app.use("/api/personne", personne_router);
app.use("/api/inventaire", inventaire_router);
app.use("/api/dash", dashboard_router);
app.use("/api/distribution", distribution_router);
app.use("/api/autre_user_materiel", autre_user_materiel_router);
app.use("/api/standard", standard_routes);
app.use("/api/notification", notification_routes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur démarré sur http://0.0.0.0:${PORT}`);
});
