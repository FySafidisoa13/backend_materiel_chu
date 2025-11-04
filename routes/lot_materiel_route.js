import {
  get_lot_materiel,
  create_lot_materiel,
  update_lot_materiel,
  delete_lot_materiel,
  get_one_lot_materiel,
  get_etat_materiel,
  count_lot_materiel,
} from "../controllers/lot_materiel_controller.js";
import { Router } from "express";

const lot_materiel_router = Router();

lot_materiel_router.route("/").get(get_lot_materiel).post(create_lot_materiel);
lot_materiel_router.route("/count/count").get(count_lot_materiel);
lot_materiel_router.route("/count/count/etat/").get(get_etat_materiel);
lot_materiel_router
  .route("/:id")
  .put(update_lot_materiel)
  .delete(delete_lot_materiel)
  .get(get_one_lot_materiel);

export default lot_materiel_router;
