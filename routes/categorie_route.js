import {
  get_categorie,
  create_categorie,
  update_categorie,
  delete_categorie,
  get_one_categorie,
  count_categorie,
} from "../controllers/categorie_controller.js";
import { Router } from "express";

const categorie_router = Router();

categorie_router.route("/").get(get_categorie).post(create_categorie);
categorie_router.route("/count/count").get(count_categorie);
categorie_router
  .route("/:id")
  .put(update_categorie)
  .delete(delete_categorie)
  .get(get_one_categorie);

export default categorie_router;
