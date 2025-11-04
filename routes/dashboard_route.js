import express from "express";
import {
  get_consommable_disponible,
  get_consommable_occupe,
  get_count_materiel_par_service,
  get_materiel_disponible,
  get_materiel_occupe,
} from "../controllers/dashboard_controller.js";

const dashboard_router = express.Router();

dashboard_router.get("/disponibles", get_materiel_disponible);
dashboard_router.get("/occupes", get_materiel_occupe);
dashboard_router.get("/occupe", get_consommable_occupe);
dashboard_router.get("/dispo", get_consommable_disponible);
dashboard_router.get("/mat_par_serv", get_count_materiel_par_service);

export default dashboard_router;
