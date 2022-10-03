import { PrismaClient } from "@prisma/client";
import express from "express";

import pokemonsRouter from "./routers/pokemons";

const prisma = new PrismaClient();

const app = express();

app.use(express.json());

app.get("/ping", (req, res) => {
  res.send("pong");
});
app.use("/:namespace/pokemons", pokemonsRouter);

app.get("/admin/pokemons", async (req, res) => {
  const pokemons = await prisma.pokemon.findMany({
    orderBy: { namespace: "asc" },
  });

  res.json(pokemons);
});

app.listen(3000);

export default app;
