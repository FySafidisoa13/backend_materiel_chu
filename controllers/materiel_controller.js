import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_materiel_distribution = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Récupérer le matériel spécifique avec ses lots et prêts
    const materiel = await prisma.materiels.findUnique({
      where: {
        id_materiel: parseInt(id),
      },
      include: {
        lot_materiels: {
          include: {
            prets: {
              include: {
                service: {
                  select: {
                    nom_service: true,
                  },
                },
              },
              orderBy: {
                date_envoi: "desc", // On trie par date descendante pour avoir le prêt le plus récent en premier
              },
            },
          },
        },
      },
    });

    if (!materiel) {
      return res.status(404).json({ error: "Matériel non trouvé" });
    }

    // 2. Traiter les données pour obtenir la répartition
    const result = {
      materiel: materiel.nom_materiel,
      total: materiel.lot_materiels.length,
      enStock: 0,
      services: {},
    };

    materiel.lot_materiels.forEach((lot) => {
      // On prend le premier prêt (le plus récent grâce au tri)
      const dernierPret = lot.prets[0];

      if (dernierPret && dernierPret.service) {
        const serviceName = dernierPret.service.nom_service;
        result.services[serviceName] = (result.services[serviceName] || 0) + 1;
      } else {
        result.enStock++;
      }
    });

    // 3. Formater la réponse
    const formattedResult = {
      ...result,
      services: Object.entries(result.services).map(([service, count]) => ({
        service,
        count,
      })),
    };

    res.status(200).json(formattedResult);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Une erreur est survenue lors de la récupération des données",
    });
  }
});

const get_materiel = asyncHandler(async (req, res, next) => {
  console.log("get materiel");
  try {
    const materiel = await prisma.materiels.findMany({
      include: {
        classe: {
          select: {
            nom_classe: true,
          },
        },
        _count: {
          select: {
            lot_materiels: true,
          },
        },
      },
    });
    res.status(200).json(materiel);
  } catch (error) {
    res.status(500).json(error);
  }
});
const get_qr_code_lot_materiel = asyncHandler(async (req, res, next) => {
  // Récupération de l'id_materiel depuis les params de la requête
  const id_materiel = req.params.id;

  // Sécurité : Vérification de la présence de l'id
  if (!id_materiel) {
    return res.status(400).json({ message: "id_materiel manquant" });
  }

  try {
    // Récupération des lots pour ce matériel
    const lots = await prisma.lot_materiels.findMany({
      where: {
        id_materiel: Number(id_materiel)
      },
      select: {
        id_lot: true,
        numero: true,
        codeQR: true,
        date_don: true,
        Materiels: {
          select: {
            nom_materiel: true
          }
        },
        donneur: {
          select:{
            nom_donneur: true,
          }
        }
      },
    });

    // Compte du nombre de lots pour ce matériel
    const nombre_lot = await prisma.lot_materiels.count({
      where: { id_materiel: Number(id_materiel) }
    });

    // Préparation de la réponse
    res.status(200).json({
      lots: lots.map(lot => ({
        id_lot: lot.id_lot,
        qr_code: lot.codeQR,
        numero: lot.numero,
        date_don: lot.date_don,
        nom_materiel: lot.Materiels.nom_materiel,
        nom_donneur: lot.donneur.nom_donneur || "Inconnu"
        
      })),
      nombre_lot,
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
});
const count_materiel = asyncHandler(async (req, res, next) => {
  try {
    const count_materiel = await prisma.materiels.count();
    res.status(200).json(count_materiel);
  } catch (error) {
    res.status(500).json(error);
  }
});

const create_materiel = asyncHandler(async (req, res, next) => {
  try {
    const materiel = await prisma.materiels.create({
      data: { ...req.body },
    });
    res.status(200).json(materiel);
  } catch (error) {
    res.status(500).json(error);
  }
});
const delete_materiel = asyncHandler(async (req, res, next) => {
  try {
    const materiel = await prisma.materiels.delete({
      where: { id_materiel: Number(req.params.id) },
    });
    res.status(200).json(materiel);
  } catch (error) {
    res.status(500).send(error);
  }
});
const update_materiel = asyncHandler(async (req, res, next) => {
  try {
    const materiel = await prisma.materiels.update({
      data: { ...req.body },
      where: { id_materiel: Number(req.params.id) },
    });

    res.status(200).json(materiel);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_one_materiel = asyncHandler(async (req, res, next) => {
  try {
    const materiel = await prisma.materiels.findUnique({
      where: { id_materiel: Number(req.params.id) },
    });
    res.status(200).json(materiel);
  } catch (error) {
    res.status(500).send(error);
  }
});

const envoi_plusieur_materiel = asyncHandler(async (req, res, next) => {
  const { id_service, id_materiel, nombre_lots } = req.body;

  if (!id_service || !id_materiel || !nombre_lots) {
    return res.status(400).json({
      status: 400,
      message: "Veuillez fournir id_service, id_materiel et nombre_lots.",
    });
  }

  // 1️⃣ Prendre TOUS les lots pour ce matériel
  let lots = await prisma.lot_materiels.findMany({
    where: { id_materiel: id_materiel },
  });

  if (lots.length === 0) {
    return res.status(404).json({
      status: 404,
      message: "Aucun lot trouvé pour ce matériel.",
    });
  }

  // 2️⃣ Filtrer ceux déjà dans Pret
  const lotsDisponibles = [];
  for (const lot of lots) {
    const existeDeja = await prisma.pret.findFirst({
      where: { id_lot: lot.id_lot },
    });
    if (!existeDeja) {
      lotsDisponibles.push(lot);
    }
  }

  // 3️⃣ Vérifier si quantité OK
  if (lotsDisponibles.length < nombre_lots) {
    return res.status(400).json({
      status: 400,
      lotsDisponibles: lotsDisponibles.length,
      message: `Pas assez de lots disponibles : ${lotsDisponibles.length} disponible(s) seulement.`,
    });
  }

  // 4️⃣ Mélanger & prendre le nombre demandé
  const lotsMelanges = lotsDisponibles.sort(() => 0.5 - Math.random());
  const lotsSelectionnes = lotsMelanges.slice(0, nombre_lots);

  // 5️⃣ Créer les prêts
  const pretsCrees = await Promise.all(
    lotsSelectionnes.map((lot) =>
      prisma.pret.create({
        data: {
          id_service: id_service,
          id_lot: lot.id_lot,
          date_envoi: new Date(),
        },
      })
    )
  );

  // 6️⃣ Récupérer le nom du matériel pour le message
  const materiel = await prisma.materiels.findUnique({
    where: { id_materiel: id_materiel }
  });
  const nomMateriel = materiel?.nom_materiel ?? "Matériel";

  // 7️⃣ Créer la notification pour le service
  await prisma.notification.create({
    data: {
      type: "MATERIEL_ENVOYE",
      message: `Nous avons reçu ${pretsCrees.length} ${nomMateriel.toUpperCase()}${pretsCrees.length > 1 ? "S" : ""}.`,
      id_service: id_service,
      id_materiel: id_materiel,
      destinataireType: "SERVICE",
      is_read: false,
    }
  });
  return res.status(201).json({
    status: 201,
    message: `${pretsCrees.length} lots envoyés au service.`,
    prets: pretsCrees,
  });
});

const get_materiel_disponnible = asyncHandler(async (req, res, next) => {
  try {
    // 1. Récupérer tous les matériels avec leurs lots
    const materiels = await prisma.materiels.findMany({
      select: {
        id_materiel: true,
        nom_materiel: true,
        lot_materiels: {
          select: {
            id_lot: true,
            prets: {
              where: {
                date_retour: null // Seuls les prêts non retournés
              },
              select: {
                id_pret: true
              }
            }
          }
        }
      }
    });

    // 2. Calculer la quantité disponible pour chaque matériel
    const result = materiels.map(materiel => {
      const quantiteTotale = materiel.lot_materiels.length;
      const quantitePretee = materiel.lot_materiels.reduce(
        (total, lot) => total + (lot.prets.length > 0 ? 1 : 0), 0);
      
      return {
        id_materiel: materiel.id_materiel,
        nom_materiel: materiel.nom_materiel,
        quantite: quantiteTotale - quantitePretee
      };
    });

    // 3. Filtrer pour ne garder que les matériels avec quantité > 0
    const materielsDisponibles = result.filter(item => item.quantite > 0);

    res.status(200).json(materielsDisponibles);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export {
  get_materiel,
  count_materiel,
  delete_materiel,
  update_materiel,
  get_materiel_distribution,
  create_materiel,
  get_one_materiel,
  get_materiel_disponnible,
  get_qr_code_lot_materiel,
  envoi_plusieur_materiel,
};
