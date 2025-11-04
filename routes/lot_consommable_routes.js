import {
  get_lot_consommable,
  create_lot_consommable,
  update_lot_consommable,
  delete_lot_consommable,
  get_one_lot_consommable,
  count_lot_consommable,
} from "../controllers/lot_consommable_controller.js";
import { Router } from "express";

const lot_consommable_router = Router();

lot_consommable_router.route("/").get(get_lot_consommable).post(create_lot_consommable);
lot_consommable_router.route("/count/count").get(count_lot_consommable);
lot_consommable_router
  .route("/:id")
  .put(update_lot_consommable)
  .delete(delete_lot_consommable)
  .get(get_one_lot_consommable);

export default lot_consommable_router;
