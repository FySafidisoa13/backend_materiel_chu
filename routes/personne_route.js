import {
  get_personne,
  create_personne,
  update_personne,
  delete_personne,
  get_one_personne,
  count_personne,
} from "../controllers/personne_controller.js";
import { Router } from "express";

const personne_router = Router();

personne_router.route("/").get(get_personne).post(create_personne);
personne_router.route("/count/count").get(count_personne);
personne_router
  .route("/:id")
  .put(update_personne)
  .delete(delete_personne)
  .get(get_one_personne);

export default personne_router;
