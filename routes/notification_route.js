import {
  get_notifications,
  create_notification,
  update_notification,
  delete_notification,
  get_one_notification,
  count_unread_notifications,
} from "../controllers/notification_controller.js";

import { Router } from "express";

const notification_router = Router();

notification_router.route("/").get(get_notifications).post(create_notification);
notification_router.route("/count/count").get(count_unread_notifications);
notification_router
  .route("/:id")
  .put(update_notification)
  .delete(delete_notification)
  .get(get_one_notification);

export default notification_router;
