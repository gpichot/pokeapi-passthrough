import express from "express";

import pokemonsRouter from "./routers/pokemons";

const app = express();

app.use(express.json());

app.get("/ping", (req, res) => {
  res.send("pong");
});
app.use("/:namespace/pokemons", pokemonsRouter);

app.listen(3000);

export default app;
