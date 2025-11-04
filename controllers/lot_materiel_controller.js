import { PrismaClient } from "@prisma/client";
import QRCode from "qrcode";
import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_lot_materiel_by_service = asyncHandler(async (req, res, next) => {
  console.log("get lot_materiel by service");
  const { id } = req.params;

  try {
    const lot_materiel = await prisma.lot_materiels.findMany({
      where: {
        prets: {
          some: {
            id_service: parseInt(id),
          },
        },
      },
      select: {
        id_lot: true,
        etat: true,
        numero: true,
        date_don: true,
        Materiels: {
          select: {
            id_materiel: true,
            nom_materiel: true,
            classe: {
              select: {
                id_classe: true,
                nom_classe: true,
              },
            },
          },
        },
        donneur: {
          select: {
            id_donneur: true,
            nom_donneur: true,
          },
        },
        prets: {
          where: {
            id_service: parseInt(id),
          },
          select: {
            id_pret: true,
            id_service: true,
            date_envoi: true,
            service: {
              select: {
                id_service: true,
                nom_service: true,
              },
            },
          },
        },
      },
    });
    res.status(200).json(lot_materiel);
  } catch (error) {
    res.status(500).json(error);
  }
});

const get_lot_materiel = asyncHandler(async (req, res, next) => {
  
  try {
    const lot_materiel = await prisma.lot_materiels.findMany({
      orderBy: { date_don: 'desc' },
      include: {
        Materiels: {
          select: {
            id_materiel: true,
            nom_materiel: true,
            classe: {
              select: {
                id_classe: true,
                nom_classe: true,
              },
            },
          },
        },
        donneur: {
          select: {
            id_donneur: true,
            nom_donneur: true,
          },
        },
        prets: {
          select: {
            id_pret: true,
            id_service: true,
            date_envoi: true,
            // If you want to include service details, use the correct relation name as per your Prisma schema
            service: {
              select: {
                id_service: true,
                nom_service: true,
              },
            },
          },
        },
      },
    });
    res.status(200).json(lot_materiel);
  } catch (error) {
    res.status(500).json(error);
  }
});
const get_etat_materiel = asyncHandler(async (req, res, next) => {
  console.log("get etat");
  try {
    const lot_materiel = await prisma.lot_materiels.groupBy({
      by: ["etat"],
      _count: {
        etat: true,
      },
    });
    res.status(200).json(lot_materiel);
  } catch (error) {
    res.status(500).json(error);
  }
});
const count_lot_materiel = asyncHandler(async (req, res, next) => {
  try {
    const count_lot_materiel = await prisma.lot_materiels.count();
    res.status(200).json(count_lot_materiel);
  } catch (error) {
    res.status(500).json(error);
  }
});

const count_lot_materiel_par_service = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  console.log("get count lot par service");

  try {
    // Valider que l'ID est un nombre
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "L'ID du service doit être un nombre",
      });
    }

    const count = await prisma.pret.count({
      where: {
        id_service: parseInt(id),
        id_lot: { not: null },
      },
    });

    res.status(200).json({ count: count });
  } catch (error) {
    console.error(
      `Erreur lors du comptage des lots pour le service ${id_service}:`,
      error
    );
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors du comptage des lots matériels",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

const create_lot_materiel = asyncHandler(async (req, res, next) => {
  try {
    // 1. Création du lot sans le QRCode
    const lot_materiel_sans_code = await prisma.lot_materiels.create({
      data: { ...req.body },
    });

    // 2. Récupération du lot avec jointures
    const lot = await prisma.lot_materiels.findUnique({
      where: { id_lot: lot_materiel_sans_code.id_lot },
      include: {
        Materiels: {
          select: {
            id_materiel: true,
            nom_materiel: true,
          },
        },
        donneur: {
          select: {
            id_donneur: true,
            nom_donneur: true,
          },
        },
        prets: {
          select: {
            id_pret: true,
            id_service: true,
            date_envoi: true,
            service: {
              select: {
                id_service: true,
                nom_service: true,
              },
            },
          },
          orderBy: { date_envoi: "desc" },
        },
      },
    });

    const formattedDate = lot.date_don
      ? new Date(lot.date_don).toLocaleDateString("fr-FR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "date inconnue";

    const qrPhrase =
      `MATERIEL CHU ANDRAINJATO\n` +
      `id : ${lot.id_lot}\n` +
      `${lot.Materiels.nom_materiel}  ${lot.numero}\n` +
      `donné par ${lot.donneur.nom_donneur} le ${formattedDate}\n`;

    const qrCodeDataUrl = await QRCode.toDataURL(qrPhrase);

    const updatedLot = await prisma.lot_materiels.update({
      where: { id_lot: lot.id_lot },
      data: { codeQR: qrCodeDataUrl },
    });

    res.status(201).json(updatedLot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const delete_lot_materiel = asyncHandler(async (req, res, next) => {
  const lotId = Number(req.params.id);
  try {
    // 1. Vérifier si le lot existe
    const lot = await prisma.lot_materiels.findUnique({
      where: { id_lot: lotId },
      include: {
        prets: true,
      },
    });

    if (!lot) {
      return res.status(404).json({ error: "Lot non trouvé." });
    }

    // 2. Vérifier s'il y a des prêts actifs (non retournés) sur ce lot
    const pretActif = lot.prets.some((pret) => !pret.date_retour);

    if (pretActif) {
      return res.status(400).json({
        error:
          "Impossible de supprimer: ce matériel est actuellement prêté à un service.",
      });
    }

    // 3. Supprimer le lot s'il n'est pas en prêt
    await prisma.lot_materiels.delete({
      where: { id_lot: lotId },
    });

    return res.status(200).json({ message: "Lot supprimé avec succès." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const update_lot_materiel_admin = asyncHandler(async (req, res, next) => {
  console.log("donné a modifier", req.body, req.params);

  try {
    const lot_materiel = await prisma.lot_materiels.update({
      data: { ...req.body },
      where: { id_lot: Number(req.params.id) },
    });

    res.status(200).json(lot_materiel);
  } catch (error) {
    res.status(500).send(error);
  }
});

const update_lot_materiel = asyncHandler(async (req, res, next) => {
  console.log("reo donné:", req.body);

  try {
    const oldLot = await prisma.lot_materiels.findUnique({
      where: { id_lot: Number(req.params.id) },
      include: {
        Materiels: true,
        prets: true,
      },
    });

    const { etat } = req.body;
    const lot_materiel = await prisma.lot_materiels.update({
      data: { etat },
      where: { id_lot: Number(req.params.id) },
    });
    if (req.body.etat && oldLot.etat !== req.body.etat) {
      let nomService = "";
      if (req.body.id_service) {
        const service = await prisma.service.findUnique({
          where: { id_service: parseInt(req.body.id_service) },
        });
        nomService = service ? service.nom_service : "";
      }
      await prisma.notification.create({
        data: {
          type: "MATERIEL_ETAT_MODIFIE",
          message: `"${oldLot.Materiels.nom_materiel}" (lot #${
            oldLot.numero
          }) a été modifié de 
          "${oldLot.etat}" à "${req.body.etat}" dans le service${
            nomService ? ' "' + nomService + '"' : ""
          }.`,
          id_service: req.body.id_service ?? null,
          id_materiel: oldLot.id_materiel,
          destinataireType: "ADMIN",
          is_read: false,
        },
      });
    }

    res.status(200).json(lot_materiel);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_one_lot_materiel = asyncHandler(async (req, res, next) => {
  try {
    const lot_materiel = await prisma.lot_materiels.findUnique({
      where: { id_lot: Number(req.params.id) },
      include: {
        Materiels: {
          select: {
            id_materiel: true,
            nom_materiel: true,
           
          },
        },
        donneur: {
          select: {
            id_donneur: true,
            nom_donneur: true,
          },
        },
        prets: {
          select: {
            id_pret: true,
            id_service: true,
            date_envoi: true,
            // If you want to include service details, use the correct relation name as per your Prisma schema
            service: {
              select: {
                id_service: true,
                nom_service: true,
              },
            },
          },
        },
      },
    });
    res.status(200).json(lot_materiel);
  } catch (error) {
    res.status(500).send(error);
  }
});
const create_many_lot_materiel = asyncHandler(async (req, res, next) => {
  console.log("create many lot_materiel");
  try {
    const { numero, date_don, id_materiel, id_donneur, quantite } = req.body;

    // 1. Récupérer les informations nécessaires pour le QR code
    const [materiel, donneur] = await Promise.all([
      prisma.materiels.findUnique({
        where: { id_materiel },
        select: { nom_materiel: true },
      }),
      prisma.donneur.findUnique({
        where: { id_donneur },
        select: { nom_donneur: true },
      }),
    ]);

    if (!materiel || !donneur) {
      return res.status(404).json({ error: "Matériel ou donneur introuvable" });
    }

    // Formater la date pour le QR code
    const formattedDate = date_don
      ? new Date(date_don).toLocaleDateString("fr-FR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "date inconnue";

    // 2. Créer les lots en batch
    const createdLots = [];

    for (let i = 1; i <= quantite; i++) {
      // Générer le numéro de lot (A001, A002, etc.)
      const lotNumero = `${numero}${i.toString().padStart(3, "0")}`;

      // Créer le lot sans QR code d'abord
      const newLot = await prisma.lot_materiels.create({
        data: {
          numero: lotNumero,
          date_don: date_don ? new Date(date_don) : new Date(),
          id_materiel,
          id_donneur,
          etat: "BON", // Valeur par défaut
        },
      });

      // Générer le QR code
      const qrPhrase =
        `MATERIEL CHU ANDRAINJATO\n` +
        `id : ${newLot.id_lot}\n` +
        `${materiel.nom_materiel}  ${lotNumero}\n` +
        `donné par ${donneur.nom_donneur} le ${formattedDate}\n`;

      const qrCodeDataUrl = await QRCode.toDataURL(qrPhrase);

      // Mettre à jour le lot avec le QR code
      const updatedLot = await prisma.lot_materiels.update({
        where: { id_lot: newLot.id_lot },
        data: { codeQR: qrCodeDataUrl },
        include: {
          Materiels: {
            select: {
              id_materiel: true,
              nom_materiel: true,
              
            },
          },
          donneur: {
            select: {
              id_donneur: true,
              nom_donneur: true,
            },
          },
          prets: {
            select: {
              id_pret: true,
              id_service: true,
              date_envoi: true,
              service: {
                select: {
                  id_service: true,
                  nom_service: true,
                },
              },
            },
            orderBy: { date_envoi: "desc" },
          },
        },
      });

      createdLots.push(updatedLot);
    }

    res.status(201).json(createdLots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export {
  get_lot_materiel,
  get_etat_materiel,
  count_lot_materiel,
  delete_lot_materiel,
  create_many_lot_materiel,
  update_lot_materiel,
  create_lot_materiel,
  get_one_lot_materiel,
  get_lot_materiel_by_service,
  count_lot_materiel_par_service,
  update_lot_materiel_admin,
};
