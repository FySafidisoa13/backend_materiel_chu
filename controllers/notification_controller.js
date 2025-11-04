import { PrismaClient } from "@prisma/client";
import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

// Get all notifications
const get_notifications = asyncHandler(async (req, res, next) => {
    console.log("get notification");
    
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { date: "desc" },
      include: {
        service: true,
        materiel: true,
        consommable: true,
      },
    });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json(error);
  }
});

const get_notification = asyncHandler(async (req, res, next) => {
  console.log("get notification");

  try {
    const { id } = req.params; // id_personne dans l'URL

    if (!id) {
      return res.status(400).json({ message: "id_personne est requis" });
    }

    // Récupérer le compte de la personne
    const compte = await prisma.compte.findUnique({
      where: { id_personne: Number(id) },
      include: {
        personne: true, // pour avoir l'id_service si besoin
      }
    });

    if (!compte) {
      return res.status(404).json({ message: "Compte introuvable" });
    }

    let whereClause = {};
    // Filtrage selon le type de compte
    if (compte.type === "RESPONSABLE" || compte.type === "DIRECTEUR") {
      // ADMIN : voit toutes les notifications destinées à l'admin
      whereClause = {
        destinataireType: "ADMIN"
      };
    } else if (compte.type === "SERVICE" || compte.type === "SERVICE_VUE") {
      // SERVICE : voit seulement les notifications pour son service
      const id_service = compte.personne.id_service;
      if (!id_service) {
        return res.status(400).json({ message: "Ce compte n'est rattaché à aucun service." });
      }
      whereClause = {
        destinataireType: "SERVICE",
        id_service: id_service
      };
    } else {
      return res.status(403).json({ message: "Type de compte non autorisé" });
    }

    // Notifications filtrées
    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
      include: {
        service: true,
        materiel: true,
        consommable: true,
      },
    });

    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Erreur get_notifications:", error);
    return res.status(500).json(error);
  }
});

// Get notification count (unread)
const count_unread_notifications = asyncHandler(async (req, res, next) => {
    
  try {
    const count = await prisma.notification.count({
      where: { is_read: false },
    });
    res.status(200).json(count);
  } catch (error) {
    res.status(500).json(error);
  }
});

// Create a notification
const create_notification = asyncHandler(async (req, res, next) => {
  try {
    const notification = await prisma.notification.create({
      data: { ...req.body },
    });
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json(error);
  }
});

// Delete a notification
const delete_notification = asyncHandler(async (req, res, next) => {
  try {
    const notification = await prisma.notification.delete({
      where: { id_notification: Number(req.params.id) },
    });
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Update a notification (mark as read or update message/type)
const update_notification = asyncHandler(async (req, res, next) => {
  try {
    const notification = await prisma.notification.update({
      data: { ...req.body },
      where: { id_notification: Number(req.params.id) },
    });
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Get one notification by ID
const get_one_notification = asyncHandler(async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id_notification: Number(req.params.id) },
      include: {
        service: true,
        materiel: true,
        consommable: true,
      },
    });
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).send(error);
  }
});

export {
  get_notifications,
  get_notification,
  count_unread_notifications,
  create_notification,
  delete_notification,
  update_notification,
  get_one_notification,
};