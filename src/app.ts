import { PrismaClient } from "@prisma/client";
import cors from "cors";
import express, {
  json,
  Request as ExRequest,
  Response as ExResponse,
  urlencoded,
} from "express";
import swaggerUi from "swagger-ui-express";

import { RegisterRoutes } from "../build/routes";

export const app = express();

app.use(
  cors({
    origin: "*",
  })
);

const prisma = new PrismaClient();
// Use body parser to read sent json payloads
app.use(
  urlencoded({
    extended: true,
  })
);
app.use(json());

app.use("/docs", swaggerUi.serve, async (_req: ExRequest, res: ExResponse) => {
  return res.send(
    swaggerUi.generateHTML(await import("../build/swagger.json"), {})
  );
});

app.get("/swagger.json", async (_req: ExRequest, res: ExResponse) => {
  return res.json(await import("../build/swagger.json"));
});
app.get("/admin/pokemons", async (req, res) => {
  const pokemons = await prisma.pokemon.findMany({
    orderBy: { namespace: "asc" },
  });

  res.json(pokemons);
});

RegisterRoutes(app);
