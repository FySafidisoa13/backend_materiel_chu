import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_lot_consommable = asyncHandler(async (req, res, next) => {
  console.log("get lot_consommable");
  try {
    const lot_consommable = await prisma.lot_consommable.findMany({
      orderBy: { date_don_consommable: 'desc' },
      include: {
        consommable: {
          select: {
            nom_consommable: true,
            id_consommable: true,
          },
        },
        donneur: {
          select: {
            id_donneur: true,
            nom_donneur: true,
          },
        },
      },
      orderBy: {
        date_don_consommable: 'desc' // Remplacez par le nom de votre champ date
      }
    });
    res.status(200).json(lot_consommable);
  } catch (error) {
    res.status(500).json(error);
  }
});

const count_lot_consommable = asyncHandler(async (req, res, next) => {
  console.log("count lot_consommable");

  try {
    const count_lot_consommable = await prisma.lot_consommable.count();
    res.status(200).json(count_lot_consommable);
  } catch (error) {
    res.status(500).json(error);
  }
});

// const create_lot_consommable = asyncHandler(async (req, res, next) => {
//   try {
//     const { quantite_don, id_consommable, ...otherFields } = req.body;

//     // Création du lot_consommable
//     const lot_consommable = await prisma.lot_consommable.create({
//       data: {
//         quantite_don,
//         id_consommable,
//         ...otherFields,
//       },
//     });

//     // Récupérer la quantité actuelle du consommable
//     const consommable = await prisma.consommable.findUnique({
//       where: { id_consommable: Number(id_consommable) },
//     });

//     if (!consommable) {
//       return res.status(404).json({ message: "Consommable non trouvé" });
//     }

//     // Si la quantité actuelle est null, on considère 0
//     const ancienneQuantite = consommable.quantite_consommable ?? 0;

//     // Mettre à jour la quantité
//     await prisma.consommable.update({
//       where: { id_consommable: Number(id_consommable) },
//       data: {
//         quantite_consommable: ancienneQuantite + Number(quantite_don),
//       },
//     });

//     res.status(200).json(lot_consommable);
//   } catch (error) {
//     res.status(500).json(error);
//   }
// });

const create_lot_consommable = asyncHandler(async (req, res, next) => {
  try {
    const { quantite_don, id_consommable, PU, id_donneur, date_don_consommable, ...otherFields } = req.body;

    // Validation des champs obligatoires
    if (!quantite_don || !id_consommable) {
      return res.status(400).json({ 
        success: false,
        message: "Les champs 'quantite_don' et 'id_consommable' sont obligatoires" 
      });
    }

    // Vérifier que la quantité est positive
    if (quantite_don <= 0) {
      return res.status(400).json({ 
        success: false,
        message: "La quantité doit être supérieure à 0" 
      });
    }

    // Vérifier que le consommable existe
    const consommable = await prisma.consommable.findUnique({
      where: { id_consommable: Number(id_consommable) },
    });

    if (!consommable) {
      return res.status(404).json({ 
        success: false,
        message: "Consommable non trouvé" 
      });
    }

    // Vérifier que le donneur existe (si fourni)
    if (id_donneur) {
      const donneur = await prisma.donneur.findUnique({
        where: { id_donneur: Number(id_donneur) },
      });

      if (!donneur) {
        return res.status(404).json({ 
          success: false,
          message: "Donneur non trouvé" 
        });
      }
    }

    // Préparer les données pour la création
    const lotData = {
      quantite_don: Number(quantite_don),
      id_consommable: Number(id_consommable),
      ...otherFields,
    };

    // Ajouter PU s'il est fourni
    if (PU !== undefined && PU !== null) {
      lotData.PU = Number(PU);
    }

    // Ajouter id_donneur s'il est fourni
    if (id_donneur) {
      lotData.id_donneur = Number(id_donneur);
    }

    // Ajouter date_don_consommable s'il est fourni
    if (date_don_consommable) {
      const parsedDate = new Date(date_don_consommable);
      if (!isNaN(parsedDate.getTime())) {
        lotData.date_don_consommable = parsedDate;
      }
    }

    // Création du lot_consommable
    const lot_consommable = await prisma.lot_consommable.create({
      data: lotData,
      include: {
        donneur: {
          select: {
            id_donneur: true,
            nom_donneur: true,
            fonction_donneur: true
          }
        },
        consommable: {
          select: {
            id_consommable: true,
            nom_consommable: true,
            unite: true,
            prix_unitaire: true
          }
        }
      }
    });

    // Calculer l'ancienne quantité (0 si null)
    const ancienneQuantite = consommable.quantite_consommable ?? 0;

    // Mettre à jour la quantité du consommable
    const quantiteUpdate = {
      quantite_consommable: ancienneQuantite + Number(quantite_don)
    };

    // Mettre à jour le prix_unitaire du consommable si PU est fourni
    if (PU !== undefined && PU !== null && Number(PU) > 0) {
      // Option 1: Remplacer l'ancien prix
      quantiteUpdate.prix_unitaire = Number(PU);
      
      // Option 2: Calculer la moyenne pondérée (décommentez si besoin)
      /*
      const ancienPrix = consommable.prix_unitaire ?? 0;
      const totalQuantite = ancienneQuantite + Number(quantite_don);
      if (totalQuantite > 0) {
        quantiteUpdate.prix_unitaire = Math.round(
          ((ancienneQuantite * ancienPrix) + (Number(quantite_don) * Number(PU))) / totalQuantite
        );
      }
      */
    }

    await prisma.consommable.update({
      where: { id_consommable: Number(id_consommable) },
      data: quantiteUpdate
    });

    // Optionnel: Créer une notification
    try {
      await prisma.notification.create({
        data: {
          type: "CONSOMMABLE_ENVOYE",
          message: `Nouveau lot de consommable ajouté: ${consommable.nom_consommable} (${quantite_don} ${consommable.unite || 'unités'})`,
          destinataireType: "ADMIN",
          consommable: {
            connect: { id_consommable: Number(id_consommable) }
          }
        }
      });
    } catch (notificationError) {
      console.error("Erreur lors de la création de la notification:", notificationError);
      // Ne pas bloquer la création du lot si la notification échoue
    }

    res.status(201).json({
      success: true,
      message: "Lot de consommable créé avec succès",
      data: lot_consommable
    });
  } catch (error) {
    console.error("Erreur lors de la création du lot consommable:", error);
    
    // Gestion des erreurs spécifiques
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: "Violation de contrainte unique (doublon détecté)"
      });
    }
    
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: "Violation de clé étrangère (référence invalide)"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la création du lot",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
const delete_lot_consommable = asyncHandler(async (req, res, next) => {
  try {
    const id_lot_consommable = Number(req.params.id);

    // On récupère d'abord le lot à supprimer
    const lot = await prisma.lot_consommable.findUnique({
      where: { id_lot_consommable },
      include: {
        consommable: true,
      },
    });

    if (!lot) {
      return res.status(404).json({ message: "Lot consommable non trouvé" });
    }

    // Vérifier s'il existe des prêts pour ce consommable après la date du lot
    const pretsApresLot = await prisma.pret.findMany({
      where: {
        id_consommable: lot.id_consommable,
        date_envoi: {
          gte: lot.date_don_consommable,
        },
      },
    });

    // S'il y a des prêts après la date de ce lot, on ne peut pas le supprimer
    if (pretsApresLot.length > 0) {
      return res.status(400).json({
        message:
          "Suppression Impossible: des prêts ont été effectués après l'ajout de ce lot",
        prets: pretsApresLot.length,
      });
    }

    // Vérifier aussi la quantité actuelle pour éviter les valeurs négatives
    const ancienneQuantite = lot.consommable.quantite_consommable ?? 0;
    const nouvelleQuantite = ancienneQuantite - lot.quantite_don;

    if (nouvelleQuantite < 0) {
      return res.status(400).json({
        message:
          "Suppression Impossible: la quantité deviendrait négative",
        quantite_actuelle: ancienneQuantite,
        quantite_a_retirer: lot.quantite_don,
        nouvelle_quantite: nouvelleQuantite,
      });
    }

    // Utiliser une transaction pour garantir l'intégrité des données
    const result = await prisma.$transaction(async (tx) => {
      // Mettre à jour la quantité du consommable
      await tx.consommable.update({
        where: { id_consommable: lot.id_consommable },
        data: { quantite_consommable: nouvelleQuantite },
      });

      // Supprimer le lot
      return await tx.lot_consommable.delete({
        where: { id_lot_consommable },
      });
    });

    res.status(200).json({
      message: "Lot supprimé avec succès",
      lot: result,
      nouvelle_quantite: nouvelleQuantite,
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du lot:", error);
    res.status(500).json({
      message: "Erreur interne du serveur",
      error: error.message,
    });
  }
});

const update_lot_consommable = asyncHandler(async (req, res, next) => {
  try {
    const id_lot_consommable = Number(req.params.id);
    const { quantite_don, id_consommable, ...otherFields } = req.body;

    // Récupérer l'ancien lot
    const oldLot = await prisma.lot_consommable.findUnique({
      where: { id_lot_consommable },
      include: { consommable: true }
    });

    if (!oldLot) {
      return res.status(404).json({ message: "Lot consommable non trouvé" });
    }

    // Vérifier s'il existe des prêts pour ce consommable après la date du lot
    const pretsApresLot = await prisma.pret.findMany({
      where: {
        id_consommable: oldLot.id_consommable,
        date_envoi: {
          gte: oldLot.date_don_consommable,
        },
      },
    });

    // Si des prêts existent après l'ajout de ce lot, on interdit la modification de la quantité ou du consommable
    if (
      pretsApresLot.length > 0 &&
      (
        (typeof quantite_don !== "undefined" && quantite_don !== oldLot.quantite_don) ||
        (typeof id_consommable !== "undefined" && id_consommable !== oldLot.id_consommable)
      )
    ) {
      return res.status(400).json({
        message:
          "Modification Impossible: des prêts ont été effectués après l'ajout de ce lot, vous ne pouvez pas modifier la quantité ou le consommable.",
        prets: pretsApresLot.length,
      });
    }

    // Calculer la nouvelle quantité pour validation
    let nouvelleQuantite;
    if (id_consommable && oldLot.id_consommable !== id_consommable) {
      // On retire la quantité du lot de l'ancien consommable et on l'ajoute au nouveau
      const oldConsommable = await prisma.consommable.findUnique({
        where: { id_consommable: oldLot.id_consommable },
      });
      const newConsommable = await prisma.consommable.findUnique({
        where: { id_consommable: Number(id_consommable) },
      });
      nouvelleQuantite = (newConsommable.quantite_consommable ?? 0) + Number(quantite_don);

      if (nouvelleQuantite < 0) {
        return res.status(400).json({
          message: "Modification Impossible: la quantité du nouveau consommable deviendrait négative",
          quantite_actuelle: newConsommable.quantite_consommable ?? 0,
          quantite_a_ajouter: quantite_don,
          nouvelle_quantite: nouvelleQuantite,
        });
      }

      // Mise à jour des consommables
      if (oldConsommable) {
        await prisma.consommable.update({
          where: { id_consommable: oldLot.id_consommable },
          data: {
            quantite_consommable:
              (oldConsommable.quantite_consommable ?? 0) - oldLot.quantite_don,
          },
        });
      }
      if (newConsommable) {
        await prisma.consommable.update({
          where: { id_consommable: Number(id_consommable) },
          data: {
            quantite_consommable: nouvelleQuantite,
          },
        });
      }
    } else {
      // Même consommable, ajustement de la différence
      const oldConsommable = await prisma.consommable.findUnique({
        where: { id_consommable: oldLot.id_consommable },
      });
      const diff = Number(quantite_don) - oldLot.quantite_don;
      nouvelleQuantite = (oldConsommable.quantite_consommable ?? 0) + diff;

      if (nouvelleQuantite < 0) {
        return res.status(400).json({
          message: "Modification Impossible: la quantité deviendrait négative",
          quantite_actuelle: oldConsommable.quantite_consommable ?? 0,
          diff: diff,
          nouvelle_quantite: nouvelleQuantite,
        });
      }

      // Mise à jour du consommable
      await prisma.consommable.update({
        where: { id_consommable: oldLot.id_consommable },
        data: {
          quantite_consommable: nouvelleQuantite,
        },
      });
    }

    // Mise à jour du lot
    const lot_consommable = await prisma.lot_consommable.update({
      where: { id_lot_consommable },
      data: {
        quantite_don,
        id_consommable,
        ...otherFields,
      },
    });

    res.status(200).json(lot_consommable);
  } catch (error) {
    res.status(500).json({
      message: "Erreur interne du serveur",
      error: error.message,
    });
  }
});

const get_one_lot_consommable = asyncHandler(async (req, res, next) => {
  try {
    const lot_consommable = await prisma.lot_consommable.findUnique({
      where: { id_lot_consommable: Number(req.params.id) },
    });
    res.status(200).json(lot_consommable);
  } catch (error) {
    res.status(500).send(error);
  }
});

export {
  get_lot_consommable,
  count_lot_consommable,
  delete_lot_consommable,
  update_lot_consommable,
  create_lot_consommable,
  get_one_lot_consommable,
};
