import { PrismaClient } from "@prisma/client";
import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_count_materiel_par_service = asyncHandler(async (req, res, next) => {
  try {
    const count_materiel = await prisma.service.findMany({
      select: {
        id_service: true,
        nom_service: true,
        prets: {
          where: {
            lot_materiels: {
              isNot: null,
            },
          },
          select: {
            lot_materiels: {
              select: {
                id_lot: true,
              },
            },
          },
        },
      },
    });

    const result = count_materiel.map((service) => ({
      nom_service: service.nom_service,
      count: service.prets.length,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Une erreur est survenue lors de la récupération des données",
    });
  }
});

const get_materiel_disponible = asyncHandler(async (req, res, next) => {
  try {
    const disponibles = await prisma.lot_materiels.findMany({
      where: {
        prets: { none: {} },
      },
      select: {
        id_lot: true,
        numero: true,
        date_don: true,
        Materiels: {
          select: {
            id_materiel: true,
            nom_materiel: true,
          },
        },
      },
    });

    // Comptage par nom de matériel
    const counts = {};
    disponibles.forEach((lot) => {
      const nom = lot.Materiels.nom_materiel;
      counts[nom] = (counts[nom] || 0) + 1;
    });

    res.status(200).json({
      total: disponibles.length,
      counts, // ex: { Table: 6, Chaise: 4 }
      lots: disponibles,
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

/**
 * Matériels occupés : lots avec au moins un prêt
 * Retourne total, liste, et nombre par type de matériel et par service
 */
const get_materiel_occupe = asyncHandler(async (req, res, next) => {
  try {
    // Cherche tous les lots occupés, avec le dernier prêt (pour avoir le service)
    const occupes = await prisma.lot_materiels.findMany({
      where: {
        prets: { some: {} },
      },
      select: {
        id_lot: true,
        numero: true,
        date_don: true,
        Materiels: {
          select: {
            id_materiel: true,
            nom_materiel: true,
          },
        },
        prets: {
          orderBy: { id_pret: "desc" }, // On prend le dernier prêt pour chaque lot
          take: 1,
          select: {
            service: {
              select: {
                nom_service: true,
              },
            },
          },
        },
      },
    });

    // Comptage par type de matériel ET par service
    // ex: { Table: { "Service A": 5, "Service B": 3 }, Chaise: { ... } }
    const counts = {};
    occupes.forEach((lot) => {
      const nom = lot.Materiels.nom_materiel;
      const service = lot.prets[0]?.service?.nom_service || "Autre";
      if (!counts[nom]) counts[nom] = {};
      counts[nom][service] = (counts[nom][service] || 0) + 1;
    });

    res.status(200).json({
      total: occupes.length,
      counts, // ex: { Table: { ServiceA: 5 }, Chaise: { ServiceB: 8 } }
      lots: occupes,
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

const get_consommable_disponible = asyncHandler(async (req, res, next) => {
  try {
    const disponibles = await prisma.consommable.findMany({
      where: {
        quantite_consommable: { gt: 0 },
      },
      select: {
        id_consommable: true,
        nom_consommable: true,
        quantite_consommable: true,
        reference_consommable: true,
      },
    });

    // Comptage par nom de consommable (quantité disponible)
    const counts = {};
    disponibles.forEach((conso) => {
      const nom = conso.nom_consommable;
      counts[nom] = (counts[nom] || 0) + (conso.quantite_consommable || 0);
    });

    res.status(200).json({
      total: disponibles.length,
      counts, // ex: { Gants: 100, Masques: 200 }
      consommables: disponibles,
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

/**
 * Consommables occupés : ceux prêtés à un service (dans Pret)
 * Retourne total, liste, et quantité utilisée par type et par service
 */
const get_consommable_occupe = asyncHandler(async (req, res, next) => {
  try {
    // On récupère tous les prêts de consommables, avec le service et la quantité
    const prets = await prisma.pret.findMany({
      where: {
        id_consommable: { not: null },
        quantite_pret: { gt: 0 },
        service: {
          // Optionnel: tu peux filtrer ici pour les services actifs
        },
      },
      select: {
        id_pret: true,
        quantite_pret: true,
        consommable: {
          select: {
            id_consommable: true,
            nom_consommable: true,
          },
        },
        service: {
          select: {
            id_service: true,
            nom_service: true,
          },
        },
      },
    });

    // Comptage par type de consommable ET par service
    // ex: { Gants: { "Service A": 30, "Service B": 10 }, Masques: { ... } }
    const counts = {};
    prets.forEach((pret) => {
      const nom = pret.consommable?.nom_consommable || "Autre";
      const service = pret.service?.nom_service || "Autre";
      const quantite = pret.quantite_pret || 0;
      if (!counts[nom]) counts[nom] = {};
      counts[nom][service] = (counts[nom][service] || 0) + quantite;
    });

    res.status(200).json({
      total: prets.length, // total des prêts, pas des consommables distincts
      counts, // ex: { Gants: { "Service A": 30, ... }, ... }
      prets,
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

const get_stats_materiels_par_etat = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params; // ID de la personne

    // 1. Récupérer le service de la personne
    const personne = await prisma.personne.findUnique({
      where: { id_personne: parseInt(id) },
      include: {
        service: true,
      },
    });

    if (!personne) {
      return res.status(404).json({ message: "Personne non trouvée" });
    }

    const idService = personne.id_service;

    // 2. Récupérer tous les prêts de matériels pour ce service
    const prets = await prisma.pret.findMany({
      where: {
        id_service: idService,
        id_lot: { not: null }, // Seulement les prêts de matériels
      },
      include: {
        lot_materiels: {
          include: {
            Materiels: true,
          },
        },
      },
    });

    // 3. Créer une structure pour les statistiques
    const stats = {};

    prets.forEach((pret) => {
      const materiel = pret.lot_materiels.Materiels;
      const etat = pret.lot_materiels.etat;
      const nomMateriel = materiel.nom_materiel;

      if (!stats[nomMateriel]) {
        stats[nomMateriel] = {
          nom_materiel: nomMateriel,
          total: 0,
          etats: {
            BON: 0,
            MAUVAIS: 0,
            MOYEN: 0,
            EN_PANNE: 0,
            PERDU: 0,
          },
        };
      }

      stats[nomMateriel].total++;
      stats[nomMateriel].etats[etat]++;
    });

    // 4. Convertir l'objet en tableau pour la réponse
    const result = Object.values(stats).map((item) => ({
      nom_materiel: item.nom_materiel,
      total: item.total,
      ...item.etats,
    }));

    res.status(200).json({
      service: personne.service,
      stats_materiels: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message,
    });
  }
});

const get_stats_materiels_par_etat_par_service = asyncHandler(
  async (req, res, next) => {
    try {
      // Récupère id_service depuis les params (supporte aussi `id` si vous souhaitez la compatibilité)
      const rawId = req.params.id_service ?? req.params.id;
      const idService = parseInt(rawId, 10);

      if (isNaN(idService)) {
        return res
          .status(400)
          .json({ message: "id_service invalide ou manquant" });
      }

      // Vérifier que le service existe
      const service = await prisma.service.findUnique({
        where: { id_service: idService },
      });

      if (!service) {
        return res.status(404).json({ message: "Service non trouvé" });
      }

      // Récupérer tous les prêts de matériels pour ce service
      const prets = await prisma.pret.findMany({
        where: {
          id_service: idService,
          id_lot: { not: null }, // Seulement les prêts de matériels
        },
        include: {
          lot_materiels: {
            include: {
              Materiels: true,
            },
          },
        },
      });

      // Construire statistique
      const stats = {};

      prets.forEach((pret) => {
        const lot = pret.lot_materiels;
        if (!lot || !lot.Materiels) return; // sécurité si relation manquante

        const materiel = lot.Materiels;
        const etat = lot.etat; // Enum: BON, MAUVAIS, MOYEN, EN_PANNE, PERDU
        const nomMateriel = materiel.nom_materiel;

        if (!stats[nomMateriel]) {
          stats[nomMateriel] = {
            nom_materiel: nomMateriel,
            total: 0,
            etats: {
              BON: 0,
              MAUVAIS: 0,
              MOYEN: 0,
              EN_PANNE: 0,
              PERDU: 0,
            },
          };
        }

        stats[nomMateriel].total++;
        // Si pour une raison l'état est indéfini ou non prévu, on l'ignore ou on peut l'ajouter dynamiquement.
        if (
          etat &&
          Object.prototype.hasOwnProperty.call(stats[nomMateriel].etats, etat)
        ) {
          stats[nomMateriel].etats[etat]++;
        } else {
          // Optionnel : compter les états inconnus sous une clé "INCONNU"
          stats[nomMateriel].etats.INCONNU =
            (stats[nomMateriel].etats.INCONNU || 0) + 1;
        }
      });

      // Convertir l'objet en tableau pour la réponse
      const result = Object.values(stats).map((item) => ({
        nom_materiel: item.nom_materiel,
        total: item.total,
        ...item.etats,
      }));

      res.status(200).json({
        service,
        stats_materiels: result,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Erreur serveur",
        error: error.message,
      });
    }
  }
);

export {
  get_materiel_disponible,
  get_materiel_occupe,
  get_consommable_disponible,
  get_consommable_occupe,
  get_count_materiel_par_service,
  get_stats_materiels_par_etat,
  get_stats_materiels_par_etat_par_service,
};
