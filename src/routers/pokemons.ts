import { Pokemon, Prisma, PrismaClient } from "@prisma/client";
import express from "express";
import PokeAPI, { IPokemon } from "pokeapi-typescript";
import { z } from "zod";
import {
  validateRequestBody,
  validateRequestParams,
  validateRequestQuery,
} from "zod-express-middleware";

const prisma = new PrismaClient();

const router = express.Router({ mergeParams: true });

function normalizePokemon(pokemon: IPokemon) {
  return {
    id: pokemon.id,
    name: pokemon.name,
    types: pokemon.types.map((type) => type.type.name),
    image: pokemon.sprites.front_default,
    weight: pokemon.weight,
    height: pokemon.height,
    base_experience: pokemon.base_experience,
    forms: pokemon.forms.map((form) => form.name),
    abilities: pokemon.abilities.map((ability) => ability.ability.name),
    stats: Object.fromEntries(
      pokemon.stats.map((stat) => [stat.stat.name, stat.base_stat])
    ),
    //sprites: pokemon.sprites,
  };
}

type PokemonNormalized = Omit<ReturnType<typeof normalizePokemon>, "id"> & {
  id: number | string;
};

function normalizePokemonFromDatabase(pokemon: Pokemon): PokemonNormalized {
  return {
    id: pokemon.id,
    name: pokemon.name,
    types: [pokemon.type],
    weight: pokemon.weight,
    height: pokemon.height,
    image:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
    base_experience: 0,
    forms: [],
    abilities: [],
    stats: {
      hp: 0,
      attack: 0,
      defense: 0,
      "special-attack": 0,
      "special-defense": 0,
      speed: 0,
    },
  };
}

router.get(
  "/",
  validateRequestQuery(
    z.object({
      limit: z
        .preprocess((value) => parseInt(value as string) || 10, z.number())
        .optional(),
      offset: z
        .preprocess((value) => parseInt(value as string) || 0, z.number())
        .optional(),
    })
  ),
  async (req, res) => {
    const namespace = req.params.namespace;
    const countPokemons = await prisma.pokemon.count({
      where: { namespace },
    });
    const { limit = 10, offset = 0 } = req.query as {
      limit?: number;
      offset?: number;
    };

    const newLimit = offset < countPokemons ? limit - countPokemons : limit;
    const newOffset = Math.max(offset - countPokemons, 0);

    const list = await PokeAPI.Pokemon.list(newLimit || 1, newOffset);
    const pokemons = await Promise.all(
      list.results.map(async (pokemon) => {
        return PokeAPI.Pokemon.fetch(pokemon.name);
      })
    );

    const pokemonsDb =
      countPokemons > 0
        ? await prisma.pokemon.findMany({
            where: { namespace },
            take: Number(limit),
            skip: Number(offset),
            orderBy: { id: "desc" },
          })
        : [];

    const pokemonsNormalized = pokemonsDb.map(normalizePokemonFromDatabase);
    const fetchedPokemons = pokemons.map(normalizePokemon);

    res.json({
      count: list.count + countPokemons,
      next: list.next,
      previous: list.previous,
      results: [...pokemonsNormalized, ...(newLimit ? fetchedPokemons : [])],
    });
  }
);

router.get(
  "/:name",
  validateRequestParams(
    z.object({
      name: z.string(),
      namespace: z.string(),
    })
  ),
  async (req, res) => {
    const namespace = req.params.namespace;
    try {
      const pokemon = await PokeAPI.Pokemon.fetch(req.params.name);
      res.json(normalizePokemon(pokemon));
    } catch (error) {
      const pokemon = await prisma.pokemon.findUnique({
        where: {
          namespace_name: {
            namespace,
            name: req.params.name,
          },
        },
      });
      if (!pokemon) {
        res.status(404).send("Not found");
      } else {
        res.json(pokemon);
      }
    }
  }
);

/**
 * Curl example
 *
 * curl -X POST \
 *  http://localhost:3000/test/pokemons \
 *  -H 'Content-Type: application/json' \
 *  -d '{
 *   "name": "pikachu",
 *   "type": "electric"
 *  }'
 */
router.post(
  "/",
  validateRequestBody(
    z.object({
      name: z.string(),
      type: z.string(),
      weight: z.number().optional(),
      height: z.number().optional(),
    })
  ),
  async (req, res) => {
    const namespace = req.params.namespace;
    try {
      const pokemon = await prisma.pokemon.create({
        data: {
          namespace,
          name: req.body.name,
          type: req.body.type,
          weight: req.body.weight || 42,
          height: req.body.height || 10,
        },
      });

      const normalizedPokemon: PokemonNormalized =
        normalizePokemonFromDatabase(pokemon);

      res.json(normalizedPokemon);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;

      if (error.code !== "P2002") throw error;

      res.status(409).send("Already exists");
    }
  }
);

export default router;
