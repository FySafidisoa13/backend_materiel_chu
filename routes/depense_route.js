import {
  get_resume_mensuel_service,
  get_stats_global_mensuel,
  get_historique_consommables_service,
  get_rapport_consommables_par_service_auto,
  get_top_consommables_service,
} from "../controllers/depense.js";

import { Router } from "express";
const depense_router = Router();

depense_router.route("/get_resume_mensuel_service").get(get_resume_mensuel_service);
depense_router.route("/get_rapport_consommables_par_service_auto/:serviceId").get(get_rapport_consommables_par_service_auto);
depense_router.route("/get_stats_global_mensuel").get(get_stats_global_mensuel);
depense_router
  .route("/get_historique_consommables_service")
  .get(get_historique_consommables_service);
depense_router
  .route("/get_top_consommables_service")
  .get(get_top_consommables_service);
export default depense_router;
