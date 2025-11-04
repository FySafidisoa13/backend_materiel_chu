import { PrismaClient } from "@prisma/client";
import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

/**
 * GET /demandes
 * - pagination: ?page=1&limit=20
 * - filters: ?statut=TRAITEE&id_service=1
 * - search on commentaire
 * - include related service, materiel, consommable
 */
const get_demandes = asyncHandler(async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.max(parseInt(req.query.limit || "25", 10), 1);
  const skip = (page - 1) * limit;

  const where = {};
  if (req.query.statut) {
    where.statut = req.query.statut;
  }
  if (req.query.id_service) {
    where.id_service = parseInt(req.query.id_service, 10);
  }
  if (req.query.id_materiel) {
    where.id_materiel = parseInt(req.query.id_materiel, 10);
  }
  if (req.query.id_consommable) {
    where.id_consommable = parseInt(req.query.id_consommable, 10);
  }
  if (req.query.search) {
    where.commentaire = { contains: req.query.search, mode: "insensitive" };
  }

  const [total, demandes] = await Promise.all([
    prisma.demande.count({ where }),
    prisma.demande.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date_demande: "desc" },
      include: {
        service: true,
        materiel: true,
        consommable: true,
      },
    }),
  ]);

  res.status(200).json({
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
    data: demandes,
  });
});

/**
 * GET /demandes/:id
 */
const get_demande = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid id parameter" });
  }

  const demande = await prisma.demande.findUnique({
    where: { id_demande: id },
    include: {
      service: true,
      materiel: true,
      consommable: true,
    },
  });

  if (!demande) {
    return res.status(404).json({ error: "Demande not found" });
  }

  res.status(200).json(demande);
});

/**
 * POST /demandes
 * body: { id_service, id_materiel?, id_consommable?, quantite?, commentaire? }
 */
const create_demande = asyncHandler(async (req, res, next) => {
  const {
    id_service,
    id_materiel = null,
    id_consommable = null,
    quantite = null,
    commentaire = null,
  } = req.body;

  if (!id_service) {
    return res.status(400).json({ error: "id_service is required" });
  }

  if (!id_materiel && !id_consommable) {
    return res
      .status(400)
      .json({ error: "Either id_materiel or id_consommable must be provided" });
  }

 
  const checks = await Promise.all([
    prisma.service.findUnique({ where: { id_service } }),
    id_materiel ? prisma.materiels.findUnique({ where: { id_materiel } }) : null,
    id_consommable
      ? prisma.consommable.findUnique({ where: { id_consommable } })
      : null,
  ]);

  if (!checks[0]) {
    return res.status(404).json({ error: "Service not found" });
  }
  if (id_materiel && !checks[1]) {
    return res.status(404).json({ error: "Materiel not found" });
  }
  if (id_consommable && !checks[2]) {
    return res.status(404).json({ error: "Consommable not found" });
  }

  const created = await prisma.demande.create({
    data: {
      id_service,
      id_materiel,
      id_consommable,
      quantite,
      commentaire,
    },
    include: {
      service: true,
      materiel: true,
      consommable: true,
    },
  });

  res.status(201).json(created);
});

/**
 * POST /demandes/batch
 * body: { demandes: [ { id_service, id_materiel?, id_consommable?, quantite?, commentaire? }, ... ] }
 * - creates many demandes in a single operation (validates references first)
 */
const create_many_demandes = asyncHandler(async (req, res ) => {
  const list = Array.isArray(req.body.demandes) ? req.body.demandes : [];

  if (list.length === 0) {
    return res.status(400).json({ error: "No demandes provided" });
  }

  // Collect unique referenced ids to validate existence with fewer DB calls
  const serviceIds = [...new Set(list.map((d) => d.id_service).filter(Boolean))];
  const materielIds = [
    ...new Set(list.map((d) => d.id_materiel).filter(Boolean)),
  ];
  const consommableIds = [
    ...new Set(list.map((d) => d.id_consommable).filter(Boolean)),
  ];

  const [services, materiels, consommables] = await Promise.all([
    prisma.service.findMany({ where: { id_service: { in: serviceIds } }, select: { id_service: true } }),
    materielIds.length ? prisma.materiels.findMany({ where: { id_materiel: { in: materielIds } }, select: { id_materiel: true } }) : [],
    consommableIds.length ? prisma.consommable.findMany({ where: { id_consommable: { in: consommableIds } }, select: { id_consommable: true } }) : [],
  ]);

  const serviceSet = new Set(services.map((s) => s.id_service));
  const materielSet = new Set(materiels.map((m) => m.id_materiel));
  const consommableSet = new Set(consommables.map((c) => c.id_consommable));

  // Validate each demande
  for (const [idx, d] of list.entries()) {
    if (!d.id_service || !serviceSet.has(d.id_service)) {
      return res.status(400).json({ error: `Invalid or missing id_service at index ${idx}` });
    }
    if (!d.id_materiel && !d.id_consommable) {
      return res.status(400).json({ error: `Either id_materiel or id_consommable required at index ${idx}` });
    }
    if (d.id_materiel && !materielSet.has(d.id_materiel)) {
      return res.status(400).json({ error: `Invalid id_materiel at index ${idx}` });
    }
    if (d.id_consommable && !consommableSet.has(d.id_consommable)) {
      return res.status(400).json({ error: `Invalid id_consommable at index ${idx}` });
    }
  }

  // Prepare data for createMany (map keys must match DB columns)
  const data = list.map((d) => ({
    id_service: d.id_service,
    id_materiel: d.id_materiel ?? null,
    id_consommable: d.id_consommable ?? null,
    quantite: d.quantite ?? null,
    commentaire: d.commentaire ?? null,
    // statut and date_demande will use defaults
  }));

  const result = await prisma.demande.createMany({
    data,
    skipDuplicates: false, // there is no unique constraint on Demande so duplicates are unlikely but configurable
  });

  res.status(201).json({ createdCount: result.count });
});

/**
 * PUT /demandes/:id
 * body may contain any updatable fields: statut, id_service, id_materiel, id_consommable, quantite, commentaire
 */
const update_demande = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid id parameter" });
  }

  // Check existing record
  const existing = await prisma.demande.findUnique({ where: { id_demande: id } });
  if (!existing) {
    return res.status(404).json({ error: "Demande not found" });
  }

  const {
    id_service,
    id_materiel,
    id_consommable,
    quantite,
    commentaire,
    statut,
  } = req.body;

  // Validate foreign keys if provided
  if (id_service) {
    const svc = await prisma.service.findUnique({ where: { id_service } });
    if (!svc) return res.status(404).json({ error: "Service not found" });
  }
  if (id_materiel) {
    const m = await prisma.materiels.findUnique({ where: { id_materiel } });
    if (!m) return res.status(404).json({ error: "Materiel not found" });
  }
  if (id_consommable) {
    const c = await prisma.consommable.findUnique({ where: { id_consommable } });
    if (!c) return res.status(404).json({ error: "Consommable not found" });
  }

  const updated = await prisma.demande.update({
    where: { id_demande: id },
    data: {
      id_service: id_service ?? undefined,
      id_materiel: id_materiel ?? undefined,
      id_consommable: id_consommable ?? undefined,
      quantite: quantite ?? undefined,
      commentaire: commentaire ?? undefined,
      statut: statut ?? undefined,
    },
    include: {
      service: true,
      materiel: true,
      consommable: true,
    },
  });

  res.status(200).json(updated);
});

/**
 * DELETE /demandes/:id
 */
const delete_demande = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid id parameter" });
  }

  // ensure exists
  const existing = await prisma.demande.findUnique({ where: { id_demande: id } });
  if (!existing) {
    return res.status(404).json({ error: "Demande not found" });
  }

  await prisma.demande.delete({ where: { id_demande: id } });
  res.status(204).send();
});

export {
  get_demandes,
  get_demande,
  create_demande,
  create_many_demandes,
  update_demande,
  delete_demande,
};