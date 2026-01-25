import asyncHandler from "../Middleware/asyncHandler.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MONTH_ABBR = {
  1: 'JANV',
  2: 'FEV',
  3: 'MARS',
  4: 'AVR',
  5: 'MAI',
  6: 'JUIN',
  7: 'JUIL',
  8: 'AOUT',
  9: 'SEPT',
  10: 'OCT',
  11: 'NOV',
  12: 'DEC',
};

/**
 * Controller :
 * - Paramètre URL : :serviceId
 * - Période calculée automatiquement : depuis la première date de "Pret" (pour ce service si possible,
 *   sinon la première date globale) jusqu'au mois courant inclus.
 *
 * Correction importante : les paramètres de dates passés dans les requêtes RAW sont castés en timestamp
 * (ex: ${startIso}::timestamp) pour éviter l'erreur Postgres "timestamp without time zone >= text".
 */
const get_rapport_consommables_par_service_auto = asyncHandler(async (req, res) => {
  const serviceId = parseInt(req.params.serviceId, 10);
  if (isNaN(serviceId)) {
    return res.status(400).json({ message: 'Paramètre serviceId invalide' });
  }

  try {
    const now = new Date();

    // 1) Chercher la première date_envoi pour ce service
    const earliestForService = await prisma.$queryRaw`
      SELECT MIN(p.date_envoi) AS min_date
      FROM "Pret" p
      WHERE p.id_service = ${serviceId} AND p.date_envoi IS NOT NULL
    `;

    let minDate = null;
    if (Array.isArray(earliestForService) && earliestForService.length > 0) {
      minDate = earliestForService[0].min_date || null;
    } else if (earliestForService && earliestForService.min_date) {
      minDate = earliestForService.min_date;
    }

    // 2) Si pas de date pour le service -> fallback : première date globale
    if (!minDate) {
      const earliestGlobal = await prisma.$queryRaw`
        SELECT MIN(p.date_envoi) AS min_date
        FROM "Pret" p
        WHERE p.date_envoi IS NOT NULL
      `;
      if (Array.isArray(earliestGlobal) && earliestGlobal.length > 0) {
        minDate = earliestGlobal[0].min_date || null;
      } else if (earliestGlobal && earliestGlobal.min_date) {
        minDate = earliestGlobal.min_date;
      }
    }

    // 3) Déterminer start/end
    let startIso;
    if (minDate) {
      const d = new Date(minDate);
      startIso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
    } else {
      // fallback : 13 mois finissant le mois précédent
      const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const first = new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth() - 12, 1));
      startIso = first.toISOString();
    }
    // end = last day of current month (end of today)
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const endIso = endDate.toISOString();

    // 4) Construire liste des mois [YYYY-MM] et labels ["DEC 2024", ...] de start à end
    const monthKeys = [];
    const monthLabels = [];
    const sDate = new Date(startIso);
    const eDate = new Date(endIso);
    let cur = new Date(Date.UTC(sDate.getUTCFullYear(), sDate.getUTCMonth(), 1));
    // NOTE: MONTH_ABBR doit être défini ailleurs dans votre code (ex: ['', 'JAN', 'FEB', ...])
    while (cur <= eDate) {
      const y = cur.getUTCFullYear();
      const m = cur.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`; // YYYY-MM
      monthKeys.push(key);
      const label = `${MONTH_ABBR[m]} ${y}`;
      monthLabels.push(label);
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }

    // 5) Récupérer tous les consommables (catalogue) avec leur classe
    const consommables = await prisma.consommable.findMany({
      include: { classe: true },
      orderBy: [
        { classe: { code_classe: 'asc' } },
        { nom_consommable: 'asc' },
      ],
    });

    // 6) Récupérer agrégats par consommable et mois pour ce service et la période
    // On sépare les sommes payantes (PU_envoie IS NOT NULL) et les dons (PU_envoie IS NULL).
    const aggregates = await prisma.$queryRaw`
      SELECT
        c.id_consommable,
        TO_CHAR(DATE_TRUNC('month', p.date_envoi), 'YYYY-MM') AS ym,
        SUM(p.quantite_pret) FILTER (WHERE p."PU_envoie" IS NOT NULL)::int AS paid_qte,
        SUM((p.quantite_pret * p."PU_envoie")) FILTER (WHERE p."PU_envoie" IS NOT NULL)::numeric(20,2) AS paid_montant,
        SUM(p.quantite_pret) FILTER (WHERE p."PU_envoie" IS NULL)::int AS donated_qte
      FROM "Pret" p
      JOIN "Consommable" c ON c.id_consommable = p.id_consommable
      WHERE p.id_service = ${serviceId}
        AND p.date_envoi >= ${startIso}::timestamp
        AND p.date_envoi <= ${endIso}::timestamp
      GROUP BY c.id_consommable, ym;
    `;

    // 7) Transformer aggregates en map: aggMap[id][ym] = { paid_qte, paid_montant, donated_qte }
    const aggMap = new Map();
    for (const row of aggregates) {
      const id = Number(row.id_consommable);
      const ym = row.ym;
      if (!aggMap.has(id)) aggMap.set(id, {});
      aggMap.get(id)[ym] = {
        paid_qte: Number(row.paid_qte) || 0,
        paid_montant: Number(row.paid_montant) || 0,
        donated_qte: Number(row.donated_qte) || 0,
      };
    }

    // 8) Construire structure groupée par classe, et regrouper les dons dans une classe synthétique "Don"
    const classesMap = new Map();
    const DON_KEY = `__DON__0`; // clé synthétique pour la classe Don
    // Pré-créer la classe Don (vide) pour garantir sa présence si nécessaire
    const ensureDonClass = () => {
      if (!classesMap.has(DON_KEY)) {
        const subtotalMonthValues = {};
        for (let i = 0; i < monthLabels.length; i++) {
          subtotalMonthValues[monthLabels[i]] = { qte: 0, montant: 0 };
        }
        classesMap.set(DON_KEY, {
          id_classe: 0,
          code_classe: 'DON',
          nom_classe: 'Don',
          items: [],
          subtotal: {
            total_qte: 0,
            total_montant: 0,
            monthValues: subtotalMonthValues,
          },
        });
      }
    };

    for (const cons of consommables) {
      const cl = cons.classe || { id_classe: null, nom_classe: 'Sans classe', code_classe: '' };
      const clKey = `${cl.code_classe || ''}__${cl.id_classe || 0}`;
      if (!classesMap.has(clKey)) {
        // initialiser subtotal.monthValues pour la classe
        const subtotalMonthValues = {};
        for (let i = 0; i < monthLabels.length; i++) {
          subtotalMonthValues[monthLabels[i]] = { qte: 0, montant: 0 };
        }

        classesMap.set(clKey, {
          id_classe: cl.id_classe,
          code_classe: cl.code_classe,
          nom_classe: cl.nom_classe,
          items: [],
          subtotal: {
            total_qte: 0,
            total_montant: 0,
            monthValues: subtotalMonthValues,
          },
        });
      }

      // initialiser mois à zéro pour l'item payant (partie avec PU_envoie)
      const monthValuesPaid = {};
      for (let i = 0; i < monthKeys.length; i++) {
        monthValuesPaid[monthLabels[i]] = { qte: 0, montant: 0 };
      }
      // initialiser mois à zéro pour l'item don (partie sans PU_envoie)
      const monthValuesDon = {};
      for (let i = 0; i < monthKeys.length; i++) {
        monthValuesDon[monthLabels[i]] = { qte: 0, montant: null }; // montant = null pour don (afficher juste le nombre)
      }

      // remplir depuis aggMap si présent
      const idc = cons.id_consommable;
      if (aggMap.has(idc)) {
        const row = aggMap.get(idc);
        for (let i = 0; i < monthKeys.length; i++) {
          const key = monthKeys[i];
          const label = monthLabels[i];
          const cell = row[key];
          if (cell) {
            // paid part
            monthValuesPaid[label] = {
              qte: Number(cell.paid_qte) || 0,
              montant: Number(cell.paid_montant) || 0,
            };
            // donated part (montant = null -> frontend shows just the number)
            monthValuesDon[label] = {
              qte: Number(cell.donated_qte) || 0,
              montant: null,
            };
          }
        }
      }

      // Totaux pour la partie payante
      let total_qte_paid = 0;
      let total_montant_paid = 0;
      for (const label of monthLabels) {
        total_qte_paid += monthValuesPaid[label].qte;
        total_montant_paid += monthValuesPaid[label].montant;
      }
      // Totaux pour la partie don
      let total_qte_don = 0;
      for (const label of monthLabels) {
        total_qte_don += monthValuesDon[label].qte;
      }
      // total_montant_don will be treated as null for display, but internally we keep 0 for aggregation
      const total_montant_don_internal = 0;

      // Item payant (reste dans la vraie classe)
      const itemPaid = {
        designation: cons.nom_consommable,
        unite: cons.unite || '',
        pu: cons.prix_unitaire || 0, // on NE MODIFIE pas le pu du consommable
        monthValues: monthValuesPaid,
        total_qte: total_qte_paid,
        total_montant: total_montant_paid,
      };

      const cls = classesMap.get(clKey);
      cls.items.push(itemPaid);
      // incrémenter subtotal global de la classe
      cls.subtotal.total_qte += total_qte_paid;
      cls.subtotal.total_montant += total_montant_paid;
      // incrémenter subtotal par mois
      for (const label of monthLabels) {
        cls.subtotal.monthValues[label].qte += monthValuesPaid[label].qte;
        cls.subtotal.monthValues[label].montant += monthValuesPaid[label].montant;
      }

      // Si des dons existent pour ce consommable, on place ces quantités sous la classe "Don"
      if (total_qte_don > 0) {
        ensureDonClass();
        const donCls = classesMap.get(DON_KEY);

        const itemDon = {
          designation: cons.nom_consommable,
          unite: cons.unite || '',
          pu: null, // pu absent pour don : afficher juste le nombre
          monthValues: monthValuesDon,
          total_qte: total_qte_don,
          total_montant: null, // afficher juste le nombre => montant null
        };

        donCls.items.push(itemDon);
        donCls.subtotal.total_qte += total_qte_don;
        donCls.subtotal.total_montant += total_montant_don_internal; // interne = 0
        for (const label of monthLabels) {
          donCls.subtotal.monthValues[label].qte += monthValuesDon[label].qte;
          // conserver valeur numérique interne pour aggregation, mais monthValues on itemDon already has montant=null
          donCls.subtotal.monthValues[label].montant += 0;
        }
      }
    }

    // transformer map en array trié sur code_classe
    const classes = Array.from(classesMap.values()).sort((a, b) => {
      const ca = a.code_classe || '';
      const cb = b.code_classe || '';
      if (ca === cb) return (a.nom_classe || '').localeCompare(b.nom_classe || '');
      return ca.localeCompare(cb);
    });

    // total général (incluant monthValues) = somme des sous-totaux
    const totalMonthValues = {};
    for (let i = 0; i < monthLabels.length; i++) {
      totalMonthValues[monthLabels[i]] = { qte: 0, montant: 0 };
    }
    let total_qte = 0;
    let total_montant = 0;
    for (const clsItem of classes) {
      total_qte += clsItem.subtotal.total_qte || 0;
      total_montant += clsItem.subtotal.total_montant || 0;
      for (const label of monthLabels) {
        totalMonthValues[label].qte += clsItem.subtotal.monthValues[label].qte || 0;
        totalMonthValues[label].montant += clsItem.subtotal.monthValues[label].montant || 0;
      }
    }
    const total = {
      total_qte,
      total_montant,
      monthValues: totalMonthValues,
    };

    // Post-traitement d'affichage : pour la classe "Don" on veut "afficher juste le nombre"
    // => item.monthValues[].montant = null, item.total_montant = null, item.pu = null,
    // et pour la subtotal de la classe Don, on met les montants à null (pour l'affichage),
    // sans toucher aux totaux globaux déjà calculés ci-dessus.
    for (const clsItem of classes) {
      if ((clsItem.code_classe || '').toUpperCase() === 'DON' || clsItem.id_classe === 0) {
        // items
        for (const it of clsItem.items) {
          it.pu = null;
          it.total_montant = null;
          for (const label of monthLabels) {
            if (it.monthValues && it.monthValues[label]) {
              it.monthValues[label].montant = null;
            }
          }
        }
        // subtotal for Don: keep total_qte numeric, but set montants to null for display
        clsItem.subtotal.total_montant = null;
        for (const label of monthLabels) {
          if (clsItem.subtotal.monthValues && clsItem.subtotal.monthValues[label]) {
            clsItem.subtotal.monthValues[label].montant = null;
          }
        }
      }
    }

    return res.json({
      serviceId,
      period: { start: startIso, end: endIso },
      months: monthLabels,
      classes,
      total,
    });
  } catch (error) {
    console.error('Erreur get_rapport_consommables_par_service_auto:', error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

const get_rapport_consommables_par_service = asyncHandler(async (req, res) => {
  const serviceId = parseInt(req.params.serviceId, 10);
  if (isNaN(serviceId)) {
    return res.status(400).json({ message: 'Paramètre serviceId invalide' });
  }

  let { start, end, all } = req.query;

  try {
    const now = new Date();

    // Si all=true, chercher la première date disponible pour ce service (sinon global)
    if (all === 'true') {
      // 1) earliest for service
      const earliestForService = await prisma.$queryRaw`
        SELECT MIN(p.date_envoi) AS min_date
        FROM "Pret" p
        WHERE p.id_service = ${serviceId} AND p.date_envoi IS NOT NULL
      `;
      // 2) fallback: global earliest
      let minDate = null;
      if (Array.isArray(earliestForService) && earliestForService.length > 0) {
        minDate = earliestForService[0].min_date || null;
      } else if (earliestForService && earliestForService.min_date) {
        minDate = earliestForService.min_date;
      }

      if (!minDate) {
        const earliestGlobal = await prisma.$queryRaw`
          SELECT MIN(p.date_envoi) AS min_date FROM "Pret" p WHERE p.date_envoi IS NOT NULL
        `;
        if (Array.isArray(earliestGlobal) && earliestGlobal.length > 0) {
          minDate = earliestGlobal[0].min_date || null;
        } else if (earliestGlobal && earliestGlobal.min_date) {
          minDate = earliestGlobal.min_date;
        }
      }

      if (minDate) {
        const d = new Date(minDate);
        // start = first day of that month
        start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
        // end = now (end of current day)
        const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        end = endDate.toISOString();
      } else {
        // aucune donnée, on va tomber sur la fenêtre par défaut ci-dessous
        start = undefined;
        end = undefined;
      }
    }

    // Si start/end fournis manuellement : normaliser (start => 1er du mois, end => dernier jour du mois)
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        return res.status(400).json({ message: 'Paramètres start/end invalides (format ISO attendu)' });
      }
      start = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1)).toISOString();
      const lastDay = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      end = lastDay.toISOString();
    }

    // Si toujours aucun start/end, définir période par défaut = 13 mois finissant le mois précédent
    if (!start || !end) {
      const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const months = [];
      for (let i = 12; i >= 0; i--) {
        const d = new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth() - i, 1));
        months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
      }
      const first = months[0];
      const last = months[months.length - 1];
      start = new Date(Date.UTC(first.year, first.month - 1, 1)).toISOString();
      const lastDay = new Date(Date.UTC(last.year, last.month, 0, 23, 59, 59, 999));
      end = lastDay.toISOString();
    }

    // Construire tableau des mois (keys YYYY-MM et labels "MON ABBR YYYY")
    const monthKeys = [];
    const monthLabels = [];
    const sDate = new Date(start);
    const eDate = new Date(end);
    let cur = new Date(Date.UTC(sDate.getUTCFullYear(), sDate.getUTCMonth(), 1));
    while (cur <= eDate) {
      const y = cur.getUTCFullYear();
      const m = cur.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`; // YYYY-MM
      monthKeys.push(key);
      const label = `${MONTH_ABBR[m]} ${y}`;
      monthLabels.push(label);
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }

    // Récupérer tous les consommables (catalogue) avec leur classe
    const consommables = await prisma.consommable.findMany({
      include: { classe: true },
      orderBy: [
        { classe: { code_classe: 'asc' } },
        { nom_consommable: 'asc' },
      ],
    });

    // Récupérer agrégats par consommable et mois pour ce service et la période
    const aggregates = await prisma.$queryRaw`
      SELECT
        c.id_consommable,
        TO_CHAR(DATE_TRUNC('month', p.date_envoi), 'YYYY-MM') AS ym,
        SUM(COALESCE(p.quantite_pret, 0))::int AS total_qte,
        SUM(COALESCE(p.quantite_pret, 0) * COALESCE(c.prix_unitaire, 0))::numeric(20,2) AS total_montant
      FROM "Pret" p
      JOIN "Consommable" c ON c.id_consommable = p.id_consommable
      WHERE p.id_service = ${serviceId}
        AND p.date_envoi >= ${start}
        AND p.date_envoi <= ${end}
      GROUP BY c.id_consommable, ym;
    `;

    // Transformer aggregates en map
    const aggMap = new Map();
    for (const row of aggregates) {
      const id = Number(row.id_consommable);
      const ym = row.ym;
      if (!aggMap.has(id)) aggMap.set(id, {});
      aggMap.get(id)[ym] = {
        qte: Number(row.total_qte) || 0,
        montant: Number(row.total_montant) || 0,
      };
    }

    // Construire structure groupée par classe
    const classesMap = new Map();
    for (const cons of consommables) {
      const cl = cons.classe || { id_classe: null, nom_classe: 'Sans classe', code_classe: '' };
      const clKey = `${cl.code_classe || ''}__${cl.id_classe || 0}`;
      if (!classesMap.has(clKey)) {
        classesMap.set(clKey, {
          id_classe: cl.id_classe,
          code_classe: cl.code_classe,
          nom_classe: cl.nom_classe,
          items: [],
          subtotal: { total_qte: 0, total_montant: 0 },
        });
      }

      // init month values
      const monthValues = {};
      for (let i = 0; i < monthKeys.length; i++) {
        monthValues[monthLabels[i]] = { qte: 0, montant: 0 };
      }

      // fill from aggMap if present
      const idc = cons.id_consommable;
      if (aggMap.has(idc)) {
        const row = aggMap.get(idc);
        for (let i = 0; i < monthKeys.length; i++) {
          const key = monthKeys[i];
          const label = monthLabels[i];
          if (row[key]) {
            monthValues[label] = {
              qte: Number(row[key].qte) || 0,
              montant: Number(row[key].montant) || 0,
            };
          }
        }
      }

      // totals ligne
      let total_qte = 0;
      let total_montant = 0;
      for (const label of monthLabels) {
        total_qte += monthValues[label].qte;
        total_montant += monthValues[label].montant;
      }

      const item = {
        designation: cons.nom_consommable,
        unite: cons.unite || '',
        pu: cons.prix_unitaire || 0,
        monthValues,
        total_qte,
        total_montant,
      };

      const cls = classesMap.get(clKey);
      cls.items.push(item);
      cls.subtotal.total_qte += total_qte;
      cls.subtotal.total_montant += total_montant;
    }

    const classes = Array.from(classesMap.values()).sort((a, b) => {
      const ca = a.code_classe || '';
      const cb = b.code_classe || '';
      if (ca === cb) return (a.nom_classe || '').localeCompare(b.nom_classe || '');
      return ca.localeCompare(cb);
    });

    // Calcul total général
    const total = classes.reduce(
      (acc, cls) => {
        acc.total_qte += cls.subtotal.total_qte || 0;
        acc.total_montant += cls.subtotal.total_montant || 0;
        return acc;
      },
      { total_qte: 0, total_montant: 0 }
    );

    return res.json({
      serviceId,
      period: { start, end },
      months: monthLabels,
      classes,
      total,
    });
  } catch (error) {
    console.error('Erreur get_rapport_consommables_par_service:', error);
    return res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});



// 2. Résumé mensuel pour un service spécifique
const get_resume_mensuel_service = asyncHandler(async (req, res) => {
  const { serviceId, annee, mois } = req.params;
  
  // Validation des paramètres
  const serviceIdNum = parseInt(serviceId);
  const anneeNum = parseInt(annee);
  const moisNum = parseInt(mois);
  
  if (isNaN(serviceIdNum) || isNaN(anneeNum) || isNaN(moisNum)) {
    return res.status(400).json({
      success: false,
      message: 'Paramètres invalides'
    });
  }
  
  if (moisNum < 1 || moisNum > 12) {
    return res.status(400).json({
      success: false,
      message: 'Le mois doit être entre 1 et 12'
    });
  }
  
  // Vérifier si le service existe
  const service = await prisma.service.findUnique({
    where: { id_service: serviceIdNum }
  });
  
  if (!service) {
    return res.status(404).json({
      success: false,
      message: 'Service non trouvé'
    });
  }
  
  // Récupérer les prêts du mois
  const startDate = new Date(anneeNum, moisNum - 1, 1);
  const endDate = new Date(anneeNum, moisNum, 0, 23, 59, 59, 999);
  
  const prets = await prisma.pret.findMany({
    where: {
      id_service: serviceIdNum,
      consommable: { isNot: null },
      quantite_pret: { gt: 0 },
      date_envoi: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      consommable: {
        select: {
          id_consommable: true,
          nom_consommable: true,
          prix_unitaire: true,
          unite: true
        }
      }
    },
    orderBy: {
      date_envoi: 'asc'
    }
  });
  
  // Grouper par consommable
  const resume = {
    serviceId: serviceIdNum,
    nomService: service.nom_service,
    mois: moisNum,
    annee: anneeNum,
    totalConsommables: 0,
    coutTotal: 0,
    details: []
  };
  
  const groupedByConsommable = prets.reduce((acc, pret) => {
    if (!pret.consommable || !pret.quantite_pret) return acc;
    
    const consId = pret.consommable.id_consommable;
    
    if (!acc[consId]) {
      acc[consId] = {
        consommableId: consId,
        nomConsommable: pret.consommable.nom_consommable,
        unite: pret.consommable.unite,
        quantite: 0,
        cout: 0,
        nombreEnvois: 0
      };
    }
    
    const quantite = pret.quantite_pret;
    const prix = pret.consommable.prix_unitaire || pret.PU_envoie || 0;
    
    acc[consId].quantite += quantite;
    acc[consId].cout += quantite * prix;
    acc[consId].nombreEnvois += 1;
    
    return acc;
  }, {});
  
  // Calculer les totaux
  for (const cons of Object.values(groupedByConsommable)) {
    resume.details.push(cons);
    resume.totalConsommables += cons.quantite;
    resume.coutTotal += cons.cout;
  }
  
  res.status(200).json({
    success: true,
    data: resume
  });
});

// 3. Vue globale pour tous les services par mois
const get_stats_global_mensuel = asyncHandler(async (req, res) => {
  const { annee, mois } = req.params;
  
  const anneeNum = parseInt(annee);
  const moisNum = parseInt(mois);
  
  if (isNaN(anneeNum) || isNaN(moisNum)) {
    return res.status(400).json({
      success: false,
      message: 'Paramètres invalides'
    });
  }
  
  if (moisNum < 1 || moisNum > 12) {
    return res.status(400).json({
      success: false,
      message: 'Le mois doit être entre 1 et 12'
    });
  }
  
  // Récupérer tous les prêts du mois
  const startDate = new Date(anneeNum, moisNum - 1, 1);
  const endDate = new Date(anneeNum, moisNum, 0, 23, 59, 59, 999);
  
  const prets = await prisma.pret.findMany({
    where: {
      consommable: { isNot: null },
      quantite_pret: { gt: 0 },
      date_envoi: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      service: {
        select: {
          id_service: true,
          nom_service: true
        }
      },
      consommable: {
        select: {
          id_consommable: true,
          nom_consommable: true,
          prix_unitaire: true
        }
      }
    }
  });
  
  // Grouper par service
  const statsParService = prets.reduce((acc, pret) => {
    if (!pret.service || !pret.consommable || !pret.quantite_pret) return acc;
    
    const serviceId = pret.service.id_service;
    
    if (!acc[serviceId]) {
      acc[serviceId] = {
        serviceId: serviceId,
        nomService: pret.service.nom_service,
        totalQuantite: 0,
        coutTotal: 0,
        consommables: new Set()
      };
    }
    
    const quantite = pret.quantite_pret;
    const prix = pret.consommable.prix_unitaire || pret.PU_envoie || 0;
    
    acc[serviceId].totalQuantite += quantite;
    acc[serviceId].coutTotal += quantite * prix;
    acc[serviceId].consommables.add(pret.consommable.nom_consommable);
    
    return acc;
  }, {});
  
  // Calculer les totaux globaux et préparer la réponse
  const services = Object.values(statsParService).map(service => ({
    ...service,
    nombreConsommables: service.consommables.size,
    consommables: Array.from(service.consommables)
  }));
  
  const totalGlobal = {
    totalQuantite: services.reduce((sum, s) => sum + s.totalQuantite, 0),
    coutTotal: services.reduce((sum, s) => sum + s.coutTotal, 0),
    nombreServices: services.length,
    nombreTotalConsommables: services.reduce((sum, s) => sum + s.nombreConsommables, 0)
  };
  
  res.status(200).json({
    success: true,
    mois: moisNum,
    annee: anneeNum,
    totalGlobal,
    services
  });
});

// 4. Historique complet des consommables d'un service
const get_historique_consommables_service = asyncHandler(async (req, res) => {
  const { serviceId } = req.params;
  const { limit } = req.query;
  
  const serviceIdNum = parseInt(serviceId);
  
  if (isNaN(serviceIdNum)) {
    return res.status(400).json({
      success: false,
      message: 'ID de service invalide'
    });
  }
  
  const limitNum = limit ? parseInt(limit) : undefined;
  if (limit && isNaN(limitNum)) {
    return res.status(400).json({
      success: false,
      message: 'Limite invalide'
    });
  }
  
  // Vérifier si le service existe
  const service = await prisma.service.findUnique({
    where: { id_service: serviceIdNum }
  });
  
  if (!service) {
    return res.status(404).json({
      success: false,
      message: 'Service non trouvé'
    });
  }
  
  // Construire la requête
  const queryOptions = {
    where: {
      id_service: serviceIdNum,
      consommable: { isNot: null },
      quantite_pret: { gt: 0 }
    },
    include: {
      consommable: {
        select: {
          id_consommable: true,
          nom_consommable: true,
          prix_unitaire: true,
          unite: true
        }
      }
    },
    orderBy: {
      date_envoi: 'desc'
    }
  };
  
  // Ajouter la limite si spécifiée
  if (limitNum) {
    queryOptions.take = limitNum;
  }
  
  // Récupérer l'historique
  const prets = await prisma.pret.findMany(queryOptions);
  
  const historique = prets.map(pret => ({
    idPret: pret.id_pret,
    dateEnvoi: pret.date_envoi,
    dateRetour: pret.date_retour,
    consommableId: pret.consommable ? pret.consommable.id_consommable : null,
    nomConsommable: pret.consommable ? pret.consommable.nom_consommable : null,
    quantite: pret.quantite_pret,
    prixUnitaire: pret.consommable ? pret.consommable.prix_unitaire : (pret.PU_envoie || 0),
    cout: (pret.quantite_pret || 0) * (pret.consommable ? pret.consommable.prix_unitaire : (pret.PU_envoie || 0)),
    unite: pret.consommable ? pret.consommable.unite : null
  }));
  
  res.status(200).json({
    success: true,
    serviceId: serviceIdNum,
    nomService: service.nom_service,
    count: historique.length,
    data: historique
  });
});

// 5. Top consommables d'un service
const get_top_consommables_service = asyncHandler(async (req, res) => {
  const { serviceId } = req.params;
  const { limit } = req.query;
  
  const serviceIdNum = parseInt(serviceId);
  
  if (isNaN(serviceIdNum)) {
    return res.status(400).json({
      success: false,
      message: 'ID de service invalide'
    });
  }
  
  let limitNum = 10;
  if (limit) {
    const parsedLimit = parseInt(limit);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limitNum = parsedLimit;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Limite invalide'
      });
    }
  }
  
  // Vérifier si le service existe
  const service = await prisma.service.findUnique({
    where: { id_service: serviceIdNum }
  });
  
  if (!service) {
    return res.status(404).json({
      success: false,
      message: 'Service non trouvé'
    });
  }
  
  try {
    // Utiliser une requête raw SQL pour les statistiques avancées
    const stats = await prisma.$queryRaw`
      SELECT 
        c.id_consommable,
        c.nom_consommable,
        c.unite,
        SUM(p.quantite_pret) as total_quantite,
        SUM(p.quantite_pret * COALESCE(c.prix_unitaire, p.PU_envoie, 0)) as total_cout,
        COUNT(p.id_pret) as nombre_envois,
        MAX(p.date_envoi) as dernier_envoi
      FROM "Pret" p
      JOIN "Consommable" c ON p.id_consommable = c.id_consommable
      WHERE p.id_service = ${serviceIdNum}
        AND p.quantite_pret > 0
        AND p.date_envoi IS NOT NULL
      GROUP BY c.id_consommable, c.nom_consommable, c.unite
      ORDER BY total_quantite DESC
      LIMIT ${limitNum}
    `;
    
    res.status(200).json({
      success: true,
      serviceId: serviceIdNum,
      nomService: service.nom_service,
      count: Array.isArray(stats) ? stats.length : 0,
      data: stats || []
    });
    
  } catch (error) {
    // Gestion spécifique pour les erreurs de requête SQL
    console.error('Erreur SQL:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

export {
  get_rapport_consommables_par_service_auto,
  get_resume_mensuel_service,
  get_stats_global_mensuel,
  get_historique_consommables_service,
  get_rapport_consommables_par_service,
  get_top_consommables_service
};