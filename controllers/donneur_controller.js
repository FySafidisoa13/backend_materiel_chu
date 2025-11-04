import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_donneur = asyncHandler(async (req, res, next) => {
  console.log("get donneur");
  try {
    const donneur = await prisma.donneur.findMany({
      include: {
        lot_materiels: {
          select: {
            id_lot: true,
            codeQR: true,
            numero: true,
          },
        },
      
        _count: {
          select: {
            lot_materiels: true
          },
        },
      },
    });
    res.status(200).json(donneur);
  } catch (error) {
    res.status(500).json(error);
  }
});

const count_donneur = asyncHandler(async (req, res, next) => {
  try {
    const count_donneur = await prisma.donneur.count();
    res.status(200).json(count_donneur);
  } catch (error) {
    res.status(500).json(error);
  }
});

const create_donneur = asyncHandler(async (req, res, next) => {
  try {
    const donneur = await prisma.donneur.create({
      data: { ...req.body },
    });
    res.status(200).json(donneur);
  } catch (error) {
    res.status(500).json(error);
  }
});
const delete_donneur = asyncHandler(async (req, res, next) => {
  try {
    const donneur = await prisma.donneur.delete({
      where: { id_donneur: Number(req.params.id) },
    });
    res.status(200).json(donneur);
  } catch (error) {
    res.status(500).send(error);
  }
});
const update_donneur = asyncHandler(async (req, res, next) => {
  try {
    const donneur = await prisma.donneur.update({
      data: { ...req.body },
      where: { id_donneur: Number(req.params.id) },
    });

    res.status(200).json(donneur);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_one_donneur = asyncHandler(async (req, res, next) => {
  try {
    const donneur = await prisma.donneur.findUnique({
      where: { id_donneur: Number(req.params.id) },
    });
    res.status(200).json(donneur);
  } catch (error) {
    res.status(500).send(error);
  }
});

export {
  get_donneur,
  count_donneur,
  delete_donneur,
  update_donneur,
  create_donneur,
  get_one_donneur,
};
