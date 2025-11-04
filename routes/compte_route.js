import {
  get_compte,
  create_compte,
  update_compte,
  delete_compte,
  get_one_compte,
  login,
  count_compte,
} from "../controllers/compte_controller.js";
import { Router } from "express";

const compte_router = Router();

compte_router.route("/").get(get_compte).post(create_compte);
compte_router.route("").post(login);
compte_router.route("/count/count").get(count_compte);
compte_router
  .route("/:id")
  .put(update_compte)
  .delete(delete_compte)
  .get(get_one_compte);

export default compte_router;
