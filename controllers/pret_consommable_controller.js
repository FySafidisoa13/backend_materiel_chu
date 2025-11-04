import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_pret_consommable = asyncHandler(async (req, res, next) => {
  try {
    const prets = await prisma.pret.findMany({
      where: {
        id_consommable: { not: null },
      },
      include: {
        service: { select: { id_service: true, nom_service: true } },
        consommable: {
          select: {
            id_consommable: true,
            nom_consommable: true,
           prix_unitaire: true,
          },
        },
      },
      orderBy: { date_envoi: "desc" },
    });

    // Optionnel: formatage simple selon besoin
    const result = prets.map((p) => ({
      id_pret: p.id_pret,
      id_service: p.service?.id_service,
      service: p.service?.nom_service,
      consommable: p.consommable?.nom_consommable,
      prix_unitaire: p.consommable?.prix_unitaire,
      id_consommable: p.consommable?.id_consommable,
      quantite: p.quantite_pret,
      date: p.date_envoi,
      date_retour: p.date_retour,
    }));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(error);
  }
});

const count_pret_consommable = asyncHandler(async (req, res, next) => {
  try {
    const count_pret_consommable = await prisma.pret.count();
    res.status(200).json(count_pret_consommable);
  } catch (error) {
    res.status(500).json(error);
  }
});

const create_pret_consommable = asyncHandler(async (req, res, next) => {
  try {
    const { id_consommable, quantite_pret, id_service, ...otherFields } =
      req.body;

    // Vérifier la quantité en stock
    const consommable = await prisma.consommable.findUnique({
      where: { id_consommable: Number(id_consommable) },
    });

    if (
      !consommable ||
      (consommable.quantite_consommable ?? 0) < Number(quantite_pret)
    ) {
      return res
        .status(400)
        .json({ message: "Stock insuffisant pour ce consommable." });
    }

    // Création du prêt
    const pret = await prisma.pret.create({
      data: {
        id_consommable,
        quantite_pret,
        id_service,
        ...otherFields,
      },
    });

    // Décrémenter la quantité du consommable
    await prisma.consommable.update({
      where: { id_consommable: Number(id_consommable) },
      data: {
        quantite_consommable: {
          decrement: Number(quantite_pret),
        },
      },
    });

    // Récupérer l'unité et le nom du consommable pour le message
    const nomConsommable =
      consommable.nom_consommable?.toUpperCase() ?? "CONSOMMABLE";
    const unite = consommable.unite?.toUpperCase() ?? "UNITE";

    // Message : "Nous avons reçu 12 PAQUETS de PAPIER VELIN."
    const message = `Nous avons reçu ${quantite_pret} ${unite}${
      quantite_pret > 1 ? "S" : ""
    } de ${nomConsommable}.`;

    // Créer la notification
    await prisma.notification.create({
      data: {
        type: "CONSOMMABLE_ENVOYE",
        message: message,
        id_service: Number(id_service),
        id_consommable: Number(id_consommable),
        destinataireType: "SERVICE",
        is_read: false,
      },
    });

    res.status(200).json(pret);
  } catch (error) {
    res.status(500).json(error);
  }
});

const delete_pret_consommableOOO = asyncHandler(async (req, res, next) => {
  try {
    const id_pret = Number(req.params.id);

    // On récupère d'abord le prêt pour connaître le consommable et la quantité
    const pret = await prisma.pret.findUnique({
      where: { id_pret },
    });

    if (!pret) {
      return res.status(404).json({ message: "Prêt non trouvé" });
    }

    // Restituer la quantité au consommable si le prêt concerne un consommable
    if (pret.id_consommable && pret.quantite_pret) {
      const consommable = await prisma.consommable.findUnique({
        where: { id_consommable: pret.id_consommable },
      });
      if (consommable) {
        await prisma.consommable.update({
          where: { id_consommable: pret.id_consommable },
          data: {
            quantite_consommable:
              (consommable.quantite_consommable ?? 0) + pret.quantite_pret,
          },
        });
      }
    }

    // Suppression du prêt
    await prisma.pret.delete({
      where: { id_pret },
    });

    res.status(200).json({ message: "Prêt supprimé et quantité restituée." });
  } catch (error) {
    res.status(500).send(error);
  }
});

const delete_pret_consommable = asyncHandler(async (req, res, next) => {
  try {
    const id_pret = Number(req.params.id);

    // 1️⃣ On récupère le prêt et les relations nécessaires
    const pret = await prisma.pret.findUnique({
      where: { id_pret },
      include: {
        service: true,
        consommable: true,
      }
    });

    if (!pret) {
      return res.status(404).json({ message: "Prêt non trouvé" });
    }

    // 2️⃣ Restituer la quantité au consommable si le prêt concerne un consommable
    if (pret.id_consommable && pret.quantite_pret) {
      const consommable = pret.consommable;
      if (consommable) {
        await prisma.consommable.update({
          where: { id_consommable: pret.id_consommable },
          data: {
            quantite_consommable:
              (consommable.quantite_consommable ?? 0) + pret.quantite_pret,
          },
        });

        // 3️⃣ Créer la notification CONSOMMABLE_RETIRE
        const nomConsommable = consommable.nom_consommable?.toUpperCase() ?? "CONSOMMABLE";
        const unite = consommable.unite?.toUpperCase() ?? "UNITE";
        const quantite = pret.quantite_pret;

        await prisma.notification.create({
          data: {
            type: "CONSOMMABLE_RETIRE",
            message: `${quantite} ${unite}${quantite > 1 ? "S" : ""} de ${nomConsommable} ont été retirés dans notre service.`,
            id_service: pret.service?.id_service,
            id_consommable: pret.id_consommable,
            destinataireType: "SERVICE",
            is_read: false,
          },
        });
      }
    }

    // 4️⃣ Suppression du prêt
    await prisma.pret.delete({
      where: { id_pret },
    });

    res.status(200).json({ message: "Prêt supprimé, quantité restituée et notification envoyée." });
  } catch (error) {
    console.error("Erreur delete_pret_consommable :", error);
    res.status(500).send(error);
  }
});

const update_pret_consommable2 = asyncHandler(async (req, res, next) => {
  const { date_retour } = req.body;
  try {
    // 1. Mettre à jour la date de retour sur le prêt
    const pret_consommable = await prisma.pret.update({
      data: { date_retour },
      where: { id_pret: Number(req.params.id) },
      include: {
        consommable: true, // Pour l'unité, le nom etc.
        service: true, // Pour le nom du service
      },
    });

    // 2. Vérifier l'existence des données
    if (!pret_consommable.consommable) {
      return res.status(404).json({ error: "Consommable non trouvé" });
    }
    if (!pret_consommable.service) {
      return res.status(404).json({ error: "Service non trouvé" });
    }

    // 3. Calculer le nombre de jours entre la date d’envoi et la date de retour
    const date_envoi = new Date(pret_consommable.date_envoi);
    // 4. Construire le message
    const quantite = pret_consommable.quantite_pret ?? 0;
    const nom_consommable = pret_consommable.consommable.nom_consommable ?? "";
    const nom_service = pret_consommable.service.nom_service ?? "";
    const unite = pret_consommable.consommable.unite ?? "unité";
    const uniteAffichage =
      quantite > 1 ? `${unite.replace(/\s+$/, "")}s` : unite;

    // Formatage de la date envoi en JJ/MM/AAAA
    const dateEnvoiFormatee = date_envoi
      ? `${date_envoi.getDate().toString().padStart(2, "0")}/${(date_envoi.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${date_envoi.getFullYear()}`
      : "";

    const message = `${quantite} ${uniteAffichage} de ${nom_consommable} épuisés au service ${nom_service}, envoyés le ${dateEnvoiFormatee}.`;

    // 5. Créer la notification à l'admin
    await prisma.notification.create({
      data: {
        type: "CONSOMMABLE_EPUISÉ",
        message,
        id_service: pret_consommable.service.id_service,
        id_consommable: pret_consommable.consommable.id_consommable,
        destinataireType: "ADMIN",
        is_read: false,
      },
    });

    res.status(200).json(pret_consommable);
  } catch (error) {
    console.error("Erreur update_pret_consommable2 :", error);
    res.status(500).json({ error: error.message ?? "Erreur interne serveur" });
  }
});

const update_pret_consommable = asyncHandler(async (req, res, next) => {
  try {
    const id_pret = Number(req.params.id);
    const { quantite_pret, id_consommable, ...otherFields } = req.body;

    // 1. Récupérer l'ancien prêt
    const oldPret = await prisma.pret.findUnique({
      where: { id_pret },
    });
    if (!oldPret) {
      return res.status(404).json({ message: "Prêt non trouvé" });
    }

    // 2. Si le consommable a changé
    if (id_consommable && oldPret.id_consommable !== id_consommable) {
      // On réajuste l'ancien consommable (on ajoute ce qui avait été prélevé)
      if (oldPret.id_consommable) {
        const oldConsommable = await prisma.consommable.findUnique({
          where: { id_consommable: oldPret.id_consommable },
        });
        if (oldConsommable) {
          await prisma.consommable.update({
            where: { id_consommable: oldPret.id_consommable },
            data: {
              quantite_consommable:
                (oldConsommable.quantite_consommable ?? 0) +
                (oldPret.quantite_pret ?? 0),
            },
          });
        }
      }
      // On prélève la quantité sur le nouveau consommable
      const newConsommable = await prisma.consommable.findUnique({
        where: { id_consommable: Number(id_consommable) },
      });
      if (
        !newConsommable ||
        (newConsommable.quantite_consommable ?? 0) < Number(quantite_pret)
      ) {
        return res
          .status(400)
          .json({ message: "Stock insuffisant pour le nouveau consommable" });
      }
      await prisma.consommable.update({
        where: { id_consommable: Number(id_consommable) },
        data: {
          quantite_consommable:
            (newConsommable.quantite_consommable ?? 0) - Number(quantite_pret),
        },
      });
    } else {
      // Même consommable, ajustement selon la différence de quantité
      const diff = Number(quantite_pret) - (oldPret.quantite_pret ?? 0);
      if (diff !== 0) {
        const consommable = await prisma.consommable.findUnique({
          where: { id_consommable: oldPret.id_consommable },
        });
        if (!consommable) {
          return res.status(404).json({ message: "Consommable non trouvé" });
        }
        if (diff > 0 && (consommable.quantite_consommable ?? 0) < diff) {
          return res
            .status(400)
            .json({ message: "Stock insuffisant pour augmenter le prêt" });
        }
        await prisma.consommable.update({
          where: { id_consommable: oldPret.id_consommable },
          data: {
            quantite_consommable:
              (consommable.quantite_consommable ?? 0) - diff,
          },
        });
      }
    }

    // 3. Mise à jour du prêt
    const pret = await prisma.pret.update({
      data: { quantite_pret, id_consommable, ...otherFields },
      where: { id_pret },
    });

    res.status(200).json(pret);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_one_pret_consommable = asyncHandler(async (req, res, next) => {
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
        consommable: {
          select: {
            id_consommable: true,
            nom_consommable: true,
          },
        },
      },
    });
    res.status(200).json(pret);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_consommables_par_service = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("get consommable par service");
  try {
    // Étape 1 : Vérifier si la personne existe et récupérer son service
    const personne = await prisma.personne.findUnique({
      where: { id_personne: parseInt(id) },
      select: { id_service: true, service: { select: { nom_service: true } } },
    });

    if (!personne) {
      return res.status(404).json({ message: "Personne non trouvée" });
    }

    // Étape 2 : Rechercher tous les prêts de consommables du service de cette personne
    const prets = await prisma.pret.findMany({
      where: {
        id_service: personne.id_service,
        id_consommable: { not: null },
      },
      include: {
        service: { select: { id_service: true, nom_service: true } },
        consommable: {
          select: {
            id_consommable: true,
            nom_consommable: true,
            prix_unitaire: true,
            classe: {
              select: {
                id_classe: true,
                nom_classe: true,
              },
            },
            lot_consommables: {
              select: {
                id_lot_consommable: true,
              },
            },
          },
        },
      },
      orderBy: [
        { consommable: { nom_consommable: "asc" } },
        { date_envoi: "desc" },
      ],
    });

    // Étape 3 : Formatage final
    const result = prets.map((p) => ({
      id_pret: p.id_pret,
      id_service: p.service?.id_service,
      service: p.service?.nom_service,
      consommable: p.consommable?.nom_consommable,
      prix_unitaire: p.consommable?.prix_unitaire,
      id_consommable: p.consommable?.id_consommable,
      quantite: p.quantite_pret,
      date: p.date_envoi,
      date_retour: p.date_retour,
      classe: p.consommable.classe.nom_classe,
      id_classe: p.consommable.classe.id_classe,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur", error });
  }
});

export {
  get_pret_consommable,
  count_pret_consommable,
  delete_pret_consommable,
  update_pret_consommable,
  update_pret_consommable2,
  get_consommables_par_service,
  create_pret_consommable,
  get_one_pret_consommable,
};
