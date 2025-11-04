import {
  get_pret_consommable,
  create_pret_consommable,
  update_pret_consommable,
  delete_pret_consommable,
  get_one_pret_consommable,
  count_pret_consommable,
} from "../controllers/pret_consommable_controller.js";
import { Router } from "express";

const pret_consommable_router = Router();

pret_consommable_router.route("/").get(get_pret_consommable).post(create_pret_consommable);
pret_consommable_router.route("/count/count").get(count_pret_consommable);
pret_consommable_router
  .route("/:id")
  .put(update_pret_consommable)
  .delete(delete_pret_consommable)
  .get(get_one_pret_consommable);

export default pret_consommable_router;
