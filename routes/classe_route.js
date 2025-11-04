import {
  get_classe,
  create_classe,
  update_classe,
  delete_classe,
  get_one_classe,
  count_classe,
} from "../controllers/classe_controller.js";
import { Router } from "express";

const classe_router = Router();

classe_router.route("/").get(get_classe).post(create_classe);
classe_router.route("/count/count").get(count_classe);
classe_router
  .route("/:id")
  .put(update_classe)
  .delete(delete_classe)
  .get(get_one_classe);

export default classe_router;
