import {
  get_consommable,
  create_consommable,
  update_consommable,
  delete_consommable,
  get_one_consommable,
  count_consommable,
} from "../controllers/consommable_controller.js";
import { Router } from "express";

const consommable_router = Router();

consommable_router.route("/").get(get_consommable).post(create_consommable);
consommable_router.route("/count/count").get(count_consommable);
consommable_router
  .route("/:id")
  .put(update_consommable)
  .delete(delete_consommable)
  .get(get_one_consommable);

export default consommable_router;
