
import { Router } from "express";
import { envoi_plusieur_materiel, get_materiel_disponnible, get_qr_code_lot_materiel } from "../controllers/materiel_controller.js";
import { count_lot_materiel_par_service, create_many_lot_materiel, get_lot_materiel_by_service } from "../controllers/lot_materiel_controller.js";
import { get_stats_materiels_par_etat, get_stats_materiels_par_etat_par_service } from "../controllers/dashboard_controller.js";
import { get_consommables_par_service } from "../controllers/pret_consommable_controller.js";
import { get_count_personnes_du_meme_service, get_personnes_du_meme_service } from "../controllers/personne_controller.js";
import { get_classe_by_service } from "../controllers/classe_controller.js";
import { update_lot_materiel_admin } from "../controllers/lot_materiel_controller.js";
import {
  get_notification,
} from "../controllers/notification_controller.js";
import { check_type_compte, checkCodeRecuperation, hasResponsableCompte, login2, resetPassword, update_type_compte } from "../controllers/compte_controller.js";

const standard_routes = Router();

standard_routes.route("/envoi_plusieur_materiel").post(envoi_plusieur_materiel);
standard_routes.route("/hasResponsableCompte").get(hasResponsableCompte);
standard_routes.route("/create_many_lot_materiel").post(create_many_lot_materiel);
standard_routes.route("/get_materiel_disponnible").get(get_materiel_disponnible);
standard_routes.route("/get_qr_code_lot_materiel/:id").get(get_qr_code_lot_materiel);
standard_routes.route("/get_stats_materiels_par_etat/:id").get(get_stats_materiels_par_etat);
standard_routes.route("/get_stats_materiels_par_etat_par_service/:id").get(get_stats_materiels_par_etat_par_service);
standard_routes.route("/get_consommables_par_service/:id").get(get_consommables_par_service);
standard_routes.route("/get_personnes_du_meme_service/:id").get(get_personnes_du_meme_service);
standard_routes.route("/get_classe_by_service/:id").get(get_classe_by_service);
standard_routes.route("/get_count_personnes_du_meme_service/:id").get(get_count_personnes_du_meme_service);
standard_routes.route("/count_lot_materiel_par_service/:id").get(count_lot_materiel_par_service);
standard_routes.route("/get_lot_materiel_by_service/:id").get(get_lot_materiel_by_service);
standard_routes.route("/get_notification/:id").get(get_notification);
standard_routes.route("/update_lot_materiel_admin/:id").put(update_lot_materiel_admin);
standard_routes.route("/login2").post(login2);
standard_routes.route("/checkCodeRecuperation").post(checkCodeRecuperation);
standard_routes.route("/resetPassword").post(resetPassword);
standard_routes.route("/update_type_compte").post(update_type_compte);
standard_routes.route("/check_type_compte").post(check_type_compte);


export default standard_routes;
