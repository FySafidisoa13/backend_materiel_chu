import {
  get_pret,
  create_pret,
  update_pret,
  delete_pret,
  get_one_pret,
  count_pret,
} from "../controllers/pret_controller.js";
import { Router } from "express";

const pret_router = Router();

pret_router.route("/").get(get_pret).post(create_pret);
pret_router.route("/count/count").get(count_pret);
pret_router
  .route("/:id")
  .put(update_pret)
  .delete(delete_pret)
  .get(get_one_pret);

export default pret_router;
