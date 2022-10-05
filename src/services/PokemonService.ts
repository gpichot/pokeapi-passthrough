import { Pokemon, Prisma, PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import PokeAPI, { IPokemon } from "pokeapi-typescript";
import { z } from "zod";

const prisma = new PrismaClient();

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
  } as unknown as PokemonDetail;
}

export type PokemonDetail = {
  id: number | string;
  name: string;
  types: string[];
  image: string;
  weight: number;
  height: number;
  base_experience: number;
  forms: string[];
  abilities: string[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    "special-attack": number;
    "special-defense": number;
    speed: number;
  };
};

function normalizePokemonFromDatabase(pokemon: Pokemon): PokemonDetail {
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

export type QueryParams = {
  offset?: number;
  limit?: number;
  searchText?: string;
};
export type PokemonCreateFields = {
  name: string;
  type: string;
  weight?: number;
  height?: number;
};

const cache = {
  pokemons: [] as PokemonDetail[],
};

/**
 * Use cached pokemon on file or use API
 */
async function cachePokemonOnFile(name: string) {
  const filename = path.join(process.cwd(), `./cache/${name}.json`);
  // Create cache dir if not exists
  await fs.mkdir(path.dirname(filename), { recursive: true });

  if (await fs.stat(filename).catch(() => false)) {
    return JSON.parse(await fs.readFile(filename, "utf-8")) as PokemonDetail;
  }

  const pokemon = await PokeAPI.Pokemon.resolve(name);
  const normalizedPokemon = normalizePokemon(pokemon);

  await fs.writeFile(filename, JSON.stringify(normalizedPokemon));

  return normalizedPokemon;
}

async function fetchAllPokemons() {
  if (!cache.pokemons.length) {
    const allPokemons = await PokeAPI.Pokemon.list(2000, 0);
    const pokemons = await Promise.all(
      allPokemons.results.map((pokemon) => cachePokemonOnFile(pokemon.name))
    );

    cache.pokemons = pokemons;
  }

  return cache.pokemons;
}

async function fetchPokemonsFromDb(namespace: string) {
  const pokemons = await prisma.pokemon.findMany({
    where: { namespace },
    orderBy: { id: "desc" },
  });

  return pokemons.map(normalizePokemonFromDatabase);
}

export default class PokemonService {
  public async list(
    namespace: string,
    { limit = 10, offset = 0, searchText = "" }: QueryParams
  ) {
    const pokemonsApi = await fetchAllPokemons();
    const pokemonsDB = await fetchPokemonsFromDb(namespace);

    const pokemons = [...pokemonsDB, ...pokemonsApi];
    const filteredPokemons = searchText
      ? pokemons.filter(({ name }) => name.includes(searchText))
      : pokemons;

    const slice = filteredPokemons.slice(offset, offset + limit);

    const nextOffset = offset + limit;
    const hasNextPage = nextOffset < filteredPokemons.length;

    const previous = offset > 0 ? Math.max(offset - limit, 0) : null;
    const previousLimit = offset > 0 ? (offset < limit ? offset : limit) : null;
    return {
      count: filteredPokemons.length,
      next: hasNextPage
        ? `https://pokeapi.fly.dev/${namespace}/pokemons?limit=${limit}&offset=${nextOffset}&searchText=${searchText}`
        : null,
      nextLimit: hasNextPage ? limit : null,
      nextOffset: hasNextPage ? nextOffset : null,
      previousLimit: previousLimit,
      previousOffset: previous,
      previous:
        previous !== null
          ? `https://pokeapi.fly.dev/${namespace}/pokemons?limit=${previousLimit}&offset=${previous}&searchText=${searchText}`
          : null,
      results: slice,
    };
  }

  public async getOne(namespace: string, name: string) {
    try {
      const pokemon = await PokeAPI.Pokemon.resolve(name);
      return normalizePokemon(pokemon);
    } catch (error) {
      const pokemon = await prisma.pokemon.findUnique({
        where: {
          namespace_name: {
            namespace,
            name,
          },
        },
      });
      return pokemon ? normalizePokemonFromDatabase(pokemon) : null;
    }
  }
  public async create(namespace: string, body: PokemonCreateFields) {
    try {
      const pokemon = await prisma.pokemon.create({
        data: {
          namespace,
          name: body.name,
          type: body.type,
          weight: body.weight || 42,
          height: body.height || 10,
        },
      });

      const normalizedPokemon: PokemonDetail =
        normalizePokemonFromDatabase(pokemon);

      return normalizedPokemon;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;

      if (error.code !== "P2002") throw error;

      return "Already exists";
    }
  }
}
