import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_pret = asyncHandler(async (req, res, next) => {
  try {
    const prets = await prisma.pret.findMany({
      orderBy: { date_envoi: "desc" },
      where: {
        id_lot: { not: null },
      },
      include: {
        service: {
          select: {
            id_service: true,
            nom_service: true,
          },
        },
        lot_materiels: {
          select: {
            id_lot: true,
            id_materiel: true,
            numero: true,
            Materiels: {
              select: {
                id_materiel: true,
                nom_materiel: true,
              },
            },
          },
        },
      },
    });
    res.status(200).json(prets);
  } catch (error) {
    res.status(500).json(error);
  }
});
const count_pret = asyncHandler(async (req, res, next) => {
  try {
    const count_pret = await prisma.pret.count();
    res.status(200).json(count_pret);
  } catch (error) {
    res.status(500).json(error);
  }
});

const create_pret = asyncHandler(async (req, res, next) => {
  try {
    // Création du prêt avec les bonnes relations
    const pret = await prisma.pret.create({
      data: { ...req.body },
      include: {
        service: true,
        lot_materiels: {
          include: {
            Materiels: true, // Permet d'accéder au nom du matériel via le lot
          },
        },
      },
    });

    // Récupération des infos pour le message
    let message = "";
    if (pret.lot_materiels?.Materiels) {
      // Nombre de lots pour ce matériel et ce service
      const nombre_lots = await prisma.pret.count({
        where: {
          id_service: pret.id_service,
          id_lot: pret.id_lot,
        },
      });
      const nomMateriel = pret.lot_materiels.Materiels.nom_materiel.toUpperCase();
      message = `Nous avons reçu ${nombre_lots} ${nomMateriel}${nombre_lots > 1 ? "S" : ""}.`;
    } else {
      message = `Nous avons reçu un nouveau prêt.`;
    }

    // Création de la notification pour le service
    await prisma.notification.create({
      data: {
        type: "MATERIEL_ENVOYE",
        message,
        id_service: pret.id_service,
        id_materiel: pret.lot_materiels?.Materiels?.id_materiel,
        destinataireType: "SERVICE",
        is_read: false,
      },
    });

    res.status(200).json(pret);
  } catch (error) {
    console.error("Erreur création prêt :", error);
    res.status(500).json({ error: error.message ?? error });
  }
});

const delete_pret = asyncHandler(async (req, res, next) => {
  try {
    // 1️⃣ Récupérer le prêt avant suppression (inclure les relations nécessaires)
    const pretAvant = await prisma.pret.findUnique({
      where: { id_pret: Number(req.params.id) },
      include: {
        service: true,
        lot_materiels: {
          include: {
            Materiels: true
          }
        }
      }
    });

    if (!pretAvant) {
      return res.status(404).json({ error: "Prêt non trouvé." });
    }

    // 2️⃣ Supprimer le prêt
    const pret = await prisma.pret.delete({
      where: { id_pret: Number(req.params.id) },
    });

    // 3️⃣ Construire le message (toujours 1 lot supprimé ici)
    const nomMateriel = pretAvant.lot_materiels?.Materiels?.nom_materiel?.toUpperCase() ?? "MATERIEL";
    const nombre_lots = 1;

    // 4️⃣ Créer la notification MATERIEL_RETIRE
    await prisma.notification.create({
      data: {
        type: "MATERIEL_RETIRE",
        message: `${nombre_lots} ${nomMateriel} a été retiré dans notre service.`,
        id_service: pretAvant.service?.id_service,
        id_materiel: pretAvant.lot_materiels?.Materiels?.id_materiel,
        destinataireType: "SERVICE",
        is_read: false,
      },
    });

    res.status(200).json(pret);
  } catch (error) {
    console.error("Erreur delete_pret :", error);
    res.status(500).send(error);
  }
});

const update_pret = asyncHandler(async (req, res, next) => {
  try {
    // Mettre à jour le prêt et inclure les relations nécessaires
    const pret = await prisma.pret.update({
      data: { ...req.body },
      where: { id_pret: Number(req.params.id) },
      include: {
        service: true,
        lot_materiels: {
          include: {
            Materiels: true
          }
        }
      }
    });

    // Récupérer le nom du matériel
    const nomMateriel = pret.lot_materiels?.Materiels?.nom_materiel?.toUpperCase() ?? "MATERIEL";

    // Nombre de lots pour ce matériel et ce service (optionnel, ici on met 1 car update d'un seul prêt)
    const nombre_lots = 1;

    // 1️⃣ Notification MATERIEL_RETIRE (pour l'admin)
    await prisma.notification.create({
      data: {
        type: "MATERIEL_RETIRE",
        message: `${nombre_lots} ${nomMateriel} a été retiré dans notre service.`,
        id_service: pret.service?.id_service,
        id_materiel: pret.lot_materiels?.Materiels?.id_materiel,
        destinataireType: "SERVICE",
        is_read: false,
      },
    });

    // 2️⃣ Notification MATERIEL_ENVOYE (pour le service concerné)
    await prisma.notification.create({
      data: {
        type: "MATERIEL_ENVOYE",
        message: `Nous avons reçu ${nombre_lots} ${nomMateriel}.`,
        id_service: pret.service?.id_service,
        id_materiel: pret.lot_materiels?.Materiels?.id_materiel,
        destinataireType: "SERVICE",
        is_read: false,
      },
    });

    res.status(200).json(pret);
  } catch (error) {
    console.error("Erreur update_pret :", error);
    res.status(500).send(error);
  }
});

const get_one_pret = asyncHandler(async (req, res, next) => {
  try {
    const pret = await prisma.pret.findUnique({
      where: { id_pret: Number(req.params.id) },
      include: {
        service: {
          select: {
            id_service: true,
            nom_service: true,
          },
        },

        lot_materiels: {
          select: {
            id_lot: true,
            id_materiel: true,
            numero: true,
            Materiels: {
              select: {
                id_materiel: true,
                nom_materiel: true,
              },
            },
          },
        },
      },
    });
    res.status(200).json(pret);
  } catch (error) {
    res.status(500).send(error);
  }
});

export {
  get_pret,
  count_pret,
  delete_pret,
  update_pret,
  create_pret,
  get_one_pret,
};
